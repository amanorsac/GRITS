import { Text, type TextProps, type TextStyle } from 'react-native';

import { fonts, useTheme } from '@/lib/theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'label' | 'eyebrow' | 'meta' | 'number';

const VARIANTS: Record<Variant, TextStyle> = {
  // Large Fraunces titles tighten their tracking, as large type does on iOS.
  display: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26 },
  number: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 32 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  label: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 20, letterSpacing: 0 },
  // Short uppercase labels and metadata — never used for running text.
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18, letterSpacing: 1.1, textTransform: 'uppercase' },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20 },
};

export type TxtProps = TextProps & {
  variant?: Variant;
  color?: string;
  muted?: boolean;
  center?: boolean;
};

export function Txt({ variant = 'body', color, muted, center, style, ...rest }: TxtProps) {
  const t = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        VARIANTS[variant],
        { color: color ?? (muted ? t.textMuted : t.text) },
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}
