import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { JobDetailScreen } from '../screens/JobDetailScreen';
import { JobsListScreen } from '../screens/JobsListScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SelectOrganizationScreen } from '../screens/SelectOrganizationScreen';

export type AuthStackParamList = {
  Login: undefined;
  SelectOrganization: undefined;
};

export type AppStackParamList = {
  JobsList: undefined;
  JobDetail: { jobId: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

/**
 * A "Sign out" header button, used on `JobsListScreen`.
 * @returns the button element
 */
function SignOutButton(): React.JSX.Element {
  const { logout } = useAuth();
  return (
    <TouchableOpacity onPress={() => logout()}>
      <Text style={styles.signOut}>Sign out</Text>
    </TouchableOpacity>
  );
}

/**
 * The app's root navigation: an unauthenticated stack (login, then
 * organization selection if the account has more than one membership)
 * or the authenticated jobs stack, switched on `AuthContext`'s `status`.
 * No route in the authenticated stack is reachable without a session —
 * this *is* the auth gate the Fase 2 scaffold's placeholder comment
 * pointed at.
 * @returns the active navigation stack element
 */
export function RootNavigator(): React.JSX.Element {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (status === 'authenticated') {
    return (
      <AppStack.Navigator>
        <AppStack.Screen
          name="JobsList"
          component={JobsListScreen}
          options={{ title: 'My jobs', headerRight: SignOutButton }}
        />
        <AppStack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job' }} />
      </AppStack.Navigator>
    );
  }

  return (
    <AuthStack.Navigator>
      {status === 'needsOrganizationSelection' ? (
        <AuthStack.Screen
          name="SelectOrganization"
          component={SelectOrganizationScreen}
          options={{ title: 'Choose organization' }}
        />
      ) : (
        <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      )}
    </AuthStack.Navigator>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  signOut: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '600',
  },
});
