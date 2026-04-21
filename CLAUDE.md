# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Expo dev server (requires dev client build)
npm run android    # Run on Android device/emulator
npm run ios        # Run on iOS simulator
npm run lint       # ESLint via expo lint
```

Device builds (not Expo Go — the app uses native modules):
```bash
npx eas build --profile development --platform android
```

No test runner is configured. The `trustmap-scoring` package has its own `package.json` and tests:
```bash
cd trustmap-scoring && npm test
```

## Architecture Overview

**Adphone** は災害時の情報共有アプリ。オフライン環境（BLE/LoRa メッシュ）でも動作することを前提に設計されている。

### Routing

`expo-router` のファイルベースルーティング。全画面は `app/` 以下に配置。`app/_layout.tsx` がルートで、起動時に権限取得・Gemma モデル初期化・信頼度システム初期化を行う。

### Trust System (2層構造)

**Layer 1 — 投稿者の信頼度スコア (`lib/userTrust.ts`)**
- ユーザーごとに 0〜100 のスコア（デフォルト 50）
- agree +3 / disagree −5 で変動
- オフライン時: SQLite (`bousai.db`) にローカル保存 + 未同期キュー
- オンライン復帰時: `flushPendingVotes()` で Firestore へ一括同期
- Firestore トランザクションで二重計上を防止

**Layer 2 — イベント信頼度 (`trustmap-scoring/`)**
- BLE/LoRa で受信した `RawPacket` を `TrustMapEngine` で処理
- パケット受信フロー: 重複チェック → 署名検証 → 外れ値検出 → LocalDB 保存
- スコア計算: 時間減衰 × 発行者ウェイト（公式機関 5.0、一般ユーザー 0.5〜2.0）でクラスタースコアを算出
- `toStars()`: score ≥ 50 → ★★★、≥ 10 → ★★、それ以下 → ★
- `trustMapEngine` シングルトンを `lib/trustmap.ts` からエクスポート

**UI コンポーネント:**
- `TrustBadge` — `official / verified / partial / unverified` の 4段階バッジ
- `TrustMeter` — 0〜100 のスコアを色付きプログレスバーで表示
- `SignatureChain` — 署名者リスト（行政・消防・防災士・一般ユーザー）を折りたたみ表示

### Offline-First Storage

`lib/db.ts`: `expo-sqlite` で `bousai.db` を管理。初回起動時に `assets/bousai.db` からコピー。  
テーブル: `my_location`（自位置履歴）、`user_trust_scores`（信頼度スコアキャッシュ）、`votes`（未同期投票キュー）

### State Management

Context で管理（グローバル状態はすべて Provider 経由）:
- `NotificationContext` — フィードの投稿リスト・投票・署名アクション（`castVote` を呼ぶ）
- `BleContext` / `LpwaChatContext` — BLE/LPWA チャット状態
- `UIContext` — SideDrawer・CreatePostModal の開閉
- `DisasterReportContext` — 災害報告フォーム状態

### Key Integrations

**Firebase**: `lib/firebase.ts` で初期化。匿名認証（`lib/auth.ts`）でオンライン時のみ UID を取得。オフライン時は `lib/offlineAuth.ts` の UUID をフォールバックとして使用。

**Gemma (On-device AI)**: `lib/gemma.ts` が Android NativeModule `GemmaModule` をラップ。モデルパスは `/sdcard/gemma-3n-E4B-it-int4.litertlm`。`generateResponse` / `generateResponseWithImage` で推論。

**BLE**: `lib/ble2.ts` は現在スタブ実装（全操作がno-op）。BLE を再有効化する場合は git 履歴から元の実装を復元する必要がある。

### `NotificationItem` の主要フィールド

`trustLevel`: `"official" | "verified" | "partial" | "unverified"`  
`trustScore`: 0〜100（`TrustMeter` に渡す）  
`authorTrustScore`: 投稿者スコア（`issuerWeight` の計算元）  
`signatures`: 署名者配列（`SignatureChain` で表示）
