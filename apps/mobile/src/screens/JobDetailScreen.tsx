import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch, ApiError } from '../api/client';
import type { AppStackParamList } from '../navigation/RootNavigator';
import type { Job } from '../types/api';

type Props = NativeStackScreenProps<AppStackParamList, 'JobDetail'>;

/**
 * A single job's detail — client contact info, service address, billed
 * services, notes, and the clock in/out actions (`POST /jobs/:id/start`/
 * `/complete`). Errors from those actions (e.g. a 400 for an invalid
 * status transition, if the job was already acted on elsewhere) are
 * shown inline rather than silently swallowed.
 * @param props navigation props
 * @param props.route carries the job id to load
 * @returns the job detail element
 */
export function JobDetailScreen({ route }: Props): React.JSX.Element {
  const { jobId } = route.params;
  const [job, setJob] = useState<Job | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    const result = await apiFetch<Job>(`/jobs/${jobId}`);
    setJob(result);
  }, [jobId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const runAction = async (action: 'start' | 'complete'): Promise<void> => {
    setActionError(null);
    setActing(true);
    try {
      const updated = await apiFetch<Job>(`/jobs/${jobId}/${action}`, { method: 'POST' });
      setJob((current) => (current ? { ...current, ...updated } : current));
    } catch (err) {
      setActionError(
        err instanceof ApiError && typeof err.body === 'object' && err.body && 'message' in err.body
          ? String((err.body as { message: unknown }).message)
          : 'Something went wrong. Try again.',
      );
    } finally {
      setActing(false);
    }
  };

  if (!job) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionLabel}>Client</Text>
      <Text style={styles.clientName}>{job.client.name}</Text>
      {job.client.primaryContactName && <Text>{job.client.primaryContactName}</Text>}
      {job.client.phone && <Text>{job.client.phone}</Text>}

      {job.serviceAddress && (
        <>
          <Text style={styles.sectionLabel}>Address</Text>
          <Text>{job.serviceAddress.addressLine1}</Text>
          {job.serviceAddress.addressLine2 && <Text>{job.serviceAddress.addressLine2}</Text>}
          <Text>
            {job.serviceAddress.city}, {job.serviceAddress.state} {job.serviceAddress.postalCode}
          </Text>
        </>
      )}

      {job.jobServices.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Services</Text>
          {job.jobServices.map((line) => (
            <Text key={line.id}>
              {line.service.name} × {line.quantity}
            </Text>
          ))}
        </>
      )}

      {job.notes && (
        <>
          <Text style={styles.sectionLabel}>Notes</Text>
          <Text>{job.notes}</Text>
        </>
      )}

      {actionError && <Text style={styles.error}>{actionError}</Text>}

      {(job.status === 'DRAFT' || job.status === 'SCHEDULED') && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => runAction('start')}
          disabled={acting}
        >
          {acting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Start job</Text>
          )}
        </TouchableOpacity>
      )}

      {job.status === 'IN_PROGRESS' && (
        <TouchableOpacity
          style={[styles.button, styles.completeButton]}
          onPress={() => runAction('complete')}
          disabled={acting}
        >
          {acting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Complete job</Text>
          )}
        </TouchableOpacity>
      )}

      {job.status === 'COMPLETED' && <Text style={styles.doneText}>This job is complete.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    marginTop: 24,
    paddingVertical: 14,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  clientName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  completeButton: {
    backgroundColor: '#16a34a',
  },
  container: {
    padding: 20,
  },
  doneText: {
    color: '#16a34a',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 24,
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
    marginTop: 16,
  },
  sectionLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 20,
    textTransform: 'uppercase',
  },
});
