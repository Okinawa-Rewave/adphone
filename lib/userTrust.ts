// lib/userTrust.ts — 信頼度スコア（オフライン: SQLite / オンライン: Firestore + 同期）
import NetInfo from "@react-native-community/netinfo";
import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db as firestoreDb } from "./firebase";
import { ensureAnonAuth } from "./auth";
import { getOfflineUid } from "./offlineAuth";
import {
  ensureTrustTables,
  getLocalTrustScore,
  setLocalTrustScore,
  getLocalVote,
  upsertLocalVote,
  deleteLocalVote,
  getPendingVotes,
  markVoteSynced,
} from "./db";

const AGREE_DELTA    =  3;
const DISAGREE_DELTA = -5;
const SCORE_MIN      =  0;
const SCORE_MAX      = 100;
const DEFAULT_SCORE  = 50;

function clamp(n: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, n));
}

async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return !!state.isConnected && state.isInternetReachable !== false;
}

function voteDocId(postId: string, voterId: string): string {
  return `${postId}_${voterId}`;
}

/** 起動時に一度呼ぶ。テーブル作成 + オフライン中に溜まった投票を Firestore へ同期。 */
export async function initTrustSystem(): Promise<void> {
  await ensureTrustTables();
  if (await isOnline()) {
    await flushPendingVotes();
  }
}

// ============================================================
// 投票
// ============================================================

export async function castVote(
  postId: string,
  postAuthorUid: string,
  voteType: "agree" | "disagree"
): Promise<void> {
  await ensureTrustTables();
  const voterId = await resolveVoterId();
  if (!voterId || voterId === postAuthorUid) return;

  const id = voteDocId(postId, voterId);
  const existing = await getLocalVote(id);

  // スコア差分を計算
  let delta = voteType === "agree" ? AGREE_DELTA : DISAGREE_DELTA;
  if (existing) {
    if (existing.vote_type === voteType) {
      // 同じ票 → 取り消し
      delta = voteType === "agree" ? -AGREE_DELTA : -DISAGREE_DELTA;
      await deleteLocalVote(id);
    } else {
      // 逆票に変更
      const reversePrev = existing.vote_type === "agree" ? -AGREE_DELTA : -DISAGREE_DELTA;
      delta = reversePrev + delta;
      await upsertLocalVote(id, postId, voterId, postAuthorUid, voteType, 0);
    }
  } else {
    await upsertLocalVote(id, postId, voterId, postAuthorUid, voteType, 0);
  }

  // ローカルスコア更新
  const current = await getLocalTrustScore(postAuthorUid);
  await setLocalTrustScore(postAuthorUid, clamp(current + delta));

  // オンラインなら即 Firestore に反映
  if (await isOnline()) {
    await syncVoteToFirestore(id, postId, voterId, postAuthorUid, existing, voteType, delta);
    await markVoteSynced(id);
  }
}

// ============================================================
// スコア取得
// ============================================================

export async function getUserTrustScore(uid: string): Promise<number> {
  await ensureTrustTables();
  if (await isOnline()) {
    try {
      const snap = await getDoc(doc(firestoreDb, "users", uid));
      const score: number = snap.exists()
        ? (snap.data().userTrustScore ?? DEFAULT_SCORE)
        : DEFAULT_SCORE;
      await setLocalTrustScore(uid, score); // キャッシュ更新
      return score;
    } catch {
      // Firestore 失敗時はキャッシュにフォールバック
    }
  }
  return getLocalTrustScore(uid);
}

// ============================================================
// 自分の投票状態確認
// ============================================================

export async function getMyVote(
  postId: string
): Promise<"agree" | "disagree" | null> {
  await ensureTrustTables();
  const voterId = await resolveVoterId();
  if (!voterId) return null;
  const row = await getLocalVote(voteDocId(postId, voterId));
  return row?.vote_type ?? null;
}

// ============================================================
// 内部ユーティリティ
// ============================================================

/** Firebase UID（オンライン）または オフライン UUID を返す */
async function resolveVoterId(): Promise<string | null> {
  if (await isOnline()) {
    await ensureAnonAuth();
    return auth.currentUser?.uid ?? await getOfflineUid();
  }
  return getOfflineUid();
}

/** 未同期の投票をまとめて Firestore に反映する */
async function flushPendingVotes(): Promise<void> {
  const pending = await getPendingVotes();
  for (const v of pending) {
    try {
      const existing = null; // 既存票はローカルで処理済みなのでFirestoreに書くだけ
      const delta = v.vote_type === "agree" ? AGREE_DELTA : DISAGREE_DELTA;
      await syncVoteToFirestore(
        v.id, v.post_id, v.voter_id, v.post_author_id,
        null, v.vote_type, delta
      );
      await markVoteSynced(v.id);
    } catch {
      // 個別失敗は無視して次へ（次回起動時に再試行）
    }
  }
}

/** Firestore に投票とスコアを書き込む（トランザクション） */
async function syncVoteToFirestore(
  voteId: string,
  postId: string,
  voterId: string,
  postAuthorId: string,
  existingLocal: { vote_type: "agree" | "disagree" } | null,
  voteType: "agree" | "disagree",
  scoreDelta: number
): Promise<void> {
  const voteRef = doc(firestoreDb, "votes", voteId);
  const authorRef = doc(firestoreDb, "users", postAuthorId);

  await runTransaction(firestoreDb, async (tx) => {
    const authorSnap = await tx.get(authorRef);
    const currentScore: number = authorSnap.exists()
      ? (authorSnap.data().userTrustScore ?? DEFAULT_SCORE)
      : DEFAULT_SCORE;
    const newScore = clamp(currentScore + scoreDelta);

    const isCancel = existingLocal?.vote_type === voteType;
    if (isCancel) {
      tx.delete(voteRef);
    } else {
      tx.set(voteRef, {
        postId,
        voterId,
        postAuthorId,
        voteType,
        createdAt: serverTimestamp(),
      });
    }
    tx.set(authorRef, { userTrustScore: newScore }, { merge: true });
  });
}
