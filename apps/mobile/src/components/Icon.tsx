import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Drawn interface icons. Decorative by default; give the parent control the accessibility label. */
export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: ColorValue }) {
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

export const iconFont = MaterialCommunityIcons.font;
