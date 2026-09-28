import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { fonts, radius, TAP, useTheme } from '@/lib/theme';

import { Txt } from './Txt';

type Props = TextInputProps & { label: string; hint?: string; error?: string | null };

export function Field({ label, hint, error, multiline, style, ...rest }: Props) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="label">{label}</Txt>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={t.textMuted}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxFontSizeMultiplier={1.6}
        {...rest}
        style={[
          {
            minHeight: multiline ? 120 : TAP + 6,
            borderWidth: 1.5,
            borderColor: error ? t.status.safety.fg : focused ? t.accent : t.border,
            borderRadius: radius,
            backgroundColor: t.inputBg,
            color: t.text,
            fontFamily: fonts.body,
            fontSize: 16,
            paddingHorizontal: 14,
            paddingVertical: 12,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
      />
      {error ? (
        <Txt variant="meta" color={t.status.safety.fg} accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="meta" muted>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}
