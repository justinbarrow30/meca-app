import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Linking,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useTeam, useTeamPlayers, useTournaments } from "@/lib/api-hooks";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/lib/auth-context";
import FollowButton from "@/components/FollowButton";

const c = Colors.dark;

interface TeamExternalLink {
  id: string;
  teamId: string;
  platform: string;
  url: string;
  label?: string;
}

const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram", icon: "logo-instagram" as const },
  { value: "twitter", label: "X / Twitter", icon: "logo-twitter" as const },
  { value: "website", label: "Website", icon: "globe-outline" as const },
  { value: "facebook", label: "Facebook", icon: "logo-facebook" as const },
  { value: "youtube", label: "YouTube", icon: "logo-youtube" as const },
  { value: "tiktok", label: "TikTok", icon: "musical-notes-outline" as const },
];

function getPlatformIcon(platform: string): string {
  const found = PLATFORM_OPTIONS.find(p => p.value === platform);
  return found ? found.icon : "link-outline";
}

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: team, isLoading: teamLoading } = useTeam(id || "");
  const { data: players = [], isLoading: playersLoading } = useTeamPlayers(id || "");
  const { data: tournaments = [], isLoading: tournamentsLoading } = useTournaments();
  const { data: externalLinks = [] } = useQuery<TeamExternalLink[]>({
    queryKey: ["/api/teams", id, "external-links"],
    enabled: !!id,
  });

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState("");
  const [editAbbreviation, setEditAbbreviation] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editSecondaryColor, setEditSecondaryColor] = useState("");
  const [editLogoInitials, setEditLogoInitials] = useState("");
  const [editRegion, setEditRegion] = useState("");

  const [linkPlatform, setLinkPlatform] = useState("instagram");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");

  const [addPlayerVisible, setAddPlayerVisible] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNumber, setNewPlayerNumber] = useState("");
  const [newPlayerPosition, setNewPlayerPosition] = useState("WR");

  const { data: coachTeamClaim } = useQuery<{ id: string; userId: string; teamId: string; approved: boolean } | null>({
    queryKey: ["/api/coach-teams/check", id],
    enabled: !!user && user.role === "coach" && !!id,
  });

  const isCoachOfTeam = !!coachTeamClaim?.approved;
  const isAdmin = user && user.role === "admin";
  const canEdit = isCoachOfTeam || isAdmin;

  const canClaimTeam = user && user.role === "coach" && !coachTeamClaim;
  const isPendingClaim = !!coachTeamClaim && !coachTeamClaim.approved;

  const [claiming, setClaiming] = useState(false);

  const handleClaimTeam = async () => {
    setClaiming(true);
    try {
      await apiRequest("POST", `/api/teams/${id}/claim`);
      queryClient.invalidateQueries({ queryKey: ["/api/coach-teams/check", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      Alert.alert("Claim Submitted", "Your team claim has been submitted and is pending admin approval.");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to claim team");
    } finally {
      setClaiming(false);
    }
  };

  const isLoading = teamLoading || playersLoading || tournamentsLoading;

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#5B7AFF" />
      </View>
    );
  }

  if (!team) {
    return (
      <View style={[styles.container, { paddingTop: topInset + 12 }]}>
        <View style={{ paddingHorizontal: 16 }}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </Pressable>
        </View>
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={40} color={c.textTertiary} />
          <Text style={styles.emptyText}>Team not found</Text>
        </View>
      </View>
    );
  }

  const teamTournaments = tournaments.filter((t) => t.registeredTeams.includes(team.id));
  const openEditModal = () => {
    setEditName(team.name);
    setEditAbbreviation(team.abbreviation);
    setEditColor(team.color);
    setEditSecondaryColor(team.secondaryColor || "");
    setEditLogoInitials(team.logoInitials || "");
    setEditRegion(team.region || "");
    setEditModalVisible(true);
  };

  const saveTeamProfile = async () => {
    setSaving(true);
    try {
      await apiRequest("PUT", `/api/teams/${id}`, {
        name: editName.trim(),
        abbreviation: editAbbreviation.trim(),
        color: editColor.trim(),
        secondaryColor: editSecondaryColor.trim(),
        logoInitials: editLogoInitials.trim(),
        region: editRegion.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setEditModalVisible(false);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to update team");
    } finally {
      setSaving(false);
    }
  };

  const openLinkModal = () => {
    setLinkPlatform("instagram");
    setLinkUrl("");
    setLinkLabel("");
    setLinkModalVisible(true);
  };

  const addLink = async () => {
    if (!linkUrl.trim()) {
      Alert.alert("Error", "URL is required");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("POST", `/api/teams/${id}/external-links`, {
        platform: linkPlatform,
        url: linkUrl.trim(),
        label: linkLabel.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", id, "external-links"] });
      setLinkModalVisible(false);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to add link");
    } finally {
      setSaving(false);
    }
  };

  const removeLink = async (linkId: string) => {
    try {
      await apiRequest("DELETE", `/api/teams/${id}/external-links/${linkId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/teams", id, "external-links"] });
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to remove link");
    }
  };

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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {canEdit && (
              <Pressable style={styles.backBtn} onPress={openEditModal}>
                <Feather name="edit-2" size={18} color={c.accent} />
              </Pressable>
            )}
            <FollowButton targetType="team" targetId={id as string} />
          </View>
        </View>

        <LinearGradient
          colors={[team.color, "#5B7AFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroLogo}>
            <Text style={styles.heroLogoText}>{team.logoInitials}</Text>
          </View>
          <Text style={styles.heroName}>{team.name}</Text>
          <View style={styles.recordRow}>
            <View style={styles.recordItem}>
              <Text style={styles.recordValue}>{team.record.wins}</Text>
              <Text style={styles.recordLabel}>Wins</Text>
            </View>
            <View style={styles.recordDivider} />
            <View style={styles.recordItem}>
              <Text style={styles.recordValue}>{team.record.losses}</Text>
              <Text style={styles.recordLabel}>Losses</Text>
            </View>
          </View>
        </LinearGradient>

        {isPendingClaim && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F59E0B14", borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#F59E0B30" }}>
            <Ionicons name="time-outline" size={20} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontFamily: "Outfit_600SemiBold", color: "#F59E0B" }}>Claim Pending</Text>
              <Text style={{ fontSize: 12, fontFamily: "Outfit_400Regular", color: c.textSecondary }}>Your claim for this team is awaiting admin approval.</Text>
            </View>
          </View>
        )}

        {canClaimTeam && (
          <Pressable
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.accent, borderRadius: 14, paddingVertical: 14, marginBottom: 14 }}
            onPress={handleClaimTeam}
            disabled={claiming}
          >
            {claiming ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="clipboard-outline" size={18} color="#fff" />
                <Text style={{ fontSize: 15, fontFamily: "Outfit_600SemiBold", color: "#fff" }}>Claim This Team</Text>
              </>
            )}
          </Pressable>
        )}

        <View style={styles.quickStats}>
          <View style={styles.qStat}>
            <MaterialCommunityIcons name="calendar-check" size={16} color={c.green} />
            <Text style={styles.qStatVal}>{teamTournaments.length}</Text>
            <Text style={styles.qStatLabel}>Events</Text>
          </View>
          <View style={styles.qStat}>
            <MaterialCommunityIcons name="account-group" size={16} color={c.accent} />
            <Text style={styles.qStatVal}>{players.length}</Text>
            <Text style={styles.qStatLabel}>Players</Text>
          </View>
        </View>

        {(externalLinks.length > 0 || canEdit) && (
          <View style={styles.section}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={styles.sectionTitle}>Links</Text>
              {canEdit && (
                <Pressable onPress={openLinkModal}>
                  <Ionicons name="add-circle-outline" size={22} color={c.accent} />
                </Pressable>
              )}
            </View>
            {externalLinks.map((link) => (
              <View key={link.id} style={styles.linkRow}>
                <Pressable
                  style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}
                  onPress={() => {
                    let url = link.url;
                    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
                    if (/^https?:\/\//i.test(url)) Linking.openURL(url);
                  }}
                >
                  <View style={[styles.linkIcon, { backgroundColor: c.accent + "14" }]}>
                    <Ionicons name={getPlatformIcon(link.platform) as any} size={16} color={c.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.linkPlatform}>{link.label || link.platform}</Text>
                    <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
                  </View>
                </Pressable>
                {canEdit && (
                  <Pressable onPress={() => removeLink(link.id)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={c.textTertiary} />
                  </Pressable>
                )}
              </View>
            ))}
            {externalLinks.length === 0 && (
              <Text style={{ fontSize: 13, fontFamily: "Outfit_400Regular", color: c.textTertiary }}>
                No links added yet
              </Text>
            )}
          </View>
        )}

        <View style={styles.section}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.sectionTitle}>Roster ({players.length})</Text>
            {canEdit && (
              <Pressable
                style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: c.accent + "14", borderRadius: 8 }}
                onPress={() => { setNewPlayerName(""); setNewPlayerNumber(""); setNewPlayerPosition("WR"); setAddPlayerVisible(true); }}
              >
                <Ionicons name="add" size={16} color={c.accent} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: c.accent }}>Add Player</Text>
              </Pressable>
            )}
          </View>
          {players.map((player) => (
            <View key={player.id} style={styles.playerRow}>
              <Pressable
                style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}
                onPress={() => router.push({ pathname: "/player/[id]", params: { id: player.id } })}
              >
                <View style={[styles.playerNum, { backgroundColor: team.color + "18" }]}>
                  <Text style={[styles.playerNumText, { color: team.color }]}>#{player.number}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <Text style={styles.playerPos}>{player.position}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={c.textTertiary} />
              </Pressable>
              {canEdit && (
                <Pressable
                  style={{ padding: 8, marginLeft: 4 }}
                  testID={`remove-player-${player.id}`}
                  onPress={async () => {
                    const confirmed = Platform.OS === "web"
                      ? window.confirm(`Remove ${player.name} from the roster?`)
                      : await new Promise<boolean>((resolve) => {
                          Alert.alert("Remove Player", `Remove ${player.name} from the roster?`, [
                            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                            { text: "Remove", style: "destructive", onPress: () => resolve(true) },
                          ]);
                        });
                    if (confirmed) {
                      try {
                        await apiRequest("DELETE", `/api/teams/${id}/players/${player.id}`);
                        queryClient.invalidateQueries({ queryKey: ["/api/teams", id] });
                      } catch (e: any) {
                        Alert.alert("Error", e.message || "Failed to remove player");
                      }
                    }
                  }}
                >
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                </Pressable>
              )}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tournament History</Text>
          {teamTournaments.map((t) => {
            const date = new Date(t.date);
            return (
              <Pressable
                key={t.id}
                style={styles.tourneyRow}
                onPress={() => router.push({ pathname: "/tournament/[id]", params: { id: t.id } })}
              >
                <View style={[styles.tourneyStatus, {
                  backgroundColor: t.status === "live" ? "#E8272C14" : t.status === "upcoming" ? c.accent + "14" : c.textTertiary + "14"
                }]}>
                  <Ionicons
                    name={t.status === "live" ? "radio" : t.status === "upcoming" ? "calendar" : "checkmark-circle"}
                    size={14}
                    color={t.status === "live" ? "#E8272C" : t.status === "upcoming" ? c.accent : c.textTertiary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tourneyName}>{t.name}</Text>
                  <Text style={styles.tourneyDate}>
                    {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} | {t.location}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={c.textTertiary} />
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={editModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Team Profile</Text>
              <Pressable onPress={() => setEditModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Team Name</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholderTextColor={c.textTertiary}
              />

              <Text style={styles.fieldLabel}>Abbreviation</Text>
              <TextInput
                style={styles.input}
                value={editAbbreviation}
                onChangeText={setEditAbbreviation}
                maxLength={6}
                placeholderTextColor={c.textTertiary}
              />

              <Text style={styles.fieldLabel}>Logo Initials</Text>
              <TextInput
                style={styles.input}
                value={editLogoInitials}
                onChangeText={setEditLogoInitials}
                maxLength={4}
                placeholderTextColor={c.textTertiary}
              />

              <Text style={styles.fieldLabel}>Primary Color (hex)</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[styles.colorPreview, { backgroundColor: editColor || "#ccc" }]} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={editColor}
                  onChangeText={setEditColor}
                  placeholder="#5B7AFF"
                  maxLength={7}
                  placeholderTextColor={c.textTertiary}
                />
              </View>

              <Text style={styles.fieldLabel}>Secondary Color (hex)</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[styles.colorPreview, { backgroundColor: editSecondaryColor || "#ccc" }]} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={editSecondaryColor}
                  onChangeText={setEditSecondaryColor}
                  placeholder="#FFD93D"
                  maxLength={7}
                  placeholderTextColor={c.textTertiary}
                />
              </View>

              <Text style={styles.fieldLabel}>Region</Text>
              <TextInput
                style={styles.input}
                value={editRegion}
                onChangeText={setEditRegion}
                placeholder="e.g. Northeast"
                placeholderTextColor={c.textTertiary}
              />
            </ScrollView>

            <Pressable
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveTeamProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </Pressable>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={linkModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Link</Text>
              <Pressable onPress={() => setLinkModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Platform</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {PLATFORM_OPTIONS.map((p) => (
                  <Pressable
                    key={p.value}
                    style={[
                      styles.platformChip,
                      linkPlatform === p.value && { backgroundColor: c.accent, borderColor: c.accent },
                    ]}
                    onPress={() => setLinkPlatform(p.value)}
                  >
                    <Ionicons
                      name={p.icon as any}
                      size={14}
                      color={linkPlatform === p.value ? "#fff" : c.text}
                    />
                    <Text style={[
                      styles.platformChipText,
                      linkPlatform === p.value && { color: "#fff" },
                    ]}>
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>URL</Text>
            <TextInput
              style={styles.input}
              value={linkUrl}
              onChangeText={setLinkUrl}
              placeholder="https://..."
              autoCapitalize="none"
              keyboardType="url"
              placeholderTextColor={c.textTertiary}
            />

            <Text style={styles.fieldLabel}>Label (optional)</Text>
            <TextInput
              style={styles.input}
              value={linkLabel}
              onChangeText={setLinkLabel}
              placeholder="e.g. Official Page"
              placeholderTextColor={c.textTertiary}
            />

            <Pressable
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={addLink}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Add Link</Text>
              )}
            </Pressable>
          </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={addPlayerVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
          <View style={styles.modalContent}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Add Player</Text>
              <Pressable onPress={() => setAddPlayerVisible(false)}>
                <Ionicons name="close" size={24} color={c.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Player Name *</Text>
            <TextInput
              style={styles.input}
              value={newPlayerName}
              onChangeText={setNewPlayerName}
              placeholder="Full name"
              placeholderTextColor={c.textTertiary}
            />

            <Text style={styles.fieldLabel}>Jersey Number *</Text>
            <TextInput
              style={styles.input}
              value={newPlayerNumber}
              onChangeText={setNewPlayerNumber}
              placeholder="e.g. 7"
              placeholderTextColor={c.textTertiary}
              keyboardType="number-pad"
            />

            <Text style={styles.fieldLabel}>Position</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {["QB", "WR", "RB", "TE", "OL", "DL", "LB", "DB", "K", "ATH"].map(pos => (
                <Pressable
                  key={pos}
                  style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: newPlayerPosition === pos ? c.accent : c.surface, borderWidth: 1, borderColor: newPlayerPosition === pos ? c.accent : c.border }}
                  onPress={() => setNewPlayerPosition(pos)}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: newPlayerPosition === pos ? "#fff" : c.text }}>{pos}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={async () => {
                if (!newPlayerName.trim() || !newPlayerNumber.trim()) {
                  Alert.alert("Error", "Name and number are required");
                  return;
                }
                setSaving(true);
                try {
                  await apiRequest("POST", `/api/teams/${id}/players`, {
                    name: newPlayerName.trim(),
                    number: parseInt(newPlayerNumber) || 0,
                    position: newPlayerPosition,
                  });
                  queryClient.invalidateQueries({ queryKey: ["/api/teams", id] });
                  setAddPlayerVisible(false);
                  Alert.alert("Success", "Player added to roster");
                } catch (e: any) {
                  Alert.alert("Error", e.message || "Failed to add player");
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Add Player</Text>
              )}
            </Pressable>
          </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>
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
  heroCard: { borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 18 },
  heroLogo: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  heroLogoText: { fontSize: 24, fontFamily: "Outfit_700Bold", color: "#fff" },
  heroName: { fontSize: 24, fontFamily: "Outfit_700Bold", color: "#fff", marginBottom: 20 },
  recordRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  recordItem: { alignItems: "center" },
  recordValue: { fontSize: 24, fontFamily: "Outfit_700Bold", color: "#fff" },
  recordLabel: { fontSize: 11, fontFamily: "Outfit_500Medium", color: "rgba(255,255,255,0.6)", marginTop: 2 },
  recordDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.2)" },
  quickStats: { flexDirection: "row", gap: 10, marginBottom: 24 },
  qStat: {
    flex: 1, backgroundColor: c.surface, borderRadius: 14,
    paddingVertical: 14, alignItems: "center", gap: 4,
  },
  qStatVal: { fontSize: 18, fontFamily: "Outfit_700Bold", color: c.text },
  qStatLabel: { fontSize: 10, fontFamily: "Outfit_500Medium", color: c.textTertiary, textTransform: "uppercase" as const },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontFamily: "Outfit_700Bold", color: c.text, marginBottom: 12 },
  playerRow: {
    flexDirection: "row", alignItems: "center", padding: 12,
    backgroundColor: c.surface, borderRadius: 12, marginBottom: 6, gap: 10,
  },
  playerNum: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  playerNumText: { fontSize: 12, fontFamily: "Outfit_700Bold" },
  playerName: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: c.text },
  playerPos: { fontSize: 11, fontFamily: "Outfit_400Regular", color: c.textTertiary, marginTop: 1 },
  tourneyRow: {
    flexDirection: "row", alignItems: "center", padding: 12,
    backgroundColor: c.surface, borderRadius: 12, marginBottom: 6, gap: 10,
  },
  tourneyStatus: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  tourneyName: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: c.text },
  tourneyDate: { fontSize: 11, fontFamily: "Outfit_400Regular", color: c.textTertiary, marginTop: 1 },
  empty: { alignItems: "center", justifyContent: "center", flex: 1, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Outfit_500Medium", color: c.textTertiary },
  linkRow: {
    flexDirection: "row", alignItems: "center", padding: 12,
    backgroundColor: c.surface, borderRadius: 12, marginBottom: 6, gap: 10,
  },
  linkIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  linkPlatform: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: c.text, textTransform: "capitalize" as const },
  linkUrl: { fontSize: 11, fontFamily: "Outfit_400Regular", color: c.textTertiary, marginTop: 1 },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: c.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontFamily: "Outfit_700Bold", color: c.text },
  fieldLabel: {
    fontSize: 12, fontFamily: "Outfit_600SemiBold", color: c.textSecondary,
    marginBottom: 6, marginTop: 4, textTransform: "uppercase" as const, letterSpacing: 0.5,
  },
  input: {
    backgroundColor: c.surface, borderRadius: 12, padding: 14,
    fontSize: 15, fontFamily: "Outfit_500Medium", color: c.text,
    marginBottom: 12, borderWidth: 1, borderColor: c.border,
  },
  colorPreview: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: c.border,
  },
  saveBtn: {
    backgroundColor: c.accent, borderRadius: 14, paddingVertical: 16,
    alignItems: "center", marginTop: 8,
  },
  saveBtnText: { fontSize: 16, fontFamily: "Outfit_700Bold", color: "#fff" },
  platformChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
  },
  platformChipText: { fontSize: 13, fontFamily: "Outfit_500Medium", color: c.text },
});
