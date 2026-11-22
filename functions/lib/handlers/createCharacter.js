"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCharacter = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const phase2_1 = require("../helpers/phase2");
const validation_1 = require("../helpers/validation");
const seedProperties_1 = require("../scripts/seedProperties");
const DEFAULT_SHOP_MENU = [
    {
        id: 'nasi_telur',
        name: 'Nasi + Telur',
        description: 'Sangu haneut jeung endog dadar ala Warung Teh Neng.',
        price: 12000,
        hungerRestore: 45,
        thirstRestore: 0,
        energyRestore: 10,
        available: true,
    },
    {
        id: 'mie_rebus',
        name: 'Mie Rebus',
        description: 'Mie kuah haneut maké sawi jeung bawang goreng.',
        price: 10000,
        hungerRestore: 35,
        thirstRestore: 10,
        energyRestore: 8,
        available: true,
    },
    {
        id: 'es_teh',
        name: 'Es Teh Manis',
        description: 'Teh amis tiis nyegerkeun tikoro tengah poé.',
        price: 5000,
        hungerRestore: 0,
        thirstRestore: 35,
        energyRestore: 5,
        available: true,
    },
    {
        id: 'air_mineral',
        name: 'Air Mineral',
        description: 'Cai herang seger pangilang hanaang.',
        price: 4000,
        hungerRestore: 0,
        thirstRestore: 45,
        energyRestore: 5,
        available: true,
    },
];
async function ensureWorldSeedData() {
    await (0, phase2_1.ensurePhase2Configs)();
    const menuSnap = await firebase_1.db.collection('shop_menu').limit(1).get();
    if (menuSnap.empty) {
        const batch = firebase_1.db.batch();
        for (const item of DEFAULT_SHOP_MENU) {
            batch.set(firebase_1.db.collection('shop_menu').doc(item.id), item);
        }
        await batch.commit();
    }
    const propSnap = await firebase_1.db.collection('properties').limit(1).get();
    if (propSnap.empty) {
        await (0, seedProperties_1.seedInitialProperties)();
    }
    const nowMs = Date.now();
    const marketSnap = await firebase_1.db.collection('market_stats').limit(1).get();
    if (marketSnap.empty) {
        const batch = firebase_1.db.batch();
        for (const p of phase2_1.productsConfig.products) {
            batch.set(firebase_1.db.collection('market_stats').doc(p.id), {
                itemId: p.id,
                name: p.name,
                category: p.category,
                basePrice: p.basePrice,
                currentPrice: p.suggestedRetail,
                wholesalePrice: p.wholesalePrice,
                supply: 100,
                demand: 100,
                pendingSupplyDelta: 0,
                pendingDemandDelta: 0,
                eventMultiplier: 1.0,
                updatedAtMs: nowMs,
            });
        }
        for (const s of phase2_1.productsConfig.suppliers) {
            batch.set(firebase_1.db.collection('suppliers').doc(s.id), s);
        }
        await batch.commit();
    }
    const treasuryRef = firebase_1.db.collection('state').doc('treasury');
    const treasurySnap = await treasuryRef.get();
    if (!treasurySnap.exists) {
        await treasuryRef.set({
            balance: 2_500_000,
            totalTaxCollected: 0,
            incomeTaxTotal: 0,
            businessTaxTotal: 0,
            propertyTaxTotal: 0,
            marketFeeTotal: 0,
            auctionFeeTotal: 0,
            inflationIndex: 1.0,
            activeEventId: 'normal',
            activeEventLabel: 'Ekonomi Cicalengka Stabil',
            activeEventUntilMs: nowMs + 7_200_000,
            estimatedMoneySupply: 0,
            avgMarketPriceIndex: 1.0,
            updatedAtMs: nowMs,
        });
    }
}
exports.createCharacter = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, cors: true, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Mangga login heula saméméh nyieun karakter.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    if (!(0, validation_1.isValidCharacterName)(data.name)) {
        throw new https_1.HttpsError('invalid-argument', 'Nama karakter harus 3–20 karakter (huruf, angka, spasi, _, ., -).');
    }
    const cleanName = data.name.trim();
    const nameLower = cleanName.toLowerCase();
    const gender = data.gender;
    if (gender !== 'laki-laki' && gender !== 'perempuan') {
        throw new https_1.HttpsError('invalid-argument', 'Jenis kelamin tidak valid.');
    }
    if (!(0, validation_1.isValidHexColor)(data.skinColor) ||
        !(0, validation_1.isValidHexColor)(data.hairColor) ||
        !(0, validation_1.isValidHexColor)(data.shirtColor) ||
        !(0, validation_1.isValidHexColor)(data.pantsColor)) {
        throw new https_1.HttpsError('invalid-argument', 'Format warna karakter harus hex (#RRGGBB).');
    }
    await ensureWorldSeedData();
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const nameLockRef = firebase_1.db.collection('character_names').doc(nameLower);
    const statsRef = firebase_1.db.collection('character_stats').doc(uid);
    const now = firestore_1.Timestamp.now();
    await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, nameDoc] = await Promise.all([tx.get(charRef), tx.get(nameLockRef)]);
        if (charDoc.exists) {
            throw new https_1.HttpsError('already-exists', 'Akun ini sudah memiliki karakter.');
        }
        if (nameDoc.exists) {
            throw new https_1.HttpsError('already-exists', 'Nama karakter sudah dipakai pemain lain.');
        }
        tx.set(nameLockRef, {
            uid,
            name: cleanName,
            createdAt: now,
        });
        tx.set(charRef, {
            uid,
            name: cleanName,
            nameLower,
            gender,
            skinColor: data.skinColor,
            hairColor: data.hairColor,
            shirtColor: data.shirtColor,
            pantsColor: data.pantsColor,
            money: 100_000,
            health: 100,
            hygiene: 100,
            mood: 80,
            statsUpdatedAt: now,
            currentZone: 'cicalengka',
            skills: phase2_1.DEFAULT_SKILLS,
            currentJob: null,
            activeShift: null,
            activeTrip: null,
            activeClinic: null,
            activeCourse: null,
            faintedCount: 0,
            lastBillPeriod: 0,
            currentHomeId: null,
            activeLeaseId: null,
            homeless: true,
            reputation: 60,
            starterHousingClaimed: false,
            activeSleep: null,
            lastSleepLocation: null,
            respawnAtHome: false,
            bankAccount: null,
            creditScore: phase2_1.bankConfig.creditScore.defaultScore,
            businesses: [],
            lastPosition: validation_1.STATION_SPAWN,
            createdAt: now,
            updatedAt: now,
        });
        tx.set(statsRef, {
            uid,
            hunger: 100,
            thirst: 100,
            energy: 100,
            health: 100,
            hygiene: 100,
            mood: 80,
            lastCalculatedAt: now,
        });
    });
    return {
        ok: true,
        name: cleanName,
        money: 100_000,
        spawn: validation_1.STATION_SPAWN,
    };
});
//# sourceMappingURL=createCharacter.js.map