import { router } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/Card';
import { StatusChip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { Txt } from '@/components/Txt';
import { useMe } from '@/lib/auth';
import { unlockLabel, valueLabel } from '@/lib/format';
import { doneCount, loadCourse, moduleLocked } from '@/lib/learning';
import { useTheme } from '@/lib/theme';
import { useLoader } from '@/lib/useLoader';

export default function Learn() {
  const me = useMe();
  const t = useTheme();
  const loader = useCallback(() => loadCourse(me.id), [me.id]);
  const { data, error, loading, refreshing, refresh } = useLoader(loader, { refetchOnFocus: true });

  return (
    <Screen title="Learn" subtitle="The Inner Court — twelve months, five values." refreshing={refreshing} onRefresh={refresh}>
      {loading ? <Loading /> : null}
      {error ? <ErrorState message={error} onRetry={refresh} /> : null}
      {data && data.modules.length === 0 ? (
        <EmptyState
          icon="book-open-page-variant-outline"
          title="No lessons yet"
          body="Your lessons appear here once your membership is active."
        />
      ) : null}
      {data?.modules.map((m) => {
        const locked = moduleLocked(m);
        const done = doneCount(m, data.progress);
        const total = m.lessons.length;
        const complete = total > 0 && done === total;
        const value = valueLabel(m.value);
        return (
          <Card
            key={m.id}
            onPress={locked ? undefined : () => router.push(`/module/${m.id}`)}
            accessibilityLabel={`Month ${m.month_no}, ${m.title}. ${locked ? 'Locked' : `${done} of ${total} done`}`}
            style={locked ? { opacity: 0.85 } : undefined}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="eyebrow" muted>
                  Month {m.month_no}
                  {value && value !== m.title ? ` · ${value}` : ''}
                </Txt>
                <Txt variant="heading">{m.title}</Txt>
              </View>
              {complete ? (
                <Icon name="crown" size={26} color={t.gold} />
              ) : !locked ? (
                <Icon name="chevron-right" size={26} color={t.textMuted} />
              ) : null}
            </View>
            {m.summary ? <Txt muted>{m.summary}</Txt> : null}
            {locked ? (
              <StatusChip status="locked" label={m.unlock_at ? unlockLabel(m.unlock_at) : 'Locked'} />
            ) : (
              <View style={{ gap: 8 }}>
                <ProgressBar
                  value={total ? done / total : 0}
                  color={complete ? t.status.complete.bar : t.status.progress.bar}
                  label={`${done} of ${total} lessons done`}
                />
                <Txt variant="meta" muted>
                  {done}/{total} done
                </Txt>
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
