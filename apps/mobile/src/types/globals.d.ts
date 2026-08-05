// React Native has provided `atob`/`btoa` as core JS globals since 0.72
// (see `InitializeCore.js` in react-native) — this app targets 0.86, so
// they're always present at runtime. `@react-native/typescript-config`
// doesn't include the DOM lib (this isn't a browser), so tsc has no
// ambient declaration for them without this file.
declare function atob(data: string): string;
declare function btoa(data: string): string;
