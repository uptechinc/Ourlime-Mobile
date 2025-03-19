const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Update the resolver to handle SVG files
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== "svg");
config.resolver.sourceExts = [...config.resolver.sourceExts, "svg"];

config.transformer.babelTransformerPath = require.resolve("react-native-svg-transformer");

module.exports = withNativeWind(config, { input: "./app/globals.css" });
