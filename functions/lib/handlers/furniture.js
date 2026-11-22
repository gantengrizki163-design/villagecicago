"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.placeFurniture = exports.buyFurniture = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const housing_1 = require("../helpers/housing");
const location_1 = require("../helpers/location");
const phase2_1 = require("../helpers/phase2");
exports.buyFurniture = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const furnitureId = typeof data?.furnitureId === 'string' ? data.furnitureId.trim() : '';
    const quantity = Math.max(1, Math.min(5, Math.floor(Number(data?.quantity ?? 1))));
    const item = (0, housing_1.getFurnitureCatalogItem)(furnitureId);
    if (!item) {
        throw new https_1.HttpsError('invalid-argument', 'Jenis furnitur tidak ditemukan di Toko Mebel.');
    }
    const nowMs = Date.now();
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const invRef = charRef.collection('inventory').doc(furnitureId);
    const charPre = await charRef.get();
    if (!charPre.exists)
        throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
    const charPreData = charPre.data();
    if ((charPreData.currentZone || 'cicalengka') !== 'cicalengka') {
        throw new https_1.HttpsError('failed-precondition', 'Toko Mebel hanya ada di Cicalengka.');
    }
    await (0, location_1.assertNearLocation)(firebase_1.rtdb, uid, charPreData, ['toko_mebel'], 0, [], `Mendekatlah ke ${phase2_1.furnitureConfig.shopLocation.label} untuk membeli furnitur.`);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, invDoc] = await Promise.all([tx.get(charRef), tx.get(invRef)]);
        if (!charDoc.exists)
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        const charData = charDoc.data();
        if ((charData.currentZone || 'cicalengka') !== 'cicalengka') {
            throw new https_1.HttpsError('failed-precondition', 'Toko Mebel hanya ada di Cicalengka.');
        }
        const totalCost = item.price * quantity;
        const money = Number(charData.money || 0);
        if (money < totalCost) {
            throw new https_1.HttpsError('failed-precondition', `Saldo kurang! Butuh Rp ${totalCost.toLocaleString('id-ID')}.`);
        }
        const nextMoney = money - totalCost;
        const prevQty = invDoc.exists ? Number(invDoc.data()?.quantity || 0) : 0;
        tx.update(charRef, {
            money: nextMoney,
            updatedAt: firestore_1.Timestamp.fromMillis(nowMs),
        });
        tx.set(invRef, {
            uid,
            itemId: item.id,
            category: 'furniture',
            name: item.name,
            quantity: prevQty + quantity,
            updatedAtMs: nowMs,
        });
        (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
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
});
exports.placeFurniture = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const propertyId = typeof data?.propertyId === 'string' ? data.propertyId.trim() : '';
    if (!(0, housing_1.isValidSimpleId)(propertyId) || !Array.isArray(data?.placements)) {
        throw new https_1.HttpsError('invalid-argument', 'Data tata letak furnitur tidak valid.');
    }
    const rawPlacements = data.placements;
    if (rawPlacements.length > 40) {
        throw new https_1.HttpsError('invalid-argument', 'Jumlah furnitur melebihi batas ruangan.');
    }
    const nowMs = Date.now();
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const propRef = firebase_1.db.collection('properties').doc(propertyId);
    const accessRef = (0, housing_1.buildMemberAccessRef)(firebase_1.db, propertyId, uid);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [propDoc, accessDoc, invSnap] = await Promise.all([
            tx.get(propRef),
            tx.get(accessRef),
            tx.get(charRef.collection('inventory').where('category', '==', 'furniture')),
        ]);
        if (!propDoc.exists)
            throw new https_1.HttpsError('not-found', 'Properti tidak ditemukan.');
        const prop = propDoc.data();
        const role = accessDoc.exists ? String(accessDoc.data()?.role) : '';
        const isOwner = prop.ownerId === uid;
        if (!isOwner && role !== 'tenant' && role !== 'roommate') {
            throw new https_1.HttpsError('permission-denied', 'Tidak berhak mendekorasi hunian ini.');
        }
        const cols = Number(prop.layout?.gridCols ?? prop.size?.width ?? 6);
        const rows = Number(prop.layout?.gridRows ?? prop.size?.depth ?? 6);
        const occupied = new Set();
        const currentFurniture = Array.isArray(prop.furniture)
            ? prop.furniture
            : [];
        // Hitung total stok furnitur yang tersedia untuk ditempatkan (yang sudah terpasang + inventory)
        const availablePool = {};
        for (const doc of invSnap.docs) {
            availablePool[doc.id] = Number(doc.data()?.quantity || 0);
        }
        const fixedOtherFurniture = [];
        for (const pf of currentFurniture) {
            const belongsToCaller = pf.ownerUid === uid || (!pf.ownerUid && isOwner);
            if (belongsToCaller) {
                availablePool[pf.furnitureId] = (availablePool[pf.furnitureId] || 0) + 1;
            }
            else {
                fixedOtherFurniture.push(pf);
                const cat = (0, housing_1.getFurnitureCatalogItem)(pf.furnitureId);
                const w = pf.rot % 180 === 0 ? cat?.gridW ?? 1 : cat?.gridD ?? 1;
                const d = pf.rot % 180 === 0 ? cat?.gridD ?? 1 : cat?.gridW ?? 1;
                for (let dx = 0; dx < w; dx++) {
                    for (let dz = 0; dz < d; dz++) {
                        occupied.add(`${pf.gx + dx},${pf.gz + dz}`);
                    }
                }
            }
        }
        const usedCounts = {};
        const nextCallerFurniture = [];
        for (let i = 0; i < rawPlacements.length; i++) {
            const rp = rawPlacements[i];
            const fId = typeof rp.furnitureId === 'string' ? rp.furnitureId.trim() : '';
            const cat = (0, housing_1.getFurnitureCatalogItem)(fId);
            if (!cat) {
                throw new https_1.HttpsError('invalid-argument', `Furnitur tidak dikenal: ${fId}`);
            }
            const gx = Math.floor(Number(rp.gx));
            const gz = Math.floor(Number(rp.gz));
            const rot = ((Math.round(Number(rp.rot || 0) / 90) * 90) % 360 + 360) % 360;
            const w = rot % 180 === 0 ? cat.gridW : cat.gridD;
            const d = rot % 180 === 0 ? cat.gridD : cat.gridW;
            if (gx < 0 || gz < 0 || gx + w > cols || gz + d > rows) {
                throw new https_1.HttpsError('invalid-argument', `${cat.name} keluar batas grid ruangan (${cols}x${rows}).`);
            }
            for (let dx = 0; dx < w; dx++) {
                for (let dz = 0; dz < d; dz++) {
                    const cell = `${gx + dx},${gz + dz}`;
                    if (occupied.has(cell)) {
                        throw new https_1.HttpsError('failed-precondition', `Posisi ${cat.name} bertabrakan dengan furnitur lain.`);
                    }
                    occupied.add(cell);
                }
            }
            usedCounts[fId] = (usedCounts[fId] || 0) + 1;
            if (usedCounts[fId] > (availablePool[fId] || 0)) {
                throw new https_1.HttpsError('failed-precondition', `Stok ${cat.name} tidak mencukupi.`);
            }
            const instId = typeof rp.instanceId === 'string' && (0, housing_1.isValidSimpleId)(rp.instanceId)
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
                const cat = (0, housing_1.getFurnitureCatalogItem)(fId);
                tx.set(invDocRef, {
                    uid,
                    itemId: fId,
                    category: 'furniture',
                    name: cat?.name ?? fId,
                    quantity: remaining,
                    updatedAtMs: nowMs,
                });
            }
            else {
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
});
//# sourceMappingURL=furniture.js.map