import { Pressable, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { brand, radius, useTheme } from '@/lib/theme';

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
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[base, style]} {...rest}>
      {children}
    </View>
  );
}
