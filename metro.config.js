// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");

module.exports = (() => {
  const config = getDefaultConfig(__dirname);
  // Make sure .tflite files are treated as assets:
  config.resolver.assetExts = [...config.resolver.assetExts, "tflite"];
  return config;
})();
