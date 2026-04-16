// lib/offlineAuth.ts — オフライン用UID（SecureStore に UUID を永続化）
import * as SecureStore from "expo-secure-store";

const KEY = "offline_uid";
let cached: string | null = null;

/**
 * 端末固有のオフラインUIDを返す。
 * 初回呼び出し時に crypto.randomUUID() で生成し SecureStore に保存する。
 * アンインストールするまで同一値が返る。
 */
export async function getOfflineUid(): Promise<string> {
  if (cached) return cached;
  let uid = await SecureStore.getItemAsync(KEY);
  if (!uid) {
    uid = crypto.randomUUID();
    await SecureStore.setItemAsync(KEY, uid);
  }
  cached = uid;
  return uid;
}
