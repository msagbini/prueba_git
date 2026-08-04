import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch } from '../api/client';
import type { AppNotification, Paginated } from '../types/api';

/**
 * Formats how long ago a timestamp was — mirrors `apps/web`'s
 * `NotificationBell.timeAgo`. Hand-copied rather than shared, matching
 * how `types/api.ts` is hand-copied per app in this monorepo rather
 * than pulled from a shared package.
 * @param iso the timestamp to format
 * @returns a short relative-time string
 */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * The caller's own notifications — reachable from both the Staff and
 * Client stacks via the header's `NotificationsButton` (see
 * `RootNavigator`). Tapping an unread one marks it read; no deep link
 * to the underlying job/invoice, same reasoning as `apps/web`'s
 * `NotificationBell` — every current notification type already has an
 * obvious next step without one.
 * @returns the notifications list element
 */
export function NotificationsScreen(): React.JSX.Element {
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const result = await apiFetch<Paginated<AppNotification>>('/notifications?pageSize=50');
    setNotifications(result.items);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleMarkRead = async (notification: AppNotification): Promise<void> => {
    if (notification.readAt) return;
    try {
      await apiFetch(`/notifications/${notification.id}/read`, { method: 'POST' });
      setNotifications(
        (current) =>
          current?.map((n) =>
            n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n,
          ) ?? null,
      );
    } catch {
      // Ignore — worst case it just stays marked unread.
    }
  };

  if (notifications === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (notifications.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No notifications yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={notifications}
      keyExtractor={(n) => n.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.row, !item.readAt && styles.unreadRow]}
          onPress={() => handleMarkRead(item)}
        >
          <View style={styles.rowHeader}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
          </View>
          <Text style={styles.body}>{item.body}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  body: {
    color: '#4b5563',
    fontSize: 13,
    marginTop: 2,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
  },
  row: {
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: {
    color: '#9ca3af',
    fontSize: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  unreadRow: {
    backgroundColor: '#eff6ff',
  },
});
