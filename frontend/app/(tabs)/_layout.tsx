import React from 'react';
import { Tabs } from 'expo-router';
import { BottomTabBar } from '../../components/BottomTabBar';
import { COLORS } from '../../constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: 'Ask ORCA',
        }}
      />
    </Tabs>
  );
}
