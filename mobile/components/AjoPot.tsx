import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { COLORS } from '../constants/theme';

interface AjoPotProps {
  fillPercent: number;
  size?: number;
  animated?: boolean;
}

const FILL_GRADIENT = '#A855F7';
const COIN_FACE = '#F5C542';
const COIN_EDGE = '#D99A12';

/** One rising coin — loops a float-up + fade, staggered by `index`. */
function FloatingCoin({
  index,
  coinSize,
  rise,
  enabled,
}: {
  index: number;
  coinSize: number;
  rise: number;
  enabled: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!enabled) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = withDelay(
      index * 380,
      withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [enabled, index, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = p < 0.12 ? p / 0.12 : p > 0.72 ? Math.max(0, (1 - p) / 0.28) : 1;
    return {
      opacity,
      transform: [{ translateY: -p * rise }, { scale: 0.7 + p * 0.35 }],
    };
  });

  const shape = (
    <Svg width={coinSize} height={coinSize}>
      <Circle cx={coinSize / 2} cy={coinSize / 2} r={coinSize / 2} fill={COIN_FACE} />
      <Circle
        cx={coinSize / 2}
        cy={coinSize / 2}
        r={coinSize / 2 - 3}
        fill="none"
        stroke={COIN_EDGE}
        strokeWidth={1.5}
      />
    </Svg>
  );

  if (!enabled) return <View style={styles.coin}>{shape}</View>;

  return <Animated.View style={[styles.coin, style]}>{shape}</Animated.View>;
}

export function AjoPot({ fillPercent, size = 120, animated = true }: AjoPotProps) {
  const fill = useSharedValue(0);
  const pulse = useSharedValue(1);
  const sweep = useSharedValue(0);
  const bob = useSharedValue(0);
  const aura = useSharedValue(0.12);

  const target = Math.max(0, Math.min(100, fillPercent));
  const isFull = target >= 100;

  useEffect(() => {
    fill.value = withTiming(target, {
      duration: animated ? 1200 : 0,
      easing: Easing.out(Easing.exp),
    });

    if (isFull && animated) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      aura.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.12, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      pulse.value = 1;
      aura.value = 0.12;
    }
    return () => {
      cancelAnimation(fill);
      cancelAnimation(pulse);
      cancelAnimation(aura);
    };
  }, [target, isFull, animated]);

  // Shimmer band sweeping across the liquid surface.
  useEffect(() => {
    if (!animated) {
      cancelAnimation(sweep);
      sweep.value = 0;
      return;
    }
    sweep.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }), -1, false);
    return () => cancelAnimation(sweep);
  }, [animated]);

  // Gentle bob of the liquid surface line.
  useEffect(() => {
    if (!animated) {
      cancelAnimation(bob);
      bob.value = 0;
      return;
    }
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(bob);
  }, [animated]);

  const fillStyle = useAnimatedStyle(() => ({ height: `${fill.value}%` }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const auraStyle = useAnimatedStyle(() => ({ opacity: aura.value }));
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: '16deg' }, { translateX: -size * 0.55 + sweep.value * size * 1.7 }],
  }));
  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (bob.value - 0.5) * 3 }],
  }));

  const potW = size;
  const potH = size;
  const coinSize = Math.max(16, Math.round(size * 0.24));
  const coinCount = target > 75 ? 3 : target > 50 ? 2 : target > 25 ? 1 : 0;

  return (
    <Animated.View style={[styles.container, { width: size, height: size }, pulseStyle]}>
      {isFull && (
        <Animated.View
          style={[
            styles.aura,
            auraStyle,
            { width: size * 1.5, height: size * 1.5, borderRadius: size, backgroundColor: COLORS.primary },
          ]}
        />
      )}

      {/* Pot silhouette */}
      <Svg width={potW} height={potH} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="potGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COLORS.primary} stopOpacity="0.8" />
            <Stop offset="1" stopColor={COLORS.primary} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <Path d="M 15 45 C -5 45 -5 65 15 65" fill="none" stroke={COLORS.sage} strokeWidth="6" strokeLinecap="round" />
        <Path d="M 85 45 C 105 45 105 65 85 65" fill="none" stroke={COLORS.sage} strokeWidth="6" strokeLinecap="round" />
        <Path d="M 20 25 L 80 25 C 90 25 95 65 80 90 L 20 90 C 5 65 10 25 20 25 Z" fill="url(#potGrad)" />
        <Rect x="15" y="15" width="70" height="12" rx="6" fill={COLORS.sage} />
        <Path d="M 25 30 L 50 30 C 50 30 45 85 25 85 Z" fill="url(#glassGrad)" />
      </Svg>

      {/* Liquid fill, masked by the pot's shape */}
      <View style={[styles.fillMask, { width: potW * 0.7, height: potH * 0.65, bottom: potH * 0.1 }]}>
        <Animated.View style={[styles.fillLayer, fillStyle]}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="ajoFillGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#C084FC" />
                <Stop offset="1" stopColor={FILL_GRADIENT} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#ajoFillGrad)" />
          </Svg>
          {/* Shimmer sweep + surface line */}
          <Animated.View style={[styles.shimmer, sweepStyle]} pointerEvents="none" />
          <Animated.View style={[styles.surface, surfaceStyle]} pointerEvents="none" />
        </Animated.View>
      </View>

      {/* Rising coins */}
      {coinCount > 0 && (
        <View style={[styles.coinsContainer, { bottom: potH * 0.82 }]} pointerEvents="none">
          {Array.from({ length: coinCount }).map((_, i) => (
            <FloatingCoin
              key={i}
              index={i}
              coinSize={coinSize}
              rise={size * 0.5}
              enabled={animated}
            />
          ))}
        </View>
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
    opacity: 0.9,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  surface: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  coinsContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    zIndex: 20,
  },
  coin: {
    shadowColor: '#F5C542',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
  aura: {
    position: 'absolute',
    zIndex: -1,
    bottom: -20,
  },
});
