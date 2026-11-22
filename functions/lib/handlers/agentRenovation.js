"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buyFurnitureSet = exports.completeRenovation = exports.startRenovation = exports.createDevelopmentProject = exports.closeDeal = exports.createClientRequest = exports.becomeAgent = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const housing_1 = require("../helpers/housing");
const law_1 = require("../helpers/law");
const ledger_1 = require("../helpers/ledger");
const location_1 = require("../helpers/location");
const phase2_1 = require("../helpers/phase2");
const propertyAdvanced_1 = require("../helpers/propertyAdvanced");
const NPC_CLIENT_NAMES = [
    'Teh Rina (Pegawai Bank)',
    'Kang Dedi (Insinyur Rancaekek)',
    'Ibu Hj. Siti (Pengusaha Tekstil)',
    'Pak Bambang (Guru SMA)',
    'Neng Salsa (Dokter Muda)',
    'Mang Dadang (Pedagang Grosir)',
];
/**
 * 1. becomeAgent: Ambil lisensi Agen Properti Resmi Priangan.
 */
exports.becomeAgent = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    await (0, law_1.ensurePhase6Configs)();
    const uid = request.auth.uid;
    const data = (request.data || {});
    const payFrom = data.payFrom === 'bank' ? 'bank' : 'wallet';
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const accRef = firebase_1.db.collection('accounts').doc(uid);
    const treasuryRef = firebase_1.db.collection('state').doc('treasury');
    const charPre = await charRef.get();
    if (!charPre.exists)
        throw new https_1.HttpsError('not-found', 'Karakter belum ditemukan.');
    const charPreData = charPre.data();
    if ((charPreData.currentZone || 'cicalengka') !== 'cicalengka') {
        throw new https_1.HttpsError('failed-precondition', 'Pendaftaran agen properti hanya di zona Cicalengka.');
    }
    await (0, location_1.assertNearLocation)(firebase_1.rtdb, uid, charPreData, ['kantor_agen', 'kantor_desa'], 0, [], 'Datangi Kantor Agen Properti Priangan atau Kantor Desa untuk mengurus lisensi agen.');
    const cfg = propertyAdvanced_1.constructionConfig.agentSettings;
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, accDoc, treasuryDoc] = await Promise.all([
            tx.get(charRef),
            payFrom === 'bank' ? tx.get(accRef) : Promise.resolve(null),
            tx.get(treasuryRef),
        ]);
        if (!charDoc.exists)
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        const charData = charDoc.data();
        if (charData.isPropertyAgent) {
            throw new https_1.HttpsError('already-exists', 'Kamu sudah terdaftar sebagai Agen Properti Resmi.');
        }
        const skills = (charData.skills ?? {});
        const kom = Number(skills.komunikasi || 0);
        const hit = Number(skills.hitung || 0);
        const rep = Number(charData.reputation ?? 50);
        const wanted = (0, law_1.computeLazyWantedLevel)(Number(charData.wantedLevel || 0), Number(charData.wantedUpdatedAtMs || nowMs), nowMs);
        if (kom < cfg.minKomunikasi) {
            throw new https_1.HttpsError('failed-precondition', `Skill Komunikasi minimal ${cfg.minKomunikasi} (saat ini ${kom}).`);
        }
        if (hit < cfg.minHitung) {
            throw new https_1.HttpsError('failed-precondition', `Skill Hitung minimal ${cfg.minHitung} (saat ini ${hit}).`);
        }
        if (rep < cfg.minReputation) {
            throw new https_1.HttpsError('failed-precondition', `Reputasi warga minimal ${cfg.minReputation} (saat ini ${rep}).`);
        }
        if (wanted > 0) {
            throw new https_1.HttpsError('failed-precondition', 'Bersihkan status DPO terlebih dahulu sebelum menjadi agen.');
        }
        const fee = cfg.licenseFee;
        const walletMoney = Number(charData.money || 0);
        const bankBalance = accDoc?.exists ? Number(accDoc.data().balance || 0) : 0;
        if (payFrom === 'bank') {
            if (!accDoc?.exists || bankBalance < fee) {
                throw new https_1.HttpsError('failed-precondition', `Saldo bank kurang untuk biaya lisensi agen Rp ${fee.toLocaleString('id-ID')}.`);
            }
        }
        else if (walletMoney < fee) {
            throw new https_1.HttpsError('failed-precondition', `Uang tunai kurang untuk biaya lisensi agen Rp ${fee.toLocaleString('id-ID')}.`);
        }
        const nextWalletMoney = payFrom === 'wallet' ? walletMoney - fee : walletMoney;
        const nextBankBalance = payFrom === 'bank' ? bankBalance - fee : bankBalance;
        if (payFrom === 'bank' && accDoc?.exists) {
            tx.update(accRef, { balance: nextBankBalance, updatedAtMs: nowMs });
        }
        tx.update(charRef, {
            money: nextWalletMoney,
            isPropertyAgent: true,
            agentStats: {
                licensedAtMs: nowMs,
                dealsClosed: 0,
                totalCommission: 0,
            },
            reputation: Math.min(100, rep + 3),
            updatedAt: now,
        });
        (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
            type: 'expense',
            category: 'lisensi_agen',
            amount: fee,
            balanceAfter: nextWalletMoney,
            description: 'Lisensi Resmi Agen Properti Priangan',
            nowMs,
        });
        (0, ledger_1.applyTreasuryCredit)(tx, firebase_1.db, treasuryDoc, fee, 'property', nowMs);
        (0, ledger_1.appendLedger)(tx, firebase_1.db, {
            from: uid,
            to: 'system:treasury',
            amount: fee,
            taxAmount: fee,
            reason: 'property_agent_license',
            refId: `agent_${uid}`,
            nowMs,
        });
        return {
            isPropertyAgent: true,
            fee,
            money: nextWalletMoney,
            bankBalance: nextBankBalance,
        };
    });
    return { ok: true, ...result };
});
/**
 * 2. createClientRequest: Agen properti menerima prospek klien NPC pembeli/penyewa baru.
 */
exports.createClientRequest = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    await (0, law_1.ensurePhase6Configs)();
    const uid = request.auth.uid;
    const data = (request.data || {});
    const allowedAreas = ['stasiun', 'pasar', 'kampung', 'perumahan', 'alun_alun', 'any'];
    const allowedTypes = ['kos', 'kontrakan', 'apartemen', 'ruko', 'rumah', 'any'];
    const desiredArea = typeof data.desiredArea === 'string' && allowedAreas.includes(data.desiredArea)
        ? data.desiredArea
        : 'any';
    const desiredType = typeof data.desiredType === 'string' && allowedTypes.includes(data.desiredType)
        ? data.desiredType
        : 'any';
    const desiredKind = data.desiredKind === 'rent' ? 'rent' : 'sale';
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const [charSnap, openClientsSnap] = await Promise.all([
        charRef.get(),
        firebase_1.db
            .collection('agent_clients')
            .where('agentId', '==', uid)
            .where('status', '==', 'open')
            .limit(6)
            .get(),
    ]);
    if (!charSnap.exists)
        throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
    if (!charSnap.data().isPropertyAgent) {
        throw new https_1.HttpsError('failed-precondition', 'Kamu belum memiliki lisensi Agen Properti.');
    }
    if (openClientsSnap.size >= 5) {
        throw new https_1.HttpsError('failed-precondition', 'Maksimal 5 klien aktif ditangani sekaligus. Tutup transaksi dulu.');
    }
    const nowMs = Date.now();
    const clientId = `cli_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
    const npcName = NPC_CLIENT_NAMES[Math.floor(Math.random() * NPC_CLIENT_NAMES.length)];
    const saleBudgets = {
        kos: 650_000,
        kontrakan: 1_250_000,
        apartemen: 2_100_000,
        ruko: 2_900_000,
        rumah: 4_200_000,
        any: 3_600_000,
    };
    const rentBudgets = {
        kos: 55_000,
        kontrakan: 105_000,
        apartemen: 165_000,
        ruko: 210_000,
        rumah: 290_000,
        any: 240_000,
    };
    const baseBudget = desiredKind === 'rent'
        ? rentBudgets[desiredType] ?? 180_000
        : saleBudgets[desiredType] ?? 2_600_000;
    const jitter = 0.9 + Math.random() * 0.25;
    const maxBudget = Math.round((baseBudget * jitter) / 5000) * 5000;
    const clientDoc = {
        id: clientId,
        agentId: uid,
        clientName: npcName,
        isNpc: true,
        desiredArea,
        desiredType,
        desiredKind,
        maxBudget,
        commissionRate: propertyAdvanced_1.constructionConfig.agentSettings.baseCommissionRate,
        status: 'open',
        createdAtMs: nowMs,
    };
    await firebase_1.db.collection('agent_clients').doc(clientId).set(clientDoc);
    return { ok: true, client: clientDoc };
});
/**
 * 3. closeDeal: Agen memadankan klien aktif dengan listing properti aktif untuk memperoleh komisi 4%.
 */
exports.closeDeal = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    await (0, law_1.ensurePhase6Configs)();
    const uid = request.auth.uid;
    const data = (request.data || {});
    const clientId = (0, housing_1.isValidSimpleId)(data.clientId) ? data.clientId.trim() : '';
    const listingId = (0, housing_1.isValidSimpleId)(data.listingId) ? data.listingId.trim() : '';
    if (!clientId || !listingId) {
        throw new https_1.HttpsError('invalid-argument', 'ID klien dan ID listing wajib dipilih.');
    }
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const clientRef = firebase_1.db.collection('agent_clients').doc(clientId);
    const listingRef = firebase_1.db.collection('property_listings').doc(listingId);
    const treasuryRef = firebase_1.db.collection('state').doc('treasury');
    const listingPre = await listingRef.get();
    if (!listingPre.exists)
        throw new https_1.HttpsError('not-found', 'Listing properti tidak ditemukan.');
    const listingPreData = listingPre.data();
    const propId = String(listingPreData.propertyId);
    const propRef = firebase_1.db.collection('properties').doc(propId);
    const sellerUid = listingPreData.ownerType === 'player' ? String(listingPreData.ownerId) : null;
    const sellerRef = sellerUid ? firebase_1.db.collection('characters').doc(sellerUid) : null;
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, clientDoc, listingDoc, propDoc, treasuryDoc, sellerDoc] = await Promise.all([
            tx.get(charRef),
            tx.get(clientRef),
            tx.get(listingRef),
            tx.get(propRef),
            tx.get(treasuryRef),
            sellerRef ? tx.get(sellerRef) : Promise.resolve(null),
        ]);
        if (!charDoc.exists || !clientDoc.exists || !listingDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Data agen, klien, atau listing tidak ditemukan.');
        }
        const charData = charDoc.data();
        const client = clientDoc.data();
        const listing = listingDoc.data();
        if (!charData.isPropertyAgent) {
            throw new https_1.HttpsError('failed-precondition', 'Hanya Agen Properti berlisensi yang bisa menutup transaksi.');
        }
        if (client.agentId !== uid) {
            throw new https_1.HttpsError('permission-denied', 'Klien ini bukan prospek milikmu.');
        }
        if (client.status !== 'open') {
            throw new https_1.HttpsError('failed-precondition', 'Permintaan klien ini sudah selesai.');
        }
        if (listing.status !== 'active') {
            throw new https_1.HttpsError('failed-precondition', 'Listing properti ini sudah tidak aktif.');
        }
        if (listing.ownerId === uid) {
            throw new https_1.HttpsError('failed-precondition', 'Tidak dapat mengambil komisi agen dari listing milik sendiri.');
        }
        if (client.desiredKind && listing.kind !== client.desiredKind) {
            throw new https_1.HttpsError('failed-precondition', `Klien mencari transaksi "${String(client.desiredKind)}", sedangkan listing berjenis "${String(listing.kind)}".`);
        }
        if (client.desiredArea !== 'any' && listing.areaTag !== client.desiredArea) {
            throw new https_1.HttpsError('failed-precondition', `Klien menginginkan area ${String(client.desiredArea)}, bukan ${String(listing.areaTag)}.`);
        }
        if (client.desiredType !== 'any' && listing.propertyType !== client.desiredType) {
            throw new https_1.HttpsError('failed-precondition', `Klien menginginkan tipe ${String(client.desiredType)}, bukan ${String(listing.propertyType)}.`);
        }
        const price = Number(listing.price || 0);
        if (price > Number(client.maxBudget || 0)) {
            throw new https_1.HttpsError('failed-precondition', `Harga listing (Rp ${price.toLocaleString('id-ID')}) melebihi anggaran klien (Rp ${Number(client.maxBudget).toLocaleString('id-ID')}).`);
        }
        const rate = Number(client.commissionRate || propertyAdvanced_1.constructionConfig.agentSettings.baseCommissionRate);
        const commission = Math.max(2500, Math.round(price * (listing.kind === 'rent' ? Math.max(0.15, rate * 3) : rate)));
        // Jika transaksi jual properti pemain ke klien NPC, transfer dana hasil jual ke penjual & pindahkan aset
        if (listing.kind === 'sale' && sellerDoc?.exists && sellerRef) {
            const transferTax = Math.round(price * 0.025);
            const netSeller = Math.max(0, price - commission);
            const sellerNextMoney = Number(sellerDoc.data().money || 0) + netSeller;
            tx.update(sellerRef, { money: sellerNextMoney, updatedAt: now });
            (0, phase2_1.appendTransaction)(tx, firebase_1.db, sellerUid, {
                type: 'income',
                category: 'jual_via_agen',
                amount: netSeller,
                balanceAfter: sellerNextMoney,
                description: `Penjualan ${String(listing.propertyName)} melalui agen ${String(charData.name)}`,
                nowMs,
            });
            (0, ledger_1.applyTreasuryCredit)(tx, firebase_1.db, treasuryDoc, transferTax, 'property', nowMs);
            if (propDoc.exists) {
                tx.update(propRef, {
                    ownerId: `npc_buyer_${clientId}`,
                    ownerType: 'npc',
                    ownerName: String(client.clientName),
                    activeListingId: null,
                    mortgageInfo: null,
                    updatedAtMs: nowMs,
                });
            }
            tx.update(listingRef, { status: 'closed' });
        }
        else if (listing.kind === 'sale' && listing.ownerType !== 'player') {
            tx.update(listingRef, { status: 'closed' });
            if (propDoc.exists) {
                tx.update(propRef, { activeListingId: null, updatedAtMs: nowMs });
            }
        }
        else {
            tx.update(listingRef, { status: 'closed' });
            if (propDoc.exists) {
                tx.update(propRef, { activeListingId: null, updatedAtMs: nowMs });
            }
        }
        const nextMoney = Number(charData.money || 0) + commission;
        const prevSkills = (charData.skills ?? {});
        const prevAgentStats = (charData.agentStats ?? {});
        tx.update(clientRef, {
            status: 'closed',
            matchedListingId: listingId,
            matchedPropertyName: String(listing.propertyName),
            commissionEarned: commission,
            closedAtMs: nowMs,
        });
        tx.update(charRef, {
            money: nextMoney,
            reputation: Math.min(100, Number(charData.reputation ?? 50) + 2),
            skills: {
                ...prevSkills,
                komunikasi: Number(prevSkills.komunikasi || 0) + 1,
            },
            agentStats: {
                licensedAtMs: Number(prevAgentStats.licensedAtMs || nowMs),
                dealsClosed: Number(prevAgentStats.dealsClosed || 0) + 1,
                totalCommission: Number(prevAgentStats.totalCommission || 0) + commission,
            },
            updatedAt: now,
        });
        (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
            type: 'income',
            category: 'komisi_agen',
            amount: commission,
            balanceAfter: nextMoney,
            description: `Komisi closing ${String(listing.propertyName)} (${String(client.clientName)})`,
            nowMs,
        });
        (0, ledger_1.appendLedger)(tx, firebase_1.db, {
            from: 'system:client_buyer',
            to: uid,
            amount: commission,
            reason: 'agent_deal_commission',
            refId: clientId,
            nowMs,
        });
        return {
            clientId,
            listingId,
            propertyName: String(listing.propertyName),
            commission,
            money: nextMoney,
        };
    });
    return { ok: true, ...result };
});
/**
 * 4. createDevelopmentProject: Mulai proyek pengembang properti multi-unit (Developer).
 */
exports.createDevelopmentProject = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    await (0, law_1.ensurePhase6Configs)();
    const uid = request.auth.uid;
    const data = (request.data || {});
    const name = typeof data.name === 'string' ? data.name.trim().slice(0, 80) : '';
    if (name.length < 3) {
        throw new https_1.HttpsError('invalid-argument', 'Nama proyek developer minimal 3 karakter.');
    }
    const rawPlotIds = Array.isArray(data.plotIds) ? data.plotIds.filter(housing_1.isValidSimpleId).slice(0, 6) : [];
    const nowMs = Date.now();
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const accRef = firebase_1.db.collection('accounts').doc(uid);
    const [charSnap, accSnap, ...plotSnaps] = await Promise.all([
        charRef.get(),
        accRef.get(),
        ...rawPlotIds.map((id) => firebase_1.db.collection('land_plots').doc(id).get()),
    ]);
    if (!charSnap.exists)
        throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
    const charData = charSnap.data();
    const totalLiquid = Number(charData.money || 0) + (accSnap.exists ? Number(accSnap.data().balance || 0) : 0);
    const minCap = propertyAdvanced_1.constructionConfig.agentSettings.developerMinCapital;
    if (!charData.isPropertyAgent && totalLiquid < minCap) {
        throw new https_1.HttpsError('failed-precondition', `Modal likuid minimal Rp ${minCap.toLocaleString('id-ID')} atau berstatus Agen Properti untuk membuka proyek developer.`);
    }
    const validPlotIds = [];
    for (const pSnap of plotSnaps) {
        if (pSnap.exists && pSnap.data().ownerId === uid) {
            validPlotIds.push(pSnap.id);
        }
    }
    const projectId = `dev_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
    const projectDoc = {
        id: projectId,
        developerId: uid,
        developerName: String(charData.name || 'Developer'),
        name,
        plotIds: validPlotIds,
        constructionIds: [],
        propertyIds: [],
        totalCapitalSpent: 0,
        totalRevenue: 0,
        status: 'planning',
        createdAtMs: nowMs,
    };
    await firebase_1.db.collection('dev_projects').doc(projectId).set(projectDoc);
    return { ok: true, project: projectDoc };
});
/**
 * 5. startRenovation: Mulai renovasi besar pada properti milik sendiri (tambah kamar/lantai/taman/pagar/garasi).
 */
exports.startRenovation = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    await (0, law_1.ensurePhase6Configs)();
    const uid = request.auth.uid;
    const data = (request.data || {});
    const propertyId = (0, housing_1.isValidSimpleId)(data.propertyId) ? data.propertyId.trim() : '';
    const renovationType = typeof data.renovationType === 'string' ? data.renovationType.trim() : '';
    const payFrom = data.payFrom === 'bank' ? 'bank' : 'wallet';
    const renovationsCatalog = propertyAdvanced_1.constructionConfig.renovations;
    const def = renovationsCatalog[renovationType];
    if (!propertyId || !def) {
        throw new https_1.HttpsError('invalid-argument', 'ID properti atau jenis renovasi tidak valid.');
    }
    const materialIds = Object.keys(def.materials || {});
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const accRef = firebase_1.db.collection('accounts').doc(uid);
    const propRef = firebase_1.db.collection('properties').doc(propertyId);
    const renovationId = `ren_${propertyId}_${nowMs}`;
    const renRef = firebase_1.db.collection('renovations').doc(renovationId);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, accDoc, propDoc, ...matDocs] = await Promise.all([
            tx.get(charRef),
            payFrom === 'bank' ? tx.get(accRef) : Promise.resolve(null),
            tx.get(propRef),
            ...materialIds.map((mId) => tx.get(charRef.collection('inventory').doc(mId))),
        ]);
        if (!charDoc.exists || !propDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Karakter atau properti tidak ditemukan.');
        }
        const charData = charDoc.data();
        const prop = propDoc.data();
        if (prop.ownerId !== uid) {
            throw new https_1.HttpsError('permission-denied', 'Hanya pemilik sah yang dapat merenovasi properti ini.');
        }
        if (prop.activeRenovationId) {
            throw new https_1.HttpsError('failed-precondition', 'Properti masih dalam proses renovasi aktif.');
        }
        if (prop.activeAuctionId) {
            throw new https_1.HttpsError('failed-precondition', 'Properti sedang dilelang.');
        }
        // Cek material inventaris
        const missing = [];
        for (let i = 0; i < materialIds.length; i++) {
            const mId = materialIds[i];
            const need = Number(def.materials[mId] || 0);
            const have = matDocs[i].exists ? Number(matDocs[i].data().quantity || 0) : 0;
            if (have < need) {
                const meta = phase2_1.productsConfig.products.find((p) => p.id === mId);
                missing.push(`${meta?.name || mId} (${have}/${need})`);
            }
        }
        if (missing.length > 0) {
            throw new https_1.HttpsError('failed-precondition', `Material kurang: ${missing.join(', ')}. Beli di TB Sumber Karya / Pasar.`);
        }
        const walletMoney = Number(charData.money || 0);
        const bankBalance = accDoc?.exists ? Number(accDoc.data().balance || 0) : 0;
        if (payFrom === 'bank') {
            if (!accDoc?.exists || bankBalance < def.cost) {
                throw new https_1.HttpsError('failed-precondition', `Saldo rekening kurang untuk biaya renovasi Rp ${def.cost.toLocaleString('id-ID')}.`);
            }
        }
        else if (walletMoney < def.cost) {
            throw new https_1.HttpsError('failed-precondition', `Uang tunai kurang untuk biaya renovasi Rp ${def.cost.toLocaleString('id-ID')}.`);
        }
        for (let i = 0; i < materialIds.length; i++) {
            const mId = materialIds[i];
            const need = Number(def.materials[mId] || 0);
            const have = Number(matDocs[i].data().quantity || 0);
            const remain = have - need;
            if (remain <= 0)
                tx.delete(matDocs[i].ref);
            else
                tx.update(matDocs[i].ref, { quantity: remain, updatedAtMs: nowMs });
        }
        const nextWalletMoney = payFrom === 'wallet' ? walletMoney - def.cost : walletMoney;
        const nextBankBalance = payFrom === 'bank' ? bankBalance - def.cost : bankBalance;
        const completesAtMs = nowMs + def.durationSec * 1000;
        tx.set(renRef, {
            id: renovationId,
            ownerId: uid,
            propertyId,
            renovationType,
            label: def.label,
            cost: def.cost,
            startedAtMs: nowMs,
            completesAtMs,
            valueBoost: def.valueBoost,
            status: 'active',
        });
        tx.update(propRef, {
            activeRenovationId: renovationId,
            updatedAtMs: nowMs,
        });
        if (payFrom === 'bank' && accDoc?.exists) {
            tx.update(accRef, { balance: nextBankBalance, updatedAtMs: nowMs });
        }
        tx.update(charRef, { money: nextWalletMoney, updatedAt: now });
        (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
            type: 'expense',
            category: 'renovasi_besar',
            amount: def.cost,
            balanceAfter: nextWalletMoney,
            description: `${def.label} pada ${String(prop.name)}`,
            nowMs,
        });
        (0, ledger_1.appendLedger)(tx, firebase_1.db, {
            from: uid,
            to: 'system:contractor',
            amount: def.cost,
            reason: `renovation_${renovationType}`,
            refId: renovationId,
            nowMs,
        });
        return {
            renovationId,
            propertyId,
            renovationType,
            completesAtMs,
            cost: def.cost,
            valueBoost: def.valueBoost,
            money: nextWalletMoney,
            bankBalance: nextBankBalance,
        };
    });
    return { ok: true, ...result };
});
/**
 * 6. completeRenovation: Finalisasi renovasi besar setelah waktu selesai -> naikkan nilai properti, kamar, & fitur.
 */
exports.completeRenovation = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    await (0, law_1.ensurePhase6Configs)();
    const uid = request.auth.uid;
    const data = (request.data || {});
    const renovationId = (0, housing_1.isValidSimpleId)(data.renovationId) ? data.renovationId.trim() : '';
    if (!renovationId) {
        throw new https_1.HttpsError('invalid-argument', 'ID renovasi wajib diisi.');
    }
    const nowMs = Date.now();
    const renRef = firebase_1.db.collection('renovations').doc(renovationId);
    const renPre = await renRef.get();
    if (!renPre.exists)
        throw new https_1.HttpsError('not-found', 'Proyek renovasi tidak ditemukan.');
    const propId = String(renPre.data().propertyId);
    const propRef = firebase_1.db.collection('properties').doc(propId);
    const renovationsCatalog = propertyAdvanced_1.constructionConfig.renovations;
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [renDoc, propDoc] = await Promise.all([tx.get(renRef), tx.get(propRef)]);
        if (!renDoc.exists || !propDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Data renovasi atau properti tidak ditemukan.');
        }
        const ren = renDoc.data();
        const prop = propDoc.data();
        if (ren.ownerId !== uid) {
            throw new https_1.HttpsError('permission-denied', 'Bukan proyek renovasi milikmu.');
        }
        if (ren.status !== 'active') {
            throw new https_1.HttpsError('failed-precondition', 'Renovasi sudah diselesaikan.');
        }
        if (nowMs < Number(ren.completesAtMs || 0)) {
            const remSec = Math.ceil((Number(ren.completesAtMs || 0) - nowMs) / 1000);
            throw new https_1.HttpsError('failed-precondition', `Renovasi masih berjalan (${remSec} detik lagi).`);
        }
        const def = renovationsCatalog[String(ren.renovationType)] ?? {
            label: 'Renovasi',
            valueBoost: Number(ren.valueBoost || 100_000),
        };
        const curCols = Number(prop.layout?.gridCols ?? prop.size?.width ?? 6);
        const curRows = Number(prop.layout?.gridRows ?? prop.size?.depth ?? 6);
        const gridDelta = Number(def.gridDelta || 0);
        const nextCols = Math.min(12, curCols + gridDelta);
        const nextRows = Math.min(12, curRows + gridDelta);
        const nextBaseValue = Number(prop.baseValue || 500_000) + Number(def.valueBoost || 0);
        const nextRooms = Number(prop.rooms || 1) + Number(def.roomsDelta || 0);
        const nextRenLevel = Number(prop.renovationLevel || 0) + 1;
        const nextCondition = Math.min(100, Math.round(Number(prop.condition ?? 80) + 12));
        const appliedList = Array.isArray(prop.renovationsApplied)
            ? prop.renovationsApplied
            : [];
        if (!appliedList.includes(String(ren.renovationType))) {
            appliedList.push(String(ren.renovationType));
        }
        tx.update(renRef, {
            status: 'completed',
            completedAtMs: nowMs,
        });
        tx.update(propRef, {
            activeRenovationId: null,
            baseValue: nextBaseValue,
            baseRent: Math.round(Number(prop.baseRent || 50_000) * 1.08),
            rooms: nextRooms,
            condition: nextCondition,
            lastConditionDecayAtMs: nowMs,
            renovationLevel: nextRenLevel,
            renovationsApplied: appliedList,
            layout: {
                ...(prop.layout || {}),
                gridCols: nextCols,
                gridRows: nextRows,
            },
            moodBonus: Number(prop.moodBonus || 0) + Number(def.moodBonus || 0),
            securityBonus: Number(prop.securityBonus || 0) + Number(def.securityBonus || 0),
            updatedAtMs: nowMs,
        });
        return {
            renovationId,
            propertyId: propId,
            nextBaseValue,
            nextRooms,
            nextRenLevel,
            nextCols,
            nextRows,
        };
    });
    return { ok: true, ...result };
});
/**
 * 7. buyFurnitureSet: Beli paket furnitur tematik diskon di Toko Mebel Cicalengka.
 */
exports.buyFurnitureSet = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    await (0, law_1.ensurePhase6Configs)();
    const uid = request.auth.uid;
    const data = (request.data || {});
    const setId = (0, housing_1.isValidSimpleId)(data.setId) ? data.setId.trim() : '';
    const payFrom = data.payFrom === 'bank' ? 'bank' : 'wallet';
    const setDef = propertyAdvanced_1.constructionConfig.furnitureSets.find((s) => s.id === setId);
    if (!setDef) {
        throw new https_1.HttpsError('invalid-argument', 'Paket furnitur tidak ditemukan.');
    }
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const accRef = firebase_1.db.collection('accounts').doc(uid);
    const charPre = await charRef.get();
    if (!charPre.exists)
        throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
    const charPreData = charPre.data();
    if ((charPreData.currentZone || 'cicalengka') !== 'cicalengka') {
        throw new https_1.HttpsError('failed-precondition', 'Toko Mebel hanya ada di Cicalengka.');
    }
    await (0, location_1.assertNearLocation)(firebase_1.rtdb, uid, charPreData, ['toko_mebel'], 0, [], `Mendekatlah ke ${phase2_1.furnitureConfig.shopLocation.label} untuk membeli ${setDef.name}.`);
    const itemIds = setDef.itemIds;
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, accDoc, ...invDocs] = await Promise.all([
            tx.get(charRef),
            payFrom === 'bank' ? tx.get(accRef) : Promise.resolve(null),
            ...itemIds.map((fId) => tx.get(charRef.collection('inventory').doc(fId))),
        ]);
        if (!charDoc.exists)
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        const charData = charDoc.data();
        const price = setDef.bundlePrice;
        const walletMoney = Number(charData.money || 0);
        const bankBalance = accDoc?.exists ? Number(accDoc.data().balance || 0) : 0;
        if (payFrom === 'bank') {
            if (!accDoc?.exists || bankBalance < price) {
                throw new https_1.HttpsError('failed-precondition', `Saldo rekening kurang! Butuh Rp ${price.toLocaleString('id-ID')}.`);
            }
        }
        else if (walletMoney < price) {
            throw new https_1.HttpsError('failed-precondition', `Uang tunai kurang! Butuh Rp ${price.toLocaleString('id-ID')}.`);
        }
        const nextWalletMoney = payFrom === 'wallet' ? walletMoney - price : walletMoney;
        const nextBankBalance = payFrom === 'bank' ? bankBalance - price : bankBalance;
        for (let i = 0; i < itemIds.length; i++) {
            const fId = itemIds[i];
            const meta = (0, housing_1.getFurnitureCatalogItem)(fId);
            const prevQty = invDocs[i].exists ? Number(invDocs[i].data().quantity || 0) : 0;
            tx.set(invDocs[i].ref, {
                uid,
                itemId: fId,
                category: 'furniture',
                name: meta?.name ?? fId,
                quantity: prevQty + 1,
                updatedAtMs: nowMs,
            });
        }
        if (payFrom === 'bank' && accDoc?.exists) {
            tx.update(accRef, { balance: nextBankBalance, updatedAtMs: nowMs });
        }
        tx.update(charRef, { money: nextWalletMoney, updatedAt: now });
        (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
            type: 'expense',
            category: 'mebel_paket',
            amount: price,
            balanceAfter: nextWalletMoney,
            description: `Beli ${setDef.name} (${itemIds.length} item)`,
            nowMs,
        });
        (0, ledger_1.appendLedger)(tx, firebase_1.db, {
            from: uid,
            to: 'system:furniture_shop',
            amount: price,
            reason: `furniture_set_${setId}`,
            refId: setId,
            nowMs,
        });
        return {
            setId,
            setName: setDef.name,
            itemIds,
            price,
            money: nextWalletMoney,
            bankBalance: nextBankBalance,
        };
    });
    return { ok: true, ...result };
});
//# sourceMappingURL=agentRenovation.js.map