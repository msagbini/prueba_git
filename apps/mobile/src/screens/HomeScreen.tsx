import { StyleSheet, Text, View } from 'react-native';

/**
 * Placeholder landing screen after login — real screens (jobs, scheduling,
 * clients, staff) land in Fase 6 (mobile app phase) per the roadmap.
 * @returns the home placeholder element
 */
export function HomeScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>DOS</Text>
      <Text style={styles.subtitle}>
        This is a Fase 2 navigation scaffold — real field-staff screens land in Fase 6.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  subtitle: {
    color: '#4b5563',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
});
