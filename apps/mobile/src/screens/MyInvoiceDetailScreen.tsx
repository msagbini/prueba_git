import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '../api/client';
import type { ClientStackParamList } from '../navigation/RootNavigator';
import type { InvoiceWithLineItems, Paginated, Payment } from '../types/api';

type Props = NativeStackScreenProps<ClientStackParamList, 'MyInvoiceDetail'>;

/**
 * One invoice's line items and payments, read-only — the CLIENT-role
 * counterpart of `apps/web`'s `MyInvoicesPage` "View" modal, as a full
 * screen rather than a modal (more natural on mobile). `GET /payments`
 * has no per-invoice filter, so this fetches a page and filters
 * client-side, same as the web page does.
 * @param props navigation props
 * @param props.route carries the invoice id to load
 * @returns the invoice detail element
 */
export function MyInvoiceDetailScreen({ route }: Props): React.JSX.Element {
  const { invoiceId } = route.params;
  const [invoice, setInvoice] = useState<InvoiceWithLineItems | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  const load = useCallback(async () => {
    const [invoiceResult, paymentsResult] = await Promise.all([
      apiFetch<InvoiceWithLineItems>(`/invoices/${invoiceId}`),
      apiFetch<Paginated<Payment>>('/payments?pageSize=100'),
    ]);
    setInvoice(invoiceResult);
    setPayments(paymentsResult.items.filter((p) => p.invoiceId === invoiceId));
  }, [invoiceId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!invoice) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.summary}>
        Subtotal ${invoice.subtotal} · Tax ${invoice.taxAmount}
      </Text>
      <Text style={styles.total}>Total ${invoice.total}</Text>

      <Text style={styles.sectionLabel}>Line items</Text>
      {invoice.lineItems.length === 0 && <Text style={styles.emptyText}>No line items yet.</Text>}
      {invoice.lineItems.map((li) => (
        <View key={li.id} style={styles.lineRow}>
          <Text style={styles.lineDescription}>
            {li.description} × {li.quantity}
          </Text>
          <Text>${li.lineTotal}</Text>
        </View>
      ))}

      <Text style={styles.sectionLabel}>Payments</Text>
      {payments.length === 0 && <Text style={styles.emptyText}>No payments recorded yet.</Text>}
      {payments.map((p) => (
        <View key={p.id} style={styles.lineRow}>
          <Text style={styles.lineDescription}>
            {p.method}
            {p.referenceNumber ? ` (${p.referenceNumber})` : ''}
          </Text>
          <Text>${p.amount}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    padding: 20,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
  },
  lineDescription: {
    flex: 1,
    marginRight: 12,
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sectionLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 24,
    textTransform: 'uppercase',
  },
  summary: {
    color: '#6b7280',
    fontSize: 14,
  },
  total: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
});
