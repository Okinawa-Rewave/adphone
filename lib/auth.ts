// lib/auth.ts
import { auth } from "./firebase";
import { signInAnonymously } from "firebase/auth";

export async function ensureAnonAuth() {
  if (auth.currentUser) return auth.currentUser;
  await signInAnonymously(auth);
  return auth.currentUser;
}
