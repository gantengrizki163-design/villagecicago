"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeNpcAction = exports.getNpcOptions = exports.talkToNpc = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const aiDialog_1 = require("../helpers/aiDialog");
const firebase_1 = require("../helpers/firebase");
const housing_1 = require("../helpers/housing");
const law_1 = require("../helpers/law");
const ledger_1 = require("../helpers/ledger");
const market_1 = require("../helpers/market");
const npcSchedule_1 = require("../helpers/npcSchedule");
const phase2_1 = require("../helpers/phase2");
const validation_1 = require("../helpers/validation");
function getTodayDateKey(nowMs) {
    const d = new Date(nowMs);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
/**
 * 1. talkToNpc: Percakapan NPC cerdas via server-side Gemini AI, FAQ cache, rate limit, & memori ringkas.
 */
exports.talkToNpc = (0, https_1.onCall)({
    region: firebase_1.FUNCTIONS_REGION,
    enforceAppCheck: firebase_1.ENFORCE_APP_CHECK,
    secrets: [aiDialog_1.geminiApiKeySecret],
}, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    await (0, law_1.ensurePhase6Configs)();
    const uid = request.auth.uid;
    const body = request.data;
    const npcId = typeof body?.npcId === 'string' ? body.npcId.trim() : '';
    const rawMessage = typeof body?.message === 'string' ? body.message : '';
    const nowMs = Date.now();
    if (!npcId)
        throw new https_1.HttpsError('invalid-argument', 'ID NPC diperlukan.');
    const npcLookup = (0, npcSchedule_1.getDeterministicNpcById)(npcId, nowMs);
    if (!npcLookup) {
        throw new https_1.HttpsError('not-found', 'Warga NPC tidak ditemukan.');
    }
    const { def: npcDef, pose: npcPose } = npcLookup;
    const sanitized = (0, aiDialog_1.sanitizePlayerDialogInput)(rawMessage);
    if (!sanitized.allowed) {
        return {
            ok: false,
            blocked: true,
            npcId,
            npcName: npcDef.name,
            reply: sanitized.blockReason || 'Pesan tidak dapat diproses.',
            source: 'moderation',
            affinity: 50,
            remainingCalls: law_1.aiConfig.dailyCallsLimit,
        };
    }
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const memId = `${npcId}_${uid}`;
    const memRef = firebase_1.db.collection('npc_memory').doc(memId);
    const dateKey = getTodayDateKey(nowMs);
    const usageRef = firebase_1.db.collection('ai_usage').doc(uid).collection('days').doc(dateKey);
    const [charSnap, memSnap, usageSnap, faqSnap] = await Promise.all([
        charRef.get(),
        memRef.get(),
        usageRef.get(),
        firebase_1.db.collection('ai_faq_cache').limit(15).get(),
    ]);
    if (!charSnap.exists)
        throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
    const charData = charSnap.data();
    const playerPos = await (0, housing_1.getPlayerWorldPos)(firebase_1.rtdb, uid, charData);
    if ((0, validation_1.distance2D)(playerPos.x, playerPos.z, npcPose.x, npcPose.z) > 12) {
        throw new https_1.HttpsError('failed-precondition', `Dekati ${npcDef.name} terlebih dahulu untuk berbicara.`);
    }
    if (npcPose.isSleeping) {
        throw new https_1.HttpsError('failed-precondition', `${npcDef.name} sedang beristirahat tidur. Kembali lagi nanti.`);
    }
    const prevMem = memSnap.exists ? memSnap.data() : {};
    const currentAffinity = Number(prevMem.affinity ?? 50);
    const prevSummary = String(prevMem.summary || '');
    const callsUsed = usageSnap.exists
        ? Number(usageSnap.data()?.count ?? usageSnap.data()?.callsUsed ?? 0)
        : 0;
    const tokensUsed = usageSnap.exists
        ? Number(usageSnap.data()?.tokens ?? usageSnap.data()?.tokensUsed ?? 0)
        : 0;
    // 1. Cek FAQ cache terlebih dahulu (0 token cost)
    const firestoreFaq = faqSnap.docs.map((d) => ({
        key: d.id,
        npcId: String(d.data()?.npcId || '*'),
        keywords: Array.isArray(d.data()?.keywords) ? d.data()?.keywords : [],
        reply: String(d.data()?.reply || ''),
    }));
    const faqHit = (0, aiDialog_1.matchStaticFaqCache)(npcId, sanitized.cleanText, firestoreFaq);
    const dialogCtx = {
        npcId,
        npcName: npcDef.name,
        npcRole: npcDef.role,
        npcPersonality: npcDef.personality,
        npcActivity: npcPose.activity,
        npcZoneTag: npcPose.zoneTag,
        playerName: String(charData.name || 'Warga'),
        playerJobTitle: String(charData.currentJob?.title || 'Warga Umum'),
        playerReputation: Number(charData.reputation ?? 50),
        playerWantedLevel: Number(charData.wantedLevel ?? 0),
        memorySummary: prevSummary,
        affinity: currentAffinity,
    };
    let reply = '';
    let source = 'faq_cache';
    let addedTokens = 0;
    let addedCalls = 0;
    if (faqHit && faqHit.reply) {
        reply = faqHit.reply;
        source = 'faq_cache';
    }
    else if (callsUsed >= Number(law_1.aiConfig.dailyCallsLimit || 25) ||
        tokensUsed >= Number(law_1.aiConfig.dailyTokenLimit || 12000)) {
        reply = (0, aiDialog_1.buildScriptedNpcReply)(dialogCtx, sanitized.cleanText);
        source = 'scripted_fallback';
    }
    else {
        const apiKey = aiDialog_1.geminiApiKeySecret.value() || process.env.GEMINI_API_KEY || '';
        const aiRes = await (0, aiDialog_1.generateNpcAiReply)(dialogCtx, sanitized.cleanText, apiKey);
        reply = aiRes.reply;
        source = aiRes.source;
        addedTokens = aiRes.tokensUsed;
        addedCalls = aiRes.source === 'gemini' ? 1 : 0;
    }
    const nextAffinity = Math.min(100, currentAffinity + 1);
    const nextSummary = (0, aiDialog_1.buildCompactMemorySummary)(prevSummary, sanitized.cleanText, reply);
    const retentionMs = Number(law_1.aiConfig.memoryRetentionDays || 30) * 86_400_000;
    await firebase_1.db.runTransaction(async (tx) => {
        tx.set(memRef, {
            id: memId,
            npcId,
            uid,
            affinity: nextAffinity,
            summary: nextSummary,
            interactionCount: Number(prevMem.interactionCount || 0) + 1,
            lastActivity: npcPose.activity,
            lastMessageAtMs: nowMs,
            expiresAtMs: nowMs + retentionMs,
        }, { merge: true });
        if (addedCalls > 0 || addedTokens > 0) {
            tx.set(usageRef, {
                uid,
                date: dateKey,
                dateKey,
                count: callsUsed + addedCalls,
                tokens: tokensUsed + addedTokens,
                callsUsed: callsUsed + addedCalls,
                tokensUsed: tokensUsed + addedTokens,
                updatedAtMs: nowMs,
                lastCallAtMs: nowMs,
            }, { merge: true });
        }
    });
    return {
        ok: true,
        npcId,
        npcName: npcDef.name,
        npcRole: npcDef.role,
        activity: npcPose.activity,
        zoneTag: npcPose.zoneTag,
        reply,
        source,
        affinity: nextAffinity,
        remainingCalls: Math.max(0, Number(law_1.aiConfig.dailyCallsLimit || 25) - (callsUsed + addedCalls)),
        remainingTokens: Math.max(0, Number(law_1.aiConfig.dailyTokenLimit || 12000) - (tokensUsed + addedTokens)),
    };
});
/**
 * 2. getNpcOptions: Mengembalikan opsi aksi terstruktur, stok NPC, & quest relevan untuk NPC tersebut.
 */
exports.getNpcOptions = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    await (0, law_1.ensurePhase6Configs)();
    const uid = request.auth.uid;
    const body = request.data;
    const npcId = typeof body?.npcId === 'string' ? body.npcId.trim() : '';
    const nowMs = Date.now();
    if (!npcId)
        throw new https_1.HttpsError('invalid-argument', 'ID NPC diperlukan.');
    const npcLookup = (0, npcSchedule_1.getDeterministicNpcById)(npcId, nowMs);
    if (!npcLookup)
        throw new https_1.HttpsError('not-found', 'NPC tidak ditemukan.');
    const { def: npcDef, pose: npcPose } = npcLookup;
    const [memSnap, npcStateSnap, questLogsSnap] = await Promise.all([
        firebase_1.db.collection('npc_memory').doc(`${npcId}_${uid}`).get(),
        firebase_1.db.collection('npc_state').doc(npcId).get(),
        firebase_1.db.collection('characters').doc(uid).collection('quest_log').limit(20).get(),
    ]);
    const mem = memSnap.exists ? memSnap.data() : {};
    const npcState = npcStateSnap.exists ? npcStateSnap.data() : {};
    const activeLogs = questLogsSnap.docs
        .map((d) => d.data())
        .filter((q) => q.status === 'active');
    const dateKey = getTodayDateKey(nowMs);
    const completedTodayIds = new Set(questLogsSnap.docs
        .map((d) => d.data())
        .filter((q) => q.status === 'completed' && (q.dayKey === dateKey || q.dateKey === dateKey))
        .map((q) => String(q.questId)));
    const activeQuestIds = new Set(activeLogs.map((q) => String(q.questId)));
    const options = [
        { actionId: 'greet', label: 'Sapa Ramah (+Keakraban)', category: 'social' },
        { actionId: 'ask_rumor', label: 'Tanya Situasi & Kabar Pasar', category: 'social' },
    ];
    // Quest dari NPC ini atau quest yang bisa diselesaikan di NPC ini
    for (const q of law_1.questsConfig.quests) {
        if (!q.active)
            continue;
        if (activeQuestIds.has(q.id)) {
            if (q.npcId === npcId || q.objective.targetNpcId === npcId) {
                options.push({
                    actionId: 'complete_quest',
                    label: `Selesaikan Tugas: ${q.title}`,
                    category: 'quest',
                    questId: q.id,
                });
            }
        }
        else if (q.npcId === npcId && !completedTodayIds.has(q.id)) {
            options.push({
                actionId: 'accept_quest',
                label: `Ambil Tugas: ${q.title} (+Rp ${q.rewardMoney.toLocaleString('id-ID')})`,
                category: 'quest',
                questId: q.id,
            });
        }
    }
    // Opsi dagang item NPC jika pedagang/pedagang_grosir/petani
    if (['pedagang', 'pedagang_grosir', 'petani'].includes(npcDef.role)) {
        for (const itemId of npcDef.defaultInventory) {
            const meta = (0, market_1.getProductMeta)(itemId);
            if (meta) {
                options.push({
                    actionId: 'buy_npc_item',
                    label: `Beli ${meta.name} (Rp ${meta.suggestedRetail.toLocaleString('id-ID')})`,
                    category: 'trade',
                    itemId,
                    price: meta.suggestedRetail,
                });
            }
        }
    }
    // Layanan terstruktur sesuai peran
    if (npcDef.role.startsWith('polisi')) {
        options.push({
            actionId: 'open_law_panel',
            label: 'Buka Panel Hukum & Laporan Polisi',
            category: 'service',
            uiHint: 'law_panel',
        });
    }
    else if (npcDef.role === 'agen_properti') {
        options.push({
            actionId: 'open_agent_panel',
            label: 'Buka Bursa Kavling & Agen Properti',
            category: 'service',
            uiHint: 'agent_panel',
        });
    }
    else if (npcDef.role === 'pegawai_bank') {
        options.push({
            actionId: 'open_mortgage_panel',
            label: 'Ajukan / Cek Simulasi KPR Bank',
            category: 'service',
            uiHint: 'mortgage_panel',
        });
    }
    else if (npcDef.role === 'pejabat_desa') {
        options.push({
            actionId: 'open_land_panel',
            label: 'Urus IMB & Sertifikat Tanah Desa',
            category: 'service',
            uiHint: 'land_panel',
        });
    }
    else if (npcDef.role === 'kontraktor') {
        options.push({
            actionId: 'open_construction_panel',
            label: 'Konsultasi Bangun Rumah & Renovasi',
            category: 'service',
            uiHint: 'construction_panel',
        });
    }
    return {
        ok: true,
        npcId,
        name: npcDef.name,
        role: npcDef.role,
        personality: npcDef.personality,
        activity: npcPose.activity,
        zoneTag: npcPose.zoneTag,
        isSleeping: npcPose.isSleeping,
        affinity: Number(mem.affinity ?? 50),
        summary: String(mem.summary || ''),
        mood: String(npcState.mood || 'ramah'),
        options,
    };
});
/**
 * 3. executeNpcAction: Eksekusi aksi terstruktur (bukan dari teks bebas AI) dengan validasi server & transaksi.
 */
exports.executeNpcAction = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    await (0, law_1.ensurePhase6Configs)();
    const uid = request.auth.uid;
    const body = request.data;
    const npcId = typeof body?.npcId === 'string' ? body.npcId.trim() : '';
    const actionId = typeof body?.actionId === 'string' ? body.actionId.trim() : '';
    const nowMs = Date.now();
    if (!npcId || !actionId) {
        throw new https_1.HttpsError('invalid-argument', 'ID NPC dan ID aksi diperlukan.');
    }
    const npcLookup = (0, npcSchedule_1.getDeterministicNpcById)(npcId, nowMs);
    if (!npcLookup)
        throw new https_1.HttpsError('not-found', 'NPC tidak ditemukan.');
    const { def: npcDef, pose: npcPose } = npcLookup;
    // Laporkan balasan AI bermasalah untuk moderasi
    if (actionId === 'report_ai_reply') {
        const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 200) : 'Balasan kurang sesuai';
        const repId = `rep_ai_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
        await firebase_1.db.collection('ai_moderation_reports').doc(repId).set({
            id: repId,
            uid,
            npcId,
            reason,
            createdAtMs: nowMs,
            status: 'pending_review',
        });
        return { ok: true, actionId, message: 'Laporan kualitas dialog AI telah dicatat untuk peninjauan.' };
    }
    // Intent navigasi UI
    const uiMap = {
        open_law_panel: { uiHint: 'law_panel', message: 'Membuka layanan hukum Polsek Cicalengka.' },
        open_agent_panel: { uiHint: 'agent_panel', message: 'Membuka bursa kavling & agen properti.' },
        open_mortgage_panel: { uiHint: 'mortgage_panel', message: 'Membuka simulasi & pengajuan KPR Bank.' },
        open_land_panel: { uiHint: 'land_panel', message: 'Membuka layanan kavling & perizinan IMB.' },
        open_construction_panel: { uiHint: 'construction_panel', message: 'Membuka jadwal pembangunan & renovasi.' },
    };
    if (uiMap[actionId]) {
        return { ok: true, actionId, ...uiMap[actionId] };
    }
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const memId = `${npcId}_${uid}`;
    const memRef = firebase_1.db.collection('npc_memory').doc(memId);
    if (actionId === 'ask_rumor') {
        const [treasurySnap, recentCrimesSnap] = await Promise.all([
            firebase_1.db.collection('state').doc('treasury').get(),
            firebase_1.db.collection('crime_records').orderBy('atMs', 'desc').limit(5).get(),
        ]);
        const eventLabel = String(treasurySnap.data()?.activeEventLabel || 'Ekonomi Cicalengka Stabil');
        const crimeCount = recentCrimesSnap.size;
        const message = `${npcDef.name}: "Info warga hari ini: ${eventLabel}. Tercatat ${crimeCount} laporan keamanan terbaru di wilayah sekitar."`;
        return { ok: true, actionId, message };
    }
    if (actionId === 'greet') {
        const charPreSnap = await charRef.get();
        if (!charPreSnap.exists)
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        const pPos = await (0, housing_1.getPlayerWorldPos)(firebase_1.rtdb, uid, charPreSnap.data());
        if ((0, validation_1.distance2D)(pPos.x, pPos.z, npcPose.x, npcPose.z) > 12) {
            throw new https_1.HttpsError('failed-precondition', 'Terlalu jauh dari NPC.');
        }
        return firebase_1.db.runTransaction(async (tx) => {
            const [charSnap, memSnap] = await Promise.all([tx.get(charRef), tx.get(memRef)]);
            if (!charSnap.exists)
                throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
            const prevMem = memSnap.exists ? memSnap.data() : {};
            const lastGreetMs = Number(prevMem.lastGreetAtMs || 0);
            if (nowMs - lastGreetMs < 60_000) {
                return {
                    ok: true,
                    actionId,
                    affinity: Number(prevMem.affinity ?? 50),
                    message: `${npcDef.name} tersenyum menyapa balik. (Tunggu sebentar sebelum menyapa lagi)`,
                };
            }
            const nextAffinity = Math.min(100, Number(prevMem.affinity ?? 50) + 2);
            const retentionMs = Number(law_1.aiConfig.memoryRetentionDays || 30) * 86_400_000;
            tx.set(memRef, {
                id: memId,
                npcId,
                uid,
                affinity: nextAffinity,
                lastGreetAtMs: nowMs,
                lastMessageAtMs: nowMs,
                expiresAtMs: nowMs + retentionMs,
            }, { merge: true });
            return {
                ok: true,
                actionId,
                affinity: nextAffinity,
                message: `Anda menyapa ${npcDef.name}. Keakraban meningkat menjadi ${nextAffinity}/100.`,
            };
        });
    }
    if (actionId === 'buy_npc_item') {
        const itemId = typeof body?.itemId === 'string' ? body.itemId.trim() : '';
        if (!itemId || !npcDef.defaultInventory.includes(itemId)) {
            throw new https_1.HttpsError('invalid-argument', 'Barang tersebut tidak dijual oleh NPC ini.');
        }
        const meta = (0, market_1.getProductMeta)(itemId);
        if (!meta) {
            throw new https_1.HttpsError('not-found', 'Data harga item tidak ditemukan di katalog.');
        }
        const charPreSnap = await charRef.get();
        if (!charPreSnap.exists)
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        const pPos = await (0, housing_1.getPlayerWorldPos)(firebase_1.rtdb, uid, charPreSnap.data());
        if ((0, validation_1.distance2D)(pPos.x, pPos.z, npcPose.x, npcPose.z) > 12) {
            throw new https_1.HttpsError('failed-precondition', `Dekati ${npcDef.name} terlebih dahulu untuk membeli.`);
        }
        const invRef = charRef.collection('inventory').doc(itemId);
        return firebase_1.db.runTransaction(async (tx) => {
            const [charSnap, invSnap] = await Promise.all([tx.get(charRef), tx.get(invRef)]);
            if (!charSnap.exists)
                throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
            const charData = charSnap.data();
            const rep = Number(charData.reputation ?? 50);
            const priceMult = rep < 30 ? 1.15 : 1.0;
            const unitPrice = Math.round(meta.suggestedRetail * priceMult);
            const money = Number(charData.money || 0);
            if (money < unitPrice) {
                throw new https_1.HttpsError('failed-precondition', `Uang tunai tidak cukup (butuh Rp ${unitPrice.toLocaleString('id-ID')}).`);
            }
            const nextMoney = money - unitPrice;
            const prevQty = invSnap.exists
                ? Number(invSnap.data()?.quantity ?? invSnap.data()?.qty ?? 0)
                : 0;
            tx.update(charRef, { money: nextMoney, updatedAt: firestore_1.Timestamp.fromMillis(nowMs) });
            tx.set(invRef, {
                uid,
                id: itemId,
                itemId,
                name: meta.name,
                category: meta.category,
                quantity: prevQty + 1,
                updatedAtMs: nowMs,
            }, { merge: true });
            (0, ledger_1.appendLedger)(tx, firebase_1.db, {
                from: uid,
                to: npcId,
                amount: unitPrice,
                reason: `buy_npc_${itemId}`,
                refId: npcId,
                nowMs,
            });
            (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
                type: 'expense',
                category: 'belanja_warga',
                amount: unitPrice,
                balanceAfter: nextMoney,
                description: `Beli ${meta.name} dari ${npcDef.name}`,
                nowMs,
            });
            return {
                ok: true,
                actionId,
                itemId,
                itemName: meta.name,
                pricePaid: unitPrice,
                money: nextMoney,
                message: `Berhasil membeli 1 ${meta.name} seharga Rp ${unitPrice.toLocaleString('id-ID')}.`,
            };
        });
    }
    throw new https_1.HttpsError('invalid-argument', 'Aksi NPC tidak dikenali.');
});
//# sourceMappingURL=npcDialog.js.map