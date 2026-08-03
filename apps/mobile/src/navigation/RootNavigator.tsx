import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';

export type RootStackParamList = {
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * The app's root navigation stack. A single placeholder route today — auth
 * gating (login screen, protected routes) and the real screens per module
 * are Fase 6 work, mirroring the routing shell built for apps/web in this
 * phase.
 * @returns the stack navigator element
 */
export function RootNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'DOS' }} />
    </Stack.Navigator>
  );
}
