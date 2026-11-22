import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION, rtdb } from '../helpers/firebase';
import {
  getFurnitureCatalogItem,
  isValidSimpleId,
} from '../helpers/housing';
import { computeLazyWantedLevel, ensurePhase6Configs } from '../helpers/law';
import { appendLedger, applyTreasuryCredit } from '../helpers/ledger';
import { assertNearLocation } from '../helpers/location';
import { appendTransaction, furnitureConfig, productsConfig } from '../helpers/phase2';
import {
  constructionConfig,
} from '../helpers/propertyAdvanced';

const NPC_CLIENT_NAMES = [
  'Teh Rina (Pegawai Bank)',
  'Kang Dedi (Insinyur Rancaekek)',
  'Ibu Hj. Siti (Pengusaha Tekstil)',
  'Pak Bambang (Guru SMA)',
  'Neng Salsa (Dokter Muda)',
  'Mang Dadang (Pedagang Grosir)',
];

/**
 * 1. becomeAgent: Ambil lisensi Agen Properti Resmi Priangan.
 */
export const becomeAgent = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const data = (request.data || {}) as { payFrom?: unknown };
    const payFrom = data.payFrom === 'bank' ? 'bank' : 'wallet';

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const charRef = db.collection('characters').doc(uid);
    const accRef = db.collection('accounts').doc(uid);
    const treasuryRef = db.collection('state').doc('treasury');

    const charPre = await charRef.get();
    if (!charPre.exists) throw new HttpsError('not-found', 'Karakter belum ditemukan.');
    const charPreData = charPre.data()!;
    if ((charPreData.currentZone || 'cicalengka') !== 'cicalengka') {
      throw new HttpsError('failed-precondition', 'Pendaftaran agen properti hanya di zona Cicalengka.');
    }

    await assertNearLocation(
      rtdb,
      uid,
      charPreData,
      ['kantor_agen', 'kantor_desa'],
      0,
      [],
      'Datangi Kantor Agen Properti Priangan atau Kantor Desa untuk mengurus lisensi agen.'
    );

    const cfg = constructionConfig.agentSettings;

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, accDoc, treasuryDoc] = await Promise.all([
        tx.get(charRef),
        payFrom === 'bank' ? tx.get(accRef) : Promise.resolve(null),
        tx.get(treasuryRef),
      ]);

      if (!charDoc.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      const charData = charDoc.data()!;
      if (charData.isPropertyAgent) {
        throw new HttpsError('already-exists', 'Kamu sudah terdaftar sebagai Agen Properti Resmi.');
      }

      const skills = (charData.skills ?? {}) as Record<string, number>;
      const kom = Number(skills.komunikasi || 0);
      const hit = Number(skills.hitung || 0);
      const rep = Number(charData.reputation ?? 50);
      const wanted = computeLazyWantedLevel(
        Number(charData.wantedLevel || 0),
        Number(charData.wantedUpdatedAtMs || nowMs),
        nowMs
      );

      if (kom < cfg.minKomunikasi) {
        throw new HttpsError(
          'failed-precondition',
          `Skill Komunikasi minimal ${cfg.minKomunikasi} (saat ini ${kom}).`
        );
      }
      if (hit < cfg.minHitung) {
        throw new HttpsError(
          'failed-precondition',
          `Skill Hitung minimal ${cfg.minHitung} (saat ini ${hit}).`
        );
      }
      if (rep < cfg.minReputation) {
        throw new HttpsError(
          'failed-precondition',
          `Reputasi warga minimal ${cfg.minReputation} (saat ini ${rep}).`
        );
      }
      if (wanted > 0) {
        throw new HttpsError('failed-precondition', 'Bersihkan status DPO terlebih dahulu sebelum menjadi agen.');
      }

      const fee = cfg.licenseFee;
      const walletMoney = Number(charData.money || 0);
      const bankBalance = accDoc?.exists ? Number(accDoc.data()!.balance || 0) : 0;

      if (payFrom === 'bank') {
        if (!accDoc?.exists || bankBalance < fee) {
          throw new HttpsError(
            'failed-precondition',
            `Saldo bank kurang untuk biaya lisensi agen Rp ${fee.toLocaleString('id-ID')}.`
          );
        }
      } else if (walletMoney < fee) {
        throw new HttpsError(
          'failed-precondition',
          `Uang tunai kurang untuk biaya lisensi agen Rp ${fee.toLocaleString('id-ID')}.`
        );
      }

      const nextWalletMoney = payFrom === 'wallet' ? walletMoney - fee : walletMoney;
      const nextBankBalance = payFrom === 'bank' ? bankBalance - fee : bankBalance;

      if (payFrom === 'bank' && accDoc?.exists) {
        tx.update(accRef, { balance: nextBankBalance, updatedAtMs: nowMs });
      }

      tx.update(charRef, {
        money: nextWalletMoney,
        isPropertyAgent: true,
        agentStats: {
          licensedAtMs: nowMs,
          dealsClosed: 0,
          totalCommission: 0,
        },
        reputation: Math.min(100, rep + 3),
        updatedAt: now,
      });

      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'lisensi_agen',
        amount: fee,
        balanceAfter: nextWalletMoney,
        description: 'Lisensi Resmi Agen Properti Priangan',
        nowMs,
      });

      applyTreasuryCredit(tx, db, treasuryDoc, fee, 'property', nowMs);
      appendLedger(tx, db, {
        from: uid,
        to: 'system:treasury',
        amount: fee,
        taxAmount: fee,
        reason: 'property_agent_license',
        refId: `agent_${uid}`,
        nowMs,
      });

      return {
        isPropertyAgent: true,
        fee,
        money: nextWalletMoney,
        bankBalance: nextBankBalance,
      };
    });

    return { ok: true, ...result };
  }
);

/**
 * 2. createClientRequest: Agen properti menerima prospek klien NPC pembeli/penyewa baru.
 */
export const createClientRequest = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const data = (request.data || {}) as {
      desiredArea?: unknown;
      desiredType?: unknown;
      desiredKind?: unknown;
    };

    const allowedAreas = ['stasiun', 'pasar', 'kampung', 'perumahan', 'alun_alun', 'any'];
    const allowedTypes = ['kos', 'kontrakan', 'apartemen', 'ruko', 'rumah', 'any'];

    const desiredArea =
      typeof data.desiredArea === 'string' && allowedAreas.includes(data.desiredArea)
        ? data.desiredArea
        : 'any';
    const desiredType =
      typeof data.desiredType === 'string' && allowedTypes.includes(data.desiredType)
        ? data.desiredType
        : 'any';
    const desiredKind = data.desiredKind === 'rent' ? 'rent' : 'sale';

    const charRef = db.collection('characters').doc(uid);
    const [charSnap, openClientsSnap] = await Promise.all([
      charRef.get(),
      db
        .collection('agent_clients')
        .where('agentId', '==', uid)
        .where('status', '==', 'open')
        .limit(6)
        .get(),
    ]);

    if (!charSnap.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
    if (!charSnap.data()!.isPropertyAgent) {
      throw new HttpsError('failed-precondition', 'Kamu belum memiliki lisensi Agen Properti.');
    }
    if (openClientsSnap.size >= 5) {
      throw new HttpsError('failed-precondition', 'Maksimal 5 klien aktif ditangani sekaligus. Tutup transaksi dulu.');
    }

    const nowMs = Date.now();
    const clientId = `cli_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
    const npcName = NPC_CLIENT_NAMES[Math.floor(Math.random() * NPC_CLIENT_NAMES.length)];

    const saleBudgets: Record<string, number> = {
      kos: 650_000,
      kontrakan: 1_250_000,
      apartemen: 2_100_000,
      ruko: 2_900_000,
      rumah: 4_200_000,
      any: 3_600_000,
    };
    const rentBudgets: Record<string, number> = {
      kos: 55_000,
      kontrakan: 105_000,
      apartemen: 165_000,
      ruko: 210_000,
      rumah: 290_000,
      any: 240_000,
    };
    const baseBudget =
      desiredKind === 'rent'
        ? rentBudgets[desiredType] ?? 180_000
        : saleBudgets[desiredType] ?? 2_600_000;
    const jitter = 0.9 + Math.random() * 0.25;
    const maxBudget = Math.round((baseBudget * jitter) / 5000) * 5000;

    const clientDoc = {
      id: clientId,
      agentId: uid,
      clientName: npcName,
      isNpc: true,
      desiredArea,
      desiredType,
      desiredKind,
      maxBudget,
      commissionRate: constructionConfig.agentSettings.baseCommissionRate,
      status: 'open',
      createdAtMs: nowMs,
    };

    await db.collection('agent_clients').doc(clientId).set(clientDoc);

    return { ok: true, client: clientDoc };
  }
);

/**
 * 3. closeDeal: Agen memadankan klien aktif dengan listing properti aktif untuk memperoleh komisi 4%.
 */
export const closeDeal = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const data = (request.data || {}) as { clientId?: unknown; listingId?: unknown };
    const clientId = isValidSimpleId(data.clientId) ? data.clientId.trim() : '';
    const listingId = isValidSimpleId(data.listingId) ? data.listingId.trim() : '';

    if (!clientId || !listingId) {
      throw new HttpsError('invalid-argument', 'ID klien dan ID listing wajib dipilih.');
    }

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const charRef = db.collection('characters').doc(uid);
    const clientRef = db.collection('agent_clients').doc(clientId);
    const listingRef = db.collection('property_listings').doc(listingId);
    const treasuryRef = db.collection('state').doc('treasury');

    const listingPre = await listingRef.get();
    if (!listingPre.exists) throw new HttpsError('not-found', 'Listing properti tidak ditemukan.');
    const listingPreData = listingPre.data()!;
    const propId = String(listingPreData.propertyId);
    const propRef = db.collection('properties').doc(propId);
    const sellerUid =
      listingPreData.ownerType === 'player' ? String(listingPreData.ownerId) : null;
    const sellerRef = sellerUid ? db.collection('characters').doc(sellerUid) : null;

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, clientDoc, listingDoc, propDoc, treasuryDoc, sellerDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(clientRef),
        tx.get(listingRef),
        tx.get(propRef),
        tx.get(treasuryRef),
        sellerRef ? tx.get(sellerRef) : Promise.resolve(null),
      ]);

      if (!charDoc.exists || !clientDoc.exists || !listingDoc.exists) {
        throw new HttpsError('not-found', 'Data agen, klien, atau listing tidak ditemukan.');
      }

      const charData = charDoc.data()!;
      const client = clientDoc.data()!;
      const listing = listingDoc.data()!;

      if (!charData.isPropertyAgent) {
        throw new HttpsError('failed-precondition', 'Hanya Agen Properti berlisensi yang bisa menutup transaksi.');
      }
      if (client.agentId !== uid) {
        throw new HttpsError('permission-denied', 'Klien ini bukan prospek milikmu.');
      }
      if (client.status !== 'open') {
        throw new HttpsError('failed-precondition', 'Permintaan klien ini sudah selesai.');
      }
      if (listing.status !== 'active') {
        throw new HttpsError('failed-precondition', 'Listing properti ini sudah tidak aktif.');
      }
      if (listing.ownerId === uid) {
        throw new HttpsError('failed-precondition', 'Tidak dapat mengambil komisi agen dari listing milik sendiri.');
      }
      if (client.desiredKind && listing.kind !== client.desiredKind) {
        throw new HttpsError(
          'failed-precondition',
          `Klien mencari transaksi "${String(client.desiredKind)}", sedangkan listing berjenis "${String(listing.kind)}".`
        );
      }
      if (client.desiredArea !== 'any' && listing.areaTag !== client.desiredArea) {
        throw new HttpsError(
          'failed-precondition',
          `Klien menginginkan area ${String(client.desiredArea)}, bukan ${String(listing.areaTag)}.`
        );
      }
      if (client.desiredType !== 'any' && listing.propertyType !== client.desiredType) {
        throw new HttpsError(
          'failed-precondition',
          `Klien menginginkan tipe ${String(client.desiredType)}, bukan ${String(listing.propertyType)}.`
        );
      }

      const price = Number(listing.price || 0);
      if (price > Number(client.maxBudget || 0)) {
        throw new HttpsError(
          'failed-precondition',
          `Harga listing (Rp ${price.toLocaleString('id-ID')}) melebihi anggaran klien (Rp ${Number(client.maxBudget).toLocaleString('id-ID')}).`
        );
      }

      const rate = Number(
        client.commissionRate || constructionConfig.agentSettings.baseCommissionRate
      );
      const commission = Math.max(
        2500,
        Math.round(price * (listing.kind === 'rent' ? Math.max(0.15, rate * 3) : rate))
      );

      // Jika transaksi jual properti pemain ke klien NPC, transfer dana hasil jual ke penjual & pindahkan aset
      if (listing.kind === 'sale' && sellerDoc?.exists && sellerRef) {
        const transferTax = Math.round(price * 0.025);
        const netSeller = Math.max(0, price - commission);
        const sellerNextMoney = Number(sellerDoc.data()!.money || 0) + netSeller;
        tx.update(sellerRef, { money: sellerNextMoney, updatedAt: now });
        appendTransaction(tx, db, sellerUid!, {
          type: 'income',
          category: 'jual_via_agen',
          amount: netSeller,
          balanceAfter: sellerNextMoney,
          description: `Penjualan ${String(listing.propertyName)} melalui agen ${String(charData.name)}`,
          nowMs,
        });
        applyTreasuryCredit(tx, db, treasuryDoc, transferTax, 'property', nowMs);
        if (propDoc.exists) {
          tx.update(propRef, {
            ownerId: `npc_buyer_${clientId}`,
            ownerType: 'npc',
            ownerName: String(client.clientName),
            activeListingId: null,
            mortgageInfo: null,
            updatedAtMs: nowMs,
          });
        }
        tx.update(listingRef, { status: 'closed' });
      } else if (listing.kind === 'sale' && listing.ownerType !== 'player') {
        tx.update(listingRef, { status: 'closed' });
        if (propDoc.exists) {
          tx.update(propRef, { activeListingId: null, updatedAtMs: nowMs });
        }
      } else {
        tx.update(listingRef, { status: 'closed' });
        if (propDoc.exists) {
          tx.update(propRef, { activeListingId: null, updatedAtMs: nowMs });
        }
      }

      const nextMoney = Number(charData.money || 0) + commission;
      const prevSkills = (charData.skills ?? {}) as Record<string, number>;
      const prevAgentStats = (charData.agentStats ?? {}) as {
        licensedAtMs?: number;
        dealsClosed?: number;
        totalCommission?: number;
      };

      tx.update(clientRef, {
        status: 'closed',
        matchedListingId: listingId,
        matchedPropertyName: String(listing.propertyName),
        commissionEarned: commission,
        closedAtMs: nowMs,
      });

      tx.update(charRef, {
        money: nextMoney,
        reputation: Math.min(100, Number(charData.reputation ?? 50) + 2),
        skills: {
          ...prevSkills,
          komunikasi: Number(prevSkills.komunikasi || 0) + 1,
        },
        agentStats: {
          licensedAtMs: Number(prevAgentStats.licensedAtMs || nowMs),
          dealsClosed: Number(prevAgentStats.dealsClosed || 0) + 1,
          totalCommission: Number(prevAgentStats.totalCommission || 0) + commission,
        },
        updatedAt: now,
      });

      appendTransaction(tx, db, uid, {
        type: 'income',
        category: 'komisi_agen',
        amount: commission,
        balanceAfter: nextMoney,
        description: `Komisi closing ${String(listing.propertyName)} (${String(client.clientName)})`,
        nowMs,
      });

      appendLedger(tx, db, {
        from: 'system:client_buyer',
        to: uid,
        amount: commission,
        reason: 'agent_deal_commission',
        refId: clientId,
        nowMs,
      });

      return {
        clientId,
        listingId,
        propertyName: String(listing.propertyName),
        commission,
        money: nextMoney,
      };
    });

    return { ok: true, ...result };
  }
);

/**
 * 4. createDevelopmentProject: Mulai proyek pengembang properti multi-unit (Developer).
 */
export const createDevelopmentProject = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const data = (request.data || {}) as { name?: unknown; plotIds?: unknown };
    const name = typeof data.name === 'string' ? data.name.trim().slice(0, 80) : '';
    if (name.length < 3) {
      throw new HttpsError('invalid-argument', 'Nama proyek developer minimal 3 karakter.');
    }

    const rawPlotIds = Array.isArray(data.plotIds) ? data.plotIds.filter(isValidSimpleId).slice(0, 6) : [];
    const nowMs = Date.now();
    const charRef = db.collection('characters').doc(uid);
    const accRef = db.collection('accounts').doc(uid);

    const [charSnap, accSnap, ...plotSnaps] = await Promise.all([
      charRef.get(),
      accRef.get(),
      ...rawPlotIds.map((id) => db.collection('land_plots').doc(id).get()),
    ]);

    if (!charSnap.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
    const charData = charSnap.data()!;
    const totalLiquid =
      Number(charData.money || 0) + (accSnap.exists ? Number(accSnap.data()!.balance || 0) : 0);
    const minCap = constructionConfig.agentSettings.developerMinCapital;

    if (!charData.isPropertyAgent && totalLiquid < minCap) {
      throw new HttpsError(
        'failed-precondition',
        `Modal likuid minimal Rp ${minCap.toLocaleString('id-ID')} atau berstatus Agen Properti untuk membuka proyek developer.`
      );
    }

    const validPlotIds: string[] = [];
    for (const pSnap of plotSnaps) {
      if (pSnap.exists && pSnap.data()!.ownerId === uid) {
        validPlotIds.push(pSnap.id);
      }
    }

    const projectId = `dev_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
    const projectDoc = {
      id: projectId,
      developerId: uid,
      developerName: String(charData.name || 'Developer'),
      name,
      plotIds: validPlotIds,
      constructionIds: [],
      propertyIds: [],
      totalCapitalSpent: 0,
      totalRevenue: 0,
      status: 'planning',
      createdAtMs: nowMs,
    };

    await db.collection('dev_projects').doc(projectId).set(projectDoc);

    return { ok: true, project: projectDoc };
  }
);

/**
 * 5. startRenovation: Mulai renovasi besar pada properti milik sendiri (tambah kamar/lantai/taman/pagar/garasi).
 */
export const startRenovation = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const data = (request.data || {}) as {
      propertyId?: unknown;
      renovationType?: unknown;
      payFrom?: unknown;
    };

    const propertyId = isValidSimpleId(data.propertyId) ? data.propertyId.trim() : '';
    const renovationType =
      typeof data.renovationType === 'string' ? data.renovationType.trim() : '';
    const payFrom = data.payFrom === 'bank' ? 'bank' : 'wallet';

    const renovationsCatalog = constructionConfig.renovations as Record<
      string,
      {
        id: string;
        label: string;
        cost: number;
        durationSec: number;
        materials: Record<string, number>;
        valueBoost: number;
      }
    >;
    const def = renovationsCatalog[renovationType];
    if (!propertyId || !def) {
      throw new HttpsError('invalid-argument', 'ID properti atau jenis renovasi tidak valid.');
    }

    const materialIds = Object.keys(def.materials || {});
    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const charRef = db.collection('characters').doc(uid);
    const accRef = db.collection('accounts').doc(uid);
    const propRef = db.collection('properties').doc(propertyId);
    const renovationId = `ren_${propertyId}_${nowMs}`;
    const renRef = db.collection('renovations').doc(renovationId);

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, accDoc, propDoc, ...matDocs] = await Promise.all([
        tx.get(charRef),
        payFrom === 'bank' ? tx.get(accRef) : Promise.resolve(null),
        tx.get(propRef),
        ...materialIds.map((mId) => tx.get(charRef.collection('inventory').doc(mId))),
      ]);

      if (!charDoc.exists || !propDoc.exists) {
        throw new HttpsError('not-found', 'Karakter atau properti tidak ditemukan.');
      }

      const charData = charDoc.data()!;
      const prop = propDoc.data()!;
      if (prop.ownerId !== uid) {
        throw new HttpsError('permission-denied', 'Hanya pemilik sah yang dapat merenovasi properti ini.');
      }
      if (prop.activeRenovationId) {
        throw new HttpsError('failed-precondition', 'Properti masih dalam proses renovasi aktif.');
      }
      if (prop.activeAuctionId) {
        throw new HttpsError('failed-precondition', 'Properti sedang dilelang.');
      }

      // Cek material inventaris
      const missing: string[] = [];
      for (let i = 0; i < materialIds.length; i++) {
        const mId = materialIds[i];
        const need = Number(def.materials[mId] || 0);
        const have = matDocs[i].exists ? Number(matDocs[i].data()!.quantity || 0) : 0;
        if (have < need) {
          const meta = productsConfig.products.find((p) => p.id === mId);
          missing.push(`${meta?.name || mId} (${have}/${need})`);
        }
      }
      if (missing.length > 0) {
        throw new HttpsError(
          'failed-precondition',
          `Material kurang: ${missing.join(', ')}. Beli di TB Sumber Karya / Pasar.`
        );
      }

      const walletMoney = Number(charData.money || 0);
      const bankBalance = accDoc?.exists ? Number(accDoc.data()!.balance || 0) : 0;
      if (payFrom === 'bank') {
        if (!accDoc?.exists || bankBalance < def.cost) {
          throw new HttpsError(
            'failed-precondition',
            `Saldo rekening kurang untuk biaya renovasi Rp ${def.cost.toLocaleString('id-ID')}.`
          );
        }
      } else if (walletMoney < def.cost) {
        throw new HttpsError(
          'failed-precondition',
          `Uang tunai kurang untuk biaya renovasi Rp ${def.cost.toLocaleString('id-ID')}.`
        );
      }

      for (let i = 0; i < materialIds.length; i++) {
        const mId = materialIds[i];
        const need = Number(def.materials[mId] || 0);
        const have = Number(matDocs[i].data()!.quantity || 0);
        const remain = have - need;
        if (remain <= 0) tx.delete(matDocs[i].ref);
        else tx.update(matDocs[i].ref, { quantity: remain, updatedAtMs: nowMs });
      }

      const nextWalletMoney = payFrom === 'wallet' ? walletMoney - def.cost : walletMoney;
      const nextBankBalance = payFrom === 'bank' ? bankBalance - def.cost : bankBalance;
      const completesAtMs = nowMs + def.durationSec * 1000;

      tx.set(renRef, {
        id: renovationId,
        ownerId: uid,
        propertyId,
        renovationType,
        label: def.label,
        cost: def.cost,
        startedAtMs: nowMs,
        completesAtMs,
        valueBoost: def.valueBoost,
        status: 'active',
      });

      tx.update(propRef, {
        activeRenovationId: renovationId,
        updatedAtMs: nowMs,
      });

      if (payFrom === 'bank' && accDoc?.exists) {
        tx.update(accRef, { balance: nextBankBalance, updatedAtMs: nowMs });
      }
      tx.update(charRef, { money: nextWalletMoney, updatedAt: now });

      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'renovasi_besar',
        amount: def.cost,
        balanceAfter: nextWalletMoney,
        description: `${def.label} pada ${String(prop.name)}`,
        nowMs,
      });

      appendLedger(tx, db, {
        from: uid,
        to: 'system:contractor',
        amount: def.cost,
        reason: `renovation_${renovationType}`,
        refId: renovationId,
        nowMs,
      });

      return {
        renovationId,
        propertyId,
        renovationType,
        completesAtMs,
        cost: def.cost,
        valueBoost: def.valueBoost,
        money: nextWalletMoney,
        bankBalance: nextBankBalance,
      };
    });

    return { ok: true, ...result };
  }
);

/**
 * 6. completeRenovation: Finalisasi renovasi besar setelah waktu selesai -> naikkan nilai properti, kamar, & fitur.
 */
export const completeRenovation = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const data = (request.data || {}) as { renovationId?: unknown };
    const renovationId = isValidSimpleId(data.renovationId) ? data.renovationId.trim() : '';
    if (!renovationId) {
      throw new HttpsError('invalid-argument', 'ID renovasi wajib diisi.');
    }

    const nowMs = Date.now();
    const renRef = db.collection('renovations').doc(renovationId);
    const renPre = await renRef.get();
    if (!renPre.exists) throw new HttpsError('not-found', 'Proyek renovasi tidak ditemukan.');
    const propId = String(renPre.data()!.propertyId);
    const propRef = db.collection('properties').doc(propId);

    const renovationsCatalog = constructionConfig.renovations as Record<
      string,
      {
        label: string;
        valueBoost: number;
        roomsDelta?: number;
        gridDelta?: number;
        moodBonus?: number;
        securityBonus?: number;
      }
    >;

    const result = await db.runTransaction(async (tx) => {
      const [renDoc, propDoc] = await Promise.all([tx.get(renRef), tx.get(propRef)]);
      if (!renDoc.exists || !propDoc.exists) {
        throw new HttpsError('not-found', 'Data renovasi atau properti tidak ditemukan.');
      }

      const ren = renDoc.data()!;
      const prop = propDoc.data()!;
      if (ren.ownerId !== uid) {
        throw new HttpsError('permission-denied', 'Bukan proyek renovasi milikmu.');
      }
      if (ren.status !== 'active') {
        throw new HttpsError('failed-precondition', 'Renovasi sudah diselesaikan.');
      }
      if (nowMs < Number(ren.completesAtMs || 0)) {
        const remSec = Math.ceil((Number(ren.completesAtMs || 0) - nowMs) / 1000);
        throw new HttpsError('failed-precondition', `Renovasi masih berjalan (${remSec} detik lagi).`);
      }

      const def = renovationsCatalog[String(ren.renovationType)] ?? {
        label: 'Renovasi',
        valueBoost: Number(ren.valueBoost || 100_000),
      };

      const curCols = Number(prop.layout?.gridCols ?? prop.size?.width ?? 6);
      const curRows = Number(prop.layout?.gridRows ?? prop.size?.depth ?? 6);
      const gridDelta = Number(def.gridDelta || 0);
      const nextCols = Math.min(12, curCols + gridDelta);
      const nextRows = Math.min(12, curRows + gridDelta);

      const nextBaseValue = Number(prop.baseValue || 500_000) + Number(def.valueBoost || 0);
      const nextRooms = Number(prop.rooms || 1) + Number(def.roomsDelta || 0);
      const nextRenLevel = Number(prop.renovationLevel || 0) + 1;
      const nextCondition = Math.min(100, Math.round(Number(prop.condition ?? 80) + 12));
      const appliedList = Array.isArray(prop.renovationsApplied)
        ? (prop.renovationsApplied as string[])
        : [];
      if (!appliedList.includes(String(ren.renovationType))) {
        appliedList.push(String(ren.renovationType));
      }

      tx.update(renRef, {
        status: 'completed',
        completedAtMs: nowMs,
      });

      tx.update(propRef, {
        activeRenovationId: null,
        baseValue: nextBaseValue,
        baseRent: Math.round(Number(prop.baseRent || 50_000) * 1.08),
        rooms: nextRooms,
        condition: nextCondition,
        lastConditionDecayAtMs: nowMs,
        renovationLevel: nextRenLevel,
        renovationsApplied: appliedList,
        layout: {
          ...(prop.layout || {}),
          gridCols: nextCols,
          gridRows: nextRows,
        },
        moodBonus: Number(prop.moodBonus || 0) + Number(def.moodBonus || 0),
        securityBonus: Number(prop.securityBonus || 0) + Number(def.securityBonus || 0),
        updatedAtMs: nowMs,
      });

      return {
        renovationId,
        propertyId: propId,
        nextBaseValue,
        nextRooms,
        nextRenLevel,
        nextCols,
        nextRows,
      };
    });

    return { ok: true, ...result };
  }
);

/**
 * 7. buyFurnitureSet: Beli paket furnitur tematik diskon di Toko Mebel Cicalengka.
 */
export const buyFurnitureSet = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const data = (request.data || {}) as { setId?: unknown; payFrom?: unknown };
    const setId = isValidSimpleId(data.setId) ? data.setId.trim() : '';
    const payFrom = data.payFrom === 'bank' ? 'bank' : 'wallet';

    const setDef = constructionConfig.furnitureSets.find((s) => s.id === setId);
    if (!setDef) {
      throw new HttpsError('invalid-argument', 'Paket furnitur tidak ditemukan.');
    }

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const charRef = db.collection('characters').doc(uid);
    const accRef = db.collection('accounts').doc(uid);

    const charPre = await charRef.get();
    if (!charPre.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
    const charPreData = charPre.data()!;
    if ((charPreData.currentZone || 'cicalengka') !== 'cicalengka') {
      throw new HttpsError('failed-precondition', 'Toko Mebel hanya ada di Cicalengka.');
    }

    await assertNearLocation(
      rtdb,
      uid,
      charPreData,
      ['toko_mebel'],
      0,
      [],
      `Mendekatlah ke ${furnitureConfig.shopLocation.label} untuk membeli ${setDef.name}.`
    );

    const itemIds = setDef.itemIds;

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, accDoc, ...invDocs] = await Promise.all([
        tx.get(charRef),
        payFrom === 'bank' ? tx.get(accRef) : Promise.resolve(null),
        ...itemIds.map((fId) => tx.get(charRef.collection('inventory').doc(fId))),
      ]);

      if (!charDoc.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      const charData = charDoc.data()!;
      const price = setDef.bundlePrice;
      const walletMoney = Number(charData.money || 0);
      const bankBalance = accDoc?.exists ? Number(accDoc.data()!.balance || 0) : 0;

      if (payFrom === 'bank') {
        if (!accDoc?.exists || bankBalance < price) {
          throw new HttpsError(
            'failed-precondition',
            `Saldo rekening kurang! Butuh Rp ${price.toLocaleString('id-ID')}.`
          );
        }
      } else if (walletMoney < price) {
        throw new HttpsError(
          'failed-precondition',
          `Uang tunai kurang! Butuh Rp ${price.toLocaleString('id-ID')}.`
        );
      }

      const nextWalletMoney = payFrom === 'wallet' ? walletMoney - price : walletMoney;
      const nextBankBalance = payFrom === 'bank' ? bankBalance - price : bankBalance;

      for (let i = 0; i < itemIds.length; i++) {
        const fId = itemIds[i];
        const meta = getFurnitureCatalogItem(fId);
        const prevQty = invDocs[i].exists ? Number(invDocs[i].data()!.quantity || 0) : 0;
        tx.set(invDocs[i].ref, {
          uid,
          itemId: fId,
          category: 'furniture',
          name: meta?.name ?? fId,
          quantity: prevQty + 1,
          updatedAtMs: nowMs,
        });
      }

      if (payFrom === 'bank' && accDoc?.exists) {
        tx.update(accRef, { balance: nextBankBalance, updatedAtMs: nowMs });
      }
      tx.update(charRef, { money: nextWalletMoney, updatedAt: now });

      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'mebel_paket',
        amount: price,
        balanceAfter: nextWalletMoney,
        description: `Beli ${setDef.name} (${itemIds.length} item)`,
        nowMs,
      });

      appendLedger(tx, db, {
        from: uid,
        to: 'system:furniture_shop',
        amount: price,
        reason: `furniture_set_${setId}`,
        refId: setId,
        nowMs,
      });

      return {
        setId,
        setName: setDef.name,
        itemIds,
        price,
        money: nextWalletMoney,
        bankBalance: nextBankBalance,
      };
    });

    return { ok: true, ...result };
  }
);
