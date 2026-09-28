import { useColorScheme } from 'react-native';

/** "Raising Queens" brand palette. */
export const brand = {
  maroon: '#6E1028',
  maroonDeep: '#45091A',
  pink: '#D8397F',
  pinkBright: '#F065B0',
  pinkSoft: '#FBE3EE',
  gold: '#C9A227',
  cream: '#F7F2EC',
  ink: '#231017',
  white: '#FFFFFF',
} as const;

export type StatusKind = 'complete' | 'progress' | 'attention' | 'safety' | 'locked';

export type Palette = {
  scheme: 'light' | 'dark';
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  /** Maroon header / hero surfaces. */
  header: string;
  headerText: string;
  headerMuted: string;
  /** Primary action (buttons). */
  primary: string;
  onPrimary: string;
  /** Pink accent for active states and links. */
  accent: string;
  /** Pink-soft tinted cards (live, notices). */
  tint: string;
  onTint: string;
  gold: string;
  tabBar: string;
  tabActive: string;
  tabInactive: string;
  inputBg: string;
  /** Status: [background, foreground]. Foregrounds meet 4.5:1 on their background. */
  status: Record<StatusKind, { bg: string; fg: string; bar: string }>;
  segmentRest: string;
};

export const light: Palette = {
  scheme: 'light',
  bg: brand.cream,
  surface: brand.white,
  surfaceAlt: '#EFE6DD',
  border: '#E3D6CC',
  text: brand.ink,
  textMuted: '#5E4A53',
  header: brand.maroon,
  headerText: brand.cream,
  headerMuted: '#EBD3DB',
  primary: brand.maroon,
  onPrimary: brand.cream,
  accent: '#B8246A',
  tint: brand.pinkSoft,
  onTint: brand.maroonDeep,
  gold: brand.gold,
  tabBar: brand.maroonDeep,
  tabActive: brand.pinkBright,
  tabInactive: '#E6D2DA',
  inputBg: brand.white,
  status: {
    complete: { bg: '#DDF0E6', fg: '#1F5E43', bar: '#2E7D5B' },
    progress: { bg: brand.pinkSoft, fg: '#9E1D59', bar: brand.pink },
    attention: { bg: '#FBEBC8', fg: '#7A4E00', bar: '#C98A0B' },
    safety: { bg: '#F9DCDA', fg: '#9B1C14', bar: '#B3261E' },
    locked: { bg: '#ECE6E2', fg: '#5B5456', bar: '#B8AFAB' },
  },
  segmentRest: '#DCD2CB',
};

export const dark: Palette = {
  scheme: 'dark',
  bg: '#1A0A10',
  surface: '#2A1219',
  surfaceAlt: '#35171F',
  border: '#4A2530',
  text: brand.cream,
  textMuted: '#D3C2C8',
  header: brand.maroonDeep,
  headerText: brand.cream,
  headerMuted: '#E2CBD3',
  primary: brand.pinkBright,
  onPrimary: brand.maroonDeep,
  accent: brand.pinkBright,
  tint: '#3F1628',
  onTint: '#FBE3EE',
  gold: '#D9B443',
  tabBar: '#12060B',
  tabActive: brand.pinkBright,
  tabInactive: '#D9C5CD',
  inputBg: '#22101A',
  status: {
    complete: { bg: '#173A2B', fg: '#8FD9B5', bar: '#4CAF84' },
    progress: { bg: '#3F1628', fg: '#F6A3CC', bar: brand.pinkBright },
    attention: { bg: '#3D2C08', fg: '#F2C765', bar: '#E0A526' },
    safety: { bg: '#3F1412', fg: '#F4A29B', bar: '#E0544A' },
    locked: { bg: '#2E2528', fg: '#C9BFC2', bar: '#6D6266' },
  },
  segmentRest: '#4A3A40',
};

export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  body: 'Archivo_400Regular',
  bodyMedium: 'Archivo_500Medium',
  bodySemi: 'Archivo_600SemiBold',
  bodyBold: 'Archivo_700Bold',
} as const;

export const radius = 10;
export const space = (n: number) => n * 4;
/** Minimum tap target. */
export const TAP = 44;

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
