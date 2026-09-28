import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { PermissionsAndroid, Platform, Switch, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { Txt } from '@/components/Txt';
import { joinLive } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { clockTime, dayAndTime, timeAgo } from '@/lib/format';
import { hasStarted, liveState, loadSession, sessionLabel } from '@/lib/live';
import { supabase } from '@/lib/supabase';
import { brand, useTheme } from '@/lib/theme';
import { useLoader } from '@/lib/useLoader';

/** Android needs runtime permission before the WebView can use the mic/camera for Jitsi. */
async function androidMediaPermission(audioOnly: boolean) {
  if (Platform.OS !== 'android') return;
  const wanted = audioOnly
    ? [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]
    : [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, PermissionsAndroid.PERMISSIONS.CAMERA];
  try {
    await PermissionsAndroid.requestMultiple(wanted);
  } catch {
    // She can still listen without them.
  }
}

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const t = useTheme();
  const loader = useCallback(() => loadSession(id), [id]);
  const { data: s, error, loading, refreshing, refresh } = useLoader(loader);
  const [audioOnly, setAudioOnly] = useState(me.data_saver);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function join() {
    if (!s) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await joinLive(s.id, audioOnly);
      if (res.provider === 'jaas') await androidMediaPermission(audioOnly);
      const { error: attErr } = await supabase
        .from('attendance')
        .insert({ session_id: s.id, member_id: me.id, audio_only: audioOnly });
      if (attErr && attErr.code !== '23505') console.warn('attendance', attErr.message);
      router.push({ pathname: '/room', params: { url: res.url, title: s.title, provider: res.provider } });
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : 'Could not join the room.');
    } finally {
      setJoining(false);
    }
  }

  const state = s ? liveState(s) : null;
  const started = s ? hasStarted(s) : false;

  return (
    <Screen
      back
      eyebrow={state === 'live' ? 'Live' : state === 'soon' ? 'Starting soon' : state === 'ended' ? 'Ended' : 'Coming up'}
      title={s ? sessionLabel(s) : 'Live session'}
      subtitle={s?.host_name ? `With ${s.host_name}` : undefined}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {loading ? <Loading /> : null}
      {error ? <ErrorState message={error} onRetry={refresh} /> : null}
      {!loading && !error && !s ? <EmptyState title="This session is not available" /> : null}

      {s ? (
        <>
          <Txt variant="bodyStrong">
            {started ? `Started ${timeAgo(s.starts_at)}` : dayAndTime(s.starts_at)}
            {s.ends_at ? ` · until ${clockTime(s.ends_at)}` : ''}
            {s.recording_lesson_id ? ' · recording on' : ''}
          </Txt>

          {s.kind === 'interactive' ? (
            <Card tone="tint">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong" color={t.onTint}>
                    Audio only
                  </Txt>
                  <Txt color={t.onTint}>
                    Low on data? Switch to audio only and stay in the room for a fraction of the bundle.
                  </Txt>
                </View>
                <Switch
                  value={audioOnly}
                  onValueChange={setAudioOnly}
                  accessibilityLabel="Audio only"
                  trackColor={{ true: brand.pink, false: t.segmentRest }}
                  thumbColor={brand.white}
                />
              </View>
            </Card>
          ) : (
            <Txt muted>This is a broadcast — you can watch and listen. Your camera and microphone stay off.</Txt>
          )}

          {joinError ? <ErrorState message={joinError} /> : null}
          {state === 'ended' ? (
            <Txt muted>This session has finished. If it was recorded, it will appear in Learn.</Txt>
          ) : (
            <Button label="Join" icon="video-outline" onPress={join} loading={joining} />
          )}
          <Txt variant="meta" muted>
            Mentors are in every room. Be kind, keep your full name and school private, and use Talk to someone if
            anything feels wrong.
          </Txt>
        </>
      ) : null}
    </Screen>
  );
}
