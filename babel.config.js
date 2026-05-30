module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // react-native-worklets/plugin must be listed last (replaces the old
    // react-native-reanimated/plugin for Reanimated 4).
    plugins: ['react-native-worklets/plugin'],
  };
};
