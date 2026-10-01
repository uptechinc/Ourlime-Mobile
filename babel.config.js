module.exports = function (api) {
  api.cache(true);
  return {
    compact: false,
    generatorOpts: {
      compact: false,
    },
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
