import { useCallback, useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ClientHomeScreen } from '../screens/ClientHomeScreen';
import { JobDetailScreen } from '../screens/JobDetailScreen';
import { JobsListScreen } from '../screens/JobsListScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MyInvoiceDetailScreen } from '../screens/MyInvoiceDetailScreen';
import { MyInvoicesScreen } from '../screens/MyInvoicesScreen';
import { MyJobsScreen } from '../screens/MyJobsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { SelectOrganizationScreen } from '../screens/SelectOrganizationScreen';

const NOTIFICATIONS_POLL_INTERVAL_MS = 30_000;

export type AuthStackParamList = {
  Login: undefined;
  SelectOrganization: undefined;
};

export type AppStackParamList = {
  JobsList: undefined;
  JobDetail: { jobId: string };
  Notifications: undefined;
};

/** The CLIENT-role stack — see `ClientHomeScreen`'s jsdoc for why it's separate from `AppStackParamList`. */
export type ClientStackParamList = {
  ClientHome: undefined;
  MyJobs: undefined;
  MyInvoices: undefined;
  MyInvoiceDetail: { invoiceId: string };
  Notifications: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const ClientStack = createNativeStackNavigator<ClientStackParamList>();

/**
 * A "Sign out" header button, used on the home screen of both
 * authenticated stacks.
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
 * A notifications header button — a bell with an unread-count badge,
 * polled every {@link NOTIFICATIONS_POLL_INTERVAL_MS} (mirrors
 * `apps/web`'s `NotificationBell` polling), navigating to
 * `NotificationsScreen`. Shared by both authenticated stacks — `as
 * never` on `navigate` is the standard React Navigation escape hatch
 * for a header button whose stack (and therefore exact param list
 * type) isn't known until `RootNavigator` picks one at render time.
 * @returns the button element
 */
function NotificationsButton(): React.JSX.Element {
  const [unreadCount, setUnreadCount] = useState(0);
  const navigation = useNavigation();

  const refreshUnreadCount = useCallback(async () => {
    try {
      const { count } = await apiFetch<{ count: number }>('/notifications/unread-count');
      setUnreadCount(count);
    } catch {
      // Ignore — a stale badge is better than an error on every screen.
    }
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, NOTIFICATIONS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Notifications' as never)}
      style={styles.notificationsButton}
    >
      <Text style={styles.notificationsBell}>🔔</Text>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * The home screen's combined header-right: notifications button plus
 * sign out, side by side — React Navigation's `headerRight` takes one
 * slot, so both live in one row here.
 * @returns the header actions element
 */
function HeaderActions(): React.JSX.Element {
  return (
    <View style={styles.headerActions}>
      <NotificationsButton />
      <SignOutButton />
    </View>
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
          options={{ title: 'DOS', headerRight: HeaderActions }}
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
        <ClientStack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: 'Notifications' }}
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
          options={{ title: 'My jobs', headerRight: HeaderActions }}
        />
        <AppStack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job' }} />
        <AppStack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: 'Notifications' }}
        />
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
  badge: {
    alignItems: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 16,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -4,
    top: -4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  notificationsBell: {
    fontSize: 18,
  },
  notificationsButton: {
    padding: 2,
    position: 'relative',
  },
  signOut: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '600',
  },
});
