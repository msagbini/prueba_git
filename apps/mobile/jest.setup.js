// Without this, SafeAreaProvider never receives the (native-only) initial
// insets measurement under Jest and renders no children at all — every
// screen test would see an empty tree. react-native-safe-area-context
// ships this mock for exactly this reason; it must be registered via
// jest.mock (a setupFiles entry that merely executes the mock module
// doesn't replace the real module in the registry).
// The library's mock module is a default export (an object of named
// members); app code imports those members as named imports
// (`import { SafeAreaProvider } from '...'`), so the factory needs to
// re-expose `.default`'s properties as the mocked module's own top-level
// exports, not return the `{ default: {...} }` wrapper as-is.
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});
