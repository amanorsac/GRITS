import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * A light tap for meaningful commits only: a post or message sent, a reaction toggled,
 * a lesson marked done. Never for plain navigation. Silently does nothing where unsupported.
 */
export function commitHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}
