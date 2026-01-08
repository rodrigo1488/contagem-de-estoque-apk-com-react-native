import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="leitura"
        options={{
          title: 'Coleta',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="barcode.viewfinder" color={color} />,
        }}
      />
      <Tabs.Screen
        name="listagem"
        options={{
          title: 'Listagem',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.bullet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="configuracoes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gear" color={color} />,
        }}
      />
      {/* 
        The 'index' route is required by Expo Router as the default entry point for a folder.
        We can either create an index.tsx that redirects, OR we can rename 'leitura.tsx' to 'index.tsx'.
        For now, let's just make 'leitura' the initial route if possible, or add a redirect.
        Actually, we MUST have an index.tsx or _layout must handle the default.
        However, let's keep the user's files and see if it works, usually Expo redirects to first tab if no index.
        Wait, if index.tsx is missing, deep linking to / will fail.
        Better approach: Redirect.
      */}
    </Tabs>
  );
}
