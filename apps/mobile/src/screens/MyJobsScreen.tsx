import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '../api/client';
import type { Job, Paginated } from '../types/api';

const STATUS_LABELS: Record<Job['status'], string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

/**
 * The CLIENT-role caller's own jobs, read-only — `GET /jobs` already
 * scopes to the caller's own records server-side (`JobsService`'s
 * Client visibility filter). No clock in/out actions here (a CLIENT
 * caller can't act on jobs), unlike `JobsListScreen`'s Staff view.
 * @returns the jobs list element
 */
export function MyJobsScreen(): React.JSX.Element {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const result = await apiFetch<Paginated<Job>>('/jobs?pageSize=100');
    setJobs(result.items);
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

  if (jobs === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (jobs.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No jobs yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={jobs}
      keyExtractor={(job) => job.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.rowText}>
            {item.scheduledStart ? (
              <Text style={styles.scheduled}>{new Date(item.scheduledStart).toLocaleString()}</Text>
            ) : (
              <Text style={styles.scheduled}>Unscheduled</Text>
            )}
            {item.serviceAddress && (
              <Text style={styles.address}>
                {item.serviceAddress.addressLine1}, {item.serviceAddress.city}
              </Text>
            )}
          </View>
          <Text style={[styles.status, statusStyle(item.status)]}>
            {STATUS_LABELS[item.status]}
          </Text>
        </View>
      )}
    />
  );
}

/**
 * Picks a status pill's color.
 * @param status the job's status
 * @returns a style object to merge into the status text
 */
function statusStyle(status: Job['status']): { color: string } {
  switch (status) {
    case 'IN_PROGRESS':
      return { color: '#2563eb' };
    case 'COMPLETED':
      return { color: '#16a34a' };
    case 'CANCELLED':
      return { color: '#dc2626' };
    default:
      return { color: '#6b7280' };
  }
}

const styles = StyleSheet.create({
  address: {
    color: '#6b7280',
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
    alignItems: 'center',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  rowText: {
    flex: 1,
  },
  scheduled: {
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
  },
});
