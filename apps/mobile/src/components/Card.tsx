import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { brand, radius, useTheme } from '@/lib/theme';

import { PressableScale } from './PressableScale';

type Tone = 'plain' | 'maroon' | 'tint';

type Props = ViewProps & {
  tone?: Tone;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Card({ tone = 'plain', onPress, style, children, accessibilityLabel, ...rest }: Props) {
  const t = useTheme();
  const bg = tone === 'maroon' ? brand.maroon : tone === 'tint' ? t.tint : t.surface;
  const border = tone === 'plain' ? t.border : 'transparent';
  const base: ViewStyle = { backgroundColor: bg, borderColor: border, borderWidth: 1, borderRadius: radius, padding: 18, gap: 10 };

  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[base, style]}
        {...rest}
      >
        {children}
      </PressableScale>
    );
  }
  return (
    <View style={[base, style]} {...rest}>
      {children}
    </View>
  );
}
