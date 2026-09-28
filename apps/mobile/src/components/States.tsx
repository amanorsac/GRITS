import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/lib/theme';

import { Button } from './Button';
import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

export function Loading({ label = 'Loading' }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center', gap: 12 }} accessible accessibilityLabel={label}>
      <ActivityIndicator color={t.accent} size="large" />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <Card style={{ alignItems: 'flex-start' }} accessibilityRole="alert">
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Icon name="alert-circle-outline" color={t.status.attention.fg} />
        <Txt variant="bodyStrong">That did not load</Txt>
      </View>
      <Txt muted>{message}</Txt>
      {onRetry ? <Button label="Try again" variant="secondary" compact onPress={onRetry} /> : null}
    </Card>
  );
}

export function EmptyState({ icon = 'crown-outline', title, body }: { icon?: IconName; title: string; body?: string }) {
  const t = useTheme();
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
      <Icon name={icon} size={34} color={t.gold} />
      <Txt variant="heading" center>
        {title}
      </Txt>
      {body ? (
        <Txt muted center>
          {body}
        </Txt>
      ) : null}
    </Card>
  );
}
