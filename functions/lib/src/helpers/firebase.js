"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENFORCE_APP_CHECK = exports.FUNCTIONS_REGION = exports.rtdb = exports.db = void 0;
const app_1 = require("firebase-admin/app");
const database_1 = require("firebase-admin/database");
const firestore_1 = require("firebase-admin/firestore");
const app = (0, app_1.getApps)().length > 0 ? (0, app_1.getApp)() : (0, app_1.initializeApp)();
const firestoreDbId = process.env.FIRESTORE_DATABASE_ID;
// Mendukung default database di Emulator maupun named database di produksi
exports.db = firestoreDbId && firestoreDbId !== '(default)'
    ? (0, firestore_1.getFirestore)(app, firestoreDbId)
    : (0, firestore_1.getFirestore)(app);
exports.rtdb = (0, database_1.getDatabase)(app);
exports.FUNCTIONS_REGION = 'asia-southeast1';
exports.ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === 'true';
//# sourceMappingURL=firebase.js.map