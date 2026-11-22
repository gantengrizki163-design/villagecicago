import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';

const app = getApps().length > 0 ? getApp() : initializeApp();

const firestoreDbId = process.env.FIRESTORE_DATABASE_ID;

// Mendukung default database di Emulator maupun named database di produksi
export const db =
  firestoreDbId && firestoreDbId !== '(default)'
    ? getFirestore(app, firestoreDbId)
    : getFirestore(app);

export const rtdb = getDatabase(app);

export const FUNCTIONS_REGION = 'asia-southeast1';
export const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === 'true';
