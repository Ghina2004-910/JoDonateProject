import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  addDoc,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PrivateBottomNav } from "@/components/private-bottom-nav";
import { categoryFormKind } from "@/lib/donation-categories";
import { useAuth } from "@/lib/auth-context";
import { formatPostedTime } from "@/lib/format-posted";
import { conversationIdForPair } from "@/lib/chat-utils";
import { getAuthUser } from "@/lib/auth-user";
import {
  canChatWithPeer,
  canShowItemContact,
  createDonationRequest,
  findActiveRequest,
  type DonationRequest,
} from "@/lib/donation-requests";
import { isFavoriteId, toggleFavoriteId } from "@/lib/favorites-storage";
import { db } from "@/lib/firebase";
import { safeGoBack } from "@/lib/navigation";
import { cardShadowSoft } from "@/lib/shadow-styles";

const C = {
  primary: "#A0866B",
  secondary: "#B39A86",
  bg: "#F5F3F0",
  card: "#FFFFFF",
  text: "#2C2C2A",
  muted: "#888888",
  border: "#E0E0E0",
  inputBg: "#F0F0F0",
  tan: "#D4C4B0",
  green: "#2E7D32",
};

const MAX_W = 380;
const CAROUSEL_H = 280;

type ItemDoc = {
  title: string;
  description: string;
  category: string;
  status?: string;
  imageUrl?: string;
  imageUrls?: string[];
  contactNumber?: string;
  contactEmail?: string;
  ownerId: string;
  donorName?: string;
  createdAt?: unknown;
  city?: string;
  condition?: string;
  viewCount?: number;
  expiresAt?: unknown;
  
  foodExpiry?: string;
  preparedAt?: string;
  foodType?: string;
  storageRefrigeration?: boolean;
  storageFrozen?: boolean;
  storageRoomTemp?: boolean;
  allergens?: string;
  packaging?: string;
  
  clothesSize?: string;
  clothesGender?: string;
  material?: string;
  fit?: string;
  
  bookTitle?: string;
  bookAuthor?: string;
  bookLanguage?: string;
  bookIsbn?: string;
  bookEdition?: string;
  bookGenre?: string;
  
  beautyExpiry?: string;
  beautyBrand?: string;
  productType?: string;
  beautyCondition?: string;
  beautyQuantity?: string;
  
  brandModel?: string;
  workingStatus?: string;
  accessories?: string[];
  
  serviceType?: string;
  serviceDuration?: string;
  experienceLevel?: string;
  
  courseSubject?: string;
  eduLevel?: string;
  eduFormat?: string;
  eduDuration?: string;
  
  equipmentType?: string;
  
  petType?: string;
  petItemType?: string;
  
  pickupLocation?: string;
  availabilityNote?: string;

  donationMode?: string;
  committeeUid?: string;
};

type OwnerProfile = {
  name?: string;
  avatarUrl?: string;
  phone?: string;
  email?: string;
  verified?: boolean;
};

type SimilarRow = { id: string; title: string; category: string; imageUrl?: string };

function formatDateLabel(v?: string | unknown): string {
  if (!v) return "—";
  if (typeof v === "string") return v;
  try {
    const d =
      v &&
      typeof v === "object" &&
      "toDate" in v &&
      typeof (v as { toDate: () => Date }).toDate === "function"
        ? (v as { toDate: () => Date }).toDate()
        : null;
    return d ? d.toLocaleDateString() : "—";
  } catch {
    return "—";
  }
}

export default function ItemDetailsScreen() {
  const router = useRouter();
  const { id, committeeView } = useLocalSearchParams<{ 
  id: string; 
  committeeView?: string; 
}>();
const isCommitteeView = committeeView === "true";
  const { limitedGuest, user: authUser } = useAuth();
  const viewBump = useRef(false);

  const [item, setItem] = useState<ItemDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [similar, setSimilar] = useState<SimilarRow[]>([]);
  const [imgIndex, setImgIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);

  const [loginOpen, setLoginOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [myRequest, setMyRequest] = useState<DonationRequest | null>(null);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [hasApprovedAccess, setHasApprovedAccess] = useState(false);
  const [contactSecrets, setContactSecrets] = useState<{
    contactNumber?: string;
    contactEmail?: string | null;
  } | null>(null);

  const meUid = authUser?.uid;
  const isOwner = !!(meUid && item?.ownerId && meUid === item.ownerId);
  const isCommitteeItem = item?.donationMode === "committee";

  const canContact =isCommitteeItem || canShowItemContact(item?.ownerId ?? "", meUid, hasApprovedAccess);

  const guestGate = useCallback(
    (fn: () => void) => {
      if (limitedGuest || !authUser) setLoginOpen(true);
      else fn();
    },
    [limitedGuest, authUser],
  );

  useEffect(() => {
    if (!id) return;
    isFavoriteId(String(id)).then(setFavorited);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const itemRef = doc(db, "items", id);
    const unsub = onSnapshot(
      itemRef,
      (snap) => {
        setItem(snap.exists() ? (snap.data() as ItemDoc) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!id || !meUid || !item?.ownerId) {
      setMyRequest(null);
      return;
    }
    if (meUid === item.ownerId) {
      setMyRequest(null);
      return;
    }
    let cancelled = false;
    findActiveRequest(String(id), meUid).then((req) => {
      if (!cancelled) setMyRequest(req);
    });
    return () => {
      cancelled = true;
    };
  }, [id, meUid, item?.ownerId]);

 useEffect(() => {
  if (!id || !meUid) {
    setHasApprovedAccess(false);
    return;
  }

  const unsubList: (() => void)[] = [];
  unsubList.push(
    onSnapshot(doc(db, "requestAccess", `${id}_${meUid}`), (snap) => {
      if (snap.exists()) setHasApprovedAccess(true);
    })
  );

  const q = query(
    collection(db, "requestAccess"),
    where("requesterId", "==", meUid),
    where("itemId", "==", id)
  );
  unsubList.push(
    onSnapshot(q, (snap) => {
      if (!snap.empty) setHasApprovedAccess(true);
    })
  );

  return () => unsubList.forEach((u) => u());
}, [id, meUid]);

  useEffect(() => {
    if (!item?.ownerId) {
      setOwner(null);
      return;
    }
    if (!canContact && !isOwner) {
      setOwner({ name: item.donorName ?? "Donor" });
      return;
    }
    const uref = doc(db, "users", item.ownerId);
    const unsub = onSnapshot(uref, (snap) => {
      setOwner(snap.exists() ? (snap.data() as OwnerProfile) : { name: item.donorName ?? "Donor" });
    });
    return unsub;
  }, [item?.ownerId, item?.donorName, canContact, isOwner]);

  useEffect(() => {
    if (!id || !canContact) {
      setContactSecrets(null);
      return;
    }
    const unsub = onSnapshot(doc(db, "itemSecrets", String(id)), (snap) => {
      if (!snap.exists()) {
        setContactSecrets(null);
        return;
      }
      const data = snap.data() as { contactNumber?: string; contactEmail?: string | null };
      setContactSecrets({
        contactNumber: data.contactNumber,
        contactEmail: data.contactEmail ?? null,
      });
    });
    return unsub;
  }, [id, canContact]);

  useEffect(() => {
    if (!id || !item?.category) return;
    const q = query(
      collection(db, "items"),
      where("category", "==", item.category),
      limit(24),
    );
    getDocs(q).then((snap) => {
      const rows: SimilarRow[] = [];
      snap.forEach((d) => {
        if (d.id === id) return;
        const data = d.data() as ItemDoc;
        rows.push({
          id: d.id,
          title: data.title,
          category: data.category,
          imageUrl: data.imageUrls?.[0] ?? data.imageUrl,
        });
      });
      setSimilar(rows.slice(0, 12));
    });
  }, [id, item?.category]);

  useEffect(() => {
    if (!id || !item || viewBump.current) return;
    viewBump.current = true;
    updateDoc(doc(db, "items", id), { viewCount: increment(1) }).catch(() => {});
  }, [id, item]);

  const images = useMemo(() => {
    if (!item) return [];
    if (item.imageUrls?.length) return item.imageUrls.filter(Boolean);
    if (item.imageUrl) return [item.imageUrl];
    return [];
  }, [item]);

  const postedRel = item ? formatPostedTime(item.createdAt) : "";
  const postedLabel = postedRel ? `Posted ${postedRel}` : "Posted recently";

  const displayId = item?.ownerId ? item.ownerId.slice(-8).toUpperCase() : "—";

  const phoneRaw = canContact
    ? (contactSecrets?.contactNumber?.replace(/\D/g, "") ??
      (isOwner ? item?.contactNumber?.replace(/\D/g, "") : "") ??
      owner?.phone?.replace(/\D/g, "") ??
      "")
    : "";
  const waDigits = phoneRaw.startsWith("962") ? phoneRaw : phoneRaw.startsWith("0") ? `962${phoneRaw.slice(1)}` : phoneRaw;

  const onShareNative = async () => {
    const url = Linking.createURL(`/item/${id}`);
    try {
      await Share.share({
        title: item?.title,
        message: `${item?.title ?? "Donation"}\n${url}`,
        url: Platform.OS === "ios" ? url : undefined,
      });
    } catch {
      
    }
    setShareOpen(false);
  };

  const onContactMessage = async () => {
  setContactOpen(false);
  const me = getAuthUser()?.uid;
  if (!me) {
    Alert.alert("Sign in required", "Please sign in to message.");
    return;
  }

  const itemIdStr = typeof id === "string" ? id : "";
  const isCommittee = item?.donationMode === "committee";
  const peer = isCommitteeItem
  ? item?.committeeUid
  : item?.ownerId;

  if (!peer) {
    Alert.alert("Error", "Could not find contact.");
    return;
  }
  if (!peer) {
  Alert.alert("Error", "No valid chat target.");
  return;
}

// only block self-chat for normal items
if (!isCommitteeItem && me === peer) {
  Alert.alert("Can't chat", "This listing is yours.");
  return;
}

  const allowed = isCommitteeItem || (await canChatWithPeer(me, peer, itemIdStr || undefined));
  if (!allowed) {
  if (item?.donationMode === "committee") {
    Alert.alert(
      "Committee item",
      "You can contact directly without approval."
    );
    return;
  } else {
      Alert.alert(
        "Request required",
        "Messaging is available after the donor approves your donation request.",
      );
    }
    return;
  }

  const conversationId = conversationIdForPair(me, peer);
  router.push({
    pathname: "/chats/[conversationId]",
    params: {
      conversationId,
      ...(itemIdStr ? { itemId: itemIdStr } : {}),
    },
  });
};

  const onRequestDonation = async () => {
    const me = getAuthUser()?.uid;
    if (!me || !item?.ownerId || !id) {
      Alert.alert("Sign in required", "Please sign in to request this donation.");
      return;
    }
    if (limitedGuest) {
      setLoginOpen(true);
      return;
    }
    try {
      setRequestSubmitting(true);
      await createDonationRequest(String(id), item.ownerId, me);
      const req = await findActiveRequest(String(id), me);
      setMyRequest(req);
      Alert.alert("Request sent", "The committee will review your request.");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e ? String((e as Error).message) : "Failed";
      Alert.alert("Could not send request", msg);
    } finally {
      setRequestSubmitting(false);
    }
  };

  const onContactCall = () => {
    if (!canContact) return;
    const n = contactSecrets?.contactNumber ?? (isOwner ? item?.contactNumber : undefined) ?? owner?.phone;
    if (!n) return;
    Linking.openURL(`tel:${n.replace(/\s/g, "")}`);
    setContactOpen(false);
  };

  const onContactWhatsApp = () => {
    if (!waDigits) return;
    Linking.openURL(`https://wa.me/${waDigits}`);
    setContactOpen(false);
  };

  const onContactEmail = () => {
    if (!canContact) return;
    const e =
      contactSecrets?.contactEmail ?? (isOwner ? item?.contactEmail : undefined) ?? owner?.email;
    if (!e) return;
    Linking.openURL(`mailto:${e}`);
    setContactOpen(false);
  };

  const openContactOrLogin = () => {
    if (!canContact) {
      Alert.alert(
        "Request required",
        "Contact details are shared after your donation request is approved.",
      );
      return;
    }
    guestGate(() => setContactOpen(true));
  };

  const submitReport = async () => {
    if (!reportReason || !id) {
      return;
    }
    const user = getAuthUser();
    try {
      setReportSubmitting(true);
      await addDoc(collection(db, "reports"), {
        itemId: id,
        reason: reportReason,
        details: reportDetails.trim(),
        reporterId: user?.uid ?? null,
        createdAt: serverTimestamp(),
      });
      Alert.alert("Thank you", "Your report was submitted.");
      setReportOpen(false);
      setReportReason(null);
      setReportDetails("");
    } finally {
      setReportSubmitting(false);
    }
  };

  const onCarouselScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const w = Dimensions.get("window").width;
    const idx = Math.round(x / Math.min(w, MAX_W));
    setImgIndex(Math.max(0, Math.min(idx, Math.max(images.length - 1, 0))));
  };

  const specs = item ? renderCategorySpecs(item) : null;

  const descLong = (item?.description?.length ?? 0) > 220;
  const descShown =
    descExpanded || !descLong ? (item?.description ?? "") : `${(item?.description ?? "").slice(0, 220)}…`;

  const expiresGridVal =
    formatDateLabel(item?.expiresAt) !== "—"
      ? formatDateLabel(item?.expiresAt)
      : item?.foodExpiry || item?.beautyExpiry || "—";

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={styles.loadingTxt}>Loading donation…</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.errTitle}>Donation not found</Text>
        <Pressable style={styles.outlineBtn} onPress={() => safeGoBack(router, "/donations")}>
          <Text style={styles.outlineBtnTxt}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const carouselW = Math.min(Dimensions.get("window").width, MAX_W);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack(router, "/donations")} hitSlop={14} style={styles.headerIcon}>
          <Ionicons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable
            hitSlop={12}
            style={styles.headerIcon}
            onPress={() =>
              guestGate(() => {
                if (!id) return;
                toggleFavoriteId(String(id)).then(setFavorited);
              })
            }
          >
            <Ionicons
              name={favorited ? "heart" : "heart-outline"}
              size={22}
              color={favorited ? "#E24B4A" : C.primary}
            />
          </Pressable>
          <Pressable hitSlop={12} style={styles.headerIcon} onPress={() => setShareOpen(true)}>
            <Ionicons name="share-outline" size={22} color={C.primary} />
          </Pressable>
          <Pressable hitSlop={12} style={styles.headerIcon} onPress={() => setReportOpen(true)}>
            <Ionicons name="ellipsis-horizontal" size={22} color={C.muted} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollInner}
      >
        <View style={[styles.carouselBlock, { width: carouselW }]}>
          {images.length > 0 ? (
            <FlatList
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => `${i}`}
              onMomentumScrollEnd={onCarouselScroll}
              renderItem={({ item: uri }) => (
                <View style={{ width: carouselW, height: CAROUSEL_H }}>
                  <Image source={{ uri }} style={styles.carouselImg} resizeMode="cover" />
                </View>
              )}
              getItemLayout={(_, index) => ({
                length: carouselW,
                offset: carouselW * index,
                index,
              })}
            />
          ) : (
            <View style={[styles.carouselImg, styles.phImg, { width: carouselW }]}>
              <Ionicons name="image-outline" size={48} color={C.muted} />
            </View>
          )}
          {images.length > 1 ? (
            <View style={styles.counterWrap}>
              <View style={styles.counterPill}>
                <Text style={styles.counterTxt}>
                  {imgIndex + 1}/{images.length}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
        {images.length > 1 ? (
          <View style={styles.dots}>
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, i === imgIndex && styles.dotOn]} />
            ))}
          </View>
        ) : null}

        <View style={styles.inner}>
          <View style={styles.catPill}>
            <Text style={styles.catPillTxt}>{item.category}</Text>
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.titleRow}>
            {item.donationMode === "committee" && (
  <Pressable
    style={[styles.condBadge, { backgroundColor: "#1976D2" }]}
    onPress={() => {
      if (item.committeeUid) {
        router.push({
          pathname: "/(private)/committee/[uid]" as any,
          params: { uid: item.committeeUid },
        });
      }
    }}
  >
    <Text style={[styles.condBadgeTxt, { color: "#fff" }]}>Via Committee — View Info</Text>
  </Pressable>
)}
            {item.condition ? (
              <View style={styles.condBadge}>
                <Text style={styles.condBadgeTxt}>{item.condition}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.userCard}>
            <Pressable
              style={styles.userTop}
              onPress={() => {
                if (item?.ownerId) {
                  router.push({
                    pathname: "/(private)/user/[uid]" as any,
                    params: { uid: item.ownerId },
                  });
                }
              }}
            >
              {owner?.avatarUrl ? (
                <Image source={{ uri: owner.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPh]}>
                  <Text style={styles.avatarInitial}>
                    {(owner?.name ?? "D").charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName}>{owner?.name ?? "Donor"}</Text>
                  {owner?.verified ? (
                    <Ionicons name="checkmark-circle" size={18} color={C.green} />
                  ) : null}
                </View>
                <Text style={styles.userMeta}>ID: {displayId}</Text>
                <Text style={styles.userMeta}>{postedLabel}</Text>
                <View style={styles.locRow}>
                  <Ionicons name="location-outline" size={14} color={C.muted} />
                  <Text style={styles.userMeta}>{item.city ?? "Jordan"}</Text>
                </View>
              </View>
            </Pressable>
            {!isOwner ? (
              <Pressable style={styles.contactOutline} onPress={openContactOrLogin}>
                <Text style={styles.contactOutlineTxt}>
                  {canContact ? "Contact Donor" : "Contact (after approval)"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.secTitle}>Description</Text>
          <Text style={styles.desc}>{descShown}</Text>
          {descLong ? (
            <Pressable onPress={() => setDescExpanded(!descExpanded)}>
              <Text style={styles.readMore}>{descExpanded ? "Show less" : "Read more"}</Text>
            </Pressable>
          ) : null}

          <View style={styles.grid}>
            <DetailCell icon="sparkles-outline" label="Condition" value={item.condition ?? "—"} />
            <DetailCell icon="location-outline" label="Location" value={item.city ?? "Jordan"} />
            <DetailCell
              icon="calendar-outline"
              label="Posted"
              value={formatDateLabel(item.createdAt)}
            />
            <DetailCell icon="calendar-outline" label="Expires" value={expiresGridVal} />
            <DetailCell
              icon="eye-outline"
              label="Views"
              value={String(item.viewCount ?? 0)}
            />
          </View>

          {specs}
         {!isCommitteeView && (isOwner ? (
  <Pressable style={styles.primaryBtn} onPress={() => router.push("/my-requests")}>
    <Text style={styles.primaryBtnTxt}>View requests</Text>
  </Pressable>
) : myRequest?.status === "approved" || canContact ? (
  <Pressable
    style={styles.primaryBtn}
    onPress={() => guestGate(() => setContactOpen(true))}
  >
    <Text style={styles.primaryBtnTxt}>Contact Donor</Text>
  </Pressable>
          ) : myRequest?.status === "pending" ? (
            <View style={[styles.primaryBtn, styles.primaryBtnDisabled]}>
              <Text style={styles.primaryBtnTxt}>Request pending</Text>
            </View>
          ) : item.status === "available" || item.status === "requested" ? (
  item.donationMode === "committee" ? (
  <View>
    <Pressable
      style={[styles.primaryBtn, requestSubmitting && { opacity: 0.7 }]}
      disabled={requestSubmitting}
      onPress={() => guestGate(() => void onRequestDonation())}
    >
      <Text style={styles.primaryBtnTxt}>
        {requestSubmitting ? "Sending…" : "Request via Committee"}
      </Text>
    </Pressable>
    <Pressable
      style={[styles.primaryBtn, { marginTop: 10, backgroundColor: "#1976D2" }]}
      onPress={() => {
        if (item.committeeUid) {
          router.push({
            pathname: "/(private)/committee/[uid]" as any,
            params: { uid: item.committeeUid },
          });
        }
      }}
    >
      <Text style={styles.primaryBtnTxt}>View Committee Info</Text>
    </Pressable>
  </View>
  ) : (
    <Pressable
      style={[styles.primaryBtn, requestSubmitting && { opacity: 0.7 }]}
      disabled={requestSubmitting}
      onPress={() => guestGate(() => void onRequestDonation())}
    >
      <Text style={styles.primaryBtnTxt}>
        {requestSubmitting ? "Sending…" : "Request donation"}
      </Text>
    </Pressable>
  )
          ) : (
            <View style={[styles.primaryBtn, styles.primaryBtnDisabled]}>
              <Text style={styles.primaryBtnTxt}>Not available</Text>
            </View>
          ))}

          <View style={styles.secActions}>
            <Pressable
              style={styles.secBtn}
              onPress={() =>
                guestGate(() => {
                  if (!id) return;
                  toggleFavoriteId(String(id)).then(setFavorited);
                })
              }
            >
              <Ionicons
                name={favorited ? "heart" : "heart-outline"}
                size={18}
                color={favorited ? "#E24B4A" : C.primary}
              />
              <Text style={styles.secBtnTxt}>{favorited ? "Saved" : "Save to Favorites"}</Text>
            </Pressable>
            <Pressable style={styles.secBtn} onPress={() => setReportOpen(true)}>
              <Ionicons name="flag-outline" size={18} color={C.primary} />
              <Text style={styles.secBtnTxt}>Report Listing</Text>
            </Pressable>
            <Pressable style={styles.secBtn} onPress={() => setShareOpen(true)}>
              <Ionicons name="share-outline" size={18} color={C.primary} />
              <Text style={styles.secBtnTxt}>Share</Text>
            </Pressable>
          </View>

          {similar.length > 0 ? (
            <>
              <Text style={[styles.secTitle, { marginTop: 8 }]}>Similar Donations</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.simRow}
              >
                {similar.map((s) => (
                  <Pressable
                    key={s.id}
                    style={styles.simCard}
                    onPress={() => router.push({ pathname: "/item/[id]", params: { id: s.id } })}
                  >
                    <View style={styles.simImgWrap}>
                      {s.imageUrl ? (
                        <Image source={{ uri: s.imageUrl }} style={styles.simImg} />
                      ) : (
                        <View style={[styles.simImg, styles.phImg]}>
                          <Ionicons name="image-outline" size={22} color={C.muted} />
                        </View>
                      )}
                      <Pressable
                        style={styles.simHeart}
                        onPress={() =>
                          guestGate(() => {
                            toggleFavoriteId(s.id);
                          })
                        }
                        hitSlop={8}
                      >
                        <Ionicons name="heart-outline" size={16} color={C.primary} />
                      </Pressable>
                    </View>
                    <Text style={styles.simCat} numberOfLines={1}>
                      {s.category}
                    </Text>
                    <Text style={styles.simTitle} numberOfLines={2}>
                      {s.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>
      </ScrollView>

      {!isCommitteeView && <PrivateBottomNav active="donations" />}

      <Modal transparent visible={loginOpen} animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setLoginOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Sign In Required</Text>
            <Text style={styles.modalMsg}>Please login to perform this action</Text>
            <Pressable
              style={styles.modalPrimary}
              onPress={() => {
                setLoginOpen(false);
                router.push("/login");
              }}
            >
              <Text style={styles.modalPrimaryTxt}>Login</Text>
            </Pressable>
            <Pressable
              style={styles.modalOutline}
              onPress={() => {
                setLoginOpen(false);
                router.push("/sign-up");
              }}
            >
              <Text style={styles.modalOutlineTxt}>Sign Up</Text>
            </Pressable>
            <Pressable onPress={() => setLoginOpen(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={contactOpen} animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setContactOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitleSm}>How do you want to contact?</Text>
            <Pressable style={styles.optRow} onPress={onContactMessage}>
              <Ionicons name="chatbubble-outline" size={22} color={C.primary} />
              <Text style={styles.optTxt}>Send Message</Text>
            </Pressable>
            {canContact && (contactSecrets?.contactNumber || (isOwner && item.contactNumber) || owner?.phone) ? (
              <Pressable style={styles.optRow} onPress={onContactCall}>
                <Ionicons name="call-outline" size={22} color={C.primary} />
                <Text style={styles.optTxt}>Call</Text>
              </Pressable>
            ) : null}
            {waDigits.length >= 9 ? (
              <Pressable style={styles.optRow} onPress={onContactWhatsApp}>
                <Ionicons name="logo-whatsapp" size={22} color={C.primary} />
                <Text style={styles.optTxt}>WhatsApp</Text>
              </Pressable>
            ) : null}
            {canContact &&
            (contactSecrets?.contactEmail || (isOwner && item.contactEmail) || owner?.email) ? (
              <Pressable style={styles.optRow} onPress={onContactEmail}>
                <Ionicons name="mail-outline" size={22} color={C.primary} />
                <Text style={styles.optTxt}>Email</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setContactOpen(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={shareOpen} animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShareOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.shareHead}>
              <Text style={styles.modalTitleSm}>Share this donation</Text>
              <Pressable onPress={() => setShareOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={C.text} />
              </Pressable>
            </View>
            <Pressable style={styles.optRow} onPress={onShareNative}>
              <Ionicons name="link-outline" size={22} color={C.primary} />
              <Text style={styles.optTxt}>Share link</Text>
            </Pressable>
            {waDigits.length >= 9 ? (
              <Pressable
                style={styles.optRow}
                onPress={() => {
                  const url = encodeURIComponent(Linking.createURL(`/item/${id}`));
                  Linking.openURL(`https://wa.me/?text=${url}`);
                  setShareOpen(false);
                }}
              >
                <Ionicons name="logo-whatsapp" size={22} color={C.primary} />
                <Text style={styles.optTxt}>WhatsApp</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.optRow}
              onPress={() => {
                const url = Linking.createURL(`/item/${id}`);
                Linking.openURL(`https://t.me/share/url?url=${encodeURIComponent(url)}`);
                setShareOpen(false);
              }}
            >
              <Ionicons name="paper-plane-outline" size={22} color={C.primary} />
              <Text style={styles.optTxt}>Telegram</Text>
            </Pressable>
            <Pressable
              style={styles.optRow}
              onPress={() => {
                const url = Linking.createURL(`/item/${id}`);
                Linking.openURL(
                  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
                );
                setShareOpen(false);
              }}
            >
              <Ionicons name="logo-facebook" size={22} color={C.primary} />
              <Text style={styles.optTxt}>Facebook</Text>
            </Pressable>
            <Pressable
              style={styles.optRow}
              onPress={() => {
                Linking.openURL(`mailto:?subject=${encodeURIComponent(item.title)}&body=${encodeURIComponent(Linking.createURL(`/item/${id}`))}`);
                setShareOpen(false);
              }}
            >
              <Ionicons name="mail-outline" size={22} color={C.primary} />
              <Text style={styles.optTxt}>Email</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={reportOpen} animationType="fade">
        <Pressable style={styles.overlay} onPress={() => !reportSubmitting && setReportOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.shareHead}>
              <Text style={styles.modalTitleSm}>Report this listing</Text>
              <Pressable disabled={reportSubmitting} onPress={() => setReportOpen(false)}>
                <Ionicons name="close" size={24} color={C.text} />
              </Pressable>
            </View>
            <Text style={styles.reportLabel}>Reason</Text>
            {["Scam", "Offensive", "Duplicate", "Wrong category", "Other"].map((r) => (
              <Pressable key={r} style={styles.radioRow} onPress={() => setReportReason(r)}>
                <Ionicons
                  name={reportReason === r ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={reportReason === r ? C.primary : C.muted}
                />
                <Text style={styles.optTxt}>{r}</Text>
              </Pressable>
            ))}
            <Text style={styles.reportLabel}>Details</Text>
            <TextInput
              style={styles.reportArea}
              placeholder="Additional details"
              placeholderTextColor={C.muted}
              multiline
              value={reportDetails}
              onChangeText={setReportDetails}
            />
            <Pressable
              style={[styles.modalPrimary, reportSubmitting && { opacity: 0.7 }]}
              disabled={reportSubmitting || !reportReason}
              onPress={submitReport}
            >
              <Text style={styles.modalPrimaryTxt}>{reportSubmitting ? "…" : "Submit"}</Text>
            </Pressable>
            <Pressable disabled={reportSubmitting} onPress={() => setReportOpen(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function DetailCell({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.gridCell}>
      <Ionicons name={icon} size={20} color={C.primary} />
      <Text style={styles.gridLabel}>{label}</Text>
      <Text style={styles.gridValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function SpecBlock({ title, rows }: { title: string; rows: { k: string; v: string }[] }) {
  if (!rows.length) return null;
  return (
    <View style={styles.specBlock}>
      <Text style={styles.secTitle}>{title}</Text>
      {rows.map((r) => (
        <View key={r.k} style={styles.specRow}>
          <Text style={styles.specKey}>{r.k}</Text>
          <Text style={styles.specVal}>{r.v}</Text>
        </View>
      ))}
    </View>
  );
}

function renderCategorySpecs(item: ItemDoc) {
  const k = categoryFormKind(item.category);
  if (k === "food") {
    return (
      <SpecBlock
        title="Food details"
        rows={[
          { k: "Expiry date", v: item.foodExpiry ?? formatDateLabel(item.expiresAt) },
          { k: "Prepared", v: item.preparedAt ?? "—" },
          { k: "Type", v: item.foodType ?? "—" },
          {
            k: "Storage",
            v: [
              item.storageRefrigeration ? "Needs refrigeration" : null,
              item.storageFrozen ? "Frozen" : null,
              item.storageRoomTemp ? "Room temperature" : null,
            ]
              .filter(Boolean)
              .join(", ") || "—",
          },
          { k: "Allergens", v: item.allergens?.trim() || "None listed" },
          { k: "Packaging", v: item.packaging ?? "—" },
        ]}
      />
    );
  }
  if (k === "clothes") {
    return (
      <SpecBlock
        title="Clothing details"
        rows={[
          { k: "Size", v: item.clothesSize ?? "—" },
          { k: "For", v: item.clothesGender ?? "—" },
          { k: "Material", v: item.material ?? "—" },
          { k: "Fit", v: item.fit ?? "—" },
          { k: "Wear notes", v: item.description ? "See description" : "—" },
        ]}
      />
    );
  }
  if (k === "books") {
    return (
      <SpecBlock
        title="Book details"
        rows={[
          { k: "Title", v: item.bookTitle ?? item.title },
          { k: "Author", v: item.bookAuthor ?? "—" },
          { k: "Language", v: item.bookLanguage ?? "—" },
          { k: "ISBN", v: item.bookIsbn ?? "—" },
          { k: "Edition", v: item.bookEdition ?? "—" },
          { k: "Genre", v: item.bookGenre ?? "—" },
        ]}
      />
    );
  }
  if (k === "beauty") {
    return (
      <SpecBlock
        title="Beauty & health"
        rows={[
          { k: "Expiry date", v: item.beautyExpiry ?? formatDateLabel(item.expiresAt) },
          { k: "Brand", v: item.beautyBrand ?? "—" },
          { k: "Type", v: item.productType ?? "—" },
          { k: "Status", v: item.beautyCondition ?? "—" },
          { k: "Quantity", v: item.beautyQuantity ?? "—" },
        ]}
      />
    );
  }
  if (k === "electronics") {
    return (
      <SpecBlock
        title="Electronics"
        rows={[
          { k: "Brand / model", v: item.brandModel ?? "—" },
          { k: "Working status", v: item.workingStatus ?? "—" },
          { k: "Accessories", v: item.accessories?.length ? item.accessories.join(", ") : "—" },
        ]}
      />
    );
  }
  if (k === "services") {
    return (
      <SpecBlock
        title="Service details"
        rows={[
          { k: "Service type", v: item.serviceType ?? "—" },
          { k: "Duration", v: item.serviceDuration ?? "—" },
          { k: "Experience", v: item.experienceLevel ?? "—" },
        ]}
      />
    );
  }
  if (k === "education") {
    return (
      <SpecBlock
        title="Education & training"
        rows={[
          { k: "Subject / course", v: item.courseSubject ?? "—" },
          { k: "Level", v: item.eduLevel ?? "—" },
          { k: "Format", v: item.eduFormat ?? "—" },
          { k: "Duration", v: item.eduDuration ?? "—" },
        ]}
      />
    );
  }
  if (k === "sports") {
    return (
      <SpecBlock
        title="Sports & fitness"
        rows={[{ k: "Equipment type", v: item.equipmentType ?? "—" }]}
      />
    );
  }
  if (k === "pets") {
    return (
      <SpecBlock
        title="Pets"
        rows={[
          { k: "Pet type", v: item.petType ?? "—" },
          { k: "Item type", v: item.petItemType ?? "—" },
        ]}
      />
    );
  }
  return (
    <SpecBlock
      title="Pickup & availability"
      rows={[
        { k: "Pickup location", v: item.pickupLocation ?? item.city ?? "—" },
        { k: "Availability", v: item.availabilityNote ?? "—" },
        { k: "Condition notes", v: item.condition ?? "—" },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === "ios" ? 52 : 28,
  },
  center: { justifyContent: "center", alignItems: "center", padding: 24 },
  loadingTxt: { marginTop: 12, color: C.muted, fontWeight: "600" },
  errTitle: { fontSize: 18, fontWeight: "800", color: C.text, marginBottom: 16 },
  scrollInner: { paddingBottom: 110, alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    maxWidth: MAX_W,
    width: "100%",
    alignSelf: "center",
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerIcon: { padding: 8, minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" },
  carouselBlock: {
    height: CAROUSEL_H,
    backgroundColor: C.inputBg,
    position: "relative",
    alignSelf: "center",
  },
  carouselImg: { width: "100%", height: CAROUSEL_H },
  phImg: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: C.inputBg,
  },
  counterWrap: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  counterPill: {
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  counterTxt: { fontSize: 12, fontWeight: "700", color: C.text },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.border },
  dotOn: { backgroundColor: C.primary, width: 8 },
  inner: { width: "100%", maxWidth: MAX_W, paddingHorizontal: 24, paddingTop: 16 },
  catPill: {
    alignSelf: "flex-start",
    backgroundColor: C.inputBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 24,
    marginBottom: 10,
  },
  catPillTxt: { fontSize: 12, fontWeight: "700", color: C.primary },
  title: { fontSize: 18, fontWeight: "800", color: C.text, lineHeight: 24 },
  titleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 },
  condBadge: {
    backgroundColor: C.tan,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  condBadgeTxt: { fontSize: 12, fontWeight: "700", color: C.primary },
  userCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    ...cardShadowSoft(),
  },
  userTop: { flexDirection: "row", gap: 12, marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPh: { backgroundColor: C.tan, justifyContent: "center", alignItems: "center" },
  avatarInitial: { fontSize: 18, fontWeight: "800", color: C.text },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { fontSize: 14, fontWeight: "800", color: C.text },
  userMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  contactOutline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  contactOutlineTxt: { fontSize: 15, fontWeight: "700", color: C.primary },
  secTitle: { fontSize: 14, fontWeight: "800", color: C.text, marginTop: 20, marginBottom: 8 },
  desc: { fontSize: 13, color: C.text, lineHeight: 20 },
  readMore: { marginTop: 6, fontSize: 13, fontWeight: "700", color: C.primary },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
    justifyContent: "space-between",
  },
  gridCell: {
    width: "31%",
    minWidth: 100,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    ...cardShadowSoft(),
  },
  gridLabel: { fontSize: 11, color: C.muted, fontWeight: "600" },
  gridValue: { fontSize: 12, color: C.text, fontWeight: "700" },
  primaryBtn: {
    backgroundColor: C.secondary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  primaryBtnTxt: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  primaryBtnDisabled: { backgroundColor: "#B8B0A8" },
  secActions: { marginTop: 16, gap: 10 },
  secBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  secBtnTxt: { fontSize: 14, fontWeight: "700", color: C.primary },
  simRow: { gap: 12, paddingVertical: 8 },
  simCard: {
    width: 140,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 10,
    ...cardShadowSoft(),
  },
  simImgWrap: { position: "relative", borderRadius: 8, overflow: "hidden", marginBottom: 8 },
  simImg: { width: "100%", height: 88, borderRadius: 8 },
  simHeart: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 12, padding: 4 },
  simCat: { fontSize: 11, color: C.muted, fontWeight: "600" },
  simTitle: { fontSize: 12, fontWeight: "800", color: C.text, marginTop: 4, minHeight: 32 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 20,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: C.text, marginBottom: 8 },
  modalTitleSm: { fontSize: 14, fontWeight: "800", color: C.text, marginBottom: 12 },
  modalMsg: { fontSize: 14, color: C.muted, marginBottom: 16 },
  modalPrimary: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  modalPrimaryTxt: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  modalOutline: {
    borderWidth: 1,
    borderColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  modalOutlineTxt: { color: C.primary, fontWeight: "800", fontSize: 15 },
  modalCancel: { textAlign: "center", color: C.muted, fontWeight: "600", marginTop: 8 },
  optRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  optTxt: { fontSize: 15, fontWeight: "600", color: C.text },
  shareHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  reportLabel: { fontSize: 13, fontWeight: "700", color: C.text, marginTop: 8, marginBottom: 6 },
  reportArea: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    borderRadius: 12,
    minHeight: 90,
    padding: 12,
    textAlignVertical: "top",
    marginBottom: 12,
    fontSize: 14,
    color: C.text,
  },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: C.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  outlineBtnTxt: { color: C.primary, fontWeight: "700" },
  specBlock: { marginTop: 12 },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  specKey: { fontSize: 12, color: C.muted, flex: 1, fontWeight: "600" },
  specVal: { fontSize: 12, color: C.text, flex: 1, fontWeight: "700", textAlign: "right" },
});
