import React, { useEffect } from "react";
import { View, Image, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withSpring,
  Easing,
  runOnJS,
  interpolate,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

interface SplashLoaderProps {
  onFinish: () => void;
}

export function SplashLoader({ onFinish }: SplashLoaderProps) {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.3);
  const logoTranslateY = useSharedValue(30);
  const shimmerProgress = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const ringScale = useSharedValue(0.6);
  const ringOpacity = useSharedValue(0);
  const ring2Scale = useSharedValue(0.5);
  const ring2Opacity = useSharedValue(0);
  const containerOpacity = useSharedValue(1);
  const bgGlow = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    logoScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 100, mass: 0.8 }));
    logoTranslateY.value = withDelay(200, withSpring(0, { damping: 14, stiffness: 90 }));

    bgGlow.value = withDelay(400, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }));

    shimmerProgress.value = withDelay(
      700,
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
    );

    pulseScale.value = withDelay(
      1200,
      withSequence(
        withSpring(1.06, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 10, stiffness: 150 })
      )
    );

    ringOpacity.value = withDelay(600, withTiming(0.5, { duration: 400 }));
    ringScale.value = withDelay(600, withTiming(2.2, { duration: 1200, easing: Easing.out(Easing.cubic) }));
    ringOpacity.value = withDelay(600,
      withSequence(
        withTiming(0.4, { duration: 400 }),
        withDelay(400, withTiming(0, { duration: 400 }))
      )
    );

    ring2Opacity.value = withDelay(900, withTiming(0.3, { duration: 400 }));
    ring2Scale.value = withDelay(900, withTiming(2.8, { duration: 1400, easing: Easing.out(Easing.cubic) }));
    ring2Opacity.value = withDelay(900,
      withSequence(
        withTiming(0.3, { duration: 400 }),
        withDelay(500, withTiming(0, { duration: 500 }))
      )
    );

    containerOpacity.value = withDelay(
      2400,
      withTiming(0, { duration: 500, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) {
          runOnJS(onFinish)();
        }
      })
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { scale: logoScale.value * pulseScale.value },
      { translateY: logoTranslateY.value },
    ],
  }));

  const shimmerStyle = useAnimatedStyle(() => {
    const translateX = interpolate(shimmerProgress.value, [0, 1], [-width, width]);
    return {
      opacity: shimmerProgress.value > 0 && shimmerProgress.value < 1 ? 0.6 : 0,
      transform: [{ translateX }],
    };
  });

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: ring2Opacity.value,
    transform: [{ scale: ring2Scale.value }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const bgGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bgGlow.value, [0, 1], [0, 0.12]),
    transform: [{ scale: interpolate(bgGlow.value, [0, 1], [0.5, 1]) }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={styles.bg} />

      <Animated.View style={[styles.bgGlow, bgGlowStyle]} />

      <Animated.View style={[styles.ring, ringStyle]} />
      <Animated.View style={[styles.ring, ring2Style]} />

      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Image
          source={require("@/assets/images/splash-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Animated.View style={[styles.shimmer, shimmerStyle]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0A0E1A",
    zIndex: 9999,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0A0E1A",
  },
  bgGlow: {
    position: "absolute",
    width: width * 1.6,
    height: width * 1.6,
    borderRadius: width * 0.8,
    backgroundColor: "#3366FF",
  },
  ring: {
    position: "absolute",
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: width * 0.25,
    borderWidth: 2,
    borderColor: "rgba(79, 106, 246, 0.6)",
    backgroundColor: "transparent",
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logo: {
    width: width * 0.7,
    height: width * 0.28,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    transform: [{ skewX: "-20deg" }],
  },
});
