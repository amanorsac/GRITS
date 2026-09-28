import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CrownMark } from '@/components/CrownMark';
import { Screen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { useAuth } from '@/lib/auth';
import { firstName } from '@/lib/format';

/** Parents use the website. The app is for the girls. */
export default function ParentNotice() {
  const { profile, signOut } = useAuth();
  const name = firstName(profile?.display_name || profile?.full_name);
  return (
    <Screen title={name ? `Hello, ${name}` : 'Hello'} subtitle="Thank you for raising a Queen.">
      <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
        <CrownMark size={64} />
        <Txt variant="heading" center accessibilityRole="header">
          The parent portal lives on the web
        </Txt>
        <Txt muted center>
          This app is for the girls. Your daughter&apos;s progress, attendance and permissions are in your parent portal,
          which you can open in any web browser.
        </Txt>
      </Card>
      <Button label="Sign out" variant="secondary" icon="logout" onPress={signOut} />
    </Screen>
  );
}
