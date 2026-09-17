import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase configuration — uses NEXT_PUBLIC_ env vars (set in Vercel dashboard).
// Hardcoded values are safe fallbacks (these are public Firebase client config values).
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCnUjKUgM2hbR9GXIW5HHt0fMwGLpLPtvg",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "yourtube-70a86.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "yourtube-70a86",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "yourtube-70a86.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "21142295126",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:21142295126:web:82aed14e4bd646de96a1f7",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-87JK2LLZMP",
};

// Initialize Firebase only once (safe for Next.js hot reload and SSR)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// getAuth is browser-only — Firebase Auth uses window/indexedDB which don't exist on the server.
// Guard it so SSR/SSG pages don't crash with "Cannot read properties of undefined".
// AuthContext checks `if (auth)` before calling onAuthStateChanged, so null is safe here.
export const auth = typeof window !== "undefined" ? getAuth(app) : null;

export default app;