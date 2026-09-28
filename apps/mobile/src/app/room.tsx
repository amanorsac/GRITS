import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { brand, TAP } from '@/lib/theme';

/** Full-screen live room: a Jitsi (JaaS) meeting or a YouTube broadcast in a WebView. */
export default function Room() {
  const { url, title } = useLocalSearchParams<{ url: string; title?: string; provider?: string }>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const safeUrl = typeof url === 'string' && url.startsWith('https://') ? url : null;

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Leave the room"
          style={styles.close}
        >
          <Icon name="close" size={26} color={brand.cream} />
        </Pressable>
        <Txt variant="label" color={brand.cream} numberOfLines={1} style={{ flex: 1 }}>
          {title ?? 'Live'}
        </Txt>
      </View>
      {safeUrl && !failed ? (
        <WebView
          source={{ uri: safeUrl }}
          style={{ flex: 1, backgroundColor: brand.ink }}
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          javaScriptEnabled
          domStorageEnabled
          onLoadEnd={() => setLoading(false)}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.center}>
          <Txt color={brand.cream} center>
            The room could not open. Check your connection and try joining again.
          </Txt>
        </View>
      )}
      {loading && safeUrl && !failed ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={brand.pinkBright} size="large" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: brand.maroonDeep },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, minHeight: 52 },
  close: { width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loading: { ...StyleSheet.absoluteFill, top: 100, alignItems: 'center', justifyContent: 'center' },
});
