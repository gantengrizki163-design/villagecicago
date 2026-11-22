import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION, rtdb } from '../helpers/firebase';
import { buildMemberAccessRef, isValidSimpleId } from '../helpers/housing';
import { ensurePhase6Configs } from '../helpers/law';
import { appendLedger, applyTreasuryCredit } from '../helpers/ledger';
import { assertNearLocation, buildDynamicLandPlotTarget } from '../helpers/location';
import { appendTransaction, productsConfig } from '../helpers/phase2';
import {
  computeElapsedConstructionPhase,
  computeLandPlotPrice,
  computeStationTier,
  constructionConfig,
  isPlotAvailableForPurchase,
  landConfig,
} from '../helpers/propertyAdvanced';

/**
 * 1. buyLand: Beli kavling tanah kosong (anti double-buy transaksional + BPHTB 2.5%).
 */
export const buyLand = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const data = (request.data || {}) as {
      plotId?: unknown;
      payFrom?: unknown;
      devProjectId?: unknown;
    };

    const plotId = isValidSimpleId(data.plotId) ? data.plotId.trim() : '';
    const payFrom = data.payFrom === 'bank' ? 'bank' : 'wallet';
    const devProjectId = isValidSimpleId(data.devProjectId) ? data.devProjectId.trim() : '';

    if (!plotId) {
      throw new HttpsError('invalid-argument', 'ID kavling tanah wajib diisi.');
    }

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const charRef = db.collection('characters').doc(uid);
    const accRef = db.collection('accounts').doc(uid);
    const plotRef = db.collection('land_plots').doc(plotId);
    const treasuryRef = db.collection('state').doc('treasury');
    const devRef = devProjectId ? db.collection('dev_projects').doc(devProjectId) : null;

    const [charPre, ownedLandsSnap, plotPre] = await Promise.all([
      charRef.get(),
      db.collection('land_plots').where('ownerId', '==', uid).limit(landConfig.maxLandsPerPlayer + 1).get(),
      plotRef.get(),
    ]);

    if (!charPre.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
    if (!plotPre.exists) throw new HttpsError('not-found', 'Kavling tanah tidak ditemukan.');

    const charPreData = charPre.data()!;
    if ((charPreData.currentZone || 'cicalengka') !== 'cicalengka') {
      throw new HttpsError('failed-precondition', 'Pembelian kavling hanya tersedia di zona Cicalengka.');
    }

    if (ownedLandsSnap.size >= landConfig.maxLandsPerPlayer) {
      throw new HttpsError(
        'failed-precondition',
        `Maksimal kepemilikan tanah per pemain adalah ${landConfig.maxLandsPerPlayer} kavling.`
      );
    }

    await assertNearLocation(
      rtdb,
      uid,
      charPreData,
      ['kantor_desa', 'kantor_agen'],
      0,
      [buildDynamicLandPlotTarget(plotId, plotPre.data()!)],
      'Datangi lokasi kavling, Kantor Desa, atau Kantor Agen Properti untuk membeli tanah.'
    );

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, accDoc, plotDoc, treasuryDoc, devDoc] = await Promise.all([
        tx.get(charRef),
        payFrom === 'bank' ? tx.get(accRef) : Promise.resolve(null),
        tx.get(plotRef),
        tx.get(treasuryRef),
        devRef ? tx.get(devRef) : Promise.resolve(null),
      ]);

      if (!charDoc.exists || !plotDoc.exists) {
        throw new HttpsError('not-found', 'Data kavling tidak ditemukan.');
      }

      const plot = plotDoc.data()!;
      if (!isPlotAvailableForPurchase(plot)) {
        throw new HttpsError('already-exists', `Kavling ini sudah dimiliki oleh ${String(plot.ownerName || 'warga lain')}.`);
      }

      const price = computeLandPlotPrice(plot);
      const tax = Math.round(price * 0.025);
      const totalCost = price + tax;

      const charData = charDoc.data()!;
      const walletMoney = Number(charData.money || 0);
      const bankBalance = accDoc?.exists ? Number(accDoc.data()!.balance || 0) : 0;

      if (payFrom === 'bank') {
        if (!accDoc?.exists || bankBalance < totalCost) {
          throw new HttpsError(
            'failed-precondition',
            `Saldo rekening kurang! Butuh Rp ${totalCost.toLocaleString('id-ID')} (termasuk BPHTB 2,5%).`
          );
        }
      } else if (walletMoney < totalCost) {
        throw new HttpsError(
          'failed-precondition',
          `Uang tunai kurang! Butuh Rp ${totalCost.toLocaleString('id-ID')} (termasuk BPHTB 2,5%).`
        );
      }

      const nextWalletMoney = payFrom === 'wallet' ? walletMoney - totalCost : walletMoney;
      const nextBankBalance = payFrom === 'bank' ? bankBalance - totalCost : bankBalance;
      const certificateId = `SHM_TANAH_${plotId}_${nowMs}`;

      tx.update(plotRef, {
        ownerId: uid,
        ownerName: String(charData.name || 'Warga'),
        certificateId,
        permitStatus: 'none',
        permitAppliedAtMs: 0,
        permitReadyAtMs: 0,
        constructionId: null,
        propertyId: null,
        updatedAtMs: nowMs,
      });

      if (devDoc?.exists && devDoc.data()!.developerId === uid && devRef) {
        const curPlots = Array.isArray(devDoc.data()!.plotIds)
          ? (devDoc.data()!.plotIds as string[])
          : [];
        if (!curPlots.includes(plotId)) {
          tx.update(devRef, {
            plotIds: [...curPlots, plotId],
            totalCapitalSpent: Number(devDoc.data()!.totalCapitalSpent || 0) + totalCost,
          });
        }
      }

      if (payFrom === 'bank' && accDoc?.exists) {
        tx.update(accRef, { balance: nextBankBalance, updatedAtMs: nowMs });
      }

      tx.update(charRef, {
        money: nextWalletMoney,
        reputation: Math.min(100, Number(charData.reputation ?? 50) + 3),
        updatedAt: now,
      });

      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'beli_tanah',
        amount: totalCost,
        balanceAfter: nextWalletMoney,
        description: `Beli ${String(plot.name)} (${certificateId})`,
        nowMs,
      });

      applyTreasuryCredit(tx, db, treasuryDoc, tax, 'property', nowMs);
      appendLedger(tx, db, {
        from: uid,
        to: 'system:treasury',
        amount: price,
        taxAmount: tax,
        reason: 'land_plot_purchased',
        refId: plotId,
        nowMs,
      });

      return {
        plotId,
        plotName: String(plot.name),
        certificateId,
        price,
        tax,
        totalCost,
        money: nextWalletMoney,
        bankBalance: nextBankBalance,
      };
    });

    return { ok: true, ...result };
  }
);

/**
 * 2. applyPermit: Ajukan Izin Mendirikan Bangunan (IMB) untuk kavling milik sendiri.
 */
export const applyPermit = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const data = (request.data || {}) as { plotId?: unknown; payFrom?: unknown };
    const plotId = isValidSimpleId(data.plotId) ? data.plotId.trim() : '';
    const payFrom = data.payFrom === 'bank' ? 'bank' : 'wallet';

    if (!plotId) {
      throw new HttpsError('invalid-argument', 'ID kavling wajib diisi.');
    }

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const charRef = db.collection('characters').doc(uid);
    const accRef = db.collection('accounts').doc(uid);
    const plotRef = db.collection('land_plots').doc(plotId);
    const treasuryRef = db.collection('state').doc('treasury');

    const [charPre, plotPre] = await Promise.all([charRef.get(), plotRef.get()]);
    if (!charPre.exists || !plotPre.exists) {
      throw new HttpsError('not-found', 'Karakter atau kavling tidak ditemukan.');
    }
    await assertNearLocation(
      rtdb,
      uid,
      charPre.data()!,
      ['kantor_desa'],
      0,
      [buildDynamicLandPlotTarget(plotId, plotPre.data()!)],
      'Datangi Kantor Desa Cicalengka atau berdiri di kavlingmu untuk mengurus IMB.'
    );

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, accDoc, plotDoc, treasuryDoc] = await Promise.all([
        tx.get(charRef),
        payFrom === 'bank' ? tx.get(accRef) : Promise.resolve(null),
        tx.get(plotRef),
        tx.get(treasuryRef),
      ]);

      if (!charDoc.exists || !plotDoc.exists) {
        throw new HttpsError('not-found', 'Data kavling tidak ditemukan.');
      }

      const plot = plotDoc.data()!;
      if (plot.ownerId !== uid) {
        throw new HttpsError('permission-denied', 'Hanya pemilik tanah yang bisa mengajukan IMB.');
      }
      if (plot.permitStatus === 'approved') {
        throw new HttpsError('failed-precondition', 'IMB kavling ini sudah disetujui.');
      }
      if (plot.permitStatus === 'pending') {
        if (nowMs >= Number(plot.permitReadyAtMs || 0)) {
          tx.update(plotRef, { permitStatus: 'approved', updatedAtMs: nowMs });
          return {
            plotId,
            permitStatus: 'approved',
            permitReadyAtMs: Number(plot.permitReadyAtMs || nowMs),
            fee: 0,
            money: Number(charDoc.data()!.money || 0),
          };
        }
        const remSec = Math.ceil((Number(plot.permitReadyAtMs || nowMs) - nowMs) / 1000);
        throw new HttpsError('failed-precondition', `IMB masih diproses Kantor Desa (${remSec} detik lagi).`);
      }

      const fee = Math.round(
        landConfig.imbFeeBase * (plot.roadAccess === 'utama' ? 1.15 : 1.0)
      );
      const charData = charDoc.data()!;
      const walletMoney = Number(charData.money || 0);
      const bankBalance = accDoc?.exists ? Number(accDoc.data()!.balance || 0) : 0;

      if (payFrom === 'bank') {
        if (!accDoc?.exists || bankBalance < fee) {
          throw new HttpsError(
            'failed-precondition',
            `Saldo bank kurang untuk retribusi IMB Rp ${fee.toLocaleString('id-ID')}.`
          );
        }
      } else if (walletMoney < fee) {
        throw new HttpsError(
          'failed-precondition',
          `Uang tunai kurang untuk retribusi IMB Rp ${fee.toLocaleString('id-ID')}.`
        );
      }

      const nextWalletMoney = payFrom === 'wallet' ? walletMoney - fee : walletMoney;
      const nextBankBalance = payFrom === 'bank' ? bankBalance - fee : bankBalance;
      const permitReadyAtMs = nowMs + landConfig.imbDurationMs;

      tx.update(plotRef, {
        permitStatus: 'pending',
        permitAppliedAtMs: nowMs,
        permitReadyAtMs,
        updatedAtMs: nowMs,
      });

      if (payFrom === 'bank' && accDoc?.exists) {
        tx.update(accRef, { balance: nextBankBalance, updatedAtMs: nowMs });
      }
      tx.update(charRef, { money: nextWalletMoney, updatedAt: now });

      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'izin_imb',
        amount: fee,
        balanceAfter: nextWalletMoney,
        description: `Pengajuan IMB ${String(plot.name)}`,
        nowMs,
      });

      applyTreasuryCredit(tx, db, treasuryDoc, fee, 'property', nowMs);
      appendLedger(tx, db, {
        from: uid,
        to: 'system:treasury',
        amount: fee,
        taxAmount: fee,
        reason: 'land_imb_permit_fee',
        refId: plotId,
        nowMs,
      });

      return {
        plotId,
        permitStatus: 'pending',
        permitReadyAtMs,
        fee,
        money: nextWalletMoney,
        bankBalance: nextBankBalance,
      };
    });

    return { ok: true, ...result };
  }
);

/**
 * 3. startConstruction: Mulai pembangunan rumah/ruko pada kavling yang IMB-nya disetujui.
 * Memotong stok material bangunan dari characters/{uid}/inventory secara transaksional.
 */
export const startConstruction = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const data = (request.data || {}) as {
      plotId?: unknown;
      blueprintId?: unknown;
      contractorType?: unknown;
      payFrom?: unknown;
      devProjectId?: unknown;
    };

    const plotId = isValidSimpleId(data.plotId) ? data.plotId.trim() : '';
    const blueprintId =
      data.blueprintId === 'kecil' || data.blueprintId === 'sedang' || data.blueprintId === 'besar'
        ? data.blueprintId
        : null;
    const contractorType = data.contractorType === 'player' ? 'player' : 'npc';
    const payFrom = data.payFrom === 'bank' ? 'bank' : 'wallet';
    const devProjectId = isValidSimpleId(data.devProjectId) ? data.devProjectId.trim() : '';

    if (!plotId || !blueprintId) {
      throw new HttpsError('invalid-argument', 'ID kavling dan tipe blueprint (kecil/sedang/besar) wajib dipilih.');
    }

    const blueprints = constructionConfig.blueprints as Record<
      string,
      {
        id: string;
        name: string;
        propertyType: string;
        rooms: number;
        laborCost: number;
        phaseDurationSec: number;
        materials: Record<string, number>;
      }
    >;
    const bp = blueprints[blueprintId];
    if (!bp) {
      throw new HttpsError('invalid-argument', 'Blueprint konstruksi tidak ditemukan.');
    }

    const feeRate =
      contractorType === 'player'
        ? constructionConfig.contractorFeeRate.player
        : constructionConfig.contractorFeeRate.npc;
    const laborCost = Math.round(bp.laborCost * feeRate);
    const requiredMaterials = bp.materials;
    const materialIds = Object.keys(requiredMaterials);

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const charRef = db.collection('characters').doc(uid);
    const accRef = db.collection('accounts').doc(uid);
    const plotRef = db.collection('land_plots').doc(plotId);
    const devRef = devProjectId ? db.collection('dev_projects').doc(devProjectId) : null;

    const constructionId = `con_${plotId}_${nowMs}`;
    const conRef = db.collection('constructions').doc(constructionId);

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, accDoc, plotDoc, devDoc, ...matDocs] = await Promise.all([
        tx.get(charRef),
        payFrom === 'bank' ? tx.get(accRef) : Promise.resolve(null),
        tx.get(plotRef),
        devRef ? tx.get(devRef) : Promise.resolve(null),
        ...materialIds.map((mId) => tx.get(charRef.collection('inventory').doc(mId))),
      ]);

      if (!charDoc.exists || !plotDoc.exists) {
        throw new HttpsError('not-found', 'Karakter atau kavling tidak ditemukan.');
      }

      const charData = charDoc.data()!;
      const plot = plotDoc.data()!;

      if (plot.ownerId !== uid) {
        throw new HttpsError('permission-denied', 'Kavling bukan milikmu.');
      }
      if (plot.constructionId || plot.propertyId) {
        throw new HttpsError('failed-precondition', 'Kavling ini sudah memiliki proyek bangunan.');
      }

      const permitApproved =
        plot.permitStatus === 'approved' ||
        (plot.permitStatus === 'pending' && nowMs >= Number(plot.permitReadyAtMs || 0));
      if (!permitApproved) {
        throw new HttpsError(
          'failed-precondition',
          'IMB belum terbit. Ajukan IMB terlebih dahulu atau tunggu proses selesai.'
        );
      }

      // Cek & siapkan pemotongan material dari inventaris
      const missingList: string[] = [];
      for (let i = 0; i < materialIds.length; i++) {
        const mId = materialIds[i];
        const need = Number(requiredMaterials[mId] || 0);
        const have = matDocs[i].exists ? Number(matDocs[i].data()!.quantity || 0) : 0;
        if (have < need) {
          const meta = productsConfig.products.find((p) => p.id === mId);
          missingList.push(`${meta?.name || mId} (${have}/${need})`);
        }
      }
      if (missingList.length > 0) {
        throw new HttpsError(
          'failed-precondition',
          `Material bangunan kurang: ${missingList.join(', ')}. Beli di TB Sumber Karya / Pasar.`
        );
      }

      const walletMoney = Number(charData.money || 0);
      const bankBalance = accDoc?.exists ? Number(accDoc.data()!.balance || 0) : 0;
      if (payFrom === 'bank') {
        if (!accDoc?.exists || bankBalance < laborCost) {
          throw new HttpsError(
            'failed-precondition',
            `Saldo rekening kurang untuk upah tukang Rp ${laborCost.toLocaleString('id-ID')}.`
          );
        }
      } else if (walletMoney < laborCost) {
        throw new HttpsError(
          'failed-precondition',
          `Uang tunai kurang untuk upah tukang Rp ${laborCost.toLocaleString('id-ID')}.`
        );
      }

      // Potong material inventaris
      for (let i = 0; i < materialIds.length; i++) {
        const mId = materialIds[i];
        const need = Number(requiredMaterials[mId] || 0);
        const have = Number(matDocs[i].data()!.quantity || 0);
        const remain = have - need;
        if (remain <= 0) {
          tx.delete(matDocs[i].ref);
        } else {
          tx.update(matDocs[i].ref, { quantity: remain, updatedAtMs: nowMs });
        }
      }

      const nextWalletMoney = payFrom === 'wallet' ? walletMoney - laborCost : walletMoney;
      const nextBankBalance = payFrom === 'bank' ? bankBalance - laborCost : bankBalance;
      const phaseEndsAtMs = nowMs + bp.phaseDurationSec * 1000;

      tx.set(conRef, {
        id: constructionId,
        ownerId: uid,
        ownerName: String(charData.name || 'Warga'),
        plotId,
        blueprintId,
        contractorType,
        phase: 'pondasi',
        startedAtMs: nowMs,
        phaseStartedAtMs: nowMs,
        phaseEndsAtMs,
        materials: requiredMaterials,
        totalCost: laborCost,
        status: 'active',
        propertyId: null,
        devProjectId: devDoc?.exists && devDoc.data()!.developerId === uid ? devProjectId : null,
      });

      tx.update(plotRef, {
        permitStatus: 'approved',
        constructionId,
        updatedAtMs: nowMs,
      });

      if (devDoc?.exists && devDoc.data()!.developerId === uid && devRef) {
        const curCons = Array.isArray(devDoc.data()!.constructionIds)
          ? (devDoc.data()!.constructionIds as string[])
          : [];
        tx.update(devRef, {
          constructionIds: [...curCons, constructionId],
          totalCapitalSpent: Number(devDoc.data()!.totalCapitalSpent || 0) + laborCost,
          status: 'building',
        });
      }

      if (payFrom === 'bank' && accDoc?.exists) {
        tx.update(accRef, { balance: nextBankBalance, updatedAtMs: nowMs });
      }
      tx.update(charRef, { money: nextWalletMoney, updatedAt: now });

      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'konstruksi',
        amount: laborCost,
        balanceAfter: nextWalletMoney,
        description: `Mulai bangun ${bp.name} di ${String(plot.name)}`,
        nowMs,
      });

      appendLedger(tx, db, {
        from: uid,
        to: 'system:contractor',
        amount: laborCost,
        reason: `construction_started_${blueprintId}`,
        refId: constructionId,
        nowMs,
      });

      return {
        constructionId,
        plotId,
        blueprintId,
        phase: 'pondasi',
        phaseEndsAtMs,
        laborCost,
        money: nextWalletMoney,
        bankBalance: nextBankBalance,
      };
    });

    return { ok: true, ...result };
  }
);

/**
 * 4. advanceConstruction: Cek & majukan fase konstruksi berdasarkan timestamp nyata (anti-cheat server time).
 */
export const advanceConstruction = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const data = (request.data || {}) as { constructionId?: unknown };
    const constructionId = isValidSimpleId(data.constructionId) ? data.constructionId.trim() : '';
    if (!constructionId) {
      throw new HttpsError('invalid-argument', 'ID proyek konstruksi wajib diisi.');
    }

    const nowMs = Date.now();
    const conRef = db.collection('constructions').doc(constructionId);

    const result = await db.runTransaction(async (tx) => {
      const conDoc = await tx.get(conRef);
      if (!conDoc.exists) throw new HttpsError('not-found', 'Proyek konstruksi tidak ditemukan.');

      const c = conDoc.data()!;
      if (c.ownerId !== uid) {
        throw new HttpsError('permission-denied', 'Bukan proyek konstruksi milikmu.');
      }
      if (c.status !== 'active') {
        return {
          constructionId,
          phase: String(c.phase),
          status: String(c.status),
          advanced: false,
          remainingSec: 0,
        };
      }

      const blueprints = constructionConfig.blueprints as Record<
        string,
        { phaseDurationSec: number }
      >;
      const bp = blueprints[String(c.blueprintId)] ?? blueprints.kecil;
      const progress = computeElapsedConstructionPhase({
        currentPhase: String(c.phase || 'pondasi'),
        phaseStartedAtMs: Number(c.phaseStartedAtMs || c.startedAtMs || nowMs),
        phaseEndsAtMs: Number(c.phaseEndsAtMs || nowMs),
        phaseDurationSec: Number(bp.phaseDurationSec || 40),
        nowMs,
      });

      if (progress.advanced) {
        tx.update(conRef, {
          phase: progress.phase,
          phaseStartedAtMs: progress.phaseStartedAtMs,
          phaseEndsAtMs: progress.phaseEndsAtMs,
        });
      }

      const remainingSec =
        progress.phase === 'selesai'
          ? 0
          : Math.max(0, Math.ceil((progress.phaseEndsAtMs - nowMs) / 1000));

      return {
        constructionId,
        phase: progress.phase,
        phaseEndsAtMs: progress.phaseEndsAtMs,
        status: 'active',
        advanced: progress.advanced,
        remainingSec,
      };
    });

    return { ok: true, ...result };
  }
);

/**
 * 5. completeConstruction: Finalisasi konstruksi selesai menjadi dokumen Properti 3D permanen + SHM baru.
 */
export const completeConstruction = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const data = (request.data || {}) as { constructionId?: unknown; propertyName?: unknown };
    const constructionId = isValidSimpleId(data.constructionId) ? data.constructionId.trim() : '';
    const customName =
      typeof data.propertyName === 'string' && data.propertyName.trim().length >= 3
        ? data.propertyName.trim().slice(0, 64)
        : '';

    if (!constructionId) {
      throw new HttpsError('invalid-argument', 'ID proyek konstruksi wajib diisi.');
    }

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const conRef = db.collection('constructions').doc(constructionId);
    const charRef = db.collection('characters').doc(uid);

    const conPre = await conRef.get();
    if (!conPre.exists) throw new HttpsError('not-found', 'Proyek konstruksi tidak ditemukan.');
    const conPreData = conPre.data()!;
    const plotId = String(conPreData.plotId);
    const plotRef = db.collection('land_plots').doc(plotId);
    const devProjectId =
      typeof conPreData.devProjectId === 'string' && isValidSimpleId(conPreData.devProjectId)
        ? conPreData.devProjectId
        : null;
    const devRef = devProjectId ? db.collection('dev_projects').doc(devProjectId) : null;

    const result = await db.runTransaction(async (tx) => {
      const [conDoc, charDoc, plotDoc, devDoc] = await Promise.all([
        tx.get(conRef),
        tx.get(charRef),
        tx.get(plotRef),
        devRef ? tx.get(devRef) : Promise.resolve(null),
      ]);

      if (!conDoc.exists || !charDoc.exists || !plotDoc.exists) {
        throw new HttpsError('not-found', 'Data konstruksi atau kavling tidak ditemukan.');
      }

      const c = conDoc.data()!;
      const charData = charDoc.data()!;
      const plot = plotDoc.data()!;

      if (c.ownerId !== uid) {
        throw new HttpsError('permission-denied', 'Bukan proyek konstruksi milikmu.');
      }
      if (c.status !== 'active') {
        throw new HttpsError('failed-precondition', 'Konstruksi ini sudah selesai atau dibatalkan.');
      }

      const blueprints = constructionConfig.blueprints as Record<
        string,
        {
          id: string;
          name: string;
          propertyType: string;
          rooms: number;
          size: { width: number; depth: number };
          layout: { gridCols: number; gridRows: number; wallColor: string; floorColor: string };
          phaseDurationSec: number;
          estimatedMarketValue: number;
          baseRent: number;
        }
      >;
      const bp = blueprints[String(c.blueprintId)] ?? blueprints.kecil;

      const progress = computeElapsedConstructionPhase({
        currentPhase: String(c.phase || 'pondasi'),
        phaseStartedAtMs: Number(c.phaseStartedAtMs || c.startedAtMs || nowMs),
        phaseEndsAtMs: Number(c.phaseEndsAtMs || nowMs),
        phaseDurationSec: Number(bp.phaseDurationSec || 40),
        nowMs,
      });

      if (progress.phase !== 'selesai') {
        const remSec = Math.max(1, Math.ceil((progress.phaseEndsAtMs - nowMs) / 1000));
        throw new HttpsError(
          'failed-precondition',
          `Pembangunan masih di tahap "${progress.phase}" (tunggu ~${remSec} detik lagi untuk tahap berikutnya).`
        );
      }

      const propId = `prop_built_${plotId}_${nowMs}`;
      const propRef = db.collection('properties').doc(propId);
      const plotPos = plot.position as { x: number; y?: number; z: number };
      const plotPrice = computeLandPlotPrice(plot);
      const baseValue = Math.round((bp.estimatedMarketValue + plotPrice * 0.45) / 1000) * 1000;
      const propertyName = customName || `${bp.name} (${String(plot.name)})`;
      const certificateId = `SHM_BANGUN_${propId}_${nowMs}`;

      tx.set(propRef, {
        id: propId,
        name: propertyName,
        type: bp.propertyType,
        zone: 'cicalengka',
        areaTag: String(plot.areaTag || 'perumahan'),
        stationDistanceTier: computeStationTier(plotPos.x, plotPos.z),
        position: { x: plotPos.x, y: Number(plotPos.y || 0), z: plotPos.z },
        size: bp.size,
        rooms: bp.rooms,
        baseValue,
        baseRent: bp.baseRent,
        condition: 100,
        lastConditionDecayAtMs: nowMs,
        lastTaxAtMs: nowMs,
        ownerId: uid,
        ownerType: 'player',
        ownerName: String(charData.name || 'Warga'),
        certificateId,
        activeListingId: null,
        activeLeaseId: null,
        activeAuctionId: null,
        mortgageInfo: null,
        layout: bp.layout,
        facilities: { electricity: true, water: true, internet: false, ac: false },
        furniture: [],
        renovationLevel: 0,
        builtFromPlotId: plotId,
        viewingSchedule: { open24h: true, startHour: 7, endHour: 21 },
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      });

      tx.set(buildMemberAccessRef(db, propId, uid), {
        uid,
        propertyId: propId,
        role: 'owner',
        grantedAtMs: nowMs,
      });

      tx.update(conRef, {
        phase: 'selesai',
        status: 'completed',
        propertyId: propId,
        completedAtMs: nowMs,
      });

      tx.update(plotRef, {
        propertyId: propId,
        updatedAtMs: nowMs,
      });

      if (devDoc?.exists && devDoc.data()!.developerId === uid && devRef) {
        const curProps = Array.isArray(devDoc.data()!.propertyIds)
          ? (devDoc.data()!.propertyIds as string[])
          : [];
        tx.update(devRef, {
          propertyIds: [...curProps, propId],
          status: 'selling',
        });
      }

      const prevSkills = (charData.skills ?? {}) as Record<string, number>;
      const teknisGain = c.contractorType === 'player' ? 1 : 0;

      tx.update(charRef, {
        currentHomeId: charData.currentHomeId || propId,
        homeless: false,
        reputation: Math.min(100, Number(charData.reputation ?? 50) + 6),
        skills: {
          ...prevSkills,
          teknis: Number(prevSkills.teknis || 0) + teknisGain,
        },
        updatedAt: now,
      });

      appendTransaction(tx, db, uid, {
        type: 'income',
        category: 'bangun_selesai',
        amount: 0,
        balanceAfter: Number(charData.money || 0),
        description: `Sertifikat ${certificateId} terbit untuk ${propertyName}`,
        nowMs,
      });

      return {
        constructionId,
        propertyId: propId,
        propertyName,
        certificateId,
        baseValue,
      };
    });

    return { ok: true, ...result };
  }
);
