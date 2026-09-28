import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/lib/theme';

export function ProgressBar({ value, color, track, label }: { value: number; color?: string; track?: string; label: string }) {
  const t = useTheme();
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={[styles.track, { backgroundColor: track ?? t.segmentRest }]}
    >
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color ?? t.status.progress.bar }]} />
    </View>
  );
}

export type Segment = 'done' | 'current' | 'rest';

/** One segment per lesson: done = green, current = pink, rest = grey. */
export function SegmentedBar({ segments, label }: { segments: Segment[]; label: string }) {
  const t = useTheme();
  return (
    <View accessible accessibilityLabel={label} style={styles.segments}>
      {segments.map((s, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            {
              backgroundColor: s === 'done' ? t.status.complete.bar : s === 'current' ? t.status.progress.bar : t.segmentRest,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 10, borderRadius: 3 },
});
