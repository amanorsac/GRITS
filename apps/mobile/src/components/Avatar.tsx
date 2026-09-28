import { View } from 'react-native';

import { brand, fonts } from '@/lib/theme';

import { Txt } from './Txt';

const TONES = [
  { bg: brand.maroon, fg: brand.cream },
  { bg: brand.pinkSoft, fg: brand.maroonDeep },
  { bg: brand.gold, fg: brand.ink },
  { bg: brand.maroonDeep, fg: brand.pinkSoft },
];

export function Avatar({ name, id, size = 40 }: { name: string; id?: string; size?: number }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('') || '?';
  const seed = [...(id ?? name)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const tone = TONES[seed % TONES.length];
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tone.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt variant="label" color={tone.fg} style={{ fontFamily: fonts.displayBold, fontSize: size * 0.4 }}>
        {initials}
      </Txt>
    </View>
  );
}
