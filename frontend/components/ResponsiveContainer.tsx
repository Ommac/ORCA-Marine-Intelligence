import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  maxWidth?: number;
}

/**
 * ResponsiveContainer
 * Constrains layout width on wide web/desktop viewports (preventing awkward stretching)
 * while providing fluid, full-width ergonomics on mobile devices.
 */
export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  style,
  maxWidth = 1100,
}) => {
  return (
    <View style={styles.outer}>
      <View style={[styles.inner, { maxWidth }, style]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    alignItems: 'center',
  },
  inner: {
    width: '100%',
  },
});
