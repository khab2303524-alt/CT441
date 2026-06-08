import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          height: 70,
          paddingBottom: 12, // Tăng nhẹ để text cân đối hơn
          paddingTop: 8,
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          elevation: 5, // Thêm đổ bóng nhẹ cho Android (tùy chọn)
          shadowColor: '#000000', // Thêm đổ bóng nhẹ cho iOS (tùy chọn)
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
        },

        tabBarActiveTintColor: '#1F5CA9', 
        tabBarInactiveTintColor: '#000000', 
        
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hẹn giờ',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="alarm.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="clock"
        options={{
          title: 'Đồng hồ',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="clock.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}