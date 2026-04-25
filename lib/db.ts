import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'bousai.db';
const DB_PATH = `${FileSystem.documentDirectory}${DB_NAME}`;

// === データベースを開く ===
export async function openDatabase() {
  const info = await FileSystem.getInfoAsync(DB_PATH);
  if (!info.exists) {
    console.log('📦 初回起動: assets から DB をコピーします');
    const asset = Asset.fromModule(require('../assets/bousai.db'));
    await asset.downloadAsync();
    await FileSystem.copyAsync({
      from: asset.localUri!,
      to: DB_PATH,
    });
  }

  return await SQLite.openDatabaseAsync(DB_NAME);
}

// === 位置情報を挿入 ===
export async function insertMyLocation(lat: number, lon: number) {
  const db = await openDatabase();
  await db.runAsync('INSERT INTO my_location (latitude, longitude) VALUES (?, ?)', [lat, lon]);
}

// === 最新位置を取得 ===
export async function getLatestMyLocation() {
  const db = await openDatabase();
  return db.getFirstAsync('SELECT * FROM my_location ORDER BY id DESC LIMIT 1');
}

// ============================================================
// 信頼度スコア関連テーブル（オフライン対応）
// ============================================================

export async function ensureTrustTables() {
  const db = await openDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_trust_scores (
      uid       TEXT PRIMARY KEY,
      score     INTEGER NOT NULL DEFAULT 50,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS votes (
      id             TEXT PRIMARY KEY,   -- "{postId}_{voterId}"
      post_id        TEXT NOT NULL,
      voter_id       TEXT NOT NULL,
      post_author_id TEXT NOT NULL,
      vote_type      TEXT NOT NULL CHECK(vote_type IN ('agree','disagree')),
      synced         INTEGER NOT NULL DEFAULT 0,  -- 0=未同期 1=同期済み
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function getLocalTrustScore(uid: string): Promise<number> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<{ score: number }>(
    'SELECT score FROM user_trust_scores WHERE uid = ?', [uid]
  );
  return row?.score ?? 50;
}

export async function setLocalTrustScore(uid: string, score: number) {
  const db = await openDatabase();
  await db.runAsync(
    `INSERT INTO user_trust_scores (uid, score, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(uid) DO UPDATE SET score = excluded.score, updated_at = excluded.updated_at`,
    [uid, score]
  );
}

export async function getLocalVote(
  voteId: string
): Promise<{ vote_type: "agree" | "disagree" } | null> {
  const db = await openDatabase();
  return db.getFirstAsync<{ vote_type: "agree" | "disagree" }>(
    'SELECT vote_type FROM votes WHERE id = ?', [voteId]
  );
}

export async function upsertLocalVote(
  id: string,
  postId: string,
  voterId: string,
  postAuthorId: string,
  voteType: "agree" | "disagree",
  synced: 0 | 1 = 0
) {
  const db = await openDatabase();
  await db.runAsync(
    `INSERT INTO votes (id, post_id, voter_id, post_author_id, vote_type, synced)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET vote_type = excluded.vote_type, synced = excluded.synced`,
    [id, postId, voterId, postAuthorId, voteType, synced]
  );
}

export async function deleteLocalVote(id: string) {
  const db = await openDatabase();
  await db.runAsync('DELETE FROM votes WHERE id = ?', [id]);
}

export async function getPendingVotes() {
  const db = await openDatabase();
  return db.getAllAsync<{
    id: string;
    post_id: string;
    voter_id: string;
    post_author_id: string;
    vote_type: "agree" | "disagree";
  }>('SELECT * FROM votes WHERE synced = 0');
}

export async function markVoteSynced(id: string) {
  const db = await openDatabase();
  await db.runAsync('UPDATE votes SET synced = 1 WHERE id = ?', [id]);
}
