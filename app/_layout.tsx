import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useCallback } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SplashLoader } from "@/components/SplashLoader";
import { WelcomeModal, shouldShowWelcome } from "@/components/WelcomeModal";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/lib/auth-context";
import { StatusBar } from "expo-status-bar";
import { useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from "@expo-google-fonts/outfit";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back", headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="tournament/[id]" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="team/[id]" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="player/[id]" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="bracket/[id]" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="notifications" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="auth/signup" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="auth/signin" options={{ headerShown: false, presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });
  const [showSplash, setShowSplash] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
    shouldShowWelcome().then((show) => {
      if (show) setShowWelcome(true);
    });
  }, []);

  const handleWelcomeDismiss = useCallback(() => {
    setShowWelcome(false);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0A0E1A" }}>
            <KeyboardProvider>
              <StatusBar style="light" />
              {(fontsLoaded || fontError) && <RootLayoutNav />}
              {showSplash && <SplashLoader onFinish={handleSplashFinish} />}
              {showWelcome && <WelcomeModal visible={showWelcome} onDismiss={handleWelcomeDismiss} />}
            </KeyboardProvider>
          </GestureHandlerRootView>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
