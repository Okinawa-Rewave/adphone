// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// trustmap-scoringを読み込めるようにする
config.watchFolders = [
  path.resolve(__dirname, 'trustmap-scoring')
];

config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'ts', 'tsx'
];

module.exports = config;
