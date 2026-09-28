import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Bubble, Composer } from '@/components/Messenger';
import { PressableScale } from '@/components/PressableScale';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { Txt } from '@/components/Txt';
import { useMe } from '@/lib/auth';
import { clockTime, dayLabel, sameDay } from '@/lib/format';
import { commitHaptic } from '@/lib/haptics';
import {
  DM_OFF_COPY,
  loadConversation,
  MENTOR_SAFETY_NOTE,
  MESSAGE_MAX,
  mergeMessage,
  SAFETY_NOTE,
  sendMessage,
  subscribeToThread,
} from '@/lib/messages';
import { brand, TAP, useTheme } from '@/lib/theme';
import type { DmMessage } from '@/lib/types';
import { useLoader } from '@/lib/useLoader';

type Item =
  | { type: 'day'; key: string; label: string }
  | { type: 'msg'; key: string; msg: DmMessage; mine: boolean; first: boolean; last: boolean };

/** Consecutive messages from one person within five minutes form a group. */
const GROUP_MS = 5 * 60_000;

function toItems(messages: DmMessage[], myId: string): Item[] {
  const items: Item[] = [];
  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const d = new Date(m.created_at);
    const newDay = !prev || !sameDay(new Date(prev.created_at), d);
    if (newDay) items.push({ type: 'day', key: `day-${m.created_at.slice(0, 10)}-${m.id}`, label: dayLabel(m.created_at) });
    const joinsPrev = !newDay && prev.sender_id === m.sender_id && d.getTime() - new Date(prev.created_at).getTime() < GROUP_MS;
    const joinsNext =
      !!next &&
      next.sender_id === m.sender_id &&
      sameDay(new Date(next.created_at), d) &&
      new Date(next.created_at).getTime() - d.getTime() < GROUP_MS;
    items.push({ type: 'msg', key: m.id, msg: m, mine: m.sender_id === myId, first: !joinsPrev, last: !joinsNext });
  });
  return items;
}

export default function Chat() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const me = useMe();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const list = useRef<FlatList<Item>>(null);

  const loader = useCallback(() => loadConversation(threadId, me), [threadId, me]);
  const { data, error, loading, refreshing, refresh, setData } = useLoader(loader);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Live: append new messages as they arrive. Pull-to-refresh is the fallback.
  useEffect(() => {
    if (!threadId) return;
    return subscribeToThread(threadId, (m) =>
      setData((c) => (c ? { ...c, messages: mergeMessage(c.messages, m) } : c)),
    );
  }, [threadId, setData]);

  const items = useMemo(() => (data ? toItems(data.messages, me.id) : []), [data, me.id]);

  async function send() {
    const body = draft.trim();
    if (!body || !data || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const m = await sendMessage(data.thread.id, me.id, body);
      setDraft('');
      commitHaptic();
      setData((c) => (c ? { ...c, messages: mergeMessage(c.messages, m) } : c));
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Your message did not send.');
    } finally {
      setSending(false);
    }
  }

  const name = data?.other?.display_name || (data?.iAmMember ? 'Your mentor' : 'A member');
  const status = data
    ? data.iAmMember
      ? ['Your Circle mentor', data.circleName].filter(Boolean).join(' · ')
      : data.circleName
        ? `In ${data.circleName}`
        : 'In your Circle'
    : '';

  const header = (
    <View style={[styles.header, { backgroundColor: t.header, paddingTop: insets.top + 6 }]}>
      <PressableScale
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/messages'))}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        style={styles.back}
      >
        <Icon name="chevron-left" size={30} color={brand.cream} />
      </PressableScale>
      {data ? <Avatar name={name} id={data.other?.id ?? name} size={40} /> : null}
      <View style={{ flex: 1 }}>
        <Txt variant="heading" color={t.headerText} numberOfLines={1} accessibilityRole="header">
          {data ? name : 'Messages'}
        </Txt>
        {status ? (
          <Txt variant="meta" color={t.headerMuted} numberOfLines={1}>
            {status}
          </Txt>
        ) : null}
      </View>
    </View>
  );

  const note = (
    <View style={[styles.note, { backgroundColor: t.tint }]} accessible accessibilityRole="text">
      <Icon name="shield-lock-outline" size={18} color={t.onTint} />
      <Txt variant="meta" color={t.onTint} style={{ flex: 1 }}>
        {data && !data.iAmMember ? MENTOR_SAFETY_NOTE : SAFETY_NOTE}
      </Txt>
    </View>
  );

  if (loading || error || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        {header}
        <View style={{ padding: 16, gap: 14 }}>
          {loading ? <Loading label="Loading messages" /> : null}
          {error ? <ErrorState message={error} onRetry={refresh} /> : null}
          {!loading && !error && !data ? (
            <EmptyState icon="message-outline" title="This conversation is not available" body="It may have been closed by the Academy." />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {header}
      {note}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <FlatList
          ref={list}
          data={items}
          keyExtractor={(i) => i.key}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: !reduceMotion })}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.accent} colors={[brand.maroon]} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', gap: 8, paddingTop: 40 }}>
              <Avatar name={name} id={data.other?.id ?? name} size={72} />
              <Txt variant="heading" center>
                {name}
              </Txt>
              <Txt muted center>
                {data.iAmMember ? 'Your mentor is here for you. Say hello whenever you are ready.' : 'No messages yet.'}
              </Txt>
            </View>
          }
          renderItem={({ item }) =>
            item.type === 'day' ? (
              <Txt variant="meta" muted center accessibilityRole="header" style={styles.day}>
                {item.label}
              </Txt>
            ) : (
              <View>
                <Bubble
                  body={item.msg.body}
                  mine={item.mine}
                  first={item.first}
                  label={`${item.mine ? 'You' : name}, ${clockTime(item.msg.created_at)}: ${item.msg.body}`}
                />
                {item.last ? (
                  <Txt
                    variant="meta"
                    muted
                    importantForAccessibility="no"
                    accessibilityElementsHidden
                    style={{ alignSelf: item.mine ? 'flex-end' : 'flex-start', marginTop: 3, marginHorizontal: 6, fontSize: 13 }}
                  >
                    {clockTime(item.msg.created_at)}
                  </Txt>
                ) : null}
              </View>
            )
          }
        />
        <View style={[styles.footer, { borderTopColor: t.border, backgroundColor: t.bg, paddingBottom: Math.max(insets.bottom, 10) }]}>
          {data.canSend ? (
            <>
              {sendError ? (
                <Txt variant="meta" color={t.status.safety.fg} accessibilityLiveRegion="polite">
                  {sendError}
                </Txt>
              ) : null}
              <Composer value={draft} onChangeText={setDraft} onSend={send} sending={sending} maxLength={MESSAGE_MAX} />
            </>
          ) : (
            <Card tone="tint">
              <Txt color={t.onTint}>{DM_OFF_COPY}</Txt>
              <Button label="Talk to someone" icon="message-lock-outline" compact onPress={() => router.push('/talk')} style={{ alignSelf: 'flex-start' }} />
            </Card>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  back: { width: TAP, height: TAP, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  list: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 16, flexGrow: 1 },
  day: { marginTop: 18, marginBottom: 2 },
  footer: { paddingHorizontal: 12, paddingTop: 8, gap: 6, borderTopWidth: StyleSheet.hairlineWidth },
});
