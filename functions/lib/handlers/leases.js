"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leaveRoommate = exports.acceptRoommate = exports.inviteRoommate = exports.terminateLease = exports.createLease = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const housing_1 = require("../helpers/housing");
const ledger_1 = require("../helpers/ledger");
const phase2_1 = require("../helpers/phase2");
exports.createLease = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const propertyId = typeof data?.propertyId === 'string' ? data.propertyId.trim() : '';
    const offerId = typeof data?.offerId === 'string' ? data.offerId.trim() : '';
    const period = data?.period === 'monthly' ? 'monthly' : 'weekly';
    const useStarterDiscount = Boolean(data?.useStarterDiscount);
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
        if (charData.activeLeaseId) {
            throw new https_1.HttpsError('failed-precondition', 'Kamu masih memiliki kontrak sewa aktif. Akhiri dulu sebelum menyewa baru.');
        }
        if (prop.ownerId === uid) {
            throw new https_1.HttpsError('failed-precondition', 'Kamu sudah memiliki properti ini.');
        }
        if (prop.activeLeaseId) {
            throw new https_1.HttpsError('failed-precondition', 'Properti ini sedang disewa pemain lain.');
        }
        const listingId = typeof prop.activeListingId === 'string' ? prop.activeListingId : null;
        const listingRef = listingId ? firebase_1.db.collection('property_listings').doc(listingId) : null;
        const listingDoc = listingRef ? await tx.get(listingRef) : null;
        const ownerRef = prop.ownerType === 'player' ? firebase_1.db.collection('characters').doc(String(prop.ownerId)) : null;
        const ownerDoc = ownerRef ? await tx.get(ownerRef) : null;
        const ls = phase2_1.housingConfig.leaseSettings;
        const starter = phase2_1.housingConfig.livingAndSleep.starterOption;
        let agreedWeeklyRent = Number(prop.baseRent || 35_000);
        let deposit = Number(prop.baseDeposit || agreedWeeklyRent);
        if (useStarterDiscount) {
            if (charData.starterHousingClaimed) {
                throw new https_1.HttpsError('failed-precondition', 'Bantuan awal kos murah hanya berlaku 1 kali.');
            }
            if (propertyId !== starter.propertyId) {
                throw new https_1.HttpsError('invalid-argument', 'Diskon awal hanya berlaku di Kos Murah Babakan Warga.');
            }
            agreedWeeklyRent = starter.firstCycleRent;
            deposit = starter.deposit;
        }
        else if (offerDoc?.exists) {
            const off = offerDoc.data();
            if (off.buyerId !== uid ||
                off.propertyId !== propertyId ||
                off.kind !== 'rent' ||
                off.status !== 'accepted') {
                throw new https_1.HttpsError('failed-precondition', 'Penawaran sewa belum disetujui atau tidak sesuai.');
            }
            if (nowMs > Number(off.expiresAtMs || 0)) {
                throw new https_1.HttpsError('failed-precondition', 'Penawaran sudah kedaluwarsa.');
            }
            agreedWeeklyRent = Number(off.amount);
            deposit = Number(listingDoc?.data()?.deposit ?? prop.baseDeposit ?? agreedWeeklyRent);
        }
        else {
            if (!listingDoc?.exists || listingDoc.data()?.status !== 'active' || listingDoc.data()?.kind !== 'rent') {
                throw new https_1.HttpsError('failed-precondition', 'Properti ini sedang tidak dibuka untuk sewa.');
            }
            agreedWeeklyRent = Number(listingDoc.data().price);
            deposit = Number(listingDoc.data().deposit ?? agreedWeeklyRent);
        }
        const periodMs = period === 'monthly' ? ls.monthlyPeriodMs : ls.weeklyPeriodMs;
        const periodRent = period === 'monthly'
            ? Math.round((agreedWeeklyRent * 4 * ls.monthlyRentDiscount) / 500) * 500
            : agreedWeeklyRent;
        const totalUpfront = periodRent + deposit;
        const money = Number(charData.money || 0);
        if (money < totalUpfront) {
            throw new https_1.HttpsError('failed-precondition', `Saldo kurang! Butuh Rp ${totalUpfront.toLocaleString('id-ID')} (Sewa + Deposit).`);
        }
        const condition = (0, housing_1.computeLazyPropertyCondition)(Number(prop.condition ?? 80), Number(prop.lastConditionDecayAtMs ?? nowMs), nowMs);
        const leaseId = `lease_${propertyId}_${nowMs}`;
        const nextMoney = money - totalUpfront;
        tx.set(firebase_1.db.collection('leases').doc(leaseId), {
            id: leaseId,
            propertyId,
            propertyName: String(prop.name),
            tenantId: uid,
            ownerId: String(prop.ownerId),
            ownerType: String(prop.ownerType),
            rent: periodRent,
            deposit,
            depositRefunded: false,
            conditionAtLeaseStart: condition,
            period,
            periodMs,
            startAtMs: nowMs,
            lastBilledPeriod: 0,
            nextDueAtMs: nowMs + periodMs,
            lastUtilityBillAtMs: nowMs,
            missedPeriods: 0,
            status: 'active',
            roommates: [],
            roommateIds: [],
            pendingInvites: [],
            pendingInviteUids: [],
            rules: 'Jaga kebersihan, bayar sewa tepat waktu, dilarang merusak fasilitas.',
        });
        tx.set((0, housing_1.buildMemberAccessRef)(firebase_1.db, propertyId, uid), {
            uid,
            propertyId,
            role: 'tenant',
            grantedAtMs: nowMs,
        });
        tx.update(propRef, {
            activeLeaseId: leaseId,
            activeListingId: useStarterDiscount ? prop.activeListingId : null,
            condition,
            lastConditionDecayAtMs: nowMs,
            updatedAtMs: nowMs,
        });
        if (!useStarterDiscount && listingDoc?.exists) {
            tx.update(listingRef, { status: 'closed' });
        }
        if (offerDoc?.exists) {
            tx.update(offerRef, { status: 'completed' });
        }
        // Bayar ke pemilik pemain (potong pajak sewa 5% ke kas negara)
        if (ownerDoc?.exists) {
            const tax = Math.round(periodRent * ls.rentalIncomeTaxRate);
            const netIncome = periodRent - tax + deposit;
            const ownerNextMoney = Number(ownerDoc.data().money || 0) + netIncome;
            tx.update(ownerRef, {
                money: ownerNextMoney,
                updatedAt: now,
            });
            (0, phase2_1.appendTransaction)(tx, firebase_1.db, String(prop.ownerId), {
                type: 'income',
                category: 'sewa_properti',
                amount: netIncome,
                balanceAfter: ownerNextMoney,
                description: `Sewa & deposit ${String(prop.name)} (pajak Rp ${tax.toLocaleString('id-ID')})`,
                nowMs,
            });
            if (tax > 0) {
                (0, ledger_1.applyTreasuryCredit)(tx, firebase_1.db, treasuryDoc, tax, 'property', nowMs);
                (0, ledger_1.appendLedger)(tx, firebase_1.db, {
                    from: String(prop.ownerId),
                    to: 'system:treasury',
                    amount: tax,
                    taxAmount: tax,
                    reason: 'property_rental_tax',
                    refId: leaseId,
                    nowMs,
                });
            }
        }
        tx.update(charRef, {
            money: nextMoney,
            currentHomeId: propertyId,
            activeLeaseId: leaseId,
            homeless: false,
            starterHousingClaimed: Boolean(charData.starterHousingClaimed) || useStarterDiscount,
            reputation: Math.min(100, Number(charData.reputation ?? 60) + 2),
            updatedAt: now,
        });
        (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
            type: 'expense',
            category: 'sewa_rumah',
            amount: totalUpfront,
            balanceAfter: nextMoney,
            description: `Mulai sewa ${String(prop.name)} (Sewa + Deposit)`,
            nowMs,
        });
        return {
            leaseId,
            propertyId,
            money: nextMoney,
            totalUpfront,
            rent: periodRent,
            deposit,
        };
    });
    return { ok: true, ...result };
});
exports.terminateLease = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const leaseId = typeof data?.leaseId === 'string' ? data.leaseId.trim() : '';
    if (!(0, housing_1.isValidSimpleId)(leaseId)) {
        throw new https_1.HttpsError('invalid-argument', 'ID kontrak sewa tidak valid.');
    }
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const leaseRef = firebase_1.db.collection('leases').doc(leaseId);
    const ownedSnap = await firebase_1.db.collection('properties').where('ownerId', '==', uid).limit(3).get();
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const leaseDoc = await tx.get(leaseRef);
        if (!leaseDoc.exists)
            throw new https_1.HttpsError('not-found', 'Kontrak sewa tidak ditemukan.');
        const lease = leaseDoc.data();
        if (lease.status !== 'active') {
            throw new https_1.HttpsError('failed-precondition', 'Kontrak sewa ini sudah berakhir.');
        }
        if (lease.tenantId !== uid && lease.ownerId !== uid) {
            throw new https_1.HttpsError('permission-denied', 'Kamu bukan pihak pada kontrak ini.');
        }
        const propertyId = String(lease.propertyId);
        const tenantId = String(lease.tenantId);
        const propRef = firebase_1.db.collection('properties').doc(propertyId);
        const tenantRef = firebase_1.db.collection('characters').doc(tenantId);
        const ownerRef = lease.ownerType === 'player' ? firebase_1.db.collection('characters').doc(String(lease.ownerId)) : null;
        const roommates = Array.isArray(lease.roommates)
            ? lease.roommates
            : [];
        const [propDoc, tenantDoc, ownerDoc, ...roommateDocs] = await Promise.all([
            tx.get(propRef),
            tx.get(tenantRef),
            ownerRef ? tx.get(ownerRef) : Promise.resolve(null),
            ...roommates.map((r) => tx.get(firebase_1.db.collection('characters').doc(r.uid))),
        ]);
        if (!propDoc.exists || !tenantDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Data properti atau penyewa tidak ditemukan.');
        }
        const prop = propDoc.data();
        const tenantData = tenantDoc.data();
        const condition = (0, housing_1.computeLazyPropertyCondition)(Number(prop.condition ?? 80), Number(prop.lastConditionDecayAtMs ?? nowMs), nowMs);
        const startCond = Number(lease.conditionAtLeaseStart ?? condition);
        const damagePoints = Math.max(0, Math.round(startCond - condition));
        const damageDeduction = Math.min(Number(lease.deposit || 0), damagePoints * phase2_1.housingConfig.leaseSettings.depositDamageDeductionPerPoint);
        const refund = Math.max(0, Number(lease.deposit || 0) - damageDeduction);
        // Kembalikan furnitur milik penyewa/roommate ke inventory mereka
        const memberSet = new Set([tenantId, ...roommates.map((r) => r.uid)]);
        const placed = Array.isArray(prop.furniture) ? prop.furniture : [];
        const keptFurniture = [];
        const returnMap = {};
        for (const pf of placed) {
            if (pf.ownerUid && memberSet.has(pf.ownerUid)) {
                if (!returnMap[pf.ownerUid])
                    returnMap[pf.ownerUid] = {};
                returnMap[pf.ownerUid][pf.furnitureId] = (returnMap[pf.ownerUid][pf.furnitureId] || 0) + 1;
            }
            else {
                keptFurniture.push(pf);
            }
        }
        for (const [mUid, items] of Object.entries(returnMap)) {
            for (const [fId, qty] of Object.entries(items)) {
                const cat = (0, housing_1.getFurnitureCatalogItem)(fId);
                tx.set(firebase_1.db.collection('characters').doc(mUid).collection('inventory').doc(fId), {
                    uid: mUid,
                    itemId: fId,
                    category: 'furniture',
                    name: cat?.name ?? fId,
                    quantity: qty,
                    updatedAtMs: nowMs,
                }, { merge: true });
            }
        }
        tx.update(leaseRef, {
            status: 'ended',
            depositRefunded: true,
            endedAtMs: nowMs,
        });
        tx.update(propRef, {
            activeLeaseId: null,
            furniture: keptFurniture,
            condition,
            lastConditionDecayAtMs: nowMs,
            updatedAtMs: nowMs,
        });
        for (const mUid of memberSet) {
            tx.delete((0, housing_1.buildMemberAccessRef)(firebase_1.db, propertyId, mUid));
        }
        const tenantNextMoney = Number(tenantData.money || 0) + refund;
        const tenantFallbackOwned = tenantId === uid && ownedSnap.docs.length > 0 ? ownedSnap.docs[0].id : null;
        tx.update(tenantRef, {
            money: tenantNextMoney,
            currentHomeId: tenantFallbackOwned,
            activeLeaseId: null,
            homeless: !tenantFallbackOwned,
            updatedAt: now,
        });
        if (refund > 0) {
            (0, phase2_1.appendTransaction)(tx, firebase_1.db, tenantId, {
                type: 'income',
                category: 'refund_deposit',
                amount: refund,
                balanceAfter: tenantNextMoney,
                description: `Pengembalian deposit ${String(prop.name)} (potongan kerusakan Rp ${damageDeduction.toLocaleString('id-ID')})`,
                nowMs,
            });
        }
        if (ownerDoc?.exists && refund > 0) {
            const ownerNext = Math.max(0, Number(ownerDoc.data().money || 0) - refund);
            tx.update(ownerRef, { money: ownerNext, updatedAt: now });
        }
        for (const rDoc of roommateDocs) {
            if (rDoc.exists && rDoc.data().activeLeaseId === leaseId) {
                tx.update(rDoc.ref, {
                    currentHomeId: null,
                    activeLeaseId: null,
                    homeless: true,
                    updatedAt: now,
                });
            }
        }
        return { refund, damageDeduction };
    });
    return { ok: true, ...result };
});
exports.inviteRoommate = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const leaseId = typeof data?.leaseId === 'string' ? data.leaseId.trim() : '';
    const targetName = typeof data?.targetName === 'string' ? data.targetName.trim().toLowerCase() : '';
    const sharePercent = Math.max(10, Math.min(70, Math.round(Number(data?.sharePercent ?? 50))));
    if (!(0, housing_1.isValidSimpleId)(leaseId) || targetName.length < 3) {
        throw new https_1.HttpsError('invalid-argument', 'Data undangan roommate tidak valid.');
    }
    const nameDoc = await firebase_1.db.collection('character_names').doc(targetName).get();
    if (!nameDoc.exists) {
        throw new https_1.HttpsError('not-found', 'Pemain dengan nama tersebut tidak ditemukan.');
    }
    const targetUid = String(nameDoc.data().uid);
    const targetDisplayName = String(nameDoc.data().name);
    if (targetUid === uid) {
        throw new https_1.HttpsError('invalid-argument', 'Tidak bisa mengundang diri sendiri.');
    }
    const leaseRef = firebase_1.db.collection('leases').doc(leaseId);
    const targetCharRef = firebase_1.db.collection('characters').doc(targetUid);
    await firebase_1.db.runTransaction(async (tx) => {
        const [leaseDoc, targetCharDoc] = await Promise.all([tx.get(leaseRef), tx.get(targetCharRef)]);
        if (!leaseDoc.exists || !targetCharDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Kontrak atau target karakter tidak ditemukan.');
        }
        const lease = leaseDoc.data();
        if (lease.status !== 'active' || lease.tenantId !== uid) {
            throw new https_1.HttpsError('permission-denied', 'Hanya penyewa utama kontrak aktif yang bisa mengundang roommate.');
        }
        const propDoc = await tx.get(firebase_1.db.collection('properties').doc(String(lease.propertyId)));
        const propType = String(propDoc.data()?.type || 'kontrakan');
        const maxRoommates = phase2_1.housingConfig.propertyTypes[propType]
            ?.maxRoommates ?? 2;
        const roommates = Array.isArray(lease.roommates) ? lease.roommates : [];
        if (roommates.length >= maxRoommates) {
            throw new https_1.HttpsError('failed-precondition', `Maksimal ${maxRoommates} roommate untuk tipe hunian ini.`);
        }
        const pending = Array.isArray(lease.pendingInvites)
            ? lease.pendingInvites
            : [];
        const filteredPending = pending.filter((p) => p.uid !== targetUid);
        filteredPending.push({ uid: targetUid, name: targetDisplayName, sharePercent });
        tx.update(leaseRef, {
            pendingInvites: filteredPending,
            pendingInviteUids: filteredPending.map((p) => p.uid),
        });
    });
    return { ok: true, targetUid, targetName: targetDisplayName, sharePercent };
});
exports.acceptRoommate = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const leaseId = typeof data?.leaseId === 'string' ? data.leaseId.trim() : '';
    if (!(0, housing_1.isValidSimpleId)(leaseId)) {
        throw new https_1.HttpsError('invalid-argument', 'ID kontrak tidak valid.');
    }
    const nowMs = Date.now();
    const leaseRef = firebase_1.db.collection('leases').doc(leaseId);
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [leaseDoc, charDoc] = await Promise.all([tx.get(leaseRef), tx.get(charRef)]);
        if (!leaseDoc.exists || !charDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Kontrak tidak ditemukan.');
        }
        const lease = leaseDoc.data();
        const charData = charDoc.data();
        if (lease.status !== 'active') {
            throw new https_1.HttpsError('failed-precondition', 'Kontrak sewa sudah tidak aktif.');
        }
        if (charData.activeLeaseId) {
            throw new https_1.HttpsError('failed-precondition', 'Kamu sudah memiliki kontrak hunian aktif.');
        }
        const pending = Array.isArray(lease.pendingInvites)
            ? lease.pendingInvites
            : [];
        const myInvite = pending.find((p) => p.uid === uid);
        if (!myInvite) {
            throw new https_1.HttpsError('permission-denied', 'Tidak ada undangan roommate untuk kamu.');
        }
        const roommates = Array.isArray(lease.roommates)
            ? lease.roommates
            : [];
        const nextRoommates = [
            ...roommates.filter((r) => r.uid !== uid),
            { uid, name: String(charData.name), sharePercent: myInvite.sharePercent },
        ];
        const nextPending = pending.filter((p) => p.uid !== uid);
        const propertyId = String(lease.propertyId);
        tx.update(leaseRef, {
            roommates: nextRoommates,
            roommateIds: nextRoommates.map((r) => r.uid),
            pendingInvites: nextPending,
            pendingInviteUids: nextPending.map((p) => p.uid),
        });
        tx.set((0, housing_1.buildMemberAccessRef)(firebase_1.db, propertyId, uid), {
            uid,
            propertyId,
            role: 'roommate',
            grantedAtMs: nowMs,
        });
        tx.update(charRef, {
            currentHomeId: propertyId,
            activeLeaseId: leaseId,
            homeless: false,
            updatedAt: firestore_1.Timestamp.fromMillis(nowMs),
        });
        return { propertyId, leaseId, sharePercent: myInvite.sharePercent };
    });
    return { ok: true, ...result };
});
exports.leaveRoommate = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const leaseId = typeof data?.leaseId === 'string' ? data.leaseId.trim() : '';
    if (!(0, housing_1.isValidSimpleId)(leaseId)) {
        throw new https_1.HttpsError('invalid-argument', 'ID kontrak tidak valid.');
    }
    const nowMs = Date.now();
    const leaseRef = firebase_1.db.collection('leases').doc(leaseId);
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const ownedSnap = await firebase_1.db.collection('properties').where('ownerId', '==', uid).limit(1).get();
    await firebase_1.db.runTransaction(async (tx) => {
        const [leaseDoc, charDoc] = await Promise.all([tx.get(leaseRef), tx.get(charRef)]);
        if (!leaseDoc.exists || !charDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Kontrak tidak ditemukan.');
        }
        const lease = leaseDoc.data();
        const roommates = Array.isArray(lease.roommates)
            ? lease.roommates
            : [];
        const nextRoommates = roommates.filter((r) => r.uid !== uid);
        const propertyId = String(lease.propertyId);
        tx.update(leaseRef, {
            roommates: nextRoommates,
            roommateIds: nextRoommates.map((r) => r.uid),
        });
        tx.delete((0, housing_1.buildMemberAccessRef)(firebase_1.db, propertyId, uid));
        const ownedId = ownedSnap.docs.length > 0 ? ownedSnap.docs[0].id : null;
        tx.update(charRef, {
            currentHomeId: ownedId,
            activeLeaseId: null,
            homeless: !ownedId,
            updatedAt: firestore_1.Timestamp.fromMillis(nowMs),
        });
    });
    return { ok: true, leaseId };
});
//# sourceMappingURL=leases.js.map