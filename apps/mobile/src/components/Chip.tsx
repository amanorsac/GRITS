import { StyleSheet, View } from 'react-native';

import { fonts, radius, TAP, useTheme, type StatusKind } from '@/lib/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

/** Selectable filter chip (spaces, post kinds). */
export function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? t.primary : t.surface,
          borderColor: selected ? t.primary : t.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {selected ? <Icon name="check" size={16} color={t.onPrimary} /> : null}
      <Txt variant="meta" color={selected ? t.onPrimary : t.text} style={{ fontFamily: fonts.bodySemi, fontSize: 15 }}>
        {label}
      </Txt>
    </PressableScale>
  );
}

const STATUS_ICON: Record<StatusKind | 'open', IconName> = {
  complete: 'check-circle',
  progress: 'progress-clock',
  attention: 'alert-circle-outline',
  safety: 'shield-alert-outline',
  locked: 'lock-outline',
  open: 'circle-outline',
};

/** Status is always icon + label, never colour alone. */
export function StatusChip({ status, label }: { status: StatusKind | 'open'; label: string }) {
  const t = useTheme();
  const c = status === 'open' ? { bg: 'transparent', fg: t.textMuted } : t.status[status];
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.status, { backgroundColor: c.bg, borderColor: status === 'open' ? t.border : 'transparent' }]}
    >
      <Icon name={STATUS_ICON[status]} size={15} color={c.fg} />
      <Txt variant="meta" color={c.fg} style={{ fontFamily: fonts.bodySemi }}>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: TAP,
    paddingHorizontal: 16,
    borderRadius: radius,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
