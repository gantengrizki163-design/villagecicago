import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION, rtdb } from '../helpers/firebase';
import { assertNearLocation } from '../helpers/location';
import { appendTransaction, applyFaintingOutcome } from '../helpers/phase2';
import { calculateLazyStats, DEFAULT_DECAY_RATES } from '../helpers/stats';

const PURCHASE_COOLDOWN_MS = 1500;

export const buyFood = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan untuk membeli makanan.');
    }

    const uid = request.auth.uid;
    const data = request.data as Record<string, unknown>;
    const itemId = typeof data.itemId === 'string' ? data.itemId.trim() : '';

    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(itemId)) {
      throw new HttpsError('invalid-argument', 'ID menu tidak valid.');
    }

    const charRef = db.collection('characters').doc(uid);
    const statsRef = db.collection('character_stats').doc(uid);
    const itemRef = db.collection('shop_menu').doc(itemId);
    const configRef = db.collection('config').doc('game');

    const charPre = await charRef.get();
    if (!charPre.exists) {
      throw new HttpsError('not-found', 'Karakter belum dibuat.');
    }
    await assertNearLocation(
      rtdb,
      uid,
      charPre.data()!,
      ['warung'],
      0,
      [],
      'Kamu terlalu jauh dari Warung Teh Neng.'
    );

    const now = Timestamp.now();
    const nowMs = now.toMillis();

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, statsDoc, itemDoc, configDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(statsRef),
        tx.get(itemRef),
        tx.get(configRef),
      ]);

      if (!charDoc.exists || !statsDoc.exists) {
        throw new HttpsError('not-found', 'Karakter belum dibuat.');
      }
      if (!itemDoc.exists || !itemDoc.data()?.available) {
        throw new HttpsError('not-found', 'Menu warung tidak tersedia.');
      }

      const charData = charDoc.data()!;
      const statsData = statsDoc.data()!;
      const itemData = itemDoc.data()!;

      if (charData.activeTrip && nowMs < Number(charData.activeTrip.arrivesAtMs || 0)) {
        throw new HttpsError('failed-precondition', 'Sedang dalam perjalanan kereta.');
      }

      const lastPurchaseAt = statsData.lastPurchaseAt as Timestamp | undefined;
      if (lastPurchaseAt && nowMs - lastPurchaseAt.toMillis() < PURCHASE_COOLDOWN_MS) {
        throw new HttpsError('resource-exhausted', 'Tunggu sebentar sebelum membeli lagi.');
      }

      const price = Number(itemData.price);
      const currentMoney = Number(charData.money);
      if (currentMoney < price) {
        throw new HttpsError('failed-precondition', 'Saldo Rupiah tidak mencukupi.');
      }

      const rates = configDoc.exists
        ? {
            hungerDecayPerHour: Number(configDoc.data()?.hungerDecayPerHour ?? DEFAULT_DECAY_RATES.hungerDecayPerHour),
            thirstDecayPerHour: Number(configDoc.data()?.thirstDecayPerHour ?? DEFAULT_DECAY_RATES.thirstDecayPerHour),
            energyDecayPerHour: Number(configDoc.data()?.energyDecayPerHour ?? DEFAULT_DECAY_RATES.energyDecayPerHour),
          }
        : DEFAULT_DECAY_RATES;

      const lastCalc = (statsData.lastCalculatedAt as Timestamp).toMillis();
      const currentStats = calculateLazyStats(
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
        rates
      );

      const faintCheck = applyFaintingOutcome(
        tx,
        db,
        uid,
        currentStats,
        currentMoney,
        Number(charData.faintedCount || 0),
        nowMs
      );
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

      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'warung',
        amount: price,
        balanceAfter: newMoney,
        description: `Beli ${String(itemData.name)} di Warung Teh Neng`,
        nowMs,
      });

      const invRef = db.collection('items').doc(`${uid}_${itemId}`);
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
  }
);
