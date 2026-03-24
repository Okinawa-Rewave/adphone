/**
 * 名護・渋谷のデータを結合するスクリプト
 * 実行: node merge_data.js
 * 前提: Overpass Turboで取得した shibuya_roads.json を C:\my-app\ に置く
 */

const fs   = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, 'assets');

// ── 道路データの結合 ─────────────────────────────
function mergeRoads() {
  const nagoPath    = path.join(ASSETS_DIR, 'roads_all.json');
  const shibuyaPath = path.join(__dirname, 'shibuya_roads.json');

  if (!fs.existsSync(nagoPath)) {
    console.error('assets/roads_all.json が見つかりません');
    return false;
  }
  if (!fs.existsSync(shibuyaPath)) {
    console.error('shibuya_roads.json が見つかりません');
    console.error('Overpass Turboからダウンロードして C:\\my-app\\ に置いてください');
    return false;
  }

  const nago    = JSON.parse(fs.readFileSync(nagoPath, 'utf8'));
  const shibuya = JSON.parse(fs.readFileSync(shibuyaPath, 'utf8'));

  const merged = {
    type: 'FeatureCollection',
    generator: 'merge_data.js',
    features: [
      ...(nago.features    || []),
      ...(shibuya.features || []),
    ],
  };

  fs.copyFileSync(nagoPath, nagoPath + '.backup');
  fs.writeFileSync(nagoPath, JSON.stringify(merged));

  console.log('道路データ結合完了:');
  console.log(`  名護:  ${(nago.features    || []).length} 件`);
  console.log(`  渋谷:  ${(shibuya.features || []).length} 件`);
  console.log(`  合計:  ${merged.features.length} 件`);
  console.log('  バックアップ: roads_all.json.backup');
  return true;
}

// ── 避難所データの結合 ───────────────────────────
// 出典: 渋谷区公式サイト「避難所・自主避難施設一覧」（2025年7月10日更新）
function mergeShelters() {
  const nagoPath = path.join(ASSETS_DIR, 'shelters.json');

  if (!fs.existsSync(nagoPath)) {
    console.error('assets/shelters.json が見つかりません');
    return false;
  }

  const nago = JSON.parse(fs.readFileSync(nagoPath, 'utf8'));

  // 渋谷区指定避難所（区立小中学校等）
  const shibuyaShelters = [
    // ── 恵比寿・広尾エリア ──
    { id: 1101, name: '加計塚小学校',          lat: 35.6472, lng: 139.7148 },
    { id: 1102, name: '臨川小学校',            lat: 35.6496, lng: 139.7181 },
    { id: 1103, name: '長谷戸小学校',          lat: 35.6456, lng: 139.7069 },
    { id: 1104, name: '猿楽小学校',            lat: 35.6480, lng: 139.7031 },
    { id: 1105, name: '鉢山中学校',            lat: 35.6521, lng: 139.6990 },
    { id: 1106, name: '常磐松小学校',          lat: 35.6545, lng: 139.7106 },
    { id: 1107, name: '広尾小学校',            lat: 35.6512, lng: 139.7149 },
    { id: 1108, name: '都立広尾高等学校',      lat: 35.6508, lng: 139.7160 },

    // ── 渋谷・桜丘エリア ──
    { id: 1109, name: '文化総合センター大和田', lat: 35.6565, lng: 139.6973 },
    { id: 1110, name: '神南小学校',            lat: 35.6611, lng: 139.6993 },
    { id: 1111, name: '松濤中学校',            lat: 35.6576, lng: 139.6941 },
    { id: 1112, name: '渋谷区立小中学校 青山キャンパス', lat: 35.6671, lng: 139.7067 },

    // ── 上原・代々木エリア ──
    { id: 1113, name: '富谷小学校',            lat: 35.6647, lng: 139.6934 }, // 経度を修正済み
    { id: 1114, name: '上原小学校',            lat: 35.6682, lng: 139.6842 },
    { id: 1115, name: '上原中学校',            lat: 35.6698, lng: 139.6838 },
    { id: 1116, name: '西原小学校',            lat: 35.6677, lng: 139.6893 },
    { id: 1117, name: '代々木中学校',          lat: 35.6698, lng: 139.6882 },
    { id: 1118, name: '渋谷区スポーツセンター', lat: 35.6695, lng: 139.6876 },
    { id: 1119, name: '代々木山谷小学校',      lat: 35.6712, lng: 139.6945 },

    // ── 初台・本町・幡ヶ谷エリア ──
    { id: 1120, name: '幡代小学校',            lat: 35.6733, lng: 139.6901 },
    { id: 1121, name: '渋谷本町学園',          lat: 35.6784, lng: 139.6870 },
    { id: 1122, name: '本町コミュニティセンター', lat: 35.6771, lng: 139.6843 },
    { id: 1123, name: '中幡小学校',            lat: 35.6741, lng: 139.6845 },
    { id: 1124, name: '笹塚小学校',            lat: 35.6714, lng: 139.6817 },
    { id: 1125, name: '笹塚中学校',            lat: 35.6707, lng: 139.6800 },

    // ── 千駄ヶ谷・神宮前エリア ──
    { id: 1126, name: '地域交流センター代々木の杜', lat: 35.6820, lng: 139.6976 },
    { id: 1127, name: '鳩森小学校',            lat: 35.6776, lng: 139.7069 },
    { id: 1128, name: '千駄谷小学校',          lat: 35.6742, lng: 139.7068 },
    { id: 1129, name: '神宮前小学校',          lat: 35.6689, lng: 139.7066 },
    { id: 1130, name: '原宿外苑中学校',        lat: 35.6694, lng: 139.7052 },
    { id: 1131, name: 'SCC千駄ヶ谷コミュニティセンター', lat: 35.6760, lng: 139.7142 },
  ];

  const merged = [...nago, ...shibuyaShelters];

  fs.copyFileSync(nagoPath, nagoPath + '.backup');
  fs.writeFileSync(nagoPath, JSON.stringify(merged, null, 2));

  console.log('避難所データ結合完了:');
  console.log(`  名護:  ${nago.length} 件`);
  console.log(`  渋谷:  ${shibuyaShelters.length} 件`);
  console.log(`  合計:  ${merged.length} 件`);
  console.log('  バックアップ: shelters.json.backup');
  return true;
}

// ── メイン ───────────────────────────────────────
console.log('データ結合を開始します...\n');

// 道路データが既に結合済みの場合はバックアップから戻す
const roadsPath  = path.join(ASSETS_DIR, 'roads_all.json');
const backupPath = roadsPath + '.backup';
if (fs.existsSync(backupPath)) {
  console.log('既存のバックアップを検出。バックアップから道路データを復元します...');
  fs.copyFileSync(backupPath, roadsPath);
  console.log('復元完了\n');
}

const roadOk    = mergeRoads();
const shelterOk = mergeShelters();

if (roadOk && shelterOk) {
  console.log('\n✅ 結合完了！');
  console.log('npx expo start --dev-client --clear で確認してください');
} else {
  console.log('\n❌ 一部失敗しました。上記のエラーを確認してください');
}
