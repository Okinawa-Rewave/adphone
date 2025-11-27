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
