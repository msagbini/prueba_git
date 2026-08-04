import { clearTokens, loadTokens, saveTokens } from './tokenStorage';

// react-native-keychain is Jest-mocked (see __mocks__/react-native-keychain.js)
// with an in-memory store — the real Keychain/Keystore round trip needs an
// actual device/simulator this sandbox doesn't have (see
// docs/technical-log/phase-6.md). This still verifies the JSON
// serialize/deserialize contract tokenStorage.ts relies on.
describe('tokenStorage', () => {
  it('returns null when nothing is stored', async () => {
    await expect(loadTokens()).resolves.toBeNull();
  });

  it('round-trips a saved token pair', async () => {
    const tokens = { accessToken: 'access-123', refreshToken: 'refresh-456' };
    await saveTokens(tokens);
    await expect(loadTokens()).resolves.toEqual(tokens);
  });

  it('returns null again after clearing', async () => {
    await saveTokens({ accessToken: 'a', refreshToken: 'b' });
    await clearTokens();
    await expect(loadTokens()).resolves.toBeNull();
  });
});
