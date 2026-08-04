import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ClientStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<ClientStackParamList, 'ClientHome'>;

/**
 * The CLIENT-role landing screen — shortcuts into the two read-only
 * portal screens, mirroring `apps/web`'s `DashboardPage` client
 * shortcuts. A CLIENT caller holds `jobs.read`/`invoices.read`/
 * `payments.read` (own records only), nothing else, so there's nothing
 * more to shortcut to here.
 * @param props navigation props
 * @param props.navigation used to open the jobs/invoices screens
 * @returns the client home element
 */
export function ClientHomeScreen({ navigation }: Props): React.JSX.Element {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('MyJobs')}>
        <Text style={styles.cardTitle}>My jobs</Text>
        <Text style={styles.cardDescription}>Scheduled and past work at your address.</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('MyInvoices')}>
        <Text style={styles.cardTitle}>My invoices</Text>
        <Text style={styles.cardDescription}>View invoices for your account.</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  cardDescription: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    padding: 20,
  },
});
