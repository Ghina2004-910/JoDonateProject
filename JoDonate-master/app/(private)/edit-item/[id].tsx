import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  Alert,
  ScrollView,
  Modal,
  FlatList,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { deleteField, doc, getDoc, updateDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { uploadToCloudinary } from "@/lib/cloudinaryService";
import { getAuthUser } from "@/lib/auth-user";
import { writeItemContactSecrets } from "@/lib/item-secrets";
import { db } from "@/lib/firebase";
import { safeGoBack } from "@/lib/navigation";

type CategoryKey =
  | "Books"
  | "Furniture"
  | "Clothes"
  | "Electronics"
  | "Accessories"
  | "Plants";

type ItemDoc = {
  title: string;
  description: string;
  category: CategoryKey | string;
  contactNumber?: string;
  ownerId: string;
  imageUrl?: string;
};

export default function EditItemScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const categories = useMemo<CategoryKey[]>(
    () => ["Books", "Furniture", "Clothes", "Electronics", "Accessories", "Plants"],
    [],
  );

  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [title,          setTitle]          = useState("");
  const [description,    setDescription]    = useState("");
  const [category,       setCategory]       = useState<CategoryKey | "">("");
  const [contactNumber,  setContactNumber]  = useState("");
  const [imageUrl,       setImageUrl]       = useState<string>("");
  const [showCategoryModal, setShowCategoryModal] = useState(false);


  // ── Load item ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const snap = await getDoc(doc(db, "items", id));
        if (!snap.exists()) {
          Alert.alert("Not found", "Item does not exist.");
          safeGoBack(router, "/my-items");
          return;
        }
        const data = snap.data() as ItemDoc;
        const currentUser = getAuthUser();
        if (!currentUser || data.ownerId !== currentUser.uid) {
          Alert.alert("Not allowed", "You can only edit your own items.");
          safeGoBack(router, "/my-items");
          return;
        }
        setTitle(data.title ?? "");
        setDescription(data.description ?? "");
        setCategory((data.category as CategoryKey) ?? "");
        setContactNumber(data.contactNumber ?? "");
        setImageUrl(data.imageUrl ?? "");
      } catch (e) {
        console.log("Edit load error:", e);
        Alert.alert("Error", "Failed to load item.");
        safeGoBack(router, "/my-items");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, router]);

  // ── Change image — Cloudinary ──────────────────────────────────────────────
  const changeItemImage = async () => {
    if (!id) return;
    const currentUser = getAuthUser();
    if (!currentUser) {
      Alert.alert("Not signed in", "Please sign in again.");
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access.");
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
    if (!uri) return;

    try {
      setUploadingImage(true);

      
      const cdnUrl = await uploadToCloudinary(uri);

      // Save the CDN URL to Firestore
      await updateDoc(doc(db, "items", id), { imageUrl: cdnUrl });
      setImageUrl(cdnUrl);

      Alert.alert("Updated", "Item image updated!");
    } catch (e: unknown) {
      console.log("changeItemImage error:", e);
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to update image.");
    } finally {
      setUploadingImage(false);
    }
  };

  // ── Remove image ────────────────────────────────────────────────────────────
  const removeItemImage = async () => {
    if (!id) return;
    const currentUser = getAuthUser();
    if (!currentUser) {
      Alert.alert("Not signed in", "Please sign in again.");
      return;
    }

    Alert.alert("Remove image", "Remove the item image?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            setUploadingImage(true);

            await updateDoc(doc(db, "items", id), { imageUrl: "" });
            setImageUrl("");

            Alert.alert("Removed", "Item image removed.");
          } catch (e: unknown) {
            console.log("removeItemImage error:", e);
            Alert.alert("Error", e instanceof Error ? e.message : "Failed to remove image.");
          } finally {
            setUploadingImage(false);
          }
        },
      },
    ]);
  };

  // ── Save changes ────────────────────────────────────────────────────────────
  const onSave = async () => {
    if (!id) return;
    if (!title.trim() || !description.trim() || !category) {
      Alert.alert("Missing fields", "Please fill title, description, and category.");
      return;
    }
    try {
      setSaving(true);
      const user = getAuthUser();
      await updateDoc(doc(db, "items", id), {
        title:         title.trim(),
        description:   description.trim(),
        category:      category,
        contactNumber: deleteField(),
        contactEmail:  deleteField(),
        imageUrl:      imageUrl,
      });
      if (user?.uid) {
        await writeItemContactSecrets(id, user.uid, contactNumber.trim(), null);
      }
      Alert.alert("Saved", "Item updated successfully.");
      safeGoBack(router, "/my-items");
    } catch (e) {
      console.log("Edit save error:", e);
      Alert.alert("Error", "Failed to update item.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack(router, "/my-items")} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Item</Text>
        <View style={{ width: 34 }} />
      </View>

      {loading ? (
        <Text style={styles.infoText}>Loading...</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Image */}
          <Text style={styles.label}>Image</Text>
          <View style={styles.imageRow}>
            <Pressable
              onPress={changeItemImage}
              disabled={uploadingImage}
              style={[styles.imageBox, uploadingImage && { opacity: 0.7 }]}
            >
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.image} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="image-outline" size={26} color="#4F98DC" />
                  <Text style={styles.imageHint}>Tap to add</Text>
                </View>
              )}
            </Pressable>

            <View style={{ gap: 10 }}>
              <Pressable
                onPress={changeItemImage}
                disabled={uploadingImage}
                style={[styles.smallBtn, uploadingImage && { opacity: 0.7 }]}
              >
                <Text style={styles.smallBtnText}>
                  {uploadingImage ? "Uploading…" : imageUrl ? "Change" : "Upload"}
                </Text>
              </Pressable>

              <Pressable
                onPress={removeItemImage}
                disabled={uploadingImage || !imageUrl}
                style={[
                  styles.smallBtn,
                  styles.smallBtnDanger,
                  (uploadingImage || !imageUrl) && { opacity: 0.45 },
                ]}
              >
                <Text style={styles.smallBtnText}>Remove</Text>
              </Pressable>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.label}>Title</Text>
          <View style={styles.inputBox}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              placeholder="Title"
            />
          </View>

          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <View style={[styles.inputBox, { height: 110, paddingTop: 10 }]}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[styles.input, { height: "100%" }]}
              placeholder="Description"
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Category */}
          <Text style={styles.label}>Category</Text>
          <Pressable style={styles.dropdownBox} onPress={() => setShowCategoryModal(true)}>
            <Text style={[styles.dropdownText, !category && { color: "rgba(0,0,0,0.35)" }]}>
              {category || "Select a category"}
            </Text>
            <Ionicons name="chevron-down" size={18} color="rgba(0,0,0,0.45)" />
          </Pressable>

          {/* Contact */}
          <Text style={styles.label}>Contact Number</Text>
          <View style={styles.inputBox}>
            <TextInput
              value={contactNumber}
              onChangeText={setContactNumber}
              style={styles.input}
              placeholder="Contact Number"
              keyboardType="phone-pad"
            />
          </View>

          {/* Save */}
          <Pressable
            onPress={onSave}
            disabled={saving}
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          >
            <Text style={styles.saveText}>{saving ? "Saving..." : "Save Changes"}</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Category picker modal */}
      <Modal visible={showCategoryModal} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowCategoryModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <FlatList
              data={categories}
              keyExtractor={(item) => item}
              ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalItem}
                  onPress={() => { setCategory(item); setShowCategoryModal(false); }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                  {category === item ? <Ionicons name="checkmark" size={18} color="#4F98DC" /> : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: "#F7F4F1", paddingTop: Platform.OS === "ios" ? 40 : 24 },
  header:      { backgroundColor: "#a08763",height: 50, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn:     { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  infoText:    { color: "rgba(255,255,255,0.9)", fontWeight: "700", paddingHorizontal: 16, paddingTop: 18 },
  content:     { paddingHorizontal: 16, paddingBottom: 28 },
  label:       { color: "#131313", fontWeight: "800", marginTop: 14, marginBottom: 8 },
  imageRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  imageBox:    { width: 120, height: 120, borderRadius: 18, backgroundColor: "#FFFFFF", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  image:       { width: "100%", height: "100%" },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  imageHint:   { marginTop: 6, color: "rgba(0,0,0,0.55)", fontWeight: "800", fontSize: 12 },
  smallBtn:    { height: 42, paddingHorizontal: 16, borderRadius: 14, backgroundColor: "#a08763", borderWidth: 1, borderColor: "#a08763", alignItems: "center", justifyContent: "center" },
  smallBtnDanger: { backgroundColor: "rgba(229,57,53,0.9)", borderWidth: 0 },
  smallBtnText:{ color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  inputBox:    { backgroundColor: "#ffffff", borderRadius: 14, paddingHorizontal: 12, height: 52, justifyContent: "center" },
  input:       { fontSize: 15, color: "rgba(0,0,0,0.85)" },
  dropdownBox: { backgroundColor: "#FFFFFF", borderRadius: 14, paddingHorizontal: 12, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dropdownText:{ fontSize: 15, color: "rgba(0,0,0,0.85)", fontWeight: "700" },
  saveBtn:     { marginTop: 20, height: 54, borderRadius: 999, backgroundColor: "#a08763", alignItems: "center", justifyContent: "center" },
  saveText:    { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  modalBackdrop:{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center", padding: 18 },
  modalCard:   { width: "100%", maxWidth: 420, backgroundColor: "#ffffff", borderRadius: 18, padding: 14 },
  modalTitle:  { fontSize: 16, fontWeight: "900", color: "#000000", marginBottom: 10 },
  modalItem:   { height: 48, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalItemText:{ fontSize: 15, color: "#000000", fontWeight: "700" },
  modalSeparator:{ height: 1, backgroundColor: "rgba(0,0,0,0.08)" },
});