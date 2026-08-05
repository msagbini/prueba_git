import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import type { MembershipSummary } from '../types/api';

/**
 * Shown after a login whose account belongs to more than one
 * organization — picks which one to open a session for. See
 * docs/architecture/auth.md's multi-organization login flow.
 * @returns the organization list element
 */
export function SelectOrganizationScreen(): React.JSX.Element {
  const { pendingSelection, selectOrganization } = useAuth();
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (organizationId: string): Promise<void> => {
    setError(null);
    setSelectingId(organizationId);
    try {
      await selectOrganization(organizationId);
    } catch {
      setError('Could not open that organization. Try again.');
      setSelectingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose an organization</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={pendingSelection?.memberships ?? []}
        keyExtractor={(item) => item.organizationId}
        renderItem={({ item }: { item: MembershipSummary }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => handleSelect(item.organizationId)}
            disabled={selectingId !== null}
          >
            <View>
              <Text style={styles.orgName}>{item.organizationName}</Text>
              <Text style={styles.orgRole}>{item.role}</Text>
            </View>
            {selectingId === item.organizationId && <ActivityIndicator />}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
    marginBottom: 12,
  },
  orgName: {
    fontSize: 16,
    fontWeight: '600',
  },
  orgRole: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 2,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
});
