const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// expo-sqlite's web worker imports its WASM binary during production bundling.
if (!config.resolver.assetExts.includes("wasm")) config.resolver.assetExts.push("wasm");
// Signing credentials, Gradle caches and APKs must stay outside Metro's file graph.
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  /[/\\]\.local[/\\].*/,
  /[/\\]artifacts[/\\].*/,
];
module.exports = config;
