import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database';
import {
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
  getFirestore,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import appletConfig from '../../../firebase-applet-config.json';

const env = import.meta.env;

const configuredDatabaseUrl =
  env.VITE_FIREBASE_DATABASE_URL ||
  (appletConfig as { databaseURL?: string }).databaseURL ||
  '';

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || appletConfig.appId,
  ...(configuredDatabaseUrl ? { databaseURL: configuredDatabaseUrl } : {}),
};

const firestoreDbId =
  env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || appletConfig.firestoreDatabaseId;

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db =
  firestoreDbId && firestoreDbId !== '(default)'
    ? getFirestore(app, firestoreDbId)
    : getFirestore(app);

const useEmulator = env.VITE_USE_EMULATOR === 'true';

let rtdbInstance: Database | null = null;
if (configuredDatabaseUrl || useEmulator) {
  try {
    const rtdbUrl =
      configuredDatabaseUrl ||
      `http://127.0.0.1:9000/?ns=${env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId}`;
    rtdbInstance = getDatabase(app, rtdbUrl);
  } catch (err) {
    console.warn('Realtime Database belum terkonfigurasi sepenuhnya:', err);
  }
}
export const rtdb = rtdbInstance;

export const functions = getFunctions(app, 'asia-southeast1');

// Hubungkan ke Firebase Emulator Suite lokal (tanpa Docker) jika diaktifkan
if (useEmulator && typeof window !== 'undefined') {
  const globalAny = window as unknown as { __cicalengkaEmulatorsConnected?: boolean };
  if (!globalAny.__cicalengkaEmulatorsConnected) {
    globalAny.__cicalengkaEmulatorsConnected = true;
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    if (rtdb) {
      connectDatabaseEmulator(rtdb, '127.0.0.1', 9000);
    }
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }
}

// Aktifkan Firebase App Check (debug token di dev/emulator, ReCaptcha v3 di produksi)
if (typeof window !== 'undefined') {
  if (useEmulator || env.DEV) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      true;
  }
  const siteKey = env.VITE_RECAPTCHA_SITE_KEY || appletConfig.recaptchaSiteKey;
  if (siteKey) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (err) {
      console.warn('App Check gagal diinisialisasi:', err);
    }
  }
}

// Validasi koneksi awal Firestore saat aplikasi boot menggunakan dokumen config publik
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'config', 'game'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Koneksi Firestore offline. Periksa konfigurasi Firebase.');
    }
  }
}
void testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
