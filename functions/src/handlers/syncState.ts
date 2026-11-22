import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { syncLazyLoanInstallments } from '../helpers/bank';
import { settleBusinessLazy } from '../helpers/business';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION } from '../helpers/firebase';
import { syncLazyHousingState } from '../helpers/housing';
import { ensurePhase6Configs, syncLazySentenceAndWanted } from '../helpers/law';
import { applyFaintingOutcome, economyConfig, ensurePhase2Configs } from '../helpers/phase2';
import { syncLazyMortgageAndConstructionState } from '../helpers/propertyAdvanced';
import { calculateLazyStats, DEFAULT_DECAY_RATES } from '../helpers/stats';
import { ensureVehicleConfigs, syncLazyVehicleState } from '../helpers/vehicles';
import { syncLazyBillsForUser } from './bills';
import { evaluateLazyDismissal } from './jobs';
import { syncLazySecurityAndInsurance } from './security';

/**
 * Sinkronisasi lazy saat login atau aksi berkala:
 * menghitung penurunan status, cek pingsan, cek pemecatan, tagihan terlewat, & sewa/pengusiran Fase 3.
 */
export const syncPlayerState = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    await Promise.all([ensurePhase2Configs(), ensurePhase6Configs(), ensureVehicleConfigs()]);

    const uid = request.auth.uid;
    const charRef = db.collection('characters').doc(uid);
    const statsRef = db.collection('character_stats').doc(uid);
    const configRef = db.collection('config').doc('game');

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);

    const [housingSync, , lawSync, propertyPhase6Sync, secSync, vehicleSync] = await Promise.all([
      syncLazyHousingState(db, uid, nowMs),
      syncLazyLoanInstallments(db, uid, nowMs),
      syncLazySentenceAndWanted(db, uid, nowMs),
      syncLazyMortgageAndConstructionState(db, uid, nowMs),
      syncLazySecurityAndInsurance(db, uid, nowMs),
      syncLazyVehicleState(db, uid, nowMs),
    ]);

    const outcome = await db.runTransaction(async (tx) => {
      const [charDoc, statsDoc, configDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(statsRef),
        tx.get(configRef),
      ]);

      if (!charDoc.exists || !statsDoc.exists) {
        return { exists: false };
      }

      const charData = charDoc.data()!;
      const statsData = statsDoc.data()!;

      const rates = configDoc.exists
        ? {
            hungerDecayPerHour: Number(configDoc.data()?.hungerDecayPerHour ?? DEFAULT_DECAY_RATES.hungerDecayPerHour),
            thirstDecayPerHour: Number(configDoc.data()?.thirstDecayPerHour ?? DEFAULT_DECAY_RATES.thirstDecayPerHour),
            energyDecayPerHour: Number(configDoc.data()?.energyDecayPerHour ?? DEFAULT_DECAY_RATES.energyDecayPerHour),
          }
        : DEFAULT_DECAY_RATES;

      const lastCalc =
        statsData.lastCalculatedAt instanceof Timestamp
          ? statsData.lastCalculatedAt.toMillis()
          : nowMs;

      const isHomeless = typeof charData.homeless === 'boolean' ? charData.homeless : false;

      const computed = calculateLazyStats(
        {
          hunger: Number(statsData.hunger),
          thirst: Number(statsData.thirst),
          energy: Number(statsData.energy),
          health: typeof statsData.health === 'number' ? statsData.health : Number(charData.health ?? 100),
          hygiene: typeof statsData.hygiene === 'number' ? statsData.hygiene : Number(charData.hygiene ?? 100),
          mood: typeof statsData.mood === 'number' ? statsData.mood : Number(charData.mood ?? 80),
          lastCalculatedAtMs: lastCalc,
        },
        nowMs,
        rates,
        { isHomeless }
      );

      const homeRespawn =
        charData.respawnAtHome === true &&
        !isHomeless &&
        charData.lastSleepLocation &&
        typeof charData.lastSleepLocation.x === 'number'
          ? (charData.lastSleepLocation as { x: number; y: number; z: number })
          : null;

      const faintCheck = applyFaintingOutcome(
        tx,
        db,
        uid,
        computed,
        Number(charData.money),
        Number(charData.faintedCount || 0),
        nowMs,
        homeRespawn
      );

      if (faintCheck.fainted) {
        tx.update(statsRef, {
          ...faintCheck.stats,
          lastCalculatedAt: now,
        });
      }

      const dismissal = evaluateLazyDismissal(tx, db, uid, charData, nowMs);

      const createdAtMs =
        charData.createdAt instanceof Timestamp ? charData.createdAt.toMillis() : nowMs;
      const lastPeriod = Number(charData.lastBillPeriod || 0);
      const billsRes = await syncLazyBillsForUser(
        tx,
        db,
        uid,
        createdAtMs,
        lastPeriod,
        nowMs,
        Boolean(charData.activeLeaseId)
      );

      return {
        exists: true,
        fainted: faintCheck.fainted,
        fired: dismissal.fired,
        evicted: housingSync.evicted,
        autoReleased: lawSync.autoReleased,
        wantedLevel: lawSync.wantedLevel,
        permitsApproved: propertyPhase6Sync.permitsApproved,
        constructionsAdvanced: propertyPhase6Sync.constructionsAdvanced,
        foreclosedCount: propertyPhase6Sync.foreclosedCount,
        repossessedVehicles: vehicleSync.repossessedCount,
        impoundedVehicles: vehicleSync.impoundedCount,
        newBillsCreated:
          billsRes.createdCount +
          housingSync.newHousingBills +
          propertyPhase6Sync.mortgageBillsCreated +
          secSync.billsCreated +
          vehicleSync.vehicleBillsCreated,
        ownedBizIds: Array.isArray(charData.businesses)
          ? (charData.businesses as string[]).slice(0, 3)
          : [],
      };
    });

    if (outcome.exists && Array.isArray((outcome as { ownedBizIds?: string[] }).ownedBizIds)) {
      for (const bizId of (outcome as { ownedBizIds: string[] }).ownedBizIds) {
        await settleBusinessLazy(db, bizId, nowMs).catch(() => {});
      }
    }

    return { ok: true, ...outcome };
  }
);

/**
 * Opsional ringan: pengecekan pemecatan harian (bukan loop per detik).
 */
export const dailyJobAttendanceCheck = onSchedule(
  { schedule: 'every 24 hours', region: FUNCTIONS_REGION },
  async () => {
    const nowMs = Date.now();
    const snap = await db
      .collection('characters')
      .where('currentJob', '!=', null)
      .limit(100)
      .get();

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const job = data.currentJob;
      if (!job) continue;
      const lastShift = Number(job.lastShiftAtMs || job.hiredAtMs || nowMs);
      const missed = Math.floor((nowMs - lastShift) / economyConfig.expectedShiftIntervalMs);
      if (missed >= economyConfig.maxMissedShiftsBeforeFiring) {
        await docSnap.ref.update({
          currentJob: null,
          activeShift: null,
          updatedAt: Timestamp.fromMillis(nowMs),
        });
      }
    }
  }
);
