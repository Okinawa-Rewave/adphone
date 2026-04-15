// lib/userTrust.ts — ユーザー信頼度スコアの Firestore R/W
import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { ensureAnonAuth } from "./auth";

const AGREE_DELTA = 3;
const DISAGREE_DELTA = -5;
const SCORE_MIN = 0;
const SCORE_MAX = 100;
const DEFAULT_SCORE = 50;

function clamp(n: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, n));
}

function voteDocId(postId: string, voterId: string): string {
  return `${postId}_${voterId}`;
}

/**
 * 投票を Firestore に書き込み、投稿者の userTrustScore を更新する。
 * - 自分の投稿への投票は無視。
 * - 既存票がある場合は反転（取り消し→再投票）。
 */
export async function castVote(
  postId: string,
  postAuthorUid: string,
  voteType: "agree" | "disagree"
): Promise<void> {
  await ensureAnonAuth();
  const voterId = auth.currentUser?.uid;
  if (!voterId) return;
  if (voterId === postAuthorUid) return; // 自分の投稿は無効

  const voteRef = doc(db, "votes", voteDocId(postId, voterId));
  const authorRef = doc(db, "users", postAuthorUid);

  await runTransaction(db, async (tx) => {
    const voteSnap = await tx.get(voteRef);
    const authorSnap = await tx.get(authorRef);

    const currentScore: number = authorSnap.exists()
      ? (authorSnap.data().userTrustScore ?? DEFAULT_SCORE)
      : DEFAULT_SCORE;

    let scoreDelta = voteType === "agree" ? AGREE_DELTA : DISAGREE_DELTA;

    if (voteSnap.exists()) {
      const prev = voteSnap.data().voteType as "agree" | "disagree";
      if (prev === voteType) {
        // 同じ票を再度押した → 取り消し
        scoreDelta = voteType === "agree" ? -AGREE_DELTA : -DISAGREE_DELTA;
        tx.delete(voteRef);
      } else {
        // 違う票に変更 → 前の効果を戻してから新しい効果を適用
        const reversePrev = prev === "agree" ? -AGREE_DELTA : -DISAGREE_DELTA;
        scoreDelta = reversePrev + scoreDelta;
        tx.set(voteRef, {
          postId,
          voterId,
          postAuthorId: postAuthorUid,
          voteType,
          createdAt: serverTimestamp(),
        });
      }
    } else {
      // 新規票
      tx.set(voteRef, {
        postId,
        voterId,
        postAuthorId: postAuthorUid,
        voteType,
        createdAt: serverTimestamp(),
      });
    }

    const newScore = clamp(currentScore + scoreDelta);
    tx.set(authorRef, { userTrustScore: newScore }, { merge: true });
  });
}

/**
 * ユーザーの信頼度スコアを取得する。
 * ドキュメントが存在しない場合はデフォルト値 50 を返す。
 */
export async function getUserTrustScore(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return DEFAULT_SCORE;
  return snap.data().userTrustScore ?? DEFAULT_SCORE;
}

/**
 * 自分の投票状態を確認する。
 */
export async function getMyVote(
  postId: string
): Promise<"agree" | "disagree" | null> {
  await ensureAnonAuth();
  const voterId = auth.currentUser?.uid;
  if (!voterId) return null;
  const snap = await getDoc(doc(db, "votes", voteDocId(postId, voterId)));
  if (!snap.exists()) return null;
  return snap.data().voteType as "agree" | "disagree";
}
