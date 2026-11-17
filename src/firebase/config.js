const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

export const FIREBASE_CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyCp-25dBhAbU-BBlFOHeqLwQ0zzhFILoYk',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'npms-d5d5b.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'npms-d5d5b',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'npms-d5d5b.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1032828110507',
  appId: env.VITE_FIREBASE_APP_ID || '1:1032828110507:web:aa3d21a894bea08bb659ee'
};

export function isFirebaseConfigured() {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}