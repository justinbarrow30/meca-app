import React, { useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";

const c = Colors.dark;

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = email.trim().includes("@") && password.length >= 1;

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await login(email.trim(), password);
      router.dismissAll();
      router.replace("/(tabs)/profile");
    } catch (err: any) {
      const msg = err?.message || "Login failed";
      if (msg.toLowerCase().includes("no account")) {
        setError("No account found with this email. Try creating one.");
      } else if (msg.toLowerCase().includes("invalid credentials")) {
        setError("Incorrect password. Please try again.");
      } else if (msg.toLowerCase().includes("password is required")) {
        setError("Please enter your password.");
      } else if (msg.toLowerCase().includes("email is required")) {
        setError("Please enter your email address.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { paddingTop: topInset + 16, paddingBottom: bottomInset + 24 }]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={c.text} />
        </Pressable>

        <Image
          source={require("@/assets/images/meca-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in with your email</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#E53E3E" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@email.com"
          placeholderTextColor={c.textTertiary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          blurOnSubmit={false}
        />

        <Text style={styles.inputLabel}>Password</Text>
        <TextInput
          ref={passwordRef}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          placeholderTextColor={c.textTertiary}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => { if (canSubmit && !loading) handleLogin(); }}
        />

        <Pressable
          style={[styles.primaryBtn, (!canSubmit || loading) && styles.primaryBtnDisabled]}
          onPress={handleLogin}
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.primaryBtnText}>Sign In</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </Pressable>

        <Pressable style={styles.forgotRow} onPress={() => router.push("/auth/forgot-password")}>
          <Text style={[styles.linkText, { color: c.accent, fontFamily: "Outfit_500Medium" }]}>Forgot your password?</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => { router.back(); router.push("/auth/signup"); }}>
          <Text style={styles.linkText}>Don't have an account?</Text>
          <Text style={[styles.linkText, { color: c.accent, fontFamily: "Outfit_600SemiBold" }]}> Create One</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-end",
  },
  logo: { width: 120, height: 48, alignSelf: "center", marginTop: 8, marginBottom: 32 },
  title: {
    fontSize: 26,
    fontFamily: "Outfit_700Bold",
    color: c.text,
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: c.textTertiary,
    textAlign: "center",
    marginBottom: 28,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: c.textSecondary,
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
    color: c.text,
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: c.accent,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
  forgotRow: { alignItems: "center", marginTop: 16 },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  linkText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: c.textTertiary,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: "#E53E3E",
    flex: 1,
  },
});
