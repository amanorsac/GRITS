import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { loginToEmail } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!login.trim() || !password) {
      setError('Enter your username (or email) and your password.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: loginToEmail(login), password });
    setBusy(false);
    if (err) {
      setError(
        /invalid/i.test(err.message)
          ? 'That username and password do not match. Check them and try again.'
          : err.message,
      );
    }
    // On success the root layout switches to the app automatically.
  }

  return (
    <Screen back title="Sign in" subtitle="Welcome back, Queen.">
      <Field
        label="Username or email"
        value={login}
        onChangeText={setLogin}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={error}
      />
      <Button label="Sign in" onPress={submit} loading={busy} />
      <View style={{ gap: 6, marginTop: 8 }}>
        <Txt muted>Forgotten your password? Ask your parent or your mentor — the Academy can reset it for you.</Txt>
        <Button label="I have a join code" variant="ghost" onPress={() => router.replace('/join')} />
      </View>
    </Screen>
  );
}
