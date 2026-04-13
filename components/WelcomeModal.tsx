import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  Pressable,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  runOnJS,
  interpolate,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import Colors from "@/constants/colors";

const { width, height } = Dimensions.get("window");
const STORAGE_KEY = "@meca_welcomed";

interface WelcomeModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function WelcomeModal({ visible, onDismiss }: WelcomeModalProps) {
  const router = useRouter();
  const opacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(40);
  const cardScale = useSharedValue(0.92);
  const logoOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
      logoOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
      cardTranslateY.value = withDelay(100, withSpring(0, { damping: 16, stiffness: 90 }));
      cardScale.value = withDelay(100, withSpring(1, { damping: 14, stiffness: 100 }));
      buttonsOpacity.value = withDelay(500, withTiming(1, { duration: 400 }));
    }
  }, [visible]);

  const dismiss = useCallback(async (navigateToSignup?: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, "true");
    } catch {}
    opacity.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) {
        runOnJS(onDismiss)();
        if (navigateToSignup) {
          runOnJS(router.push)("/auth/signup" as any);
        }
      }
    });
  }, [onDismiss, router]);

  const handleGuest = useCallback(() => {
    dismiss();
  }, [dismiss]);

  const handleCreateAccount = useCallback(() => {
    dismiss(true);
  }, [dismiss]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: cardTranslateY.value },
      { scale: cardScale.value },
    ],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, containerStyle]}>
      <Animated.View style={[styles.card, cardStyle]}>
        <Animated.View style={[styles.logoContainer, logoStyle]}>
          <Image
            source={require("@/assets/images/meca-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Welcome to Meca</Text>
          <Text style={styles.subtitle}>
            Your home for competitive 7v7 football tournaments, rankings, and stats.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.buttonsContainer, buttonsStyle]}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
            onPress={handleGuest}
          >
            <Text style={styles.primaryButtonText}>Continue as Guest</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
            onPress={handleCreateAccount}
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

export async function shouldShowWelcome(): Promise<boolean> {
  try {
    const welcomed = await AsyncStorage.getItem(STORAGE_KEY);
    return welcomed !== "true";
  } catch {
    return true;
  }
}

const colors = Colors.dark;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 14, 26, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9998,
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: "#5B7AFF",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
    borderRadius: 24,
  },
  title: {
    fontFamily: "Outfit_700Bold",
    fontSize: 26,
    color: colors.text,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  buttonsContainer: {
    width: "100%",
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonPressed: {
    backgroundColor: colors.accentLight,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonPressed: {
    backgroundColor: colors.surfaceElevated,
    transform: [{ scale: 0.98 }],
  },
  secondaryButtonText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 16,
    color: colors.text,
  },
});
