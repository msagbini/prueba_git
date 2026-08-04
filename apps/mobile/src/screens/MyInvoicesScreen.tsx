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
import type { ClientStackParamList } from '../navigation/RootNavigator';
import type { Invoice, Paginated } from '../types/api';

type Props = NativeStackScreenProps<ClientStackParamList, 'MyInvoices'>;

const STATUS_LABELS: Record<Invoice['status'], string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  VOID: 'Void',
};

/**
 * The CLIENT-role caller's own invoices, read-only — `GET /invoices`
 * already scopes to the caller's own records server-side
 * (`InvoicesService`'s Client visibility filter). No PDF download here
 * (unlike `apps/web`'s `MyInvoicesPage`) — that needs a file-saving
 * library this bare RN app doesn't have wired up, and there's no
 * device/simulator available in this environment to verify one; left
 * as a documented gap rather than added and unverified.
 * @param props navigation props
 * @param props.navigation used to open an invoice's detail screen
 * @returns the invoices list element
 */
export function MyInvoicesScreen({ navigation }: Props): React.JSX.Element {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const result = await apiFetch<Paginated<Invoice>>('/invoices?pageSize=100');
    setInvoices(result.items);
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

  if (invoices === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (invoices.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No invoices yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={invoices}
      keyExtractor={(invoice) => invoice.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate('MyInvoiceDetail', { invoiceId: item.id })}
        >
          <View style={styles.rowText}>
            <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
            <Text style={styles.due}>Due {new Date(item.dueDate).toLocaleDateString()}</Text>
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.total}>
              ${item.total} {item.currency}
            </Text>
            <Text style={[styles.status, statusStyle(item.status)]}>
              {STATUS_LABELS[item.status]}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

/**
 * Picks a status pill's color.
 * @param status the invoice's status
 * @returns a style object to merge into the status text
 */
function statusStyle(status: Invoice['status']): { color: string } {
  switch (status) {
    case 'PAID':
      return { color: '#16a34a' };
    case 'OVERDUE':
      return { color: '#dc2626' };
    case 'SENT':
      return { color: '#2563eb' };
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
  due: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 2,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '600',
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
  rowRight: {
    alignItems: 'flex-end',
  },
  rowText: {
    flex: 1,
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  total: {
    fontSize: 14,
    fontWeight: '600',
  },
});
