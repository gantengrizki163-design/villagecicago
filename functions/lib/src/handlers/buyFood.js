"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buyFood = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const phase2_1 = require("../helpers/phase2");
const stats_1 = require("../helpers/stats");
const validation_1 = require("../helpers/validation");
const PURCHASE_COOLDOWN_MS = 1500;
exports.buyFood = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan untuk membeli makanan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const itemId = typeof data.itemId === 'string' ? data.itemId.trim() : '';
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(itemId)) {
        throw new https_1.HttpsError('invalid-argument', 'ID menu tidak valid.');
    }
    const rtdbSnap = await firebase_1.rtdb.ref(`players/${uid}`).get();
    const rtdbPos = rtdbSnap.exists() ? rtdbSnap.val() : null;
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const statsRef = firebase_1.db.collection('character_stats').doc(uid);
    const itemRef = firebase_1.db.collection('shop_menu').doc(itemId);
    const configRef = firebase_1.db.collection('config').doc('game');
    const now = firestore_1.Timestamp.now();
    const nowMs = now.toMillis();
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, statsDoc, itemDoc, configDoc] = await Promise.all([
            tx.get(charRef),
            tx.get(statsRef),
            tx.get(itemRef),
            tx.get(configRef),
        ]);
        if (!charDoc.exists || !statsDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Karakter belum dibuat.');
        }
        if (!itemDoc.exists || !itemDoc.data()?.available) {
            throw new https_1.HttpsError('not-found', 'Menu warung tidak tersedia.');
        }
        const charData = charDoc.data();
        const statsData = statsDoc.data();
        const itemData = itemDoc.data();
        if (charData.activeTrip && nowMs < Number(charData.activeTrip.arrivesAtMs || 0)) {
            throw new https_1.HttpsError('failed-precondition', 'Sedang dalam perjalanan kereta.');
        }
        const px = typeof rtdbPos?.x === 'number' ? rtdbPos.x : charData.lastPosition?.x ?? 999;
        const pz = typeof rtdbPos?.z === 'number' ? rtdbPos.z : charData.lastPosition?.z ?? 999;
        const nearWarung = (charData.currentZone || 'cicalengka') === 'cicalengka' &&
            (0, validation_1.distance2D)(px, pz, validation_1.WARUNG_POS.x, validation_1.WARUNG_POS.z) <= validation_1.INTERACT_RADIUS_METERS;
        if (!nearWarung) {
            throw new https_1.HttpsError('failed-precondition', 'Kamu terlalu jauh dari Warung Teh Neng.');
        }
        const lastPurchaseAt = statsData.lastPurchaseAt;
        if (lastPurchaseAt && nowMs - lastPurchaseAt.toMillis() < PURCHASE_COOLDOWN_MS) {
            throw new https_1.HttpsError('resource-exhausted', 'Tunggu sebentar sebelum membeli lagi.');
        }
        const price = Number(itemData.price);
        const currentMoney = Number(charData.money);
        if (currentMoney < price) {
            throw new https_1.HttpsError('failed-precondition', 'Saldo Rupiah tidak mencukupi.');
        }
        const rates = configDoc.exists
            ? {
                hungerDecayPerHour: Number(configDoc.data()?.hungerDecayPerHour ?? stats_1.DEFAULT_DECAY_RATES.hungerDecayPerHour),
                thirstDecayPerHour: Number(configDoc.data()?.thirstDecayPerHour ?? stats_1.DEFAULT_DECAY_RATES.thirstDecayPerHour),
                energyDecayPerHour: Number(configDoc.data()?.energyDecayPerHour ?? stats_1.DEFAULT_DECAY_RATES.energyDecayPerHour),
            }
            : stats_1.DEFAULT_DECAY_RATES;
        const lastCalc = statsData.lastCalculatedAt.toMillis();
        const currentStats = (0, stats_1.calculateLazyStats)({
            hunger: Number(statsData.hunger),
            thirst: Number(statsData.thirst),
            energy: Number(statsData.energy),
            health: typeof statsData.health === 'number' ? statsData.health : Number(charData.health ?? 100),
            hygiene: typeof statsData.hygiene === 'number' ? statsData.hygiene : Number(charData.hygiene ?? 100),
            mood: typeof statsData.mood === 'number' ? statsData.mood : Number(charData.mood ?? 80),
            lastCalculatedAtMs: lastCalc,
        }, nowMs, rates);
        const faintCheck = (0, phase2_1.applyFaintingOutcome)(tx, firebase_1.db, uid, currentStats, currentMoney, Number(charData.faintedCount || 0), nowMs);
        if (faintCheck.fainted) {
            tx.update(statsRef, {
                hunger: faintCheck.stats.hunger,
                thirst: faintCheck.stats.thirst,
                energy: faintCheck.stats.energy,
                health: faintCheck.stats.health,
                hygiene: faintCheck.stats.hygiene,
                mood: faintCheck.stats.mood,
                lastCalculatedAt: now,
            });
            return {
                fainted: true,
                money: faintCheck.money,
                itemName: String(itemData.name),
                stats: faintCheck.stats,
            };
        }
        const newMoney = currentMoney - price;
        const newHunger = Math.min(100, currentStats.hunger + Number(itemData.hungerRestore || 0));
        const newThirst = Math.min(100, currentStats.thirst + Number(itemData.thirstRestore || 0));
        const newEnergy = Math.min(100, currentStats.energy + Number(itemData.energyRestore || 0));
        const newMood = Math.min(100, currentStats.mood + 8);
        tx.update(charRef, {
            money: newMoney,
            health: currentStats.health,
            hygiene: currentStats.hygiene,
            mood: newMood,
            statsUpdatedAt: now,
            updatedAt: now,
        });
        tx.update(statsRef, {
            hunger: newHunger,
            thirst: newThirst,
            energy: newEnergy,
            health: currentStats.health,
            hygiene: currentStats.hygiene,
            mood: newMood,
            lastCalculatedAt: now,
            lastPurchaseAt: now,
        });
        (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
            type: 'expense',
            category: 'warung',
            amount: price,
            balanceAfter: newMoney,
            description: `Beli ${String(itemData.name)} di Warung Teh Neng`,
            nowMs,
        });
        const invRef = firebase_1.db.collection('items').doc(`${uid}_${itemId}`);
        const invDoc = await tx.get(invRef);
        const prevQty = invDoc.exists ? Number(invDoc.data()?.quantity || 0) : 0;
        tx.set(invRef, {
            uid,
            itemId,
            name: String(itemData.name),
            quantity: prevQty + 1,
            updatedAt: now,
        });
        return {
            fainted: false,
            money: newMoney,
            itemName: String(itemData.name),
            stats: {
                hunger: newHunger,
                thirst: newThirst,
                energy: newEnergy,
                health: currentStats.health,
                hygiene: currentStats.hygiene,
                mood: newMood,
            },
        };
    });
    return { ok: true, ...result };
});
//# sourceMappingURL=buyFood.js.map