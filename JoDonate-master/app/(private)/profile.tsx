import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { uploadToCloudinary } from "@/lib/cloudinaryService";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { PrivateBottomNav } from "@/components/private-bottom-nav";
import { useAuth } from "@/lib/auth-context";
import { getAuthUser } from "@/lib/auth-user";
import {
  accountDeletionErrorMessage,
  deleteAccountPermanently,
} from "@/lib/account-deletion";
import { SKIP_FIREBASE_AUTH } from "@/lib/dev-auth";
import { getFavoriteIds } from "@/lib/favorites-storage";
import { auth, db } from "@/lib/firebase";
import { ROUTES } from "@/lib/app-routes";
import { useLocale } from "@/lib/locale-context";
import { useUserProfile } from "@/lib/user-profile-context";
import { cardShadowMedium, cardShadowSoft } from "@/lib/shadow-styles";

// ─── Palette ──────────────────────────────────────────
const C = {
  primary:   "#A0866B",
  bg:        "#F5F3F0",
  card:      "#FFFFFF",
  text:      "#2C2C2A",
  muted:     "#888888",
  border:    "#E0E0E0",
  avatarBg:  "#D4C4B0",
  iconTan:   "#EDE5DE",
  green:     "#2E7D32",
  grayBadge: "#9E9E9E",
  danger:    "#E24B4A",
  star:      "#F5A623",
};

const MAX_W = 380;

// ─── Types ────────────────────────────────────────────
type ItemPreview = {
  id: string;
  title: string;
  imageUrl?: string;
  status?: string;
  createdAt?: unknown;
};

// ─── Helpers ──────────────────────────────────────────
function itemTime(it: ItemPreview): number {
  const c = it.createdAt;
  if (
    c &&
    typeof c === "object" &&
    "toDate" in c &&
    typeof (c as { toDate: () => Date }).toDate === "function"
  ) {
    try { return (c as { toDate: () => Date }).toDate().getTime(); }
    catch { return 0; }
  }
  return 0;
}

function formatPhone(raw?: string): string {
  if (!raw?.trim()) return "";
  const d = raw.trim().replace(/\s/g, "");
  if (/^07\d{8}$/.test(d)) return `+962 ${d.slice(1)}`;
  if (d.startsWith("+")) return raw.trim();
  return raw.trim();
}

function displayInitials(name: string, email: string): string {
  const n = name.trim();
  if (n.length >= 2) return `${n.charAt(0)}${n.charAt(1)}`.toUpperCase();
  if (n.length === 1) return n.toUpperCase();
  const e = email.trim();
  return e.length ? e.charAt(0).toUpperCase() : "?";
}

function shortPublicId(uid: string): string {
  if (!uid) return "—";
  return uid.slice(-6).toUpperCase();
}

function memberSinceLabel(meta?: string, fallbackTs?: unknown): string {
  let d: Date | null = null;
  if (meta) {
    const parsed = new Date(meta);
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  }
  if (
    !d &&
    fallbackTs &&
    typeof fallbackTs === "object" &&
    fallbackTs !== null &&
    "toDate" in fallbackTs
  ) {
    try { d = (fallbackTs as { toDate: () => Date }).toDate(); }
    catch { d = null; }
  }
  if (!d) return "—";
  return d.toLocaleString(undefined, { month: "short", year: "numeric" });
}

function listingBadge(status?: string): { label: string; active: boolean } {
  const s = (status ?? "available").toLowerCase();
  if (s === "donated" || s === "expired" || s === "removed") {
    return { label: "Expired", active: false };
  }
  return { label: "Active", active: true };
}

// ─── Screen ───────────────────────────────────────────
export default function ProfileScreen() {
  const router              = useRouter();
  const { signOutApp, limitedGuest } = useAuth();
  const firebaseUser        = getAuthUser();
  const { isAdmin, isCommittee } = useUserProfile();
  const { t } = useLocale();

  const isGuest = useMemo(() => {
    if (!firebaseUser) return true;
    return !!firebaseUser.isAnonymous || limitedGuest;
  }, [firebaseUser, limitedGuest]);

  // ── User data ──
  const [name,          setName]          = useState("");
  const [phone,         setPhone]         = useState("");
  const [city,          setCity]          = useState("");
  const [avatarUrl,     setAvatarUrl]     = useState("");
  const [verified,      setVerified]      = useState(false);
  const [ratingAvg,     setRatingAvg]     = useState<number | null>(null);
  const [ratingCount,   setRatingCount]   = useState(0);
  const [userCreatedAt, setUserCreatedAt] = useState<unknown>(undefined);

  // ── Stats ──
  const [sharedCount,    setSharedCount]    = useState(0);
  const [receivedCount,  setReceivedCount]  = useState(0);
  const [activeListings, setActiveListings] = useState(0);
  const [expiredListings,setExpiredListings]= useState(0);

  // ── Items & favourites ──
  const [myItems,       setMyItems]       = useState<ItemPreview[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<ItemPreview[]>([]);

  // ── UI state ──
  const [refreshing,    setRefreshing]    = useState(false);

  // ── Modals ──
  const [modalLogout,  setModalLogout]  = useState(false);
  const [modalDelete,  setModalDelete]  = useState(false);
  const [deleteConfirm,setDeleteConfirm]= useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteErr, setDeleteErr] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [modalPwd,     setModalPwd]     = useState(false);
  const [pwdCurrent,   setPwdCurrent]   = useState("");
  const [pwdNew,       setPwdNew]       = useState("");
  const [pwdAgain,     setPwdAgain]     = useState("");
  const [pwdErr,       setPwdErr]       = useState("");
  const [modalPhoto,   setModalPhoto]   = useState(false);
  const [modalReviews, setModalReviews] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ── Favourites loader ──
  const loadFavorites = useCallback(async () => {
    const ids  = await getFavoriteIds();
    const rows: ItemPreview[] = [];
    await Promise.all(
      ids.slice(0, 8).map(async (id) => {
        try {
          const snap = await getDoc(doc(db, "items", id));
          if (!snap.exists()) return;
          const d = snap.data() as Omit<ItemPreview, "id">;
          rows.push({ id, title: d.title ?? "Donation", imageUrl: d.imageUrl, status: d.status });
        } catch { /* ignore */ }
      }),
    );
    setFavoriteItems(rows);
  }, []);

  // ── Firestore listeners ──
  useEffect(() => {
    if (!firebaseUser || isGuest) return;

    const unsubUser = onSnapshot(doc(db, "users", firebaseUser.uid), (snap) => {
      if (!snap.exists()) {
        setName("User"); setPhone(""); setCity(""); setAvatarUrl("");
        setVerified(false); setRatingAvg(null); setRatingCount(0);
        setUserCreatedAt(undefined);
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      setName(String(data.name ?? "User"));
      setPhone(String(data.phone ?? ""));
      setCity(String(data.city ?? ""));
      setAvatarUrl(String(data.avatarUrl ?? ""));
      setVerified(data.verified === true);
      const ra = data.ratingAvg;
      setRatingAvg(typeof ra === "number" ? ra : null);
      const rc = data.ratingCount;
      setRatingCount(typeof rc === "number" ? rc : 0);
      setUserCreatedAt(data.createdAt);
    });

    const unsubItems = onSnapshot(
      query(collection(db, "items"), where("ownerId", "==", firebaseUser.uid)),
      (snap) => {
        const rows: ItemPreview[] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ItemPreview, "id">) }))
          .sort((a, b) => itemTime(b) - itemTime(a));
        setMyItems(rows);
        setSharedCount(rows.length);
        let active = 0, expired = 0;
        rows.forEach((r) => (listingBadge(r.status).active ? active++ : expired++));
        setActiveListings(active);
        setExpiredListings(expired);
      },
    );

    const unsubRecv = onSnapshot(
      query(collection(db, "requests"), where("requesterId", "==", firebaseUser.uid)),
      (snap) => {
        setReceivedCount(
          snap.docs.filter(
            (d) => String((d.data() as { status?: string }).status ?? "").toLowerCase() === "approved",
          ).length,
        );
      },
    );

    loadFavorites();
    return () => { unsubUser(); unsubItems(); unsubRecv(); };
  }, [firebaseUser, isGuest, loadFavorites]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFavorites().finally(() => setRefreshing(false));
  }, [loadFavorites]);

  // ── Avatar helpers ────────────────────────────────────────────────────────
  /**
   * Persist a Cloudinary URL to the user's Firestore doc.
   * Called after every successful upload.
   */
  const persistAvatarUrl = async (url: string) => {
    if (!firebaseUser) return;
    await setDoc(
      doc(db, "users", firebaseUser.uid),
      { avatarUrl: url, updatedAt: serverTimestamp() },
      { merge: true },
    );
  };

  /**
   * Shared upload flow:
   * 1. Close the photo-picker modal
   * 2. Show a loading indicator
   * 3. Upload the local URI to Cloudinary → get a CDN URL
   * 4. Save that URL to Firestore (no Firebase Storage involved)
   * 5. The Firestore listener updates avatarUrl state automatically
   */
  const uploadAndSaveAvatar = async (localUri: string) => {
    setUploadingPhoto(true);
    try {
      const cdnUrl = await uploadToCloudinary(localUri);
      await persistAvatarUrl(cdnUrl);
      Alert.alert("Updated", "Profile photo updated!");
    } catch (e: unknown) {
      Alert.alert(
        "Upload failed",
        e instanceof Error ? e.message : "Could not upload to Cloudinary. Please try again.",
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const pickFromLibrary = async () => {
    setModalPhoto(false);
    if (!firebaseUser) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access in Settings.");
      return;
    }

     const result = await ImagePicker.launchImageLibraryAsync({
     mediaTypes: "images" as ImagePicker.MediaType,
     quality: 0.85,
     allowsEditing: true,
     aspect: [1, 1],
  });
    if (result.canceled) return;

    const uri = result.assets[0]?.uri;
    if (uri) await uploadAndSaveAvatar(uri);
  };

  const takePhoto = async () => {
    setModalPhoto(false);
    if (!firebaseUser) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow camera access in Settings.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;

    const uri = result.assets[0]?.uri;
    if (uri) await uploadAndSaveAvatar(uri);
  };

  const removePhoto = async () => {
    setModalPhoto(false);
    if (!firebaseUser) return;
    try {
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        avatarUrl: "",
        updatedAt: serverTimestamp(),
      });
      Alert.alert("Removed", "Profile photo removed.");
    } catch {
      Alert.alert("Error", "Could not remove photo. Please try again.");
    }
  };

  // ── Password change ──────────────────────────────────────────────────────
  const submitPasswordChange = async () => {
    setPwdErr("");
    if (pwdNew.length < 6)      { setPwdErr("New password must be at least 6 characters."); return; }
    if (pwdNew !== pwdAgain)    { setPwdErr("New passwords do not match."); return; }
    if (SKIP_FIREBASE_AUTH)     { Alert.alert("Dev mode", "Password change is disabled in preview."); setModalPwd(false); return; }

    const u  = auth.currentUser;
    const em = u?.email;
    if (!u || !em) { setPwdErr("No email account linked."); return; }

    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(em, pwdCurrent));
      await updatePassword(u, pwdNew);
      setModalPwd(false);
      setPwdCurrent(""); setPwdNew(""); setPwdAgain("");
      Alert.alert("Success", "Your password was updated.");
    } catch (e: unknown) {
      setPwdErr(e instanceof Error ? e.message : "Failed to update password.");
    }
  };

  // ── Delete account ───────────────────────────────────────────────────────
  const confirmDeleteAccount = async () => {
    if (deleteConfirm.trim() !== "DELETE") return;
    setDeleteErr("");
    if (__DEV__ && SKIP_FIREBASE_AUTH) {
      setModalDelete(false);
      setDeleteConfirm("");
      setDeletePassword("");
      await signOutApp();
      router.replace("/(onboarding)");
      return;
    }
    try {
      setDeletingAccount(true);
      await deleteAccountPermanently(deletePassword);
      setModalDelete(false);
      setDeleteConfirm("");
      setDeletePassword("");
      await signOutApp();
      router.replace("/(onboarding)");
      Alert.alert("Account deleted", "Your account and data were permanently removed.");
    } catch (e: unknown) {
      setDeleteErr(accountDeletionErrorMessage(e));
    } finally {
      setDeletingAccount(false);
    }
  };

  // ── Derived display values ───────────────────────────────────────────────
  const displayName  = isGuest ? "Guest" : name.trim() || "User";
  const displayEmail = isGuest ? "" : firebaseUser?.email ?? "";
  const phoneDisp    = formatPhone(phone) || "—";
  const cityDisp     = city.trim() || "All Cities";
  const initials     = displayInitials(name, displayEmail);
  const uidShort     = shortPublicId(firebaseUser?.uid ?? "");
  const memberSince  = memberSinceLabel(firebaseUser?.metadata?.creationTime, userCreatedAt);

  const stars = useMemo(() => {
    const full = Math.round(ratingAvg ?? 0);
    return Array.from({ length: 5 }, (_, i) => i < full);
  }, [ratingAvg]);

  const reviewsPlaceholder = [
    { id: "1", user: "Sara M.",  text: "Very responsive and kind donor!", stars: 5 },
    { id: "2", user: "Omar K.",  text: "Item matched the description.",   stars: 4 },
  ];

  // ── Guest view ───────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.guestScroll}>
          <View style={styles.inner}>
            <Text style={styles.headerTitleCenter}>Profile</Text>
            <View style={[styles.card, cardShadowSoft()]}>
              <Ionicons name="person-circle-outline" size={56} color={C.primary} style={{ alignSelf: "center" }} />
              <Text style={styles.guestTitle}>Sign in to view your profile</Text>
              <Text style={styles.guestSub}>
                Manage donations, messages, favorites, and account settings with a full account.
              </Text>
              <Pressable style={styles.btnPrimary} onPress={() => router.push("/login")}>
                <Text style={styles.btnPrimaryText}>Login</Text>
              </Pressable>
              <Pressable style={styles.btnOutline} onPress={() => router.push("/sign-up")}>
                <Text style={styles.btnOutlineText}>Sign Up</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
        <PrivateBottomNav active="profile" />
      </View>
    );
  }

  // ── Main view ────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      {/* Full-screen upload overlay */}
      {uploadingPhoto && (
        <View style={styles.uploadOverlay} pointerEvents="box-none">
          <View style={styles.uploadBox}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={styles.uploadTxt}>Uploading photo…</Text>
          </View>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        contentContainerStyle={styles.scrollInner}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Pressable
            hitSlop={12}
            onPress={() => router.push("/settings")}
            style={styles.headerGear}
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={24} color={C.primary} />
          </Pressable>
        </View>

        <View style={styles.inner}>
          {/* ── Profile card ── */}
          <View style={[styles.profileCard, cardShadowSoft()]}>
            <View style={styles.profileTopRow}>

              {/* Avatar — shows a spinner overlay while uploading */}
              <Pressable
                onPress={() => !uploadingPhoto && setModalPhoto(true)}
                style={styles.avatarTouch}
                accessibilityLabel="Change profile photo"
              >
                <View style={styles.avatarLarge}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                  )}
                  {uploadingPhoto ? (
                    <View style={styles.avatarUploadingOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  ) : (
                    <View style={styles.camOverlay}>
                      <Ionicons name="camera" size={18} color="#FFFFFF" />
                    </View>
                  )}
                </View>
              </Pressable>

              {/* Info */}
              <View style={styles.profileInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.nameText} numberOfLines={1}>{displayName}</Text>
                  {verified && (
                    <Ionicons name="checkmark-circle" size={20} color={C.green} style={{ marginLeft: 6 }} />
                  )}
                </View>
                <Text style={styles.idText}>ID: {uidShort}</Text>
                <Text style={styles.meta}>{displayEmail}</Text>
                <Text style={styles.meta}>{phoneDisp}</Text>
                <View style={styles.locRow}>
                  <Ionicons name="location-outline" size={16} color={C.muted} />
                  <Text style={styles.meta}>{cityDisp}</Text>
                </View>
                <Text style={styles.memberSince}>Member since {memberSince}</Text>
              </View>
            </View>

            <Pressable style={styles.editOutlineBtn} onPress={() => router.push("/edit-profile")}>
              <Text style={styles.editOutlineText}>Edit Profile</Text>
            </Pressable>
          </View>

          {/* ── Activity stats ── */}
          <Text style={styles.sectionTitle}>Your Activity</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.statLeft, cardShadowSoft()]}>
              <Ionicons name="heart-outline" size={24} color={C.primary} />
              <Text style={styles.statNum}>{sharedCount}</Text>
              <Text style={styles.statLabel}>Donations Shared</Text>
              <Text style={styles.statHint}>Active: {activeListings} · Expired: {expiredListings}</Text>
            </View>
            <View style={[styles.statCard, styles.statRight, cardShadowSoft()]}>
              <Ionicons name="gift-outline" size={24} color={C.primary} />
              <Text style={styles.statNum}>{receivedCount}</Text>
              <Text style={styles.statLabel}>Donations Received</Text>
            </View>
          </View>

          {/* ── My Donations ── */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>My Donations</Text>
            <Pressable onPress={() => router.push("/my-items")}>
              <Text style={styles.viewAll}>View All</Text>
            </Pressable>
          </View>
          {myItems.length === 0 ? (
            <Text style={styles.empty}>No donations yet</Text>
          ) : (
            <View style={styles.donationGrid}>
              {myItems.slice(0, 3).map((it) => {
                const b = listingBadge(it.status);
                return (
                  <Pressable
                    key={it.id}
                    style={[styles.donationTile, cardShadowSoft()]}
                    onPress={() => router.push({ pathname: "/item/[id]", params: { id: it.id } })}
                  >
                    {it.imageUrl ? (
                      <Image source={{ uri: it.imageUrl }} style={styles.tileImg} />
                    ) : (
                      <View style={[styles.tileImg, styles.tileImgPh]}>
                        <Ionicons name="image-outline" size={28} color={C.muted} />
                      </View>
                    )}
                    <Text style={styles.tileTitle} numberOfLines={1}>{it.title}</Text>
                    <View style={[styles.badge, b.active ? styles.badgeOn : styles.badgeOff]}>
                      <Text style={[styles.badgeTxt, b.active ? styles.badgeTxtOn : styles.badgeTxtOff]}>
                        {b.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* ── Favorites ── */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Favorites</Text>
            <Pressable onPress={() => router.push(ROUTES.favorites)}>
              <Text style={styles.viewAll}>{t("viewAll")}</Text>
            </Pressable>
          </View>
          {favoriteItems.length === 0 ? (
            <Text style={styles.empty}>No favorites yet</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favRow}>
              {favoriteItems.map((it) => (
                <Pressable
                  key={it.id}
                  style={[styles.favCard, cardShadowSoft()]}
                  onPress={() => router.push({ pathname: "/item/[id]", params: { id: it.id } })}
                >
                  <View style={styles.favHeart}>
                    <Ionicons name="heart" size={16} color={C.primary} />
                  </View>
                  {it.imageUrl ? (
                    <Image source={{ uri: it.imageUrl }} style={styles.favImg} />
                  ) : (
                    <View style={[styles.favImg, styles.tileImgPh]}>
                      <Ionicons name="image-outline" size={24} color={C.muted} />
                    </View>
                  )}
                  <Text style={styles.favTitle} numberOfLines={1}>{it.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* ── Menu rows ── */}
          <ProfileMenuRow icon="person-outline"          title="Edit Profile"       subtitle="Update your information"              onPress={() => router.push("/edit-profile")} />
          <ProfileMenuRow icon="document-text-outline"   title={t("myAds")}         subtitle="Manage your donations"                badge={String(sharedCount)} onPress={() => router.push("/my-items")} />
          {isCommittee && (
            <ProfileMenuRow icon="shield-checkmark-outline" title={t("committeeReviews")} subtitle="Review recipient eligibility" onPress={() => router.push(ROUTES.committeeReviews)} />
          )}
          {isAdmin && (
            <ProfileMenuRow icon="grid-outline" title={t("adminPanel")} subtitle="Users, roles, and committees" onPress={() => router.push(ROUTES.admin)} />
          )}
          <ProfileMenuRow icon="notifications-outline"   title={t("notifications")} subtitle={t("inAppNotifications")}             onPress={() => router.push("/notifications")} />
          <ProfileMenuRow icon="settings-outline"        title={t("settings")}      subtitle="App preferences and security"         onPress={() => router.push("/settings")} />
          <ProfileMenuRow icon="help-circle-outline"     title="Help & Support"     subtitle="FAQs and contact support"             onPress={() => router.push("/help-support")} last />

          {/* ── Account actions ── */}
          <Text style={styles.sectionTitle}>Account</Text>
          <Pressable style={[styles.accountRow, cardShadowSoft()]} onPress={() => setModalPwd(true)}>
            <Text style={styles.accountRowText}>Change Password</Text>
          </Pressable>
          <Pressable style={[styles.accountRow, cardShadowSoft()]} onPress={() => setModalLogout(true)}>
            <Text style={styles.accountRowText}>Logout</Text>
          </Pressable>
          <Pressable style={[styles.accountRow, cardShadowSoft()]} onPress={() => setModalDelete(true)}>
            <Text style={[styles.accountRowText, { color: C.danger }]}>Delete Account</Text>
          </Pressable>
        </View>
      </ScrollView>

      <PrivateBottomNav active="profile" />

      {/* ═══════════════ Modals ═══════════════ */}

      {/* Logout */}
      <Modal transparent visible={modalLogout} animationType="fade" onRequestClose={() => setModalLogout(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalLogout(false)}>
          <Pressable style={[styles.modalCard, cardShadowMedium()]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Logout?</Text>
            <Text style={styles.modalMsg}>Are you sure you want to logout?</Text>
            <View style={styles.modalBtns}>
              <Pressable
                style={[styles.modalBrown, { flex: 1 }]}
                onPress={async () => {
                  setModalLogout(false);
                  try { await signOutApp(); router.replace("/(onboarding)"); }
                  catch (e: unknown) { Alert.alert("Error", e instanceof Error ? e.message : "Logout failed"); }
                }}
              >
                <Text style={styles.modalBrownTxt}>Logout</Text>
              </Pressable>
              <Pressable style={[styles.modalOutline, { flex: 1 }]} onPress={() => setModalLogout(false)}>
                <Text style={styles.modalOutlineTxt}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete account */}
      <Modal transparent visible={modalDelete} animationType="fade" onRequestClose={() => setModalDelete(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalDelete(false)}>
          <Pressable style={[styles.modalCard, cardShadowMedium()]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Delete Account?</Text>
            <Text style={[styles.modalMsg, { color: C.danger }]}>
              This action cannot be undone. All your data will be permanently deleted.
            </Text>
            <Text style={styles.modalHint}>Type &apos;DELETE&apos; to confirm</Text>
            <TextInput
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              style={styles.modalInput}
              placeholder="DELETE"
              placeholderTextColor={C.muted}
              autoCapitalize="characters"
            />
            <Text style={styles.inputLbl}>Current password</Text>
            <TextInput
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
              style={styles.modalInput}
              placeholder="••••••••"
              placeholderTextColor={C.muted}
            />
            {deleteErr ? <Text style={styles.pwdErr}>{deleteErr}</Text> : null}
            <View style={styles.modalBtns}>
              <Pressable
                style={[styles.modalDanger, { flex: 1 }, (deleteConfirm.trim() !== "DELETE" || deletingAccount) && styles.btnDisabled]}
                disabled={deleteConfirm.trim() !== "DELETE" || deletingAccount}
                onPress={() => void confirmDeleteAccount()}
              >
                <Text style={styles.modalBrownTxt}>{deletingAccount ? "Deleting…" : "Delete"}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalGrayOutline, { flex: 1 }]}
                disabled={deletingAccount}
                onPress={() => {
                  setModalDelete(false);
                  setDeleteErr("");
                  setDeletePassword("");
                }}
              >
                <Text style={styles.modalGrayTxt}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Change password */}
      <Modal transparent visible={modalPwd} animationType="slide" onRequestClose={() => setModalPwd(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalPwd(false)}>
          <Pressable style={[styles.modalCard, cardShadowMedium(), { maxHeight: "85%" }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <Text style={styles.inputLbl}>Current Password</Text>
            <TextInput secureTextEntry value={pwdCurrent} onChangeText={setPwdCurrent} style={styles.modalInput} placeholder="••••••••" placeholderTextColor={C.muted} />
            <Text style={styles.inputLbl}>New Password</Text>
            <TextInput secureTextEntry value={pwdNew}     onChangeText={setPwdNew}     style={styles.modalInput} placeholder="••••••••" placeholderTextColor={C.muted} />
            <Text style={styles.inputLbl}>Confirm Password</Text>
            <TextInput secureTextEntry value={pwdAgain}   onChangeText={setPwdAgain}   style={styles.modalInput} placeholder="••••••••" placeholderTextColor={C.muted} />
            {pwdErr ? <Text style={styles.pwdErr}>{pwdErr}</Text> : null}
            <View style={styles.modalBtns}>
              <Pressable style={[styles.modalBrown, { flex: 1 }]} onPress={submitPasswordChange}>
                <Text style={styles.modalBrownTxt}>Update</Text>
              </Pressable>
              <Pressable style={[styles.modalGrayOutline, { flex: 1 }]} onPress={() => setModalPwd(false)}>
                <Text style={styles.modalGrayTxt}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Photo picker */}
      <Modal transparent visible={modalPhoto} animationType="fade" onRequestClose={() => setModalPhoto(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalPhoto(false)}>
          <Pressable style={[styles.modalCard, cardShadowMedium()]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Profile photo</Text>
            <PhotoOption icon="camera-outline"  label="Take Photo"            onPress={takePhoto} />
            <PhotoOption icon="images-outline"  label="Choose from Gallery"   onPress={pickFromLibrary} />
            <PhotoOption icon="trash-outline"   label="Remove Photo"          onPress={removePhoto} danger />
            <Pressable style={styles.cancelTxtWrap} onPress={() => setModalPhoto(false)}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Reviews */}
      <Modal transparent visible={modalReviews} animationType="slide" onRequestClose={() => setModalReviews(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalReviews(false)}>
          <Pressable style={[styles.modalCard, cardShadowMedium(), { maxHeight: "80%" }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Reviews</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {reviewsPlaceholder.map((r) => (
                <View key={r.id} style={styles.reviewRow}>
                  <Text style={styles.reviewUser}>{r.user}</Text>
                  <View style={styles.starRow}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Ionicons key={i} name={i < r.stars ? "star" : "star-outline"} size={16} color={C.star} />
                    ))}
                  </View>
                  <Text style={styles.reviewBody}>{r.text}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable style={styles.modalGrayOutline} onPress={() => setModalReviews(false)}>
              <Text style={styles.modalGrayTxt}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Sub-components ────────────────────────────────────
function PhotoOption({
  icon, label, onPress, danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.photoOpt} onPress={onPress}>
      <Ionicons name={icon} size={22} color={danger ? C.danger : C.primary} />
      <Text style={[styles.photoOptTxt, danger && { color: C.danger }]}>{label}</Text>
    </Pressable>
  );
}

function ProfileMenuRow({
  icon, title, subtitle, onPress, badge, toggle, toggleValue, onToggle, last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
  badge?: string;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
  last?: boolean;
}) {
  const inner = (
    <>
      <View style={styles.menuIconCircle}>
        <Ionicons name={icon} size={22} color={C.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSub}>{subtitle}</Text>
      </View>
      {badge && (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeTxt}>{badge}</Text>
        </View>
      )}
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: "#D0D0D0", true: "#C4A88E" }}
          thumbColor={toggleValue ? C.primary : "#f4f3f4"}
        />
      ) : (
        <Ionicons name="chevron-forward" size={20} color={C.muted} />
      )}
    </>
  );

  if (toggle) {
    return <View style={[styles.menuCard, cardShadowSoft(), !last && styles.menuMb]}>{inner}</View>;
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.menuCard, cardShadowSoft(), !last && styles.menuMb, pressed && cardShadowMedium()]}
      onPress={onPress}
    >
      {inner}
    </Pressable>
  );
}

// ─── Styles ────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === "ios" ? 52 : 28 },
  scrollInner:  { paddingBottom: 120, alignItems: "center" },
  inner:        { width: "100%", maxWidth: MAX_W, paddingHorizontal: 16 },
  guestScroll:  { flexGrow: 1, paddingBottom: 120, paddingHorizontal: 16, paddingTop: 8 },

  // Upload overlay (full-screen, non-blocking for scroll but visually prominent)
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  uploadBox: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 12,
    minWidth: 160,
  },
  uploadTxt:    { fontSize: 14, fontWeight: "600", color: C.text },

  // Avatar upload-in-progress overlay
  avatarUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 40,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: MAX_W,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    marginBottom: 8,
  },
  headerTitle:       { fontSize: 18, fontWeight: "700", color: C.text },
  headerTitleCenter: { fontSize: 18, fontWeight: "700", color: C.text, textAlign: "center", marginBottom: 16 },
  headerGear:        { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },

  profileCard:    { backgroundColor: C.card, borderRadius: 12, padding: 16, marginTop: 8, marginBottom: 8 },
  profileTopRow:  { flexDirection: "row", gap: 14 },
  avatarTouch:    { alignSelf: "flex-start" },
  avatarLarge:    { width: 80, height: 80, borderRadius: 40, overflow: "hidden", backgroundColor: C.avatarBg },
  avatarImg:      { width: "100%", height: "100%" },
  avatarFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontSize: 14, fontWeight: "800", color: C.text },
  camOverlay: {
    position: "absolute", right: 0, bottom: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.primary, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: C.card,
  },
  profileInfo:   { flex: 1 },
  nameRow:       { flexDirection: "row", alignItems: "center" },
  nameText:      { fontSize: 16, fontWeight: "700", color: C.text, flexShrink: 1 },
  idText:        { fontSize: 12, color: C.muted, marginTop: 2, fontWeight: "600" },
  meta:          { fontSize: 13, color: C.muted, marginTop: 4, fontWeight: "500" },
  locRow:        { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  memberSince:   { fontSize: 12, color: C.muted, marginTop: 8, fontWeight: "600" },
  editOutlineBtn: {
    marginTop: 16, alignSelf: "flex-start",
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 1.5, borderColor: C.primary,
    minHeight: 44, justifyContent: "center",
  },
  editOutlineText: { fontSize: 12, fontWeight: "700", color: C.primary },

  sectionTitle: { fontSize: 14, fontWeight: "700", color: C.text, marginTop: 16, marginBottom: 10, alignSelf: "flex-start" },
  sectionRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: 8 },
  viewAll:      { fontSize: 12, fontWeight: "700", color: C.primary },

  statsRow:   { flexDirection: "row", gap: 8, marginBottom: 8 },
  statCard:   { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 12, alignItems: "center", gap: 6 },
  statLeft:   { marginRight: 4 },
  statRight:  { marginLeft: 4 },
  statNum:    { fontSize: 24, fontWeight: "800", color: C.primary },
  statLabel:  { fontSize: 12, color: C.muted, fontWeight: "600", textAlign: "center" },
  statHint:   { fontSize: 11, color: C.muted, fontWeight: "500" },

  ratingCard: { backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 8 },
  starRow:    { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  ratingNum:  { fontSize: 14, fontWeight: "700", color: C.text, marginTop: 8 },
  ratingTap:  { fontSize: 12, color: C.muted, marginTop: 4, fontWeight: "600" },

  donationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  donationTile: { width: "31%", flexGrow: 1, backgroundColor: C.card, borderRadius: 12, padding: 10, minWidth: 100 },
  tileImg:      { width: "100%", height: 80, borderRadius: 8, marginBottom: 8 },
  tileImgPh:    { backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center" },
  tileTitle:    { fontSize: 12, fontWeight: "700", color: C.text },
  badge:        { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeOn:      { backgroundColor: "#E8F5E9" },
  badgeOff:     { backgroundColor: "#EEEEEE" },
  badgeTxt:     { fontSize: 11, fontWeight: "700" },
  badgeTxtOn:   { color: C.green },
  badgeTxtOff:  { color: C.grayBadge },
  empty:        { fontSize: 13, color: C.muted, marginBottom: 12, fontWeight: "600" },

  favRow:  { gap: 10, paddingBottom: 8 },
  favCard: { width: 140, backgroundColor: C.card, borderRadius: 12, padding: 8, marginRight: 4 },
  favHeart:{ position: "absolute", top: 10, right: 10, zIndex: 2 },
  favImg:  { width: "100%", height: 100, borderRadius: 8, marginBottom: 8 },
  favTitle:{ fontSize: 12, fontWeight: "700", color: C.text },

  menuCard:      { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 12, padding: 14, gap: 12, minHeight: 52 },
  menuMb:        { marginBottom: 10 },
  menuIconCircle:{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.iconTan, alignItems: "center", justifyContent: "center" },
  menuTitle:     { fontSize: 14, fontWeight: "700", color: C.text },
  menuSub:       { fontSize: 12, color: C.muted, marginTop: 2, fontWeight: "500" },
  countBadge:    { backgroundColor: C.primary, borderRadius: 10, minWidth: 24, paddingHorizontal: 8, paddingVertical: 4, alignItems: "center" },
  countBadgeTxt: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },

  accountRow:    { backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 10, minHeight: 52, justifyContent: "center" },
  accountRowText:{ fontSize: 14, fontWeight: "600", color: C.text },

  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 },
  modalCard:  { backgroundColor: C.card, borderRadius: 12, padding: 20, width: "100%", maxWidth: 340, alignSelf: "center", gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: "800", color: C.text },
  modalMsg:   { fontSize: 14, color: C.muted, fontWeight: "500", lineHeight: 20 },
  modalHint:  { fontSize: 13, color: C.muted, fontWeight: "600" },
  modalInput: { backgroundColor: "#F0F0F0", borderRadius: 12, padding: 14, fontSize: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, color: C.text },
  inputLbl:   { fontSize: 12, fontWeight: "700", color: C.text },
  pwdErr:     { fontSize: 12, color: C.danger, fontWeight: "600" },
  modalBtns:  { flexDirection: "row", gap: 10, marginTop: 8 },
  modalBrown: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", minHeight: 48, justifyContent: "center" },
  modalBrownTxt:  { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  modalOutline:   { borderWidth: 1.5, borderColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", minHeight: 48, justifyContent: "center" },
  modalOutlineTxt:{ color: C.primary, fontWeight: "800", fontSize: 15 },
  modalDanger:    { backgroundColor: C.danger, borderRadius: 12, paddingVertical: 14, alignItems: "center", minHeight: 48, justifyContent: "center" },
  modalGrayOutline:{ borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, alignItems: "center", minHeight: 48, justifyContent: "center" },
  modalGrayTxt:   { color: C.muted, fontWeight: "800", fontSize: 15 },
  btnDisabled:    { opacity: 0.45 },

  photoOpt:    { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, minHeight: 48 },
  photoOptTxt: { fontSize: 15, fontWeight: "700", color: C.text },
  cancelTxtWrap:{ paddingVertical: 12, alignItems: "center" },
  cancelTxt:   { fontSize: 15, fontWeight: "700", color: C.muted },

  reviewRow:  { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  reviewUser: { fontSize: 14, fontWeight: "800", color: C.text },
  reviewBody: { fontSize: 13, color: C.muted, marginTop: 6, fontWeight: "500" },

  card:       { backgroundColor: C.card, borderRadius: 12, padding: 20, alignItems: "stretch", gap: 12 },
  guestTitle: { fontSize: 18, fontWeight: "800", color: C.text, textAlign: "center" },
  guestSub:   { fontSize: 14, color: C.muted, textAlign: "center", lineHeight: 20 },
  btnPrimary: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 8, minHeight: 52 },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  btnOutline:     { borderWidth: 1.5, borderColor: C.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center", minHeight: 52 },
  btnOutlineText: { color: C.primary, fontSize: 16, fontWeight: "800" },
});