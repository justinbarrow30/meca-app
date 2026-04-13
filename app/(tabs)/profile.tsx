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
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import {
  usePlayers,
  useTeams,
  useTournaments,
  usePlayerExternalLinks,
  usePlayerRecruiting,
  useMyFollows,
  useNotifications,
} from "@/lib/api-hooks";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { Team, Player, PlayerExternalLink, PlayerRecruitingProfile } from "@/lib/types";

const c = Colors.dark;
const SCREEN_WIDTH = Dimensions.get("window").width;

function formatHeight(inches?: number): string {
  if (!inches) return "";
  const ft = Math.floor(inches / 12);
  const rem = inches % 12;
  return `${ft}'${rem}"`;
}

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
    Alert.alert("Delete Link", "Are you sure you want to remove this link?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete?.(link.id) },
    ]);
  };

  if (hasPreview) {
    return (
      <Pressable style={styles.linkPreviewCard} onPress={() => safeOpenURL(link.url)}>
        <View style={{ position: "relative" as const }}>
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
          {canEdit && (
            <View style={styles.linkEditOverlay}>
              <Pressable style={styles.linkEditBtn} onPress={(e) => { e.stopPropagation(); onEdit?.(link); }}>
                <Ionicons name="pencil" size={14} color="#fff" />
              </Pressable>
              <Pressable style={[styles.linkEditBtn, styles.linkDeleteBtn]} onPress={(e) => { e.stopPropagation(); handleDelete(); }}>
                <Ionicons name="trash" size={14} color="#fff" />
              </Pressable>
            </View>
          )}
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
      {canEdit && (
        <>
          <Pressable onPress={(e) => { e.stopPropagation(); onEdit?.(link); }} style={{ marginLeft: 4 }}>
            <Ionicons name="pencil" size={16} color={c.textTertiary} />
          </Pressable>
          <Pressable onPress={(e) => { e.stopPropagation(); handleDelete(); }} style={{ marginLeft: 4 }}>
            <Ionicons name="trash" size={16} color={c.textTertiary} />
          </Pressable>
        </>
      )}
    </Pressable>
  );
}

function RecruitingSection({ profile }: { profile: PlayerRecruitingProfile }) {
  const hasData = profile.gradYear || profile.primaryPosition || profile.heightInches ||
    profile.weightLbs || profile.school || profile.bio ||
    (profile.showContactEmail && profile.contactEmail);
  if (!hasData) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <FontAwesome5 name="graduation-cap" size={14} color={c.accent} />
        <Text style={styles.sectionTitle}>Recruiting Info</Text>
      </View>
      {profile.bio ? <Text style={styles.recruitBio}>{profile.bio}</Text> : null}
      <View style={styles.recruitGrid}>
        {profile.gradYear ? (
          <View style={styles.recruitItem}>
            <Text style={styles.recruitLabel}>Class of</Text>
            <Text style={styles.recruitValue}>{profile.gradYear}</Text>
          </View>
        ) : null}
        {profile.primaryPosition ? (
          <View style={styles.recruitItem}>
            <Text style={styles.recruitLabel}>Position</Text>
            <Text style={styles.recruitValue}>{profile.primaryPosition}</Text>
          </View>
        ) : null}
        {profile.heightInches ? (
          <View style={styles.recruitItem}>
            <Text style={styles.recruitLabel}>Height</Text>
            <Text style={styles.recruitValue}>{formatHeight(profile.heightInches)}</Text>
          </View>
        ) : null}
        {profile.weightLbs ? (
          <View style={styles.recruitItem}>
            <Text style={styles.recruitLabel}>Weight</Text>
            <Text style={styles.recruitValue}>{profile.weightLbs} lbs</Text>
          </View>
        ) : null}
        {profile.school ? (
          <View style={styles.recruitItem}>
            <Text style={styles.recruitLabel}>School</Text>
            <Text style={styles.recruitValue}>{profile.school}</Text>
          </View>
        ) : null}
      </View>
      {profile.showContactEmail && profile.contactEmail ? (
        <Pressable style={styles.contactRow} onPress={() => safeOpenURL(`mailto:${profile.contactEmail}`)}>
          <Ionicons name="mail-outline" size={16} color={c.accent} />
          <Text style={styles.contactEmail}>{profile.contactEmail}</Text>
        </Pressable>
      ) : null}
    </View>
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
    if (!url.trim()) { Alert.alert("Required", "Please enter a URL"); return; }
    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = "https://" + finalUrl;
    setSaving(true);
    try {
      await apiRequest("POST", `/api/players/${playerId}/external-links`, {
        platform, url: finalUrl, label: label.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/players", playerId, "external-links"] });
      setUrl(""); setLabel(""); onClose();
    } catch { Alert.alert("Error", "Failed to add link"); }
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
              <Pressable onPress={onClose}><Ionicons name="close" size={24} color={c.text} /></Pressable>
            </View>
            <Text style={styles.inputLabel}>Platform</Text>
            <View style={styles.platformRow}>
              {platforms.map((p) => (
                <Pressable key={p} style={[styles.platformChip, platform === p && styles.platformChipActive]}
                  onPress={() => setPlatform(p)}>
                  <Text style={[styles.platformChipText, platform === p && styles.platformChipTextActive]}>{p}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.inputLabel}>URL</Text>
            <TextInput style={styles.input} placeholder="https://..." placeholderTextColor={c.textTertiary}
              value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url"
              returnKeyType="next" onSubmitEditing={() => labelRef.current?.focus()} blurOnSubmit={false} />
            <Text style={styles.inputLabel}>Display Name (optional)</Text>
            <TextInput ref={labelRef} style={styles.input} placeholder="My highlight reel" placeholderTextColor={c.textTertiary}
              value={label} onChangeText={setLabel}
              returnKeyType="go" onSubmitEditing={() => { if (url.trim() && !saving) handleSave(); }} />
            <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Add Link</Text>}
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
  const platforms = ["Hudl", "Instagram", "Twitter", "YouTube", "Other"];

  React.useEffect(() => {
    if (link) {
      setPlatform(link.platform || "Hudl");
      setUrl(link.url || "");
      setLabel(link.label || "");
    }
  }, [link]);

  const handleSave = async () => {
    if (!link) return;
    if (!url.trim()) { Alert.alert("Required", "Please enter a URL"); return; }
    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = "https://" + finalUrl;
    setSaving(true);
    try {
      await apiRequest("PUT", `/api/players/${playerId}/external-links/${link.id}`, {
        platform, url: finalUrl, label: label.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/players", playerId, "external-links"] });
      onClose();
    } catch { Alert.alert("Error", "Failed to update link"); }
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
              <Pressable onPress={onClose}><Ionicons name="close" size={24} color={c.text} /></Pressable>
            </View>
            <Text style={styles.inputLabel}>Platform</Text>
            <View style={styles.platformRow}>
              {platforms.map((p) => (
                <Pressable key={p} style={[styles.platformChip, platform === p && styles.platformChipActive]}
                  onPress={() => setPlatform(p)}>
                  <Text style={[styles.platformChipText, platform === p && styles.platformChipTextActive]}>{p}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.inputLabel}>URL</Text>
            <TextInput style={styles.input} placeholder="https://..." placeholderTextColor={c.textTertiary}
              value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url"
              returnKeyType="next" onSubmitEditing={() => labelRef.current?.focus()} blurOnSubmit={false} />
            <Text style={styles.inputLabel}>Display Name (optional)</Text>
            <TextInput ref={labelRef} style={styles.input} placeholder="My highlight reel" placeholderTextColor={c.textTertiary}
              value={label} onChangeText={setLabel}
              returnKeyType="go" onSubmitEditing={() => { if (url.trim() && !saving) handleSave(); }} />
            <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save Link</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function EditRecruitingModal({ playerId, existing, visible, onClose }: {
  playerId: string; existing: PlayerRecruitingProfile | null; visible: boolean; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [gradYear, setGradYear] = useState(existing?.gradYear?.toString() || "");
  const [primaryPosition, setPrimaryPosition] = useState(existing?.primaryPosition || "");
  const [heightFt, setHeightFt] = useState(existing?.heightInches ? Math.floor(existing.heightInches / 12).toString() : "");
  const [heightIn, setHeightIn] = useState(existing?.heightInches ? (existing.heightInches % 12).toString() : "");
  const [weight, setWeight] = useState(existing?.weightLbs?.toString() || "");
  const [school, setSchool] = useState(existing?.school || "");
  const [contactEmail, setContactEmail] = useState(existing?.contactEmail || "");
  const [showEmail, setShowEmail] = useState(existing?.showContactEmail || false);
  const [bio, setBio] = useState(existing?.bio || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const heightInches = heightFt || heightIn
        ? (parseInt(heightFt || "0") * 12) + parseInt(heightIn || "0") : null;
      await apiRequest("PUT", `/api/players/${playerId}/recruiting`, {
        gradYear: gradYear ? parseInt(gradYear) : null,
        primaryPosition: primaryPosition || null, heightInches,
        weightLbs: weight ? parseInt(weight) : null, school: school || null,
        contactEmail: contactEmail || null, showContactEmail: showEmail, bio: bio || null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/players", playerId, "recruiting"] });
      onClose();
    } catch { Alert.alert("Error", "Failed to save recruiting info"); }
    setSaving(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
          <View style={styles.modalContentLarge}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Recruiting Info</Text>
              <Pressable onPress={onClose}><Ionicons name="close" size={24} color={c.text} /></Pressable>
            </View>
            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput style={[styles.input, { height: 70 }]} placeholder="Tell coaches about yourself..."
              placeholderTextColor={c.textTertiary} value={bio} onChangeText={setBio} multiline />
            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Graduation Year</Text>
                <TextInput style={styles.input} placeholder="2026" placeholderTextColor={c.textTertiary}
                  value={gradYear} onChangeText={setGradYear} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Position</Text>
                <TextInput style={styles.input} placeholder="QB, WR..." placeholderTextColor={c.textTertiary}
                  value={primaryPosition} onChangeText={setPrimaryPosition} />
              </View>
            </View>
            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Height (ft)</Text>
                <TextInput style={styles.input} placeholder="5" placeholderTextColor={c.textTertiary}
                  value={heightFt} onChangeText={setHeightFt} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Height (in)</Text>
                <TextInput style={styles.input} placeholder="10" placeholderTextColor={c.textTertiary}
                  value={heightIn} onChangeText={setHeightIn} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Weight (lbs)</Text>
                <TextInput style={styles.input} placeholder="175" placeholderTextColor={c.textTertiary}
                  value={weight} onChangeText={setWeight} keyboardType="number-pad" />
              </View>
            </View>
            <Text style={styles.inputLabel}>School / Team</Text>
            <TextInput style={styles.input} placeholder="School name" placeholderTextColor={c.textTertiary}
              value={school} onChangeText={setSchool} />
            <Text style={styles.inputLabel}>Contact Email</Text>
            <TextInput style={styles.input} placeholder="your@email.com" placeholderTextColor={c.textTertiary}
              value={contactEmail} onChangeText={setContactEmail} autoCapitalize="none" keyboardType="email-address" />
            <Pressable style={styles.toggleRow} onPress={() => setShowEmail(!showEmail)}>
              <Ionicons name={showEmail ? "checkbox" : "square-outline"} size={22}
                color={showEmail ? c.accent : c.textTertiary} />
              <Text style={styles.toggleLabel}>Show email on public profile</Text>
            </Pressable>
            <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function MenuRow({ icon, label, value, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress?: () => void;
}) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={18} color={c.accent} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      {value && <Text style={styles.menuValue}>{value}</Text>}
      <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
    </Pressable>
  );
}

function GuestView({ topInset }: { topInset: number }) {
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <Text style={styles.pageTitle}>Profile</Text>
        </View>
        <LinearGradient colors={["#5B7AFF", "#4460E6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.guestCard}>
          <View style={styles.guestIconWrap}>
            <Ionicons name="person-outline" size={32} color="rgba(255,255,255,0.8)" />
          </View>
          <Text style={styles.guestTitle}>Join the Community</Text>
          <Text style={styles.guestSubtitle}>
            Create a free account to track your stats, link to your team, and get personalized updates.
          </Text>
          <Pressable style={styles.guestSignupBtn} onPress={() => router.push("/auth/signup" as any)}>
            <Text style={styles.guestSignupText}>Create Account</Text>
            <Ionicons name="arrow-forward" size={18} color={c.accent} />
          </Pressable>
          <Pressable style={styles.guestSigninBtn} onPress={() => router.push("/auth/signin" as any)}>
            <Text style={styles.guestSigninText}>Already have an account? Sign In</Text>
          </Pressable>
        </LinearGradient>
        <View style={styles.guestFeatures}>
          <Text style={styles.sectionLabel}>What you can do with an account</Text>
          {[
            { icon: "stats-chart" as const, text: "Track your player stats and ELO rating" },
            { icon: "people" as const, text: "Link to your team" },
            { icon: "trophy" as const, text: "View your tournament history" },
            { icon: "notifications" as const, text: "Get score updates and alerts" },
          ].map((item, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={item.icon} size={16} color={c.accent} />
              </View>
              <Text style={styles.featureText}>{item.text}</Text>
            </View>
          ))}
        </View>
        <Pressable style={styles.supportRow} onPress={() => Linking.openURL('mailto:admin@mecasports.net')}>
          <Ionicons name="help-circle-outline" size={14} color={c.textTertiary} />
          <Text style={styles.supportText}>Need help? Contact admin@mecasports.net</Text>
        </Pressable>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function PlayerProfileView({
  topInset,
  player,
  team,
  userName,
  userEmail,
  userRole,
  tournamentCount,
  onLogout,
}: {
  topInset: number;
  player: Player;
  team: Team | null;
  userName: string;
  userEmail: string;
  userRole: string;
  tournamentCount: number;
  onLogout: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: externalLinks = [] } = usePlayerExternalLinks(player.id);
  const { data: recruiting } = usePlayerRecruiting(player.id);

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showRecruitingModal, setShowRecruitingModal] = useState(false);
  const [editingLink, setEditingLink] = useState<PlayerExternalLink | null>(null);

  const handleDeleteLink = useCallback(async (linkId: string) => {
    try {
      await apiRequest("DELETE", `/api/players/${player.id}/external-links/${linkId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/players", player.id, "external-links"] });
    } catch { Alert.alert("Error", "Failed to delete link"); }
  }, [player.id, queryClient]);

  const initials = player.name.split(" ").map((n) => n[0]).join("");

  const handleShareProfile = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const profileUrl = `${baseUrl}player/${player.id}`;
      await Share.share({
        message: `Check out ${player.name}'s player profile on Meca: ${profileUrl}`,
        url: profileUrl,
      });
    } catch {}
  }, [player.id, player.name]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <Text style={styles.pageTitle}>Profile</Text>
          <Pressable style={styles.headerLogoutBtn} onPress={onLogout}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={styles.headerLogoutText}>Log Out</Text>
          </Pressable>
        </View>

        <LinearGradient
          colors={["#5B7AFF", "#4460E6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.profileCard}
        >
          <View style={styles.avatarBlock}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{initials}</Text>
            </View>
            <View style={styles.numberBadge}>
              <Text style={styles.numberText}>#{player.number}</Text>
            </View>
          </View>
          <Text style={styles.profileName}>{player.name}</Text>
          <View style={styles.profileBadges}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{player.position}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{userRole.charAt(0).toUpperCase() + userRole.slice(1)}</Text>
            </View>
            {team && (
              <Pressable
                style={[styles.badge, { backgroundColor: "rgba(255,217,61,0.25)" }]}
                onPress={() => router.push({ pathname: "/team/[id]", params: { id: team.id } })}
              >
                <Text style={[styles.badgeText, { color: "#FFD93D" }]}>{team.name}</Text>
              </Pressable>
            )}
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="share-social" size={16} color={c.accent} />
            <Text style={styles.sectionTitle}>Social Media</Text>
            <Pressable style={styles.addBtn} onPress={() => setShowLinkModal(true)}>
              <Ionicons name="add" size={18} color={c.accent} />
            </Pressable>
          </View>
          {externalLinks.length > 0 ? (
            <View style={{ gap: 8 }}>
              {externalLinks.map((link) => (
                <ExternalLinkCard key={link.id} link={link} canEdit={true}
                  onEdit={(l) => setEditingLink(l)} onDelete={handleDeleteLink} />
              ))}
            </View>
          ) : (
            <View style={styles.emptySection}>
              <Ionicons name="link-outline" size={28} color={c.textTertiary} />
              <Text style={styles.emptySectionText}>No links added</Text>
            </View>
          )}
        </View>

        {recruiting ? <RecruitingSection profile={recruiting} /> : null}
        <Pressable style={styles.editRecruitingBtn} onPress={() => setShowRecruitingModal(true)}>
          <FontAwesome5 name="graduation-cap" size={14} color={c.accent} />
          <Text style={styles.editRecruitingText}>
            {recruiting ? "Edit Recruiting Info" : "Add Recruiting Info"}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
        </Pressable>

        <Pressable style={styles.shareCard} onPress={handleShareProfile}>
          <Ionicons name="share-social-outline" size={20} color={c.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.shareTitle}>Share Profile</Text>
            <Text style={styles.shareSub}>Share your complete player profile</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
        </Pressable>

        <View style={styles.menuSection}>
          <MenuRow icon="mail-outline" label="Email" value={userEmail} />
          <MenuRow icon="trophy-outline" label="Tournament History" value={`${tournamentCount} events`} />
          {team && (
            <MenuRow icon="people-outline" label="Team" value={team.name}
              onPress={() => router.push({ pathname: "/team/[id]", params: { id: team.id } })} />
          )}
          <MenuRow icon="document-text-outline" label="Digital Waiver" />
          <MenuRow icon="notifications-outline" label="Notifications" />
        </View>

        <Pressable style={styles.logoutBtn} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={16} color={c.textTertiary} />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </Pressable>

        <Pressable style={styles.supportRow} onPress={() => Linking.openURL('mailto:admin@mecasports.net')}>
          <Ionicons name="help-circle-outline" size={14} color={c.textTertiary} />
          <Text style={styles.supportText}>Need help? Contact admin@mecasports.net</Text>
        </Pressable>
        <View style={{ height: 60 }} />
      </ScrollView>

      <AddLinkModal playerId={player.id} visible={showLinkModal}
        onClose={() => setShowLinkModal(false)} />
      <EditLinkModal playerId={player.id} link={editingLink} visible={!!editingLink}
        onClose={() => setEditingLink(null)} />
      <EditRecruitingModal playerId={player.id} existing={recruiting ?? null}
        visible={showRecruitingModal} onClose={() => setShowRecruitingModal(false)} />
    </View>
  );
}

function FollowedItemRow({ targetType, targetId, teamsMap, playersMap, tournamentsMap }: {
  targetType: string; targetId: string;
  teamsMap: Map<string, Team>; playersMap: Map<string, Player>; tournamentsMap: Map<string, any>;
}) {
  let icon: any = "heart";
  let label = targetId;
  let onPress: (() => void) | undefined;

  if (targetType === "team") {
    const team = teamsMap.get(targetId);
    icon = "people";
    label = team?.name || "Team";
    onPress = () => router.push({ pathname: "/team/[id]", params: { id: targetId } });
  } else if (targetType === "player") {
    const player = playersMap.get(targetId);
    icon = "person";
    label = player?.name || "Player";
    onPress = () => router.push({ pathname: "/player/[id]", params: { id: targetId } });
  } else if (targetType === "tournament") {
    const t = tournamentsMap.get(targetId);
    icon = "trophy";
    label = t?.name || "Tournament";
    onPress = () => router.push({ pathname: "/tournament/[id]", params: { id: targetId } });
  }

  return (
    <Pressable style={followStyles.row} onPress={onPress}>
      <Ionicons name={icon} size={18} color={c.accent} />
      <Text style={followStyles.rowLabel} numberOfLines={1}>{label}</Text>
      <Text style={followStyles.rowType}>{targetType}</Text>
      <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
    </Pressable>
  );
}

const followStyles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: "Outfit_500Medium", color: c.text },
  rowType: { fontSize: 11, fontFamily: "Outfit_400Regular", color: c.textTertiary, textTransform: "capitalize" as const },
  sectionCard: {
    backgroundColor: c.surface, borderRadius: 14,
    borderWidth: 1, borderColor: c.border, marginBottom: 16, overflow: "hidden" as const,
  },
  sectionHeader: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  sectionTitle: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: c.text },
  emptyText: { fontSize: 13, fontFamily: "Outfit_400Regular", color: c.textTertiary, padding: 14 },
});

function LoggedInView({
  topInset, userName, userRole, userEmail, linkedTeams, pendingPlayer,
  tournaments: tournamentList, onLogout, teamsMap, playersMap,
}: {
  topInset: number; userName: string; userRole: string; userEmail: string;
  linkedTeams: Team[]; pendingPlayer: Player | null; tournaments: any[]; onLogout: () => void;
  teamsMap: Map<string, Team>; playersMap: Map<string, Player>;
}) {
  const linkedTeam = linkedTeams.length > 0 ? linkedTeams[0] : null;
  const eventsPlayed = tournamentList.filter((t) => t.status === "completed").length;
  const initials = userName.split(" ").map((n: string) => n[0]).join("").toUpperCase();
  const isCoach = userRole === "coach";

  const { data: myFollows = [] } = useMyFollows();
  const { data: recentNotifs = [] } = useNotifications();

  const tournamentsMap = useMemo(() => {
    const map = new Map<string, any>();
    tournamentList.forEach((t) => map.set(t.id, t));
    return map;
  }, [tournamentList]);

  const followedTeams = myFollows.filter((f) => f.targetType === "team");
  const followedPlayers = myFollows.filter((f) => f.targetType === "player");
  const followedTournaments = myFollows.filter((f) => f.targetType === "tournament");

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <Text style={styles.pageTitle}>Profile</Text>
          <Pressable style={styles.headerLogoutBtn} onPress={onLogout}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={styles.headerLogoutText}>Log Out</Text>
          </Pressable>
        </View>
        <LinearGradient colors={isCoach ? ["#2D6A4F", "#1B4332"] : ["#5B7AFF", "#4460E6"]} start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }} style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{initials}</Text>
          </View>
          <Text style={styles.profileName}>{userName}</Text>
          <View style={styles.profileBadges}>
            <View style={[styles.badge, isCoach && { backgroundColor: "rgba(45,106,79,0.5)" }]}>
              <Ionicons name={isCoach ? "school" : userRole === "referee" ? "flag" : "eye"} size={12} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.badgeText}>{userRole.charAt(0).toUpperCase() + userRole.slice(1)}</Text>
            </View>
            {linkedTeams.map((lt) => (
              <Pressable key={lt.id} style={[styles.badge, { backgroundColor: "rgba(255,217,61,0.25)" }]}
                onPress={() => router.push({ pathname: "/team/[id]", params: { id: lt.id } })}>
                <Text style={[styles.badgeText, { color: "#FFD93D" }]}>{lt.name}</Text>
              </Pressable>
            ))}
          </View>
        </LinearGradient>

        {pendingPlayer && (
          <View style={styles.pendingCard}>
            <View style={styles.pendingHeader}>
              <View style={styles.pendingIconWrap}>
                <Ionicons name="time-outline" size={20} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingTitle}>Player Link Pending</Text>
                <Text style={styles.pendingDesc}>
                  Your request to link to #{pendingPlayer.number} {pendingPlayer.name} ({pendingPlayer.position}) is awaiting admin approval.
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.menuSection}>
          <MenuRow icon="mail-outline" label="Email" value={userEmail} />
          {isCoach && linkedTeams.map((lt) => (
            <MenuRow key={lt.id} icon="people-outline" label="Team" value={lt.name}
              onPress={() => router.push({ pathname: "/team/[id]", params: { id: lt.id } })} />
          ))}
          <MenuRow icon="trophy-outline" label="Tournament History" value={`${eventsPlayed} events`} />
          <MenuRow icon="notifications-outline" label="Notifications"
            value={recentNotifs.filter((n: any) => !n.read).length > 0 ? `${recentNotifs.filter((n: any) => !n.read).length} unread` : ""}
            onPress={() => router.push("/notifications")} />
        </View>

        {myFollows.length > 0 && (
          <>
            {followedTeams.length > 0 && (
              <View style={followStyles.sectionCard}>
                <View style={followStyles.sectionHeader}>
                  <Ionicons name="people" size={16} color={c.accent} />
                  <Text style={followStyles.sectionTitle}>Following Teams ({followedTeams.length})</Text>
                </View>
                {followedTeams.map((f) => (
                  <FollowedItemRow key={f.id} targetType={f.targetType} targetId={f.targetId}
                    teamsMap={teamsMap} playersMap={playersMap} tournamentsMap={tournamentsMap} />
                ))}
              </View>
            )}
            {followedPlayers.length > 0 && (
              <View style={followStyles.sectionCard}>
                <View style={followStyles.sectionHeader}>
                  <Ionicons name="person" size={16} color={c.accent} />
                  <Text style={followStyles.sectionTitle}>Following Players ({followedPlayers.length})</Text>
                </View>
                {followedPlayers.map((f) => (
                  <FollowedItemRow key={f.id} targetType={f.targetType} targetId={f.targetId}
                    teamsMap={teamsMap} playersMap={playersMap} tournamentsMap={tournamentsMap} />
                ))}
              </View>
            )}
            {followedTournaments.length > 0 && (
              <View style={followStyles.sectionCard}>
                <View style={followStyles.sectionHeader}>
                  <Ionicons name="trophy" size={16} color={c.accent} />
                  <Text style={followStyles.sectionTitle}>Following Tournaments ({followedTournaments.length})</Text>
                </View>
                {followedTournaments.map((f) => (
                  <FollowedItemRow key={f.id} targetType={f.targetType} targetId={f.targetId}
                    teamsMap={teamsMap} playersMap={playersMap} tournamentsMap={tournamentsMap} />
                ))}
              </View>
            )}
          </>
        )}

        {myFollows.length === 0 && (
          <View style={[followStyles.sectionCard, { alignItems: "center" as const, paddingVertical: 24 }]}>
            <Ionicons name="heart-outline" size={28} color={c.textTertiary} />
            <Text style={[followStyles.emptyText, { textAlign: "center" as const }]}>
              Follow teams, players, and tournaments to see updates here
            </Text>
          </View>
        )}

        {recentNotifs.length > 0 && (
          <View style={followStyles.sectionCard}>
            <View style={followStyles.sectionHeader}>
              <Ionicons name="notifications" size={16} color={c.accent} />
              <Text style={followStyles.sectionTitle}>Recent Notifications</Text>
            </View>
            {recentNotifs.slice(0, 5).map((n: any) => (
              <View key={n.id} style={[followStyles.row, !n.read && { backgroundColor: c.accent + "08" }]}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: n.read ? "transparent" : c.accent }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Outfit_500Medium", color: c.text }} numberOfLines={1}>{n.title}</Text>
                  <Text style={{ fontSize: 12, fontFamily: "Outfit_400Regular", color: c.textSecondary }} numberOfLines={1}>{n.message}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Pressable style={styles.logoutBtn} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={16} color={c.textTertiary} />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </Pressable>

        <Pressable style={styles.supportRow} onPress={() => Linking.openURL('mailto:admin@mecasports.net')}>
          <Ionicons name="help-circle-outline" size={14} color={c.textTertiary} />
          <Text style={styles.supportText}>Need help? Contact admin@mecasports.net</Text>
        </Pressable>
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const { user, isLoading: authLoading, isGuest, logout } = useAuth();

  const { data: players = [], isLoading: playersLoading } = usePlayers();
  const { data: teams = [], isLoading: teamsLoading } = useTeams();
  const { data: tournamentList = [], isLoading: tournamentsLoading } = useTournaments();
  const { data: coachTeamEntries = [] } = useQuery<{ id: string; userId: string; teamId: string; approved: boolean }[]>({
    queryKey: ["/api/coach-teams/me"],
    enabled: !!user && user.role === "coach",
  });

  const isLoading = authLoading || playersLoading || teamsLoading || tournamentsLoading;

  const teamsMap = useMemo(() => {
    const map = new Map<string, Team>();
    teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [teams]);

  const playersMap = useMemo(() => {
    const map = new Map<string, Player>();
    players.forEach((p) => map.set(p.id, p));
    return map;
  }, [players]);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#5B7AFF" />
      </View>
    );
  }

  if (isGuest || !user) {
    return <GuestView topInset={topInset} />;
  }

  const isApproved = user.playerLinkApproved === true;
  const linkedPlayer = (user.playerId && isApproved) ? playersMap.get(user.playerId) || null : null;
  const pendingPlayer = (user.playerId && !isApproved) ? playersMap.get(user.playerId) || null : null;
  const eventsPlayed = tournamentList.filter((t) => t.status === "completed").length;

  const linkedTeams = coachTeamEntries
    .filter((ct) => ct.approved)
    .map((ct) => teamsMap.get(ct.teamId))
    .filter(Boolean) as Team[];
  const linkedTeam = linkedTeams.length > 0 ? linkedTeams[0] : null;

  if (linkedPlayer) {
    return (
      <PlayerProfileView
        topInset={topInset}
        player={linkedPlayer}
        team={linkedTeam}
        userName={user.name || "User"}
        userEmail={user.email || ""}
        userRole={user.role}
        tournamentCount={eventsPlayed}
        onLogout={logout}
      />
    );
  }

  return (
    <LoggedInView
      topInset={topInset}
      userName={user.name || "User"}
      userRole={user.role}
      userEmail={user.email || ""}
      linkedTeams={linkedTeams}
      pendingPlayer={pendingPlayer}
      tournaments={tournamentList}
      onLogout={logout}
      teamsMap={teamsMap}
      playersMap={playersMap}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scrollContent: { paddingHorizontal: 16 },
  profileHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 12, marginBottom: 16,
  },
  pageTitle: { fontSize: 28, fontFamily: "Outfit_700Bold", color: c.text },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface,
    justifyContent: "center", alignItems: "center",
  },
  profileCard: { borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 18 },
  pendingCard: {
    backgroundColor: "#F59E0B" + "12",
    borderWidth: 1,
    borderColor: "#F59E0B" + "30",
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
  },
  pendingHeader: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 12 },
  pendingIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#F59E0B" + "20",
    justifyContent: "center" as const, alignItems: "center" as const,
  },
  pendingTitle: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: "#F59E0B", marginBottom: 4 },
  pendingDesc: { fontSize: 13, fontFamily: "Outfit_400Regular", color: c.textSecondary, lineHeight: 18 },
  headerLogoutBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#EF4444" + "14", borderWidth: 1, borderColor: "#EF4444" + "30",
  },
  headerLogoutText: { fontSize: 13, fontFamily: "Outfit_600SemiBold", color: "#EF4444" },
  logoutBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const,
    gap: 6, paddingVertical: 14, marginTop: 12,
  },
  logoutBtnText: { fontSize: 13, fontFamily: "Outfit_500Medium", color: c.textTertiary },
  supportRow: {
    flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const,
    gap: 6, marginTop: 16,
  },
  supportText: { fontSize: 12, color: c.textTertiary, fontFamily: "Outfit_400Regular" },
  avatarBlock: { position: "relative", marginBottom: 12 },
  avatarLarge: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  avatarLargeText: { fontSize: 24, fontFamily: "Outfit_700Bold", color: "#fff" },
  numberBadge: {
    position: "absolute", bottom: 8, right: -4,
    backgroundColor: "#FFD93D", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  numberText: { fontSize: 12, fontFamily: "Outfit_700Bold", color: "#0A0E1A" },
  profileName: { fontSize: 22, fontFamily: "Outfit_700Bold", color: "#fff", marginBottom: 8 },
  profileBadges: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  badgeText: { fontSize: 12, fontFamily: "Outfit_600SemiBold", color: "#fff" },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: "Outfit_700Bold", color: c.text, flex: 1 },
  sectionLabel: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: c.textSecondary, marginBottom: 12 },
  addBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: c.accent + "14",
    justifyContent: "center", alignItems: "center",
  },
  linkEditOverlay: {
    position: "absolute" as const, top: 8, right: 8,
    flexDirection: "row" as const, gap: 6,
  },
  linkEditBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center" as const, alignItems: "center" as const,
  },
  linkDeleteBtn: {
    backgroundColor: "rgba(220,38,38,0.7)",
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
  contactRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, paddingVertical: 8 },
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
  emptySection: {
    alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 28, backgroundColor: c.surface, borderRadius: 14,
  },
  emptySectionText: { fontSize: 13, fontFamily: "Outfit_500Medium", color: c.textTertiary },
  menuSection: { backgroundColor: c.surface, borderRadius: 16, overflow: "hidden", marginTop: 4 },
  menuRow: {
    flexDirection: "row", alignItems: "center", padding: 16,
    borderBottomWidth: 1, borderBottomColor: c.borderLight, gap: 12,
  },
  menuIcon: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: c.accent + "14",
    justifyContent: "center", alignItems: "center",
  },
  menuLabel: { fontSize: 14, fontFamily: "Outfit_500Medium", color: c.text, flex: 1 },
  menuValue: { fontSize: 12, fontFamily: "Outfit_400Regular", color: c.textTertiary, marginRight: 4 },
  guestCard: { borderRadius: 20, padding: 28, alignItems: "center", marginBottom: 20 },
  guestIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  guestTitle: { fontSize: 22, fontFamily: "Outfit_700Bold", color: "#fff", marginBottom: 8 },
  guestSubtitle: {
    fontSize: 14, fontFamily: "Outfit_400Regular", color: "rgba(255,255,255,0.7)",
    textAlign: "center", lineHeight: 20, marginBottom: 24, paddingHorizontal: 8,
  },
  guestSignupBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff",
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, marginBottom: 12,
  },
  guestSignupText: { fontSize: 16, fontFamily: "Outfit_600SemiBold", color: c.accent },
  guestSigninBtn: { paddingVertical: 8 },
  guestSigninText: { fontSize: 13, fontFamily: "Outfit_500Medium", color: "rgba(255,255,255,0.7)" },
  guestFeatures: { backgroundColor: c.surface, borderRadius: 16, padding: 18 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  featureIcon: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: c.accent + "14",
    justifyContent: "center", alignItems: "center",
  },
  featureText: { fontSize: 14, fontFamily: "Outfit_500Medium", color: c.text, flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: Platform.OS === "web" ? 20 : 40,
  },
  modalContentLarge: {
    backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: Platform.OS === "web" ? 20 : 40,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20,
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
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  toggleLabel: { fontSize: 13, fontFamily: "Outfit_500Medium", color: c.textSecondary },
});
