import React, { useMemo, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Linking,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Share,
  Image,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import {
  usePlayer,
  useTeams,
  usePlayerExternalLinks,
} from "@/lib/api-hooks";
import FollowButton from "@/components/FollowButton";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { Team, PlayerExternalLink } from "@/lib/types";

const c = Colors.dark;
const SCREEN_WIDTH = Dimensions.get("window").width;

function getPlatformIcon(platform: string): { name: string; color: string } {
  switch (platform.toLowerCase()) {
    case "hudl": return { name: "play-circle", color: "#FF6B35" };
    case "instagram": return { name: "logo-instagram", color: "#E1306C" };
    case "twitter": case "x": return { name: "logo-twitter", color: "#1DA1F2" };
    case "youtube": return { name: "logo-youtube", color: "#FF0000" };
    default: return { name: "link-outline", color: c.accent };
  }
}

function safeOpenURL(url: string) {
  let finalUrl = url;
  if (!/^https?:\/\//i.test(finalUrl) && !finalUrl.startsWith("mailto:")) {
    finalUrl = "https://" + finalUrl;
  }
  Linking.openURL(finalUrl).catch(() => {
    Alert.alert("Cannot Open Link", "The URL could not be opened. Please check that it's a valid link.");
  });
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ExternalLinkCard({ link, canEdit, onEdit, onDelete }: {
  link: PlayerExternalLink;
  canEdit?: boolean;
  onEdit?: (link: PlayerExternalLink) => void;
  onDelete?: (linkId: string) => void;
}) {
  const iconInfo = getPlatformIcon(link.platform);
  const hasPreview = link.ogTitle || link.ogDescription || link.ogImage;
  const domain = getDomain(link.url);

  const handleDelete = () => {
    Alert.alert("Delete Link", "Are you sure you want to delete this link?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete?.(link.id) },
    ]);
  };

  const editDeleteIcons = canEdit ? (
    <View style={styles.linkEditActions}>
      <Pressable onPress={() => onEdit?.(link)} hitSlop={8}>
        <Ionicons name="pencil" size={15} color={c.textSecondary} />
      </Pressable>
      <Pressable onPress={handleDelete} hitSlop={8}>
        <Ionicons name="trash-outline" size={15} color="#E05252" />
      </Pressable>
    </View>
  ) : null;

  if (hasPreview) {
    return (
      <Pressable style={styles.linkPreviewCard} onPress={() => safeOpenURL(link.url)}>
        <View>
          {link.ogImage ? (
            <Image
              source={{ uri: link.ogImage }}
              style={styles.linkPreviewImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={[iconInfo.color + "20", iconInfo.color + "08"]}
              style={styles.linkPreviewPlaceholder}
            >
              <Ionicons name={iconInfo.name as any} size={32} color={iconInfo.color} />
            </LinearGradient>
          )}
          {editDeleteIcons ? (
            <View style={styles.linkEditOverlay}>{editDeleteIcons}</View>
          ) : null}
        </View>
        <View style={styles.linkPreviewBody}>
          <View style={styles.linkPreviewDomainRow}>
            <Ionicons name={iconInfo.name as any} size={12} color={iconInfo.color} />
            <Text style={styles.linkPreviewDomain} numberOfLines={1}>{domain}</Text>
          </View>
          {link.ogTitle ? (
            <Text style={styles.linkPreviewTitle} numberOfLines={2}>{link.ogTitle}</Text>
          ) : null}
          {link.ogDescription ? (
            <Text style={styles.linkPreviewDesc} numberOfLines={2}>{link.ogDescription}</Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.linkCard} onPress={() => safeOpenURL(link.url)}>
      <View style={[styles.linkIcon, { backgroundColor: iconInfo.color + "18" }]}>
        <Ionicons name={iconInfo.name as any} size={20} color={iconInfo.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.linkPlatform}>{link.platform}</Text>
        <Text style={styles.linkLabel} numberOfLines={1}>{domain}</Text>
      </View>
      <Ionicons name="open-outline" size={16} color={c.textTertiary} />
      {editDeleteIcons}
    </Pressable>
  );
}

function AddLinkModal({ playerId, visible, onClose }: {
  playerId: string; visible: boolean; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [platform, setPlatform] = useState("Hudl");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const platforms = ["Hudl", "Instagram", "Twitter", "YouTube", "Other"];

  const handleSave = async () => {
    if (!url.trim()) {
      Alert.alert("Required", "Please enter a URL");
      return;
    }
    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = "https://" + finalUrl;
    setSaving(true);
    try {
      await apiRequest("POST", `/api/players/${playerId}/external-links`, {
        platform,
        url: finalUrl,
        label: label.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/players", playerId, "external-links"] });
      setUrl("");
      setLabel("");
      onClose();
    } catch (err) {
      Alert.alert("Error", "Failed to add link");
    }
    setSaving(false);
  };

  const labelRef = React.useRef<TextInput>(null);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Link</Text>
              <Pressable onPress={onClose}>
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Platform</Text>
            <View style={styles.platformRow}>
              {platforms.map((p) => (
                <Pressable
                  key={p}
                  style={[styles.platformChip, platform === p && styles.platformChipActive]}
                  onPress={() => setPlatform(p)}
                >
                  <Text style={[
                    styles.platformChipText,
                    platform === p && styles.platformChipTextActive
                  ]}>{p}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor={c.textTertiary}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
              returnKeyType="next"
              onSubmitEditing={() => labelRef.current?.focus()}
              blurOnSubmit={false}
            />

            <Text style={styles.inputLabel}>Display Name (optional)</Text>
            <TextInput
              ref={labelRef}
              style={styles.input}
              placeholder="My highlight reel"
              placeholderTextColor={c.textTertiary}
              value={label}
              onChangeText={setLabel}
              returnKeyType="go"
              onSubmitEditing={() => { if (url.trim() && !saving) handleSave(); }}
            />

            <Pressable
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Add Link</Text>
            )}
          </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function EditLinkModal({ playerId, link, visible, onClose }: {
  playerId: string; link: PlayerExternalLink | null; visible: boolean; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [platform, setPlatform] = useState(link?.platform || "Hudl");
  const [url, setUrl] = useState(link?.url || "");
  const [label, setLabel] = useState(link?.label || "");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (link) {
      setPlatform(link.platform || "Hudl");
      setUrl(link.url || "");
      setLabel(link.label || "");
    }
  }, [link]);

  const platforms = ["Hudl", "Instagram", "Twitter", "YouTube", "Other"];

  const handleSave = async () => {
    if (!url.trim() || !link) {
      Alert.alert("Required", "Please enter a URL");
      return;
    }
    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = "https://" + finalUrl;
    setSaving(true);
    try {
      await apiRequest("PUT", `/api/players/${playerId}/external-links/${link.id}`, {
        platform,
        url: finalUrl,
        label: label.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/players", playerId, "external-links"] });
      onClose();
    } catch (err) {
      Alert.alert("Error", "Failed to update link");
    }
    setSaving(false);
  };

  const labelRef = React.useRef<TextInput>(null);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Link</Text>
              <Pressable onPress={onClose}>
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Platform</Text>
            <View style={styles.platformRow}>
              {platforms.map((p) => (
                <Pressable
                  key={p}
                  style={[styles.platformChip, platform === p && styles.platformChipActive]}
                  onPress={() => setPlatform(p)}
                >
                  <Text style={[
                    styles.platformChipText,
                    platform === p && styles.platformChipTextActive
                  ]}>{p}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor={c.textTertiary}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
              returnKeyType="next"
              onSubmitEditing={() => labelRef.current?.focus()}
              blurOnSubmit={false}
            />

            <Text style={styles.inputLabel}>Display Name (optional)</Text>
            <TextInput
              ref={labelRef}
              style={styles.input}
              placeholder="My highlight reel"
              placeholderTextColor={c.textTertiary}
              value={label}
              onChangeText={setLabel}
              returnKeyType="go"
              onSubmitEditing={() => { if (url.trim() && !saving) handleSave(); }}
            />

            <Pressable
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const { user, isGuest } = useAuth();

  const queryClient = useQueryClient();

  const { data: player, isLoading: playerLoading } = usePlayer(id || "");
  const { data: teams = [], isLoading: teamsLoading } = useTeams();
  const { data: externalLinks = [] } = usePlayerExternalLinks(id || "");

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingLink, setEditingLink] = useState<PlayerExternalLink | null>(null);

  const handleDeleteLink = useCallback(async (linkId: string) => {
    try {
      await apiRequest("DELETE", `/api/players/${id}/external-links/${linkId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/players", id, "external-links"] });
    } catch (err) {
      Alert.alert("Error", "Failed to delete link");
    }
  }, [id, queryClient]);

  const isLoading = playerLoading || teamsLoading;

  const isOwner = user?.playerId === id;
  const isAdmin = user?.role === "admin";
  const canEdit = (isOwner && !isGuest) || isAdmin;

  const teamsMap = useMemo(() => {
    const map = new Map<string, Team>();
    teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [teams]);

  const handleShareProfile = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const profileUrl = `${baseUrl}player/${id}`;
      await Share.share({
        message: `Check out ${player?.name}'s player profile on Meca: ${profileUrl}`,
        url: profileUrl,
      });
    } catch (err) {
      // user cancelled
    }
  }, [id, player?.name]);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#5B7AFF" />
      </View>
    );
  }

  if (!player) {
    return (
      <View style={[styles.container, { paddingTop: topInset + 12 }]}>
        <View style={{ paddingHorizontal: 16 }}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </Pressable>
        </View>
        <View style={styles.empty}>
          <Ionicons name="person-outline" size={40} color={c.textTertiary} />
          <Text style={styles.emptyText}>Player not found</Text>
        </View>
      </View>
    );
  }

  const team = teamsMap.get(player.teamId);
  const initials = player.name.split(" ").map((n) => n[0]).join("");

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </Pressable>
          <FollowButton targetType="player" targetId={id as string} />
        </View>

        <LinearGradient
          colors={["#5B7AFF", "#4460E6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.profileCard}
        >
          <View style={styles.avatarBlock}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.numberBadge}>
              <Text style={styles.numberText}>#{player.number}</Text>
            </View>
          </View>

          <Text style={styles.playerName}>{player.name}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.infoBadge}>
              <Text style={styles.infoBadgeText}>{player.position}</Text>
            </View>
            {team && (
              <Pressable
                style={[styles.infoBadge, { backgroundColor: "rgba(255,217,61,0.25)" }]}
                onPress={() => router.push({ pathname: "/team/[id]", params: { id: team.id } })}
              >
                <Text style={[styles.infoBadgeText, { color: "#FFD93D" }]}>{team.name}</Text>
              </Pressable>
            )}
          </View>
        </LinearGradient>

        {/* ─── EXTERNAL LINKS SECTION ─── */}
        {(externalLinks.length > 0 || canEdit) ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="share-social" size={16} color={c.accent} />
              <Text style={styles.sectionTitle}>Social Media</Text>
              {canEdit ? (
                <Pressable style={styles.addBtn} onPress={() => setShowLinkModal(true)}>
                  <Ionicons name="add" size={18} color={c.accent} />
                </Pressable>
              ) : null}
            </View>

            {externalLinks.length > 0 ? (
              <View style={{ gap: 8 }}>
                {externalLinks.map((link) => (
                  <ExternalLinkCard
                    key={link.id}
                    link={link}
                    canEdit={canEdit}
                    onEdit={setEditingLink}
                    onDelete={handleDeleteLink}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptySection}>
                <Ionicons name="link-outline" size={28} color={c.textTertiary} />
                <Text style={styles.emptySectionText}>No links added</Text>
              </View>
            )}
          </View>
        ) : null}

        {/* ─── SHARE PROFILE ─── */}
        <Pressable style={styles.shareCard} onPress={handleShareProfile}>
          <Ionicons name="share-social-outline" size={20} color={c.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.shareTitle}>Share Profile</Text>
            <Text style={styles.shareSub}>Share this player's complete profile</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      <AddLinkModal
        playerId={id || ""}
        visible={showLinkModal}
        onClose={() => setShowLinkModal(false)}
      />
      <EditLinkModal
        playerId={id || ""}
        link={editingLink}
        visible={!!editingLink}
        onClose={() => setEditingLink(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scrollContent: { paddingHorizontal: 16 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface,
    justifyContent: "center", alignItems: "center", marginBottom: 16, marginTop: 12,
  },
  profileCard: { borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 24 },
  avatarBlock: { position: "relative", marginBottom: 12 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 28, fontFamily: "Outfit_700Bold", color: "#fff" },
  numberBadge: {
    position: "absolute", bottom: -4, right: -4,
    backgroundColor: "#FFD93D", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  numberText: { fontSize: 12, fontFamily: "Outfit_700Bold", color: "#0A0E1A" },
  playerName: { fontSize: 24, fontFamily: "Outfit_700Bold", color: "#fff" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 18 },
  infoBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)",
  },
  infoBadgeText: { fontSize: 12, fontFamily: "Outfit_500Medium", color: "rgba(255,255,255,0.85)" },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: "Outfit_700Bold", color: c.text, flex: 1 },
  addBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: c.accent + "14",
    justifyContent: "center", alignItems: "center",
  },
  linkEditActions: {
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  linkEditOverlay: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  linkPreviewCard: {
    backgroundColor: c.surface, borderRadius: 14, overflow: "hidden",
    borderWidth: 1, borderColor: c.borderLight,
  },
  linkPreviewImage: {
    width: "100%", height: 160,
    backgroundColor: c.border,
  },
  linkPreviewPlaceholder: {
    width: "100%", height: 100,
    justifyContent: "center", alignItems: "center",
  },
  linkPreviewBody: {
    padding: 12, gap: 4,
  },
  linkPreviewDomainRow: {
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  linkPreviewDomain: {
    fontSize: 11, fontFamily: "Outfit_500Medium", color: c.textTertiary,
    textTransform: "uppercase" as const,
  },
  linkPreviewTitle: {
    fontSize: 14, fontFamily: "Outfit_600SemiBold", color: c.text, lineHeight: 19,
  },
  linkPreviewDesc: {
    fontSize: 12, fontFamily: "Outfit_400Regular", color: c.textSecondary, lineHeight: 17,
  },
  linkCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: c.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: c.borderLight,
  },
  linkIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },
  linkPlatform: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: c.text },
  linkLabel: { fontSize: 12, fontFamily: "Outfit_400Regular", color: c.textTertiary, marginTop: 1 },
  recruitBio: {
    fontSize: 13, fontFamily: "Outfit_400Regular", color: c.textSecondary,
    marginBottom: 14, lineHeight: 20,
  },
  recruitGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  recruitItem: {
    backgroundColor: c.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    minWidth: (SCREEN_WIDTH - 52) / 3,
  },
  recruitLabel: { fontSize: 10, fontFamily: "Outfit_500Medium", color: c.textTertiary, textTransform: "uppercase" as const, marginBottom: 2 },
  recruitValue: { fontSize: 15, fontFamily: "Outfit_700Bold", color: c.text },
  contactRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 12, paddingVertical: 8,
  },
  contactEmail: { fontSize: 13, fontFamily: "Outfit_500Medium", color: c.accent },
  editRecruitingBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 20,
  },
  editRecruitingText: { fontSize: 14, fontFamily: "Outfit_500Medium", color: c.text, flex: 1 },
  shareCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: c.accent + "0C",
    borderRadius: 14, padding: 16, gap: 12,
    borderWidth: 1, borderColor: c.accent + "20", marginBottom: 20,
  },
  shareTitle: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: c.text },
  shareSub: { fontSize: 12, fontFamily: "Outfit_400Regular", color: c.textTertiary, marginTop: 1 },
  pendingCard: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 14,
    borderRadius: 14, padding: 16, marginBottom: 24,
    backgroundColor: "#F59E0B14", borderWidth: 1, borderColor: "#F59E0B30",
  },
  pendingTitle: { fontSize: 15, fontFamily: "Outfit_700Bold", color: "#F59E0B" },
  pendingSub: { fontSize: 12, fontFamily: "Outfit_400Regular", color: c.textTertiary, marginTop: 2 },
  claimCard: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 14,
    borderRadius: 16, padding: 18,
  },
  claimTitle: { fontSize: 15, fontFamily: "Outfit_700Bold", color: "#fff" },
  claimSub: { fontSize: 12, fontFamily: "Outfit_400Regular", color: "rgba(255,255,255,0.8)", marginTop: 2 },
  emptySection: {
    alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 28, backgroundColor: c.surface, borderRadius: 14,
  },
  emptySectionText: { fontSize: 13, fontFamily: "Outfit_500Medium", color: c.textTertiary },
  empty: { alignItems: "center", justifyContent: "center", flex: 1, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Outfit_500Medium", color: c.textTertiary },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: Platform.OS === "web" ? 20 : 40,
  },
  modalContentLarge: {
    backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: Platform.OS === "web" ? 20 : 40,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontFamily: "Outfit_700Bold", color: c.text },
  inputLabel: {
    fontSize: 12, fontFamily: "Outfit_600SemiBold", color: c.textSecondary,
    marginBottom: 6, marginTop: 12,
  },
  input: {
    backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 14, fontFamily: "Outfit_400Regular",
    color: c.text, borderWidth: 1, borderColor: c.border,
  },
  formRow: { flexDirection: "row", gap: 10 },
  platformRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  platformChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  platformChipActive: { backgroundColor: c.accent + "18", borderColor: c.accent },
  platformChipText: { fontSize: 12, fontFamily: "Outfit_500Medium", color: c.textSecondary },
  platformChipTextActive: { color: c.accent },
  saveBtn: {
    backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14,
    alignItems: "center", marginTop: 20,
  },
  saveBtnText: { fontSize: 15, fontFamily: "Outfit_700Bold", color: "#fff" },
  toggleRow: {
    flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14,
  },
  toggleLabel: { fontSize: 13, fontFamily: "Outfit_500Medium", color: c.textSecondary },
  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  badgeCard: {
    flex: 1, minWidth: 120, borderRadius: 16, borderWidth: 1.5,
    padding: 16, alignItems: "center", gap: 6,
  },
  badgeSymbol: { fontSize: 28, lineHeight: 34 },
  badgeTierLabel: { fontSize: 13, fontFamily: "Outfit_700Bold", letterSpacing: 2 },
  badgeCardSub: { fontSize: 11, fontFamily: "Outfit_400Regular", color: c.textTertiary, letterSpacing: 1 },
  viewCardBtn: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  viewCardText: { fontSize: 11, fontFamily: "Outfit_600SemiBold" },
});
