# アドフォン（adphone）— 災害時オフライン通信アプリ

**通信インフラが途絶えた被災地でも、安否・被害・物資の情報をつなぎ続けるモバイルアプリ。**

セルラー回線が落ちた状況を前提に、スマートフォン同士を BLE で、拠点間を Raspberry Pi + LPWA（LoRa）で
中継し、災害情報を伝播させる。平常時はオンライン（Firebase）で動き、圏外になるとローカル DB と
BLE メッシュへ自動的に切り替わる二層構成をとる。

- 公式サイト: https://adphone-lp.vercel.app
- Raspberry Pi 側（BLE ペリフェラル / LPWA ブリッジ）: 別リポジトリ

---

## 解決したい課題

災害時、まさに情報が必要な瞬間に基地局は落ちる。だが代替となる無線（LPWA / LoRa）は
**帯域が極端に細く、電波法で送信時間も制限される。** 通常のアプリのように JSON を投げる設計は成立しない。

この制約が、このアプリの設計判断のほぼすべてを決めている。

---

## 設計上の中心的な判断

### 1. 災害報告を 19 バイト固定長バイナリに圧縮する

同じ内容を JSON で送れば数百バイトになる。`trustmap-scoring/src/utils/codec.ts` では
1 件の災害報告を次のレイアウトに詰めている。

```
┌──────┬─────┬──────────┬─────┬─────────┬──────────┬──────────┬──────────┐
│  id  │ cat │ severity │ iss │   lat   │   lng    │   time   │  note    │
│  4B  │ 1B  │   1B     │ 1B  │   4B    │   4B     │   4B     │ 0〜32B   │
└──────┴─────┴──────────┴─────┴─────────┴──────────┴──────────┴──────────┘
                                                       固定部 = 19 バイト
```

- 緯度経度は `float32`（約 1m 精度）に落として 4 バイトずつに収める
- 災害カテゴリ（浸水 / 火災 / 道路封鎖 / 建物倒壊 / 津波 / 土砂崩れ / ガス漏れ / 危険 / 負傷者）は 1 バイトの列挙値
- 自由記述は 32 バイトで打ち切る。帯域制約を型と定数で明示している

### 2. 決定論的パケット ID で、メッシュのエコーバックを弾く

メッシュ網では自分の送った報告が他ノード経由で返ってくる。`lib/postToPacket.ts` は
`timestamp` + 災害種別 + 小数第 4 位に丸めた座標から ID を生成するため、
**ローカル投稿と、BLE 経由で受信した同一報告が必ず同じ ID になる。**
これにより重複排除が経路によらず機能する。

### 3. 信頼度スコアリングをアプリから独立させる

誰でも投稿できる以上、誤報・悪意ある投稿をどう扱うかが地図の価値を決める。
`trustmap-scoring/` を UI に依存しない独立パッケージとして切り出し、単体でテストしている。

| モジュール | 責務 |
|---|---|
| `clusterEngine.ts` | 近接した同カテゴリの報告を 1 つの事象にまとめる |
| `outlier.ts` | クラスタから外れた報告を除外する |
| `decay.ts` | 時間経過でスコアを減衰させる（古い情報を自動的に薄くする） |
| `scoreEngine.ts` | 発信者重み × 時間減衰 の総和でクラスタを採点し、3 段階の星に変換 |
| `codec.ts` | 19 バイトのエンコード / デコード |
| `receiveHandler.ts` | 署名検証 → 重複排除 → 保存 |

発信者重みは、自治体などの公式発信を 5.0 固定、一般ユーザーは信頼度スコア（0〜100）に応じて
0.5〜2.0 でスケールする。**1 人の投稿では星は上がらず、複数人の観測が重なって初めて信頼される**設計。

### 4. オンライン / オフラインの二層構成

| 状態 | チャット・投稿 | 認証 | 地図・防災データ |
|---|---|---|---|
| オンライン | Firebase Firestore（リアルタイム同期） | Firebase Auth | GeoJSON + オンライン地図 |
| オフライン | Expo SQLite + BLE メッシュ | `lib/offlineAuth.ts` | 同梱 SQLite (`bousai.db`) と GeoJSON |

信頼度スコアも同様に二層で、オフライン時は SQLite のキャッシュ、復帰時に Firestore へ同期する（`lib/userTrust.ts`）。

---

## 主な機能

| 画面 | 内容 |
|---|---|
| ホーム (`app/index.tsx`) | 現在の接続状態、緊急情報 |
| 地図 (`app/map/`) | 避難所・道路の表示、Turf.js + geojson-path-finder による経路探索、オフライン対応 |
| チャット (`app/chat/`) | Firestore リアルタイム / BLE 経由の地域チャット |
| 災害報告 | カメラ撮影 + 位置情報から報告を作成し、パケット化して送信 |
| 防災 (`app/disaster/`) | チェックリスト、緊急連絡先、防災マニュアル |
| AI (`app/ai/`) | 災害アシスタント |
| 管理画面 (`app/admin/`) | 報告一覧、ユーザー管理、全体マップ |
| 設定 (`app/settings/`) | プロフィール、アドフォン端末の接続設定 |

---

## アーキテクチャ

```
   スマートフォン                Raspberry Pi              遠隔拠点
  ┌──────────────┐            ┌──────────────┐          ┌──────────┐
  │  Expo App    │◀── BLE ───▶│ BLE GATT     │◀ LoRa ──▶│  Pi      │
  │  (Central)   │   GATT     │ (Peripheral) │  LPWA    │ (Relay)  │
  └──────┬───────┘            └──────────────┘          └──────────┘
         │
         ├── オンライン時 ──▶ Firebase (Auth / Firestore)
         └── オフライン時 ──▶ Expo SQLite (bousai.db)
```

### BLE GATT の定義

UUID はアプリ側（`lib/ble2.ts`）と Raspberry Pi 側で共有し、プロトコルの単一情報源としている。

| Characteristic | UUID | 方向 |
|---|---|---|
| Service | `ad000001-ad00-ad00-ad00-ad0000000001` | — |
| TX (Write) | `ad000001-ad00-ad00-ad00-ad0000000002` | App → Pi |
| RX (Notify) | `ad000001-ad00-ad00-ad00-ad0000000003` | Pi → App |
| META (Notify) | `ad000001-ad00-ad00-ad00-ad0000000004` | Pi → 全クライアント（接続数の通知） |

---

## 技術スタック

| 領域 | 採用 | 選定理由 |
|---|---|---|
| フレームワーク | Expo SDK 53 / React Native 0.79 / React 19 | iOS・Android 両対応。ネイティブ BLE モジュールを使うため dev client（bare 寄り）構成 |
| 言語 | TypeScript 5.8 | パケット仕様を型で表現し、エンコード時のミスをコンパイル時に落とす |
| ルーティング | Expo Router v5 | ファイルベース |
| BLE | react-native-ble-plx / react-native-ble-manager | Android 12+ の権限モデルに対応が必要 |
| 地図 | react-native-maps / Turf.js / geojson-path-finder | 経路探索をクライアント側で完結させ、オフラインでも動かすため |
| オンライン | Firebase 12（Auth / Firestore） | リアルタイム同期を自前で作らない |
| オフライン | Expo SQLite | 防災データを同梱し、通信ゼロで引けるようにする |
| 状態管理 | React Context のみ | 画面間で共有する状態が限定的なため、Redux 等は採用していない |

---

## セットアップ

要件: Node.js 20 以上 / Android Studio または Xcode（Expo Go では BLE が動かないため dev client が必要）

```bash
npm install

npm start          # 開発サーバー（dev client）
npm run android    # Android 実機・エミュレータ
npm run ios        # iOS
npm run lint       # ESLint
```

### Firebase

`.firebaserc` / `firebase.json` / `firestore.rules` / `firestore.indexes.json` はこのディレクトリ直下。
セキュリティルールを変更したら反映が必要。

```bash
firebase deploy --only firestore:rules
```

### WSL + Docker で開発する場合

`.env` に Expo dev server の IP を設定する。

```
HOST_IP_ADDRESS=xxx.xxx.x.x
```

`/mnt/c` 配下では inotify のファイル監視が取りこぼすため、fast refresh が効かないことがある。

### ビルド（EAS）

```bash
eas build --platform android
eas build --platform ios
```

---

## ディレクトリ構成

```
app/                    # 画面（Expo Router のファイルベースルーティング）
components/             # 共通 UI コンポーネント
contexts/               # BLE / 通知 / 災害報告 / UI のグローバル状態
hooks/                  # useBleConnected など
lib/
  ble2.ts               # BLE 操作と UUID 定義
  postToPacket.ts       # 投稿 → RawPacket 変換・決定論的 ID 生成
  userTrust.ts          # 信頼度スコア（SQLite / Firestore 二層）
  trustFeedSync.ts      # オフライン→オンライン復帰時の同期
  db.ts / firebase.ts / auth.ts / offlineAuth.ts
trustmap-scoring/       # 信頼度スコアリング（独立パッケージ・テストあり）
  src/services/         # クラスタリング / 外れ値除去 / 採点 / 受信処理
  src/utils/codec.ts    # 19 バイトパケットのエンコード・デコード
  tests/                # vitest（8 ファイル）
constants/              # Colors.ts / Design.ts（デザイントークン）
assets/
  database/bousai.db    # 防災データ（SQLite）
  geojson/              # roads_all.json / shelters.json
```

---

## テスト

信頼度スコアリングにはユニットテストがある（クラスタリング / 外れ値 / 減衰 / 採点 / codec / 受信処理 / 統合）。

```bash
cd trustmap-scoring
npm install     # vitest の導入が必要
npm test
```

UI 側の自動テストは未整備。

---

## 設計方針：アクセシビリティ

災害時に高齢者から子どもまでが使うことを前提に、`constants/Design.ts` にトークンを定義している。

- 本文フォント 16px 以上、タイトル 20px 以上
- 落ち着いたブルー基調に、安全（緑）・危険（赤）を明確に分離
- スペーシングは 8px ベース、ボーダー半径 12〜24px

---

## 現在の状態

- `lib/ble2.ts` は **スタブ実装**（BLE 無効）になっている。実機の BLE 依存を切り離して開発するための一時措置で、
  実装本体は git 履歴（`8537bc7`）に残っている。復元する場合は `react-native-ble-manager` の再導入が必要。
- `trustmap-scoring` は vitest が未インストールのため、そのままでは `npm test` が走らない。
