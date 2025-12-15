// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCUOI0BoBNsrK4DBv-DbdMYjEs1VZoI83M",
  authDomain: "overcome-the-disasters.firebaseapp.com",
  projectId: "overcome-the-disasters",
  storageBucket: "overcome-the-disasters.firebasestorage.app",
  messagingSenderId: "206286747944",
  appId: "1:206286747944:web:6c342ca1bf167cd28db81d",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
