import * as Keychain from 'react-native-keychain';

/** The access/refresh token pair persisted between app launches. */
export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

const KEYCHAIN_SERVICE = 'dos.session';

/**
 * Persists the current session's tokens in the platform secure storage
 * (iOS Keychain / Android Keystore, via `react-native-keychain`) — see
 * docs/architecture/auth.md, which specifies this (not `AsyncStorage`,
 * not a cookie) as the mobile token-storage mechanism. Both tokens are
 * stored together as a single JSON blob under the "password" field,
 * since `setGenericPassword` only models one username/password pair.
 * @param tokens the tokens to persist
 */
export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Keychain.setGenericPassword('dos-session', JSON.stringify(tokens), {
    service: KEYCHAIN_SERVICE,
  });
}

/**
 * Reads the persisted session, if any — used to restore a session on app launch.
 * @returns the stored tokens, or null if nothing (or something unparseable) is stored
 */
export async function loadTokens(): Promise<StoredTokens | null> {
  const credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
  if (!credentials) {
    return null;
  }
  try {
    return JSON.parse(credentials.password) as StoredTokens;
  } catch {
    return null;
  }
}

/**
 * Clears the persisted session — called on logout.
 */
export async function clearTokens(): Promise<void> {
  await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
}
