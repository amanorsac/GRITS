import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { fonts, useTheme } from '@/lib/theme';

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'learn', title: 'Learn', icon: 'book-open-outline', iconActive: 'book-open-variant' },
  { name: 'court', title: 'Court', icon: 'account-group-outline', iconActive: 'account-group' },
  { name: 'live', title: 'Live', icon: 'video-outline', iconActive: 'video' },
  { name: 'me', title: 'Me', icon: 'account-circle-outline', iconActive: 'account-circle' },
];

export default function TabLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.tabActive,
        tabBarInactiveTintColor: t.tabInactive,
        tabBarStyle: {
          backgroundColor: t.tabBar,
          borderTopColor: t.tabBar,
          height: 64 + insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 13 },
        tabBarAllowFontScaling: false,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ color, focused }) => <Icon name={focused ? tab.iconActive : tab.icon} size={26} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
