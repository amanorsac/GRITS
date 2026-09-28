import { useState } from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { joinWithCode } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

const USERNAME = /^[a-z0-9._-]{3,24}$/;

export default function Join() {
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = useTheme();
  const cleanUsername = username.trim().toLowerCase();

  async function submit() {
    setError(null);
    if (!code.trim()) return setError('Enter the join code from your parent or guardian.');
    if (!USERNAME.test(cleanUsername))
      return setError('Usernames are 3–24 letters or numbers (dots, dashes and underscores are fine). No spaces.');
    if (!displayName.trim()) return setError('Tell us what to call you.');
    if (password.length < 8) return setError('Choose a password with at least 8 characters.');

    setBusy(true);
    try {
      const res = await joinWithCode({
        code: code.trim().toUpperCase(),
        username: cleanUsername,
        password,
        display_name: displayName.trim(),
      });
      const { error: err } = await supabase.auth.signInWithPassword({ email: res.email, password });
      if (err) setError(`Your account is ready, but signing in failed: ${err.message}. Try Sign in.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen back title="I have a join code" subtitle="Your parent or guardian gave you a code. Let's set up your account.">
      <Field label="Join code" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} />
      <Field
        label="Choose a username"
        hint="You will sign in with this. Letters and numbers, no spaces."
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="username"
      />
      <Field
        label="What should we call you?"
        hint="Other girls in your Circle see this name."
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        textContentType="nickname"
      />
      <Field
        label="Choose a password"
        hint="At least 8 characters. Keep it to yourself."
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        error={error}
      />
      <Button label="Create my account" onPress={submit} loading={busy} />
      <Card tone="tint">
        <Txt color={t.onTint}>
          Only use a code your own parent or guardian gave you. If something is not right, ask them to contact the Academy.
        </Txt>
      </Card>
    </Screen>
  );
}
