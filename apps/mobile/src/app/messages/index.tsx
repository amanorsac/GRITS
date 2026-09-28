import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { previewOf, RingAvatar, SearchPill, ThreadRow } from '@/components/Messenger';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { Txt } from '@/components/Txt';
import { useMe } from '@/lib/auth';
import {
  DM_OFF_COPY,
  loadMemberInbox,
  loadMentorInbox,
  MENTOR_SAFETY_NOTE,
  NO_CIRCLE_COPY,
  openMentorThread,
  SAFETY_NOTE,
  type MemberInbox,
  type MentorInbox,
} from '@/lib/messages';
import { useTheme } from '@/lib/theme';
import type { Profile, PublicProfile } from '@/lib/types';
import { useLoader } from '@/lib/useLoader';

function matches(p: PublicProfile | null, q: string): boolean {
  if (!q) return true;
  return (p?.display_name ?? '').toLowerCase().includes(q.toLowerCase());
}

export default function Messages() {
  const me = useMe();
  const isMember = me.role === 'member';
  const loader = useCallback(
    (): Promise<MemberInbox | MentorInbox> => (me.role === 'member' ? loadMemberInbox(me) : loadMentorInbox(me)),
    [me],
  );
  const { data, error, loading, refreshing, refresh } = useLoader(loader, { refetchOnFocus: true });
  const [query, setQuery] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  async function openMentor(inbox: MemberInbox) {
    if (!inbox.mentor || opening) return;
    if (inbox.state !== 'ready') {
      setHint(DM_OFF_COPY);
      return;
    }
    if (inbox.thread) {
      router.push(`/messages/${inbox.thread.thread.id}`);
      return;
    }
    setOpening(true);
    setOpenError(null);
    try {
      const id = await openMentorThread(me.id, inbox.mentor.id);
      router.push(`/messages/${id}`);
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : 'That did not open. Please try again.');
    } finally {
      setOpening(false);
    }
  }

  // Top ring row: her Circle with the mentor first; for a mentor, the girls who have written.
  const people: PublicProfile[] =
    data?.kind === 'member'
      ? data.ring
      : data?.kind === 'mentor'
        ? data.threads.map((s) => s.other).filter((p): p is PublicProfile => !!p)
        : [];
  const ring = people.filter((p) => matches(p, query));
  const mentorId = data?.kind === 'member' ? data.mentor?.id : undefined;

  const header = (
    <View style={{ gap: 14 }}>
      <SearchPill value={query} onChangeText={setQuery} placeholder={isMember ? 'Search your Circle' : 'Search girls'} />
      {ring.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
          {ring.map((p) => {
            const isMentor = p.id === mentorId;
            const name = p.display_name || 'A member';
            if (data?.kind === 'mentor') {
              const thread = data.threads.find((t) => t.other?.id === p.id);
              return (
                <RingAvatar
                  key={p.id}
                  id={p.id}
                  name={name}
                  accessibilityLabel={`${name}. Open your messages with her.`}
                  onPress={() => thread && router.push(`/messages/${thread.thread.id}`)}
                />
              );
            }
            return (
              <RingAvatar
                key={p.id}
                id={p.id}
                name={name}
                mentor={isMentor}
                accessibilityLabel={isMentor ? `${name}, your mentor` : `${name}, in your Circle`}
                accessibilityHint={isMentor ? 'Opens your messages with your mentor' : undefined}
                onPress={() =>
                  isMentor && data?.kind === 'member'
                    ? openMentor(data)
                    : setHint(`${name} is in your Circle. You can cheer each other on in the Court.`)
                }
              />
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );

  return (
    <Screen back large title="Messages" header={header} refreshing={refreshing} onRefresh={refresh}>
      {loading ? <Loading label="Loading messages" /> : null}
      {error ? <ErrorState message={error} onRetry={refresh} /> : null}
      {hint ? (
        <Txt variant="meta" muted accessibilityLiveRegion="polite">
          {hint}
        </Txt>
      ) : null}
      {data?.kind === 'member' ? (
        <MemberBody inbox={data} me={me} query={query} opening={opening} openError={openError} onOpen={() => openMentor(data)} />
      ) : null}
      {data?.kind === 'mentor' ? <MentorBody inbox={data} me={me} query={query} /> : null}
    </Screen>
  );
}

function SafetyLine({ text }: { text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingTop: 4 }}>
      <Icon name="shield-lock-outline" color={t.textMuted} />
      <Txt muted style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

function MemberBody({
  inbox,
  me,
  query,
  opening,
  openError,
  onOpen,
}: {
  inbox: MemberInbox;
  me: Profile;
  query: string;
  opening: boolean;
  openError: string | null;
  onOpen: () => void;
}) {
  const t = useTheme();
  if (inbox.state === 'no-circle' || !inbox.mentor) {
    return <EmptyState icon="account-group-outline" title="Your mentor is coming" body={NO_CIRCLE_COPY} />;
  }
  if (inbox.state === 'off') {
    return (
      <Card tone="tint">
        <Txt color={t.onTint}>{DM_OFF_COPY}</Txt>
        <Button label="Talk to someone" icon="message-lock-outline" onPress={() => router.push('/talk')} style={{ alignSelf: 'flex-start' }} compact />
      </Card>
    );
  }
  const name = inbox.mentor.display_name || 'Your mentor';
  const { preview, time } = previewOf(inbox.thread?.last ?? null, me.id, 'Say hello to your mentor');
  return (
    <>
      {matches(inbox.mentor, query) ? (
        <Card style={{ paddingVertical: 2 }}>
          <ThreadRow name={name} id={inbox.mentor.id} mentor preview={opening ? 'Opening…' : preview} time={time} onPress={onOpen} last />
        </Card>
      ) : (
        <Txt muted>No one by that name.</Txt>
      )}
      {openError ? (
        <Txt variant="meta" color={t.status.safety.fg} accessibilityLiveRegion="polite">
          {openError}
        </Txt>
      ) : null}
      <SafetyLine text={SAFETY_NOTE} />
    </>
  );
}

function MentorBody({ inbox, me, query }: { inbox: MentorInbox; me: Profile; query: string }) {
  const threads = inbox.threads.filter((s) => matches(s.other, query));
  if (inbox.threads.length === 0) {
    return (
      <>
        <EmptyState icon="message-outline" title="No messages yet" body="When a girl in your Circle messages you, it appears here." />
        <SafetyLine text={MENTOR_SAFETY_NOTE} />
      </>
    );
  }
  return (
    <>
      {threads.length === 0 ? <Txt muted>No one by that name.</Txt> : null}
      {threads.length > 0 ? (
        <Card style={{ paddingVertical: 2 }}>
          {threads.map((s, i) => {
            const { preview, time } = previewOf(s.last, me.id, 'No messages yet');
            return (
              <ThreadRow
                key={s.thread.id}
                id={s.thread.member_id}
                name={s.other?.display_name || 'A member'}
                preview={preview}
                time={time}
                onPress={() => router.push(`/messages/${s.thread.id}`)}
                last={i === threads.length - 1}
              />
            );
          })}
        </Card>
      ) : null}
      <SafetyLine text={MENTOR_SAFETY_NOTE} />
    </>
  );
}
