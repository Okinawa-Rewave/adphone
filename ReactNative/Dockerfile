#latest
FROM node:24-alpine3.21 

RUN apk update && apk add git

# 作業ディレクトリを /app に設定
WORKDIR /app

COPY package*.json ./
# 参考サイトのnpm install -g expo-cli のままだと -g が非推奨とのことでした。システム全体にインストールするという意味
RUN npm install expo-cli

# ソースコードをコンテナにコピー
COPY . .

EXPOSE 8081