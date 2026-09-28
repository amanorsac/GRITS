import { Button } from '@/components/Button';
import { ErrorState } from '@/components/States';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/lib/auth';

/** Signed in, but the profile row could not be read (offline, or not created yet). */
export default function ProfileMissing() {
  const { profileError, refreshProfile, profileLoading, signOut } = useAuth();
  return (
    <Screen title="One moment">
      <ErrorState message={profileError ?? 'We could not load your account.'} />
      <Button label="Try again" onPress={refreshProfile} loading={profileLoading} />
      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
