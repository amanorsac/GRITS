import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand } from '@/lib/theme';

import { Button } from './Button';

import { CrownMark } from './CrownMark';
import { Txt } from './Txt';

/** Shown instead of the app when the build is missing its Supabase settings. Never crashes. */
export function NotConfigured({ onReady, onRetry }: { onReady?: () => void; onRetry?: () => void }) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: brand.maroon,
        paddingTop: insets.top + 48,
        paddingHorizontal: 28,
        gap: 18,
        alignItems: 'center',
      }}
    >
      <CrownMark size={88} />
      <Txt variant="title" color={brand.cream} center accessibilityRole="header">
        Almost ready
      </Txt>
      <Txt color={brand.pinkSoft} center>
        We could not reach the Academy just now. Check your connection and try again.
      </Txt>
      <Txt variant="meta" color={brand.pinkSoft} center>
        For the team: set SUPABASE_ANON_KEY on the grits Worker (see docs/LAUNCH.md).
      </Txt>
      {onRetry && <Button label="Try again" variant="pill" onPress={onRetry} />}
    </View>
  );
}
