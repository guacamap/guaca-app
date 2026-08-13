import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

type Role = 'tourist' | 'spotter';

/**
 * Minimal shell for the first Play builds — the closed-testing clock runs
 * on the track, not the features. Real screens replace this via updates.
 */
export default function App() {
  const [role, setRole] = useState<Role | null>(null);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.wordmark}>guaca</Text>
      <Text style={styles.tagline}>El Caribe, en tiempo real.</Text>

      {role === null ? (
        <View style={styles.chooser}>
          <Pressable style={styles.roleButton} onPress={() => setRole('tourist')}>
            <Text style={styles.roleTitle}>Turista · Tourist</Text>
            <Text style={styles.roleBody}>Plan with verified local places</Text>
          </Pressable>
          <Pressable style={styles.roleButton} onPress={() => setRole('spotter')}>
            <Text style={styles.roleTitle}>Spotter</Text>
            <Text style={styles.roleBody}>Verify places, get paid</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.chooser}>
          <Text style={styles.comingSoon}>
            {role === 'tourist' ? 'Tourist experience' : 'Spotter missions'} — muy pronto
          </Text>
          <Pressable style={styles.backLink} onPress={() => setRole(null)}>
            <Text style={styles.backText}>← back</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D8B8B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  wordmark: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -2,
  },
  tagline: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 48,
  },
  chooser: {
    alignSelf: 'stretch',
    gap: 14,
  },
  roleButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
  },
  roleTitle: {
    color: '#0A1F24',
    fontSize: 18,
    fontWeight: '900',
  },
  roleBody: {
    color: 'rgba(10,31,36,0.6)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  comingSoon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  backLink: {
    alignSelf: 'center',
    padding: 12,
  },
  backText: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
  },
});
