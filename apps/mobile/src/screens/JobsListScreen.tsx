import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import type { AppStackParamList } from '../navigation/RootNavigator';
import type { Job } from '../types/api';

type Props = NativeStackScreenProps<AppStackParamList, 'JobsList'>;

const STATUS_LABELS: Record<Job['status'], string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

/**
 * The field-staff caller's assigned jobs (row-level visibility is
 * enforced server-side — `GET /jobs` as Staff only ever returns jobs
 * they're assigned to). Refetches every time the screen regains focus,
 * so returning from `JobDetailScreen` after starting/completing a job
 * shows its current status without a manual pull-to-refresh.
 * @param props navigation props
 * @param props.navigation used to open a job's detail screen
 * @returns the jobs list element
 */
export function JobsListScreen({ navigation }: Props): React.JSX.Element {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const result = await apiFetch<Job[]>('/jobs');
    setJobs(result);
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
        <Text style={styles.emptyText}>No jobs assigned to you yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={jobs}
      keyExtractor={(job) => job.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
        >
          <View style={styles.rowText}>
            <Text style={styles.clientName}>{item.client.name}</Text>
            {item.scheduledStart && (
              <Text style={styles.scheduled}>{new Date(item.scheduledStart).toLocaleString()}</Text>
            )}
          </View>
          <Text style={[styles.status, statusStyle(item.status)]}>
            {STATUS_LABELS[item.status]}
          </Text>
        </TouchableOpacity>
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
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
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
    color: '#6b7280',
    fontSize: 13,
    marginTop: 2,
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
  },
});
