import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CrownMark } from '@/components/CrownMark';
import { Txt } from '@/components/Txt';
import { brand } from '@/lib/theme';

export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.hero}>
        <CrownMark size={104} />
        <Txt variant="meta" color={brand.pinkSoft} center style={styles.scripture}>
          “You are a chosen generation, a royal priesthood…” — 1 Peter 2:9
        </Txt>
        <Txt variant="eyebrow" color={brand.gold}>
          Grit & Grace Girls Academy
        </Txt>
        <Txt variant="heading" color={brand.cream} center>
          Welcome home. You are royalty.
        </Txt>
        <Txt variant="display" color={brand.cream} center accessibilityRole="header">
          We don&apos;t just raise girls.{'\n'}We raise Queens.
        </Txt>
        <Txt variant="eyebrow" color={brand.gold} center accessibilityLabel="Rise, reign, radiate">
          Rise • Reign • Radiate
        </Txt>
      </View>
      <View style={styles.actions}>
        <Button label="Sign in" variant="pill" onPress={() => router.push('/sign-in')} />
        <Button label="I have a join code" variant="onMaroon" onPress={() => router.push('/join')} />
        <Txt variant="meta" color={brand.pinkSoft} center style={{ marginTop: 8 }}>
          Your parent or guardian sets up your membership.
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: brand.maroon, paddingHorizontal: 28, justifyContent: 'space-between' },
  hero: { alignItems: 'center', gap: 16, marginTop: 8 },
  scripture: { fontStyle: 'italic', maxWidth: 300, marginTop: -4 },
  actions: { gap: 12 },
});
