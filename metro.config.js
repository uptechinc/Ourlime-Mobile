const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Update the resolver to handle SVG files
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== "svg");
config.resolver.sourceExts = [...config.resolver.sourceExts, "svg"];

config.transformer.babelTransformerPath = require.resolve("react-native-svg-transformer");

// Alias native codegen imports to our web-compatible shim
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (context.originModulePath && context.originModulePath.includes("lib/shims")) {
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  }

  if (
    (moduleName.includes("codegenNativeComponent") ||
      moduleName.includes("codegenNativeCommands") ||
      moduleName.includes("codegenNative")) &&
    platform === "web"
  ) {
    return {
      filePath: path.resolve(__dirname, "lib/shims/codegenNativeComponent.js"),
      type: "sourceFile",
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./app/globals.css" });
