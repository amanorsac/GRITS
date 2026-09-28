import { Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold } from '@expo-google-fonts/archivo';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { iconFont } from '@/components/Icon';
import { NotConfigured } from '@/components/NotConfigured';
import { AuthProvider, useAuth } from '@/lib/auth';
import { isConfigured } from '@/lib/env';
import { useTheme } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    ...iconFont,
  });
  const t = useTheme();

  if (!loaded && !error) return null;

  const navTheme = t.scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <SafeAreaProvider>
      <ThemeProvider value={{ ...navTheme, colors: { ...navTheme.colors, background: t.bg, primary: t.accent, card: t.header, text: t.text, border: t.border } }}>
        <StatusBar style="light" />
        {isConfigured ? (
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        ) : (
          <NotConfigured onReady={() => SplashScreen.hideAsync()} />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { initialising, session, profile, profileLoading } = useAuth();

  const ready = !initialising && !(session && profileLoading && !profile);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  const signedIn = !!session;
  const isParent = profile?.role === 'parent';
  const isMemberSide = signedIn && !!profile && !isParent;
  const needsProfile = signedIn && !profile;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={needsProfile}>
        <Stack.Screen name="profile-missing" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && isParent}>
        <Stack.Screen name="parent" />
      </Stack.Protected>
      <Stack.Protected guard={isMemberSide}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="module/[id]" />
        <Stack.Screen name="lesson/[id]" />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="room" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="journal" />
        <Stack.Screen name="certificates" />
        <Stack.Screen name="talk" />
      </Stack.Protected>
    </Stack>
  );
}
