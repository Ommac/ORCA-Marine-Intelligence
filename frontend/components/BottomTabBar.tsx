import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Home, Map, Bell, MessageSquareQuote } from 'lucide-react-native';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/theme';

export interface CustomBottomTabBarProps {
  state: {
    index: number;
    routes: Array<{
      key: string;
      name: string;
      params?: any;
    }>;
  };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        tabBarLabel?: any;
        tabBarAccessibilityLabel?: string;
        tabBarTestID?: string;
      };
    }
  >;
  navigation: {
    emit: (options: any) => any;
    navigate: (name: string, params?: any) => void;
  };
  insets?: any;
}

export const BottomTabBar: React.FC<CustomBottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const getTabIcon = (name: string, isFocused: boolean) => {
    const color = isFocused ? COLORS.oceanBlue : COLORS.textSecondary;
    const size = 24;
    const strokeWidth = isFocused ? 2.6 : 2.0;

    switch (name) {
      case 'index':
        return <Home size={size} color={color} strokeWidth={strokeWidth} />;
      case 'map':
        return <Map size={size} color={color} strokeWidth={strokeWidth} />;
      case 'alerts':
        return <Bell size={size} color={color} strokeWidth={strokeWidth} />;
      case 'ask':
        return <MessageSquareQuote size={size} color={color} strokeWidth={strokeWidth} />;
      default:
        return <Home size={size} color={color} strokeWidth={strokeWidth} />;
    }
  };

  const getTabLabel = (name: string) => {
    switch (name) {
      case 'index':
        return 'Home';
      case 'map':
        return 'Map';
      case 'alerts':
        return 'Alerts';
      case 'ask':
        return 'Ask ORCA';
      default:
        return name;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {state.routes.map((route, index: number) => {
          const descriptor = descriptors[route.key];
          const options = descriptor?.options || {};
          const isFocused = state.index === index;
          const rawLabel = options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : getTabLabel(route.name);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event?.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              style={[
                styles.tabItem,
                isFocused && styles.tabItemActive,
              ]}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, isFocused && styles.iconWrapperActive]}>
                {getTabIcon(route.name, isFocused)}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isFocused ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
                numberOfLines={1}
              >
                {typeof rawLabel === 'string' ? rawLabel : getTabLabel(route.name)}
              </Text>
              {isFocused && <View style={styles.activePill} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: 8,
    ...SHADOWS.md,
  },
  tabBar: {
    flexDirection: 'row',
    height: 64,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.sm,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 12,
    position: 'relative',
  },
  tabItemActive: {
    backgroundColor: '#F0F9FF',
  },
  iconWrapper: {
    marginBottom: 2,
  },
  iconWrapperActive: {
    transform: [{ scale: 1.05 }],
  },
  tabLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
  },
  tabLabelActive: {
    color: COLORS.oceanBlue,
    fontWeight: '800',
  },
  tabLabelInactive: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  activePill: {
    position: 'absolute',
    bottom: 2,
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.oceanBlue,
  },
});
