import React, { useState } from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { useFollowCheck, useFollow, useUnfollow } from "@/lib/api-hooks";
import AuthGateModal from "@/components/AuthGateModal";

const c = Colors.dark;

export default function FollowButton({
  targetType,
  targetId,
}: {
  targetType: "player" | "team" | "tournament";
  targetId: string;
}) {
  const { user } = useAuth();
  const [showAuthGate, setShowAuthGate] = useState(false);
  const { data, isLoading } = useFollowCheck(user ? targetType : "", user ? targetId : "");
  const followMutation = useFollow();
  const unfollowMutation = useUnfollow();

  const isFollowing = data?.following ?? false;
  const isMutating = followMutation.isPending || unfollowMutation.isPending;

  const handlePress = () => {
    if (!user) {
      setShowAuthGate(true);
      return;
    }
    if (isFollowing) {
      unfollowMutation.mutate({ targetType, targetId });
    } else {
      followMutation.mutate({ targetType, targetId });
    }
  };

  if (isLoading && user) {
    return <ActivityIndicator size="small" color={c.accent} style={styles.loader} />;
  }

  return (
    <>
      <Pressable
        style={[styles.btn, isFollowing && styles.btnFollowing]}
        onPress={handlePress}
        disabled={isMutating}
      >
        <Ionicons
          name={isFollowing ? "heart" : "heart-outline"}
          size={16}
          color={isFollowing ? "#E8272C" : c.accent}
        />
        <Text style={[styles.text, isFollowing && styles.textFollowing]}>
          {isMutating ? "..." : isFollowing ? "Following" : "Follow"}
        </Text>
      </Pressable>
      <AuthGateModal visible={showAuthGate} onClose={() => setShowAuthGate(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  btnFollowing: {
    borderColor: "rgba(232,39,44,0.3)",
    backgroundColor: "rgba(232,39,44,0.08)",
  },
  text: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: c.accent,
  },
  textFollowing: {
    color: "#E8272C",
  },
  loader: {
    marginLeft: 8,
  },
});
