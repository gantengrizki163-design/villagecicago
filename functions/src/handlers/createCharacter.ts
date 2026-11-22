import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION } from '../helpers/firebase';
import {
  bankConfig,
  DEFAULT_SKILLS,
  ensurePhase2Configs,
  productsConfig,
} from '../helpers/phase2';
import {
  isValidCharacterName,
  isValidHexColor,
  STATION_SPAWN,
} from '../helpers/validation';
import { seedInitialProperties } from '../scripts/seedProperties';

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
  await ensurePhase2Configs();

  const menuSnap = await db.collection('shop_menu').limit(1).get();
  if (menuSnap.empty) {
    const batch = db.batch();
    for (const item of DEFAULT_SHOP_MENU) {
      batch.set(db.collection('shop_menu').doc(item.id), item);
    }
    await batch.commit();
  }

  const propSnap = await db.collection('properties').limit(1).get();
  if (propSnap.empty) {
    await seedInitialProperties();
  }

  const nowMs = Date.now();
  const marketSnap = await db.collection('market_stats').limit(1).get();
  if (marketSnap.empty) {
    const batch = db.batch();
    for (const p of productsConfig.products) {
      batch.set(db.collection('market_stats').doc(p.id), {
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
    for (const s of productsConfig.suppliers) {
      batch.set(db.collection('suppliers').doc(s.id), s);
    }
    await batch.commit();
  }

  const treasuryRef = db.collection('state').doc('treasury');
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

export const createCharacter = onCall(
  { region: FUNCTIONS_REGION, cors: true, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Mangga login heula saméméh nyieun karakter.');
    }

    const uid = request.auth.uid;
    const data = request.data as Record<string, unknown>;

    if (!isValidCharacterName(data.name)) {
      throw new HttpsError(
        'invalid-argument',
        'Nama karakter harus 3–20 karakter (huruf, angka, spasi, _, ., -).'
      );
    }
    const cleanName = data.name.trim();
    const nameLower = cleanName.toLowerCase();

    const gender = data.gender;
    if (gender !== 'laki-laki' && gender !== 'perempuan') {
      throw new HttpsError('invalid-argument', 'Jenis kelamin tidak valid.');
    }

    if (
      !isValidHexColor(data.skinColor) ||
      !isValidHexColor(data.hairColor) ||
      !isValidHexColor(data.shirtColor) ||
      !isValidHexColor(data.pantsColor)
    ) {
      throw new HttpsError('invalid-argument', 'Format warna karakter harus hex (#RRGGBB).');
    }

    await ensureWorldSeedData();

    const charRef = db.collection('characters').doc(uid);
    const nameLockRef = db.collection('character_names').doc(nameLower);
    const statsRef = db.collection('character_stats').doc(uid);

    const now = Timestamp.now();

    await db.runTransaction(async (tx) => {
      const [charDoc, nameDoc] = await Promise.all([tx.get(charRef), tx.get(nameLockRef)]);

      if (charDoc.exists) {
        throw new HttpsError('already-exists', 'Akun ini sudah memiliki karakter.');
      }
      if (nameDoc.exists) {
        throw new HttpsError('already-exists', 'Nama karakter sudah dipakai pemain lain.');
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
        skills: DEFAULT_SKILLS,
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
        creditScore: bankConfig.creditScore.defaultScore,
        businesses: [],
        lastPosition: STATION_SPAWN,
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
      spawn: STATION_SPAWN,
    };
  }
);
