import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { clampCreditScore } from '../helpers/bank';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION, rtdb } from '../helpers/firebase';
import { appendLedger, applyTreasuryCredit } from '../helpers/ledger';
import { appendTransaction } from '../helpers/phase2';
import { clampWorldPos } from '../helpers/validation';
import {
  applyReputationAndCredit,
  computeLazyWantedLevel,
  writeCrimeSceneRtdb,
} from '../helpers/law';
import {
  allocateUniquePlateTx,
  applyDrivingWearAndFuel,
  computeLazyLeaseQuote,
  computeLazyMarketValue,
  computeLazyStnkStatus,
  dealerConfig,
  ensureVehicleConfigs,
  getAccessoryCfg,
  getDealerCfg,
  getVehicleModel,
  gradeSimExam,
  normalizePlateKey,
  syncLazyVehicleState,
  trafficConfig,
  vehiclesConfig,
} from '../helpers/vehicles';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

const PARKING_SPOTS: Record<string, { x: number; y: number; z: number; label: string }> = {
  stasiun: { x: 16, y: 0.35, z: -48, label: 'Parkir Stasiun Cicalengka' },
  pasar: { x: 36, y: 0.35, z: 12.2, label: 'Parkir Pasar Cicalengka' },
  bank: { x: -37, y: 0.35, z: -1, label: 'Parkir Bank Priangan' },
  alun_alun: { x: 12, y: 0.35, z: 2, label: 'Parkir Alun-Alun Cicalengka' },
  dealer_motor_baru: { x: -32, y: 0.35, z: -34.2, label: 'Halaman Dealer Motor Baru' },
  lapak_motor_bekas: { x: -65.2, y: 0.35, z: -30, label: 'Halaman Lapak Motor Bekas' },
  showroom_mobil_baru: { x: -30, y: 0.35, z: 21.6, label: 'Halaman Showroom Mobil Baru' },
  showroom_mobil_bekas: { x: -34, y: 0.35, z: -45.5, label: 'Halaman Showroom Mobil Bekas' },
};

function defaultDealerSpawn(dealerId: string) {
  return PARKING_SPOTS[dealerId] || PARKING_SPOTS.alun_alun;
}

async function safeRtdbSet(path: string, value: unknown): Promise<void> {
  try {
    await rtdb.ref(path).set(value);
  } catch {
    // Abaikan jika RTDB belum dikonfigurasi di environment unit/lokal
  }
}

async function safeRtdbRemove(path: string): Promise<void> {
  try {
    await rtdb.ref(path).remove();
  } catch {
    // Abaikan jika RTDB belum dikonfigurasi
  }
}

/**
 * 1. buyVehicle: Beli motor/mobil tunai di dealer baru atau lapak bekas.
 */
export const buyVehicle = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensureVehicleConfigs();

    const uid = request.auth.uid;
    const data = request.data as {
      dealerId?: string;
      modelId?: string;
      color?: string;
      isUsed?: boolean;
      useBank?: boolean;
    };

    const dealerId = typeof data?.dealerId === 'string' ? data.dealerId.trim() : '';
    const modelId = typeof data?.modelId === 'string' ? data.modelId.trim() : '';
    const dealer = getDealerCfg(dealerId);
    const model = getVehicleModel(modelId);
    if (!dealer || !model || !model.sellable) {
      throw new HttpsError('invalid-argument', 'Dealer atau model kendaraan tidak valid.');
    }
    if (!dealer.modelIds.includes(model.id)) {
      throw new HttpsError('failed-precondition', `${model.name} tidak tersedia di ${dealer.name}.`);
    }

    const reqColor = typeof data?.color === 'string' && HEX_COLOR_RE.test(data.color)
      ? data.color.toUpperCase()
      : model.colors[0];
    if (!model.colors.some((c) => c.toUpperCase() === reqColor)) {
      throw new HttpsError('invalid-argument', 'Warna tidak tersedia untuk model ini.');
    }

    const isUsed = dealer.isUsed || Boolean(data?.isUsed);
    const useBank = Boolean(data?.useBank);
    const basePrice = isUsed
      ? Math.round(((model.usedPriceMin + model.usedPriceMax) / 2) / 500) * 500
      : model.newPrice;
    const adminFee = vehiclesConfig.stnkAdminFee;
    const totalCost = basePrice + adminFee;
    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);

    const charRef = db.collection('characters').doc(uid);
    const accRef = db.collection('accounts').doc(uid);
    const treasuryRef = db.collection('state').doc('treasury');
    const ownedSnapPre = await db.collection('vehicles').where('ownerId', '==', uid).limit(6).get();
    if (ownedSnapPre.size >= vehiclesConfig.maxOwnedVehiclesPerPlayer) {
      throw new HttpsError(
        'failed-precondition',
        `Maksimal kepemilikan ${vehiclesConfig.maxOwnedVehiclesPerPlayer} kendaraan per warga.`
      );
    }

    const vehicleId = `veh_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;
    const vehRef = db.collection('vehicles').doc(vehicleId);

    const outcome = await db.runTransaction(async (tx) => {
      const [charDoc, accDoc, treasuryDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(accRef),
        tx.get(treasuryRef),
      ]);
      if (!charDoc.exists) throw new HttpsError('not-found', 'Karakter belum ditemukan.');
      const charData = charDoc.data()!;
      if (charData.sentence?.active) {
        throw new HttpsError('failed-precondition', 'Tidak bisa membeli kendaraan saat ditahan.');
      }

      const wallet = Number(charData.money || 0);
      const bankBal = accDoc.exists ? Number(accDoc.data()!.balance || 0) : 0;
      if (useBank) {
        if (!accDoc.exists) throw new HttpsError('failed-precondition', 'Rekening bank belum dibuka.');
        if (bankBal < totalCost) {
          throw new HttpsError('failed-precondition', `Saldo bank kurang (butuh Rp ${totalCost.toLocaleString('id-ID')}).`);
        }
      } else if (wallet < totalCost) {
        throw new HttpsError('failed-precondition', `Uang tunai kurang (butuh Rp ${totalCost.toLocaleString('id-ID')}).`);
      }

      const { plateNumber } = await allocateUniquePlateTx(tx, db, uid, vehicleId, nowMs);
      const spawn = defaultDealerSpawn(dealerId);
      const initCondition = isUsed ? 78 : 100;
      const initOdo = isUsed ? 140 : 0;

      if (useBank) {
        tx.update(accRef, { balance: bankBal - totalCost, updatedAtMs: nowMs });
      } else {
        tx.update(charRef, { money: wallet - totalCost });
      }
      tx.update(charRef, {
        ownedVehicleCount: ownedSnapPre.size + 1,
        updatedAt: now,
      });

      const vehicleDoc = {
        id: vehicleId,
        ownerId: uid,
        ownerName: String(charData.name || 'Warga'),
        modelId: model.id,
        category: model.category,
        name: model.name,
        plateNumber,
        color: reqColor,
        condition: initCondition,
        odometerKm: initOdo,
        fuel: model.tankCapacity,
        fuelCapacity: model.tankCapacity,
        isElectric: Boolean(model.isElectric),
        registeredAtMs: nowMs,
        stnkExpiresAtMs: nowMs + vehiclesConfig.stnkPeriodMs,
        taxLastPaidAtMs: nowMs,
        lastMaintenanceAtMs: nowMs,
        lastWearAtMs: nowMs,
        insuranceId: null,
        hasInsurance: false,
        leaseId: null,
        garagePropertyId: null,
        parkedPos: { x: spawn.x, y: spawn.y, z: spawn.z, rotY: 0, zone: 'cicalengka' },
        parkedType: 'dealer',
        status: 'parked',
        driverId: null,
        passengerIds: [],
        isPublicActive: false,
        accessories: [],
        purchasePrice: basePrice,
        isUsed,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      };
      tx.set(vehRef, vehicleDoc);

      applyTreasuryCredit(tx, db, treasuryDoc, adminFee, 'vehicle', nowMs);
      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'beli_kendaraan',
        amount: totalCost,
        balanceAfter: useBank ? wallet : wallet - totalCost,
        description: `Beli ${model.name} (${plateNumber})${isUsed ? ' Bekas' : ''}`,
        nowMs,
      });
      appendLedger(tx, db, {
        from: uid,
        to: `dealer:${dealerId}`,
        amount: basePrice,
        taxAmount: adminFee,
        reason: 'buy_vehicle_cash',
        refId: vehicleId,
        nowMs,
      });

      return { vehicle: vehicleDoc, money: useBank ? wallet : wallet - totalCost };
    });

    return { ok: true, ...outcome };
  }
);

/**
 * 2. buyVehicleOnCredit: Beli kendaraan dengan kredit/leasing Bank Priangan.
 */
export const buyVehicleOnCredit = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensureVehicleConfigs();

    const uid = request.auth.uid;
    const nowMs = Date.now();
    await syncLazyVehicleState(db, uid, nowMs);

    const data = request.data as {
      dealerId?: string;
      modelId?: string;
      color?: string;
      downPaymentRate?: number;
      termCycles?: number;
    };

    const dealerId = typeof data?.dealerId === 'string' ? data.dealerId.trim() : '';
    const modelId = typeof data?.modelId === 'string' ? data.modelId.trim() : '';
    const dealer = getDealerCfg(dealerId);
    const model = getVehicleModel(modelId);
    if (!dealer || !model || !model.sellable || !dealer.modelIds.includes(model.id)) {
      throw new HttpsError('invalid-argument', 'Dealer atau model kendaraan tidak valid.');
    }

    const reqColor = typeof data?.color === 'string' && HEX_COLOR_RE.test(data.color)
      ? data.color.toUpperCase()
      : model.colors[0];
    if (!model.colors.some((c) => c.toUpperCase() === reqColor)) {
      throw new HttpsError('invalid-argument', 'Warna kendaraan tidak valid.');
    }

    const basePrice = dealer.isUsed
      ? Math.round(((model.usedPriceMin + model.usedPriceMax) / 2) / 500) * 500
      : model.newPrice;
    const quote = computeLazyLeaseQuote(
      basePrice,
      Number(data?.downPaymentRate ?? 0.3),
      Number(data?.termCycles ?? 6)
    );
    if (!quote) {
      throw new HttpsError('invalid-argument', 'Parameter DP atau tenor leasing tidak valid.');
    }

    const [ownedSnapPre, activeLeaseSnapPre] = await Promise.all([
      db.collection('vehicles').where('ownerId', '==', uid).limit(6).get(),
      db.collection('vehicle_leases').where('borrowerId', '==', uid).where('status', '==', 'active').limit(4).get(),
    ]);
    if (ownedSnapPre.size >= vehiclesConfig.maxOwnedVehiclesPerPlayer) {
      throw new HttpsError('failed-precondition', 'Slot garasi penuh.');
    }
    if (activeLeaseSnapPre.size >= dealerConfig.leasing.maxActiveLeases) {
      throw new HttpsError('failed-precondition', 'Batas maksimum kontrak leasing aktif tercapai.');
    }

    const charRef = db.collection('characters').doc(uid);
    const accRef = db.collection('accounts').doc(uid);
    const treasuryRef = db.collection('state').doc('treasury');
    const vehicleId = `veh_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;
    const leaseId = `vlease_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;
    const vehRef = db.collection('vehicles').doc(vehicleId);
    const leaseRef = db.collection('vehicle_leases').doc(leaseId);
    const now = Timestamp.fromMillis(nowMs);

    const outcome = await db.runTransaction(async (tx) => {
      const [charDoc, accDoc, treasuryDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(accRef),
        tx.get(treasuryRef),
      ]);
      if (!charDoc.exists) throw new HttpsError('not-found', 'Karakter belum ditemukan.');
      const charData = charDoc.data()!;
      const creditScore = Number(
        accDoc.exists ? accDoc.data()!.creditScore : charData.creditScore ?? 70
      );
      if (creditScore < dealerConfig.leasing.minCreditScore) {
        throw new HttpsError(
          'failed-precondition',
          `Skor kredit minimal ${dealerConfig.leasing.minCreditScore} diperlukan untuk leasing.`
        );
      }
      if (Number(charData.completedShifts || 0) < dealerConfig.leasing.minCompletedShifts) {
        throw new HttpsError(
          'failed-precondition',
          `Minimal ${dealerConfig.leasing.minCompletedShifts} shift kerja selesai untuk kredit kendaraan.`
        );
      }
      if (Number(charData.wantedLevel || 0) > dealerConfig.leasing.maxWantedLevelAllowed) {
        throw new HttpsError('failed-precondition', 'Pengajuan leasing ditolak karena status buron aktif.');
      }
      const wallet = Number(charData.money || 0);
      if (wallet < quote.upfrontTotal) {
        throw new HttpsError(
          'failed-precondition',
          `Uang tunai DP + admin kurang (butuh Rp ${quote.upfrontTotal.toLocaleString('id-ID')}).`
        );
      }

      const { plateNumber } = await allocateUniquePlateTx(tx, db, uid, vehicleId, nowMs);
      const spawn = defaultDealerSpawn(dealerId);
      const nextMoney = wallet - quote.upfrontTotal;

      tx.update(charRef, {
        money: nextMoney,
        ownedVehicleCount: ownedSnapPre.size + 1,
        updatedAt: now,
      });

      const vehicleDoc = {
        id: vehicleId,
        ownerId: uid,
        ownerName: String(charData.name || 'Warga'),
        modelId: model.id,
        category: model.category,
        name: model.name,
        plateNumber,
        color: reqColor,
        condition: dealer.isUsed ? 80 : 100,
        odometerKm: dealer.isUsed ? 120 : 0,
        fuel: model.tankCapacity,
        fuelCapacity: model.tankCapacity,
        isElectric: Boolean(model.isElectric),
        registeredAtMs: nowMs,
        stnkExpiresAtMs: nowMs + vehiclesConfig.stnkPeriodMs,
        taxLastPaidAtMs: nowMs,
        lastMaintenanceAtMs: nowMs,
        lastWearAtMs: nowMs,
        insuranceId: null,
        hasInsurance: false,
        leaseId,
        garagePropertyId: null,
        parkedPos: { x: spawn.x, y: spawn.y, z: spawn.z, rotY: 0, zone: 'cicalengka' },
        parkedType: 'dealer',
        status: 'parked',
        driverId: null,
        passengerIds: [],
        isPublicActive: false,
        accessories: [],
        purchasePrice: basePrice,
        isUsed: dealer.isUsed,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      };
      tx.set(vehRef, vehicleDoc);

      const leaseDoc = {
        id: leaseId,
        borrowerId: uid,
        borrowerName: String(charData.name || 'Warga'),
        vehicleId,
        modelId: model.id,
        vehicleName: model.name,
        vehiclePrice: basePrice,
        downPayment: quote.downPayment,
        principal: quote.principal,
        rate: quote.interestRatePerTerm,
        termCycles: quote.termCycles,
        paidCycles: 0,
        installment: quote.installment,
        remaining: quote.totalRepayment,
        nextDueAtMs: nowMs + dealerConfig.leasing.cycleMs,
        missedCount: 0,
        status: 'active',
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      };
      tx.set(leaseRef, leaseDoc);

      applyTreasuryCredit(tx, db, treasuryDoc, quote.adminAndPlateFee, 'vehicle', nowMs);
      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'dp_leasing',
        amount: quote.upfrontTotal,
        balanceAfter: nextMoney,
        description: `DP Kredit ${model.name} (${plateNumber})`,
        nowMs,
      });
      appendLedger(tx, db, {
        from: uid,
        to: 'system:bank',
        amount: quote.downPayment,
        taxAmount: quote.adminAndPlateFee,
        reason: 'vehicle_lease_downpayment',
        refId: leaseId,
        nowMs,
      });

      return { vehicle: vehicleDoc, lease: leaseDoc, money: nextMoney };
    });

    return { ok: true, ...outcome };
  }
);

/**
 * 3. sellVehicle: Jual kendaraan ke dealer bekas sesuai penyusutan nilai & lunasi sisa leasing bila ada.
 */
export const sellVehicle = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensureVehicleConfigs();

    const uid = request.auth.uid;
    const data = request.data as { vehicleId?: string };
    const vehicleId = typeof data?.vehicleId === 'string' ? data.vehicleId.trim() : '';
    if (!SAFE_ID_RE.test(vehicleId)) {
      throw new HttpsError('invalid-argument', 'ID kendaraan tidak valid.');
    }

    const nowMs = Date.now();
    const charRef = db.collection('characters').doc(uid);
    const vehRef = db.collection('vehicles').doc(vehicleId);

    const res = await db.runTransaction(async (tx) => {
      const [charDoc, vehDoc] = await Promise.all([tx.get(charRef), tx.get(vehRef)]);
      if (!charDoc.exists || !vehDoc.exists) {
        throw new HttpsError('not-found', 'Kendaraan atau karakter tidak ditemukan.');
      }
      const v = vehDoc.data()!;
      if (v.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan kendaraan milikmu.');
      if (v.status === 'driving' || v.status === 'listed' || v.status === 'auctioning') {
        throw new HttpsError('failed-precondition', 'Parkir & batalkan listing sebelum menjual kendaraan.');
      }

      const leaseRef = v.leaseId ? db.collection('vehicle_leases').doc(String(v.leaseId)) : null;
      const leaseDoc = leaseRef ? await tx.get(leaseRef) : null;

      const model = getVehicleModel(String(v.modelId));
      if (!model) throw new HttpsError('failed-precondition', 'Model kendaraan tidak dikenal.');

      const marketValue = computeLazyMarketValue(
        model,
        {
          condition: Number(v.condition || 80),
          odometerKm: Number(v.odometerKm || 0),
          createdAtMs: Number(v.createdAtMs || nowMs),
        },
        nowMs
      );
      const payout = Math.round((marketValue * 0.68) / 500) * 500;
      const leaseRemaining =
        leaseDoc?.exists && leaseDoc.data()!.status === 'active'
          ? Number(leaseDoc.data()!.remaining || 0)
          : 0;
      if (payout < leaseRemaining) {
        throw new HttpsError(
          'failed-precondition',
          `Nilai jual (Rp ${payout.toLocaleString('id-ID')}) belum menutupi sisa leasing (Rp ${leaseRemaining.toLocaleString('id-ID')}).`
        );
      }

      const netCash = payout - leaseRemaining;
      const nextMoney = Number(charDoc.data()!.money || 0) + netCash;
      const curOwned = Number(charDoc.data()!.ownedVehicleCount || 1);

      tx.update(charRef, {
        money: nextMoney,
        ownedVehicleCount: Math.max(0, curOwned - 1),
        ...(charDoc.data()!.drivingVehicleId === vehicleId ? { drivingVehicleId: null } : {}),
        updatedAt: Timestamp.fromMillis(nowMs),
      });
      if (leaseDoc?.exists && leaseRef && leaseRemaining > 0) {
        tx.update(leaseRef, { remaining: 0, status: 'paid', updatedAtMs: nowMs });
      }
      const plateKey = normalizePlateKey(String(v.plateNumber || ''));
      if (plateKey) tx.delete(db.collection('vehicle_plates').doc(plateKey));
      tx.delete(vehRef);

      appendTransaction(tx, db, uid, {
        type: 'income',
        category: 'jual_kendaraan',
        amount: netCash,
        balanceAfter: nextMoney,
        description: `Jual ${model.name} (${String(v.plateNumber)}) ke dealer`,
        nowMs,
      });
      appendLedger(tx, db, {
        from: 'dealer:used',
        to: uid,
        amount: netCash,
        reason: 'sell_vehicle_dealer',
        refId: vehicleId,
        nowMs,
      });

      return { payout, leasePayoff: leaseRemaining, netCash, money: nextMoney };
    });

    await safeRtdbRemove(`vehicles/${vehicleId}`);
    return { ok: true, ...res };
  }
);

/**
 * 4. tradeInVehicle: Tukar tambah kendaraan lama untuk membeli unit baru di dealer.
 */
export const tradeInVehicle = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensureVehicleConfigs();

    const uid = request.auth.uid;
    const data = request.data as {
      tradeInVehicleId?: string;
      dealerId?: string;
      targetModelId?: string;
      color?: string;
    };

    const oldId = typeof data?.tradeInVehicleId === 'string' ? data.tradeInVehicleId.trim() : '';
    const dealerId = typeof data?.dealerId === 'string' ? data.dealerId.trim() : '';
    const targetModelId = typeof data?.targetModelId === 'string' ? data.targetModelId.trim() : '';
    const dealer = getDealerCfg(dealerId);
    const targetModel = getVehicleModel(targetModelId);
    if (!SAFE_ID_RE.test(oldId) || !dealer || !targetModel || !targetModel.sellable || !dealer.modelIds.includes(targetModel.id)) {
      throw new HttpsError('invalid-argument', 'Data tukar tambah tidak valid.');
    }

    const reqColor = typeof data?.color === 'string' && HEX_COLOR_RE.test(data.color)
      ? data.color.toUpperCase()
      : targetModel.colors[0];
    const nowMs = Date.now();
    const newId = `veh_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;

    const res = await db.runTransaction(async (tx) => {
      const charRef = db.collection('characters').doc(uid);
      const oldRef = db.collection('vehicles').doc(oldId);
      const newRef = db.collection('vehicles').doc(newId);
      const treasuryRef = db.collection('state').doc('treasury');

      const [charDoc, oldDoc, treasuryDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(oldRef),
        tx.get(treasuryRef),
      ]);
      if (!charDoc.exists || !oldDoc.exists) {
        throw new HttpsError('not-found', 'Karakter atau kendaraan lama tidak ditemukan.');
      }

      const oldV = oldDoc.data()!;
      if (oldV.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik kendaraan lama.');
      if (oldV.status === 'driving' || oldV.status === 'listed' || oldV.leaseId) {
        throw new HttpsError('failed-precondition', 'Kendaraan leasing/sedang dipakai/listing tidak bisa tukar tambah.');
      }
      if (Number(oldV.condition || 0) < dealerConfig.tradeIn.minConditionAccepted) {
        throw new HttpsError('failed-precondition', 'Kondisi kendaraan terlalu rusak untuk tukar tambah.');
      }
      if (Number(oldV.odometerKm || 0) > dealerConfig.tradeIn.maxOdometerKmAccepted) {
        throw new HttpsError('failed-precondition', 'Odometer melebihi batas tukar tambah.');
      }

      const oldModel = getVehicleModel(String(oldV.modelId));
      const oldMarket = oldModel
        ? computeLazyMarketValue(
            oldModel,
            {
              condition: Number(oldV.condition || 70),
              odometerKm: Number(oldV.odometerKm || 0),
              createdAtMs: Number(oldV.createdAtMs || nowMs),
            },
            nowMs
          )
        : 40000;
      const tradeInCredit = Math.round((oldMarket * dealerConfig.tradeIn.valuationRatio) / 500) * 500;

      const targetBasePrice = dealer.isUsed
        ? Math.round(((targetModel.usedPriceMin + targetModel.usedPriceMax) / 2) / 500) * 500
        : targetModel.newPrice;
      const adminFee = vehiclesConfig.stnkAdminFee;
      const netCost = Math.max(adminFee, targetBasePrice + adminFee - tradeInCredit);

      const wallet = Number(charDoc.data()!.money || 0);
      if (wallet < netCost) {
        throw new HttpsError(
          'failed-precondition',
          `Uang tambah kurang (butuh Rp ${netCost.toLocaleString('id-ID')} setelah potong tukar tambah Rp ${tradeInCredit.toLocaleString('id-ID')}).`
        );
      }

      const { plateNumber } = await allocateUniquePlateTx(tx, db, uid, newId, nowMs);
      const oldPlateKey = normalizePlateKey(String(oldV.plateNumber || ''));
      if (oldPlateKey) tx.delete(db.collection('vehicle_plates').doc(oldPlateKey));
      tx.delete(oldRef);

      const spawn = defaultDealerSpawn(dealerId);
      const newVehicle = {
        id: newId,
        ownerId: uid,
        ownerName: String(charDoc.data()!.name || 'Warga'),
        modelId: targetModel.id,
        category: targetModel.category,
        name: targetModel.name,
        plateNumber,
        color: reqColor,
        condition: dealer.isUsed ? 80 : 100,
        odometerKm: dealer.isUsed ? 110 : 0,
        fuel: targetModel.tankCapacity,
        fuelCapacity: targetModel.tankCapacity,
        isElectric: Boolean(targetModel.isElectric),
        registeredAtMs: nowMs,
        stnkExpiresAtMs: nowMs + vehiclesConfig.stnkPeriodMs,
        taxLastPaidAtMs: nowMs,
        lastMaintenanceAtMs: nowMs,
        lastWearAtMs: nowMs,
        leaseId: null,
        garagePropertyId: null,
        parkedPos: { x: spawn.x, y: spawn.y, z: spawn.z, rotY: 0, zone: 'cicalengka' },
        parkedType: 'dealer',
        status: 'parked',
        driverId: null,
        passengerIds: [],
        isPublicActive: false,
        accessories: [],
        purchasePrice: targetBasePrice,
        isUsed: dealer.isUsed,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      };
      tx.set(newRef, newVehicle);

      const nextMoney = wallet - netCost;
      tx.update(charRef, { money: nextMoney, updatedAt: Timestamp.fromMillis(nowMs) });
      applyTreasuryCredit(tx, db, treasuryDoc, adminFee, 'vehicle', nowMs);
      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'tukar_tambah',
        amount: netCost,
        balanceAfter: nextMoney,
        description: `Tukar tambah ${String(oldV.name)} -> ${targetModel.name} (${plateNumber})`,
        nowMs,
      });
      appendLedger(tx, db, {
        from: uid,
        to: `dealer:${dealerId}`,
        amount: netCost,
        taxAmount: adminFee,
        reason: 'trade_in_vehicle',
        refId: newId,
        nowMs,
      });

      return { newVehicle, tradeInCredit, netCost, money: nextMoney };
    });

    await safeRtdbRemove(`vehicles/${oldId}`);
    return { ok: true, ...res };
  }
);

/**
 * 5. listVehicleForSale: Pasang atau batalkan listing kendaraan P2P / Dealer Pemain (escrow aman).
 */
export const listVehicleForSale = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensureVehicleConfigs();

    const uid = request.auth.uid;
    const data = request.data as {
      action?: 'create' | 'cancel';
      vehicleId?: string;
      listingId?: string;
      price?: number;
      businessId?: string;
    };

    const action = data?.action === 'cancel' ? 'cancel' : 'create';
    const nowMs = Date.now();

    if (action === 'cancel') {
      const listingId = typeof data?.listingId === 'string' ? data.listingId.trim() : '';
      if (!SAFE_ID_RE.test(listingId)) throw new HttpsError('invalid-argument', 'ID listing tidak valid.');

      const result = await db.runTransaction(async (tx) => {
        const listRef = db.collection('vehicle_listings').doc(listingId);
        const listDoc = await tx.get(listRef);
        if (!listDoc.exists) throw new HttpsError('not-found', 'Listing tidak ditemukan.');
        const ld = listDoc.data()!;
        if (ld.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik listing.');
        if (ld.status !== 'active') throw new HttpsError('failed-precondition', 'Listing tidak aktif.');
        const vehRef = db.collection('vehicles').doc(String(ld.vehicleId));
        const vehDoc = await tx.get(vehRef);

        tx.update(listRef, { status: 'cancelled', updatedAtMs: nowMs });
        if (vehDoc.exists) {
          tx.update(vehRef, { status: 'parked', activeListingId: null, updatedAtMs: nowMs });
        }
        return { listingId };
      });
      return { ok: true, ...result };
    }

    const vehicleId = typeof data?.vehicleId === 'string' ? data.vehicleId.trim() : '';
    const askPrice = Math.round(Number(data?.price || 0));
    const businessId = typeof data?.businessId === 'string' && SAFE_ID_RE.test(data.businessId) ? data.businessId : null;
    if (!SAFE_ID_RE.test(vehicleId) || !Number.isFinite(askPrice) || askPrice < 10000) {
      throw new HttpsError('invalid-argument', 'Harga jual tidak valid.');
    }

    const listingId = `vlist_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;
    const result = await db.runTransaction(async (tx) => {
      const charRef = db.collection('characters').doc(uid);
      const vehRef = db.collection('vehicles').doc(vehicleId);
      const bizRef = businessId ? db.collection('businesses').doc(businessId) : null;

      const [charDoc, vehDoc, bizDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(vehRef),
        bizRef ? tx.get(bizRef) : Promise.resolve(null),
      ]);
      if (!charDoc.exists || !vehDoc.exists) {
        throw new HttpsError('not-found', 'Karakter atau kendaraan tidak ditemukan.');
      }

      const v = vehDoc.data()!;
      if (v.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan kendaraan milikmu.');
      if (v.status !== 'parked' || v.leaseId) {
        throw new HttpsError('failed-precondition', 'Kendaraan harus dalam kondisi terparkir & bebas leasing.');
      }
      if (bizDoc) {
        if (!bizDoc.exists || bizDoc.data()!.ownerId !== uid || bizDoc.data()!.type !== 'dealer') {
          throw new HttpsError('failed-precondition', 'Bisnis dealer tidak valid atau bukan milikmu.');
        }
      }

      const model = getVehicleModel(String(v.modelId));
      const marketValue = model
        ? computeLazyMarketValue(
            model,
            {
              condition: Number(v.condition || 80),
              odometerKm: Number(v.odometerKm || 0),
              createdAtMs: Number(v.createdAtMs || nowMs),
            },
            nowMs
          )
        : askPrice;
      const minPrice = Math.round(marketValue * dealerConfig.marketplace.minPriceRatio);
      const maxPrice = Math.round(marketValue * dealerConfig.marketplace.maxPriceRatio);
      if (askPrice < minPrice || askPrice > maxPrice) {
        throw new HttpsError(
          'invalid-argument',
          `Harga harus di kisaran Rp ${minPrice.toLocaleString('id-ID')} - Rp ${maxPrice.toLocaleString('id-ID')}.`
        );
      }

      const listingFee = dealerConfig.marketplace.listingFee;
      const wallet = Number(charDoc.data()!.money || 0);
      if (wallet < listingFee) {
        throw new HttpsError('failed-precondition', `Saldo kurang untuk biaya listing Rp ${listingFee.toLocaleString('id-ID')}.`);
      }
      const nextMoney = wallet - listingFee;

      const listingDoc = {
        id: listingId,
        vehicleId,
        ownerId: uid,
        ownerName: String(charDoc.data()!.name || 'Warga'),
        sellerBusinessId: businessId,
        modelId: String(v.modelId),
        vehicleName: String(v.name || model?.name || v.modelId),
        category: v.category,
        plateNumber: String(v.plateNumber),
        color: String(v.color),
        condition: Number(v.condition || 80),
        odometerKm: Number(v.odometerKm || 0),
        price: askPrice,
        status: 'active',
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      };
      tx.set(db.collection('vehicle_listings').doc(listingId), listingDoc);
      tx.update(vehRef, { status: 'listed', activeListingId: listingId, updatedAtMs: nowMs });
      tx.update(charRef, { money: nextMoney, updatedAt: Timestamp.fromMillis(nowMs) });
      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'listing_kendaraan',
        amount: listingFee,
        balanceAfter: nextMoney,
        description: `Pasang iklan jual ${String(v.name)}`,
        nowMs,
      });

      return { listing: listingDoc, money: nextMoney };
    });

    return { ok: true, ...result };
  }
);

/**
 * 6. transferVehicle: Beli kendaraan dari marketplace/dealer pemain (escrow + balik nama).
 */
export const transferVehicle = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensureVehicleConfigs();

    const buyerUid = request.auth.uid;
    const data = request.data as { listingId?: string };
    const listingId = typeof data?.listingId === 'string' ? data.listingId.trim() : '';
    if (!SAFE_ID_RE.test(listingId)) throw new HttpsError('invalid-argument', 'ID listing tidak valid.');

    const buyerVehiclesPre = await db.collection('vehicles').where('ownerId', '==', buyerUid).limit(6).get();
    if (buyerVehiclesPre.size >= vehiclesConfig.maxOwnedVehiclesPerPlayer) {
      throw new HttpsError('failed-precondition', 'Garasi pembeli sudah penuh.');
    }

    const nowMs = Date.now();
    const res = await db.runTransaction(async (tx) => {
      const listRef = db.collection('vehicle_listings').doc(listingId);
      const listDoc = await tx.get(listRef);
      if (!listDoc.exists) throw new HttpsError('not-found', 'Listing kendaraan tidak ditemukan.');
      const ld = listDoc.data()!;
      if (ld.status !== 'active') throw new HttpsError('failed-precondition', 'Listing sudah terjual atau dibatalkan.');
      const sellerUid = String(ld.ownerId);
      if (sellerUid === buyerUid) throw new HttpsError('failed-precondition', 'Tidak bisa membeli kendaraan sendiri.');

      const buyerRef = db.collection('characters').doc(buyerUid);
      const sellerRef = db.collection('characters').doc(sellerUid);
      const vehRef = db.collection('vehicles').doc(String(ld.vehicleId));
      const treasuryRef = db.collection('state').doc('treasury');
      const bizRef = ld.sellerBusinessId ? db.collection('businesses').doc(String(ld.sellerBusinessId)) : null;

      const [buyerDoc, sellerDoc, vehDoc, treasuryDoc, bizDoc] = await Promise.all([
        tx.get(buyerRef),
        tx.get(sellerRef),
        tx.get(vehRef),
        tx.get(treasuryRef),
        bizRef ? tx.get(bizRef) : Promise.resolve(null),
      ]);
      if (!buyerDoc.exists || !sellerDoc.exists || !vehDoc.exists) {
        throw new HttpsError('not-found', 'Data pembeli, penjual, atau kendaraan hilang.');
      }

      const price = Number(ld.price || 0);
      const transferTax = Math.round(price * dealerConfig.marketplace.titleTransferTaxRate);
      const escrowFee = Math.round(price * dealerConfig.marketplace.escrowFeeRate);
      const buyerTotal = price + transferTax;
      const sellerNet = Math.max(0, price - escrowFee);

      const buyerMoney = Number(buyerDoc.data()!.money || 0);
      if (buyerMoney < buyerTotal) {
        throw new HttpsError(
          'failed-precondition',
          `Uang kurang (butuh Rp ${buyerTotal.toLocaleString('id-ID')} termasuk balik nama 3%).`
        );
      }

      const buyerNext = buyerMoney - buyerTotal;
      tx.update(buyerRef, {
        money: buyerNext,
        ownedVehicleCount: buyerVehiclesPre.size + 1,
        updatedAt: Timestamp.fromMillis(nowMs),
      });

      const sellerCurOwned = Number(sellerDoc.data()!.ownedVehicleCount || 1);
      if (bizDoc?.exists && bizRef) {
        tx.update(bizRef, {
          cash: Number(bizDoc.data()!.cash || 0) + sellerNet,
          totalRevenue: Number(bizDoc.data()!.totalRevenue || 0) + sellerNet,
          updatedAtMs: nowMs,
        });
        tx.update(sellerRef, {
          ownedVehicleCount: Math.max(0, sellerCurOwned - 1),
          updatedAt: Timestamp.fromMillis(nowMs),
        });
      } else {
        const sellerNext = Number(sellerDoc.data()!.money || 0) + sellerNet;
        tx.update(sellerRef, {
          money: sellerNext,
          ownedVehicleCount: Math.max(0, sellerCurOwned - 1),
          updatedAt: Timestamp.fromMillis(nowMs),
        });
        appendTransaction(tx, db, sellerUid, {
          type: 'income',
          category: 'jual_kendaraan',
          amount: sellerNet,
          balanceAfter: sellerNext,
          description: `Terjual ${String(ld.vehicleName)} (${String(ld.plateNumber)})`,
          nowMs,
        });
      }

      tx.update(vehRef, {
        ownerId: buyerUid,
        ownerName: String(buyerDoc.data()!.name || 'Warga'),
        status: 'parked',
        activeListingId: null,
        registeredAtMs: nowMs,
        updatedAtMs: nowMs,
      });
      tx.update(listRef, { status: 'sold', buyerId: buyerUid, soldAtMs: nowMs, updatedAtMs: nowMs });

      applyTreasuryCredit(tx, db, treasuryDoc, transferTax + escrowFee, 'vehicle', nowMs);
      appendTransaction(tx, db, buyerUid, {
        type: 'expense',
        category: 'beli_kendaraan',
        amount: buyerTotal,
        balanceAfter: buyerNext,
        description: `Beli & balik nama ${String(ld.vehicleName)} (${String(ld.plateNumber)})`,
        nowMs,
      });
      appendLedger(tx, db, {
        from: buyerUid,
        to: sellerUid,
        amount: price,
        taxAmount: transferTax + escrowFee,
        reason: 'transfer_vehicle_escrow',
        refId: String(ld.vehicleId),
        nowMs,
      });

      return { vehicleId: String(ld.vehicleId), price, transferTax, money: buyerNext };
    });

    return { ok: true, ...res };
  }
);

/**
 * 7. testDriveStart: Mulai atau akhiri sesi uji coba 2 menit di dealer.
 */
export const testDriveStart = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensureVehicleConfigs();

    const uid = request.auth.uid;
    const data = request.data as {
      action?: 'start' | 'end';
      dealerId?: string;
      modelId?: string;
      color?: string;
      sessionId?: string;
    };
    const nowMs = Date.now();
    const tdRef = db.collection('vehicle_test_drives').doc(uid);
    const tdVehicleId = `td_${uid}`;
    const sessionId =
      typeof data?.sessionId === 'string' && SAFE_ID_RE.test(data.sessionId.trim())
        ? data.sessionId.trim()
        : undefined;

    if (data?.action === 'end') {
      await tdRef.set({ uid, status: 'ended', endedAtMs: nowMs }, { merge: true }).catch(() => {});
      await db.collection('characters').doc(uid).update({ drivingVehicleId: null, updatedAt: Timestamp.fromMillis(nowMs) }).catch(() => {});
      await safeRtdbRemove(`vehicles/${tdVehicleId}`);
      return { ok: true, ended: true };
    }

    const dealerId = typeof data?.dealerId === 'string' ? data.dealerId.trim() : '';
    const modelId = typeof data?.modelId === 'string' ? data.modelId.trim() : '';
    const dealer = getDealerCfg(dealerId);
    const model = getVehicleModel(modelId);
    if (!dealer || !model || !model.sellable || !dealer.modelIds.includes(model.id)) {
      throw new HttpsError('invalid-argument', 'Dealer atau model uji coba tidak valid.');
    }

    const color =
      typeof data?.color === 'string' && HEX_COLOR_RE.test(data.color)
        ? data.color.toUpperCase()
        : model.colors[0];

    const charDoc = await db.collection('characters').doc(uid).get();
    if (!charDoc.exists) throw new HttpsError('not-found', 'Karakter belum ditemukan.');
    const charName = String(charDoc.data()!.name || 'Warga');

    const expiresAtMs = nowMs + dealerConfig.testDrive.durationSec * 1000;
    const spawn = defaultDealerSpawn(dealerId);

    await tdRef.set({
      uid,
      dealerId,
      modelId: model.id,
      color,
      startedAtMs: nowMs,
      expiresAtMs,
      zone: 'cicalengka',
      status: 'active',
    });
    await db.collection('characters').doc(uid).update({
      drivingVehicleId: tdVehicleId,
      updatedAt: Timestamp.fromMillis(nowMs),
    });

    await safeRtdbSet(`vehicles/${tdVehicleId}`, {
      vehicleId: tdVehicleId,
      ownerId: uid,
      driverId: uid,
      driverName: charName,
      modelId: model.id,
      category: model.category,
      color,
      plateNumber: 'D TEST CL',
      zone: 'cicalengka',
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      rotY: 0,
      vx: 0,
      vz: 0,
      speed: 0,
      steerAngle: 0,
      headlights: false,
      turnSignal: 'off',
      hornAtMs: 0,
      maxSpeed: model.maxSpeedMps,
      seatCapacity: model.seats,
      isTestDrive: true,
      ...(sessionId ? { sessionId } : {}),
      updatedAt: nowMs,
    });

    return {
      ok: true,
      vehicleId: tdVehicleId,
      modelId: model.id,
      color,
      expiresAtMs,
      spawnPos: spawn,
    };
  }
);

/**
 * 8. registerVehicle: Registrasi ulang / penerbitan ulang plat nomor & STNK Samsat.
 */
export const registerVehicle = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensureVehicleConfigs();

    const uid = request.auth.uid;
    const data = request.data as { vehicleId?: string };
    const vehicleId = typeof data?.vehicleId === 'string' ? data.vehicleId.trim() : '';
    if (!SAFE_ID_RE.test(vehicleId)) throw new HttpsError('invalid-argument', 'ID kendaraan tidak valid.');

    const nowMs = Date.now();
    const fee = vehiclesConfig.stnkAdminFee;
    const res = await db.runTransaction(async (tx) => {
      const charRef = db.collection('characters').doc(uid);
      const vehRef = db.collection('vehicles').doc(vehicleId);
      const treasuryRef = db.collection('state').doc('treasury');
      const [charDoc, vehDoc, treasuryDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(vehRef),
        tx.get(treasuryRef),
      ]);
      if (!charDoc.exists || !vehDoc.exists) throw new HttpsError('not-found', 'Data tidak ditemukan.');
      const v = vehDoc.data()!;
      if (v.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik kendaraan.');
      const wallet = Number(charDoc.data()!.money || 0);
      if (wallet < fee) throw new HttpsError('failed-precondition', 'Uang tidak cukup untuk biaya administrasi.');

      const oldKey = normalizePlateKey(String(v.plateNumber || ''));
      if (oldKey) tx.delete(db.collection('vehicle_plates').doc(oldKey));
      const { plateNumber } = await allocateUniquePlateTx(tx, db, uid, vehicleId, nowMs);

      const nextMoney = wallet - fee;
      tx.update(charRef, { money: nextMoney, updatedAt: Timestamp.fromMillis(nowMs) });
      tx.update(vehRef, {
        plateNumber,
        registeredAtMs: nowMs,
        stnkExpiresAtMs: nowMs + vehiclesConfig.stnkPeriodMs,
        updatedAtMs: nowMs,
      });

      const logId = `srv_${nowMs}`;
      tx.set(vehRef.collection('service_logs').doc(logId), {
        id: logId,
        vehicleId,
        ownerId: uid,
        serviceType: 'registration',
        providerType: 'samsat',
        cost: fee,
        details: `Registrasi ulang STNK & Plat ${plateNumber}`,
        createdAtMs: nowMs,
      });
      applyTreasuryCredit(tx, db, treasuryDoc, fee, 'vehicle', nowMs);
      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'samsat',
        amount: fee,
        balanceAfter: nextMoney,
        description: `Penerbitan STNK/Plat ${plateNumber}`,
        nowMs,
      });
      return { plateNumber, money: nextMoney };
    });

    return { ok: true, ...res };
  }
);

/**
 * 9. renewRegistration: Perpanjang pajak tahunan STNK (termasuk denda keterlambatan lazy).
 */
export const renewRegistration = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensureVehicleConfigs();

    const uid = request.auth.uid;
    const data = request.data as { vehicleId?: string };
    const vehicleId = typeof data?.vehicleId === 'string' ? data.vehicleId.trim() : '';
    if (!SAFE_ID_RE.test(vehicleId)) throw new HttpsError('invalid-argument', 'ID kendaraan tidak valid.');

    const nowMs = Date.now();
    const res = await db.runTransaction(async (tx) => {
      const charRef = db.collection('characters').doc(uid);
      const vehRef = db.collection('vehicles').doc(vehicleId);
      const treasuryRef = db.collection('state').doc('treasury');
      const [charDoc, vehDoc, treasuryDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(vehRef),
        tx.get(treasuryRef),
      ]);
      if (!charDoc.exists || !vehDoc.exists) throw new HttpsError('not-found', 'Data tidak ditemukan.');
      const v = vehDoc.data()!;
      if (v.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik kendaraan.');
      const model = getVehicleModel(String(v.modelId));
      if (!model) throw new HttpsError('failed-precondition', 'Model kendaraan tidak valid.');

      const stnk = computeLazyStnkStatus(model, Number(v.stnkExpiresAtMs || nowMs), nowMs);
      const wallet = Number(charDoc.data()!.money || 0);
      if (wallet < stnk.totalDue) {
        throw new HttpsError(
          'failed-precondition',
          `Saldo kurang untuk bayar pajak STNK (Rp ${stnk.totalDue.toLocaleString('id-ID')}).`
        );
      }

      const nextMoney = wallet - stnk.totalDue;
      const nextExp = Math.max(nowMs, Number(v.stnkExpiresAtMs || nowMs)) + vehiclesConfig.stnkPeriodMs;
      tx.update(charRef, { money: nextMoney, updatedAt: Timestamp.fromMillis(nowMs) });
      tx.update(vehRef, {
        stnkExpiresAtMs: nextExp,
        taxLastPaidAtMs: nowMs,
        updatedAtMs: nowMs,
      });

      const logId = `srv_${nowMs}`;
      tx.set(vehRef.collection('service_logs').doc(logId), {
        id: logId,
        vehicleId,
        ownerId: uid,
        serviceType: 'registration',
        providerType: 'samsat',
        cost: stnk.totalDue,
        details: `Perpanjang STNK (+denda Rp ${stnk.latePenalty})`,
        createdAtMs: nowMs,
      });
      applyTreasuryCredit(tx, db, treasuryDoc, stnk.totalDue, 'vehicle', nowMs);
      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'pajak_kendaraan',
        amount: stnk.totalDue,
        balanceAfter: nextMoney,
        description: `Pajak STNK ${String(v.plateNumber)}`,
        nowMs,
      });
      appendLedger(tx, db, {
        from: uid,
        to: 'system:treasury',
        amount: stnk.totalDue,
        taxAmount: stnk.totalDue,
        reason: 'stnk_tax_renewal',
        refId: vehicleId,
        nowMs,
      });

      return { stnkExpiresAtMs: nextExp, totalDue: stnk.totalDue, money: nextMoney };
    });

    return { ok: true, ...res };
  }
);

/**
 * 10. takeLicenseExam: Ujian SIM C (motor) atau SIM A (mobil).
 */
export const takeLicenseExam = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensureVehicleConfigs();

    const uid = request.auth.uid;
    const data = request.data as { category?: 'C' | 'A'; answers?: number[] };
    const category = data?.category === 'A' ? 'A' : data?.category === 'C' ? 'C' : null;
    if (!category) throw new HttpsError('invalid-argument', 'Kategori SIM harus C atau A.');

    const cfg = category === 'C' ? vehiclesConfig.licenseSettings.simC : vehiclesConfig.licenseSettings.simA;
    const score = gradeSimExam(category, Array.isArray(data?.answers) ? data.answers : []);
    const passed = score >= cfg.passScore;
    const nowMs = Date.now();

    const res = await db.runTransaction(async (tx) => {
      const charRef = db.collection('characters').doc(uid);
      const licRef = db.collection('driver_licenses').doc(uid);
      const treasuryRef = db.collection('state').doc('treasury');
      const [charDoc, licDoc, treasuryDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(licRef),
        tx.get(treasuryRef),
      ]);
      if (!charDoc.exists) throw new HttpsError('not-found', 'Karakter belum ada.');

      const wallet = Number(charDoc.data()!.money || 0);
      if (wallet < cfg.fee) {
        throw new HttpsError('failed-precondition', `Biaya ujian SIM ${category} Rp ${cfg.fee.toLocaleString('id-ID')}.`);
      }

      const prevLic = licDoc.exists ? licDoc.data()! : { uid, simA: null, simC: null };
      const key = category === 'A' ? 'simA' : 'simC';
      const prevEntry = prevLic[key] as { attempts?: number; licenseNumber?: string } | null;
      const attempts = Number(prevEntry?.attempts || 0) + 1;
      const licenseNumber = passed
        ? prevEntry?.licenseNumber || `SIM${category}-CLG-${String(nowMs).slice(-6)}`
        : prevEntry?.licenseNumber || '';
      const entry = {
        active: passed,
        licenseNumber,
        issuedAtMs: nowMs,
        expiresAtMs: passed ? nowMs + cfg.validMs : 0,
        lastExamScore: score,
        attempts,
      };

      const nextMoney = wallet - cfg.fee;
      tx.set(
        licRef,
        {
          uid,
          simA: key === 'simA' ? entry : prevLic.simA ?? null,
          simC: key === 'simC' ? entry : prevLic.simC ?? null,
          updatedAtMs: nowMs,
        },
        { merge: true }
      );
      tx.update(charRef, {
        money: nextMoney,
        ...(passed ? { [key]: { active: true, issuedAtMs: nowMs, expiresAtMs: entry.expiresAtMs } } : {}),
        updatedAt: Timestamp.fromMillis(nowMs),
      });

      applyTreasuryCredit(tx, db, treasuryDoc, cfg.fee, 'vehicle', nowMs);
      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'ujian_sim',
        amount: cfg.fee,
        balanceAfter: nextMoney,
        description: `Ujian SIM ${category} (Nilai ${score} - ${passed ? 'LULUS' : 'GAGAL'})`,
        nowMs,
      });

      return { passed, score, license: entry, money: nextMoney };
    });

    return { ok: true, ...res };
  }
);

/**
 * 11. mountVehicle: Naik kendaraan (pengemudi atau penumpang) & inisialisasi node RTDB otoritatif server.
 */
export const mountVehicle = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensureVehicleConfigs();

    const uid = request.auth.uid;
    const data = request.data as { vehicleId?: string; asPassenger?: boolean; sessionId?: string };
    const vehicleId = typeof data?.vehicleId === 'string' ? data.vehicleId.trim() : '';
    if (!SAFE_ID_RE.test(vehicleId)) throw new HttpsError('invalid-argument', 'ID kendaraan tidak valid.');

    const sessionId =
      typeof data?.sessionId === 'string' && SAFE_ID_RE.test(data.sessionId.trim())
        ? data.sessionId.trim()
        : undefined;

    const nowMs = Date.now();
    await syncLazyVehicleState(db, uid, nowMs);

    const asPassenger = Boolean(data?.asPassenger);

    // Baca snapshot RTDB kendaraan terlebih dahulu untuk cegah duplikasi sesi & cari kursi kosong penumpang
    let existingRtdb: Record<string, unknown> | null = null;
    try {
      const rtdbSnap = await rtdb.ref(`vehicles/${vehicleId}`).get();
      if (rtdbSnap.exists()) {
        existingRtdb = rtdbSnap.val() as Record<string, unknown>;
      }
    } catch {
      existingRtdb = null;
    }

    if (!asPassenger && existingRtdb) {
      const existingDriver = typeof existingRtdb.driverId === 'string' ? existingRtdb.driverId : null;
      const existingUpdated = Number(existingRtdb.updatedAt || 0);
      const existingSess = typeof existingRtdb.sessionId === 'string' ? existingRtdb.sessionId : undefined;
      if (existingDriver && existingDriver !== uid && nowMs - existingUpdated < 45_000) {
        throw new HttpsError('failed-precondition', 'Kendaraan sedang dikendarai oleh pemain lain.');
      }
      if (
        existingDriver === uid &&
        sessionId &&
        existingSess &&
        existingSess !== sessionId &&
        nowMs - existingUpdated < 12_000
      ) {
        throw new HttpsError(
          'failed-precondition',
          'Kendaraan ini masih aktif di tab atau sesi lain. Tutup sesi lama terlebih dahulu.'
        );
      }
    }

    const res = await db.runTransaction(async (tx) => {
      const charRef = db.collection('characters').doc(uid);
      const vehRef = db.collection('vehicles').doc(vehicleId);
      const [charDoc, vehDoc] = await Promise.all([tx.get(charRef), tx.get(vehRef)]);
      if (!charDoc.exists || !vehDoc.exists) throw new HttpsError('not-found', 'Karakter atau kendaraan tidak ditemukan.');

      const charData = charDoc.data()!;
      const v = vehDoc.data()!;
      if (charData.sentence?.active) throw new HttpsError('failed-precondition', 'Sedang menjalani masa tahanan.');
      if (charData.activeTrip && nowMs < Number(charData.activeTrip.arrivesAtMs || 0)) {
        throw new HttpsError('failed-precondition', 'Sedang berada di kereta.');
      }

      const model = getVehicleModel(String(v.modelId));
      if (!model) throw new HttpsError('failed-precondition', 'Model kendaraan tidak valid.');

      if (v.status === 'impounded' || v.status === 'listed' || v.status === 'auctioning' || v.status === 'in_workshop' || v.status === 'stolen') {
        throw new HttpsError('failed-precondition', `Kendaraan berstatus ${String(v.status)} dan tidak dapat dikendarai.`);
      }

      let allocatedSeat = 0;

      if (!asPassenger) {
        if (v.ownerId !== uid) throw new HttpsError('permission-denied', 'Hanya pemilik yang dapat mengemudikan kendaraan ini.');
        if (Number(v.fuel || 0) <= 0) {
          throw new HttpsError('failed-precondition', 'Bahan bakar / baterai habis! Dorong atau panggil servis SPBU.');
        }
        if (Number(v.condition || 0) <= 5) {
          throw new HttpsError('failed-precondition', 'Mesin mogok berat! Bawa ke bengkel terlebih dahulu.');
        }

        tx.update(vehRef, {
          status: 'driving',
          driverId: uid,
          passengerIds: [],
          isPublicActive: true,
          updatedAtMs: nowMs,
        });
        tx.update(charRef, {
          drivingVehicleId: vehicleId,
          passengerVehicleId: null,
          updatedAt: Timestamp.fromMillis(nowMs),
        });
      } else {
        if (v.status !== 'driving' || !v.driverId) {
          throw new HttpsError('failed-precondition', 'Kendaraan belum memiliki pengemudi aktif.');
        }
        if (v.driverId === uid) {
          throw new HttpsError('failed-precondition', 'Kamu adalah pengemudi kendaraan ini.');
        }
        if (model.seats <= 1) {
          throw new HttpsError('failed-precondition', 'Kendaraan ini tidak memiliki kursi penumpang.');
        }

        const rtdbPassMap = (existingRtdb?.passengers as Record<string, { uid?: string; seatIndex?: number }> | undefined) || {};
        const usedSeats = new Set<number>();
        let existingOwnSeat: number | null = null;
        for (const [puid, pdata] of Object.entries(rtdbPassMap)) {
          if (puid === uid && Number.isFinite(Number(pdata?.seatIndex))) {
            existingOwnSeat = Number(pdata.seatIndex);
          } else if (Number.isFinite(Number(pdata?.seatIndex))) {
            usedSeats.add(Math.floor(Number(pdata.seatIndex)));
          }
        }
        if (existingOwnSeat !== null) {
          allocatedSeat = existingOwnSeat;
        } else {
          let foundSeat: number | null = null;
          for (let s = 1; s < model.seats; s++) {
            if (!usedSeats.has(s)) {
              foundSeat = s;
              break;
            }
          }
          if (foundSeat === null) {
            throw new HttpsError('failed-precondition', 'Kursi penumpang sudah penuh.');
          }
          allocatedSeat = foundSeat;
        }

        const passengers: string[] = Array.isArray(v.passengerIds) ? [...v.passengerIds] : [];
        if (!passengers.includes(uid)) {
          if (passengers.length + 1 >= model.seats) {
            throw new HttpsError('failed-precondition', 'Kursi penumpang sudah penuh.');
          }
          passengers.push(uid);
        }
        tx.update(vehRef, { passengerIds: passengers, updatedAtMs: nowMs });
        tx.update(charRef, {
          drivingVehicleId: null,
          passengerVehicleId: vehicleId,
          updatedAt: Timestamp.fromMillis(nowMs),
        });
      }

      return {
        vehicle: v,
        model,
        charName: String(charData.name || 'Warga'),
        allocatedSeat,
      };
    });

    if (!asPassenger) {
      const pPos = res.vehicle.parkedPos || { x: 0, y: 0.35, z: -20, rotY: 0, zone: 'cicalengka' };
      const rotYRaw = Number(pPos.rotY || 0);
      const twoPi = Math.PI * 2;
      let rotY = rotYRaw % twoPi;
      if (rotY > Math.PI) rotY -= twoPi;
      if (rotY <= -Math.PI) rotY += twoPi;

      await safeRtdbSet(`vehicles/${vehicleId}`, {
        vehicleId,
        ownerId: String(res.vehicle.ownerId),
        driverId: uid,
        driverName: res.charName,
        modelId: res.model.id,
        category: res.model.category,
        color: String(res.vehicle.color),
        plateNumber: String(res.vehicle.plateNumber),
        zone: String(pPos.zone || 'cicalengka'),
        x: Number(pPos.x || 0),
        y: Number(pPos.y || 0.35),
        z: Number(pPos.z || -20),
        rotY,
        vx: 0,
        vz: 0,
        speed: 0,
        steerAngle: 0,
        headlights: false,
        turnSignal: 'off',
        hornAtMs: 0,
        maxSpeed: res.model.maxSpeedMps,
        seatCapacity: res.model.seats,
        isTestDrive: false,
        ...(sessionId ? { sessionId } : {}),
        updatedAt: nowMs,
      });
    } else {
      await safeRtdbSet(`vehicles/${vehicleId}/passengers/${uid}`, {
        uid,
        name: res.charName,
        seatIndex: res.allocatedSeat,
        joinedAt: nowMs,
      });
    }

    return {
      ok: true,
      vehicleId,
      asPassenger,
      maxSpeedMps: res.model.maxSpeedMps,
      seatIndex: res.allocatedSeat,
    };
  }
);

/**
 * 12. dismountVehicle / parkVehicle: Turun atau parkir kendaraan, hitung fuel & keausan lazy, simpan posisi ke Firestore.
 */
export const parkVehicle = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensureVehicleConfigs();

    const uid = request.auth.uid;
    const data = request.data as {
      vehicleId?: string;
      x?: number;
      y?: number;
      z?: number;
      rotY?: number;
      parkedType?: 'garage' | 'parking_lot' | 'roadside';
      garagePropertyId?: string | null;
      distanceKm?: number;
      terrainType?: 'road' | 'offroad';
      crashDamage?: number;
    };

    const vehicleId = typeof data?.vehicleId === 'string' ? data.vehicleId.trim() : '';
    if (!SAFE_ID_RE.test(vehicleId)) throw new HttpsError('invalid-argument', 'ID kendaraan tidak valid.');

    const safePos = clampWorldPos({
      x: Number(data?.x ?? 0),
      y: Number(data?.y ?? 0.35),
      z: Number(data?.z ?? -20),
      rotY: Number(data?.rotY ?? 0),
    });
    const parkedType =
      data?.parkedType === 'garage' || data?.parkedType === 'parking_lot' ? data.parkedType : 'roadside';
    const garagePropId =
      parkedType === 'garage' && typeof data?.garagePropertyId === 'string' && SAFE_ID_RE.test(data.garagePropertyId)
        ? data.garagePropertyId
        : null;
    const crashDamage = Math.max(0, Math.min(35, Number(data?.crashDamage || 0)));
    const nowMs = Date.now();

    const res = await db.runTransaction(async (tx) => {
      const charRef = db.collection('characters').doc(uid);
      const vehRef = db.collection('vehicles').doc(vehicleId);
      const propRef = garagePropId ? db.collection('properties').doc(garagePropId) : null;
      const [charDoc, vehDoc, propDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(vehRef),
        propRef ? tx.get(propRef) : Promise.resolve(null),
      ]);
      if (!charDoc.exists || !vehDoc.exists) throw new HttpsError('not-found', 'Data tidak ditemukan.');
      const v = vehDoc.data()!;
      if (v.ownerId !== uid && v.driverId !== uid) {
        throw new HttpsError('permission-denied', 'Bukan pengemudi kendaraan ini.');
      }

      if (propDoc) {
        if (!propDoc.exists || propDoc.data()!.ownerId !== uid || !propDoc.data()!.hasGarage) {
          throw new HttpsError('failed-precondition', 'Properti tidak memiliki garasi atau bukan milikmu.');
        }
      }

      const model = getVehicleModel(String(v.modelId));
      const elapsedSec = Math.max(1, (nowMs - Number(v.updatedAtMs || nowMs)) / 1000);
      const maxReasonableKm = ((model?.maxSpeedMps ?? 25) * elapsedSec * 1.25) / 1000;
      const reportedKm = Math.max(0, Number(data?.distanceKm || 0));
      const cleanDistanceKm = Math.min(reportedKm, Math.max(0.2, maxReasonableKm));

      const wearStats = model
        ? applyDrivingWearAndFuel(
            model,
            {
              fuel: Number(v.fuel ?? model.tankCapacity),
              condition: Number(v.condition ?? 100),
              odometerKm: Number(v.odometerKm ?? 0),
            },
            cleanDistanceKm,
            data?.terrainType === 'offroad' ? 'offroad' : 'road',
            crashDamage
          )
        : {
            nextFuel: Number(v.fuel || 0),
            nextCondition: Math.max(0, Number(v.condition || 100) - crashDamage),
            nextOdometerKm: Number(v.odometerKm || 0) + cleanDistanceKm,
          };

      const prevPassengerIds = Array.isArray(v.passengerIds) ? (v.passengerIds as string[]) : [];

      tx.update(vehRef, {
        status: 'parked',
        driverId: null,
        passengerIds: [],
        isPublicActive: false,
        parkedPos: { ...safePos, zone: 'cicalengka' },
        parkedType,
        garagePropertyId: garagePropId,
        fuel: wearStats.nextFuel,
        condition: wearStats.nextCondition,
        odometerKm: wearStats.nextOdometerKm,
        lastWearAtMs: nowMs,
        updatedAtMs: nowMs,
      });

      tx.update(charRef, {
        drivingVehicleId: null,
        lastPosition: safePos,
        updatedAt: Timestamp.fromMillis(nowMs),
      });

      return { ...wearStats, parkedPos: safePos, parkedType, prevPassengerIds };
    });

    await safeRtdbRemove(`vehicles/${vehicleId}`);
    if (res.prevPassengerIds.length > 0) {
      await Promise.allSettled(
        res.prevPassengerIds.slice(0, 8).map((puid) =>
          db.collection('characters').doc(puid).update({ passengerVehicleId: null, updatedAt: Timestamp.fromMillis(nowMs) })
        )
      );
    }
    return {
      ok: true,
      nextFuel: res.nextFuel,
      nextCondition: res.nextCondition,
      nextOdometerKm: res.nextOdometerKm,
      parkedPos: res.parkedPos,
      parkedType: res.parkedType,
    };
  }
);

export const dismountVehicle = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = request.data as {
      vehicleId?: string;
      x?: number;
      y?: number;
      z?: number;
      rotY?: number;
      distanceKm?: number;
      terrainType?: 'road' | 'offroad';
      crashDamage?: number;
    };
    const vehicleId = typeof data?.vehicleId === 'string' ? data.vehicleId.trim() : '';
    if (!SAFE_ID_RE.test(vehicleId)) throw new HttpsError('invalid-argument', 'ID kendaraan tidak valid.');

    const nowMs = Date.now();
    // Jika test drive, cukup akhiri sesi RTDB & character
    if (vehicleId === `td_${uid}`) {
      await db.collection('vehicle_test_drives').doc(uid).set({ uid, status: 'ended', endedAtMs: nowMs }, { merge: true }).catch(() => {});
      await db.collection('characters').doc(uid).update({ drivingVehicleId: null, updatedAt: Timestamp.fromMillis(nowMs) }).catch(() => {});
      await safeRtdbRemove(`vehicles/${vehicleId}`);
      return { ok: true, isTestDrive: true };
    }

    const safePos = clampWorldPos({
      x: Number(data?.x ?? 0),
      y: Number(data?.y ?? 0.35),
      z: Number(data?.z ?? -20),
      rotY: Number(data?.rotY ?? 0),
    });
    const crashDamage = Math.max(0, Math.min(35, Number(data?.crashDamage || 0)));

    const outcome = await db.runTransaction(async (tx) => {
      const charRef = db.collection('characters').doc(uid);
      const vehRef = db.collection('vehicles').doc(vehicleId);
      const [charDoc, vehDoc] = await Promise.all([tx.get(charRef), tx.get(vehRef)]);
      if (!charDoc.exists || !vehDoc.exists) throw new HttpsError('not-found', 'Data tidak ditemukan.');
      const v = vehDoc.data()!;
      const isDriver = v.driverId === uid;

      if (isDriver) {
        const model = getVehicleModel(String(v.modelId));
        const elapsedSec = Math.max(1, (nowMs - Number(v.updatedAtMs || nowMs)) / 1000);
        const maxKm = ((model?.maxSpeedMps ?? 25) * elapsedSec * 1.25) / 1000;
        const cleanKm = Math.min(Math.max(0, Number(data?.distanceKm || 0)), Math.max(0.2, maxKm));
        const wearStats = model
          ? applyDrivingWearAndFuel(
              model,
              {
                fuel: Number(v.fuel ?? model.tankCapacity),
                condition: Number(v.condition ?? 100),
                odometerKm: Number(v.odometerKm ?? 0),
              },
              cleanKm,
              data?.terrainType === 'offroad' ? 'offroad' : 'road',
              crashDamage
            )
          : {
              nextFuel: Number(v.fuel || 0),
              nextCondition: Math.max(0, Number(v.condition || 100) - crashDamage),
              nextOdometerKm: Number(v.odometerKm || 0) + cleanKm,
            };

        const prevPassengerIds = Array.isArray(v.passengerIds) ? (v.passengerIds as string[]) : [];
        tx.update(vehRef, {
          status: 'parked',
          driverId: null,
          passengerIds: [],
          isPublicActive: false,
          parkedPos: { ...safePos, zone: 'cicalengka' },
          parkedType: 'roadside',
          fuel: wearStats.nextFuel,
          condition: wearStats.nextCondition,
          odometerKm: wearStats.nextOdometerKm,
          lastWearAtMs: nowMs,
          updatedAtMs: nowMs,
        });
        tx.update(charRef, {
          drivingVehicleId: null,
          passengerVehicleId: null,
          lastPosition: safePos,
          updatedAt: Timestamp.fromMillis(nowMs),
        });
        return { isDriver, prevPassengerIds };
      } else {
        const nextPass = (Array.isArray(v.passengerIds) ? (v.passengerIds as string[]) : []).filter((p) => p !== uid);
        tx.update(vehRef, { passengerIds: nextPass, updatedAtMs: nowMs });
        tx.update(charRef, { passengerVehicleId: null, updatedAt: Timestamp.fromMillis(nowMs) });
        return { isDriver, prevPassengerIds: [] as string[] };
      }
    });

    if (outcome.isDriver) {
      await safeRtdbRemove(`vehicles/${vehicleId}`);
      if (outcome.prevPassengerIds.length > 0) {
        await Promise.allSettled(
          outcome.prevPassengerIds.slice(0, 8).map((puid) =>
            db.collection('characters').doc(puid).update({ passengerVehicleId: null, updatedAt: Timestamp.fromMillis(nowMs) })
          )
        );
      }
    } else {
      await safeRtdbRemove(`vehicles/${vehicleId}/passengers/${uid}`);
    }
    return { ok: true, isDriver: outcome.isDriver };
  }
);

/**
 * 13. retrieveVehicle: Panggil/derek kendaraan ke tempat parkir atau tebus kendaraan dari sitaan Dishub / laporan curanmor.
 */
export const retrieveVehicle = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensureVehicleConfigs();

    const uid = request.auth.uid;
    const data = request.data as { vehicleId?: string; spotId?: string };
    const vehicleId = typeof data?.vehicleId === 'string' ? data.vehicleId.trim() : '';
    if (!SAFE_ID_RE.test(vehicleId)) throw new HttpsError('invalid-argument', 'ID kendaraan tidak valid.');

    const spot = PARKING_SPOTS[String(data?.spotId || 'alun_alun')] || PARKING_SPOTS.alun_alun;
    const nowMs = Date.now();

    const res = await db.runTransaction(async (tx) => {
      const charRef = db.collection('characters').doc(uid);
      const vehRef = db.collection('vehicles').doc(vehicleId);
      const treasuryRef = db.collection('state').doc('treasury');
      const [charDoc, vehDoc, treasuryDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(vehRef),
        tx.get(treasuryRef),
      ]);
      if (!charDoc.exists || !vehDoc.exists) throw new HttpsError('not-found', 'Data tidak ditemukan.');
      const v = vehDoc.data()!;
      if (v.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan kendaraan milikmu.');

      let fee = 5000; // biaya derek dasar
      if (v.status === 'impounded') {
        const impAt = Number(v.impoundedAtMs || nowMs);
        const days = Math.max(0, Math.floor((nowMs - impAt) / 86_400_000));
        fee = Number(v.impoundFine || vehiclesConfig.impoundRecoveryBaseFee) + days * vehiclesConfig.impoundDailyStorageFee;
      } else if (v.status === 'stolen') {
        fee = Math.round(vehiclesConfig.impoundRecoveryBaseFee * 0.6);
      }

      const wallet = Number(charDoc.data()!.money || 0);
      if (wallet < fee) {
        throw new HttpsError('failed-precondition', `Saldo kurang untuk biaya penebusan/derek Rp ${fee.toLocaleString('id-ID')}.`);
      }
      const nextMoney = wallet - fee;
      tx.update(charRef, { money: nextMoney, updatedAt: Timestamp.fromMillis(nowMs) });
      tx.update(vehRef, {
        status: 'parked',
        parkedType: 'parking_lot',
        parkedPos: { x: spot.x, y: spot.y, z: spot.z, rotY: 0, zone: 'cicalengka' },
        impoundReason: null,
        impoundedAtMs: null,
        impoundFine: 0,
        updatedAtMs: nowMs,
      });

      const logId = `srv_${nowMs}`;
      tx.set(vehRef.collection('service_logs').doc(logId), {
        id: logId,
        vehicleId,
        ownerId: uid,
        serviceType: 'tow_recovery',
        providerType: 'samsat',
        cost: fee,
        details: `Pemulihan/derek kendaraan ke ${spot.label}`,
        createdAtMs: nowMs,
      });
      applyTreasuryCredit(tx, db, treasuryDoc, fee, 'vehicle', nowMs);
      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'derek_kendaraan',
        amount: fee,
        balanceAfter: nextMoney,
        description: `Tebus / Derek ${String(v.name)} ke ${spot.label}`,
        nowMs,
      });
      return { fee, money: nextMoney, parkedPos: spot };
    });

    await safeRtdbRemove(`vehicles/${vehicleId}`);
    return { ok: true, ...res };
  }
);

/**
 * 14. refuelVehicle: Isi bensin (liter) atau isi daya baterai EV (%) di SPBU Cicalengka.
 */
export const refuelVehicle = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensureVehicleConfigs();

    const uid = request.auth.uid;
    const data = request.data as { vehicleId?: string; amount?: number };
    const vehicleId = typeof data?.vehicleId === 'string' ? data.vehicleId.trim() : '';
    if (!SAFE_ID_RE.test(vehicleId)) throw new HttpsError('invalid-argument', 'ID kendaraan tidak valid.');

    const nowMs = Date.now();
    const res = await db.runTransaction(async (tx) => {
      const charRef = db.collection('characters').doc(uid);
      const vehRef = db.collection('vehicles').doc(vehicleId);
      const [charDoc, vehDoc] = await Promise.all([tx.get(charRef), tx.get(vehRef)]);
      if (!charDoc.exists || !vehDoc.exists) throw new HttpsError('not-found', 'Data tidak ditemukan.');
      const v = vehDoc.data()!;
      if (v.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik kendaraan.');
      const model = getVehicleModel(String(v.modelId));
      if (!model) throw new HttpsError('failed-precondition', 'Model tidak valid.');

      const cap = model.tankCapacity;
      const curFuel = Number(v.fuel || 0);
      const needed = Math.max(0, cap - curFuel);
      if (needed <= 0.05) {
        throw new HttpsError('failed-precondition', model.isElectric ? 'Baterai sudah penuh.' : 'Tangki sudah penuh.');
      }
      const reqUnits = Number(data?.amount || 0) > 0 ? Math.min(needed, Number(data.amount)) : needed;
      const unitPrice = model.isElectric ? vehiclesConfig.fuelPrices.electricPerPercent : vehiclesConfig.fuelPrices.bensinPerUnit;
      const cost = Math.max(500, Math.round((reqUnits * unitPrice) / 100) * 100);

      const wallet = Number(charDoc.data()!.money || 0);
      if (wallet < cost) {
        throw new HttpsError('failed-precondition', `Uang tidak cukup (butuh Rp ${cost.toLocaleString('id-ID')}).`);
      }

      const nextFuel = Math.min(cap, Math.round((curFuel + reqUnits) * 100) / 100);
      const nextMoney = wallet - cost;
      tx.update(charRef, { money: nextMoney, updatedAt: Timestamp.fromMillis(nowMs) });
      tx.update(vehRef, { fuel: nextFuel, updatedAtMs: nowMs });

      const logId = `srv_${nowMs}`;
      tx.set(vehRef.collection('service_logs').doc(logId), {
        id: logId,
        vehicleId,
        ownerId: uid,
        serviceType: model.isElectric ? 'charge' : 'refuel',
        providerType: 'spbu',
        cost,
        details: model.isElectric ? `Isi daya +${Math.round(reqUnits)}%` : `Isi BBM +${reqUnits.toFixed(1)}L`,
        createdAtMs: nowMs,
      });
      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'spbu',
        amount: cost,
        balanceAfter: nextMoney,
        description: `${model.isElectric ? 'Cas EV' : 'Isi Bensin'} ${String(v.name)}`,
        nowMs,
      });
      appendLedger(tx, db, {
        from: uid,
        to: 'spbu:cicalengka',
        amount: cost,
        reason: model.isElectric ? 'vehicle_ev_charge' : 'vehicle_refuel',
        refId: vehicleId,
        nowMs,
      });
      return { fuel: nextFuel, cost, money: nextMoney };
    });

    return { ok: true, ...res };
  }
);

/**
 * 15. serviceVehicle: Servis mesin, ganti oli, cat ulang, atau pasang aksesori di bengkel NPC/pemain.
 */
export const serviceVehicle = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensureVehicleConfigs();

    const uid = request.auth.uid;
    const data = request.data as {
      vehicleId?: string;
      serviceType?: 'repair' | 'oil_change' | 'paint' | 'accessory';
      color?: string;
      accessoryId?: string;
      businessId?: string;
    };

    const vehicleId = typeof data?.vehicleId === 'string' ? data.vehicleId.trim() : '';
    const serviceType = data?.serviceType;
    if (!SAFE_ID_RE.test(vehicleId) || !serviceType || !['repair', 'oil_change', 'paint', 'accessory'].includes(serviceType)) {
      throw new HttpsError('invalid-argument', 'Jenis servis atau kendaraan tidak valid.');
    }

    const businessId = typeof data?.businessId === 'string' && SAFE_ID_RE.test(data.businessId) ? data.businessId : null;
    const nowMs = Date.now();

    const res = await db.runTransaction(async (tx) => {
      const charRef = db.collection('characters').doc(uid);
      const vehRef = db.collection('vehicles').doc(vehicleId);
      const bizRef = businessId ? db.collection('businesses').doc(businessId) : null;
      const treasuryRef = db.collection('state').doc('treasury');

      const [charDoc, vehDoc, bizDoc, treasuryDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(vehRef),
        bizRef ? tx.get(bizRef) : Promise.resolve(null),
        tx.get(treasuryRef),
      ]);
      if (!charDoc.exists || !vehDoc.exists) throw new HttpsError('not-found', 'Data tidak ditemukan.');
      const v = vehDoc.data()!;
      if (v.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik kendaraan.');
      const model = getVehicleModel(String(v.modelId));
      if (!model) throw new HttpsError('failed-precondition', 'Model tidak valid.');

      const usingPlayerWorkshop = Boolean(
        bizDoc?.exists && bizDoc.data()!.status === 'active' && bizDoc.data()!.type === 'bengkel'
      );

      const condBefore = Number(v.condition || 100);
      let condAfter = condBefore;
      let cost = 0;
      let details = '';
      const updates: Record<string, unknown> = { updatedAtMs: nowMs };

      if (serviceType === 'repair') {
        const missing = Math.max(0, 100 - condBefore);
        if (missing <= 1) throw new HttpsError('failed-precondition', 'Kondisi kendaraan sudah prima.');
        cost = Math.max(
          model.serviceCostBase,
          Math.round((missing * vehiclesConfig.maintenanceSettings.repairPerConditionPoint) / 500) * 500
        );
        condAfter = 100;
        updates.condition = 100;
        updates.lastMaintenanceAtMs = nowMs;
        details = 'Perbaikan penuh mesin & bodi';
      } else if (serviceType === 'oil_change') {
        cost = Math.max(vehiclesConfig.maintenanceSettings.oilChangeCostBase, Math.round(model.serviceCostBase * 0.7));
        condAfter = Math.min(100, condBefore + 18);
        updates.condition = condAfter;
        updates.lastMaintenanceAtMs = nowMs;
        details = 'Ganti oli & tune up ringan';
      } else if (serviceType === 'paint') {
        const newColor = typeof data?.color === 'string' && HEX_COLOR_RE.test(data.color) ? data.color.toUpperCase() : '';
        if (!newColor) throw new HttpsError('invalid-argument', 'Kode warna cat tidak valid.');
        cost = vehiclesConfig.maintenanceSettings.repaintCost;
        updates.color = newColor;
        details = `Cat ulang warna ${newColor}`;
      } else if (serviceType === 'accessory') {
        const acc = getAccessoryCfg(String(data?.accessoryId || ''));
        if (!acc || (acc.category !== 'all' && acc.category !== model.category)) {
          throw new HttpsError('invalid-argument', 'Aksesori tidak cocok untuk tipe kendaraan ini.');
        }
        const existingAcc: string[] = Array.isArray(v.accessories) ? [...(v.accessories as string[])] : [];
        if (existingAcc.includes(acc.id)) {
          throw new HttpsError('failed-precondition', `${acc.label} sudah terpasang.`);
        }
        cost = acc.cost;
        existingAcc.push(acc.id);
        updates.accessories = existingAcc;
        details = `Pasang aksesori ${acc.label}`;
      }

      const wallet = Number(charDoc.data()!.money || 0);
      if (wallet < cost) {
        throw new HttpsError('failed-precondition', `Uang kurang (butuh Rp ${cost.toLocaleString('id-ID')}).`);
      }

      const nextMoney = wallet - cost;
      tx.update(charRef, { money: nextMoney, updatedAt: Timestamp.fromMillis(nowMs) });
      tx.update(vehRef, updates);

      if (usingPlayerWorkshop && bizDoc && bizRef) {
        const tax = Math.round(cost * 0.05);
        const net = cost - tax;
        tx.update(bizRef, {
          cash: Number(bizDoc.data()!.cash || 0) + net,
          totalRevenue: Number(bizDoc.data()!.totalRevenue || 0) + net,
          updatedAtMs: nowMs,
        });
        applyTreasuryCredit(tx, db, treasuryDoc, tax, 'business', nowMs);
      }

      const logId = `srv_${nowMs}`;
      tx.set(vehRef.collection('service_logs').doc(logId), {
        id: logId,
        vehicleId,
        ownerId: uid,
        serviceType,
        providerType: usingPlayerWorkshop ? 'player_business' : 'npc',
        businessId: usingPlayerWorkshop ? businessId : null,
        cost,
        conditionBefore: condBefore,
        conditionAfter: condAfter,
        details,
        createdAtMs: nowMs,
      });

      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'bengkel',
        amount: cost,
        balanceAfter: nextMoney,
        description: `${details} (${String(v.name)})`,
        nowMs,
      });
      appendLedger(tx, db, {
        from: uid,
        to: usingPlayerWorkshop && businessId ? `business:${businessId}` : 'bengkel:umum',
        amount: cost,
        reason: `vehicle_service_${serviceType}`,
        refId: vehicleId,
        nowMs,
      });

      return { cost, condition: condAfter, details, money: nextMoney, updates };
    });

    return { ok: true, ...res };
  }
);

/**
 * 16. reportPedestrianCollision: Catat insiden menyenggol/menabrak pejalan kaki saat berkendara (denda + catatan Fase 6).
 */
export const reportPedestrianCollision = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    await ensureVehicleConfigs();

    const uid = request.auth.uid;
    const data = request.data as {
      targetName?: string;
      targetType?: 'npc' | 'player';
      x?: number;
      z?: number;
      zone?: string;
    };
    const nowMs = Date.now();
    const targetName =
      typeof data?.targetName === 'string' && data.targetName.trim().length > 0
        ? data.targetName.trim().slice(0, 48)
        : 'Warga';
    const targetType = data?.targetType === 'player' ? 'player' : 'npc';
    const safePos = clampWorldPos({
      x: Number(data?.x ?? 0),
      y: 0.35,
      z: Number(data?.z ?? -20),
      rotY: 0,
    });
    const zone = typeof data?.zone === 'string' ? data.zone.slice(0, 24) : 'cicalengka';
    const fineAmount = Number(trafficConfig.trafficOffenseFines?.pedestrianCollision ?? 35000);

    const outcome = await db.runTransaction(async (tx) => {
      const charRef = db.collection('characters').doc(uid);
      const accRef = db.collection('accounts').doc(uid);
      const treasuryRef = db.collection('state').doc('treasury');
      const [charDoc, accDoc, treasuryDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(accRef),
        tx.get(treasuryRef),
      ]);
      if (!charDoc.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      const charData = charDoc.data()!;
      if (!charData.drivingVehicleId) {
        throw new HttpsError('failed-precondition', 'Tidak sedang mengendarai kendaraan.');
      }

      const lastIncidentAtMs = Number(charData.lastTrafficCollisionAtMs || 0);
      if (nowMs - lastIncidentAtMs < 7500) {
        return { skipped: true, finePaid: 0, money: Number(charData.money || 0), wantedLevel: Number(charData.wantedLevel || 0) };
      }

      const wallet = Number(charData.money || 0);
      const finePaid = Math.min(wallet, fineAmount);
      const remainingFine = Math.max(0, fineAmount - finePaid);
      const nextMoney = wallet - finePaid;

      const baseWanted = computeLazyWantedLevel(
        Number(charData.wantedLevel || 0),
        Number(charData.wantedUpdatedAtMs || nowMs),
        nowMs
      );
      const nextWanted = Math.min(100, Math.round(baseWanted + 10));
      const { reputation, creditScore } = applyReputationAndCredit(
        tx,
        db,
        uid,
        charData,
        accDoc,
        -6,
        -3,
        nowMs
      );

      const recordId = `crm_traf_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
      tx.set(db.collection('crime_records').doc(recordId), {
        id: recordId,
        characterId: uid,
        characterName: String(charData.name || 'Warga'),
        offenseId: 'tabrak_pejalan',
        offenseTitle: `Menyenggol Pejalan Kaki (${targetName})`,
        severity: 2,
        atMs: nowMs,
        location: { zone, x: safePos.x, z: safePos.z },
        targetType,
        targetId: targetName,
        witnesses: [targetName],
        status: remainingFine > 0 ? 'wanted' : 'fined',
        fine: fineAmount,
        paidFine: finePaid,
        sentenceSec: 420,
        evidenceScore: 85,
      });

      if (remainingFine > 0) {
        const billId = `fine_ped_${nowMs}`;
        tx.set(charRef.collection('bills').doc(billId), {
          id: billId,
          uid,
          billType: 'traffic_fine',
          title: `Denda Lalu Lintas (${targetName})`,
          periodIndex: 1,
          baseAmount: remainingFine,
          lateFee: 0,
          status: 'unpaid',
          dueAtMs: nowMs + 72_000_000,
        });
      }

      tx.update(charRef, {
        money: nextMoney,
        wantedLevel: nextWanted,
        wantedUpdatedAtMs: nowMs,
        lastTrafficCollisionAtMs: nowMs,
        criminalRecordCount: Number(charData.criminalRecordCount || 0) + 1,
        reputation,
        creditScore,
        updatedAt: Timestamp.fromMillis(nowMs),
      });

      if (finePaid > 0) {
        applyTreasuryCredit(tx, db, treasuryDoc, finePaid, 'vehicle', nowMs);
        appendTransaction(tx, db, uid, {
          type: 'penalty',
          category: 'tilang_lalu_lintas',
          amount: finePaid,
          balanceAfter: nextMoney,
          description: `Denda menyenggol pejalan kaki (${targetName})`,
          nowMs,
        });
        appendLedger(tx, db, {
          from: uid,
          to: 'system:dishub_polsek',
          amount: finePaid,
          reason: 'pedestrian_collision_fine',
          refId: recordId,
          nowMs,
        });
      }

      return { skipped: false, recordId, fineAmount, finePaid, remainingFine, money: nextMoney, wantedLevel: nextWanted };
    });

    if (!outcome.skipped) {
      await writeCrimeSceneRtdb(String(outcome.recordId || `traf_${nowMs}`), {
        type: 'tabrak_pejalan',
        label: `Kecelakaan ringan (${targetName})`,
        zone,
        x: safePos.x,
        z: safePos.z,
        severity: 2,
        nowMs,
      });
    }

    return { ok: true, ...outcome };
  }
);
