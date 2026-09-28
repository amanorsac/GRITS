import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { brand, fonts, radius, TAP, useTheme } from '@/lib/theme';

import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

type Variant =
  | 'primary' // maroon (pink-bright in dark mode)
  | 'secondary' // outlined
  | 'pill' // pink-bright pill — only on maroon surfaces
  | 'onMaroon' // cream outline on maroon
  | 'ghost' // text button
  | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, accessibilityHint, style, compact }: Props) {
  const t = useTheme();
  const off = disabled || loading;

  const look = (() => {
    switch (variant) {
      case 'primary':
        return { bg: t.primary, fg: t.onPrimary, border: t.primary, r: radius };
      case 'secondary':
        return { bg: 'transparent', fg: t.text, border: t.border, r: radius };
      case 'pill':
        return { bg: brand.pinkBright, fg: brand.maroonDeep, border: brand.pinkBright, r: 999 };
      case 'onMaroon':
        return { bg: 'transparent', fg: brand.cream, border: 'rgba(247,242,236,0.6)', r: 999 };
      case 'ghost':
        return { bg: 'transparent', fg: t.accent, border: 'transparent', r: radius };
      case 'danger':
        return { bg: 'transparent', fg: t.status.safety.fg, border: t.status.safety.fg, r: radius };
    }
  })();

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: look.bg,
          borderColor: look.border,
          borderRadius: look.r,
          opacity: off ? 0.55 : pressed ? 0.85 : 1,
          paddingHorizontal: compact ? 16 : 20,
          minHeight: compact ? TAP : 50,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={20} color={look.fg} /> : null}
          <Txt variant="label" color={look.fg} style={{ fontFamily: fonts.bodyBold }}>
            {label}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', minWidth: TAP },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
