import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION, rtdb } from '../helpers/firebase';
import { getPlayerWorldPos } from '../helpers/housing';
import {
  applyReputationAndCredit,
  computeCatchChance,
  computeLazyWantedLevel,
  ensurePhase6Configs,
  lawConfig,
  syncLazySentenceAndWanted,
  writeCrimeSceneRtdb,
  writeLawAlertRtdb,
} from '../helpers/law';
import { appendLedger, applyTreasuryCredit } from '../helpers/ledger';
import { countDeterministicNpcWitnesses } from '../helpers/npcSchedule';
import { appendTransaction } from '../helpers/phase2';
import { distance2D } from '../helpers/validation';

function isPoliceChar(charData: FirebaseFirestore.DocumentData | undefined): boolean {
  return Boolean(charData?.currentJob && charData.currentJob.jobId === 'polisi');
}

function countNearbyDeterministicNpcWitnesses(posX: number, posZ: number, nowMs: number): string[] {
  return countDeterministicNpcWitnesses(posX, posZ, nowMs, lawConfig.witnessRadiusMeters).witnessNames;
}

/**
 * 1. attemptCrime: Validasi jarak, cooldown, keamanan target, saksi, CCTV, & hasil deterministik di server.
 */
export const attemptCrime = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const body = request.data as {
      offenseId?: unknown;
      targetType?: unknown;
      targetId?: unknown;
      x?: unknown;
      z?: unknown;
    };

    const offenseId = typeof body?.offenseId === 'string' ? body.offenseId.trim() : '';
    const offense = lawConfig.offenses.find((o) => o.id === offenseId);
    if (!offense) throw new HttpsError('invalid-argument', 'Jenis pelanggaran tidak dikenal.');

    const targetType =
      typeof body?.targetType === 'string' && offense.targetTypes.includes(body.targetType)
        ? body.targetType
        : offense.targetTypes[0];
    const targetId = typeof body?.targetId === 'string' ? body.targetId.trim().slice(0, 128) : 'public';
    const nowMs = Date.now();

    const charRef = db.collection('characters').doc(uid);
    const accRef = db.collection('accounts').doc(uid);

    const charPre = await charRef.get();
    if (!charPre.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
    const verifiedPos = await getPlayerWorldPos(rtdb, uid, charPre.data()!);

    // Hitung saksi dari pemain online di RTDB secara ringan berdasarkan posisi terverifikasi server
    const nearbyPlayerWitnesses: string[] = [];
    try {
      const playersSnap = await rtdb.ref('players').limitToLast(40).get();
      if (playersSnap.exists()) {
        const all = playersSnap.val() as Record<string, { x?: number; z?: number; name?: string }>;
        for (const [pUid, pVal] of Object.entries(all)) {
          if (pUid === uid) continue;
          if (distance2D(verifiedPos.x, verifiedPos.z, Number(pVal.x || 0), Number(pVal.z || 0)) <= lawConfig.witnessRadiusMeters) {
            nearbyPlayerWitnesses.push(pVal.name || pUid);
          }
        }
      }
    } catch {
      // Non-fatal
    }

    const result = await db.runTransaction(async (tx) => {
      const [charSnap, accSnap] = await Promise.all([
        tx.get(charRef),
        tx.get(accRef),
      ]);
      if (!charSnap.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      const charData = charSnap.data()!;

      if (charData.sentence?.active) {
        throw new HttpsError('failed-precondition', 'Sedang menjalani masa tahanan.');
      }
      if (charData.activeTrip) {
        throw new HttpsError('failed-precondition', 'Tidak bisa melakukan aksi saat di kereta.');
      }
      if (isPoliceChar(charData)) {
        throw new HttpsError('failed-precondition', 'Petugas polisi aktif tidak boleh melakukan tindak kriminal.');
      }

      const lastCrimeMs = Number(charData.lastCrimeAtMs || 0);
      const cooldownMs = lawConfig.crimeCooldownSec * 1000;
      if (nowMs - lastCrimeMs < cooldownMs) {
        const waitSec = Math.ceil((cooldownMs - (nowMs - lastCrimeMs)) / 1000);
        throw new HttpsError('resource-exhausted', `Tunggu ${waitSec} detik sebelum aksi berikutnya.`);
      }

      const posX = verifiedPos.x;
      const posZ = verifiedPos.z;

      // Baca keamanan target jika menyasar properti atau bisnis
      let protectionScore = 0;
      let targetOwnerId = '';
      let targetPropertyId = '';
      let targetPos = { x: posX, z: posZ };

      if (targetType === 'property' && targetId && targetId !== 'public') {
        const propSnap = await tx.get(db.collection('properties').doc(targetId));
        if (!propSnap.exists) throw new HttpsError('not-found', 'Properti target tidak ditemukan.');
        const pData = propSnap.data()!;
        targetOwnerId = String(pData.ownerId || '');
        targetPropertyId = propSnap.id;
        targetPos = { x: Number(pData.position?.x || 0), z: Number(pData.position?.z || 0) };
        if (targetOwnerId === uid) {
          throw new HttpsError('failed-precondition', 'Tidak bisa menargetkan properti milik sendiri.');
        }
        if (distance2D(posX, posZ, targetPos.x, targetPos.z) > 16) {
          throw new HttpsError('failed-precondition', 'Terlalu jauh dari properti target.');
        }
        const secSnap = await tx.get(db.collection('security_installs').doc(targetPropertyId));
        if (secSnap.exists) {
          protectionScore = Number(secSnap.data()?.protectionScore || 0);
          tx.update(secSnap.ref, { lastIncidentAtMs: nowMs });
        }
      } else if (targetType === 'business' && targetId && targetId !== 'public') {
        const bizSnap = await tx.get(db.collection('businesses').doc(targetId));
        if (!bizSnap.exists) throw new HttpsError('not-found', 'Bisnis target tidak ditemukan.');
        const bData = bizSnap.data()!;
        targetOwnerId = String(bData.ownerId || '');
        targetPropertyId = String(bData.propertyId || '');
        targetPos = { x: Number(bData.position?.x || 0), z: Number(bData.position?.z || 0) };
        if (targetOwnerId === uid) {
          throw new HttpsError('failed-precondition', 'Tidak bisa mencuri dari bisnis sendiri.');
        }
        if (distance2D(posX, posZ, targetPos.x, targetPos.z) > 16) {
          throw new HttpsError('failed-precondition', 'Terlalu jauh dari lokasi bisnis target.');
        }
        if (targetPropertyId) {
          const secSnap = await tx.get(db.collection('security_installs').doc(targetPropertyId));
          if (secSnap.exists) {
            protectionScore = Number(secSnap.data()?.protectionScore || 0);
            tx.update(secSnap.ref, { lastIncidentAtMs: nowMs });
          }
        }
      }

      const npcWitnesses = countNearbyDeterministicNpcWitnesses(posX, posZ, nowMs);
      const witnesses = [...npcWitnesses, ...nearbyPlayerWitnesses].slice(0, 6);

      const { catchChance, cctvTriggered, isNight, cctvLabel } = computeCatchChance({
        baseCatchChance: offense.baseCatchChance,
        witnessCount: witnesses.length,
        posX,
        posZ,
        propertyProtectionScore: protectionScore,
        nowMs,
        skills: charData.skills,
        reputation: charData.reputation,
      });

      const caught = Math.random() < catchChance;
      const baseWanted = computeLazyWantedLevel(
        Number(charData.wantedLevel || 0),
        Number(charData.wantedUpdatedAtMs || nowMs),
        nowMs
      );
      const recordId = `crm_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;

      let reward = 0;
      let nextMoney = Number(charData.money || 0);
      let nextWanted = baseWanted;
      let status: 'wanted' | 'reported' = 'reported';

      if (caught) {
        status = 'wanted';
        nextWanted = Math.min(lawConfig.wantedMax, Math.round(baseWanted + offense.wantedDelta));
        const { reputation, creditScore } = applyReputationAndCredit(
          tx,
          db,
          uid,
          charData,
          accSnap,
          offense.reputationDelta,
          offense.creditScoreDelta,
          nowMs
        );

        // Jika bisnis memiliki kas kecil & sempat rusak/alarm, tidak ada rampasan uang
        tx.set(db.collection('crime_records').doc(recordId), {
          id: recordId,
          characterId: uid,
          characterName: String(charData.name || 'Warga'),
          offenseId: offense.id,
          offenseTitle: offense.title,
          severity: offense.severity,
          atMs: nowMs,
          location: { zone: charData.currentZone || 'cicalengka', x: posX, z: posZ },
          targetType,
          targetId,
          witnesses,
          status,
          fine: offense.fine,
          sentenceSec: offense.sentenceSec,
          evidenceScore: Math.round(catchChance * 100),
          cctvLabel: cctvLabel || null,
        });

        tx.update(charRef, {
          wantedLevel: nextWanted,
          wantedUpdatedAtMs: nowMs,
          lastCrimeAtMs: nowMs,
          criminalRecordCount: Number(charData.criminalRecordCount || 0) + 1,
          reputation,
          creditScore,
          updatedAt: Timestamp.fromMillis(nowMs),
        });
      } else {
        // Berhasil namun tetap meninggalkan jejak jika ada saksi/CCTV
        const minR = Number(offense.rewardMin || 0);
        const maxR = Number(offense.rewardMax || 0);
        reward = maxR > minR ? minR + Math.floor(Math.random() * (maxR - minR + 1)) : minR;
        nextMoney += reward;
        const smallWanted = Math.max(4, Math.round(offense.wantedDelta * 0.45));
        nextWanted = Math.min(lawConfig.wantedMax, Math.round(baseWanted + smallWanted));

        const { reputation, creditScore } = applyReputationAndCredit(
          tx,
          db,
          uid,
          charData,
          accSnap,
          Math.round(offense.reputationDelta * 0.4),
          0,
          nowMs
        );

        tx.set(db.collection('crime_records').doc(recordId), {
          id: recordId,
          characterId: uid,
          characterName: String(charData.name || 'Warga'),
          offenseId: offense.id,
          offenseTitle: offense.title,
          severity: offense.severity,
          atMs: nowMs,
          location: { zone: charData.currentZone || 'cicalengka', x: posX, z: posZ },
          targetType,
          targetId,
          witnesses,
          status: witnesses.length > 0 || cctvTriggered ? 'wanted' : 'reported',
          fine: offense.fine,
          sentenceSec: offense.sentenceSec,
          evidenceScore: Math.round((witnesses.length * 15) + (cctvTriggered ? 30 : 10)),
        });

        tx.update(charRef, {
          money: nextMoney,
          wantedLevel: nextWanted,
          wantedUpdatedAtMs: nowMs,
          lastCrimeAtMs: nowMs,
          criminalRecordCount: Number(charData.criminalRecordCount || 0) + 1,
          reputation,
          creditScore,
          updatedAt: Timestamp.fromMillis(nowMs),
        });

        if (reward > 0) {
          appendTransaction(tx, db, uid, {
            type: 'income',
            category: 'kriminal',
            amount: reward,
            balanceAfter: nextMoney,
            description: `Hasil ${offense.title} (berisiko)`,
            nowMs,
          });
          appendLedger(tx, db, {
            from: targetId || 'public',
            to: uid,
            amount: reward,
            reason: `crime_${offense.id}`,
            refId: recordId,
            nowMs,
          });
        }
      }

      return {
        ok: true,
        caught,
        reward,
        money: nextMoney,
        wantedLevel: nextWanted,
        recordId,
        catchChance: Math.round(catchChance * 100),
        witnesses,
        cctvTriggered,
        isNight,
        targetOwnerId,
        targetPropertyId,
        posX,
        posZ,
        offenseTitle: offense.title,
        severity: offense.severity,
      };
    });

    // Tulis sinyal TKP & alarm RTDB non-transaksional
    if (result.caught || result.witnesses.length > 0 || result.cctvTriggered) {
      await writeCrimeSceneRtdb(result.recordId, {
        type: offense.id,
        label: result.offenseTitle,
        zone: 'cicalengka',
        x: result.posX,
        z: result.posZ,
        severity: result.severity,
        nowMs,
      });
    }

    if (result.targetOwnerId && result.targetOwnerId !== 'npc' && !result.targetOwnerId.startsWith('npc_')) {
      await writeLawAlertRtdb(`al_${result.recordId}`, {
        kind: 'alarm',
        targetUid: result.targetOwnerId,
        propertyId: result.targetPropertyId,
        message: `Peringatan keamanan! Terdeteksi ${result.offenseTitle} di properti/bisnis Anda.`,
        x: result.posX,
        z: result.posZ,
        nowMs,
      });
    }

    return result;
  }
);

/**
 * 2. reportCrime: Warga melaporkan tindak kriminal / DPO aktif dengan bukti sah.
 */
export const reportCrime = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const body = request.data as { targetUid?: unknown; recordId?: unknown; note?: unknown };
    const targetUid = typeof body?.targetUid === 'string' ? body.targetUid.trim() : '';
    const recordId = typeof body?.recordId === 'string' ? body.recordId.trim() : '';
    const nowMs = Date.now();

    if (!targetUid && !recordId) {
      throw new HttpsError('invalid-argument', 'Target laporan atau ID catatan diperlukan.');
    }
    if (targetUid === uid) {
      throw new HttpsError('invalid-argument', 'Tidak dapat melaporkan diri sendiri.');
    }

    const reporterRef = db.collection('characters').doc(uid);

    const out = await db.runTransaction(async (tx) => {
      const reporterSnap = await tx.get(reporterRef);
      if (!reporterSnap.exists) throw new HttpsError('not-found', 'Karakter pelapor tidak ditemukan.');
      const reporter = reporterSnap.data()!;
      if (reporter.sentence?.active) {
        throw new HttpsError('failed-precondition', 'Tahanan tidak dapat membuat laporan baru.');
      }

      const lastReportMs = Number(reporter.lastReportAtMs || 0);
      if (nowMs - lastReportMs < 120_000) {
        throw new HttpsError('resource-exhausted', 'Tunggu 2 menit sebelum melapor lagi.');
      }

      let targetRecordSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (recordId) {
        targetRecordSnap = await tx.get(db.collection('crime_records').doc(recordId));
      } else if (targetUid) {
        const q = db
          .collection('crime_records')
          .where('characterId', '==', targetUid)
          .where('status', 'in', ['wanted', 'reported'])
          .limit(1);
        const qSnap = await tx.get(q);
        if (!qSnap.empty) targetRecordSnap = qSnap.docs[0];
      }

      if (!targetRecordSnap || !targetRecordSnap.exists) {
        throw new HttpsError('failed-precondition', 'Tidak ditemukan bukti pelanggaran aktif pada target.');
      }

      const recData = targetRecordSnap.data()!;
      if (nowMs - Number(recData.atMs || 0) > lawConfig.policeEnforcement.evidenceMaxAgeMs) {
        throw new HttpsError('failed-precondition', 'Bukti pelanggaran sudah kedaluwarsa.');
      }

      const suspectId = String(recData.characterId);
      const suspectSnap = await tx.get(db.collection('characters').doc(suspectId));
      const suspectData = suspectSnap.data();

      tx.update(targetRecordSnap.ref, {
        status: 'wanted',
        reportedBy: uid,
        reportedAtMs: nowMs,
      });

      const bonus = 2500;
      const nextMoney = Number(reporter.money || 0) + bonus;
      const nextRep = Math.min(100, Number(reporter.reputation ?? 50) + 1);
      tx.update(reporterRef, {
        money: nextMoney,
        reputation: nextRep,
        lastReportAtMs: nowMs,
        updatedAt: Timestamp.fromMillis(nowMs),
      });

      appendTransaction(tx, db, uid, {
        type: 'income',
        category: 'laporan_hukum',
        amount: bonus,
        balanceAfter: nextMoney,
        description: `Imbalan laporan warga valid (${recData.offenseTitle})`,
        nowMs,
      });

      return {
        ok: true,
        recordId: targetRecordSnap.id,
        suspectId,
        suspectName: String(suspectData?.name || recData.characterName || 'Pelaku'),
        bonus,
        money: nextMoney,
        x: Number(recData.location?.x || 0),
        z: Number(recData.location?.z || 0),
        offenseTitle: String(recData.offenseTitle || 'Pelanggaran'),
      };
    });

    await writeLawAlertRtdb(`rep_${out.recordId}`, {
      kind: 'dispatch',
      targetUid: 'police_all',
      message: `Laporan warga: ${out.suspectName} terindikasi ${out.offenseTitle}.`,
      x: out.x,
      z: out.z,
      nowMs,
    });

    return out;
  }
);

/**
 * 3. payFine: Bayar denda catatan kriminal atau tagihan tilang agar status wanted turun/lunas.
 */
export const payFine = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const body = request.data as { recordId?: unknown; paymentSource?: unknown };
    const recordId = typeof body?.recordId === 'string' ? body.recordId.trim() : '';
    const useBank = body?.paymentSource === 'bank';
    const nowMs = Date.now();

    if (!recordId) throw new HttpsError('invalid-argument', 'ID catatan denda diperlukan.');

    const charRef = db.collection('characters').doc(uid);
    const recRef = db.collection('crime_records').doc(recordId);
    const accRef = db.collection('accounts').doc(uid);
    const treasuryRef = db.collection('state').doc('treasury');

    return db.runTransaction(async (tx) => {
      const [charSnap, recSnap, accSnap, treasurySnap] = await Promise.all([
        tx.get(charRef),
        tx.get(recRef),
        tx.get(accRef),
        tx.get(treasuryRef),
      ]);

      if (!charSnap.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      if (!recSnap.exists) throw new HttpsError('not-found', 'Catatan denda tidak ditemukan.');

      const charData = charSnap.data()!;
      const recData = recSnap.data()!;

      if (recData.characterId !== uid) {
        throw new HttpsError('permission-denied', 'Catatan kriminal bukan milik Anda.');
      }
      if (!['wanted', 'reported', 'fined'].includes(String(recData.status))) {
        throw new HttpsError('failed-precondition', 'Denda untuk catatan ini sudah diselesaikan.');
      }

      const fineAmount = Math.max(0, Math.round(Number(recData.fine || 0)));
      let nextMoney = Number(charData.money || 0);

      if (useBank) {
        if (!accSnap.exists) throw new HttpsError('failed-precondition', 'Rekening bank belum dibuka.');
        const bankBal = Number(accSnap.data()?.balance || 0);
        if (bankBal < fineAmount) {
          throw new HttpsError('failed-precondition', 'Saldo bank tidak cukup untuk membayar denda.');
        }
        tx.update(accRef, { balance: bankBal - fineAmount, updatedAtMs: nowMs });
      } else {
        if (nextMoney < fineAmount) {
          throw new HttpsError('failed-precondition', 'Uang tunai tidak cukup untuk membayar denda.');
        }
        nextMoney -= fineAmount;
      }

      const currentWanted = computeLazyWantedLevel(
        Number(charData.wantedLevel || 0),
        Number(charData.wantedUpdatedAtMs || nowMs),
        nowMs
      );
      const nextWanted = Math.max(0, Math.round(currentWanted - Math.max(15, Number(recData.severity || 1) * 12)));

      tx.update(recRef, { status: 'paid', paidAtMs: nowMs });
      tx.update(charRef, {
        money: nextMoney,
        wantedLevel: nextWanted,
        wantedUpdatedAtMs: nowMs,
        reputation: Math.min(100, Number(charData.reputation ?? 50) + 2),
        updatedAt: Timestamp.fromMillis(nowMs),
      });

      applyTreasuryCredit(tx, db, treasurySnap, fineAmount, 'income', nowMs);
      appendLedger(tx, db, {
        from: uid,
        to: 'treasury',
        amount: fineAmount,
        reason: 'pay_fine',
        refId: recordId,
        nowMs,
      });
      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'denda_hukum',
        amount: fineAmount,
        balanceAfter: nextMoney,
        description: `Pembayaran denda: ${recData.offenseTitle}`,
        nowMs,
      });

      return { ok: true, paidAmount: fineAmount, money: nextMoney, wantedLevel: nextWanted };
    });
  }
);

/**
 * 4. arrestPlayer: Polisi pemain menangkap pelaku berstatus wanted/bukti sah dalam radius 8m.
 */
export const arrestPlayer = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const officerUid = request.auth.uid;
    const body = request.data as { targetUid?: unknown };
    const targetUid = typeof body?.targetUid === 'string' ? body.targetUid.trim() : '';
    const nowMs = Date.now();

    if (!targetUid || targetUid === officerUid) {
      throw new HttpsError('invalid-argument', 'Target penangkapan tidak valid.');
    }

    const officerRef = db.collection('characters').doc(officerUid);
    const targetRef = db.collection('characters').doc(targetUid);
    const sentRef = db.collection('sentences').doc(targetUid);

    const [officerPre, targetPre] = await Promise.all([officerRef.get(), targetRef.get()]);
    if (!officerPre.exists || !targetPre.exists) {
      throw new HttpsError('not-found', 'Petugas atau target tidak ditemukan.');
    }
    const [officerPos, targetPos] = await Promise.all([
      getPlayerWorldPos(rtdb, officerUid, officerPre.data()!),
      getPlayerWorldPos(rtdb, targetUid, targetPre.data()!),
    ]);
    const preDist = distance2D(officerPos.x, officerPos.z, targetPos.x, targetPos.z);
    if (preDist > lawConfig.policeEnforcement.arrestRadiusMeters) {
      throw new HttpsError('failed-precondition', `Terlalu jauh dari target (${Math.round(preDist)}m). Dekati hingga <= ${lawConfig.policeEnforcement.arrestRadiusMeters}m.`);
    }

    return db.runTransaction(async (tx) => {
      const [officerSnap, targetSnap, sentSnap] = await Promise.all([
        tx.get(officerRef),
        tx.get(targetRef),
        tx.get(sentRef),
      ]);

      if (!officerSnap.exists || !targetSnap.exists) {
        throw new HttpsError('not-found', 'Petugas atau target tidak ditemukan.');
      }

      const officer = officerSnap.data()!;
      const target = targetSnap.data()!;

      if (!isPoliceChar(officer)) {
        throw new HttpsError('permission-denied', 'Hanya karakter dengan pekerjaan Polisi yang dapat menangkap.');
      }
      if (Number(officer.policeStats?.suspendedUntilMs || 0) > nowMs) {
        throw new HttpsError('permission-denied', 'Izin penegakan Anda sedang dibekukan oleh Propam.');
      }
      if (officer.sentence?.active) {
        throw new HttpsError('failed-precondition', 'Tidak bisa menangkap saat sedang ditahan.');
      }
      if (target.sentence?.active || (sentSnap.exists && sentSnap.data()?.status === 'serving')) {
        throw new HttpsError('failed-precondition', 'Target sudah berada dalam tahanan.');
      }

      // Cooldown penangkapan per target
      const lastArrestedAt = Number(target.lastArrestedAtMs || 0);
      const arrestCdMs = lawConfig.policeEnforcement.arrestCooldownPerTargetSec * 1000;
      if (nowMs - lastArrestedAt < arrestCdMs) {
        throw new HttpsError('resource-exhausted', 'Target masih dalam masa perlindungan pasca-penahanan.');
      }

      // Validasi bukti sah
      const targetWanted = computeLazyWantedLevel(
        Number(target.wantedLevel || 0),
        Number(target.wantedUpdatedAtMs || nowMs),
        nowMs
      );
      const recQuery = db
        .collection('crime_records')
        .where('characterId', '==', targetUid)
        .where('status', 'in', ['wanted', 'reported', 'fined'])
        .limit(3);
      const recQuerySnap = await tx.get(recQuery);

      const validRec = recQuerySnap.docs.find(
        (d) => nowMs - Number(d.data().atMs || 0) <= lawConfig.policeEnforcement.evidenceMaxAgeMs
      );

      const actionId = `pa_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;

      if (targetWanted <= 0 && !validRec) {
        // Catat percobaan penangkapan tanpa bukti sah untuk diaudit Propam
        tx.set(db.collection('police_actions').doc(actionId), {
          id: actionId,
          officerId: officerUid,
          officerName: String(officer.name || 'Petugas'),
          targetId: targetUid,
          targetName: String(target.name || 'Warga'),
          action: 'arrest',
          evidence: 'TIDAK ADA BUKTI SAH (DITOLAK SISTEM)',
          recordId: '',
          amount: 0,
          atMs: nowMs,
          reviewed: true,
          reviewStatus: 'warning',
        });
        throw new HttpsError('failed-precondition', 'Penangkapan ditolak: target tidak berstatus wanted dan tidak ada bukti sah.');
      }

      const sentenceSec = Number(validRec?.data()?.sentenceSec || 360);
      const fineAmount = Number(validRec?.data()?.fine || 25000);
      const bailAmount = Math.round(fineAmount * lawConfig.bailMultiplierOfFine);
      const endAtMs = nowMs + sentenceSec * 1000;

      if (validRec) {
        tx.update(validRec.ref, { status: 'arrested', arrestedBy: officerUid, arrestedAtMs: nowMs });
      }

      tx.set(sentRef, {
        uid: targetUid,
        recordId: validRec?.id || '',
        startAtMs: nowMs,
        endAtMs,
        originalEndAtMs: endAtMs,
        reason: String(validRec?.data()?.offenseTitle || 'Pelanggaran Hukum Cicalengka'),
        fineAmount,
        bailAmount,
        bailPaid: false,
        bailPaidBy: '',
        workReductionSec: 0,
        lastPrisonWorkAtMs: 0,
        appealFiled: false,
        status: 'serving',
      });

      tx.update(targetRef, {
        wantedLevel: 0,
        wantedUpdatedAtMs: nowMs,
        lastArrestedAtMs: nowMs,
        sentence: {
          active: true,
          sentenceId: targetUid,
          startAtMs: nowMs,
          endAtMs,
          reason: String(validRec?.data()?.offenseTitle || 'Ditahan Polsek Cicalengka'),
        },
        lastPosition: {
          ...lawConfig.policeStation.jailCenter,
          rotY: 0,
        },
        updatedAt: Timestamp.fromMillis(nowMs),
      });

      const reward = lawConfig.policeEnforcement.arrestReward;
      const nextOfficerMoney = Number(officer.money || 0) + reward;
      tx.update(officerRef, {
        money: nextOfficerMoney,
        policeStats: {
          arrestsCount: Number(officer.policeStats?.arrestsCount || 0) + 1,
          finesIssued: Number(officer.policeStats?.finesIssued || 0),
          abuseStrikes: Number(officer.policeStats?.abuseStrikes || 0),
          suspendedUntilMs: Number(officer.policeStats?.suspendedUntilMs || 0),
        },
        updatedAt: Timestamp.fromMillis(nowMs),
      });

      appendTransaction(tx, db, officerUid, {
        type: 'income',
        category: 'polisi_insentif',
        amount: reward,
        balanceAfter: nextOfficerMoney,
        description: `Insentif penangkapan sah: ${target.name}`,
        nowMs,
      });

      tx.set(db.collection('police_actions').doc(actionId), {
        id: actionId,
        officerId: officerUid,
        officerName: String(officer.name || 'Petugas'),
        targetId: targetUid,
        targetName: String(target.name || 'Warga'),
        action: 'arrest',
        evidence: validRec ? `Record ${validRec.id}: ${validRec.data()?.offenseTitle}` : `Wanted ${targetWanted}`,
        recordId: validRec?.id || '',
        amount: reward,
        atMs: nowMs,
        reviewed: false,
        reviewStatus: 'valid',
      });

      return {
        ok: true,
        actionId,
        targetName: String(target.name || 'Warga'),
        sentenceSec,
        bailAmount,
        reward,
        officerMoney: nextOfficerMoney,
      };
    });
  }
);

/**
 * 5. issueFine: Polisi menilang target yang melanggar aturan dan menerbitkan tagihan denda.
 */
export const issueFine = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const officerUid = request.auth.uid;
    const body = request.data as { targetUid?: unknown; recordId?: unknown };
    const targetUid = typeof body?.targetUid === 'string' ? body.targetUid.trim() : '';
    const recordId = typeof body?.recordId === 'string' ? body.recordId.trim() : '';
    const nowMs = Date.now();

    if (!targetUid || targetUid === officerUid) {
      throw new HttpsError('invalid-argument', 'Target tilang tidak valid.');
    }

    const officerRef = db.collection('characters').doc(officerUid);
    const targetRef = db.collection('characters').doc(targetUid);

    const [officerPre, targetPre] = await Promise.all([officerRef.get(), targetRef.get()]);
    if (!officerPre.exists || !targetPre.exists) {
      throw new HttpsError('not-found', 'Petugas atau target tidak ditemukan.');
    }
    const [officerPos, targetPos] = await Promise.all([
      getPlayerWorldPos(rtdb, officerUid, officerPre.data()!),
      getPlayerWorldPos(rtdb, targetUid, targetPre.data()!),
    ]);
    const preFineDist = distance2D(officerPos.x, officerPos.z, targetPos.x, targetPos.z);
    if (preFineDist > 12) {
      throw new HttpsError('failed-precondition', 'Terlalu jauh dari pelanggar.');
    }

    return db.runTransaction(async (tx) => {
      const [officerSnap, targetSnap] = await Promise.all([tx.get(officerRef), tx.get(targetRef)]);
      if (!officerSnap.exists || !targetSnap.exists) {
        throw new HttpsError('not-found', 'Petugas atau target tidak ditemukan.');
      }

      const officer = officerSnap.data()!;
      const target = targetSnap.data()!;
      if (!isPoliceChar(officer)) {
        throw new HttpsError('permission-denied', 'Hanya Polisi yang dapat menerbitkan tilang.');
      }
      if (Number(officer.policeStats?.suspendedUntilMs || 0) > nowMs) {
        throw new HttpsError('permission-denied', 'Izin penegakan Anda sedang dibekukan.');
      }

      const recSnap = recordId
        ? await tx.get(db.collection('crime_records').doc(recordId))
        : null;
      const targetWanted = computeLazyWantedLevel(
        Number(target.wantedLevel || 0),
        Number(target.wantedUpdatedAtMs || nowMs),
        nowMs
      );

      if ((!recSnap || !recSnap.exists) && targetWanted <= 0) {
        throw new HttpsError('failed-precondition', 'Target tidak memiliki pelanggaran aktif.');
      }

      const fineAmount = Number(recSnap?.data()?.fine || 20000);
      const billId = `fine_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;
      tx.set(targetRef.collection('bills').doc(billId), {
        id: billId,
        uid: targetUid,
        billType: 'fine',
        title: `Tilang Polisi: ${recSnap?.data()?.offenseTitle || 'Pelanggaran Umum'}`,
        periodIndex: Math.floor(nowMs / 25_200_000),
        baseAmount: fineAmount,
        lateFee: 0,
        totalDue: fineAmount,
        status: 'unpaid',
        dueAtMs: nowMs + 7_200_000,
      });

      if (recSnap && recSnap.exists) {
        tx.update(recSnap.ref, { status: 'fined', finedBy: officerUid, finedAtMs: nowMs });
      }

      const commission = Math.round(fineAmount * lawConfig.policeEnforcement.fineCommissionRate);
      const nextMoney = Number(officer.money || 0) + commission;
      tx.update(officerRef, {
        money: nextMoney,
        policeStats: {
          arrestsCount: Number(officer.policeStats?.arrestsCount || 0),
          finesIssued: Number(officer.policeStats?.finesIssued || 0) + 1,
          abuseStrikes: Number(officer.policeStats?.abuseStrikes || 0),
          suspendedUntilMs: Number(officer.policeStats?.suspendedUntilMs || 0),
        },
        updatedAt: Timestamp.fromMillis(nowMs),
      });

      const actionId = `pa_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;
      tx.set(db.collection('police_actions').doc(actionId), {
        id: actionId,
        officerId: officerUid,
        officerName: String(officer.name || 'Petugas'),
        targetId: targetUid,
        targetName: String(target.name || 'Warga'),
        action: 'fine',
        evidence: recSnap?.exists ? `Record ${recSnap.id}` : `Wanted ${targetWanted}`,
        recordId: recSnap?.id || '',
        amount: fineAmount,
        atMs: nowMs,
        reviewed: false,
        reviewStatus: 'valid',
      });

      return { ok: true, billId, fineAmount, commission, actionId };
    });
  }
);

/**
 * 6. releasePlayer: Pembebasan tahanan oleh polisi berwenang.
 */
export const releasePlayer = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const officerUid = request.auth.uid;
    const body = request.data as { targetUid?: unknown; reason?: unknown };
    const targetUid = typeof body?.targetUid === 'string' ? body.targetUid.trim() : '';
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 120) : 'Dibebaskan petugas Polsek';
    const nowMs = Date.now();

    if (!targetUid) throw new HttpsError('invalid-argument', 'UID tahanan diperlukan.');

    return db.runTransaction(async (tx) => {
      const [officerSnap, targetSnap, sentSnap] = await Promise.all([
        tx.get(db.collection('characters').doc(officerUid)),
        tx.get(db.collection('characters').doc(targetUid)),
        tx.get(db.collection('sentences').doc(targetUid)),
      ]);

      if (!officerSnap.exists || !targetSnap.exists) {
        throw new HttpsError('not-found', 'Data petugas atau tahanan tidak ditemukan.');
      }

      const officer = officerSnap.data()!;
      if (!isPoliceChar(officer) && !request.auth?.token?.admin) {
        throw new HttpsError('permission-denied', 'Hanya petugas Polisi berwenang yang dapat membebaskan.');
      }
      if (!sentSnap.exists || sentSnap.data()?.status !== 'serving') {
        throw new HttpsError('failed-precondition', 'Target tidak sedang menjalani masa tahanan.');
      }

      tx.update(sentSnap.ref, { status: 'released', releasedAtMs: nowMs, releasedBy: officerUid });
      tx.update(targetSnap.ref, {
        sentence: null,
        lastPosition: { ...lawConfig.policeStation.releaseSpawn, rotY: 0 },
        updatedAt: Timestamp.fromMillis(nowMs),
      });

      const actionId = `pa_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;
      tx.set(db.collection('police_actions').doc(actionId), {
        id: actionId,
        officerId: officerUid,
        officerName: String(officer.name || 'Petugas'),
        targetId: targetUid,
        targetName: String(targetSnap.data()?.name || 'Warga'),
        action: 'release',
        evidence: reason,
        recordId: String(sentSnap.data()?.recordId || ''),
        amount: 0,
        atMs: nowMs,
        reviewed: true,
        reviewStatus: 'valid',
      });

      return { ok: true, releasedUid: targetUid };
    });
  }
);

/**
 * 7. reviewPoliceAction: Audit Propam / Internal Affairs terhadap tindakan polisi yang dilaporkan.
 */
export const reviewPoliceAction = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const callerUid = request.auth.uid;
    const body = request.data as { actionId?: unknown };
    const actionId = typeof body?.actionId === 'string' ? body.actionId.trim() : '';
    const nowMs = Date.now();

    if (!actionId) throw new HttpsError('invalid-argument', 'ID tindakan polisi diperlukan.');

    return db.runTransaction(async (tx) => {
      const actionRef = db.collection('police_actions').doc(actionId);
      const actionSnap = await tx.get(actionRef);
      if (!actionSnap.exists) throw new HttpsError('not-found', 'Log tindakan polisi tidak ditemukan.');

      const act = actionSnap.data()!;
      if (act.reviewed && act.reviewStatus !== 'pending') {
        return { ok: true, reviewStatus: act.reviewStatus, alreadyReviewed: true };
      }

      const officerUid = String(act.officerId);
      const officerRef = db.collection('characters').doc(officerUid);
      const officerSnap = await tx.get(officerRef);
      const recSnap = act.recordId ? await tx.get(db.collection('crime_records').doc(String(act.recordId))) : null;

      // Cek keabsahan bukti
      const hasValidRecord = Boolean(recSnap && recSnap.exists);
      const isAbuse = !hasValidRecord && !String(act.evidence || '').startsWith('Wanted');

      if (!isAbuse) {
        tx.update(actionRef, {
          reviewed: true,
          reviewStatus: 'valid',
          reportedBy: callerUid,
          reviewedAtMs: nowMs,
        });
        return { ok: true, reviewStatus: 'valid', message: 'Audit Propam: Tindakan polisi terbukti sah dan sesuai prosedur.' };
      }

      // Pelanggaran wewenang terdeteksi -> denda petugas & strike Propam
      const strikes = Number(officerSnap.data()?.policeStats?.abuseStrikes || 0) + 1;
      const penalty = lawConfig.policeEnforcement.abusePenaltyFine;
      const officerMoney = Math.max(0, Number(officerSnap.data()?.money || 0) - penalty);
      const suspendedUntilMs =
        strikes >= lawConfig.policeEnforcement.abuseMaxStrikes
          ? nowMs + lawConfig.policeEnforcement.abuseSuspensionMs
          : Number(officerSnap.data()?.policeStats?.suspendedUntilMs || 0);

      if (officerSnap.exists) {
        tx.update(officerRef, {
          money: officerMoney,
          currentJob: strikes >= lawConfig.policeEnforcement.abuseMaxStrikes ? null : officerSnap.data()?.currentJob,
          policeStats: {
            arrestsCount: Number(officerSnap.data()?.policeStats?.arrestsCount || 0),
            finesIssued: Number(officerSnap.data()?.policeStats?.finesIssued || 0),
            abuseStrikes: strikes,
            suspendedUntilMs,
          },
          updatedAt: Timestamp.fromMillis(nowMs),
        });
        appendTransaction(tx, db, officerUid, {
          type: 'penalty',
          category: 'audit_propam',
          amount: penalty,
          balanceAfter: officerMoney,
          description: `Sanksi Propam penyalahgunaan wewenang (Strike #${strikes})`,
          nowMs,
        });
      }

      tx.update(actionRef, {
        reviewed: true,
        reviewStatus: 'abuse',
        reportedBy: callerUid,
        reviewedAtMs: nowMs,
      });

      return {
        ok: true,
        reviewStatus: 'abuse',
        strikes,
        suspended: strikes >= lawConfig.policeEnforcement.abuseMaxStrikes,
      };
    });
  }
);

/**
 * 8. serveSentence: Cek pembebasan lazy atau lakukan kerja ringan di sel untuk memotong masa tahanan.
 */
export const serveSentence = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const body = request.data as { action?: unknown };
    const action = body?.action === 'work' ? 'work' : 'check';
    const nowMs = Date.now();

    if (action === 'check') {
      const lazy = await syncLazySentenceAndWanted(db, uid, nowMs);
      return { ok: true, released: lazy.autoReleased, wantedLevel: lazy.wantedLevel };
    }

    const charRef = db.collection('characters').doc(uid);
    const statsRef = db.collection('character_stats').doc(uid);
    const sentRef = db.collection('sentences').doc(uid);

    return db.runTransaction(async (tx) => {
      const [charSnap, statsSnap, sentSnap] = await Promise.all([
        tx.get(charRef),
        tx.get(statsRef),
        tx.get(sentRef),
      ]);

      if (!charSnap.exists || !sentSnap.exists) {
        throw new HttpsError('not-found', 'Data tahanan tidak ditemukan.');
      }

      const sent = sentSnap.data()!;
      const charData = charSnap.data()!;
      if (sent.status !== 'serving') {
        return { ok: true, released: true, remainingSec: 0 };
      }

      if (nowMs >= Number(sent.endAtMs || 0)) {
        tx.update(sentRef, { status: 'released', releasedAtMs: nowMs });
        tx.update(charRef, {
          sentence: null,
          lastPosition: { ...lawConfig.policeStation.releaseSpawn, rotY: 0 },
          updatedAt: Timestamp.fromMillis(nowMs),
        });
        return { ok: true, released: true, remainingSec: 0 };
      }

      const lastWorkMs = Number(sent.lastPrisonWorkAtMs || 0);
      const cdMs = lawConfig.prisonWorkCooldownSec * 1000;
      if (nowMs - lastWorkMs < cdMs) {
        const waitSec = Math.ceil((cdMs - (nowMs - lastWorkMs)) / 1000);
        throw new HttpsError('resource-exhausted', `Tunggu ${waitSec} detik sebelum kerja tahanan lagi.`);
      }

      const currentEnergy = Number(statsSnap.data()?.energy ?? 60);
      if (currentEnergy < 8) {
        throw new HttpsError('failed-precondition', 'Energi terlalu rendah untuk kerja tahanan.');
      }

      const cutMs = lawConfig.prisonWorkSentenceCutSec * 1000;
      const nextEndAtMs = Number(sent.endAtMs) - cutMs;
      const pay = lawConfig.prisonWorkPay;
      const nextMoney = Number(charData.money || 0) + pay;

      if (statsSnap.exists) {
        tx.update(statsRef, { energy: Math.max(0, currentEnergy - 8) });
      }

      const releasedNow = nextEndAtMs <= nowMs;
      tx.update(sentRef, {
        endAtMs: nextEndAtMs,
        workReductionSec: Number(sent.workReductionSec || 0) + lawConfig.prisonWorkSentenceCutSec,
        lastPrisonWorkAtMs: nowMs,
        status: releasedNow ? 'released' : 'serving',
        ...(releasedNow ? { releasedAtMs: nowMs } : {}),
      });

      tx.update(charRef, {
        money: nextMoney,
        sentence: releasedNow
          ? null
          : {
              active: true,
              sentenceId: uid,
              startAtMs: Number(sent.startAtMs),
              endAtMs: nextEndAtMs,
              reason: String(sent.reason || ''),
            },
        ...(releasedNow ? { lastPosition: { ...lawConfig.policeStation.releaseSpawn, rotY: 0 } } : {}),
        updatedAt: Timestamp.fromMillis(nowMs),
      });

      appendTransaction(tx, db, uid, {
        type: 'income',
        category: 'kerja_tahanan',
        amount: pay,
        balanceAfter: nextMoney,
        description: `Kerja sosial tahanan (-${lawConfig.prisonWorkSentenceCutSec} dtk masa tahanan)`,
        nowMs,
      });

      return {
        ok: true,
        released: releasedNow,
        pay,
        money: nextMoney,
        remainingSec: Math.max(0, Math.ceil((nextEndAtMs - nowMs) / 1000)),
      };
    });
  }
);

/**
 * 9. payBail: Teman/keluarga (atau saldo bank sendiri) membayar jaminan agar tahanan langsung bebas.
 */
export const payBail = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const payerUid = request.auth.uid;
    const body = request.data as { targetUid?: unknown; targetName?: unknown; paymentSource?: unknown };
    let targetUid = typeof body?.targetUid === 'string' ? body.targetUid.trim() : '';
    const targetName = typeof body?.targetName === 'string' ? body.targetName.trim().toLowerCase() : '';
    const useBank = body?.paymentSource === 'bank';
    const nowMs = Date.now();

    if (!targetUid && targetName) {
      const lockSnap = await db.collection('character_names').doc(targetName).get();
      if (lockSnap.exists) {
        targetUid = String(lockSnap.data()?.uid || '');
      }
    }
    if (!targetUid) targetUid = payerUid;

    const payerRef = db.collection('characters').doc(payerUid);
    const payerAccRef = db.collection('accounts').doc(payerUid);
    const targetRef = db.collection('characters').doc(targetUid);
    const sentRef = db.collection('sentences').doc(targetUid);
    const treasuryRef = db.collection('state').doc('treasury');

    return db.runTransaction(async (tx) => {
      const [payerSnap, payerAccSnap, targetSnap, sentSnap, treasurySnap] = await Promise.all([
        tx.get(payerRef),
        tx.get(payerAccRef),
        tx.get(targetRef),
        tx.get(sentRef),
        tx.get(treasuryRef),
      ]);

      if (!payerSnap.exists || !targetSnap.exists || !sentSnap.exists) {
        throw new HttpsError('not-found', 'Data tahanan atau pembayar tidak ditemukan.');
      }

      const payer = payerSnap.data()!;
      const sent = sentSnap.data()!;
      if (sent.status !== 'serving') {
        throw new HttpsError('failed-precondition', 'Target tidak sedang menjalani masa tahanan.');
      }

      const bailAmount = Math.max(10000, Number(sent.bailAmount || 35000));
      let nextPayerMoney = Number(payer.money || 0);

      if (useBank || payerUid === targetUid) {
        if (useBank) {
          const bal = Number(payerAccSnap.data()?.balance || 0);
          if (!payerAccSnap.exists || bal < bailAmount) {
            throw new HttpsError('failed-precondition', 'Saldo bank tidak mencukupi untuk jaminan.');
          }
          tx.update(payerAccRef, { balance: bal - bailAmount, updatedAtMs: nowMs });
        } else {
          if (nextPayerMoney < bailAmount) {
            throw new HttpsError('failed-precondition', 'Uang tunai tidak mencukupi untuk jaminan.');
          }
          nextPayerMoney -= bailAmount;
        }
      } else {
        if (nextPayerMoney < bailAmount) {
          throw new HttpsError('failed-precondition', 'Uang tunai Anda tidak mencukupi untuk menebus jaminan.');
        }
        nextPayerMoney -= bailAmount;
      }

      tx.update(payerRef, {
        money: nextPayerMoney,
        reputation: Math.min(100, Number(payer.reputation ?? 50) + (payerUid !== targetUid ? 3 : 0)),
        updatedAt: Timestamp.fromMillis(nowMs),
      });

      tx.update(sentRef, {
        bailPaid: true,
        bailPaidBy: payerUid,
        bailPaidByName: String(payer.name || 'Warga'),
        status: 'bailed',
        releasedAtMs: nowMs,
      });

      tx.update(targetRef, {
        sentence: null,
        lastPosition: { ...lawConfig.policeStation.releaseSpawn, rotY: 0 },
        updatedAt: Timestamp.fromMillis(nowMs),
      });

      applyTreasuryCredit(tx, db, treasurySnap, bailAmount, 'income', nowMs);
      appendLedger(tx, db, {
        from: payerUid,
        to: 'treasury',
        amount: bailAmount,
        reason: 'pay_bail',
        refId: targetUid,
        nowMs,
      });
      appendTransaction(tx, db, payerUid, {
        type: 'expense',
        category: 'jaminan_hukum',
        amount: bailAmount,
        balanceAfter: nextPayerMoney,
        description: `Membayar jaminan tahanan untuk ${targetSnap.data()?.name}`,
        nowMs,
      });

      return {
        ok: true,
        bailAmount,
        payerMoney: nextPayerMoney,
        releasedName: String(targetSnap.data()?.name || 'Warga'),
      };
    });
  }
);

/**
 * 10. fileAppeal: Banding hukum berbayar untuk peluang memangkas sisa masa tahanan.
 */
export const fileAppeal = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const uid = request.auth.uid;
    const nowMs = Date.now();
    const charRef = db.collection('characters').doc(uid);
    const sentRef = db.collection('sentences').doc(uid);
    const treasuryRef = db.collection('state').doc('treasury');

    return db.runTransaction(async (tx) => {
      const [charSnap, sentSnap, treasurySnap] = await Promise.all([
        tx.get(charRef),
        tx.get(sentRef),
        tx.get(treasuryRef),
      ]);

      if (!charSnap.exists || !sentSnap.exists) {
        throw new HttpsError('not-found', 'Data tahanan tidak ditemukan.');
      }

      const charData = charSnap.data()!;
      const sent = sentSnap.data()!;
      if (sent.status !== 'serving') {
        throw new HttpsError('failed-precondition', 'Anda tidak sedang ditahan.');
      }
      if (sent.appealFiled) {
        throw new HttpsError('failed-precondition', 'Banding hanya dapat diajukan 1 kali per masa tahanan.');
      }

      const fee = lawConfig.appealFee;
      const money = Number(charData.money || 0);
      if (money < fee) {
        throw new HttpsError('failed-precondition', `Biaya administrasi banding Rp ${fee.toLocaleString('id-ID')} tidak cukup.`);
      }

      const komBonus = Math.min(0.12, Number(charData.skills?.komunikasi || 0) * 0.005);
      const accepted = Math.random() < (lawConfig.appealSuccessChance + komBonus);
      const remainingMs = Math.max(0, Number(sent.endAtMs) - nowMs);
      const cutMs = accepted ? Math.round(remainingMs * lawConfig.appealSentenceReductionRatio) : 0;
      const nextEndAtMs = Number(sent.endAtMs) - cutMs;
      const nextMoney = money - fee;

      tx.update(sentRef, {
        appealFiled: true,
        appealOutcome: accepted ? 'accepted' : 'rejected',
        endAtMs: nextEndAtMs,
      });
      tx.update(charRef, {
        money: nextMoney,
        sentence: {
          active: true,
          sentenceId: uid,
          startAtMs: Number(sent.startAtMs),
          endAtMs: nextEndAtMs,
          reason: String(sent.reason || ''),
        },
        updatedAt: Timestamp.fromMillis(nowMs),
      });

      applyTreasuryCredit(tx, db, treasurySnap, fee, 'income', nowMs);
      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'banding_hukum',
        amount: fee,
        balanceAfter: nextMoney,
        description: accepted ? 'Banding dikabulkan sebagian' : 'Pengajuan banding ditolak',
        nowMs,
      });

      return {
        ok: true,
        accepted,
        cutSec: Math.round(cutMs / 1000),
        remainingSec: Math.max(0, Math.ceil((nextEndAtMs - nowMs) / 1000)),
        money: nextMoney,
      };
    });
  }
);

/**
 * 11. getCriminalRecord: Ambil riwayat kriminal & status wanted/tahanan terbaru (pemilik atau polisi aktif).
 */
export const getCriminalRecord = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensurePhase6Configs();

    const callerUid = request.auth.uid;
    const body = request.data as { targetUid?: unknown };
    const targetUid = typeof body?.targetUid === 'string' && body.targetUid.trim() ? body.targetUid.trim() : callerUid;
    const nowMs = Date.now();

    if (targetUid !== callerUid) {
      const callerSnap = await db.collection('characters').doc(callerUid).get();
      if (!isPoliceChar(callerSnap.data())) {
        throw new HttpsError('permission-denied', 'Hanya Polisi yang dapat memeriksa catatan kriminal warga lain.');
      }
    }

    const lazy = await syncLazySentenceAndWanted(db, targetUid, nowMs);
    const [recordsSnap, sentSnap] = await Promise.all([
      db
        .collection('crime_records')
        .where('characterId', '==', targetUid)
        .orderBy('atMs', 'desc')
        .limit(20)
        .get(),
      db.collection('sentences').doc(targetUid).get(),
    ]);

    return {
      ok: true,
      targetUid,
      wantedLevel: lazy.wantedLevel,
      sentence: sentSnap.exists ? sentSnap.data() : null,
      records: recordsSnap.docs.map((d) => d.data()),
    };
  }
);
