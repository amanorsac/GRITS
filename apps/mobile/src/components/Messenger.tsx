import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { threadTime } from '@/lib/format';
import { brand, fonts, TAP, useTheme } from '@/lib/theme';
import type { DmMessage } from '@/lib/types';

import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

// Messenger-style pieces for mentor messages, in the Academy's colours and type.

/** Search pill for the maroon header: 40 tall, radius 25, with a 44pt tap area around it. */
export function SearchPill({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder: string }) {
  const input = useRef<TextInput>(null);
  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false} style={styles.pillHit}>
      <View style={styles.pill}>
        <Icon name="magnify" size={20} color={brand.pinkSoft} />
        <TextInput
          ref={input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(251,227,238,0.75)"
          accessibilityLabel={placeholder}
          returnKeyType="search"
          autoCorrect={false}
          maxFontSizeMultiplier={1.4}
          style={styles.pillInput}
        />
        {value ? (
          <Pressable onPress={() => onChangeText('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
            <Icon name="close-circle" size={18} color={brand.pinkSoft} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

/** A ~64pt avatar inside a 3pt ring, name underneath. Gold ring for the mentor, pink for the Circle. */
export function RingAvatar({
  name,
  id,
  mentor,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  name: string;
  id: string;
  mentor?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
}) {
  const size = 64;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={styles.ringItem}
    >
      <View style={[styles.ring, { width: size + 10, height: size + 10, borderRadius: (size + 10) / 2, borderColor: mentor ? brand.gold : brand.pinkBright }]}>
        <Avatar name={name} id={id} size={size} />
      </View>
      <Txt variant="meta" color={brand.cream} numberOfLines={1} center style={{ width: 76 }}>
        {mentor ? 'Mentor' : name.split(/\s+/)[0]}
      </Txt>
    </PressableScale>
  );
}

/** A conversation row: avatar, name, last message preview, time. No read receipts. */
export function ThreadRow({
  name,
  id,
  preview,
  time,
  onPress,
  mentor,
  last,
}: {
  name: string;
  id: string;
  preview: string;
  time?: string | null;
  onPress: () => void;
  mentor?: boolean;
  last?: boolean;
}) {
  const t = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}${mentor ? ', your mentor' : ''}. ${preview}${time ? `. ${time}` : ''}`}
      style={[styles.thread, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}
    >
      <View style={[styles.threadRing, { borderColor: mentor ? t.gold : 'transparent' }]}>
        <Avatar name={name} id={id} size={52} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Txt variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {name}
          </Txt>
          {time ? (
            <Txt variant="meta" muted>
              {time}
            </Txt>
          ) : null}
        </View>
        <Txt muted numberOfLines={1}>
          {preview}
        </Txt>
      </View>
    </PressableScale>
  );
}

export function previewOf(m: DmMessage | null, myId: string, fallback: string): { preview: string; time: string | null } {
  if (!m) return { preview: fallback, time: null };
  return { preview: `${m.sender_id === myId ? 'You: ' : ''}${m.body.replace(/\s+/g, ' ')}`, time: threadTime(m.created_at) };
}

const BIG = 18;
const TIGHT = 6;

/** A chat bubble. Mine: right, maroon, white text. Theirs: left, on a light surface. */
export function Bubble({ body, mine, first, label }: { body: string; mine: boolean; first: boolean; label: string }) {
  const t = useTheme();
  // The tail side (right for mine, left for theirs) is tighter at the bottom, and at the top
  // too when the bubble continues a group from the same person.
  const tail = mine
    ? { borderTopRightRadius: first ? BIG : TIGHT, borderBottomRightRadius: TIGHT }
    : { borderTopLeftRadius: first ? BIG : TIGHT, borderBottomLeftRadius: TIGHT };
  const theirsBg = t.scheme === 'dark' ? t.surfaceAlt : t.surface;
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.bubble,
        tail,
        mine
          ? { alignSelf: 'flex-end', backgroundColor: brand.maroon, borderColor: brand.maroon }
          : { alignSelf: 'flex-start', backgroundColor: theirsBg, borderColor: t.border },
        { marginTop: first ? 10 : 2 },
      ]}
    >
      <Txt color={mine ? brand.white : t.text} selectable>
        {body}
      </Txt>
    </View>
  );
}

/** Pill composer with a round send button. */
export function Composer({
  value,
  onChangeText,
  onSend,
  sending,
  maxLength,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  maxLength: number;
}) {
  const t = useTheme();
  const canSend = !!value.trim() && !sending;
  return (
    <View style={styles.composerRow}>
      <View style={[styles.composerPill, { backgroundColor: t.inputBg, borderColor: t.border }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Message"
          placeholderTextColor={t.textMuted}
          accessibilityLabel="Message"
          multiline
          maxLength={maxLength}
          maxFontSizeMultiplier={1.4}
          style={[styles.composerInput, { color: t.text }]}
        />
      </View>
      <PressableScale
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send message"
        accessibilityState={{ disabled: !canSend, busy: sending }}
        style={[styles.send, { backgroundColor: t.primary, opacity: canSend ? 1 : 0.45 }]}
      >
        <Icon name="send" size={22} color={t.onPrimary} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  pillHit: { minHeight: TAP, justifyContent: 'center' },
  pill: {
    height: 40,
    borderRadius: 25,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(247,242,236,0.14)',
  },
  pillInput: { flex: 1, color: brand.cream, fontFamily: fonts.body, fontSize: 16, paddingVertical: 0 },
  ringItem: { alignItems: 'center', gap: 6, minWidth: TAP },
  ring: { borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  thread: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 76, paddingVertical: 10 },
  threadRing: { borderWidth: 2, borderRadius: 30, padding: 2 },
  bubble: { maxWidth: '80%', borderRadius: BIG, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composerPill: { flex: 1, minHeight: TAP, maxHeight: 140, borderRadius: 25, borderWidth: 1.5, paddingHorizontal: 16, justifyContent: 'center' },
  composerInput: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, paddingTop: 10, paddingBottom: 10 },
  send: { width: TAP, height: TAP, borderRadius: TAP / 2, alignItems: 'center', justifyContent: 'center' },
});
