module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Reanimated 4 moved its Babel plugin into a separate `react-native-worklets` package.
    plugins: ["react-native-worklets/plugin"],
  };
};
