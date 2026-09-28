import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { brand } from '@/lib/theme';

/** The Grit & Grace crown. Same geometry as assets/crown.svg. */
export function CrownMark({ size = 64, color = brand.gold, jewel = brand.maroonDeep }: { size?: number; color?: string; jewel?: string }) {
  return (
    <Svg width={size} height={size} viewBox="200 250 624 520" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M232 640 L262 372 L392 510 L512 316 L632 510 L762 372 L792 640 Z" fill={color} />
      <Circle cx={262} cy={350} r={34} fill={color} />
      <Circle cx={512} cy={290} r={40} fill={color} />
      <Circle cx={762} cy={350} r={34} fill={color} />
      <Rect x={222} y={660} width={580} height={82} rx={16} fill={color} />
      <Circle cx={512} cy={701} r={20} fill={jewel} />
      <Circle cx={382} cy={701} r={13} fill={jewel} />
      <Circle cx={642} cy={701} r={13} fill={jewel} />
    </Svg>
  );
}
