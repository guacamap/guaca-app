import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

/**
 * §4.6 — thin wrapper around the mobile web app. All product features live
 * in apps/web; this shell only delivers them to the Play testing track.
 * Preview builds point at staging, production at app.guaca.live (eas.json).
 */
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://app.guaca.live';

function isGuacaUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === 'guaca.live' ||
      host.endsWith('.guaca.live') ||
      host === 'localhost' ||
      host === '10.0.2.2' // Android emulator → host machine
    );
  } catch {
    return false;
  }
}

export default function App() {
  const webRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
  const [failed, setFailed] = useState(false);

  // Android hardware back navigates webview history before exiting the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBackRef.current) {
        webRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  // Keep the app inside guaca.live; everything else opens the system browser.
  const onShouldStartLoadWithRequest = useCallback((request: ShouldStartLoadRequest) => {
    if (request.isTopFrame === false) return true;
    if (isGuacaUrl(request.url) || request.url === 'about:blank') return true;
    Linking.openURL(request.url).catch(() => {});
    return false;
  }, []);

  if (failed) {
    return (
      <View style={styles.fallback}>
        <StatusBar style="light" />
        <Text style={styles.wordmark}>guaca</Text>
        <Text style={styles.offlineTitle}>Sin conexión · Offline</Text>
        <Text style={styles.offlineBody}>
          El Caribe en tiempo real te espera — revisa tu conexión.
        </Text>
        <Pressable
          style={styles.retryButton}
          onPress={() => {
            setFailed(false);
            webRef.current?.reload();
          }}
        >
          <Text style={styles.retryText}>Reintentar · Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <WebView
        ref={webRef}
        source={{ uri: WEB_URL }}
        style={styles.webview}
        applicationNameForUserAgent="GuacaApp/0.1"
        onNavigationStateChange={(nav) => {
          canGoBackRef.current = nav.canGoBack;
        }}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onError={() => setFailed(true)}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 500) setFailed(true);
        }}
        // iOS-only: auto-grant camera to same-host pages. On Android the
        // native WebView prompts for camera itself when the spotter capture
        // form opens; geolocation is gated by the prop below on both.
        mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
        geolocationEnabled
        allowsBackForwardNavigationGestures
        domStorageEnabled
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, styles.fallback]}>
            <Text style={styles.wordmark}>guaca</Text>
            <ActivityIndicator color="#FFFFFF" style={styles.spinner} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D8B8B',
  },
  webview: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    backgroundColor: '#0D8B8B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  wordmark: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -2,
  },
  spinner: {
    marginTop: 24,
  },
  offlineTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 24,
  },
  offlineBody: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  retryText: {
    color: '#0A1F24',
    fontWeight: '900',
  },
});
