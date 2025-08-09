このプロジェクトはReact Native + Dockerで動作します
Docker Desktop を起動する
WSLを開く
ymlファイルがあるディレクトリReactNativeに移動する
./ReactNativeに.envファイルを作成し自分のipv4アドレスを書く
HOST_IP_ADDRESS=xxx.xxx.x.x
ターミナルでコンテナを起動する
1．docker-compose up --build
コンテナに入る
2．docker-compose exec expo-app sh
expo
3．npx create-expo-app
What is your app named? … と聞かれるのでmy-appなどにしておく
4．cd my-app
expoサーバ起動したら開発できるようになる
5．npx expo start
QRコードが生成される

【スマホで動作確認できるようになった】
expo go アプリをスマホにインストールしてカメラでqrコード読み取るとスマホ上で動作確認できるはずだったけどできなかったのを修正できた
@expo/ngrokをインストールする
6．yarn add @expo/ngrok
7．npx expo start --tunnel