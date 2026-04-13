import React from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  Linking,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";

const c = Colors.dark;

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topInset + 16, paddingBottom: bottomInset + 24 }]}>
      <Pressable style={styles.closeBtn} onPress={() => router.back()}>
        <Ionicons name="close" size={24} color={c.text} />
      </Pressable>

      <Image
        source={require("@/assets/images/meca-logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed-outline" size={48} color={c.accent} />
        </View>

        <Text style={styles.title}>Reset Your Password</Text>
        <Text style={styles.subtitle}>
          To reset your password, please contact our admin team and we'll get you back into your account.
        </Text>

        <Pressable
          style={styles.contactBtn}
          onPress={() => Linking.openURL("mailto:admin@mecasports.net?subject=Password%20Reset%20Request")}
        >
          <Ionicons name="mail-outline" size={20} color="#fff" />
          <Text style={styles.contactBtnText}>Email admin@mecasports.net</Text>
        </Pressable>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={c.accent} />
          <Text style={styles.infoText}>
            Include your account email in the message and we'll send you a new password within 24 hours.
          </Text>
        </View>
      </View>

      <Pressable style={styles.linkRow} onPress={() => router.back()}>
        <Text style={styles.linkText}>Remember your password?</Text>
        <Text style={[styles.linkText, { color: c.accent, fontFamily: "Outfit_600SemiBold" }]}> Sign In</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, paddingHorizontal: 24 },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface,
    justifyContent: "center", alignItems: "center", alignSelf: "flex-end",
  },
  logo: { width: 120, height: 48, alignSelf: "center", marginTop: 8, marginBottom: 32 },
  content: { flex: 1, justifyContent: "center", alignItems: "center", marginTop: -40 },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: c.accent + "14",
    justifyContent: "center", alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 26, fontFamily: "Outfit_700Bold", color: c.text,
    textAlign: "center", marginBottom: 8,
  },
  subtitle: {
    fontSize: 15, fontFamily: "Outfit_400Regular", color: c.textSecondary,
    textAlign: "center", marginBottom: 28, lineHeight: 22, paddingHorizontal: 12,
  },
  contactBtn: {
    backgroundColor: c.accent, borderRadius: 14, paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    gap: 10, width: "100%",
  },
  contactBtnText: { fontSize: 16, fontFamily: "Outfit_600SemiBold", color: "#fff" },
  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: c.accent + "0A", borderWidth: 1, borderColor: c.accent + "20",
    borderRadius: 12, padding: 14, marginTop: 20, width: "100%",
  },
  infoText: {
    fontSize: 13, fontFamily: "Outfit_400Regular", color: c.textSecondary,
    flex: 1, lineHeight: 18,
  },
  linkRow: { flexDirection: "row", justifyContent: "center", marginBottom: 12 },
  linkText: { fontSize: 14, fontFamily: "Outfit_400Regular", color: c.textTertiary },
});
