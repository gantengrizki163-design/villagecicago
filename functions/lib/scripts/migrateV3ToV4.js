"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migratePhase3ToPhase4 = migratePhase3ToPhase4;
/**
 * Skrip Migrasi Data Fase 3 -> Fase 4 (Idempoten & Non-Destruktif).
 * Menambahkan field bankAccount, creditScore, businesses ke karakter lama
 * tanpa menghapus data pemain sebelumnya, sekaligus menjalankan seedPhase4Data().
 *
 * Jalankan:
 *   npx tsx functions/src/scripts/migrateV3ToV4.ts
 */
const firestore_1 = require("firebase-admin/firestore");
const bank_json_1 = __importDefault(require("../config/bank.json"));
const firebase_1 = require("../helpers/firebase");
const seedPhase4_1 = require("./seedPhase4");
async function migratePhase3ToPhase4() {
    console.log('Memulai seed Fase 4 & migrasi karakter Fase 3 -> Fase 4...');
    await (0, seedPhase4_1.seedPhase4Data)();
    const nowMs = Date.now();
    const charsSnap = await firebase_1.db.collection('characters').get();
    let migrated = 0;
    for (const charDoc of charsSnap.docs) {
        const data = charDoc.data();
        const updates = {};
        if (data.bankAccount === undefined) {
            updates.bankAccount = {
                hasAccount: false,
                accountNumber: '',
                openedAtMs: 0,
            };
        }
        if (typeof data.creditScore !== 'number') {
            updates.creditScore = bank_json_1.default.creditScore.defaultScore;
        }
        if (!Array.isArray(data.businesses)) {
            updates.businesses = [];
        }
        if (Object.keys(updates).length > 0) {
            updates.updatedAt = firestore_1.Timestamp.fromMillis(nowMs);
            await charDoc.ref.update(updates);
            migrated += 1;
        }
    }
    console.log(`Migrasi Fase 4 selesai: ${migrated} karakter diperbarui dengan aman.`);
}
if (require.main === module) {
    migratePhase3ToPhase4()
        .then(() => process.exit(0))
        .catch((err) => {
        console.error('Migrasi Fase 4 gagal:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=migrateV3ToV4.js.map