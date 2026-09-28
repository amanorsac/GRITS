import { forwardRef } from 'react';
import { Pressable, StyleSheet, type GestureResponderEvent, type PressableProps, type StyleProp, type View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Critically damped: settles without overshoot. */
const RELEASE = { duration: 300, dampingRatio: 1 } as const;
const PRESS_IN = { duration: 70 } as const;

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale while held. 0.97 for buttons and rows; cards can go a touch less. */
  scaleTo?: number;
};

/**
 * Apple-style press feedback: shrinks almost instantly on pointer-down and springs back on release.
 * With Reduce Motion on there is no scale — a quick dim instead.
 */
export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  { style, scaleTo = 0.97, onPressIn, onPressOut, disabled, ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const dim = useSharedValue(1);

  // Keep any opacity the caller set (e.g. a disabled button) and dim relative to it.
  const raw = StyleSheet.flatten(style)?.opacity;
  const baseOpacity = typeof raw === 'number' ? raw : 1;
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: baseOpacity * dim.value }));

  function pressIn(e: GestureResponderEvent) {
    if (reduce) dim.value = 0.75;
    else scale.value = withTiming(scaleTo, PRESS_IN);
    onPressIn?.(e);
  }
  function pressOut(e: GestureResponderEvent) {
    if (reduce) dim.value = 1;
    else scale.value = withSpring(1, RELEASE);
    onPressOut?.(e);
  }

  return (
    <AnimatedPressable
      ref={ref}
      {...rest}
      disabled={disabled}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[style, animated]}
    />
  );
});
