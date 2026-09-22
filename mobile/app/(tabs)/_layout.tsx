import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const ACTIVE   = '#421F6D';
const INACTIVE = '#6B6B6B';

function TabIcon({
  iconActive, iconInactive, label, focused,
}: { iconActive: IoniconsName; iconInactive: IoniconsName; label: string; focused: boolean }) {
  const color = focused ? ACTIVE : INACTIVE;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 3, width: 72 }}>
      <Ionicons name={focused ? iconActive : iconInactive} size={24} color={color} />
      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  // Content height (icon + label + padding) + system bottom inset.
  // This handles iOS home indicator, Android 3-button nav, and gesture nav correctly.
  const TAB_CONTENT_H = 56;
  const tabBarHeight  = TAB_CONTENT_H + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarItemStyle: { height: TAB_CONTENT_H, justifyContent: 'center' },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          elevation: 0,
          borderTopColor: 'rgba(0,0,0,0.1)',
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: insets.bottom,
        },
        tabBarBackground: () => (
          <BlurView tint="default" intensity={80} style={StyleSheet.absoluteFill} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon iconActive="home" iconInactive="home-outline" label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="circles"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon iconActive="people-circle" iconInactive="people-circle-outline" label="Circles" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="save"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon iconActive="leaf" iconInactive="leaf-outline" label="Save" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon iconActive="wallet" iconInactive="wallet-outline" label="Wallet" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
