import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { sendHelp } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

/** "Talk to someone" — reaches the Academy's safeguarding lead. */
export default function Talk() {
  const me = useMe();
  const t = useTheme();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      await sendHelp(text);
      setSent(true);
    } catch {
      // Fall back to writing the request directly; staff see it in the Palace.
      const { error: err } = await supabase.from('help_requests').insert({ member_id: me.id, body: text });
      if (err) setError('Your message did not send. Please try again, or tell a mentor or a trusted adult in person.');
      else setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen back title="Talk to someone" subtitle="A real adult at the Academy. Nobody else sees it.">
      {sent ? (
        <Card tone="tint" accessibilityLiveRegion="polite">
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name="check-circle" color={t.status.complete.fg} />
            <Txt variant="heading" color={t.onTint}>
              Your message is on its way
            </Txt>
          </View>
          <Txt color={t.onTint}>
            Thank you for telling us. Someone from the Academy will reach out to you soon. You did the right thing.
          </Txt>
          <Button
            label="Write another message"
            variant="secondary"
            compact
            onPress={() => {
              setBody('');
              setSent(false);
            }}
            style={{ alignSelf: 'flex-start' }}
          />
        </Card>
      ) : (
        <>
          <Txt>
            If anything here or anywhere else is worrying you — online, at school, at home — write it down. It goes to a
            trained adult at the Academy, not to other girls.
          </Txt>
          <Field
            label="Your message"
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={4000}
            placeholder="Write what is on your mind."
            error={error}
            style={{ minHeight: 180 }}
          />
          <Button label="Send privately" icon="send-lock-outline" onPress={send} loading={busy} disabled={!body.trim()} />
        </>
      )}
      <Card>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="phone-alert-outline" color={t.status.safety.fg} />
          <Txt style={{ flex: 1 }}>
            If you are in danger right now, go to a trusted adult near you or call the police. In Ghana, dial 191 or 112.
          </Txt>
        </View>
      </Card>
    </Screen>
  );
}
