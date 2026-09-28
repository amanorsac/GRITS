import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { PostCard } from '@/components/PostCard';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { Txt } from '@/components/Txt';
import { createPost, type PostKind } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { loadPosts, loadSpaces, PAGE_SIZE, POST_KINDS, type FeedPost } from '@/lib/community';
import { isQuietHours } from '@/lib/format';
import { commitHaptic } from '@/lib/haptics';
import { brand, TAP, useTheme } from '@/lib/theme';
import { useLoader } from '@/lib/useLoader';

type Feed = {
  spaceId: string | null;
  posts: FeedPost[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
};
const EMPTY_FEED: Feed = { spaceId: null, posts: [], loading: false, error: null, hasMore: false, loadingMore: false };

export default function Court() {
  const me = useMe();
  const t = useTheme();
  const spacesLoader = useCallback(() => loadSpaces(), []);
  const spaces = useLoader(spacesLoader);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [feed, setFeed] = useState<Feed>(EMPTY_FEED);
  const [refreshing, setRefreshing] = useState(false);

  const list = spaces.data ?? [];
  const selected = list.find((s) => s.id === spaceId) ?? list[0] ?? null;

  const fetchFeed = useCallback(
    (id: string): Promise<Feed> =>
      loadPosts(id, me.id).then(
        (posts) => ({ spaceId: id, posts, loading: false, error: null, hasMore: posts.length === PAGE_SIZE, loadingMore: false }),
        (e: unknown) => ({ ...EMPTY_FEED, spaceId: id, error: e instanceof Error ? e.message : 'Could not load posts.' }),
      ),
    [me.id],
  );
  const loadFeed = useCallback(async (id: string) => setFeed(await fetchFeed(id)), [fetchFeed]);

  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetchFeed(selectedId).then((next) => {
      if (!cancelled) setFeed(next);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, fetchFeed]);

  // A feed that belongs to another space is still loading for this one.
  const feedLoading = feed.loading || feed.spaceId !== selectedId;
  const retryFeed = (id: string) => {
    setFeed((f) => ({ ...f, loading: true, error: null }));
    loadFeed(id);
  };

  async function loadEarlier() {
    if (!selected || feed.posts.length === 0) return;
    setFeed((f) => ({ ...f, loadingMore: true }));
    try {
      const older = await loadPosts(selected.id, me.id, feed.posts[feed.posts.length - 1].created_at);
      setFeed((f) => ({ ...f, posts: [...f.posts, ...older], hasMore: older.length === PAGE_SIZE, loadingMore: false }));
    } catch {
      setFeed((f) => ({ ...f, loadingMore: false }));
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await spaces.reload();
    if (selected) await loadFeed(selected.id);
    setRefreshing(false);
  }

  const talkLink = (
    <PressableScale
      onPress={() => router.push('/talk')}
      accessibilityRole="button"
      accessibilityLabel="Talk to someone"
      style={{ minHeight: TAP, justifyContent: 'center', paddingLeft: 8 }}
    >
      <Txt variant="label" color={brand.pinkSoft} style={{ textDecorationLine: 'underline' }}>
        Talk to someone
      </Txt>
    </PressableScale>
  );

  const headerActions = (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <PressableScale
        onPress={() => router.push('/messages')}
        accessibilityRole="button"
        accessibilityLabel="Messages"
        accessibilityHint="Opens your messages with your mentor"
        style={{ width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="message-text-outline" size={24} color={brand.cream} />
      </PressableScale>
      {talkLink}
    </View>
  );

  return (
    <Screen
      title="The Court"
      right={headerActions}
      refreshing={refreshing}
      onRefresh={onRefresh}
      header={
        list.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {list.map((s) => (
              <SpaceChip key={s.id} label={s.name} selected={s.id === selected?.id} onPress={() => setSpaceId(s.id)} />
            ))}
          </ScrollView>
        ) : null
      }
    >
      {spaces.loading ? <Loading /> : null}
      {spaces.error ? <ErrorState message={spaces.error} onRetry={spaces.refresh} /> : null}
      {!spaces.loading && !spaces.error && list.length === 0 ? (
        <EmptyState
          icon="account-group-outline"
          title="The Court is resting"
          body="The Court opens when your parent switches it on. Your lessons and live sessions are always here."
        />
      ) : null}

      {selected ? (
        <>
          <Composer spaceId={selected.id} onPosted={() => loadFeed(selected.id)} />
          {feedLoading ? <Loading label="Loading posts" /> : null}
          {!feedLoading && feed.error ? <ErrorState message={feed.error} onRetry={() => retryFeed(selected.id)} /> : null}
          {!feedLoading && !feed.error && feed.posts.length === 0 ? (
            <EmptyState icon="message-outline" title="No posts yet" body={`Be the first to share something in ${selected.name}.`} />
          ) : null}
          {(feedLoading ? [] : feed.posts).map((p) => (
            <PostCard
              key={p.id}
              post={p}
              userId={me.id}
              onChange={(next) => setFeed((f) => ({ ...f, posts: f.posts.map((x) => (x.id === next.id ? next : x)) }))}
              onBlocked={(authorId) => setFeed((f) => ({ ...f, posts: f.posts.filter((x) => x.author_id !== authorId) }))}
            />
          ))}
          {!feedLoading && feed.hasMore ? (
            <Button label="Show earlier posts" variant="secondary" onPress={loadEarlier} loading={feed.loadingMore} />
          ) : null}
        </>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingTop: 8 }}>
        <Icon name="weather-night" size={18} color={t.textMuted} />
        <Txt variant="meta" muted style={{ flex: 1 }}>
          The Court closes at 9:00 pm. Lessons stay open all night.
        </Txt>
      </View>
    </Screen>
  );
}

function SpaceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  // Chips on the maroon header: pill shape is allowed on maroon surfaces.
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{
        minHeight: TAP,
        paddingHorizontal: 16,
        borderRadius: 999,
        justifyContent: 'center',
        backgroundColor: selected ? brand.pinkBright : 'transparent',
        borderWidth: 1.5,
        borderColor: selected ? brand.pinkBright : 'rgba(247,242,236,0.55)',
      }}
    >
      <Txt variant="label" color={selected ? brand.maroonDeep : brand.cream}>
        {label}
      </Txt>
    </PressableScale>
  );
}

function Composer({ spaceId, onPosted }: { spaceId: string; onPosted: () => void }) {
  const t = useTheme();
  const [kind, setKind] = useState<PostKind>('general');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const quiet = isQuietHours();

  if (quiet) {
    return (
      <Card tone="tint" style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Icon name="weather-night" color={t.onTint} />
        <Txt color={t.onTint} style={{ flex: 1 }}>
          The Court closes at 9:00 pm. Lessons stay open all night. You can post again from 6:00 am.
        </Txt>
      </Card>
    );
  }

  async function submit() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await createPost({ space_id: spaceId, kind, body: text });
      commitHaptic();
      setBody('');
      setKind('general');
      setNotice(res.status === 'pending' ? 'Thanks — a mentor checks every first post before it appears.' : 'Posted.');
      onPosted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your post did not send.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {POST_KINDS.map((k) => (
          <Chip key={k.kind} label={k.label} selected={kind === k.kind} onPress={() => setKind(k.kind)} />
        ))}
      </ScrollView>
      <Field
        label="Write a post"
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={2000}
        placeholder="Share a win, a prayer, a book or a verse."
        error={error}
      />
      {notice ? (
        <Txt variant="meta" muted accessibilityLiveRegion="polite">
          {notice}
        </Txt>
      ) : null}
      <Button label="Post" onPress={submit} loading={busy} disabled={!body.trim()} compact style={{ alignSelf: 'flex-start' }} />
    </Card>
  );
}
