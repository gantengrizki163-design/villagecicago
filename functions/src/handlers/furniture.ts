import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION, rtdb } from '../helpers/firebase';
import {
  buildMemberAccessRef,
  getFurnitureCatalogItem,
  isValidSimpleId,
  type PlacedFurnitureItem,
} from '../helpers/housing';
import { assertNearLocation } from '../helpers/location';
import { appendTransaction, furnitureConfig } from '../helpers/phase2';

export const buyFurniture = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    const uid = request.auth.uid;
    const data = request.data as { furnitureId?: unknown; quantity?: unknown };
    const furnitureId = typeof data?.furnitureId === 'string' ? data.furnitureId.trim() : '';
    const quantity = Math.max(1, Math.min(5, Math.floor(Number(data?.quantity ?? 1))));

    const item = getFurnitureCatalogItem(furnitureId);
    if (!item) {
      throw new HttpsError('invalid-argument', 'Jenis furnitur tidak ditemukan di Toko Mebel.');
    }

    const nowMs = Date.now();
    const charRef = db.collection('characters').doc(uid);
    const invRef = charRef.collection('inventory').doc(furnitureId);

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
      `Mendekatlah ke ${furnitureConfig.shopLocation.label} untuk membeli furnitur.`
    );

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, invDoc] = await Promise.all([tx.get(charRef), tx.get(invRef)]);
      if (!charDoc.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');

      const charData = charDoc.data()!;
      if ((charData.currentZone || 'cicalengka') !== 'cicalengka') {
        throw new HttpsError('failed-precondition', 'Toko Mebel hanya ada di Cicalengka.');
      }

      const totalCost = item.price * quantity;
      const money = Number(charData.money || 0);
      if (money < totalCost) {
        throw new HttpsError(
          'failed-precondition',
          `Saldo kurang! Butuh Rp ${totalCost.toLocaleString('id-ID')}.`
        );
      }

      const nextMoney = money - totalCost;
      const prevQty = invDoc.exists ? Number(invDoc.data()?.quantity || 0) : 0;

      tx.update(charRef, {
        money: nextMoney,
        updatedAt: Timestamp.fromMillis(nowMs),
      });

      tx.set(invRef, {
        uid,
        itemId: item.id,
        category: 'furniture',
        name: item.name,
        quantity: prevQty + quantity,
        updatedAtMs: nowMs,
      });

      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'mebel',
        amount: totalCost,
        balanceAfter: nextMoney,
        description: `Beli ${quantity}x ${item.name} di Toko Mebel`,
        nowMs,
      });

      return { money: nextMoney, furnitureId: item.id, newQuantity: prevQty + quantity, totalCost };
    });

    return { ok: true, ...result };
  }
);

export const placeFurniture = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    const uid = request.auth.uid;
    const data = request.data as {
      propertyId?: unknown;
      placements?: unknown;
    };

    const propertyId = typeof data?.propertyId === 'string' ? data.propertyId.trim() : '';
    if (!isValidSimpleId(propertyId) || !Array.isArray(data?.placements)) {
      throw new HttpsError('invalid-argument', 'Data tata letak furnitur tidak valid.');
    }

    const rawPlacements = data.placements as Array<{
      instanceId?: unknown;
      furnitureId?: unknown;
      gx?: unknown;
      gz?: unknown;
      rot?: unknown;
    }>;

    if (rawPlacements.length > 40) {
      throw new HttpsError('invalid-argument', 'Jumlah furnitur melebihi batas ruangan.');
    }

    const nowMs = Date.now();
    const charRef = db.collection('characters').doc(uid);
    const propRef = db.collection('properties').doc(propertyId);
    const accessRef = buildMemberAccessRef(db, propertyId, uid);

    const result = await db.runTransaction(async (tx) => {
      const [propDoc, accessDoc, invSnap] = await Promise.all([
        tx.get(propRef),
        tx.get(accessRef),
        tx.get(charRef.collection('inventory').where('category', '==', 'furniture')),
      ]);

      if (!propDoc.exists) throw new HttpsError('not-found', 'Properti tidak ditemukan.');
      const prop = propDoc.data()!;
      const role = accessDoc.exists ? String(accessDoc.data()?.role) : '';
      const isOwner = prop.ownerId === uid;
      if (!isOwner && role !== 'tenant' && role !== 'roommate') {
        throw new HttpsError('permission-denied', 'Tidak berhak mendekorasi hunian ini.');
      }

      const cols = Number(prop.layout?.gridCols ?? prop.size?.width ?? 6);
      const rows = Number(prop.layout?.gridRows ?? prop.size?.depth ?? 6);
      const occupied = new Set<string>();

      const currentFurniture = Array.isArray(prop.furniture)
        ? (prop.furniture as PlacedFurnitureItem[])
        : [];

      // Hitung total stok furnitur yang tersedia untuk ditempatkan (yang sudah terpasang + inventory)
      const availablePool: Record<string, number> = {};
      for (const doc of invSnap.docs) {
        availablePool[doc.id] = Number(doc.data()?.quantity || 0);
      }

      const fixedOtherFurniture: PlacedFurnitureItem[] = [];
      for (const pf of currentFurniture) {
        const belongsToCaller =
          pf.ownerUid === uid || (!pf.ownerUid && isOwner);
        if (belongsToCaller) {
          availablePool[pf.furnitureId] = (availablePool[pf.furnitureId] || 0) + 1;
        } else {
          fixedOtherFurniture.push(pf);
          const cat = getFurnitureCatalogItem(pf.furnitureId);
          const w = pf.rot % 180 === 0 ? cat?.gridW ?? 1 : cat?.gridD ?? 1;
          const d = pf.rot % 180 === 0 ? cat?.gridD ?? 1 : cat?.gridW ?? 1;
          for (let dx = 0; dx < w; dx++) {
            for (let dz = 0; dz < d; dz++) {
              occupied.add(`${pf.gx + dx},${pf.gz + dz}`);
            }
          }
        }
      }

      const usedCounts: Record<string, number> = {};
      const nextCallerFurniture: PlacedFurnitureItem[] = [];

      for (let i = 0; i < rawPlacements.length; i++) {
        const rp = rawPlacements[i];
        const fId = typeof rp.furnitureId === 'string' ? rp.furnitureId.trim() : '';
        const cat = getFurnitureCatalogItem(fId);
        if (!cat) {
          throw new HttpsError('invalid-argument', `Furnitur tidak dikenal: ${fId}`);
        }

        const gx = Math.floor(Number(rp.gx));
        const gz = Math.floor(Number(rp.gz));
        const rot = ((Math.round(Number(rp.rot || 0) / 90) * 90) % 360 + 360) % 360;
        const w = rot % 180 === 0 ? cat.gridW : cat.gridD;
        const d = rot % 180 === 0 ? cat.gridD : cat.gridW;

        if (gx < 0 || gz < 0 || gx + w > cols || gz + d > rows) {
          throw new HttpsError('invalid-argument', `${cat.name} keluar batas grid ruangan (${cols}x${rows}).`);
        }

        for (let dx = 0; dx < w; dx++) {
          for (let dz = 0; dz < d; dz++) {
            const cell = `${gx + dx},${gz + dz}`;
            if (occupied.has(cell)) {
              throw new HttpsError('failed-precondition', `Posisi ${cat.name} bertabrakan dengan furnitur lain.`);
            }
            occupied.add(cell);
          }
        }

        usedCounts[fId] = (usedCounts[fId] || 0) + 1;
        if (usedCounts[fId] > (availablePool[fId] || 0)) {
          throw new HttpsError('failed-precondition', `Stok ${cat.name} tidak mencukupi.`);
        }

        const instId =
          typeof rp.instanceId === 'string' && isValidSimpleId(rp.instanceId)
            ? rp.instanceId
            : `furn_${nowMs}_${i}`;
        nextCallerFurniture.push({
          instanceId: instId,
          furnitureId: fId,
          gx,
          gz,
          rot,
          ownerUid: uid,
        });
      }

      // Sinkronkan sisa stok kembali ke characters/{uid}/inventory
      const allFurnitureIds = new Set([...Object.keys(availablePool), ...Object.keys(usedCounts)]);
      for (const fId of allFurnitureIds) {
        const remaining = (availablePool[fId] || 0) - (usedCounts[fId] || 0);
        const invDocRef = charRef.collection('inventory').doc(fId);
        if (remaining > 0) {
          const cat = getFurnitureCatalogItem(fId);
          tx.set(invDocRef, {
            uid,
            itemId: fId,
            category: 'furniture',
            name: cat?.name ?? fId,
            quantity: remaining,
            updatedAtMs: nowMs,
          });
        } else {
          tx.delete(invDocRef);
        }
      }

      const finalFurniture = [...fixedOtherFurniture, ...nextCallerFurniture];
      tx.update(propRef, {
        furniture: finalFurniture,
        updatedAtMs: nowMs,
      });

      return { furniture: finalFurniture };
    });

    return { ok: true, ...result };
  }
);
