import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ClientHomeScreen } from '../screens/ClientHomeScreen';
import { JobDetailScreen } from '../screens/JobDetailScreen';
import { JobsListScreen } from '../screens/JobsListScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MyInvoiceDetailScreen } from '../screens/MyInvoiceDetailScreen';
import { MyInvoicesScreen } from '../screens/MyInvoicesScreen';
import { MyJobsScreen } from '../screens/MyJobsScreen';
import { SelectOrganizationScreen } from '../screens/SelectOrganizationScreen';

export type AuthStackParamList = {
  Login: undefined;
  SelectOrganization: undefined;
};

export type AppStackParamList = {
  JobsList: undefined;
  JobDetail: { jobId: string };
};

/** The CLIENT-role stack — see `ClientHomeScreen`'s jsdoc for why it's separate from `AppStackParamList`. */
export type ClientStackParamList = {
  ClientHome: undefined;
  MyJobs: undefined;
  MyInvoices: undefined;
  MyInvoiceDetail: { invoiceId: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const ClientStack = createNativeStackNavigator<ClientStackParamList>();

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
 * or one of two authenticated stacks, switched on `AuthContext`'s
 * `status` and (once authenticated) `role`. No route in either
 * authenticated stack is reachable without a session — this *is* the
 * auth gate the Fase 2 scaffold's placeholder comment pointed at.
 * A CLIENT-role caller gets `ClientStack` (read-only jobs/invoices)
 * instead of `AppStack` (Staff's assigned-jobs + clock in/out) — a
 * CLIENT caller holds none of `AppStack`'s implicit assumptions (it
 * has no clock in/out actions to offer, and `GET /jobs` for a Client
 * returns their own jobs, not "assigned to me" ones).
 * @returns the active navigation stack element
 */
export function RootNavigator(): React.JSX.Element {
  const { status, role } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (status === 'authenticated' && role === 'CLIENT') {
    return (
      <ClientStack.Navigator>
        <ClientStack.Screen
          name="ClientHome"
          component={ClientHomeScreen}
          options={{ title: 'DOS', headerRight: SignOutButton }}
        />
        <ClientStack.Screen name="MyJobs" component={MyJobsScreen} options={{ title: 'My jobs' }} />
        <ClientStack.Screen
          name="MyInvoices"
          component={MyInvoicesScreen}
          options={{ title: 'My invoices' }}
        />
        <ClientStack.Screen
          name="MyInvoiceDetail"
          component={MyInvoiceDetailScreen}
          options={{ title: 'Invoice' }}
        />
      </ClientStack.Navigator>
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
