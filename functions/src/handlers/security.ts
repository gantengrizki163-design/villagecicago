import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION } from '../helpers/firebase';
import { ensurePhase6Configs, lawConfig } from '../helpers/law';
import { appendLedger, applyTreasuryCredit } from '../helpers/ledger';
import { appendTransaction, economyConfig } from '../helpers/phase2';

type SecurityModuleKey = 'lock' | 'alarm' | 'cctv' | 'guard';

function computeSecurityTotals(modules: Record<string, boolean>) {
  let protectionScore = 0;
  let monthlyCost = 0;
  const defs = lawConfig.securityModules as Record<
    SecurityModuleKey,
    { installCost: number; monthlyCost: number; protection: number }
  >;

  for (const key of ['lock', 'alarm', 'cctv', 'guard'] as SecurityModuleKey[]) {
    if (modules[key]) {
      protectionScore += Number(defs[key]?.protection || 0);
      monthlyCost += Number(defs[key]?.monthlyCost || 0);
    }
  }
  return {
    protectionScore: Math.min(100, protectionScore),
    monthlyCost,
  };
}

/**
 * Lazy billing untuk biaya pemeliharaan keamanan & premi asuransi periodik.
 */
export async function syncLazySecurityAndInsurance(
  firestore: Firestore,
  uid: string,
  nowMs: number
): Promise<{ billsCreated: number }> {
  const cycleMs = economyConfig.billCycleMs;
  let billsCreated = 0;

  const [secSnap, insSnap] = await Promise.all([
    firestore.collection('security_installs').where('ownerId', '==', uid).limit(15).get(),
    firestore.collection('insurance').where('ownerId', '==', uid).where('status', '==', 'active').limit(15).get(),
  ]);

  await firestore.runTransaction(async (tx) => {
    for (const d of secSnap.docs) {
      const s = d.data();
      const monthlyCost = Number(s.monthlyCost || 0);
      const lastBilled = Number(s.lastBilledAtMs || s.updatedAtMs || nowMs);
      if (monthlyCost > 0 && nowMs - lastBilled >= cycleMs) {
        const periodIndex = Math.floor(nowMs / cycleMs);
        const billId = `sec_${d.id}_${periodIndex}`;
        const billRef = firestore.collection('characters').doc(uid).collection('bills').doc(billId);
        const existingBill = await tx.get(billRef);
        if (!existingBill.exists) {
          tx.set(billRef, {
            id: billId,
            uid,
            billType: 'security_fee',
            title: `Biaya Keamanan & Satpam (${d.id})`,
            periodIndex,
            baseAmount: monthlyCost,
            lateFee: 0,
            totalDue: monthlyCost,
            status: 'unpaid',
            propertyId: d.id,
            dueAtMs: nowMs + economyConfig.billGraceMs,
          });
          tx.update(d.ref, { lastBilledAtMs: nowMs });
          billsCreated += 1;
        }
      }
    }

    for (const d of insSnap.docs) {
      const p = d.data();
      const premium = Number(p.premiumPerCycle || 0);
      const lastPrem = Number(p.lastPremiumAtMs || p.createdAtMs || nowMs);
      if (premium > 0 && nowMs - lastPrem >= cycleMs) {
        const periodIndex = Math.floor(nowMs / cycleMs);
        const billId = `ins_${d.id}_${periodIndex}`;
        const billRef = firestore.collection('characters').doc(uid).collection('bills').doc(billId);
        const existingBill = await tx.get(billRef);
        if (!existingBill.exists) {
          tx.set(billRef, {
            id: billId,
            uid,
            billType: 'insurance_premium',
            title: `Premi Asuransi (${p.planId === 'premium' ? 'Plus' : 'Dasar'})`,
            periodIndex,
            baseAmount: premium,
            lateFee: 0,
            totalDue: premium,
            status: 'unpaid',
            propertyId: String(p.subjectId || ''),
            dueAtMs: nowMs + economyConfig.billGraceMs,
          });
          tx.update(d.ref, { lastPremiumAtMs: nowMs });
          billsCreated += 1;
        }
      }
    }
  });

  return { billsCreated };
}

/**
 * 1. installSecurity: Pasang gembok baja, alarm anti-maling, atau CCTV privat pada properti/bisnis.
 */
export const installSecurity = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const body = request.data as { propertyId?: unknown; moduleId?: unknown };
    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId.trim() : '';
    const moduleId = typeof body?.moduleId === 'string' ? body.moduleId.trim() : '';
    const nowMs = Date.now();

    if (!propertyId || !['lock', 'alarm', 'cctv'].includes(moduleId)) {
      throw new HttpsError('invalid-argument', 'ID properti dan modul keamanan (lock/alarm/cctv) valid diperlukan.');
    }

    const modDef = lawConfig.securityModules[moduleId as 'lock' | 'alarm' | 'cctv'];
    const charRef = db.collection('characters').doc(uid);
    const propRef = db.collection('properties').doc(propertyId);
    const secRef = db.collection('security_installs').doc(propertyId);
    const treasuryRef = db.collection('state').doc('treasury');

    return db.runTransaction(async (tx) => {
      const [charSnap, propSnap, secSnap, treasurySnap] = await Promise.all([
        tx.get(charRef),
        tx.get(propRef),
        tx.get(secRef),
        tx.get(treasuryRef),
      ]);

      if (!charSnap.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      if (!propSnap.exists) throw new HttpsError('not-found', 'Properti tidak ditemukan.');

      const prop = propSnap.data()!;
      if (prop.ownerId !== uid) {
        throw new HttpsError('permission-denied', 'Hanya pemilik properti yang dapat memasang perangkat keamanan.');
      }

      const existingModules: Record<string, boolean> = secSnap.exists
        ? { ...(secSnap.data()?.modules || {}) }
        : { lock: false, alarm: false, cctv: false, guard: false };

      if (existingModules[moduleId]) {
        throw new HttpsError('failed-precondition', `${modDef.label} sudah terpasang di properti ini.`);
      }

      const money = Number(charSnap.data()?.money || 0);
      if (money < modDef.installCost) {
        throw new HttpsError('failed-precondition', `Saldo tunai tidak cukup (butuh Rp ${modDef.installCost.toLocaleString('id-ID')}).`);
      }

      const nextModules = { ...existingModules, [moduleId]: true };
      const { protectionScore, monthlyCost } = computeSecurityTotals(nextModules);
      const nextMoney = money - modDef.installCost;

      tx.update(charRef, { money: nextMoney, updatedAt: Timestamp.fromMillis(nowMs) });
      tx.update(propRef, { securityLevel: protectionScore, updatedAtMs: nowMs });
      tx.set(
        secRef,
        {
          propertyId,
          ownerId: uid,
          businessId: String(prop.activeBusinessId || ''),
          modules: nextModules,
          guardName: secSnap.exists ? String(secSnap.data()?.guardName || '') : '',
          monthlyCost,
          protectionScore,
          lastBilledAtMs: secSnap.exists ? Number(secSnap.data()?.lastBilledAtMs || nowMs) : nowMs,
          lastIncidentAtMs: secSnap.exists ? Number(secSnap.data()?.lastIncidentAtMs || 0) : 0,
          updatedAtMs: nowMs,
        },
        { merge: true }
      );

      applyTreasuryCredit(tx, db, treasurySnap, Math.round(modDef.installCost * 0.1), 'business', nowMs);
      appendLedger(tx, db, {
        from: uid,
        to: 'npc_security_vendor',
        amount: modDef.installCost,
        reason: `install_${moduleId}`,
        refId: propertyId,
        nowMs,
      });
      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'keamanan_properti',
        amount: modDef.installCost,
        balanceAfter: nextMoney,
        description: `Pemasangan ${modDef.label} di ${prop.name}`,
        nowMs,
      });

      return { ok: true, propertyId, moduleId, protectionScore, monthlyCost, money: nextMoney };
    });
  }
);

/**
 * 2. hireGuard: Rekrut atau berhentikan satpam hansip NPC untuk menjaga properti/bisnis.
 */
export const hireGuard = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const body = request.data as { propertyId?: unknown; guardName?: unknown; action?: unknown };
    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId.trim() : '';
    const action = body?.action === 'dismiss' ? 'dismiss' : 'hire';
    const rawName = typeof body?.guardName === 'string' ? body.guardName.trim() : '';
    const guardName = rawName.length >= 2 ? rawName.slice(0, 40) : 'Hansip Kang Dadan';
    const nowMs = Date.now();

    if (!propertyId) throw new HttpsError('invalid-argument', 'ID properti diperlukan.');

    const guardDef = lawConfig.securityModules.guard;
    const charRef = db.collection('characters').doc(uid);
    const propRef = db.collection('properties').doc(propertyId);
    const secRef = db.collection('security_installs').doc(propertyId);

    return db.runTransaction(async (tx) => {
      const [charSnap, propSnap, secSnap] = await Promise.all([
        tx.get(charRef),
        tx.get(propRef),
        tx.get(secRef),
      ]);

      if (!charSnap.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      if (!propSnap.exists) throw new HttpsError('not-found', 'Properti tidak ditemukan.');

      const prop = propSnap.data()!;
      if (prop.ownerId !== uid) {
        throw new HttpsError('permission-denied', 'Hanya pemilik yang dapat mengatur satpam properti.');
      }

      const existingModules: Record<string, boolean> = secSnap.exists
        ? { ...(secSnap.data()?.modules || {}) }
        : { lock: false, alarm: false, cctv: false, guard: false };

      let nextMoney = Number(charSnap.data()?.money || 0);

      if (action === 'hire') {
        if (existingModules.guard) {
          throw new HttpsError('failed-precondition', 'Satpam sudah bertugas di properti ini.');
        }
        if (nextMoney < guardDef.installCost) {
          throw new HttpsError('failed-precondition', `Biaya kontrak awal satpam Rp ${guardDef.installCost.toLocaleString('id-ID')} tidak cukup.`);
        }
        nextMoney -= guardDef.installCost;
        existingModules.guard = true;
        tx.update(charRef, { money: nextMoney, updatedAt: Timestamp.fromMillis(nowMs) });
        appendTransaction(tx, db, uid, {
          type: 'expense',
          category: 'keamanan_properti',
          amount: guardDef.installCost,
          balanceAfter: nextMoney,
          description: `Kontrak satpam ${guardName} untuk ${prop.name}`,
          nowMs,
        });
      } else {
        if (!existingModules.guard) {
          throw new HttpsError('failed-precondition', 'Belum ada satpam di properti ini.');
        }
        existingModules.guard = false;
      }

      const { protectionScore, monthlyCost } = computeSecurityTotals(existingModules);
      tx.update(propRef, { securityLevel: protectionScore, updatedAtMs: nowMs });
      tx.set(
        secRef,
        {
          propertyId,
          ownerId: uid,
          businessId: String(prop.activeBusinessId || ''),
          modules: existingModules,
          guardName: action === 'hire' ? guardName : '',
          monthlyCost,
          protectionScore,
          lastBilledAtMs: secSnap.exists ? Number(secSnap.data()?.lastBilledAtMs || nowMs) : nowMs,
          lastIncidentAtMs: secSnap.exists ? Number(secSnap.data()?.lastIncidentAtMs || 0) : 0,
          updatedAtMs: nowMs,
        },
        { merge: true }
      );

      return { ok: true, action, guardName: action === 'hire' ? guardName : '', protectionScore, monthlyCost, money: nextMoney };
    });
  }
);

/**
 * 3. buyInsurance: Beli polis asuransi properti atau bisnis terhadap pencurian & vandalisme.
 */
export const buyInsurance = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const body = request.data as { subjectType?: unknown; subjectId?: unknown; planId?: unknown };
    const subjectType = body?.subjectType === 'business' ? 'business' : 'property';
    const subjectId = typeof body?.subjectId === 'string' ? body.subjectId.trim() : '';
    const planId = body?.planId === 'premium' ? 'premium' : 'basic';
    const nowMs = Date.now();

    if (!subjectId) throw new HttpsError('invalid-argument', 'ID properti atau bisnis diperlukan.');

    const plan = lawConfig.insurancePlans[planId];
    const charRef = db.collection('characters').doc(uid);
    const subjectRef = db.collection(subjectType === 'business' ? 'businesses' : 'properties').doc(subjectId);

    return db.runTransaction(async (tx) => {
      const [charSnap, subjSnap, existingInsSnap] = await Promise.all([
        tx.get(charRef),
        tx.get(subjectRef),
        tx.get(
          db
            .collection('insurance')
            .where('subjectId', '==', subjectId)
            .where('status', '==', 'active')
            .limit(1)
        ),
      ]);

      if (!charSnap.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      if (!subjSnap.exists) throw new HttpsError('not-found', 'Aset yang diasuransikan tidak ditemukan.');

      const subj = subjSnap.data()!;
      if (subj.ownerId !== uid) {
        throw new HttpsError('permission-denied', 'Hanya pemilik aset yang dapat membeli asuransi.');
      }
      if (!existingInsSnap.empty) {
        throw new HttpsError('failed-precondition', 'Aset ini sudah memiliki polis asuransi aktif.');
      }

      const money = Number(charSnap.data()?.money || 0);
      if (money < plan.premiumPerCycle) {
        throw new HttpsError('failed-precondition', `Premi awal Rp ${plan.premiumPerCycle.toLocaleString('id-ID')} tidak cukup.`);
      }

      const nextMoney = money - plan.premiumPerCycle;
      const insId = `ins_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;

      tx.set(db.collection('insurance').doc(insId), {
        id: insId,
        ownerId: uid,
        subjectType,
        subjectId,
        subjectName: String(subj.name || subjectId),
        planId,
        coverageAmount: plan.coverageAmount,
        premiumPerCycle: plan.premiumPerCycle,
        lastPremiumAtMs: nowMs,
        deductibleRate: plan.deductibleRate,
        maxClaimsPerCycle: plan.maxClaimsPerCycle,
        claimsUsed: 0,
        status: 'active',
        createdAtMs: nowMs,
      });

      tx.update(charRef, { money: nextMoney, updatedAt: Timestamp.fromMillis(nowMs) });
      if (subjectType === 'property') {
        tx.update(subjectRef, { hasInsurance: true, updatedAtMs: nowMs });
      }

      appendLedger(tx, db, {
        from: uid,
        to: 'insurance_pool',
        amount: plan.premiumPerCycle,
        reason: `buy_insurance_${planId}`,
        refId: insId,
        nowMs,
      });
      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'asuransi',
        amount: plan.premiumPerCycle,
        balanceAfter: nextMoney,
        description: `Premi awal ${plan.label} (${subj.name})`,
        nowMs,
      });

      return { ok: true, insuranceId: insId, planId, coverageAmount: plan.coverageAmount, money: nextMoney };
    });
  }
);

/**
 * 4. fileClaim: Klaim asuransi kerugian berdasarkan catatan insiden kejahatan yang tervalidasi server.
 */
export const fileClaim = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const body = request.data as { insuranceId?: unknown; crimeRecordId?: unknown };
    const insuranceId = typeof body?.insuranceId === 'string' ? body.insuranceId.trim() : '';
    const crimeRecordId = typeof body?.crimeRecordId === 'string' ? body.crimeRecordId.trim() : '';
    const nowMs = Date.now();

    if (!insuranceId || !crimeRecordId) {
      throw new HttpsError('invalid-argument', 'ID polis asuransi dan ID catatan kejadian diperlukan.');
    }

    const insRef = db.collection('insurance').doc(insuranceId);
    const recRef = db.collection('crime_records').doc(crimeRecordId);
    const charRef = db.collection('characters').doc(uid);

    return db.runTransaction(async (tx) => {
      const [insSnap, recSnap, charSnap] = await Promise.all([
        tx.get(insRef),
        tx.get(recRef),
        tx.get(charRef),
      ]);

      if (!insSnap.exists) throw new HttpsError('not-found', 'Polis asuransi tidak ditemukan.');
      if (!recSnap.exists) throw new HttpsError('not-found', 'Catatan insiden kejahatan tidak ditemukan.');
      if (!charSnap.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');

      const ins = insSnap.data()!;
      const rec = recSnap.data()!;

      if (ins.ownerId !== uid) {
        throw new HttpsError('permission-denied', 'Polis asuransi bukan milik Anda.');
      }
      if (ins.status !== 'active') {
        throw new HttpsError('failed-precondition', 'Polis asuransi tidak aktif.');
      }
      if (rec.insuranceClaimed) {
        throw new HttpsError('failed-precondition', 'Kejadian ini sudah pernah diklaim asuransinya.');
      }
      if (Number(rec.atMs || 0) < Number(ins.createdAtMs || 0)) {
        throw new HttpsError('failed-precondition', 'Kejadian terjadi sebelum polis asuransi diterbitkan.');
      }
      if (String(rec.targetId || '') !== String(ins.subjectId || '')) {
        throw new HttpsError('failed-precondition', 'Catatan kejadian tidak cocok dengan aset pada polis asuransi.');
      }
      const maxClaims = Number(ins.maxClaimsPerCycle || 2);
      if (Number(ins.claimsUsed || 0) >= maxClaims) {
        throw new HttpsError('resource-exhausted', 'Batas klaim asuransi untuk periode ini sudah tercapai.');
      }

      const rawLoss = Math.max(20000, Math.round(Number(rec.fine || 30000) * 1.25));
      const deductible = Math.round(rawLoss * Number(ins.deductibleRate || 0.15));
      const payoutAmount = Math.min(Number(ins.coverageAmount || 350000), Math.max(5000, rawLoss - deductible));
      const nextMoney = Number(charSnap.data()?.money || 0) + payoutAmount;
      const claimId = `clm_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;

      tx.set(db.collection('insurance_claims').doc(claimId), {
        id: claimId,
        insuranceId,
        ownerId: uid,
        subjectId: String(ins.subjectId),
        crimeRecordId,
        lossAmount: rawLoss,
        payoutAmount,
        status: 'approved',
        filedAtMs: nowMs,
      });

      tx.update(recRef, { insuranceClaimed: true, insuranceClaimId: claimId });
      tx.update(insRef, { claimsUsed: Number(ins.claimsUsed || 0) + 1 });
      tx.update(charRef, { money: nextMoney, updatedAt: Timestamp.fromMillis(nowMs) });

      appendLedger(tx, db, {
        from: 'insurance_pool',
        to: uid,
        amount: payoutAmount,
        reason: 'insurance_claim_payout',
        refId: claimId,
        nowMs,
      });
      appendTransaction(tx, db, uid, {
        type: 'income',
        category: 'klaim_asuransi',
        amount: payoutAmount,
        balanceAfter: nextMoney,
        description: `Pencairan klaim asuransi ${ins.subjectName} (${rec.offenseTitle})`,
        nowMs,
      });

      return { ok: true, claimId, payoutAmount, lossAmount: rawLoss, money: nextMoney };
    });
  }
);
