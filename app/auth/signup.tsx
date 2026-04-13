import React, { useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";

const c = Colors.dark;
type RoleType = "player" | "coach" | "spectator";

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleType>("spectator");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      });
      router.dismissAll();
      router.replace("/(tabs)/profile");
    } catch (err: any) {
      const msg = err?.message || "Registration failed";
      if (msg.toLowerCase().includes("already exists")) {
        setError("An account with this email already exists. Try signing in instead.");
      } else if (msg.toLowerCase().includes("name and email")) {
        setError("Please fill in your name and email.");
      } else if (msg.toLowerCase().includes("password is required")) {
        setError("Please create a password.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const canContinueStep1 = name.trim().length >= 2 && email.trim().includes("@") && password.length >= 1;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topInset + 16, paddingBottom: bottomInset + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={c.text} />
        </Pressable>

        <Image
          source={require("@/assets/images/meca-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join the Meca community</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#E53E3E" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={c.textTertiary}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              blurOnSubmit={false}
            />

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              ref={emailRef}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor={c.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
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
              placeholder="Create a password"
              placeholderTextColor={c.textTertiary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={() => { if (canContinueStep1) setStep(2); }}
            />

            <Pressable
              style={[styles.primaryBtn, !canContinueStep1 && styles.primaryBtnDisabled]}
              onPress={() => canContinueStep1 && setStep(2)}
              disabled={!canContinueStep1}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>

            <Pressable style={styles.linkRow} onPress={() => { router.back(); router.push("/auth/signin"); }}>
              <Text style={styles.linkText}>Already have an account?</Text>
              <Text style={[styles.linkText, { color: c.accent, fontFamily: "Outfit_600SemiBold" }]}> Sign In</Text>
            </Pressable>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Your Role</Text>
            <Text style={styles.subtitle}>How will you use Meca?</Text>

            <View style={styles.roleGrid}>
              {([
                { key: "player" as const, icon: "person" as const, label: "Player", desc: "Compete in tournaments" },
                { key: "coach" as const, icon: "clipboard" as const, label: "Coach", desc: "Manage your team" },
                { key: "spectator" as const, icon: "eye" as const, label: "Spectator", desc: "Follow scores & rankings" },
              ]).map((r) => (
                <Pressable
                  key={r.key}
                  style={[styles.roleCard, role === r.key && styles.roleCardActive]}
                  onPress={() => setRole(r.key)}
                >
                  <View style={[styles.roleIconWrap, role === r.key && styles.roleIconWrapActive]}>
                    <Ionicons name={r.icon} size={22} color={role === r.key ? "#fff" : c.textTertiary} />
                  </View>
                  <Text style={[styles.roleCardLabel, role === r.key && { color: c.accent }]}>{r.label}</Text>
                  <Text style={styles.roleCardDesc}>{r.desc}</Text>
                </Pressable>
              ))}
            </View>

            {role === "coach" && (
              <View style={{ marginTop: 12, backgroundColor: c.accent + "08", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.accent + "20" }}>
                <Text style={{ fontSize: 13, fontFamily: "Outfit_500Medium", color: c.textSecondary, lineHeight: 18 }}>
                  After creating your account, visit your team's page and tap "Claim This Team" to link your profile. Coach claims require admin approval.
                </Text>
              </View>
            )}

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#E53E3E" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Create Account</Text>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </>
              )}
            </Pressable>

            <Pressable style={styles.secondaryBtn} onPress={() => setStep(1)}>
              <Ionicons name="arrow-back" size={18} color={c.textSecondary} />
              <Text style={styles.secondaryBtnText}>Back</Text>
            </Pressable>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 24, minHeight: "100%" as any },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-end",
  },
  logo: { width: 120, height: 48, alignSelf: "center", marginTop: 8, marginBottom: 24 },
  stepContainer: { flex: 1 },
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
  secondaryBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: c.textSecondary,
  },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
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
  roleGrid: { gap: 10, marginBottom: 8 },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.border,
    gap: 14,
  },
  roleCardActive: { borderColor: c.accent, backgroundColor: c.accent + "08" },
  roleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: c.border,
    justifyContent: "center",
    alignItems: "center",
  },
  roleIconWrapActive: { backgroundColor: c.accent },
  roleCardLabel: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    color: c.text,
  },
  roleCardDesc: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: c.textTertiary,
    position: "absolute",
    right: 16,
  },
});
