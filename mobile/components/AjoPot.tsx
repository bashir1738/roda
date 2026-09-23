import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, withRepeat, withSequence } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Path, Rect } from 'react-native-svg';
import { COLORS } from '../constants/theme';

interface AjoPotProps {
  fillPercent: number;
  size?: number;
  animated?: boolean;
}

export function AjoPot({ fillPercent, size = 120, animated = true }: AjoPotProps) {
  const fill = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    fill.value = withTiming(Math.max(0, Math.min(100, fillPercent)), {
      duration: animated ? 1200 : 0,
      easing: Easing.out(Easing.exp),
    });

    if (fillPercent >= 100) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulse.value = 1;
    }
  }, [fillPercent, animated]);

  const fillStyle = useAnimatedStyle(() => ({
    height: `${fill.value}%`,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const potW = size;
  const potH = size;

  return (
    <Animated.View style={[styles.container, { width: size, height: size }, pulseStyle]}>
      {/* Background SVG for the Pot Silhouette */}
      <Svg width={potW} height={potH} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="potGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COLORS.primary} stopOpacity="0.8" />
            <Stop offset="1" stopColor={COLORS.primary} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.0" />
          </LinearGradient>
        </Defs>
        
        {/* Pot Handle Left */}
        <Path d="M 15 45 C -5 45 -5 65 15 65" fill="none" stroke={COLORS.sage} strokeWidth="6" strokeLinecap="round" />
        
        {/* Pot Handle Right */}
        <Path d="M 85 45 C 105 45 105 65 85 65" fill="none" stroke={COLORS.sage} strokeWidth="6" strokeLinecap="round" />

        {/* Main Pot Body */}
        <Path 
          d="M 20 25 L 80 25 C 90 25 95 65 80 90 L 20 90 C 5 65 10 25 20 25 Z" 
          fill="url(#potGrad)" 
        />
        
        {/* Pot Rim */}
        <Rect x="15" y="15" width="70" height="12" rx="6" fill={COLORS.sage} />
        
        {/* Glass reflection */}
        <Path 
          d="M 25 30 L 50 30 C 50 30 45 85 25 85 Z" 
          fill="url(#glassGrad)" 
        />
      </Svg>

      {/* Fill Area - masked by the pot's shape */}
      <View style={[styles.fillMask, {
        width: potW * 0.7,
        height: potH * 0.65,
        bottom: potH * 0.1,
      }]}>
        <Animated.View style={[styles.fillLayer, fillStyle]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#A855F7' }]} />
        </Animated.View>
      </View>

      {/* Floating Coins */}
      {fillPercent > 25 && (
        <View style={[styles.coinsContainer, { bottom: potH * 0.8 }]}>
          {fillPercent > 75 && <Text style={styles.coin}>🪙</Text>}
          {fillPercent > 50 && <Text style={styles.coin}>🪙</Text>}
          <Text style={styles.coin}>🪙</Text>
        </View>
      )}

      {/* Glowing aura when 100% */}
      {fillPercent >= 100 && (
         <View style={[styles.aura, {
           width: size * 1.5,
           height: size * 1.5,
           borderRadius: size,
           backgroundColor: COLORS.primary,
         }]} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  fillMask: {
    position: 'absolute',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  fillLayer: {
    width: '100%',
    backgroundColor: COLORS.accent,
    opacity: 0.9,
  },
  coinsContainer: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 4,
    zIndex: 20,
  },
  coin: {
    fontSize: 24,
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  aura: {
    position: 'absolute',
    zIndex: -1,
    opacity: 0.15,
    bottom: -20,
  },
});
