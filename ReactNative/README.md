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
```
2.4 .env ファイルを作成

./ReactNative 内に .env ファイルを作成し、自分のIPv4アドレスを記入します。
```bash:.env
HOST_IP_ADDRESS=xxx.xxx.x.x
```
3. コンテナの起動

コンテナをビルド＆起動します。
```bash
docker-compose up --build
```
3.2 コンテナに入る

以降コンテナ内で操作します。
```bash
docker-compose exec expo-app sh
```
4. 新しいExpoアプリを作成

4.1 開発環境となるExpoアプリを作ります。
```bash
npx create-expo-app
```
What is your app named? と聞かれたら、my-app など任意の名前を入力します。

4.2 作成したアプリに移動
```bash
cd my-app
```
5. Expoサーバの起動
```bash
npx expo start
```
ターミナルに QRコード が表示されます。

6. スマホで動作確認
スマホに Expo Go アプリをインストール

カメラでQRコードを読み取る

⚠️ ただし、初期状態では接続できない場合があります。
その場合は以下の手順で修正してください。

7. 接続不具合の修正
トンネルモードでExpoを起動
```bash
npx expo start --tunnel
```
これでスマホからアクセスできるようになります 

### 8. (追記)React Native（Expo 含む）の Fast Refresh が効かない問題が解決できました。

8.1 原因

・Windows 側（/mnt/c/...）に置いている場合の問題

WSL は Windows のファイルシステム（NTFS）を /mnt/c/ にマウントしてアクセスしています。
このマウントは inotify（Linuxのリアルタイムファイル監視機構）を正しくサポートしていません。
そのため、ファイルの保存があっても WSL 内のプロセス（例: Metro Bundler, Webpack, chokidar）が「変更通知」を受け取れない、または遅延することがあります。

・inux 側（/home/ユーザー名/...）に置くメリット

WSL の Linux ファイルシステム（ext4）は inotify を完全にサポートしており、保存した瞬間に変更イベントが発火します。
Metro Bundler や chokidar が即時に更新を検知 → Fast Refresh やホットリロードが安定して動く。
ファイルアクセスも /mnt/c より高速（Docker ビルドや依存関係インストールが早くなる）。

8.2 手順
移動先を作成
```bash
mkdir -p ~/ReactNative
```
プロジェクトをコピー
```bash
cp -a /mnt/c/Users/ic221210/ReactNarive/* ~/ReactNative/
```
VS Code で開く方法（重要）
Windows の VS Code で直接 /home/... を開くとまた NTFS を経由して遅くなる可能性があります。
代わりに VS Code Remote - WSL 拡張を使う。

VS Code で拡張機能「Remote - WSL」をインストール。

Ctrl+Shift+P → Remote-WSL: Open Folder in WSL。
/home/ic221210/ReactNative を選択して開く。

Docker を使っている場合の注意

docker-compose.yml の volumes: も Linux 側のパスに合わせて変更する。
```bash
volumes:
  - /home/ic221210/ReactNarive:/app
```
以上の状態でコンテナを起動後、コンテナに入ってExpoアプリを作ると直りました。

index.tsx を編集して保存 → 即時反映されれば成功です！

8.3 編集権限がない場合

所有者を現在のユーザーに変更（-R は再帰的）
```bash
sudo chown -R $(whoami):$(whoami) .
```
読み書き権限をユーザーに付与
```bash
chmod -R u+rw .
```
