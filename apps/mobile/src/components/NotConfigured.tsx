import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand } from '@/lib/theme';

import { CrownMark } from './CrownMark';
import { Txt } from './Txt';

/** Shown instead of the app when the build is missing its Supabase settings. Never crashes. */
export function NotConfigured({ onReady }: { onReady?: () => void }) {
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
        This copy of Grit & Grace has not been connected to the Academy yet, so there is nothing to show. Please try
        again after the next update.
      </Txt>
      <Txt variant="meta" color={brand.pinkSoft} center>
        For the team: set EXPO_PUBLIC_SUPABASE_ANON_KEY (see apps/mobile/README.md).
      </Txt>
    </View>
  );
}
