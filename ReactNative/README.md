# React Native + Docker 環境構築手順

このプロジェクトは **React Native + Docker** で動作します。  
以下の手順に従って開発環境をセットアップしてください。

---

## 1. 前提条件
- Docker Desktop がインストールされていること
- WSL が利用可能であること（Windowsの場合）

---

## 2. 環境構築手順

### 2.1 Docker Desktop を起動
まず **Docker Desktop** を起動します。

### 2.2 WSLを開く
WSL（Linuxターミナル）を開きます。

### 2.3 プロジェクトディレクトリへ移動
`docker-compose.yml` があるディレクトリへ移動します。

```bash
cd ReactNative
2.4 .env ファイルを作成
./ReactNative 内に .env ファイルを作成し、自分のIPv4アドレスを記入します。

env
Copy
Edit
HOST_IP_ADDRESS=xxx.xxx.x.x
3. コンテナの起動
3.1 コンテナをビルド＆起動
bash
Copy
Edit
docker-compose up --build
3.2 コンテナに入る
bash
Copy
Edit
docker-compose exec expo-app sh
4. Expoアプリの作成
4.1 新しいExpoアプリを作成
bash
Copy
Edit
npx create-expo-app
What is your app named? と聞かれたら、my-app など任意の名前を入力します。

4.2 作成したアプリに移動
bash
Copy
Edit
cd my-app
5. Expoサーバの起動
bash
Copy
Edit
npx expo start
ターミナルに QRコード が表示されます。

6. スマホで動作確認
スマホに Expo Go アプリをインストール

カメラでQRコードを読み取る

⚠️ ただし、初期状態では接続できない場合があります。
その場合は以下の手順で修正してください。

7. 接続不具合の修正（@expo/ngrok 利用）
7.1 @expo/ngrok をインストール
bash
Copy
Edit
yarn add @expo/ngrok
7.2 トンネルモードでExpoを起動
bash
Copy
Edit
npx expo start --tunnel
これでスマホからアクセスできるようになります 🎉