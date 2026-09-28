import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/lib/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

/** A settings-style list row. */
export function Row({
  icon,
  title,
  detail,
  onPress,
  right,
  last,
  accessibilityHint,
}: {
  icon?: IconName;
  title: string;
  detail?: string;
  onPress?: () => void;
  right?: ReactNode;
  last?: boolean;
  accessibilityHint?: string;
}) {
  const t = useTheme();
  const content = (
    <>
      {icon ? <Icon name={icon} color={t.accent} /> : null}
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong">{title}</Txt>
        {detail ? (
          <Txt variant="meta" muted>
            {detail}
          </Txt>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" color={t.textMuted} /> : null)}
    </>
  );
  const style = [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }];
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      accessibilityHint={accessibilityHint}
      style={style}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingVertical: 10 },
});
