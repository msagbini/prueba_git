// The @react-native/jest-preset default transformIgnorePatterns assumes a
// flat node_modules (npm/yarn classic) — it matches "node_modules/<pkg>/"
// right after the first "node_modules/" segment. Under pnpm, real package
// files live nested inside "node_modules/.pnpm/<name>@<version>/node_modules/
// <pkg>/", so that default pattern always finds an "ignore" match at the
// outer ".pnpm/" segment before ever reaching the real package name —
// leaving react-native's and React Navigation's own untranspiled-ESM
// packages (e.g. @react-native/js-polyfills, @react-navigation/native)
// unparsed and breaking every test. These two patterns check both the
// pnpm-nested and the flat shape explicitly instead of relying on the
// single pattern that only covers the flat case.
const reactNativePackages =
  '((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-screens|react-native-safe-area-context)';

module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    `node_modules/\\.pnpm/[^/]+/node_modules/(?!${reactNativePackages}/)`,
    `node_modules/(?!\\.pnpm/)(?!${reactNativePackages}/)`,
  ],
};
