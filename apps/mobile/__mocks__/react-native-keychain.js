// Manual Jest mock for react-native-keychain — the real package's native
// module doesn't exist under Jest (no device/simulator, no native
// linking in this test environment), so every test that renders
// AuthProvider needs this in-memory stand-in instead. Mirrors just the
// three functions src/auth/tokenStorage.ts calls.
let store = null;

module.exports = {
  setGenericPassword: jest.fn(async (username, password) => {
    store = { username, password };
    return { service: 'mock', storage: 'mock' };
  }),
  getGenericPassword: jest.fn(async () => (store ? { ...store, service: 'mock' } : false)),
  resetGenericPassword: jest.fn(async () => {
    store = null;
    return true;
  }),
};
