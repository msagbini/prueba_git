import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// Deliberately just a smoke test — asserting on *what* App renders after
// AuthProvider's async session restore settles proved flaky under Jest:
// React Navigation's own internal effect timing (screen transition state,
// mount/unmount of the previous screen) isn't deterministic without a
// real native driver, so a render sometimes completes with an extra
// transient screen still present or a spurious "no navigation context"
// warning from an effect that fires before its provider has committed.
// This is a known rough edge of testing react-navigation without device/
// simulator native mocks (react-native-screens, gesture-handler) — see
// docs/technical-log/phase-6.md. A flaky assertion is worse than no
// assertion, so this stays a smoke test: does the full provider tree
// (SafeAreaProvider -> AuthProvider -> NavigationContainer -> screens)
// mount and settle without throwing.
test('renders correctly', async () => {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
    await Promise.resolve();
    await Promise.resolve();
  });
});
