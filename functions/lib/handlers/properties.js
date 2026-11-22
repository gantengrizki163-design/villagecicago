"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setViewingSchedule = exports.grantGuestAccess = exports.repairProperty = exports.leaveProperty = exports.enterProperty = exports.requestViewing = exports.cancelListing = exports.createListing = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const housing_1 = require("../helpers/housing");
const location_1 = require("../helpers/location");
const phase2_1 = require("../helpers/phase2");
exports.createListing = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const propertyId = typeof data?.propertyId === 'string' ? data.propertyId.trim() : '';
    const kind = data?.kind === 'sale' ? 'sale' : data?.kind === 'rent' ? 'rent' : null;
    const price = Math.round(Number(data?.price || 0));
    const deposit = kind === 'rent' ? Math.max(0, Math.round(Number(data?.deposit ?? price))) : 0;
    if (!(0, housing_1.isValidSimpleId)(propertyId) || !kind || price < 10_000 || price > 100_000_000) {
        throw new https_1.HttpsError('invalid-argument', 'Data listing properti tidak valid.');
    }
    const nowMs = Date.now();
    const propRef = firebase_1.db.collection('properties').doc(propertyId);
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [propDoc, charDoc] = await Promise.all([tx.get(propRef), tx.get(charRef)]);
        if (!propDoc.exists || !charDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Properti atau karakter tidak ditemukan.');
        }
        const prop = propDoc.data();
        const charData = charDoc.data();
        if (prop.ownerId !== uid) {
            throw new https_1.HttpsError('permission-denied', 'Kamu bukan pemilik properti ini.');
        }
        if (kind === 'sale' && prop.mortgageInfo?.status === 'active') {
            throw new https_1.HttpsError('failed-precondition', 'Properti masih menjadi agunan KPR aktif — lunasi KPR sebelum menjual.');
        }
        if (prop.activeAuctionId || prop.activeRenovationId) {
            throw new https_1.HttpsError('failed-precondition', 'Properti sedang dalam proses lelang atau renovasi aktif.');
        }
        if (kind === 'rent' && prop.activeLeaseId) {
            throw new https_1.HttpsError('failed-precondition', 'Properti sedang disewa orang lain.');
        }
        if (prop.activeListingId) {
            throw new https_1.HttpsError('failed-precondition', 'Properti masih memiliki listing aktif.');
        }
        const condition = (0, housing_1.computeLazyPropertyCondition)(Number(prop.condition ?? 80), Number(prop.lastConditionDecayAtMs ?? nowMs), nowMs);
        const listingId = `list_${propertyId}_${nowMs}`;
        const listingRef = firebase_1.db.collection('property_listings').doc(listingId);
        tx.set(listingRef, {
            id: listingId,
            propertyId,
            propertyName: String(prop.name),
            propertyType: String(prop.type),
            areaTag: String(prop.areaTag),
            rooms: Number(prop.rooms || 1),
            condition: Math.round(condition),
            stationDistanceTier: String(prop.stationDistanceTier || 'sedang'),
            ownerId: uid,
            ownerType: 'player',
            ownerName: String(charData.name),
            kind,
            price,
            deposit,
            status: 'active',
            createdAtMs: nowMs,
            expiresAtMs: nowMs + 30 * 24 * 3_600_000,
        });
        tx.update(propRef, {
            activeListingId: listingId,
            condition,
            lastConditionDecayAtMs: nowMs,
            updatedAtMs: nowMs,
        });
        return { listingId, price, deposit, kind };
    });
    return { ok: true, ...result };
});
exports.cancelListing = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const listingId = typeof data?.listingId === 'string' ? data.listingId.trim() : '';
    if (!(0, housing_1.isValidSimpleId)(listingId)) {
        throw new https_1.HttpsError('invalid-argument', 'ID listing tidak valid.');
    }
    const nowMs = Date.now();
    const listingRef = firebase_1.db.collection('property_listings').doc(listingId);
    await firebase_1.db.runTransaction(async (tx) => {
        const listingDoc = await tx.get(listingRef);
        if (!listingDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Listing tidak ditemukan.');
        }
        const listing = listingDoc.data();
        if (listing.ownerId !== uid) {
            throw new https_1.HttpsError('permission-denied', 'Bukan pemilik listing ini.');
        }
        const propRef = firebase_1.db.collection('properties').doc(String(listing.propertyId));
        const propDoc = await tx.get(propRef);
        tx.update(listingRef, { status: 'cancelled' });
        if (propDoc.exists && propDoc.data()?.activeListingId === listingId) {
            tx.update(propRef, { activeListingId: null, updatedAtMs: nowMs });
        }
    });
    return { ok: true, listingId };
});
exports.requestViewing = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const propertyId = typeof data?.propertyId === 'string' ? data.propertyId.trim() : '';
    if (!(0, housing_1.isValidSimpleId)(propertyId)) {
        throw new https_1.HttpsError('invalid-argument', 'ID properti tidak valid.');
    }
    const nowMs = Date.now();
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const propRef = firebase_1.db.collection('properties').doc(propertyId);
    const accessRef = (0, housing_1.buildMemberAccessRef)(firebase_1.db, propertyId, uid);
    const [charPre, propPre] = await Promise.all([charRef.get(), propRef.get()]);
    if (!charPre.exists) {
        throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
    }
    if (!propPre.exists) {
        throw new https_1.HttpsError('not-found', 'Properti tidak ditemukan.');
    }
    const charPreData = charPre.data();
    if ((charPreData.currentZone || 'cicalengka') !== 'cicalengka') {
        throw new https_1.HttpsError('failed-precondition', 'Survei rumah hanya tersedia di Cicalengka.');
    }
    const propTarget = (0, location_1.buildDynamicPropertyTarget)(propertyId, propPre.data());
    await (0, location_1.assertNearLocation)(firebase_1.rtdb, uid, charPreData, [], 0, [propTarget], `Mendekatlah ke ${propTarget.label} untuk survei.`);
    const areaSnap = await firebase_1.db
        .collection('property_listings')
        .where('status', '==', 'active')
        .limit(20)
        .get();
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, propDoc, accessDoc] = await Promise.all([
            tx.get(charRef),
            tx.get(propRef),
            tx.get(accessRef),
        ]);
        if (!charDoc.exists || !propDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Properti tidak ditemukan.');
        }
        const prop = propDoc.data();
        const sched = prop.viewingSchedule;
        if (sched && !sched.open24h && prop.ownerId !== uid) {
            const hour = (0, housing_1.getGameHourFromNow)(nowMs);
            const start = Number(sched.startHour ?? 7);
            const end = Number(sched.endHour ?? 21);
            const allowed = start <= end ? hour >= start && hour <= end : hour >= start || hour <= end;
            if (!allowed) {
                throw new https_1.HttpsError('failed-precondition', `Pemilik hanya membuka survei pukul ${String(start).padStart(2, '0')}:00–${String(end).padStart(2, '0')}:00.`);
            }
        }
        const condition = (0, housing_1.computeLazyPropertyCondition)(Number(prop.condition ?? 80), Number(prop.lastConditionDecayAtMs ?? nowMs), nowMs);
        const areaCount = areaSnap.docs.filter((d) => d.data().areaTag === prop.areaTag).length;
        const estimatedValue = (0, housing_1.computeDynamicPropertyValue)({
            baseValue: Number(prop.baseValue || 500_000),
            areaTag: String(prop.areaTag),
            stationDistanceTier: String(prop.stationDistanceTier || 'sedang'),
            condition,
            furniture: (prop.furniture ?? []),
        }, areaCount);
        const viewingId = `view_${propertyId}_${uid}_${nowMs}`;
        const expiresAtMs = nowMs + 15 * 60_000;
        tx.set(firebase_1.db.collection('property_viewings').doc(viewingId), {
            id: viewingId,
            propertyId,
            viewerId: uid,
            ownerId: String(prop.ownerId),
            viewedAtMs: nowMs,
            expiresAtMs,
            conditionAtViewing: condition,
        });
        const existingRole = accessDoc.exists ? String(accessDoc.data()?.role) : null;
        if (!existingRole || existingRole === 'viewer' || existingRole === 'guest') {
            tx.set(accessRef, {
                uid,
                propertyId,
                role: 'viewer',
                grantedAtMs: nowMs,
                expiresAtMs,
            });
        }
        tx.update(propRef, {
            condition,
            lastConditionDecayAtMs: nowMs,
        });
        return {
            property: {
                ...prop,
                condition,
                estimatedValue,
            },
            role: existingRole || 'viewer',
            viewingOnly: !existingRole || existingRole === 'viewer',
        };
    });
    return { ok: true, ...result };
});
exports.enterProperty = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const propertyId = typeof data?.propertyId === 'string' ? data.propertyId.trim() : '';
    if (!(0, housing_1.isValidSimpleId)(propertyId)) {
        throw new https_1.HttpsError('invalid-argument', 'ID properti tidak valid.');
    }
    const nowMs = Date.now();
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const propRef = firebase_1.db.collection('properties').doc(propertyId);
    const accessRef = (0, housing_1.buildMemberAccessRef)(firebase_1.db, propertyId, uid);
    const [charPre, propPre] = await Promise.all([charRef.get(), propRef.get()]);
    if (!charPre.exists) {
        throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
    }
    if (!propPre.exists) {
        throw new https_1.HttpsError('not-found', 'Properti tidak ditemukan.');
    }
    const charPreData = charPre.data();
    if ((charPreData.currentZone || 'cicalengka') !== 'cicalengka') {
        throw new https_1.HttpsError('failed-precondition', 'Kamu harus berada di Cicalengka.');
    }
    const propTarget = (0, location_1.buildDynamicPropertyTarget)(propertyId, propPre.data());
    await (0, location_1.assertNearLocation)(firebase_1.rtdb, uid, charPreData, [], 0, [propTarget], `Mendekatlah ke pintu ${propTarget.label}.`);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, propDoc, accessDoc] = await Promise.all([
            tx.get(charRef),
            tx.get(propRef),
            tx.get(accessRef),
        ]);
        if (!charDoc.exists || !propDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Properti tidak ditemukan.');
        }
        const prop = propDoc.data();
        const isOwner = prop.ownerId === uid;
        const accessData = accessDoc.exists ? accessDoc.data() : null;
        const accessExpired = accessData?.expiresAtMs && nowMs > Number(accessData.expiresAtMs);
        if (!isOwner && (!accessData || accessExpired)) {
            throw new https_1.HttpsError('permission-denied', 'Pintu terkunci! Kamu belum memiliki kunci/izin masuk ke hunian ini.');
        }
        const condition = (0, housing_1.computeLazyPropertyCondition)(Number(prop.condition ?? 80), Number(prop.lastConditionDecayAtMs ?? nowMs), nowMs);
        tx.update(propRef, { condition, lastConditionDecayAtMs: nowMs });
        const role = isOwner ? 'owner' : String(accessData?.role || 'guest');
        return {
            property: { ...prop, condition },
            role,
        };
    });
    return { ok: true, ...result };
});
exports.leaveProperty = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    return { ok: true };
});
exports.repairProperty = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const propertyId = typeof data?.propertyId === 'string' ? data.propertyId.trim() : '';
    if (!(0, housing_1.isValidSimpleId)(propertyId)) {
        throw new https_1.HttpsError('invalid-argument', 'ID properti tidak valid.');
    }
    const nowMs = Date.now();
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const propRef = firebase_1.db.collection('properties').doc(propertyId);
    const accessRef = (0, housing_1.buildMemberAccessRef)(firebase_1.db, propertyId, uid);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, propDoc, accessDoc] = await Promise.all([
            tx.get(charRef),
            tx.get(propRef),
            tx.get(accessRef),
        ]);
        if (!charDoc.exists || !propDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Data tidak ditemukan.');
        }
        const charData = charDoc.data();
        const prop = propDoc.data();
        const role = accessDoc.exists ? String(accessDoc.data()?.role) : '';
        if (prop.ownerId !== uid && role !== 'tenant') {
            throw new https_1.HttpsError('permission-denied', 'Hanya pemilik atau penyewa yang dapat merawat properti.');
        }
        const currentCondition = (0, housing_1.computeLazyPropertyCondition)(Number(prop.condition ?? 80), Number(prop.lastConditionDecayAtMs ?? nowMs), nowMs);
        const missing = Math.max(0, Math.round(100 - currentCondition));
        if (missing <= 0) {
            throw new https_1.HttpsError('failed-precondition', 'Kondisi properti sudah 100% prima.');
        }
        const cost = missing * phase2_1.housingConfig.valuationFormula.repairCostPerPoint;
        const money = Number(charData.money || 0);
        if (money < cost) {
            throw new https_1.HttpsError('failed-precondition', `Biaya renovasi Rp ${cost.toLocaleString('id-ID')} tidak cukup.`);
        }
        const nextMoney = money - cost;
        const listingId = typeof prop.activeListingId === 'string' ? prop.activeListingId : null;
        const listingRef = listingId ? firebase_1.db.collection('property_listings').doc(listingId) : null;
        const listingDoc = listingRef ? await tx.get(listingRef) : null;
        tx.update(charRef, {
            money: nextMoney,
            updatedAt: firestore_1.Timestamp.fromMillis(nowMs),
        });
        tx.update(propRef, {
            condition: 100,
            lastConditionDecayAtMs: nowMs,
            updatedAtMs: nowMs,
        });
        if (listingDoc?.exists) {
            tx.update(listingRef, { condition: 100 });
        }
        (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
            type: 'expense',
            category: 'properti',
            amount: cost,
            balanceAfter: nextMoney,
            description: `Renovasi ${String(prop.name)} ke kondisi 100%`,
            nowMs,
        });
        return { money: nextMoney, condition: 100, cost };
    });
    return { ok: true, ...result };
});
exports.grantGuestAccess = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const propertyId = typeof data?.propertyId === 'string' ? data.propertyId.trim() : '';
    const targetName = typeof data?.targetName === 'string' ? data.targetName.trim().toLowerCase() : '';
    const hours = Math.max(1, Math.min(24, Number(data?.durationHours ?? 4)));
    if (!(0, housing_1.isValidSimpleId)(propertyId) || targetName.length < 3 || targetName.length > 20) {
        throw new https_1.HttpsError('invalid-argument', 'ID properti atau nama tamu tidak valid.');
    }
    const nameDoc = await firebase_1.db.collection('character_names').doc(targetName).get();
    if (!nameDoc.exists) {
        throw new https_1.HttpsError('not-found', 'Pemain dengan nama tersebut tidak ditemukan.');
    }
    const targetUid = String(nameDoc.data().uid);
    if (targetUid === uid) {
        throw new https_1.HttpsError('invalid-argument', 'Tidak perlu mengundang diri sendiri.');
    }
    const nowMs = Date.now();
    const propRef = firebase_1.db.collection('properties').doc(propertyId);
    const myAccessRef = (0, housing_1.buildMemberAccessRef)(firebase_1.db, propertyId, uid);
    const guestAccessRef = (0, housing_1.buildMemberAccessRef)(firebase_1.db, propertyId, targetUid);
    await firebase_1.db.runTransaction(async (tx) => {
        const [propDoc, myAccessDoc] = await Promise.all([tx.get(propRef), tx.get(myAccessRef)]);
        if (!propDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Properti tidak ditemukan.');
        }
        const prop = propDoc.data();
        const myRole = myAccessDoc.exists ? String(myAccessDoc.data()?.role) : '';
        if (prop.ownerId !== uid && myRole !== 'tenant' && myRole !== 'roommate') {
            throw new https_1.HttpsError('permission-denied', 'Kamu tidak berhak mengundang tamu ke hunian ini.');
        }
        tx.set(guestAccessRef, {
            uid: targetUid,
            propertyId,
            role: 'guest',
            grantedAtMs: nowMs,
            expiresAtMs: nowMs + hours * 3_600_000,
        });
    });
    return { ok: true, targetUid, guestName: String(nameDoc.data().name), hours };
});
exports.setViewingSchedule = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const propertyId = typeof data?.propertyId === 'string' ? data.propertyId.trim() : '';
    if (!(0, housing_1.isValidSimpleId)(propertyId)) {
        throw new https_1.HttpsError('invalid-argument', 'ID properti tidak valid.');
    }
    const open24h = Boolean(data?.open24h);
    const startHour = Math.max(0, Math.min(23, Math.floor(Number(data?.startHour ?? 7))));
    const endHour = Math.max(0, Math.min(23, Math.floor(Number(data?.endHour ?? 21))));
    const propRef = firebase_1.db.collection('properties').doc(propertyId);
    await firebase_1.db.runTransaction(async (tx) => {
        const propDoc = await tx.get(propRef);
        if (!propDoc.exists)
            throw new https_1.HttpsError('not-found', 'Properti tidak ditemukan.');
        if (propDoc.data().ownerId !== uid) {
            throw new https_1.HttpsError('permission-denied', 'Hanya pemilik yang bisa mengatur jadwal survei.');
        }
        tx.update(propRef, {
            viewingSchedule: { open24h, startHour, endHour },
            updatedAtMs: Date.now(),
        });
    });
    return { ok: true, viewingSchedule: { open24h, startHour, endHour } };
});
//# sourceMappingURL=properties.js.map