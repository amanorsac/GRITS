import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/Card';
import { StatusChip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { Txt } from '@/components/Txt';
import { useMe } from '@/lib/auth';
import { valueLabel } from '@/lib/format';
import { KIND_LABEL, lessonState, loadCourse } from '@/lib/learning';
import { useLoader } from '@/lib/useLoader';

export default function ModuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const loader = useCallback(async () => {
    const course = await loadCourse(me.id);
    return { module: course.modules.find((m) => m.id === id) ?? null, progress: course.progress };
  }, [id, me.id]);
  const { data, error, loading, refreshing, refresh } = useLoader(loader, { refetchOnFocus: true });
  const m = data?.module;

  return (
    <Screen
      back
      eyebrow={m ? `Month ${m.month_no}${m.value ? ` · ${valueLabel(m.value)}` : ''}` : undefined}
      title={m?.title ?? 'Month'}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {loading ? <Loading /> : null}
      {error ? <ErrorState message={error} onRetry={refresh} /> : null}
      {data && !m ? <EmptyState title="This month is not available" body="It may not be open to you yet." /> : null}
      {m?.summary ? <Txt muted>{m.summary}</Txt> : null}
      {m?.lessons.map((l) => {
        const s = lessonState(l, m, data!.progress);
        const meta = [KIND_LABEL[l.kind], l.duration_min ? `${l.duration_min} min` : null, l.size_mb_480p ? `${l.size_mb_480p} MB` : null]
          .filter(Boolean)
          .join(' · ');
        return (
          <Card
            key={l.id}
            onPress={s.open ? () => router.push(`/lesson/${l.id}`) : undefined}
            accessibilityLabel={`Lesson ${l.position}, ${l.title}. ${s.label}`}
          >
            <View style={{ gap: 4 }}>
              <Txt variant="eyebrow" muted>
                Lesson {l.position}
              </Txt>
              <Txt variant="bodyStrong">{l.title}</Txt>
              <Txt variant="meta" muted>
                {meta}
              </Txt>
            </View>
            <StatusChip status={s.status} label={s.label} />
          </Card>
        );
      })}
    </Screen>
  );
}
