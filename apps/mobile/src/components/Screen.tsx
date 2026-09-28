import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand, TAP, useTheme } from '@/lib/theme';

import { Icon } from './Icon';
import { Txt } from './Txt';

type Props = {
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  /** Extra content inside the maroon header. */
  header?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
};

/** Every screen: a maroon header (safe-area aware) over the cream page. */
export function Screen({ title, eyebrow, subtitle, back, right, header, children, refreshing, onRefresh, scroll = true }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const head = (
    <View style={[styles.header, { backgroundColor: t.header, paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        {back ? (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            style={styles.backBtn}
          >
            <Icon name="chevron-left" size={30} color={brand.cream} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          {eyebrow ? (
            <Txt variant="eyebrow" color={t.headerMuted}>
              {eyebrow}
            </Txt>
          ) : null}
          {title ? (
            <Txt variant={back ? 'heading' : 'title'} color={t.headerText} accessibilityRole="header">
              {title}
            </Txt>
          ) : null}
          {subtitle ? (
            <Txt variant="body" color={t.headerMuted}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        {right}
      </View>
      {header}
    </View>
  );

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.content, { paddingBottom: 32 + (back ? insets.bottom : 0) }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[brand.maroon]} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1 }}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {head}
      {body}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { width: TAP, height: TAP, marginLeft: -12, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 14 },
});
