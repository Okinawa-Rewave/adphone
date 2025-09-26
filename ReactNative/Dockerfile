#latest
FROM node:24-alpine3.21 

RUN apk update && apk add git

# 作業ディレクトリを /app に設定
WORKDIR /app

COPY package*.json ./

RUN npm install expo-cli

# ソースコードをコンテナにコピー
COPY . .

EXPOSE 8081