import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from "react-native";
import { peerFromConv } from "@/lib/chat-utils";
import { canChatWithPeer } from "@/lib/donation-requests";
import { getAuthUser } from "@/lib/auth-user";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { safeGoBack } from "@/lib/navigation";
import { uploadToCloudinary } from "@/lib/cloudinaryService";
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

const PAGE = 80;

type Msg = {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp | null;
  readBy: string[];
  imageUrl?: string;
  replyTo?: { text: string; senderId: string };
};

type ItemMini = {
  title: string;
  category: string;
  imageUrl?: string;
  imageUrls?: string[];
};

function formatBubbleTime(ts: Timestamp | null): string {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(ts: Timestamp | null): string | null {
  if (!ts?.toDate) return null;
  const d = ts.toDate();
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (msgDay === dayStart) return "Today";
  if (dayStart - msgDay === 86400_000) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function LinkedText({
  text,
  baseStyle,
  linkColor,
}: {
  text: string;
  baseStyle: TextStyle;
  linkColor: string;
}) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return (
    <Text style={baseStyle}>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <Text
            key={i}
            style={[baseStyle, { color: linkColor, textDecorationLine: "underline" }]}
            onPress={() => Linking.openURL(part)}
          >
            {part}
          </Text>
        ) : (
          <Text key={i} style={baseStyle}>
            {part}
          </Text>
        ),
      )}
    </Text>
  );
}

// ─── Fix 4: ChatBubble extracted as React.memo component ───────────────────
type BubbleProps = {
  item: Msg;
  ascIndex: number;
  ascMsgs: Msg[];
  me: string;
  peerId: string | null;
  peerName: string;
  onLongPress: (msg: Msg) => void;
  onImagePress: (uri: string) => void;
};

const ChatBubble = React.memo(
  function ChatBubble({ item, ascIndex, ascMsgs, me, peerId, peerName, onLongPress, onImagePress }: BubbleProps) {
    const mine = item.senderId === me;
    const prevOlder = ascIndex > 0 ? ascMsgs[ascIndex - 1] : null;
    const nextNewer = ascIndex < ascMsgs.length - 1 ? ascMsgs[ascIndex + 1] : null;
    const showAvatar =
      !mine &&
      (!prevOlder ||
        prevOlder.senderId !== peerId ||
        !timesNear(prevOlder.createdAt, item.createdAt));
    const showTail = !nextNewer || nextNewer.senderId !== item.senderId;

    const readOk =
      mine && peerId && (item.readBy ?? []).includes(peerId) ? "read" : mine ? "sent" : "";

    return (
      <View style={[styles.bubbleRow, mine ? styles.rowRight : styles.rowLeft]}>
        {!mine && showAvatar ? (
          <View style={styles.bubbleAvatar}>
            <Text style={styles.bubbleAvatarTxt}>{peerName.charAt(0).toUpperCase()}</Text>
          </View>
        ) : !mine ? (
          <View style={{ width: 32 }} />
        ) : null}
        <Pressable
          style={{ maxWidth: "85%" }}
          onLongPress={() => onLongPress(item)}
          delayLongPress={350}
        >
          <View
            style={[
              mine ? styles.bubbleSent : styles.bubbleRecv,
              !showTail && (mine ? styles.tailSent : styles.tailRecv),
            ]}
          >
            {item.replyTo ? (
              <View style={[styles.replyQuote, mine ? styles.replyQuoteSent : styles.replyQuoteRecv]}>
                <Text
                  style={[styles.replyQuoteTxt, mine ? styles.replyQuoteTxtSent : styles.replyQuoteTxtRecv]}
                  numberOfLines={2}
                >
                  {item.replyTo.text}
                </Text>
              </View>
            ) : null}
            {item.imageUrl ? (
              <Pressable onPress={() => onImagePress(item.imageUrl!)}>
                <Image source={{ uri: item.imageUrl }} style={styles.msgImg} />
              </Pressable>
            ) : null}
            {item.text ? (
            item.text === "[deleted]" ? (
              <Text style={[mine ? styles.sentTxt : styles.recvTxt, { fontStyle: "italic", opacity: 0.6 }]}>
                            This message was deleted
            </Text>
            ) : mine ? (
           <Text style={styles.sentTxt}>{item.text}</Text>
           ) : (
         <LinkedText text={item.text} baseStyle={styles.recvTxt} linkColor={C.primary} />
         )
         ) : null}
          </View>
          <View style={[styles.metaRow, mine ? styles.metaRight : styles.metaLeft]}>
            <Text style={[styles.metaTime, mine && styles.metaTimeSent]}>
              {formatBubbleTime(item.createdAt)}
            </Text>
            {mine ? (
              <Ionicons
                name={readOk === "read" ? "checkmark-done" : "checkmark-done-outline"}
                size={14}
                color={readOk === "read" ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)"}
                style={{ marginLeft: 4 }}
              />
            ) : null}
          </View>
        </Pressable>
      </View>
    );
  },
  (prev, next) =>
  prev.item.id === next.item.id &&
  prev.item.readBy?.length === next.item.readBy?.length &&
  prev.item.text === next.item.text &&
  prev.item.imageUrl === next.item.imageUrl && // ← أضف هاد
  prev.ascIndex === next.ascIndex,
);
// ───────────────────────────────────────────────────────────────────────────

export default function ChatThreadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ 
  conversationId: string; 
  itemId?: string; 
  committeeChat?: string; 
}>();
const itemIdParam = typeof params.itemId === "string" ? params.itemId : undefined;
const committeeChat = params.committeeChat === "true";
  const conversationId = typeof params.conversationId === "string" ? params.conversationId : "";

  const { limitedGuest } = useAuth();
  const me = getAuthUser()?.uid ?? "";
  const peerId = useMemo(() => (me ? peerFromConv(conversationId, me) : null), [conversationId, me]);
  const [chatAllowed, setChatAllowed] = useState<boolean | null>(null);

  const [peerName, setPeerName] = useState("User");
  const [onlineHint, setOnlineHint] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);

  // ─── Fix 3: added blockedBy to conv type ───────────────────────────────
  const [conv, setConv] = useState<{
    blocked?: boolean;
    blockedBy?: string;
    itemId?: string;
    typingUid?: string | null;
    typingAt?: Timestamp | null;
  }>({});
  // ───────────────────────────────────────────────────────────────────────

  const [itemCard, setItemCard] = useState<ItemMini | null>(null);
  const [showItemCard, setShowItemCard] = useState(true);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [msgMenu, setMsgMenu] = useState<Msg | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // ─── Fix 1: both refs at component level, no duplicates inside function ─
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ───────────────────────────────────────────────────────────────────────

  const listRef = useRef<FlatList>(null);

  const ascMsgs = useMemo(() => [...messages].reverse(), [messages]);

  const listRows = useMemo(() => {
    const rows: ({ type: "sep"; label: string } | { type: "msg"; msg: Msg; ascIndex: number })[] = [];
    let lastDay: string | null = null;
    ascMsgs.forEach((msg, ascIndex) => {
      const label = dayLabel(msg.createdAt);
      if (label && label !== lastDay) {
        rows.push({ type: "sep", label });
        lastDay = label;
      }
      rows.push({ type: "msg", msg, ascIndex });
    });
    return rows;
  }, [ascMsgs]);

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
  }, [listRows.length, messages.length]);

  useEffect(() => {
    if (limitedGuest || !me || !peerId) {
      setChatAllowed(false);
      return;
    }
    let cancelled = false;
    canChatWithPeer(me, peerId, itemIdParam).then((ok) => {
      if (!cancelled) setChatAllowed(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [limitedGuest, me, peerId, itemIdParam]);

 useEffect(() => {
  if (limitedGuest || !me || !peerId) {
    setChatAllowed(false);
    return;
  }
  if (committeeChat) {
    setChatAllowed(true);
    return;
  }
  let cancelled = false;
  canChatWithPeer(me, peerId, itemIdParam).then((ok) => {
    if (!cancelled) setChatAllowed(ok);
  });
  return () => { cancelled = true; };
}, [limitedGuest, me, peerId, itemIdParam, committeeChat]);

  const blocked = !!conv.blocked;
  const typingVisible =
    conv.typingUid &&
    conv.typingUid === peerId &&
    conv.typingAt?.toDate &&
    Date.now() - conv.typingAt.toDate().getTime() < 6000;

  const ensureConversation = useCallback(async () => {
    if (!me || !peerId || !conversationId) return;
    const convRef = doc(db, "conversations", conversationId);
    const snap = await getDoc(convRef);
    const myName =
      (await getDoc(doc(db, "users", me))).data()?.name ??
      getAuthUser()?.email?.split("@")[0] ??
      "You";
    const peerSnap = await getDoc(doc(db, "users", peerId));
    const namePeer = peerSnap.data()?.name ?? "User";
    setPeerName(namePeer);

    if (!snap.exists()) {
      await setDoc(convRef, {
        participants: [me, peerId].sort(),
        participantNames: { [me]: myName, [peerId]: namePeer },
        lastMessageText: "",
        lastMessageAt: serverTimestamp(),
        unreadBy: { [me]: 0, [peerId]: 0 },
        ...(itemIdParam ? { itemId: itemIdParam } : {}),
      });
    } else {
      await setDoc(
        convRef,
        {
          participantNames: { [me]: myName, [peerId]: namePeer },
          ...(itemIdParam ? { itemId: itemIdParam } : {}),
        },
        { merge: true },
      );
    }

    const data = snap.data() as { itemId?: string } | undefined;
    const iid = itemIdParam ?? data?.itemId;
    if (iid) {
      const it = await getDoc(doc(db, "items", iid));
      if (it.exists()) {
        const d = it.data() as ItemMini;
        setItemCard({
          title: d.title,
          category: d.category,
          imageUrls: d.imageUrls,
          imageUrl: d.imageUrls?.[0] ?? d.imageUrl,
        });
      }
    }
  }, [conversationId, itemIdParam, me, peerId]);

  useEffect(() => {
    if (!me || !peerId) {
      Alert.alert("Chat unavailable", "Missing participant.");
      safeGoBack(router, "/chats");
      return;
    }
    if (chatAllowed !== true) return;
    void ensureConversation();
  }, [ensureConversation, me, peerId, router, chatAllowed]);

  useEffect(() => {
    if (!conversationId || !me) return;
    const convRef = doc(db, "conversations", conversationId);
    const unsub = onSnapshot(convRef, (s) => {
      // ─── Fix 3: read blockedBy from snapshot ─────────────────────────
      const d = s.data() as {
        blocked?: boolean;
        blockedBy?: string;
        itemId?: string;
        typingUid?: string | null;
        typingAt?: Timestamp | null;
        lastMessageAt?: Timestamp | null;
      };
      setConv({
        blocked: d.blocked,
        blockedBy: d.blockedBy,
        itemId: d.itemId,
        typingUid: d.typingUid ?? null,
        typingAt: d.typingAt ?? null,
      });
      // ─────────────────────────────────────────────────────────────────
      const lm = d.lastMessageAt;
      if (lm?.toDate && peerId) {
        const age = Date.now() - lm.toDate().getTime();
        setOnlineHint(age < 120_000);
      }
    });
    return unsub;
  }, [conversationId, me, peerId]);

  useEffect(() => {
    if (!conversationId) return;
    const q = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("createdAt", "desc"),
      limit(PAGE),
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows: Msg[] = [];
      snap.forEach((d) => {
        const x = d.data() as Omit<Msg, "id">;
        rows.push({ id: d.id, ...x });
      });
      setMessages(rows);
    });
    return unsub;
  }, [conversationId]);

  const markRead = useCallback(async () => {
  if (!conversationId || !me || !peerId) return;
  
  const unread = messages.filter(
    (m) => m.senderId !== me && !(m.readBy ?? []).includes(me)
  );
  
  if (unread.length === 0) return; 
  
  const batch = writeBatch(db);
  unread.forEach((m) => {
    batch.update(doc(db, "conversations", conversationId, "messages", m.id), {
      readBy: arrayUnion(me),
    });
  });
  batch.update(doc(db, "conversations", conversationId), {
    [`unreadBy.${me}`]: 0,
  });
  await batch.commit().catch(() => {});
}, [conversationId, me, peerId, messages]); 

useEffect(() => {
  void markRead();
}, [markRead]);

  // ─── Fix 1: useRef calls removed from inside function body ─────────────
  const sendTypingPing = () => {
    if (!conversationId || !me || blocked) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (clearTypingTimer.current) clearTimeout(clearTypingTimer.current);

    typingTimer.current = setTimeout(async () => {
      await updateDoc(doc(db, "conversations", conversationId), {
        typingUid: me,
        typingAt: serverTimestamp(),
      }).catch(() => {});

      clearTypingTimer.current = setTimeout(async () => {
        await updateDoc(doc(db, "conversations", conversationId), {
          typingUid: null,
        }).catch(() => {});
      }, 3000);
    }, 400);
  };
  // ───────────────────────────────────────────────────────────────────────

  const clearTyping = async () => {
    if (!conversationId) return;
    await updateDoc(doc(db, "conversations", conversationId), { typingUid: null }).catch(() => {});
  };

  const sendMessage = async (extra?: { imageUrl?: string; text?: string }) => {
    const text = (extra?.text ?? input).trim();
    if (chatAllowed !== true) {
      Alert.alert("Request required", "Messaging is available after request approval.");
      return;
    }
    if (!conversationId || !me || !peerId || blocked) return;
    if (!text && !extra?.imageUrl) return;
    setSending(true);
    await clearTyping();
    try {
      const convRef = doc(db, "conversations", conversationId);
      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        senderId: me,
        text: text || (extra?.imageUrl ? "Photo" : ""),
        createdAt: serverTimestamp(),
        readBy: [me],
        ...(extra?.imageUrl ? { imageUrl: extra.imageUrl } : {}),
        ...(replyTo
          ? { replyTo: { text: replyTo.text, senderId: replyTo.senderId } }
          : {}),
      });
      await updateDoc(convRef, {
        lastMessageText: text || "Photo",
        lastMessageAt: serverTimestamp(),
        [`unreadBy.${peerId}`]: increment(1),
        [`unreadBy.${me}`]: 0,
      });
      setInput("");
      setReplyTo(null);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as Error).message) : "Send failed";
      Alert.alert("Could not send", msg);
    } finally {
      setSending(false);
    }
  };

  const pickImage = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission required", "Please allow photo access.");
    return;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images" as ImagePicker.MediaType,
    quality: 0.85,
  });
  if (res.canceled || !me) return;
  try {
    const uri = res.assets[0]?.uri;
    if (!uri) return;
    setSending(true); 
    const url = await uploadToCloudinary(uri);
    await sendMessage({ imageUrl: url, text: "" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Try again.";
    Alert.alert("Upload failed", msg); 
  } finally {
    setSending(false);
  }
};

  const attachmentOptions = () => {
    Alert.alert("Attachment", undefined, [
      { text: "Photo", onPress: () => void pickImage() },
      { text: "Donation link", onPress: () => router.push("/donations") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // ─── Fix 3: onBlock saves blockedBy: me ────────────────────────────────
  const onBlock = () => {
    Alert.alert("Block this user?", "You will not receive messages from them in this chat.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          await updateDoc(doc(db, "conversations", conversationId), {
            blocked: true,
            blockedBy: me,
          });
          Alert.alert("Blocked", "You've blocked this user.");
        },
      },
    ]);
  };

  // ─── Fix 3: onUnblock checks blockedBy and clears field ────────────────
  const onUnblock = async () => {
    if (conv.blockedBy !== me) {
      Alert.alert("Cannot unblock", "Only the person who blocked can unblock.");
      return;
    }
    await updateDoc(doc(db, "conversations", conversationId), {
      blocked: false,
      blockedBy: deleteField(),
    });
    Alert.alert("Unblocked", "You can message each other again.");
  };
  // ───────────────────────────────────────────────────────────────────────

  const onDeleteChat = () => {
  Alert.alert("Delete conversation", "This will delete the chat for you only.", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Delete",
      style: "destructive",
      onPress: async () => {
        await updateDoc(doc(db, "conversations", conversationId), {
          archivedFor: arrayUnion(me),
        });
        safeGoBack(router, "/chats");
      },
    },
  ]);
};

  const submitReport = async () => {
    if (!reportReason) return;
    await addDoc(collection(db, "conversation_reports"), {
      conversationId,
      reason: reportReason,
      details: reportDetails.trim(),
      reporterId: me,
      createdAt: serverTimestamp(),
    });
    setReportOpen(false);
    setReportReason(null);
    setReportDetails("");
    Alert.alert("Submitted", "Thanks for letting us know.");
  };

  if (!conversationId || !peerId) {
    return (
      <View style={[styles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  // ─── Fix 2: show loader while checking chat permission ─────────────────
  if (chatAllowed === null && !limitedGuest) {
    return (
      <View style={[styles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={{ marginTop: 12, color: C.muted, fontSize: 14 }}>
          Checking access...
        </Text>
      </View>
    );
  }
  // ───────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
  style={styles.screen}
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
>
      <View style={styles.header}>
        <Pressable hitSlop={12} style={styles.iconBtn} onPress={() => safeGoBack(router, "/chats")}>
          <Ionicons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName} numberOfLines={1}>
            {peerName}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: onlineHint ? C.green : C.muted }]} />
            <Text style={styles.statusTxt}>{onlineHint ? "Online" : "Offline"}</Text>
          </View>
        </View>
        <Pressable hitSlop={12} style={styles.iconBtn} onPress={() => setMenuOpen(true)}>
          <Ionicons name="ellipsis-horizontal" size={22} color={C.primary} />
        </Pressable>
      </View>

      {itemCard && showItemCard ? (
        <View style={styles.itemBanner}>
          {itemCard.imageUrl ? (
            <Image source={{ uri: itemCard.imageUrl }} style={styles.itemImg} />
          ) : (
            <View style={[styles.itemImg, styles.ph]}>
              <Ionicons name="image-outline" size={22} color={C.muted} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {itemCard.title}
            </Text>
            <Text style={styles.itemCat}>{itemCard.category}</Text>
            <Pressable
              onPress={() =>
                conv.itemId &&
                router.push({ pathname: "/item/[id]", params: { id: conv.itemId } })
              }
            >
              <Text style={styles.itemLink}>View donation</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => setShowItemCard(false)} hitSlop={10}>
            <Ionicons name="close" size={20} color={C.muted} />
          </Pressable>
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        data={listRows}
        keyExtractor={(row, idx) =>
          row.type === "sep" ? `sep-${row.label}-${idx}` : row.msg.id
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} tintColor={C.primary} />
        }
        contentContainerStyle={styles.msgList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        // ─── Fix 4: use ChatBubble memo component instead of renderBubble ──
        renderItem={({ item: row }) =>
          row.type === "sep" ? (
            <View style={styles.sepWrap}>
              <Text style={styles.sepTxt}>{row.label}</Text>
            </View>
          ) : (
            <ChatBubble
              item={row.msg}
              ascIndex={row.ascIndex}
              ascMsgs={ascMsgs}
              me={me}
              peerId={peerId}
              peerName={peerName}
              onLongPress={setMsgMenu}
              onImagePress={setPreviewUri}
            />
          )
        }
        // ─────────────────────────────────────────────────────────────────
        ListFooterComponent={
          typingVisible ? (
            <Text style={styles.typing}>{peerName.split(" ")[0] || "User"} is typing…</Text>
          ) : (
            <View style={{ height: 8 }} />
          )
        }
      />

      {/* ─── Fix 3: blocked bar shows who blocked and conditional unblock ── */}
      {blocked ? (
        <View style={styles.blockedBar}>
          <Text style={styles.blockedTxt}>
            {conv.blockedBy === me
              ? "You blocked this user."
              : "You have been blocked."}
          </Text>
          {conv.blockedBy === me ? (
            <Pressable onPress={onUnblock}>
              <Text style={styles.unblockTxt}>Unblock</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
      // ───────────────────────────────────────────────────────────────────
        <View style={styles.inputBar}>
          {replyTo ? (
            <View style={styles.replyBar}>
              <Text style={styles.replyBarTxt} numberOfLines={2}>
                Replying to: {replyTo.text}
              </Text>
              <Pressable onPress={() => setReplyTo(null)}>
                <Ionicons name="close" size={18} color={C.muted} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <Pressable style={styles.attachBtn} onPress={attachmentOptions}>
              <Ionicons name="attach-outline" size={22} color={C.primary} />
            </Pressable>
            <TextInput
              style={styles.input}
              placeholder="Type your message..."
              placeholderTextColor={C.muted}
              value={input}
              multiline
              maxLength={2000}
              onChangeText={(t) => {
                setInput(t);
                sendTypingPing();
              }}
            />
            <Pressable
              style={[styles.sendBtn, (!input.trim() || sending) && styles.sendDisabled]}
              disabled={!input.trim() || sending}
              onPress={() => void sendMessage()}
            >
              <Ionicons name="send" size={20} color={input.trim() && !sending ? C.primary : C.muted} />
            </Pressable>
          </View>
        </View>
      )}

      <Modal transparent visible={menuOpen} animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuCard}>
            {conv.itemId ? (
              <Pressable
                style={styles.menuRow}
                onPress={() => {
                  setMenuOpen(false);
                  router.push({ pathname: "/item/[id]", params: { id: conv.itemId! } });
                }}
              >
                <Text style={styles.menuTxt}>View donation</Text>
              </Pressable>
            ) : null}
            {/* ─── Fix 3: menu block/unblock respects blockedBy ─────────── */}
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                if (blocked) {
                  if (conv.blockedBy === me) void onUnblock();
                  else Alert.alert("Blocked", "You cannot unblock this conversation.");
                } else {
                  onBlock();
                }
              }}
            >
              <Text style={styles.menuTxt}>
                {blocked
                  ? conv.blockedBy === me
                    ? "Unblock user"
                    : "Blocked"
                  : "Block user"}
              </Text>
            </Pressable>
            {/* ─────────────────────────────────────────────────────────── */}
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                setReportOpen(true);
              }}
            >
              <Text style={styles.menuTxt}>Report conversation</Text>
            </Pressable>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                onDeleteChat();
              }}
            >
              <Text style={[styles.menuTxt, { color: "#C62828" }]}>Delete chat</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal transparent visible={reportOpen} animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setReportOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Report this conversation</Text>
            {["Spam", "Harassment", "Fraud", "Inappropriate", "Other"].map((r) => (
              <Pressable key={r} style={styles.radioLine} onPress={() => setReportReason(r)}>
                <Ionicons
                  name={reportReason === r ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={reportReason === r ? C.primary : C.muted}
                />
                <Text style={styles.menuTxt}>{r}</Text>
              </Pressable>
            ))}
            <TextInput
              style={styles.reportArea}
              placeholder="Details"
              placeholderTextColor={C.muted}
              multiline
              value={reportDetails}
              onChangeText={setReportDetails}
            />
            <Pressable style={styles.primaryBtn} onPress={submitReport}>
              <Text style={styles.primaryBtnTxt}>Submit</Text>
            </Pressable>
            <Pressable onPress={() => setReportOpen(false)}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={!!msgMenu} animationType="fade">
  <Pressable style={styles.overlay} onPress={() => setMsgMenu(null)}>
    <View style={styles.menuCard}>
      <Pressable
        style={styles.menuRow}
        onPress={async () => {
          if (msgMenu?.text) await Clipboard.setStringAsync(msgMenu.text);
          setMsgMenu(null);
        }}
      >
        <Text style={styles.menuTxt}>Copy</Text>
      </Pressable>
      <Pressable
        style={styles.menuRow}
        onPress={() => {
          if (msgMenu) setReplyTo(msgMenu);
          setMsgMenu(null);
        }}
      >
        <Text style={styles.menuTxt}>Reply</Text>
      </Pressable>
    </View>
  </Pressable>
</Modal>

      <Modal visible={!!previewUri} transparent animationType="fade">
        <Pressable style={styles.fullImgBg} onPress={() => setPreviewUri(null)}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.fullImg} resizeMode="contain" />
          ) : null}
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function timesNear(a: Timestamp | null, b: Timestamp | null): boolean {
  if (!a?.toDate || !b?.toDate) return false;
  return Math.abs(a.toDate().getTime() - b.toDate().getTime()) < 5 * 60 * 1000;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === "ios" ? 52 : 28 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  iconBtn: { minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerName: { fontSize: 14, fontWeight: "800", color: C.text },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusTxt: { fontSize: 12, color: C.muted },
  itemBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: C.card,
    borderRadius: 12,
    ...cardShadowSoft(),
  },
  itemImg: { width: 60, height: 60, borderRadius: 10 },
  ph: { backgroundColor: C.inputBg, justifyContent: "center", alignItems: "center" },
  itemTitle: { fontSize: 13, fontWeight: "800", color: C.text },
  itemCat: { fontSize: 12, color: C.muted, marginTop: 2 },
  itemLink: { fontSize: 12, color: C.primary, fontWeight: "700", marginTop: 4 },
  msgList: { paddingHorizontal: 16, paddingVertical: 12 },
  sepWrap: { alignItems: "center", marginVertical: 10 },
  sepTxt: { fontSize: 12, color: C.muted, fontWeight: "600" },
  bubbleRow: { flexDirection: "row", marginVertical: 6, alignItems: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end", alignSelf: "flex-end" },
  bubbleAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.tan,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  bubbleAvatarTxt: { fontSize: 12, fontWeight: "800", color: C.text },
  bubbleSent: {
    backgroundColor: C.primary,
    borderRadius: 12,
    borderBottomRightRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bubbleRecv: {
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    borderRadius: 12,
    borderBottomLeftRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  tailSent: { borderBottomRightRadius: 12 },
  tailRecv: { borderBottomLeftRadius: 12 },
  replyQuote: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 8,
  },
  replyQuoteSent: { borderLeftColor: "rgba(255,255,255,0.55)" },
  replyQuoteRecv: { borderLeftColor: C.border },
  replyQuoteTxt: { fontSize: 12 },
  replyQuoteTxtSent: { color: "rgba(255,255,255,0.88)" },
  replyQuoteTxtRecv: { color: C.muted },
  sentTxt: { fontSize: 14, color: "#FFFFFF", lineHeight: 20 },
  recvTxt: { fontSize: 14, color: C.text, lineHeight: 20 },
  msgImg: { width: 200, maxWidth: "100%", height: 140, borderRadius: 8, marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  metaLeft: { justifyContent: "flex-start", marginLeft: 40 },
  metaRight: { justifyContent: "flex-end" },
  metaTime: { fontSize: 11, color: C.muted },
  metaTimeSent: { color: "rgba(255,255,255,0.75)" },
  typing: { fontSize: 13, color: C.muted, fontStyle: "italic", paddingVertical: 8, textAlign: "center" },
  blockedBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  blockedTxt: { fontSize: 14, color: C.muted, flex: 1 },
  unblockTxt: { fontSize: 14, fontWeight: "800", color: C.primary },
  inputBar: {
    backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 8,
    backgroundColor: C.inputBg,
    borderRadius: 8,
    marginBottom: 8,
  },
  replyBarTxt: { flex: 1, fontSize: 13, color: C.muted },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  attachBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: C.inputBg,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.text,
  },
  sendBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  sendDisabled: { opacity: 0.45 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 24,
  },
  menuCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    overflow: "hidden",
  },
  menuRow: { paddingVertical: 16, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  menuTxt: { fontSize: 15, fontWeight: "600", color: C.text },
  sheet: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 18,
    maxHeight: "80%",
  },
  sheetTitle: { fontSize: 16, fontWeight: "800", marginBottom: 12, color: C.text },
  radioLine: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  reportArea: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    borderRadius: 12,
    minHeight: 80,
    padding: 12,
    marginTop: 12,
    textAlignVertical: "top",
    fontSize: 14,
    color: C.text,
  },
  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
  },
  primaryBtnTxt: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  cancelTxt: { textAlign: "center", marginTop: 12, color: C.muted, fontWeight: "600" },
  fullImgBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImg: { width: "100%", height: "100%" },
});