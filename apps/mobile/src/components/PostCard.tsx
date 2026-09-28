import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { createReply } from '@/lib/api';
import {
  blockPerson,
  KIND_TAG,
  loadReplies,
  REACTIONS,
  reportContent,
  setReaction,
  type FeedPost,
  type ReplyWithAuthor,
} from '@/lib/community';
import { isQuietHours, plural, timeAgo } from '@/lib/format';
import { fonts, radius, TAP, useTheme } from '@/lib/theme';
import type { ReactionKind } from '@/lib/types';

import { Avatar } from './Avatar';
import { Button } from './Button';
import { Card } from './Card';
import { Field } from './Field';
import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

const REACTION_ICON: Record<ReactionKind, { on: IconName; off: IconName }> = {
  crown: { on: 'crown', off: 'crown-outline' },
  heart: { on: 'heart', off: 'heart-outline' },
  praying: { on: 'hands-pray', off: 'hands-pray' },
  amen: { on: 'check-decagram', off: 'check-decagram-outline' },
};

const REPORT_REASONS = ['Unkind or bullying', 'Makes me feel unsafe', 'Not true or spam', 'Something else'];

function chooseReason(title: string, onPick: (reason: string) => void) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: [...REPORT_REASONS, 'Cancel'], cancelButtonIndex: REPORT_REASONS.length },
      (i) => {
        if (i < REPORT_REASONS.length) onPick(REPORT_REASONS[i]);
      },
    );
  } else {
    Alert.alert(title, 'A mentor will look at it. The person is not told who reported it.', [
      ...REPORT_REASONS.slice(0, 2).map((r) => ({ text: r, onPress: () => onPick(r) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }
}

type Props = {
  post: FeedPost;
  userId: string;
  onChange: (next: FeedPost) => void;
  onBlocked: (authorId: string) => void;
  compact?: boolean;
};

export function PostCard({ post, userId, onChange, onBlocked, compact }: Props) {
  const t = useTheme();
  const mine = post.author_id === userId;
  const name = post.author?.display_name || 'A member';
  const tag = KIND_TAG[post.kind];
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<ReplyWithAuthor[] | null>(null);
  const [repliesError, setRepliesError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function toggle(kind: ReactionKind) {
    const on = !post.mine.has(kind);
    const mineNext = new Set(post.mine);
    if (on) mineNext.add(kind);
    else mineNext.delete(kind);
    const optimistic = {
      ...post,
      mine: mineNext,
      reactions: { ...post.reactions, [kind]: Math.max(0, post.reactions[kind] + (on ? 1 : -1)) },
    };
    onChange(optimistic);
    try {
      await setReaction(post.id, userId, kind, on);
    } catch {
      onChange(post);
    }
  }

  async function openReplies() {
    const next = !open;
    setOpen(next);
    if (next && replies === null) {
      try {
        setRepliesError(null);
        setReplies(await loadReplies(post.id));
      } catch (e) {
        setRepliesError(e instanceof Error ? e.message : 'Could not load replies.');
      }
    }
  }

  async function sendReply() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await createReply({ post_id: post.id, body });
      setDraft('');
      if (res.status === 'pending') {
        setNotice('Thanks — a mentor checks it before it appears.');
      }
      const fresh = await loadReplies(post.id);
      setReplies(fresh);
      onChange({ ...post, replyCount: fresh.filter((r) => r.status === 'approved').length });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Your reply did not send.');
    } finally {
      setSending(false);
    }
  }

  function report() {
    chooseReason('Report this post', async (reason) => {
      try {
        await reportContent(userId, { post_id: post.id }, reason);
        Alert.alert('Thank you for telling us', 'A mentor will look at this post. You did the right thing.');
      } catch (e) {
        Alert.alert('That did not send', e instanceof Error ? e.message : 'Please try again.');
      }
    });
  }

  function block() {
    Alert.alert(`Block ${name}?`, 'You will not see their posts any more. They are not told.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            await blockPerson(userId, post.author_id);
            onBlocked(post.author_id);
          } catch (e) {
            Alert.alert('That did not work', e instanceof Error ? e.message : 'Please try again.');
          }
        },
      },
    ]);
  }

  function more() {
    const options = ['Report post', `Block ${name}`, 'Cancel'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2, destructiveButtonIndex: 1 },
        (i) => {
          if (i === 0) report();
          if (i === 1) block();
        },
      );
    } else {
      Alert.alert('This post', undefined, [
        { text: 'Report post', onPress: report },
        { text: `Block ${name}`, style: 'destructive', onPress: block },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  const quiet = isQuietHours();

  return (
    <Card>
      <View style={styles.head}>
        <Avatar name={name} id={post.author_id} />
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong">{name}</Txt>
          <Txt variant="meta" muted>
            {timeAgo(post.created_at)}
            {tag ? ` · ${tag}` : ''}
          </Txt>
        </View>
        {!mine ? (
          <Pressable onPress={more} accessibilityRole="button" accessibilityLabel={`Report or block, post by ${name}`} style={styles.iconBtn}>
            <Icon name="dots-horizontal" color={t.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {post.status === 'pending' ? (
        <View style={[styles.pending, { backgroundColor: t.status.attention.bg }]}>
          <Icon name="clock-outline" size={16} color={t.status.attention.fg} />
          <Txt variant="meta" color={t.status.attention.fg}>
            Waiting for a mentor — only you can see this for now
          </Txt>
        </View>
      ) : null}

      <Txt>{post.body}</Txt>

      {!compact && post.status === 'approved' ? (
        <>
          <View style={styles.reactions}>
            {REACTIONS.map((r) => {
              const on = post.mine.has(r.kind);
              const count = post.reactions[r.kind];
              return (
                <Pressable
                  key={r.kind}
                  onPress={() => toggle(r.kind)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${r.label}, ${count}`}
                  style={[
                    styles.reaction,
                    { borderColor: on ? t.accent : t.border, backgroundColor: on ? t.tint : 'transparent' },
                  ]}
                >
                  <Icon name={on ? REACTION_ICON[r.kind].on : REACTION_ICON[r.kind].off} size={18} color={on ? t.accent : t.textMuted} />
                  <Txt variant="meta" color={on ? t.accent : t.textMuted} style={{ fontFamily: fonts.bodySemi }}>
                    {r.label} {count > 0 ? count : ''}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={openReplies}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={post.replyCount ? plural(post.replyCount, 'reply', 'replies') : 'Reply'}
            style={styles.repliesToggle}
          >
            <Icon name={open ? 'chevron-up' : 'comment-outline'} size={18} color={t.accent} />
            <Txt variant="label" color={t.accent}>
              {post.replyCount ? plural(post.replyCount, 'reply', 'replies') : 'Reply'}
            </Txt>
          </Pressable>
        </>
      ) : null}

      {open ? (
        <View style={[styles.replies, { borderTopColor: t.border }]}>
          {repliesError ? <Txt muted>{repliesError}</Txt> : null}
          {replies === null && !repliesError ? <Txt muted>Loading replies…</Txt> : null}
          {replies?.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', gap: 10 }}>
              <Avatar name={r.author?.display_name || 'A member'} id={r.author_id} size={32} />
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">
                  {r.author?.display_name || 'A member'}{' '}
                  <Txt variant="meta" muted>
                    {timeAgo(r.created_at)}
                    {r.status === 'pending' ? ' · waiting for a mentor' : ''}
                  </Txt>
                </Txt>
                <Txt>{r.body}</Txt>
              </View>
            </View>
          ))}
          {quiet ? (
            <Txt variant="meta" muted>
              The Court closes at 9:00 pm. You can reply again from 6:00 am.
            </Txt>
          ) : (
            <>
              <Field
                label="Your reply"
                value={draft}
                onChangeText={setDraft}
                placeholder="Say something kind"
                maxLength={1000}
                multiline
                style={{ minHeight: 80 }}
              />
              {notice ? (
                <Txt variant="meta" muted accessibilityLiveRegion="polite">
                  {notice}
                </Txt>
              ) : null}
              <Button label="Send reply" compact onPress={sendReply} loading={sending} disabled={!draft.trim()} style={{ alignSelf: 'flex-start' }} />
            </>
          )}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  pending: { flexDirection: 'row', gap: 6, alignItems: 'center', padding: 8, borderRadius: radius },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reaction: {
    minHeight: TAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: radius,
    borderWidth: 1.5,
  },
  repliesToggle: { minHeight: TAP, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  replies: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 12 },
});
