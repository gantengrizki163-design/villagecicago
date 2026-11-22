"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.abandonQuest = exports.completeQuest = exports.acceptQuest = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const housing_1 = require("../helpers/housing");
const law_1 = require("../helpers/law");
const ledger_1 = require("../helpers/ledger");
const market_1 = require("../helpers/market");
const npcSchedule_1 = require("../helpers/npcSchedule");
const phase2_1 = require("../helpers/phase2");
const validation_1 = require("../helpers/validation");
function getTodayKey(nowMs) {
    const d = new Date(nowMs);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
async function resolveQuestDef(questId) {
    const snap = await firebase_1.db.collection('quests').doc(questId).get();
    if (snap.exists) {
        return snap.data();
    }
    const fallback = law_1.questsConfig.quests.find((q) => q.id === questId);
    return fallback || null;
}
/**
 * 1. acceptQuest: Terima misi/tugas dari NPC Cicalengka dengan batas harian & batas quest aktif.
 */
exports.acceptQuest = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    await (0, law_1.ensurePhase6Configs)();
    const uid = request.auth.uid;
    const body = request.data;
    const questId = typeof body?.questId === 'string' ? body.questId.trim() : '';
    const nowMs = Date.now();
    const dayKey = getTodayKey(nowMs);
    if (!questId)
        throw new https_1.HttpsError('invalid-argument', 'ID quest diperlukan.');
    const questDef = await resolveQuestDef(questId);
    if (!questDef || !questDef.active) {
        throw new https_1.HttpsError('not-found', 'Quest tidak ditemukan atau sedang nonaktif.');
    }
    const npcLookup = (0, npcSchedule_1.getDeterministicNpcById)(questDef.npcId, nowMs);
    if (!npcLookup) {
        throw new https_1.HttpsError('not-found', 'NPC pemberi quest tidak ditemukan.');
    }
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const logsCol = charRef.collection('quest_log');
    const charPreSnap = await charRef.get();
    if (!charPreSnap.exists)
        throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
    const pPos = await (0, housing_1.getPlayerWorldPos)(firebase_1.rtdb, uid, charPreSnap.data());
    const distToNpc = (0, validation_1.distance2D)(pPos.x, pPos.z, npcLookup.pose.x, npcLookup.pose.z);
    if (distToNpc > 14) {
        throw new https_1.HttpsError('failed-precondition', `Dekati ${npcLookup.def.name} untuk mengambil quest ini.`);
    }
    if (npcLookup.pose.isSleeping) {
        throw new https_1.HttpsError('failed-precondition', `${npcLookup.def.name} sedang tidur. Temui lagi saat jam aktivitas.`);
    }
    return firebase_1.db.runTransaction(async (tx) => {
        const [charSnap, logsSnap] = await Promise.all([
            tx.get(charRef),
            tx.get(logsCol.limit(40)),
        ]);
        if (!charSnap.exists)
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        const charData = charSnap.data();
        if (charData.sentence?.active) {
            throw new https_1.HttpsError('failed-precondition', 'Tidak bisa mengambil quest saat berada di tahanan.');
        }
        if (charData.activeTrip) {
            throw new https_1.HttpsError('failed-precondition', 'Tidak bisa mengambil quest saat dalam perjalanan kereta.');
        }
        const allLogs = logsSnap.docs.map((d) => d.data());
        const activeLogs = allLogs.filter((l) => l.status === 'active');
        if (activeLogs.length >= Number(law_1.questsConfig.maxActiveQuestsPerPlayer || 3)) {
            throw new https_1.HttpsError('resource-exhausted', `Maksimal ${law_1.questsConfig.maxActiveQuestsPerPlayer} quest aktif secara bersamaan.`);
        }
        if (activeLogs.some((l) => l.questId === questId)) {
            throw new https_1.HttpsError('failed-precondition', 'Quest ini sedang aktif di daftar tugas Anda.');
        }
        const completedTodayForQuest = allLogs.filter((l) => l.questId === questId && l.status === 'completed' && l.dayKey === dayKey).length;
        if (completedTodayForQuest >= Number(questDef.dailyLimit || 1)) {
            throw new https_1.HttpsError('resource-exhausted', 'Batas harian untuk quest ini sudah tercapai.');
        }
        const completedTodayTotal = allLogs.filter((l) => l.status === 'completed' && l.dayKey === dayKey).length;
        if (completedTodayTotal >= Number(law_1.questsConfig.maxCompletedQuestsPerDay || 4)) {
            throw new https_1.HttpsError('resource-exhausted', 'Batas total quest harian telah tercapai. Kembali lagi besok.');
        }
        const logId = `ql_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;
        const targetCount = Math.max(1, Number(questDef.objective.requiredCount || 1));
        tx.set(logsCol.doc(logId), {
            id: logId,
            uid,
            questId: questDef.id,
            npcId: questDef.npcId,
            npcName: questDef.npcName,
            title: questDef.title,
            description: questDef.description,
            type: questDef.type,
            progress: 0,
            targetCount,
            status: 'active',
            dayKey,
            acceptedAtMs: nowMs,
        });
        const prevSummary = (charData.questLog || {});
        const prevActiveIds = Array.isArray(prevSummary.activeIds)
            ? prevSummary.activeIds
            : activeLogs.map((l) => String(l.questId));
        const nextActiveIds = Array.from(new Set([...prevActiveIds, questDef.id]));
        tx.update(charRef, {
            questLog: {
                activeCount: nextActiveIds.length,
                activeIds: nextActiveIds,
                completedToday: prevSummary.dayKey === dayKey ? Number(prevSummary.completedToday || 0) : 0,
                dailyMoneyEarned: prevSummary.dayKey === dayKey ? Number(prevSummary.dailyMoneyEarned || 0) : 0,
                dayKey,
            },
            updatedAt: firestore_1.Timestamp.fromMillis(nowMs),
        });
        return {
            ok: true,
            logId,
            questId: questDef.id,
            title: questDef.title,
            rewardMoney: questDef.rewardMoney,
            rewardRep: questDef.rewardRep,
        };
    });
});
/**
 * 2. completeQuest: Validasi lokasi/kebutuhan quest di server, beri upah, reputasi, & item reward.
 */
exports.completeQuest = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    await (0, law_1.ensurePhase6Configs)();
    const uid = request.auth.uid;
    const body = request.data;
    const requestedLogId = typeof body?.logId === 'string' ? body.logId.trim() : '';
    const requestedQuestId = typeof body?.questId === 'string' ? body.questId.trim() : '';
    const nowMs = Date.now();
    const dayKey = getTodayKey(nowMs);
    if (!requestedLogId && !requestedQuestId) {
        throw new https_1.HttpsError('invalid-argument', 'ID log atau ID quest diperlukan.');
    }
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const statsRef = firebase_1.db.collection('character_stats').doc(uid);
    const accRef = firebase_1.db.collection('accounts').doc(uid);
    const treasuryRef = firebase_1.db.collection('state').doc('treasury');
    const logsCol = charRef.collection('quest_log');
    const charPreSnap = await charRef.get();
    if (!charPreSnap.exists)
        throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
    const pPos = await (0, housing_1.getPlayerWorldPos)(firebase_1.rtdb, uid, charPreSnap.data());
    return firebase_1.db.runTransaction(async (tx) => {
        const [charSnap, statsSnap, accSnap, treasurySnap, logsSnap] = await Promise.all([
            tx.get(charRef),
            tx.get(statsRef),
            tx.get(accRef),
            tx.get(treasuryRef),
            tx.get(logsCol.limit(40)),
        ]);
        if (!charSnap.exists)
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        const charData = charSnap.data();
        const allLogs = logsSnap.docs.map((d) => ({ ref: d.ref, data: d.data() }));
        const targetEntry = allLogs.find((e) => e.data.status === 'active' &&
            (requestedLogId ? e.data.id === requestedLogId : e.data.questId === requestedQuestId));
        if (!targetEntry) {
            throw new https_1.HttpsError('not-found', 'Quest aktif tidak ditemukan.');
        }
        const questId = String(targetEntry.data.questId);
        const questDef = await resolveQuestDef(questId);
        if (!questDef) {
            throw new https_1.HttpsError('not-found', 'Definisi quest tidak ditemukan.');
        }
        const acceptedAtMs = Number(targetEntry.data.acceptedAtMs || 0);
        if (nowMs - acceptedAtMs < 3_000) {
            throw new https_1.HttpsError('failed-precondition', 'Selesaikan aktivitas quest terlebih dahulu.');
        }
        const px = pPos.x;
        const pz = pPos.z;
        // Validasi lokasi/syarat sesuai jenis quest
        const giverLookup = (0, npcSchedule_1.getDeterministicNpcById)(questDef.npcId, nowMs);
        const nearGiver = giverLookup
            ? (0, validation_1.distance2D)(px, pz, giverLookup.pose.x, giverLookup.pose.z) <= 15
            : false;
        if (questDef.type === 'deliver') {
            const receiverId = questDef.objective.targetNpcId;
            const receiverLookup = receiverId ? (0, npcSchedule_1.getDeterministicNpcById)(receiverId, nowMs) : null;
            const nearReceiver = receiverLookup
                ? (0, validation_1.distance2D)(px, pz, receiverLookup.pose.x, receiverLookup.pose.z) <= 15
                : false;
            const nearTarget = questDef.objective.targetPos
                ? (0, validation_1.distance2D)(px, pz, questDef.objective.targetPos.x, questDef.objective.targetPos.z) <= 15
                : false;
            if (!nearReceiver && !nearTarget) {
                throw new https_1.HttpsError('failed-precondition', `Antarkan pesanan ke ${questDef.objective.targetLabel || 'lokasi tujuan'} terlebih dahulu.`);
            }
        }
        else if (questDef.type === 'find' || questDef.type === 'report_crime') {
            const retPos = questDef.objective.returnPos || questDef.objective.targetPos;
            const nearReturn = retPos ? (0, validation_1.distance2D)(px, pz, retPos.x, retPos.z) <= 15 : false;
            if (!nearReturn && !nearGiver) {
                throw new https_1.HttpsError('failed-precondition', `Laporkan hasil ke ${questDef.objective.targetLabel || questDef.npcName}.`);
            }
        }
        else if (questDef.type === 'help_business') {
            const targetPos = questDef.objective.targetPos;
            const nearTarget = targetPos ? (0, validation_1.distance2D)(px, pz, targetPos.x, targetPos.z) <= 16 : false;
            if (!nearTarget && !nearGiver) {
                throw new https_1.HttpsError('failed-precondition', `Kunjungi ${questDef.objective.targetLabel || 'lokasi usaha'} untuk membantu distribusi.`);
            }
        }
        else if (questDef.type === 'gotong_royong') {
            const targetPos = questDef.objective.targetPos || { x: 0, z: 0 };
            const nearTarget = (0, validation_1.distance2D)(px, pz, targetPos.x, targetPos.z) <= 18;
            if (!nearTarget && !nearGiver) {
                throw new https_1.HttpsError('failed-precondition', `Pergi ke ${questDef.objective.targetLabel || 'Alun-Alun'} untuk mengikuti gotong royong.`);
            }
            const energyCost = Number(questDef.objective.energyCost || 10);
            const curEnergy = statsSnap.exists ? Number(statsSnap.data()?.energy ?? 100) : 100;
            if (curEnergy < energyCost) {
                throw new https_1.HttpsError('failed-precondition', `Energi tidak cukup untuk kerja bakti (butuh ${energyCost}).`);
            }
            if (statsSnap.exists) {
                tx.update(statsRef, {
                    energy: Math.max(0, curEnergy - energyCost),
                    lastCalculatedAt: firestore_1.Timestamp.fromMillis(nowMs),
                });
            }
        }
        // Batas penghasilan harian quest anti-farming
        const completedTodayDocs = allLogs.filter((l) => l.data.status === 'completed' && l.data.dayKey === dayKey);
        if (completedTodayDocs.length >= Number(law_1.questsConfig.maxCompletedQuestsPerDay || 4)) {
            throw new https_1.HttpsError('resource-exhausted', 'Batas quest selesai hari ini sudah tercapai.');
        }
        const prevSummary = (charData.questLog || {});
        const prevDailyEarned = prevSummary.dayKey === dayKey ? Number(prevSummary.dailyMoneyEarned || 0) : 0;
        const moneyCap = Number(law_1.questsConfig.maxDailyQuestMoneyCap || 75000);
        const grantedMoney = Math.max(0, Math.min(questDef.rewardMoney, moneyCap - prevDailyEarned));
        const nextMoney = Number(charData.money || 0) + grantedMoney;
        const { reputation } = (0, law_1.applyReputationAndCredit)(tx, firebase_1.db, uid, charData, accSnap, questDef.rewardRep, grantedMoney > 0 ? 1 : 0, nowMs);
        // Tambah affinity dengan NPC pemberi quest
        const memId = `${questDef.npcId}_${uid}`;
        const memRef = firebase_1.db.collection('npc_memory').doc(memId);
        const memSnap = await tx.get(memRef);
        const nextAffinity = Math.min(100, Number(memSnap.exists ? memSnap.data()?.affinity ?? 50 : 50) + 4);
        tx.set(memRef, {
            id: memId,
            npcId: questDef.npcId,
            uid,
            affinity: nextAffinity,
            lastMessageAtMs: nowMs,
            expiresAtMs: nowMs + 30 * 86_400_000,
        }, { merge: true });
        // Opsional reward item ke inventori
        let rewardItemName = null;
        if (questDef.rewardItemId && questDef.rewardItemQty > 0) {
            const meta = (0, market_1.getProductMeta)(questDef.rewardItemId);
            if (meta) {
                const invRef = charRef.collection('inventory').doc(questDef.rewardItemId);
                const invSnap = await tx.get(invRef);
                const prevQty = invSnap.exists
                    ? Number(invSnap.data()?.quantity ?? invSnap.data()?.qty ?? 0)
                    : 0;
                tx.set(invRef, {
                    uid,
                    id: questDef.rewardItemId,
                    itemId: questDef.rewardItemId,
                    name: meta.name,
                    category: meta.category,
                    quantity: prevQty + questDef.rewardItemQty,
                    updatedAtMs: nowMs,
                }, { merge: true });
                rewardItemName = meta.name;
            }
        }
        const remainingActiveIds = allLogs
            .filter((l) => l.data.status === 'active' && l.data.id !== targetEntry.data.id)
            .map((l) => String(l.data.questId));
        tx.update(targetEntry.ref, {
            progress: Number(targetEntry.data.targetCount || 1),
            status: 'completed',
            completedAtMs: nowMs,
        });
        tx.update(charRef, {
            money: nextMoney,
            reputation,
            questLog: {
                activeCount: remainingActiveIds.length,
                activeIds: remainingActiveIds,
                completedToday: completedTodayDocs.length + 1,
                dailyMoneyEarned: prevDailyEarned + grantedMoney,
                dayKey,
            },
            updatedAt: firestore_1.Timestamp.fromMillis(nowMs),
        });
        if (grantedMoney > 0) {
            (0, ledger_1.applyTreasuryCredit)(tx, firebase_1.db, treasurySnap, -Math.round(grantedMoney * 0.2), 'business', nowMs);
            (0, ledger_1.appendLedger)(tx, firebase_1.db, {
                from: 'quest_fund',
                to: uid,
                amount: grantedMoney,
                reason: `quest_reward_${questId}`,
                refId: String(targetEntry.data.id),
                nowMs,
            });
            (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
                type: 'income',
                category: 'quest_warga',
                amount: grantedMoney,
                balanceAfter: nextMoney,
                description: `Hadiah Quest: ${questDef.title}`,
                nowMs,
            });
        }
        return {
            ok: true,
            logId: String(targetEntry.data.id),
            questId,
            title: questDef.title,
            grantedMoney,
            rewardRep: questDef.rewardRep,
            rewardItemName,
            reputation,
            money: nextMoney,
        };
    });
});
/**
 * 3. abandonQuest: Batalkan quest aktif agar slot tugas bisa dipakai misi lain.
 */
exports.abandonQuest = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const body = request.data;
    const requestedLogId = typeof body?.logId === 'string' ? body.logId.trim() : '';
    const requestedQuestId = typeof body?.questId === 'string' ? body.questId.trim() : '';
    const nowMs = Date.now();
    const dayKey = getTodayKey(nowMs);
    if (!requestedLogId && !requestedQuestId) {
        throw new https_1.HttpsError('invalid-argument', 'ID log atau ID quest diperlukan.');
    }
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const logsCol = charRef.collection('quest_log');
    return firebase_1.db.runTransaction(async (tx) => {
        const [charSnap, logsSnap] = await Promise.all([
            tx.get(charRef),
            tx.get(logsCol.limit(40)),
        ]);
        if (!charSnap.exists)
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        const allLogs = logsSnap.docs.map((d) => ({ ref: d.ref, data: d.data() }));
        const targetEntry = allLogs.find((e) => e.data.status === 'active' &&
            (requestedLogId ? e.data.id === requestedLogId : e.data.questId === requestedQuestId));
        if (!targetEntry) {
            throw new https_1.HttpsError('not-found', 'Quest aktif tidak ditemukan.');
        }
        const remainingActiveIds = allLogs
            .filter((l) => l.data.status === 'active' && l.data.id !== targetEntry.data.id)
            .map((l) => String(l.data.questId));
        const prevSummary = (charSnap.data()?.questLog || {});
        tx.update(targetEntry.ref, {
            status: 'abandoned',
            abandonedAtMs: nowMs,
        });
        tx.update(charRef, {
            questLog: {
                activeCount: remainingActiveIds.length,
                activeIds: remainingActiveIds,
                completedToday: prevSummary.dayKey === dayKey ? Number(prevSummary.completedToday || 0) : 0,
                dailyMoneyEarned: prevSummary.dayKey === dayKey ? Number(prevSummary.dailyMoneyEarned || 0) : 0,
                dayKey,
            },
            updatedAt: firestore_1.Timestamp.fromMillis(nowMs),
        });
        return {
            ok: true,
            logId: String(targetEntry.data.id),
            questId: String(targetEntry.data.questId),
        };
    });
});
//# sourceMappingURL=quests.js.map