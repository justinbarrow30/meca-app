import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";

const c = Colors.dark;
const SCREEN_WIDTH = Dimensions.get("window").width;

interface AuthGateModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function AuthGateModal({ visible, onClose, onComplete }: AuthGateModalProps) {
  const { user } = useAuth();
  const wasGuestRef = useRef(!user);

  useEffect(() => {
    if (wasGuestRef.current && user && visible) {
      onClose();
      onComplete?.();
    }
    wasGuestRef.current = !user;
  }, [user, visible, onClose, onComplete]);

  const handleCreateAccount = () => {
    onClose();
    router.push("/auth/signup" as any);
  };

  const handleSignIn = () => {
    onClose();
    router.push("/auth/signin" as any);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" testID="auth-gate-modal">
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.iconWrap}>
            <LinearGradient
              colors={["#5B7AFF", "#4460E6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconCircle}
            >
              <Ionicons name="lock-closed" size={28} color="#fff" />
            </LinearGradient>
          </View>
          <Text style={styles.title}>Create a free account to unlock this feature.</Text>
          <Pressable style={styles.primaryBtn} onPress={handleCreateAccount}>
            <Text style={styles.primaryBtnText}>Create Account</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={handleSignIn}>
            <Text style={styles.secondaryBtnText}>Already have an account? Sign In</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: c.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 12,
    alignItems: "center" as const,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    marginBottom: 24,
  },
  iconWrap: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  title: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: c.text,
    textAlign: "center" as const,
    marginBottom: 28,
    lineHeight: 26,
    maxWidth: SCREEN_WIDTH * 0.75,
  },
  primaryBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: c.accent,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: "100%" as const,
    gap: 8,
    marginBottom: 16,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#fff",
  },
  secondaryBtn: {
    paddingVertical: 8,
  },
  secondaryBtnText: {
    fontSize: 14,
    color: c.accent,
    fontWeight: "500" as const,
  },
});
