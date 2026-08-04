/**
 * The DOS API's base URL. Hardcoded for now (no `.env` tooling wired up
 * for this bare React Native app yet — that's a deploy-time concern for
 * a later phase, not something to add a native config module for just to
 * read one string). Override at build time by editing this constant.
 *
 * Note for local development: `localhost` reaches the host machine from
 * an iOS simulator, but an Android emulator must use `10.0.2.2` instead
 * — its own alias for the host loopback interface.
 */
export const API_BASE_URL = 'http://localhost:3000';
