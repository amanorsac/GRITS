import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { ErrorState, Loading } from '@/components/States';
import { Txt } from '@/components/Txt';
import { useAuth, useMe } from '@/lib/auth';
import { monthName, plural } from '@/lib/format';
import { loadCourse } from '@/lib/learning';
import { must, supabase } from '@/lib/supabase';
import { brand, radius, useTheme } from '@/lib/theme';
import type { Badge } from '@/lib/types';
import { useLoader } from '@/lib/useLoader';

export default function Me() {
  const me = useMe();
  const { setProfile, signOut } = useAuth();
  const t = useTheme();

  const loader = useCallback(async () => {
    const [streak, badges, earned, course, journal, certs, circle] = await Promise.all([
      supabase.rpc('member_streak'),
      supabase.from('badges').select('id, slug, name, description'),
      supabase.from('member_badges').select('badge_id').eq('member_id', me.id),
      loadCourse(me.id),
      supabase.from('journal_entries').select('id', { count: 'exact', head: true }).eq('member_id', me.id),
      supabase.from('certificates').select('id', { count: 'exact', head: true }).eq('member_id', me.id),
      me.circle_id
        ? supabase.from('circles').select('name').eq('id', me.circle_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    const total = course.modules.reduce((n, m) => n + m.lessons.length, 0);
    const done = [...course.progress.values()].filter((p) => p.completed_at).length;
    const earnedIds = new Set((must(earned) as { badge_id: string }[]).map((b) => b.badge_id));
    return {
      streak: typeof streak.data === 'number' ? streak.data : 0,
      badges: must(badges) as Badge[],
      earnedIds,
      journey: total ? Math.round((100 * done) / total) : 0,
      journalCount: journal.count ?? 0,
      certCount: certs.count ?? 0,
      circleName: (circle.data as { name: string } | null)?.name ?? null,
    };
  }, [me.id, me.circle_id]);
  const { data, error, loading, refreshing, refresh } = useLoader(loader, { refetchOnFocus: true });

  const [saverBusy, setSaverBusy] = useState(false);
  async function toggleSaver(value: boolean) {
    setSaverBusy(true);
    const prev = me;
    setProfile({ ...me, data_saver: value });
    const { error: err } = await supabase.from('profiles').update({ data_saver: value }).eq('id', me.id);
    if (err) {
      setProfile(prev);
      Alert.alert('That did not save', err.message);
    }
    setSaverBusy(false);
  }

  function requestDeletion() {
    Alert.alert(
      'Delete my account?',
      'This asks the Academy to delete your account, your journal and your posts. The Academy will confirm with your parent or guardian first.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete my account',
          style: 'destructive',
          onPress: async () => {
            const { error: err } = await supabase
              .from('account_deletion_requests')
              .insert({ user_id: me.id, reason: 'Requested in the mobile app' });
            if (err) {
              Alert.alert('That did not send', err.message);
              return;
            }
            Alert.alert(
              'Request sent',
              'The Academy will confirm with your parent or guardian, then delete your account. You will now be signed out.',
              [{ text: 'OK', onPress: () => signOut() }],
            );
          },
        },
      ],
    );
  }

  const name = me.full_name || me.display_name || 'Queen';
  const subtitle = [
    `Crown Level ${me.crown_level}`,
    data?.circleName,
    me.created_at ? `joined ${monthName(me.created_at)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen title={name} subtitle={subtitle} refreshing={refreshing} onRefresh={refresh}>
      {loading ? <Loading /> : null}
      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {data ? (
        <>
          <View style={styles.stats}>
            <Stat value={String(data.streak)} label="day streak" />
            <Stat value={String(data.earnedIds.size)} label={data.earnedIds.size === 1 ? 'badge' : 'badges'} />
            <Stat value={`${data.journey}%`} label="journey" />
          </View>

          <Card>
            <Txt variant="heading">Badges</Txt>
            <View style={styles.badges}>
              {data.badges.map((b) => {
                const got = data.earnedIds.has(b.id);
                return (
                  <View
                    key={b.id}
                    style={styles.badge}
                    accessible
                    accessibilityLabel={`${b.name}, ${got ? 'earned' : 'locked'}. ${b.description}`}
                  >
                    <View
                      style={[
                        styles.badgeIcon,
                        { backgroundColor: got ? brand.gold : t.status.locked.bg, borderColor: got ? brand.gold : t.border },
                      ]}
                    >
                      <Icon name={got ? 'crown' : 'lock-outline'} size={26} color={got ? brand.maroonDeep : t.status.locked.fg} />
                    </View>
                    <Txt variant="meta" center color={got ? t.text : t.textMuted} numberOfLines={2}>
                      {b.name}
                    </Txt>
                  </View>
                );
              })}
            </View>
          </Card>

          <Card style={{ paddingVertical: 4 }}>
            <Row
              icon="notebook-outline"
              title="My journal"
              detail={plural(data.journalCount, 'entry', 'entries')}
              onPress={() => router.push('/journal')}
            />
            <Row
              icon="certificate-outline"
              title="Certificates"
              detail={plural(data.certCount, 'certificate')}
              onPress={() => router.push('/certificates')}
            />
            <Row
              icon="signal-cellular-2"
              title="Data Saver"
              detail="Video at 480p, audio-only live by default"
              right={
                <Switch
                  value={me.data_saver}
                  onValueChange={toggleSaver}
                  disabled={saverBusy}
                  accessibilityLabel="Data Saver"
                  trackColor={{ true: brand.pink, false: t.segmentRest }}
                  thumbColor={brand.white}
                />
              }
            />
            <Row icon="bell-outline" title="Notifications" detail="Push, quiet after 9pm" last />
          </Card>
        </>
      ) : null}

      <Card tone="tint">
        <Txt variant="heading" color={t.onTint}>
          Talk to someone
        </Txt>
        <Txt color={t.onTint}>
          If anything here or anywhere else is worrying you, this reaches a real adult at the Academy. Nobody else sees it.
        </Txt>
        <Button label="Start a private message" icon="message-lock-outline" onPress={() => router.push('/talk')} />
      </Card>

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Icon name="shield-account-outline" color={t.textMuted} />
        <Txt muted style={{ flex: 1 }}>
          Your parent can see your progress and attendance. They cannot read your journal or your messages.
        </Txt>
      </View>

      <Button label="Sign out" variant="secondary" icon="logout" onPress={signOut} />
      <Button label="Delete my account" variant="danger" icon="account-remove-outline" onPress={requestDeletion} />
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const t = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: t.surface, borderColor: t.border }]} accessible accessibilityLabel={`${value} ${label}`}>
      <Txt variant="number" color={t.scheme === 'dark' ? t.gold : brand.maroon}>
        {value}
      </Txt>
      <Txt variant="meta" muted>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderWidth: 1, borderRadius: radius, padding: 14, alignItems: 'center', gap: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  badge: { width: '25%', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  badgeIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
});
