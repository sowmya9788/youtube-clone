import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCmjNyU7GKm2hbR9GX1W5HHt0fMWGLpLPtvg",
  authDomain: "youtube-70a86.firebaseapp.com",
  projectId: "youtube-70a86",
  storageBucket: "youtube-70a86.firebasestorage.app",
  messagingSenderId: "21142295126",
  appId: "1:21142295126:web:82aed14e4bd646de96a1f7",
  measurementId: "G-87JK2LLZMP"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider };