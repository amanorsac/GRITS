import { router } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/Card';
import { StatusChip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { Txt } from '@/components/Txt';
import { dayAndTime, untilLabel } from '@/lib/format';
import { liveState, loadUpcoming, sessionLabel } from '@/lib/live';
import { useTheme } from '@/lib/theme';
import { useLoader } from '@/lib/useLoader';

export default function Live() {
  const t = useTheme();
  const loader = useCallback(() => loadUpcoming(), []);
  const { data, error, loading, refreshing, refresh } = useLoader(loader, { refetchOnFocus: true });

  return (
    <Screen title="Live" subtitle="Mentor hours, Circle sessions and broadcasts." refreshing={refreshing} onRefresh={refresh}>
      {loading ? <Loading /> : null}
      {error ? <ErrorState message={error} onRetry={refresh} /> : null}
      {data && data.length === 0 ? (
        <EmptyState icon="calendar-blank-outline" title="Nothing scheduled yet" body="New live sessions show up here as soon as they are planned." />
      ) : null}
      {data?.map((s) => {
        const state = liveState(s);
        const live = state === 'live';
        return (
          <Card
            key={s.id}
            tone={live || state === 'soon' ? 'tint' : 'plain'}
            onPress={() => router.push(`/session/${s.id}`)}
            accessibilityLabel={`${sessionLabel(s)}. ${live ? 'Live now' : dayAndTime(s.starts_at)}`}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt variant="eyebrow" color={live || state === 'soon' ? t.onTint : t.textMuted}>
                  {live ? 'Live now' : state === 'soon' ? `Starting ${untilLabel(s.starts_at)}` : dayAndTime(s.starts_at)}
                </Txt>
                <Txt variant="heading" color={live || state === 'soon' ? t.onTint : t.text}>
                  {sessionLabel(s)}
                </Txt>
                {s.host_name ? (
                  <Txt variant="meta" color={live || state === 'soon' ? t.onTint : t.textMuted}>
                    With {s.host_name}
                  </Txt>
                ) : null}
              </View>
              <Icon name="chevron-right" size={26} color={t.textMuted} />
            </View>
            {live ? <StatusChip status="progress" label="Live" /> : null}
            {s.kind === 'broadcast' ? <StatusChip status="open" label="Broadcast" /> : null}
          </Card>
        );
      })}
    </Screen>
  );
}
