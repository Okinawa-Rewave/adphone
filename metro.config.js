// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Windows FallbackWatcher が gradle-plugin の Kotlin テストディレクトリを
// 監視しようとして ENOENT でクラッシュするのを防ぐ
config.resolver.blockList = [
  /node_modules\/@react-native\/gradle-plugin\/.*/,
];

module.exports = config;
