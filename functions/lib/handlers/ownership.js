"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setHomePreferences = exports.eatFromInventory = exports.batheAtHome = exports.sleepAtHome = exports.buyProperty = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const housing_1 = require("../helpers/housing");
const ledger_1 = require("../helpers/ledger");
const location_1 = require("../helpers/location");
const phase2_1 = require("../helpers/phase2");
const stats_1 = require("../helpers/stats");
exports.buyProperty = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const propertyId = typeof data?.propertyId === 'string' ? data.propertyId.trim() : '';
    const offerId = typeof data?.offerId === 'string' ? data.offerId.trim() : '';
    if (!(0, housing_1.isValidSimpleId)(propertyId)) {
        throw new https_1.HttpsError('invalid-argument', 'ID properti tidak valid.');
    }
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const propRef = firebase_1.db.collection('properties').doc(propertyId);
    const offerRef = offerId && (0, housing_1.isValidSimpleId)(offerId) ? firebase_1.db.collection('offers').doc(offerId) : null;
    const treasuryRef = firebase_1.db.collection('state').doc('treasury');
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, propDoc, offerDoc, treasuryDoc] = await Promise.all([
            tx.get(charRef),
            tx.get(propRef),
            offerRef ? tx.get(offerRef) : Promise.resolve(null),
            tx.get(treasuryRef),
        ]);
        if (!charDoc.exists || !propDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Karakter atau properti tidak ditemukan.');
        }
        const charData = charDoc.data();
        const prop = propDoc.data();
        if (prop.ownerId === uid) {
            throw new https_1.HttpsError('failed-precondition', 'Properti ini sudah menjadi milikmu.');
        }
        if (prop.activeLeaseId) {
            throw new https_1.HttpsError('failed-precondition', 'Properti sedang terikat kontrak sewa aktif.');
        }
        const listingId = typeof prop.activeListingId === 'string' ? prop.activeListingId : null;
        const listingRef = listingId ? firebase_1.db.collection('property_listings').doc(listingId) : null;
        const sellerRef = prop.ownerType === 'player' ? firebase_1.db.collection('characters').doc(String(prop.ownerId)) : null;
        const [listingDoc, sellerDoc] = await Promise.all([
            listingRef ? tx.get(listingRef) : Promise.resolve(null),
            sellerRef ? tx.get(sellerRef) : Promise.resolve(null),
        ]);
        let price = 0;
        if (offerDoc?.exists) {
            const off = offerDoc.data();
            if (off.buyerId !== uid ||
                off.propertyId !== propertyId ||
                off.kind !== 'sale' ||
                off.status !== 'accepted') {
                throw new https_1.HttpsError('failed-precondition', 'Penawaran beli belum disetujui atau tidak valid.');
            }
            if (nowMs > Number(off.expiresAtMs || 0)) {
                throw new https_1.HttpsError('failed-precondition', 'Penawaran sudah kedaluwarsa.');
            }
            price = Number(off.amount);
        }
        else {
            if (!listingDoc?.exists || listingDoc.data()?.status !== 'active' || listingDoc.data()?.kind !== 'sale') {
                throw new https_1.HttpsError('failed-precondition', 'Properti ini sedang tidak dijual.');
            }
            price = Number(listingDoc.data().price);
        }
        const ls = phase2_1.housingConfig.leaseSettings;
        const transferTax = Math.round(price * ls.saleTransferTaxRate);
        const totalCost = price + transferTax;
        const money = Number(charData.money || 0);
        if (money < totalCost) {
            throw new https_1.HttpsError('failed-precondition', `Saldo kurang! Butuh Rp ${totalCost.toLocaleString('id-ID')} (termasuk bea balik nama 2,5%).`);
        }
        const nextMoney = money - totalCost;
        const condition = (0, housing_1.computeLazyPropertyCondition)(Number(prop.condition ?? 80), Number(prop.lastConditionDecayAtMs ?? nowMs), nowMs);
        const certificateId = `SHM_${propertyId}_${nowMs}`;
        if (sellerDoc?.exists) {
            const sellerNextMoney = Number(sellerDoc.data().money || 0) + price;
            tx.update(sellerRef, { money: sellerNextMoney, updatedAt: now });
            (0, phase2_1.appendTransaction)(tx, firebase_1.db, String(prop.ownerId), {
                type: 'income',
                category: 'jual_properti',
                amount: price,
                balanceAfter: sellerNextMoney,
                description: `Penjualan ${String(prop.name)} ke ${String(charData.name)}`,
                nowMs,
            });
        }
        tx.update(propRef, {
            ownerId: uid,
            ownerType: 'player',
            ownerName: String(charData.name),
            activeListingId: null,
            mortgageInfo: null,
            certificateId,
            condition,
            lastConditionDecayAtMs: nowMs,
            lastTaxAtMs: nowMs,
            updatedAtMs: nowMs,
        });
        if (listingDoc?.exists) {
            tx.update(listingRef, { status: 'closed' });
        }
        if (offerDoc?.exists) {
            tx.update(offerRef, { status: 'completed' });
        }
        tx.set((0, housing_1.buildMemberAccessRef)(firebase_1.db, propertyId, uid), {
            uid,
            propertyId,
            role: 'owner',
            grantedAtMs: nowMs,
        });
        const nextHomeId = charData.currentHomeId || propertyId;
        tx.update(charRef, {
            money: nextMoney,
            currentHomeId: nextHomeId,
            homeless: false,
            reputation: Math.min(100, Number(charData.reputation ?? 60) + 5),
            updatedAt: now,
        });
        (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
            type: 'expense',
            category: 'beli_properti',
            amount: totalCost,
            balanceAfter: nextMoney,
            description: `Beli tunai ${String(prop.name)} (${certificateId})`,
            nowMs,
        });
        if (transferTax > 0) {
            (0, ledger_1.applyTreasuryCredit)(tx, firebase_1.db, treasuryDoc, transferTax, 'property', nowMs);
            (0, ledger_1.appendLedger)(tx, firebase_1.db, {
                from: uid,
                to: 'system:treasury',
                amount: transferTax,
                taxAmount: transferTax,
                reason: 'property_sale_transfer_tax',
                refId: propertyId,
                nowMs,
            });
        }
        return {
            propertyId,
            certificateId,
            money: nextMoney,
            totalCost,
            transferTax,
        };
    });
    return { ok: true, ...result };
});
exports.sleepAtHome = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const action = data?.action === 'wake' ? 'wake' : 'start';
    const locationType = data?.locationType === 'emperan' || data?.locationType === 'shelter'
        ? data.locationType
        : 'home';
    const propertyId = typeof data?.propertyId === 'string' ? data.propertyId.trim() : '';
    const spotId = typeof data?.spotId === 'string' ? data.spotId.trim() : '';
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const statsRef = firebase_1.db.collection('character_stats').doc(uid);
    const configRef = firebase_1.db.collection('config').doc('game');
    const charPre = await charRef.get();
    if (!charPre.exists)
        throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
    const charPreData = charPre.data();
    if (action === 'start') {
        if ((charPreData.currentZone || 'cicalengka') !== 'cicalengka') {
            throw new https_1.HttpsError('failed-precondition', 'Tidur hanya tersedia di zona Cicalengka.');
        }
        if (charPreData.activeTrip && nowMs < Number(charPreData.activeTrip.arrivesAtMs || 0)) {
            throw new https_1.HttpsError('failed-precondition', 'Tidak bisa tidur saat di kereta.');
        }
        const hs = phase2_1.housingConfig.homelessSettings;
        const targetPropId = propertyId || String(charPreData.currentHomeId || '');
        const propRef = locationType === 'home' && (0, housing_1.isValidSimpleId)(targetPropId)
            ? firebase_1.db.collection('properties').doc(targetPropId)
            : null;
        const accessRef = locationType === 'home' && (0, housing_1.isValidSimpleId)(targetPropId)
            ? (0, housing_1.buildMemberAccessRef)(firebase_1.db, targetPropId, uid)
            : null;
        let matchedLocPos = { x: Number(charPreData.lastPosition?.x ?? 0), z: Number(charPreData.lastPosition?.z ?? 0) };
        let matchedSpotId = spotId;
        if (locationType === 'home') {
            if (!propRef) {
                throw new https_1.HttpsError('failed-precondition', 'Kamu belum memiliki hunian.');
            }
            const propPre = await propRef.get();
            if (!propPre.exists) {
                throw new https_1.HttpsError('failed-precondition', 'Kamu belum memiliki hunian.');
            }
            const propTarget = (0, location_1.buildDynamicPropertyTarget)(propPre.id, propPre.data());
            const match = await (0, location_1.assertNearLocation)(firebase_1.rtdb, uid, charPreData, [], 0, [propTarget], `Mendekatlah ke ${propTarget.label} untuk tidur.`);
            matchedLocPos = match.pos;
        }
        else if (locationType === 'shelter') {
            const match = await (0, location_1.assertNearLocation)(firebase_1.rtdb, uid, charPreData, ['penampungan'], 0, [], `Mendekatlah ke ${hs.shelter.label}.`);
            matchedLocPos = match.pos;
        }
        else {
            const emperanIds = spotId
                ? [spotId]
                : hs.emperanSpots.map((s) => s.id);
            const match = await (0, location_1.assertNearLocation)(firebase_1.rtdb, uid, charPreData, emperanIds, 0, [], 'Mendekatlah ke emperan ruko/stasiun.');
            matchedLocPos = match.pos;
            matchedSpotId = match.locationId;
        }
        const result = await firebase_1.db.runTransaction(async (tx) => {
            const [charDoc, propDoc, accessDoc] = await Promise.all([
                tx.get(charRef),
                propRef ? tx.get(propRef) : Promise.resolve(null),
                accessRef ? tx.get(accessRef) : Promise.resolve(null),
            ]);
            if (!charDoc.exists)
                throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
            const charData = charDoc.data();
            if ((charData.currentZone || 'cicalengka') !== 'cicalengka') {
                throw new https_1.HttpsError('failed-precondition', 'Tidur hanya tersedia di zona Cicalengka.');
            }
            if (charData.activeTrip && nowMs < Number(charData.activeTrip.arrivesAtMs || 0)) {
                throw new https_1.HttpsError('failed-precondition', 'Tidak bisa tidur saat di kereta.');
            }
            const living = phase2_1.housingConfig.livingAndSleep;
            let durationSec = living.sleepDurationSec;
            let label = 'Rumah';
            let nextMoney = Number(charData.money || 0);
            let sleepPropId = null;
            let sleepSpotCoords = { x: matchedLocPos.x, y: 1, z: matchedLocPos.z };
            if (locationType === 'home') {
                if (!propDoc?.exists) {
                    throw new https_1.HttpsError('failed-precondition', 'Kamu belum memiliki hunian.');
                }
                const prop = propDoc.data();
                const hasAccess = prop.ownerId === uid ||
                    (accessDoc?.exists &&
                        (!accessDoc.data()?.expiresAtMs || nowMs <= Number(accessDoc.data().expiresAtMs)));
                if (!hasAccess) {
                    throw new https_1.HttpsError('permission-denied', 'Tidak memiliki izin tidur di properti ini.');
                }
                const pp = prop.position;
                label = String(prop.name);
                sleepPropId = prop.id;
                sleepSpotCoords = { x: pp.x, y: 1, z: pp.z };
            }
            else if (locationType === 'shelter') {
                const sh = hs.shelter;
                const gameHour = (0, housing_1.getGameHourFromNow)(nowMs);
                if (!(0, housing_1.isShelterOpenAtHour)(gameHour)) {
                    throw new https_1.HttpsError('failed-precondition', `Penampungan hanya buka malam hari (${sh.openStartHour}:00–0${sh.openEndHour}:00).`);
                }
                const fee = nextMoney >= sh.fee ? sh.fee : 0;
                if (fee > 0) {
                    nextMoney -= fee;
                    (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
                        type: 'expense',
                        category: 'penampungan',
                        amount: fee,
                        balanceAfter: nextMoney,
                        description: 'Menginap di Penampungan Sosial Cicalengka',
                        nowMs,
                    });
                }
                durationSec = sh.sleepDurationSec;
                label = sh.label;
                sleepSpotCoords = { x: sh.x, y: 1, z: sh.z };
            }
            else {
                const spot = hs.emperanSpots.find((s) => s.id === matchedSpotId) ?? hs.emperanSpots[0];
                if (!spot) {
                    throw new https_1.HttpsError('failed-precondition', 'Mendekatlah ke emperan ruko/stasiun.');
                }
                durationSec = hs.emperanSleepDurationSec;
                label = spot.label;
                sleepSpotCoords = { x: spot.x, y: 1, z: spot.z };
            }
            const activeSleep = {
                locationType,
                propertyId: sleepPropId,
                label,
                startedAtMs: nowMs,
                completesAtMs: nowMs + durationSec * 1000,
            };
            tx.update(charRef, {
                money: nextMoney,
                activeSleep,
                lastSleepLocation: {
                    zone: 'cicalengka',
                    propertyId: sleepPropId,
                    ...sleepSpotCoords,
                },
                updatedAt: now,
            });
            return { activeSleep, money: nextMoney };
        });
        return { ok: true, ...result };
    }
    // action === 'wake'
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, statsDoc, configDoc] = await Promise.all([
            tx.get(charRef),
            tx.get(statsRef),
            tx.get(configRef),
        ]);
        if (!charDoc.exists || !statsDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        }
        const charData = charDoc.data();
        const statsData = statsDoc.data();
        const activeSleep = charData.activeSleep;
        if (!activeSleep) {
            throw new https_1.HttpsError('failed-precondition', 'Sedang tidak tidur.');
        }
        const propDoc = activeSleep.locationType === 'home' && activeSleep.propertyId
            ? await tx.get(firebase_1.db.collection('properties').doc(activeSleep.propertyId))
            : null;
        const rates = configDoc.exists
            ? {
                hungerDecayPerHour: Number(configDoc.data()?.hungerDecayPerHour ?? stats_1.DEFAULT_DECAY_RATES.hungerDecayPerHour),
                thirstDecayPerHour: Number(configDoc.data()?.thirstDecayPerHour ?? stats_1.DEFAULT_DECAY_RATES.thirstDecayPerHour),
                energyDecayPerHour: Number(configDoc.data()?.energyDecayPerHour ?? stats_1.DEFAULT_DECAY_RATES.energyDecayPerHour),
            }
            : stats_1.DEFAULT_DECAY_RATES;
        const currentStats = (0, stats_1.calculateLazyStats)({
            hunger: Number(statsData.hunger),
            thirst: Number(statsData.thirst),
            energy: Number(statsData.energy),
            health: typeof statsData.health === 'number' ? statsData.health : Number(charData.health ?? 100),
            hygiene: typeof statsData.hygiene === 'number' ? statsData.hygiene : Number(charData.hygiene ?? 100),
            mood: typeof statsData.mood === 'number' ? statsData.mood : Number(charData.mood ?? 80),
            lastCalculatedAtMs: statsData.lastCalculatedAt.toMillis(),
        }, nowMs, rates, { isHomeless: Boolean(charData.homeless) });
        const faintCheck = (0, phase2_1.applyFaintingOutcome)(tx, firebase_1.db, uid, currentStats, Number(charData.money || 0), Number(charData.faintedCount || 0), nowMs);
        if (faintCheck.fainted) {
            tx.update(statsRef, { ...faintCheck.stats, lastCalculatedAt: now });
            return { fainted: true, stats: faintCheck.stats };
        }
        const totalMs = Math.max(1000, activeSleep.completesAtMs - activeSleep.startedAtMs);
        const ratio = Math.min(1, Math.max(0.25, (nowMs - activeSleep.startedAtMs) / totalMs));
        const living = phase2_1.housingConfig.livingAndSleep;
        const hs = phase2_1.housingConfig.homelessSettings;
        let energyGain = 30;
        let healthGain = 0;
        let moodDelta = 0;
        let hygieneDelta = 0;
        if (activeSleep.locationType === 'home') {
            const prop = propDoc?.exists ? propDoc.data() : null;
            const recovery = prop
                ? (0, housing_1.computeHomeRecoveryProfile)({
                    type: String(prop.type),
                    condition: Number(prop.condition ?? 80),
                    furniture: (prop.furniture ?? []),
                })
                : { energyMultiplier: 1.35, moodBonus: 0, foodBonus: 0 };
            energyGain = Math.round(living.homeSleepEnergyRestore * recovery.energyMultiplier * ratio);
            healthGain = Math.round(living.homeSleepHealthRestore * ratio);
            moodDelta = Math.round((living.homeSleepMoodRestore + recovery.moodBonus) * ratio);
        }
        else if (activeSleep.locationType === 'shelter') {
            energyGain = Math.round(hs.shelter.sleepEnergyRestore * ratio);
            moodDelta = Math.round(hs.shelter.sleepMoodDelta * ratio);
            hygieneDelta = Math.round(hs.shelter.sleepHygieneDelta * ratio);
        }
        else {
            energyGain = Math.round(hs.emperanSleepEnergyRestore * ratio);
            moodDelta = Math.round(hs.emperanSleepMoodDelta * ratio);
            hygieneDelta = Math.round(hs.emperanSleepHygieneDelta * ratio);
        }
        const nextEnergy = Math.min(100, currentStats.energy + energyGain);
        const nextHealth = Math.min(100, currentStats.health + healthGain);
        const nextMood = Math.max(0, Math.min(100, currentStats.mood + moodDelta));
        const nextHygiene = Math.max(0, Math.min(100, currentStats.hygiene + hygieneDelta));
        tx.update(charRef, {
            activeSleep: null,
            health: nextHealth,
            hygiene: nextHygiene,
            mood: nextMood,
            statsUpdatedAt: now,
            updatedAt: now,
        });
        tx.update(statsRef, {
            hunger: currentStats.hunger,
            thirst: currentStats.thirst,
            energy: nextEnergy,
            health: nextHealth,
            hygiene: nextHygiene,
            mood: nextMood,
            lastCalculatedAt: now,
            lastSleepAt: now,
        });
        return {
            fainted: false,
            stats: {
                hunger: currentStats.hunger,
                thirst: currentStats.thirst,
                energy: nextEnergy,
                health: nextHealth,
                hygiene: nextHygiene,
                mood: nextMood,
            },
        };
    });
    return { ok: true, ...result };
});
exports.batheAtHome = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const propertyId = typeof data?.propertyId === 'string' ? data.propertyId.trim() : '';
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const statsRef = firebase_1.db.collection('character_stats').doc(uid);
    const configRef = firebase_1.db.collection('config').doc('game');
    const charPre = await charRef.get();
    if (!charPre.exists)
        throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
    const targetPropId = propertyId || String(charPre.data().currentHomeId || '');
    if (!(0, housing_1.isValidSimpleId)(targetPropId)) {
        throw new https_1.HttpsError('failed-precondition', 'Kamu belum punya hunian untuk mandi di rumah.');
    }
    const propRef = firebase_1.db.collection('properties').doc(targetPropId);
    const accessRef = (0, housing_1.buildMemberAccessRef)(firebase_1.db, targetPropId, uid);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, statsDoc, configDoc, propDoc, accessDoc] = await Promise.all([
            tx.get(charRef),
            tx.get(statsRef),
            tx.get(configRef),
            tx.get(propRef),
            tx.get(accessRef),
        ]);
        if (!charDoc.exists || !statsDoc.exists || !propDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Data hunian tidak ditemukan.');
        }
        const charData = charDoc.data();
        const statsData = statsDoc.data();
        const prop = propDoc.data();
        const hasAccess = prop.ownerId === uid ||
            (accessDoc.exists &&
                (!accessDoc.data()?.expiresAtMs || nowMs <= Number(accessDoc.data().expiresAtMs)));
        if (!hasAccess) {
            throw new https_1.HttpsError('permission-denied', 'Tidak ada izin akses hunian ini.');
        }
        const living = phase2_1.housingConfig.livingAndSleep;
        const lastBathAt = statsData.lastBathAt;
        const cooldownMs = living.homeBathCooldownSec * 1000;
        if (lastBathAt && nowMs - lastBathAt.toMillis() < cooldownMs) {
            const wait = Math.ceil((cooldownMs - (nowMs - lastBathAt.toMillis())) / 1000);
            throw new https_1.HttpsError('resource-exhausted', `Baru saja mandi, tunggu ${wait} detik lagi.`);
        }
        const rates = configDoc.exists
            ? {
                hungerDecayPerHour: Number(configDoc.data()?.hungerDecayPerHour ?? stats_1.DEFAULT_DECAY_RATES.hungerDecayPerHour),
                thirstDecayPerHour: Number(configDoc.data()?.thirstDecayPerHour ?? stats_1.DEFAULT_DECAY_RATES.thirstDecayPerHour),
                energyDecayPerHour: Number(configDoc.data()?.energyDecayPerHour ?? stats_1.DEFAULT_DECAY_RATES.energyDecayPerHour),
            }
            : stats_1.DEFAULT_DECAY_RATES;
        const currentStats = (0, stats_1.calculateLazyStats)({
            hunger: Number(statsData.hunger),
            thirst: Number(statsData.thirst),
            energy: Number(statsData.energy),
            health: typeof statsData.health === 'number' ? statsData.health : Number(charData.health ?? 100),
            hygiene: typeof statsData.hygiene === 'number' ? statsData.hygiene : Number(charData.hygiene ?? 100),
            mood: typeof statsData.mood === 'number' ? statsData.mood : Number(charData.mood ?? 80),
            lastCalculatedAtMs: statsData.lastCalculatedAt.toMillis(),
        }, nowMs, rates, { isHomeless: Boolean(charData.homeless) });
        const nextHygiene = Math.min(100, currentStats.hygiene + living.homeBathHygieneRestore);
        const nextMood = Math.min(100, currentStats.mood + living.homeBathMoodRestore);
        tx.update(charRef, {
            health: currentStats.health,
            hygiene: nextHygiene,
            mood: nextMood,
            statsUpdatedAt: now,
            updatedAt: now,
        });
        tx.update(statsRef, {
            hunger: currentStats.hunger,
            thirst: currentStats.thirst,
            energy: currentStats.energy,
            health: currentStats.health,
            hygiene: nextHygiene,
            mood: nextMood,
            lastCalculatedAt: now,
            lastBathAt: now,
        });
        return { hygiene: nextHygiene, mood: nextMood };
    });
    return { ok: true, ...result };
});
exports.eatFromInventory = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const itemId = typeof data?.itemId === 'string' ? data.itemId.trim() : '';
    const propertyId = typeof data?.propertyId === 'string' ? data.propertyId.trim() : '';
    if (!(0, housing_1.isValidSimpleId)(itemId)) {
        throw new https_1.HttpsError('invalid-argument', 'ID makanan tidak valid.');
    }
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const statsRef = firebase_1.db.collection('character_stats').doc(uid);
    const invRef = charRef.collection('inventory').doc(itemId);
    const legacyRef = firebase_1.db.collection('items').doc(`${uid}_${itemId}`);
    const menuRef = firebase_1.db.collection('shop_menu').doc(itemId);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, statsDoc, invDoc, legacyDoc, menuDoc] = await Promise.all([
            tx.get(charRef),
            tx.get(statsRef),
            tx.get(invRef),
            tx.get(legacyRef),
            tx.get(menuRef),
        ]);
        if (!charDoc.exists || !statsDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        }
        const charData = charDoc.data();
        const statsData = statsDoc.data();
        const usePropId = propertyId || String(charData.currentHomeId || '');
        const propDoc = (0, housing_1.isValidSimpleId)(usePropId) ? await tx.get(firebase_1.db.collection('properties').doc(usePropId)) : null;
        const invQty = invDoc.exists ? Number(invDoc.data()?.quantity || 0) : 0;
        const legacyQty = legacyDoc.exists ? Number(legacyDoc.data()?.quantity || 0) : 0;
        if (invQty <= 0 && legacyQty <= 0) {
            throw new https_1.HttpsError('failed-precondition', 'Stok makanan ini habis di penyimpanan.');
        }
        const menuData = menuDoc.exists ? menuDoc.data() : null;
        const baseHunger = Number(menuData?.hungerRestore ?? 30);
        const baseThirst = Number(menuData?.thirstRestore ?? 10);
        const baseEnergy = Number(menuData?.energyRestore ?? 8);
        const prop = propDoc?.exists ? propDoc.data() : null;
        const foodBonus = prop
            ? (0, housing_1.computeHomeRecoveryProfile)({
                type: String(prop.type),
                condition: Number(prop.condition ?? 80),
                furniture: (prop.furniture ?? []),
            }).foodBonus
            : 0;
        const mult = 1 + foodBonus;
        const currentStats = (0, stats_1.calculateLazyStats)({
            hunger: Number(statsData.hunger),
            thirst: Number(statsData.thirst),
            energy: Number(statsData.energy),
            health: typeof statsData.health === 'number' ? statsData.health : Number(charData.health ?? 100),
            hygiene: typeof statsData.hygiene === 'number' ? statsData.hygiene : Number(charData.hygiene ?? 100),
            mood: typeof statsData.mood === 'number' ? statsData.mood : Number(charData.mood ?? 80),
            lastCalculatedAtMs: statsData.lastCalculatedAt.toMillis(),
        }, nowMs, stats_1.DEFAULT_DECAY_RATES, { isHomeless: Boolean(charData.homeless) });
        if (invQty > 0) {
            if (invQty <= 1)
                tx.delete(invRef);
            else
                tx.update(invRef, { quantity: invQty - 1, updatedAtMs: nowMs });
        }
        else {
            if (legacyQty <= 1)
                tx.delete(legacyRef);
            else
                tx.update(legacyRef, { quantity: legacyQty - 1, updatedAt: now });
        }
        const nextHunger = Math.min(100, currentStats.hunger + Math.round(baseHunger * mult));
        const nextThirst = Math.min(100, currentStats.thirst + Math.round(baseThirst * mult));
        const nextEnergy = Math.min(100, currentStats.energy + Math.round(baseEnergy * mult));
        const nextMood = Math.min(100, currentStats.mood + 10);
        tx.update(charRef, {
            mood: nextMood,
            statsUpdatedAt: now,
            updatedAt: now,
        });
        tx.update(statsRef, {
            hunger: nextHunger,
            thirst: nextThirst,
            energy: nextEnergy,
            health: currentStats.health,
            hygiene: currentStats.hygiene,
            mood: nextMood,
            lastCalculatedAt: now,
        });
        return {
            stats: {
                hunger: nextHunger,
                thirst: nextThirst,
                energy: nextEnergy,
                health: currentStats.health,
                hygiene: currentStats.hygiene,
                mood: nextMood,
            },
        };
    });
    return { ok: true, ...result };
});
exports.setHomePreferences = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const respawnAtHome = Boolean(data?.respawnAtHome);
    await firebase_1.db.collection('characters').doc(uid).update({
        respawnAtHome,
        updatedAt: firestore_1.Timestamp.now(),
    });
    return { ok: true, respawnAtHome };
});
//# sourceMappingURL=ownership.js.map