# アプリ構成メモ

## 環境

| 項目 | バージョン |
|------|-----------|
| Node.js | v24.10.0 |
| npm | 11.12.1 |
| React Native | 0.79.6 |
| Expo SDK | 53 |
| TypeScript | 5.8 |
| React | 19.0.0 |

- New Architecture 有効（`newArchEnabled: true`）
- EAS Project ID: `cf8ec193-d7db-428c-9d74-67df87f483c2`

## 概要

災害時に周辺の危険情報を可視化し、安全な避難経路を案内するモバイルアプリ。  
Firebase プロジェクト: `overcome-the-disasters`

## マップのアーキテクチャ方針

地図描画を **React Native 側では行わず**、`assets/web/map.html`（Leaflet.js）を WebView で表示し、`postMessage` で双方向通信する構成。

- 経路探索・災害回避フィルタリングは RN 側（JS）で完結し、結果座標のみ WebView に送る
- オフライン時は leaflet.offline が IndexedDB にキャッシュしたタイルを使用

## TrustMap エンジン（`trustmap-scoring/`）

LoRa / BLE 経由の住民・公的機関からの災害報告パケットを集約・信頼スコアリングする独立モジュール。  
**現状はダミーパケットで動作確認中**（本番では削除予定のコメントあり）。

## 旧マップ実装（`app/alt/`）

静止PNG + ピンチ/パン 方式の実装。現在は `app/alt/` にのみ残っており、メインフローでは使われていない。
