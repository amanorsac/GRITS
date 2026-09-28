import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { StatusChip } from '@/components/Chip';
import { CrownMark } from '@/components/CrownMark';
import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { Txt } from '@/components/Txt';
import { lessonPlayback } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { valueLabel } from '@/lib/format';
import { commitHaptic } from '@/lib/haptics';
import { markStarted } from '@/lib/learning';
import { must, supabase } from '@/lib/supabase';
import { brand, fonts, radius, useTheme } from '@/lib/theme';
import type { Lesson, LessonProgress, Module } from '@/lib/types';
import { useLoader } from '@/lib/useLoader';

type LessonRow = Lesson & { module: Pick<Module, 'id' | 'month_no' | 'value' | 'title'> | null };

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const t = useTheme();
  const { width } = useWindowDimensions();

  const loader = useCallback(async () => {
    const [lesson, progress] = await Promise.all([
      supabase
        .from('lessons')
        .select(
          'id, module_id, position, kind, title, summary, body, journal_prompt, duration_min, size_mb_480p, unlock_at, module:modules(id, month_no, value, title)',
        )
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('lesson_progress')
        .select('lesson_id, position_seconds, completed_at, updated_at')
        .eq('member_id', me.id)
        .eq('lesson_id', id)
        .maybeSingle(),
    ]);
    return {
      lesson: must(lesson) as unknown as LessonRow | null,
      progress: must(progress) as LessonProgress | null,
    };
  }, [id, me.id]);
  const { data, error, loading, refresh } = useLoader(loader);
  const lesson = data?.lesson;

  // Opening a lesson marks it started.
  useEffect(() => {
    if (lesson && !data?.progress?.completed_at) markStarted(me.id, lesson.id).catch(() => undefined);
  }, [lesson, data?.progress?.completed_at, me.id]);

  // Video
  const saver = me.data_saver;
  const [video, setVideo] = useState<{ state: 'idle' | 'loading' | 'ready' | 'none' | 'error'; url?: string; message?: string }>({
    state: 'idle',
  });
  useEffect(() => {
    if (!lesson || lesson.kind !== 'video') return;
    let cancelled = false;
    lessonPlayback(lesson.id, saver)
      .then((res) => {
        if (cancelled) return;
        setVideo(res.embed_url ? { state: 'ready', url: res.embed_url } : { state: 'none' });
      })
      .catch((e: Error) => {
        if (!cancelled) setVideo({ state: 'error', message: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [lesson, saver]);

  // Journal
  const [entry, setEntry] = useState('');
  const [savingEntry, setSavingEntry] = useState(false);
  const [entryNote, setEntryNote] = useState<string | null>(null);
  async function saveEntry() {
    if (!lesson || !entry.trim()) return;
    setSavingEntry(true);
    setEntryNote(null);
    const { error: err } = await supabase.from('journal_entries').insert({
      member_id: me.id,
      lesson_id: lesson.id,
      prompt: lesson.journal_prompt,
      body: entry.trim(),
    });
    setSavingEntry(false);
    if (err) setEntryNote(`Not saved: ${err.message}`);
    else {
      setEntry('');
      setEntryNote('Saved to your journal. Only you can read it.');
    }
  }

  // Completion
  const [completing, setCompleting] = useState(false);
  const [doneNow, setDoneNow] = useState(false);
  const isDone = doneNow || !!data?.progress?.completed_at;
  async function markDone() {
    if (!lesson) return;
    setCompleting(true);
    const { data: res, error: err } = await supabase.rpc('complete_lesson', { p_lesson: lesson.id });
    setCompleting(false);
    if (err) {
      Alert.alert('That did not save', err.message);
      return;
    }
    setDoneNow(true);
    commitHaptic();
    const r = (res ?? {}) as { done?: number; total?: number; certificate?: string | null };
    if (r.certificate) {
      Alert.alert(
        'Month complete',
        `You finished ${lesson.module?.title ?? 'this month'}. Your badge is earned and your certificate is ready — code ${r.certificate}.`,
        [
          { text: 'See certificates', onPress: () => router.push('/certificates') },
          { text: 'Lovely', style: 'cancel' },
        ],
      );
    } else if (r.total) {
      Alert.alert('Lesson done', `${r.done} of ${r.total} this month.`);
    }
  }

  const eyebrow = lesson
    ? [
        lesson.module ? `Month ${lesson.module.month_no}` : null,
        lesson.module?.value ? valueLabel(lesson.module.value) : lesson.module?.title,
        `Lesson ${lesson.position}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  const videoHeight = Math.round(((width - 32) * 9) / 16);

  return (
    <Screen back eyebrow={eyebrow} title={lesson?.title ?? 'Lesson'}>
      {loading ? <Loading /> : null}
      {error ? <ErrorState message={error} onRetry={refresh} /> : null}
      {data && !lesson ? <EmptyState title="This lesson is not available" body="It may not be open to you yet." /> : null}

      {lesson ? (
        <>
          {lesson.kind === 'video' ? (
            <View style={{ gap: 6 }}>
              <View style={[styles.video, { height: videoHeight }]}>
                {video.state === 'ready' && video.url ? (
                  <WebView
                    source={{ uri: video.url }}
                    style={{ flex: 1, backgroundColor: brand.ink }}
                    allowsInlineMediaPlayback
                    allowsFullscreenVideo
                    mediaPlaybackRequiresUserAction
                    javaScriptEnabled
                    accessibilityLabel={`Video: ${lesson.title}`}
                  />
                ) : (
                  <View style={styles.poster} accessible accessibilityLabel={video.state === 'loading' ? 'Loading video' : 'Video coming soon'}>
                    <CrownMark size={48} />
                    <Txt variant="bodyStrong" color={brand.cream}>
                      {video.state === 'loading' || video.state === 'idle'
                        ? 'Getting your video ready…'
                        : video.state === 'error'
                          ? 'The video could not load'
                          : 'Video coming soon'}
                    </Txt>
                    {video.state === 'error' ? (
                      <Txt variant="meta" color={brand.pinkSoft} center>
                        {video.message}
                      </Txt>
                    ) : null}
                  </View>
                )}
              </View>
              <Txt variant="meta" muted>
                {saver ? '480p · saver' : 'Auto quality'}
              </Txt>
            </View>
          ) : null}

          {isDone ? <StatusChip status="complete" label="Done" /> : null}

          {saver && lesson.kind === 'video' ? (
            <Card tone="tint" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Icon name="signal-cellular-2" color={t.onTint} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="bodyStrong" color={t.onTint}>
                  Data Saver is on
                </Txt>
                <Txt color={t.onTint}>Video at 480p, images load when you tap them.</Txt>
              </View>
            </Card>
          ) : null}

          {lesson.size_mb_480p && lesson.kind === 'video' ? (
            <Txt variant="bodyStrong">This lesson will use {lesson.size_mb_480p} MB</Txt>
          ) : null}

          {lesson.summary ? <Txt>{lesson.summary}</Txt> : null}
          {lesson.body ? <Txt>{lesson.body}</Txt> : null}

          {lesson.kind === 'live' ? (
            <Card tone="tint">
              <Txt color={t.onTint}>This lesson happens live with your Circle. Find the time in Live.</Txt>
              <Button label="Go to Live" compact onPress={() => router.push('/live')} style={{ alignSelf: 'flex-start' }} />
            </Card>
          ) : null}

          {lesson.journal_prompt ? (
            <Card style={{ borderColor: t.gold, borderWidth: 1.5 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Icon name="lock-outline" size={18} color={t.textMuted} />
                <Txt variant="eyebrow" muted>
                  Private · Only you see this
                </Txt>
              </View>
              <Txt variant="heading" style={{ fontFamily: fonts.display }}>
                {lesson.journal_prompt}
              </Txt>
              <Field
                label="Your journal"
                value={entry}
                onChangeText={setEntry}
                multiline
                maxLength={5000}
                placeholder="Write as much or as little as you like."
              />
              {entryNote ? (
                <Txt variant="meta" muted accessibilityLiveRegion="polite">
                  {entryNote}
                </Txt>
              ) : null}
              <Button
                label="Save entry"
                variant="secondary"
                onPress={saveEntry}
                loading={savingEntry}
                disabled={!entry.trim()}
                compact
                style={{ alignSelf: 'flex-start' }}
              />
            </Card>
          ) : null}

          <Button
            label={isDone ? 'Done' : 'Mark as done'}
            icon={isDone ? 'check-circle' : 'check'}
            onPress={markDone}
            loading={completing}
            disabled={isDone}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  video: { borderRadius: radius, overflow: 'hidden', backgroundColor: brand.maroonDeep },
  poster: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
});
