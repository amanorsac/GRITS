import { router } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ProgressBar, SegmentedBar, type Segment } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { Txt } from '@/components/Txt';
import { useMe } from '@/lib/auth';
import { loadPosts, loadSpaces, type FeedPost } from '@/lib/community';
import { countWord, firstName, greeting, timeAgo, untilLabel, valueLabel } from '@/lib/format';
import { currentModule, doneCount, fraction, loadCourse, minutesLeft, nextLesson, type LessonSummary } from '@/lib/learning';
import { liveState, loadUpcoming, sessionLabel } from '@/lib/live';
import { supabase } from '@/lib/supabase';
import { brand, useTheme } from '@/lib/theme';
import type { LessonProgress } from '@/lib/types';
import { useLoader } from '@/lib/useLoader';

export default function Home() {
  const me = useMe();
  const t = useTheme();

  const loader = useCallback(async () => {
    const [streakRes, course, live, spaces] = await Promise.all([
      supabase.rpc('member_streak'),
      loadCourse(me.id),
      loadUpcoming(24).catch(() => []),
      loadSpaces().catch(() => []),
    ]);

    // Continue: the most recently touched unfinished lesson, else the next lesson this month.
    const lessons = new Map<string, LessonSummary>();
    for (const m of course.modules) for (const l of m.lessons) lessons.set(l.id, l);
    const inProgress = [...course.progress.values()]
      .filter((p) => !p.completed_at && lessons.has(p.lesson_id))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    const month = currentModule(course);
    const cont: { lesson: LessonSummary; progress?: LessonProgress; resume: boolean } | null = inProgress
      ? { lesson: lessons.get(inProgress.lesson_id)!, progress: inProgress, resume: true }
      : month && nextLesson(month, course.progress)
        ? { lesson: nextLesson(month, course.progress)!, resume: false }
        : null;

    const circleSpace = spaces.find((s) => s.circle_id && s.circle_id === me.circle_id) ?? null;
    let circlePosts: FeedPost[] = [];
    if (circleSpace) {
      circlePosts = (await loadPosts(circleSpace.id, me.id, undefined, 6).catch(() => []))
        .filter((p) => p.status === 'approved')
        .slice(0, 2);
    }

    return {
      streak: typeof streakRes.data === 'number' ? streakRes.data : 0,
      course,
      month,
      cont,
      live: live.find((s) => liveState(s) !== 'ended') ?? null,
      circleSpace,
      circlePosts,
    };
  }, [me.id, me.circle_id]);

  const { data, error, loading, refreshing, refresh } = useLoader(loader, { refetchOnFocus: true });

  const name = firstName(me.display_name || me.full_name);
  const sub = [`Crown Level ${me.crown_level}`, data && data.streak > 0 ? `${data.streak} day streak` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen title={name ? `${greeting()}, ${name}` : greeting()} subtitle={sub} refreshing={refreshing} onRefresh={refresh}>
      {loading ? <Loading /> : null}
      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {data?.cont ? (
        <Card tone="maroon">
          <Txt variant="eyebrow" color={brand.pinkSoft}>
            {data.cont.resume ? 'Continue' : 'Up next'}
          </Txt>
          <Txt variant="heading" color={brand.cream}>
            {data.cont.lesson.title}
          </Txt>
          <Txt variant="meta" color={brand.pinkSoft}>
            {[
              minutesLeft(data.cont.lesson, data.cont.progress) != null
                ? `${minutesLeft(data.cont.lesson, data.cont.progress)} min ${data.cont.resume ? 'left' : ''}`.trim()
                : null,
              data.cont.lesson.size_mb_480p ? `about ${data.cont.lesson.size_mb_480p} MB at 480p` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Txt>
          {data.cont.resume ? (
            <ProgressBar
              value={fraction(data.cont.lesson, data.cont.progress)}
              color={brand.pinkBright}
              track="rgba(247,242,236,0.25)"
              label="Lesson progress"
            />
          ) : null}
          <Button
            variant="pill"
            label={data.cont.resume ? 'Resume lesson' : 'Start lesson'}
            onPress={() => router.push(`/lesson/${data.cont!.lesson.id}`)}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
            compact
          />
        </Card>
      ) : null}

      {data?.live ? (
        <Card tone="tint">
          <Txt variant="eyebrow" color={t.onTint}>
            {liveState(data.live) === 'live' ? 'Live now' : `Live ${untilLabel(data.live.starts_at)}`}
          </Txt>
          <Txt variant="heading" color={t.onTint}>
            {sessionLabel(data.live)}
          </Txt>
          <Button label="Join" compact onPress={() => router.push(`/session/${data.live!.id}`)} style={{ alignSelf: 'flex-start' }} />
        </Card>
      ) : null}

      {data?.month ? <MonthCard month={data.month} progress={data.course.progress} /> : null}

      {data && !data.month && !error ? (
        <EmptyState
          icon="book-open-page-variant-outline"
          title="Your lessons are on their way"
          body="Once your membership is active, your first month of lessons appears here."
        />
      ) : null}

      {data?.circleSpace ? (
        <Card onPress={() => router.push('/court')} accessibilityLabel={`New in ${data.circleSpace.name}. Open the Court.`}>
          <Txt variant="heading">New in {data.circleSpace.name}</Txt>
          {data.circlePosts.length === 0 ? (
            <Txt muted>Nothing new yet. Your Circle is a good place to share a win.</Txt>
          ) : (
            data.circlePosts.map((p) => (
              <View key={p.id} style={{ flexDirection: 'row', gap: 12, paddingTop: 4 }}>
                <Avatar name={p.author?.display_name || 'A member'} id={p.author_id} size={36} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">
                    {p.author?.display_name || 'A member'}{' '}
                    <Txt variant="meta" muted>
                      {timeAgo(p.created_at)}
                    </Txt>
                  </Txt>
                  <Txt numberOfLines={3}>{p.body}</Txt>
                </View>
              </View>
            ))
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

function MonthCard({
  month,
  progress,
}: {
  month: NonNullable<ReturnType<typeof currentModule>>;
  progress: Map<string, LessonProgress>;
}) {
  const done = doneCount(month, progress);
  const total = month.lessons.length;
  const next = nextLesson(month, progress);
  const segments: Segment[] = month.lessons.map((l) =>
    progress.get(l.id)?.completed_at ? 'done' : l.id === next?.id ? 'current' : 'rest',
  );
  const value = valueLabel(month.value) || month.title;
  const left = total - done;
  return (
    <Card onPress={() => router.push(`/module/${month.id}`)} accessibilityLabel={`This month, ${value}, ${done} of ${total} lessons done`}>
      <Txt variant="heading">
        This month — {value} {done}/{total}
      </Txt>
      <SegmentedBar segments={segments} label={`${done} of ${total} lessons done`} />
      <Txt muted>
        {left === 0
          ? `Month complete. Your ${value} badge is yours.`
          : `${countWord(left)} ${left === 1 ? 'lesson' : 'lessons'} to go and your ${value} badge unlocks.`}
      </Txt>
    </Card>
  );
}
