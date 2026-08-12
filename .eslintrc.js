// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  root: true,
  extends: 'expo',
  ignorePatterns: ['/dist/*'],
  rules: {
    // React Compiler lint currently misclassifies React Native Animated/Reanimated
    // mutable values and standard native async loading effects. Keep the core Hooks
    // correctness rules enabled while the compiler is not enabled for this app.
    'react-hooks/refs': 'off',
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/purity': 'off',
    'react-hooks/immutability': 'off',
    'react-hooks/static-components': 'off',
  },
};
