import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { uploadToCloudinary } from "@/lib/cloudinaryService";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  DONATION_CATEGORIES,
  JORDAN_CITIES,
  categoryFormKind,
  type DonationCategory,
} from "@/lib/donation-categories";
import { useAuth } from "@/lib/auth-context";
import { getAuthUser } from "@/lib/auth-user";
import { auth, db} from "@/lib/firebase";
import { isEmailVerified, requireVerifiedMessage } from "@/lib/auth-email";
import { suggestCategoryFromText } from "@/lib/category-suggest";
import { categorizeItemFromImage } from "@/lib/ai-categorization";
import {
  pickImageAssets,
  promptImageSource,
  showImageValidationError,
  validatePickerAsset,
  type ImagePickSource,
} from "@/lib/image-upload";
import { getCurrentCoords } from "@/lib/location-filter";
import { safeGoBack } from "@/lib/navigation";
import { ADD_ITEM_DRAFT_KEY } from "@/lib/session-cleanup";
import { ROUTES } from "@/lib/app-routes";
import { committeeIdFromCity } from "@/lib/committees";
import { writeItemContactSecrets } from "@/lib/item-secrets";

const C = {
  primary: "#A0866B",
  secondary: "#B39A86",
  bg: "#F5F3F0",
  card: "#FFFFFF",
  text: "#2C2C2A",
  muted: "#888888",
  border: "#E0E0E0",
  inputBg: "#F0F0F0",
  err: "#C62828",
};

const MAX_TITLE = 100;
const MAX_DESC = 500;
const MAX_IMAGES = 5;

const FOOD_TYPES = [
  "Cooked Meal",
  "Raw Ingredients",
  "Packaged",
  "Beverages",
  "Dairy",
  "Meat",
  "Vegetables",
  "Fruits",
  "Bakery",
];
const CLOTH_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Other"];
const CLOTH_GENDER = ["Men", "Women", "Kids", "Unisex"];
const MATERIALS = ["Cotton", "Wool", "Polyester", "Silk", "Linen", "Mixed", "Other"];
const BOOK_LANG = ["Arabic", "English", "Other"];
const BOOK_GENRES = ["Fiction", "Non-Fiction", "Educational", "Children", "Other"];
const BEAUTY_TYPES = ["Makeup", "Skincare", "Hair care", "Medications", "Vitamins", "First aid", "Other"];
const SERVICE_TYPES = ["Repair", "Tutoring", "Consulting", "Cleaning", "Delivery", "Other"];
const EDU_LEVELS = ["Elementary", "High School", "University", "Professional", "Other"];
const SPORT_TYPES = ["Weights", "Cardio", "Yoga", "Sports gear", "Protective gear", "Other"];
const PET_TYPES = ["Dog", "Cat", "Bird", "Rabbit", "Other"];
const PET_ITEMS = ["Food", "Toys", "Bed", "Carrier", "Collar", "Other"];
const CONDITION_SIMPLE = ["New", "Like New", "Good", "Fair", "Used", "Poor"];

function parseDdMmYyyy(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]) - 1;
  const year = Number(m[3]);
  const dt = new Date(year, month, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month || dt.getDate() !== day) return null;
  return dt;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isbnOk(raw: string): boolean {
  const d = raw.replace(/[-\s]/g, "");
  if (!d) return true;
  if (!/^\d{10}(\d{3})?$/.test(d)) return false;
  return true;
}

function phoneJordanOk(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("962")) return digits.length >= 12;
  if (digits.startsWith("07")) return digits.length >= 10;
  return digits.length >= 9;
}

type ImgSlot = { uri: string; url: string };

export default function AddItemScreen() {
  const router = useRouter();
  const { limitedGuest } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [category, setCategory] = useState<DonationCategory | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [cityModal, setCityModal] = useState(false);

  const [foodExpiry, setFoodExpiry] = useState("");
  const [preparedAt, setPreparedAt] = useState("");
  const [foodType, setFoodType] = useState("");
  const [storageRef, setStorageRef] = useState(false);
  const [storageFrozen, setStorageFrozen] = useState(false);
  const [storageRoom, setStorageRoom] = useState(false);
  const [allergens, setAllergens] = useState("");
  const [packaging, setPackaging] = useState<"" | "original" | "repackaged" | "partial">("");

  const [clothSize, setClothSize] = useState("");
  const [clothGender, setClothGender] = useState("");
  const [material, setMaterial] = useState("");
  const [clothCondition, setClothCondition] = useState("");
  const [brandCloth, setBrandCloth] = useState("");
  const [clothColors, setClothColors] = useState("");
  const [fit, setFit] = useState("");

  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookLang, setBookLang] = useState("");
  const [bookIsbn, setBookIsbn] = useState("");
  const [bookEdition, setBookEdition] = useState("");
  const [bookGenre, setBookGenre] = useState("");
  const [bookCondition, setBookCondition] = useState("");

  const [beautyExpiry, setBeautyExpiry] = useState("");
  const [beautyBrand, setBeautyBrand] = useState("");
  const [beautyType, setBeautyType] = useState("");
  const [beautyProdCond, setBeautyProdCond] = useState<"" | "sealed" | "used">("");
  const [beautyQty, setBeautyQty] = useState("");

  const [brandModel, setBrandModel] = useState("");
  const [elecCondition, setElecCondition] = useState("");
  const [workingStatus, setWorkingStatus] = useState("");
  const [acc, setAcc] = useState({
    charger: false,
    cable: false,
    box: false,
    manual: false,
    headphones: false,
  });

  const [serviceType, setServiceType] = useState("");
  const [serviceDuration, setServiceDuration] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<"" | "beginner" | "intermediate" | "expert">(
    "",
  );

  const [courseSubject, setCourseSubject] = useState("");
  const [eduLevel, setEduLevel] = useState("");
  const [eduFormat, setEduFormat] = useState<"" | "online" | "inperson" | "hybrid">("");
  const [eduDuration, setEduDuration] = useState("");

  const [equipmentType, setEquipmentType] = useState("");
  const [sportsCondition, setSportsCondition] = useState("");

  const [petType, setPetType] = useState("");
  const [petItemType, setPetItemType] = useState("");
  const [petCondition, setPetCondition] = useState("");

  const [pickupLocation, setPickupLocation] = useState("");
  const [availabilityNote, setAvailabilityNote] = useState("");
  const [otherCondition, setOtherCondition] = useState("");

  const [images, setImages] = useState<ImgSlot[]>([]);
  const [uploading, setUploading] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [aiCategoryNote, setAiCategoryNote] = useState<string | null>(null);

  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [pickupAvailability, setPickupAvailability] = useState("");

  const [optProof, setOptProof] = useState(false);
  const [optGenderOnly, setOptGenderOnly] = useState(false);
  const [optFcfs, setOptFcfs] = useState(false);
  const [optAnonymous, setOptAnonymous] = useState(false);
  const [optUrgent, setOptUrgent] = useState(false);
  const [donationMode, setDonationMode] = useState<"public" | "committee">("public");
  const [selectedCommitteeUid, setSelectedCommitteeUid] = useState("");
  const [committees, setCommittees] = useState<{ id: string; committeeName?: string; committeeCity?: string; verified?: boolean }[]>([]);
  const [committeeModalOpen, setCommitteeModalOpen] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTitle, setPickerTitle] = useState("");
  const [pickerListItems, setPickerListItems] = useState<string[]>([]);
  const [pickerApply, setPickerApply] = useState<(v: string) => void>(() => {});

  const [submitting, setSubmitting] = useState(false);
  const [step1Err, setStep1Err] = useState<string | null>(null);
  const [step2Err, setStep2Err] = useState<string | null>(null);
  const [step3Err, setStep3Err] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, boolean>>({});

  // ─── Fix: reset all form fields after successful publish ───────────────
  const resetForm = useCallback(() => {
    setStep(1);
    setCategory("");
    setTitle("");
    setDescription("");
    setCity("");
    setFoodExpiry("");
    setPreparedAt("");
    setFoodType("");
    setStorageRef(false);
    setStorageFrozen(false);
    setStorageRoom(false);
    setAllergens("");
    setPackaging("");
    setClothSize("");
    setClothGender("");
    setMaterial("");
    setClothCondition("");
    setBrandCloth("");
    setClothColors("");
    setFit("");
    setBookTitle("");
    setBookAuthor("");
    setBookLang("");
    setBookIsbn("");
    setBookEdition("");
    setBookGenre("");
    setBookCondition("");
    setBeautyExpiry("");
    setBeautyBrand("");
    setBeautyType("");
    setBeautyProdCond("");
    setBeautyQty("");
    setBrandModel("");
    setElecCondition("");
    setWorkingStatus("");
    setAcc({ charger: false, cable: false, box: false, manual: false, headphones: false });
    setServiceType("");
    setServiceDuration("");
    setExperienceLevel("");
    setCourseSubject("");
    setEduLevel("");
    setEduFormat("");
    setEduDuration("");
    setEquipmentType("");
    setSportsCondition("");
    setPetType("");
    setPetItemType("");
    setPetCondition("");
    setPickupLocation("");
    setAvailabilityNote("");
    setOtherCondition("");
    setImages([]);
    setContactPhone("");
    setContactEmail("");
    setPickupAvailability("");
    setOptProof(false);
    setOptGenderOnly(false);
    setOptFcfs(false);
    setOptAnonymous(false);
    setOptUrgent(false);
    setDonationMode("public");
    setSelectedCommitteeUid("");
    setStep1Err(null);
    setStep2Err(null);
    setStep3Err(null);
    setFieldErr({});
  }, []);
  // ───────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!limitedGuest) return;
    Alert.alert(
      "Please login to create a donation",
      "Sign in or create an account to continue.",
      [{ text: "OK", onPress: () => safeGoBack(router) }],
    );
  }, [limitedGuest, router]);

  useEffect(() => {
  const q = query(collection(db, "users"), where("role", "==", "committee"));
  const unsub = onSnapshot(q, (snap) => {
    setCommittees(
      snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as { committeeName?: string; committeeCity?: string; verified?: boolean }) }))
        .filter((c) => !!c.committeeName && c.committeeName !== "Aid Committee")
        .sort((a, b) => (a.committeeName ?? "").localeCompare(b.committeeName ?? "")),
    );
  });
  return unsub;
}, []);

useEffect(() => {
  const u = getAuthUser();
  if (!u || limitedGuest) return;
  const unsub = onSnapshot(doc(db, "users", u.uid), (snap) => {
    const d = snap.data() as { phone?: string } | undefined;
    if (d?.phone && !contactPhone) setContactPhone(d.phone);
  });
  return unsub;
}, [limitedGuest, contactPhone]);

  const openPicker = useCallback((title: string, options: string[], apply: (v: string) => void) => {
    setPickerTitle(title);
    setPickerListItems(options);
    setPickerApply(() => apply);
    setPickerOpen(true);
  }, []);

 const uploadOne = async (uri: string) => {
  const secureUrl = await uploadToCloudinary(uri);

  if (!secureUrl) {
    throw new Error("Upload to Cloudinary failed");
  }

  return secureUrl;
};

  const applyAiCategory = useCallback(async (imageUrl: string) => {
    try {
      setCategorizing(true);
      setAiCategoryNote(null);
      const textHint = `${title} ${description}`.trim();
      const result = await categorizeItemFromImage(imageUrl, textHint);
      let suggested = result.category;
      if (!suggested && textHint.length >= 4) {
        suggested = suggestCategoryFromText(title, description);
      }
      if (suggested) {
        setCategory(suggested);
        setAiCategoryNote(
          result.aiUsed
            ? `AI suggested "${suggested}" from your photo. You can change it on the previous step.`
            : `Suggested "${suggested}" from your photo or description. You can change it on the previous step.`,
        );
      }
    } catch {
      const fallback = suggestCategoryFromText(title, description);
      if (fallback) {
        setCategory(fallback);
        setAiCategoryNote(`Suggested "${fallback}" from your description. You can change it on the previous step.`);
      }
    } finally {
      setCategorizing(false);
    }
  }, [title, description]);

  const processPickedImages = async (source: ImagePickSource) => {
    const user = getAuthUser();
    if (!user || limitedGuest) return;
    if (images.length >= MAX_IMAGES) {
      Alert.alert("Limit reached", `You can upload up to ${MAX_IMAGES} images.`);
      return;
    }

    const assets = await pickImageAssets(source, MAX_IMAGES - images.length);
    if (!assets?.length) return;

    try {
      setUploading(true);
      const next = [...images];
      let firstNewUrl: string | null = null;
      for (const asset of assets) {
        if (!asset.uri || next.length >= MAX_IMAGES) break;
        const err = validatePickerAsset(asset);
        if (err) {
          showImageValidationError(err);
          continue;
        }
        const url = await uploadOne(asset.uri);
        if (next.length === 0) firstNewUrl = url;
        next.push({ uri: asset.uri, url });
      }
      setImages(next);
      setStep2Err(null);
      if (firstNewUrl) {
        void applyAiCategory(firstNewUrl);
      }
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as Error).message) : "Upload failed";
      Alert.alert("Upload error", msg);
    } finally {
      setUploading(false);
    }
  };

  const pickImages = () => {
    promptImageSource((source) => {
      void processPickedImages(source);
    });
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const kind = useMemo(() => (category ? categoryFormKind(category) : "other"), [category]);

  const validateStep1 = (): boolean => {
    const fe: Record<string, boolean> = {};
    let msg: string | null = null;
    if (!category) {
      msg = "Select a category.";
    } else if (!title.trim()) {
      fe.title = true;
      msg = "Title is required.";
    } else if (!description.trim()) {
      fe.description = true;
      msg = "Description is required.";
    } else if (!city.trim()) {
      fe.city = true;
      msg = "Location is required.";
    }

    if (category && kind === "food") {
      const exp = parseDdMmYyyy(foodExpiry);
      if (!foodExpiry.trim() || !exp) {
        fe.foodExpiry = true;
        msg = "Food expiry (DD/MM/YYYY) is required.";
      } else if (exp < startOfToday()) {
        fe.foodExpiry = true;
        msg = "Expiry must be today or later.";
      }
      if (!foodType) {
        fe.foodType = true;
        msg = msg ?? "Select food type.";
      }
      if (!packaging) {
        fe.packaging = true;
        msg = msg ?? "Select packaging.";
      }
    }

    if (category && kind === "clothes") {
      if (!clothSize) {
        fe.clothSize = true;
        msg = msg ?? "Select size.";
      }
      if (!clothGender) {
        fe.clothGender = true;
        msg = msg ?? "Select who it is for.";
      }
      if (!clothCondition) {
        fe.clothCondition = true;
        msg = msg ?? "Select condition.";
      }
    }

    if (category && kind === "books") {
      if (!bookTitle.trim()) fe.bookTitle = true;
      if (!bookAuthor.trim()) fe.bookAuthor = true;
      if (!bookLang) fe.bookLang = true;
      if (!bookCondition) fe.bookCondition = true;
      if (!bookTitle.trim() || !bookAuthor.trim() || !bookLang || !bookCondition) {
        msg = msg ?? "Complete all required book fields.";
      }
      if (bookIsbn.trim() && !isbnOk(bookIsbn)) {
        fe.bookIsbn = true;
        msg = "ISBN format looks invalid.";
      }
    }

    if (category && kind === "beauty") {
      const exp = parseDdMmYyyy(beautyExpiry);
      if (!beautyExpiry.trim() || !exp) {
        fe.beautyExpiry = true;
        msg = msg ?? "Beauty expiry (DD/MM/YYYY) is required.";
      } else if (exp <= new Date()) {
        fe.beautyExpiry = true;
        msg = "Expiry must be in the future.";
      }
      if (!beautyBrand.trim()) {
        fe.beautyBrand = true;
        msg = msg ?? "Brand is required.";
      }
      if (!beautyType) {
        fe.beautyType = true;
        msg = msg ?? "Product type is required.";
      }
    }

    if (category && kind === "electronics") {
      if (!brandModel.trim()) fe.brandModel = true;
      if (!elecCondition) fe.elecCondition = true;
      if (!brandModel.trim() || !elecCondition) msg = msg ?? "Brand/model and condition are required.";
    }

    if (category && kind === "services") {
      if (!serviceType) {
        fe.serviceType = true;
        msg = msg ?? "Select service type.";
      }
    }

    if (category && kind === "education") {
      if (!courseSubject.trim()) {
        fe.courseSubject = true;
        msg = msg ?? "Subject or course name is required.";
      }
    }

    if (category && kind === "sports") {
      if (!equipmentType) fe.equipmentType = true;
      if (!sportsCondition) fe.sportsCondition = true;
      if (!equipmentType || !sportsCondition) msg = msg ?? "Equipment type and condition are required.";
    }

    if (category && kind === "pets") {
      if (!petCondition) {
        fe.petCondition = true;
        msg = msg ?? "Select condition for this item.";
      }
    }

    if (category && kind === "other") {
      if (!otherCondition) {
        fe.otherCondition = true;
        msg = msg ?? "Select overall condition.";
      }
    }

    setFieldErr(fe);
    setStep1Err(msg);
    return !msg;
  };

  const validateStep2 = () => {
    if (images.length < 1) {
      setStep2Err("Add at least one image.");
      return false;
    }
    setStep2Err(null);
    return true;
  };

  const validateStep3 = () => {
    if (donationMode === "committee" && !selectedCommitteeUid) {
      setStep3Err("Please select a committee.");
      return false;
    }
    if (!phoneJordanOk(contactPhone)) {
      setStep3Err("Enter a valid Jordan number (+9627… or 07…).");
      return false;
    }
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setStep3Err("Email format looks invalid.");
      return false;
    }
    setStep3Err(null);
    return true;
  };
  const listingCondition = useMemo(() => {
    if (kind === "clothes") return clothCondition;
    if (kind === "books") return bookCondition;
    if (kind === "electronics") return elecCondition;
    if (kind === "sports") return sportsCondition;
    if (kind === "pets") return petCondition;
    return otherCondition;
  }, [
    kind,
    clothCondition,
    bookCondition,
    elecCondition,
    sportsCondition,
    petCondition,
    otherCondition,
  ]);

  const buildPayload = () => {
    const user = getAuthUser();
    if (!user) throw new Error("Not signed in");
    const urls = images.map((i) => i.url);
    const base: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      category,
      city: city.trim(),
      committeeId: committeeIdFromCity(city.trim()),
      imageUrls: urls,
      imageUrl: urls[0],
      ownerId: user.uid,
      status: "available",
      createdAt: serverTimestamp(),
      condition: listingCondition || null,
      pickupAvailability: pickupAvailability.trim() || null,
      optProofIdentity: optProof,
      optGenderRestriction: optGenderOnly,
      optFcfs,
      optAnonymous,
      optUrgent,
      donationMode,
      committeeUid: donationMode === "committee" ? selectedCommitteeUid : null,
    };

    if (kind === "food") {
      base.foodExpiry = foodExpiry.trim();
      base.preparedAt = preparedAt.trim() || null;
      base.foodType = foodType;
      base.storageRefrigeration = storageRef;
      base.storageFrozen = storageFrozen;
      base.storageRoomTemp = storageRoom;
      base.allergens = allergens.trim() || null;
      base.packaging =
        packaging === "original"
          ? "Original sealed packaging"
          : packaging === "repackaged"
            ? "Repackaged"
            : "Partially used";
    }
    if (kind === "clothes") {
      base.clothesSize = clothSize;
      base.clothesGender = clothGender;
      base.material = material || null;
      base.fit = fit || null;
      base.brandClothing = brandCloth.trim() || null;
      base.clothingColors = clothColors.trim() || null;
    }
    if (kind === "books") {
      base.bookTitle = bookTitle.trim();
      base.bookAuthor = bookAuthor.trim();
      base.bookLanguage = bookLang;
      base.bookIsbn = bookIsbn.trim() || null;
      base.bookEdition = bookEdition.trim() || null;
      base.bookGenre = bookGenre || null;
    }
    if (kind === "beauty") {
      base.beautyExpiry = beautyExpiry.trim();
      base.beautyBrand = beautyBrand.trim();
      base.productType = beautyType;
      base.beautyCondition =
        beautyProdCond === "sealed" ? "Sealed/New" : beautyProdCond === "used" ? "Opened/Used" : null;
      base.beautyQuantity = beautyQty.trim() || null;
    }
    if (kind === "electronics") {
      base.brandModel = brandModel.trim();
      base.workingStatus = workingStatus || null;
      base.accessories = Object.entries(acc)
        .filter(([, v]) => v)
        .map(([k]) => k);
    }
    if (kind === "services") {
      base.serviceType = serviceType;
      base.serviceDuration = serviceDuration.trim() || null;
      base.experienceLevel = experienceLevel || null;
    }
    if (kind === "education") {
      base.courseSubject = courseSubject.trim();
      base.eduLevel = eduLevel || null;
      base.eduFormat =
        eduFormat === "online" ? "Online" : eduFormat === "inperson" ? "In-person" : eduFormat === "hybrid" ? "Hybrid" : null;
      base.eduDuration = eduDuration.trim() || null;
    }
    if (kind === "sports") {
      base.equipmentType = equipmentType;
    }
    if (kind === "pets") {
      base.petType = petType || null;
      base.petItemType = petItemType || null;
    }
    if (kind === "other") {
      base.pickupLocation = pickupLocation.trim() || null;
      base.availabilityNote = availabilityNote.trim() || null;
    }

    return base;
  };

  const saveDraft = useCallback(async () => {
    if (limitedGuest) return;
    try {
      await AsyncStorage.setItem(
        ADD_ITEM_DRAFT_KEY,
        JSON.stringify({
          step,
          category,
          title,
          description,
          city,
          images: images.map((i) => ({ url: i.url })),
          contactPhone,
          contactEmail,
          foodExpiry,
          foodType,
          bookTitle,
          beautyExpiry,
          brandModel,
        }),
      );
    } catch {
      
    }
  }, [
    limitedGuest,
    step,
    category,
    title,
    description,
    city,
    images,
    contactPhone,
    contactEmail,
    foodExpiry,
    foodType,
    bookTitle,
    beautyExpiry,
    brandModel,
  ]);

  useEffect(() => {
    if (limitedGuest) return;
    return () => {
      void AsyncStorage.removeItem(ADD_ITEM_DRAFT_KEY);
    };
  }, [limitedGuest]);

  useEffect(() => {
    if (limitedGuest || step !== 1 || title.trim().length < 4) return;
    const suggested = suggestCategoryFromText(title, description);
    if (suggested) setCategory(suggested);
  }, [title, description, limitedGuest, step]);

  const onPublish = async () => {
    if (!validateStep3()) return;
    const user = getAuthUser();
    if (!user || limitedGuest) {
      Alert.alert("Sign in required", "Please sign in to publish.");
      return;
    }
    if (!isEmailVerified(auth.currentUser)) {
      Alert.alert("Verify email", requireVerifiedMessage(), [
        { text: "OK", onPress: () => router.push(ROUTES.verifyEmail) },
      ]);
      return;
    }
    try {
      setSubmitting(true);
      const payload = buildPayload();
      const coords = await getCurrentCoords();
      if (coords) {
        payload.latitude = coords.latitude;
        payload.longitude = coords.longitude;
      }
      const profileSnap = await getDoc(doc(db, "users", user.uid));
      const profileName = profileSnap.exists()
        ? String((profileSnap.data() as { name?: string }).name ?? "")
        : "";
      payload.donorName = profileName.trim() || user.email?.split("@")[0] || "Donor";
      const refDoc = await addDoc(collection(db, "items"), payload);
      await writeItemContactSecrets(
        refDoc.id,
        user.uid,
        contactPhone.trim(),
        contactEmail.trim() || null,
      );
      if (donationMode === "committee" && selectedCommitteeUid) {
  const { setDoc, doc: fsDoc } = await import("firebase/firestore");
  const accessId = `${user.uid}_${selectedCommitteeUid}`;
  await setDoc(fsDoc(db, "requestAccess", accessId), {
    itemId: refDoc.id,
    requesterId: user.uid,
    itemOwnerId: selectedCommitteeUid,
    isCommitteeChat: true,
  }, { merge: true });
}
      if (donationMode === "committee" && selectedCommitteeUid) {
  await addDoc(collection(db, "notifications"), {
    toUserId: selectedCommitteeUid,
    fromUserId: user.uid,
    title: "New Committee Donation",
    body: `A donor assigned a new item "${title.trim()}" to your committee for distribution.`,
    type: "committee_donation",
    itemId: refDoc.id,
    read: false,
    createdAt: serverTimestamp(),
  });
}
if (donationMode === "committee" && selectedCommitteeUid) {
  const { conversationIdForPair } = require("@/lib/chat-utils");
const conversationId = conversationIdForPair(user.uid, selectedCommitteeUid);
await setDoc(
  doc(db, "conversations", conversationId),
    {
      participants: [user.uid, selectedCommitteeUid],
      participantNames: {
        [user.uid]: payload.donorName,
        [selectedCommitteeUid]: committees.find(c => c.id === selectedCommitteeUid)?.committeeName ?? "Committee",
      },
      itemId: refDoc.id,
      lastMessageAt: serverTimestamp(),
      unreadBy: { [selectedCommitteeUid]: 1 },
      blocked: false,
      archivedFor: [],
    },
    { merge: true },
  );
}
      await AsyncStorage.removeItem(ADD_ITEM_DRAFT_KEY);
      // ─── Fix: reset all fields after successful publish ─────────────
      resetForm();
      // ─────────────────────────────────────────────────────────────────
      Alert.alert("Donation published successfully!", "", [
        {
          text: "View listing",
          onPress: () => router.replace({ pathname: "/item/[id]", params: { id: refDoc.id } }),
        },
        { text: "Home", onPress: () => router.replace("/(private)") },
      ]);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as Error).message) : "Failed";
      Alert.alert("Could not publish", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const progress = (step / 3) * 100;

  if (limitedGuest) {
    return <View style={[styles.screen, { justifyContent: "center", alignItems: "center" }]} />;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack(router)} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Add New Donation</Text>
        <Pressable onPress={() => safeGoBack(router)} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color={C.primary} />
        </Pressable>
      </View>

      <View style={styles.progressOuter}>
        <View style={[styles.progressInner, { width: `${progress}%` }]} />
      </View>
      <View style={styles.stepLabels}>
        {(["Details", "Images", "Review"] as const).map((lbl, i) => (
          <Text
            key={lbl}
            style={[styles.stepLbl, step === i + 1 && styles.stepLblOn]}
          >
            {lbl}
          </Text>
        ))}
      </View>

      <KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
>
  <ScrollView 
    contentContainerStyle={styles.scroll} 
    keyboardShouldPersistTaps="handled"
    keyboardDismissMode="interactive"
  >
          {step === 1 ? (
            <>
              <Text style={styles.sectionTitle}>Select Category</Text>
              <View style={styles.catGrid}>
                {DONATION_CATEGORIES.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.catChip, category === c && styles.catChipOn]}
                    onPress={() => {
                      setCategory(c);
                      setStep1Err(null);
                      setAiCategoryNote(null);
                    }}
                  >
                    <Text style={[styles.catChipTxt, category === c && styles.catChipTxtOn]} numberOfLines={2}>
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {category ? renderDynamicFields({
                kind,
                openPicker,
                fieldErr,
                foodExpiry,
                setFoodExpiry,
                preparedAt,
                setPreparedAt,
                foodType,
                setFoodType,
                storageRef,
                setStorageRef,
                storageFrozen,
                setStorageFrozen,
                storageRoom,
                setStorageRoom,
                allergens,
                setAllergens,
                packaging,
                setPackaging,
                clothSize,
                setClothSize,
                clothGender,
                setClothGender,
                material,
                setMaterial,
                clothCondition,
                setClothCondition,
                brandCloth,
                setBrandCloth,
                clothColors,
                setClothColors,
                fit,
                setFit,
                bookTitle,
                setBookTitle,
                bookAuthor,
                setBookAuthor,
                bookLang,
                setBookLang,
                bookIsbn,
                setBookIsbn,
                bookEdition,
                setBookEdition,
                bookGenre,
                setBookGenre,
                bookCondition,
                setBookCondition,
                beautyExpiry,
                setBeautyExpiry,
                beautyBrand,
                setBeautyBrand,
                beautyType,
                setBeautyType,
                beautyProdCond,
                setBeautyProdCond,
                beautyQty,
                setBeautyQty,
                brandModel,
                setBrandModel,
                elecCondition,
                setElecCondition,
                workingStatus,
                setWorkingStatus,
                acc,
                setAcc,
                serviceType,
                setServiceType,
                serviceDuration,
                setServiceDuration,
                experienceLevel,
                setExperienceLevel,
                courseSubject,
                setCourseSubject,
                eduLevel,
                setEduLevel,
                eduFormat,
                setEduFormat,
                eduDuration,
                setEduDuration,
                equipmentType,
                setEquipmentType,
                sportsCondition,
                setSportsCondition,
                petType,
                setPetType,
                petItemType,
                setPetItemType,
                petCondition,
                setPetCondition,
                pickupLocation,
                setPickupLocation,
                availabilityNote,
                setAvailabilityNote,
                otherCondition,
                setOtherCondition,
              }) : null}

              <FieldLabel required>Donation Title</FieldLabel>
              <TextInput
                style={[styles.input, fieldErr.title && styles.inputErr]}
                placeholder="e.g. Gentle used winter jacket"
                placeholderTextColor={C.muted}
                value={title}
                maxLength={MAX_TITLE}
                onChangeText={(t) => {
                  setTitle(t);
                  setFieldErr((p) => ({ ...p, title: false }));
                }}
              />
              <Text style={styles.counter}>
                {title.length}/{MAX_TITLE}
              </Text>

              <FieldLabel required>Description</FieldLabel>
              <TextInput
                style={[styles.textarea, fieldErr.description && styles.inputErr]}
                placeholder="Describe the donation in detail..."
                placeholderTextColor={C.muted}
                value={description}
                multiline
                maxLength={MAX_DESC}
                textAlignVertical="top"
                onChangeText={(t) => {
                  setDescription(t);
                  setFieldErr((p) => ({ ...p, description: false }));
                }}
              />
              <Text style={styles.counter}>{description.length}/{MAX_DESC}</Text>

              <FieldLabel required>Location / City</FieldLabel>
              <Pressable
                style={[styles.inputRow, fieldErr.city && styles.inputErr]}
                onPress={() => setCityModal(true)}
              >
                <Ionicons name="location-outline" size={20} color={C.primary} />
                <Text style={[styles.inputLike, !city && { color: C.muted }]}>
                  {city || "Select or enter city"}
                </Text>
                <Ionicons name="chevron-down" size={18} color={C.muted} />
              </Pressable>

              {step1Err ? <Text style={styles.errBanner}>{step1Err}</Text> : null}

              <Pressable
                style={styles.primaryBtn}
                onPress={() => validateStep1() && setStep(2)}
              >
                <Text style={styles.primaryBtnTxt}>Next: Images</Text>
              </Pressable>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.sectionTitle}>Upload Images</Text>
              <Pressable style={styles.dropZone} onPress={pickImages} disabled={uploading}>
                <Ionicons name="camera-outline" size={32} color={C.primary} />
                <Text style={styles.dropTitle}>Upload Images</Text>
                <Text style={styles.dropSub}>Tap to choose photos</Text>
                <Text style={styles.dropHint}>JPG, PNG up to 5MB · max {MAX_IMAGES}</Text>
              </Pressable>
              {uploading ? <Text style={styles.muted}>Uploading…</Text> : null}
              {categorizing ? <Text style={styles.muted}>Analyzing image with AI…</Text> : null}
              {aiCategoryNote ? <Text style={styles.aiNote}>{aiCategoryNote}</Text> : null}
              <View style={styles.thumbRow}>
                {images.map((im, idx) => (
                  <View key={im.url} style={styles.thumbWrap}>
                    <Image source={{ uri: im.uri }} style={styles.thumb} />
                    <Pressable style={styles.thumbX} onPress={() => removeImage(idx)}>
                      <Ionicons name="close" size={14} color="#FFF" />
                    </Pressable>
                  </View>
                ))}
              </View>
              {step2Err ? <Text style={styles.errBanner}>{step2Err}</Text> : null}
              <Pressable style={styles.outlineBtn} onPress={() => setStep(1)}>
                <Text style={styles.outlineBtnTxt}>Back</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => validateStep2() && setStep(3)}
              >
                <Text style={styles.primaryBtnTxt}>Next: Review</Text>
              </Pressable>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={styles.sectionTitle}>How to reach you</Text>
              <FieldLabel required>Phone Number</FieldLabel>
              <TextInput
                style={styles.input}
                placeholder="+9627XXXXXXXX"
                placeholderTextColor={C.muted}
                keyboardType="phone-pad"
                value={contactPhone}
                onChangeText={setContactPhone}
              />
              <FieldLabel>Email (optional)</FieldLabel>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={C.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={contactEmail}
                onChangeText={setContactEmail}
              />
              <FieldLabel>When can donors reach you?</FieldLabel>
              <TextInput
                style={styles.textareaSm}
                placeholder="e.g. Weekdays 5pm–9pm"
                placeholderTextColor={C.muted}
                value={pickupAvailability}
                onChangeText={setPickupAvailability}
                multiline
              />
              <Text style={styles.sectionTitle}>Donation Type</Text>
<View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
  <Pressable
    style={[
      styles.catChip,
      { flex: 1 },
      donationMode === "public" && styles.catChipOn,
    ]}
    onPress={() => {
      setDonationMode("public");
      setSelectedCommitteeUid("");
    }}
  >
    <Text style={[styles.catChipTxt, donationMode === "public" && styles.catChipTxtOn]}>
      🌍 Public
    </Text>
  </Pressable>
  <Pressable
    style={[
      styles.catChip,
      { flex: 1 },
      donationMode === "committee" && styles.catChipOn,
    ]}
    onPress={() => setDonationMode("committee")}
  >
    <Text style={[styles.catChipTxt, donationMode === "committee" && styles.catChipTxtOn]}>
      🤝 Via Committee
    </Text>
  </Pressable>
</View>

{donationMode === "committee" && (
  <View style={{ marginBottom: 12 }}>
    <Text style={styles.fieldLbl}>Select Committee *</Text>
    {committees.length === 0 ? (
      <Text style={[styles.muted, { marginBottom: 8 }]}>No committees available.</Text>
    ) : (
      Array.from({ length: Math.ceil(committees.length / 2) }, (_, rowIdx) => (
        <View key={rowIdx} style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          {committees.slice(rowIdx * 2, rowIdx * 2 + 2).map((c) => (
            <Pressable
              key={c.id}
              style={[
                styles.inputRow,
                { flex: 1, marginBottom: 0, minWidth: 0 },
                selectedCommitteeUid === c.id && { borderColor: C.primary, borderWidth: 2 },
              ]}
              onPress={() => setSelectedCommitteeUid(c.id)}
            >
              <Ionicons
                name={selectedCommitteeUid === c.id ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={selectedCommitteeUid === c.id ? C.primary : C.muted}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.inputLike, { flexShrink: 1 }]} numberOfLines={2}>{c.committeeName}</Text>
                {c.verified && (
                    <Ionicons name="checkmark-circle" size={15} color="#1976D2" />
                  )}
                {c.committeeCity ? (
                  <Text style={{ fontSize: 10, color: C.muted }} numberOfLines={1}>{c.committeeCity}</Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ))
    )}
  </View>
)}

              <Text style={styles.sectionTitle}>Additional options</Text>
              <ToggleRow label="Require proof of identity" value={optProof} onToggle={setOptProof} />
              <ToggleRow label="Only for females / males (manual vetting)" value={optGenderOnly} onToggle={setOptGenderOnly} />
              <ToggleRow label="First come, first served" value={optFcfs} onToggle={setOptFcfs} />
              <ToggleRow label="Anonymous donation (hide name)" value={optAnonymous} onToggle={setOptAnonymous} />
              <ToggleRow label="Mark as urgent" value={optUrgent} onToggle={setOptUrgent} />

              <Text style={styles.sectionTitle}>Preview</Text>
              <View style={styles.previewCard}>
                {images[0] ? (
                  <Image source={{ uri: images[0].uri }} style={styles.previewImg} />
                ) : (
                  <View style={[styles.previewImg, styles.ph]} />
                )}
                <Text style={styles.previewTitle} numberOfLines={2}>
                  {title || "Title"}
                </Text>
                <Text style={styles.previewMeta}>{category || "Category"} · {city || "Location"}</Text>
              </View>

              {step3Err ? <Text style={styles.errBanner}>{step3Err}</Text> : null}

              <Pressable style={styles.outlineBtn} onPress={() => setStep(2)}>
                <Text style={styles.outlineBtnTxt}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, submitting && { opacity: 0.75 }]}
                disabled={submitting}
                onPress={onPublish}
              >
                <Text style={styles.primaryBtnTxt}>{submitting ? "Publishing…" : "Publish donation"}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void saveDraft();
                  Alert.alert("Draft saved", "Your progress is saved on this device.");
                }}
              >
                <Text style={styles.draftTxt}>Save draft now</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={cityModal} transparent animationType="fade">
        <Pressable style={styles.modalBg} onPress={() => setCityModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Choose city</Text>
            <FlatList
              data={[...JORDAN_CITIES]}
              keyExtractor={(item) => item}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalRow}
                  onPress={() => {
                    setCity(item);
                    setCityModal(false);
                    setFieldErr((p) => ({ ...p, city: false }));
                  }}
                >
                  <Text style={styles.modalRowTxt}>{item}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={pickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalBg} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{pickerTitle}</Text>
            <FlatList
              data={pickerListItems}
              keyExtractor={(item) => item}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalRow}
                  onPress={() => {
                    pickerApply(item);
                    setPickerOpen(false);
                  }}
                >
                  <Text style={styles.modalRowTxt}>{item}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLbl}>
      {children}
      {required ? <Text style={{ color: C.err }}> *</Text> : null}
    </Text>
  );
}

function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <Pressable style={styles.chk} onPress={() => onToggle(!value)}>
      <Ionicons name={value ? "checkbox" : "square-outline"} size={22} color={C.primary} />
      <Text style={styles.chkTxt}>{label}</Text>
    </Pressable>
  );
}

type DynProps = {
  kind: ReturnType<typeof categoryFormKind>;
  openPicker: (title: string, options: string[], apply: (v: string) => void) => void;
  fieldErr: Record<string, boolean>;
} & Record<string, unknown>;

function renderDynamicFields(p: DynProps) {
  const { kind, openPicker, fieldErr } = p;

  const sel = (label: string, value: string, options: string[], key: string, setter: (v: string) => void) => (
    <>
      <FieldLabel required>{label}</FieldLabel>
      <Pressable
        style={[styles.inputRow, fieldErr[key] && styles.inputErr]}
        onPress={() => openPicker(label, options, setter)}
      >
        <Text style={[styles.inputLike, !value && { color: C.muted }]}>{value || `Select ${label}`}</Text>
        <Ionicons name="chevron-down" size={18} color={C.muted} />
      </Pressable>
    </>
  );

  const radioRow = (
    label: string,
    value: string,
    options: string[],
    setter: (v: string) => void,
  ) => (
    <>
      <FieldLabel required>{label}</FieldLabel>
      {options.map((opt) => (
        <Pressable key={opt} style={styles.radioLine} onPress={() => setter(opt)}>
          <Ionicons
            name={value === opt ? "radio-button-on" : "radio-button-off"}
            size={20}
            color={value === opt ? C.primary : C.muted}
          />
          <Text style={styles.radioTxt}>{opt}</Text>
        </Pressable>
      ))}
    </>
  );

  if (kind === "food") {
    return (
      <>
        <FieldLabel required>Expiry Date (DD/MM/YYYY)</FieldLabel>
        <TextInput
          style={[styles.input, fieldErr.foodExpiry && styles.inputErr]}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={C.muted}
          value={p.foodExpiry as string}
          onChangeText={p.setFoodExpiry as (t: string) => void}
        />
        <FieldLabel>When was it prepared? (optional)</FieldLabel>
        <TextInput
          style={styles.input}
          placeholder="DD/MM/YYYY HH:MM"
          placeholderTextColor={C.muted}
          value={p.preparedAt as string}
          onChangeText={p.setPreparedAt as (t: string) => void}
        />
        {sel("Type of Food", p.foodType as string, FOOD_TYPES, "foodType", p.setFoodType as (v: string) => void)}
        <Text style={styles.sectionTitle}>Storage</Text>
        <ToggleRow label="Requires refrigeration" value={p.storageRef as boolean} onToggle={p.setStorageRef as (v: boolean) => void} />
        <ToggleRow label="Frozen" value={p.storageFrozen as boolean} onToggle={p.setStorageFrozen as (v: boolean) => void} />
        <ToggleRow label="Room temperature OK" value={p.storageRoom as boolean} onToggle={p.setStorageRoom as (v: boolean) => void} />
        <FieldLabel>Allergens</FieldLabel>
        <TextInput
          style={styles.textareaSm}
          placeholder="e.g. nuts, dairy"
          placeholderTextColor={C.muted}
          value={p.allergens as string}
          onChangeText={p.setAllergens as (t: string) => void}
          multiline
        />
        <FieldLabel required>Packaging</FieldLabel>
        {(["original", "repackaged", "partial"] as const).map((pk) => (
          <Pressable
            key={pk}
            style={styles.radioLine}
            onPress={() => (p.setPackaging as (v: typeof pk) => void)(pk)}
          >
            <Ionicons
              name={p.packaging === pk ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={p.packaging === pk ? C.primary : C.muted}
            />
            <Text style={styles.radioTxt}>
              {pk === "original" ? "Original sealed" : pk === "repackaged" ? "Repackaged" : "Partially used"}
            </Text>
          </Pressable>
        ))}
      </>
    );
  }

  if (kind === "clothes") {
    return (
      <>
        {sel("Size", p.clothSize as string, CLOTH_SIZES, "clothSize", p.setClothSize as (v: string) => void)}
        {sel("For", p.clothGender as string, CLOTH_GENDER, "clothGender", p.setClothGender as (v: string) => void)}
        {sel("Material", p.material as string, MATERIALS, "material", p.setMaterial as (v: string) => void)}
        {radioRow("Condition", p.clothCondition as string, CONDITION_SIMPLE, p.setClothCondition as (v: string) => void)}
        <FieldLabel>Brand</FieldLabel>
        <TextInput
          style={styles.input}
          value={p.brandCloth as string}
          onChangeText={p.setBrandCloth as (t: string) => void}
          placeholder="Optional"
          placeholderTextColor={C.muted}
        />
        <FieldLabel>Color(s)</FieldLabel>
        <TextInput
          style={styles.input}
          value={p.clothColors as string}
          onChangeText={p.setClothColors as (t: string) => void}
          placeholder="e.g. Navy, Black"
          placeholderTextColor={C.muted}
        />
        <FieldLabel>Fit</FieldLabel>
        <TextInput
          style={styles.input}
          value={p.fit as string}
          onChangeText={p.setFit as (t: string) => void}
          placeholder="Slim / Regular / Loose"
          placeholderTextColor={C.muted}
        />
      </>
    );
  }

  if (kind === "books") {
    return (
      <>
        <FieldLabel required>Book Title</FieldLabel>
        <TextInput
          style={[styles.input, fieldErr.bookTitle && styles.inputErr]}
          value={p.bookTitle as string}
          onChangeText={p.setBookTitle as (t: string) => void}
          maxLength={MAX_TITLE}
        />
        <FieldLabel required>Author</FieldLabel>
        <TextInput
          style={[styles.input, fieldErr.bookAuthor && styles.inputErr]}
          value={p.bookAuthor as string}
          onChangeText={p.setBookAuthor as (t: string) => void}
        />
        {sel("Language", p.bookLang as string, BOOK_LANG, "bookLang", p.setBookLang as (v: string) => void)}
        <FieldLabel>ISBN</FieldLabel>
        <TextInput
          style={[styles.input, fieldErr.bookIsbn && styles.inputErr]}
          value={p.bookIsbn as string}
          onChangeText={p.setBookIsbn as (t: string) => void}
          keyboardType="numbers-and-punctuation"
        />
        <FieldLabel>Edition</FieldLabel>
        <TextInput
          style={styles.input}
          value={p.bookEdition as string}
          onChangeText={p.setBookEdition as (t: string) => void}
          placeholder="First, Second…"
          placeholderTextColor={C.muted}
        />
        {sel("Genre", p.bookGenre as string, BOOK_GENRES, "bookGenre", p.setBookGenre as (v: string) => void)}
        {radioRow("Condition", p.bookCondition as string, CONDITION_SIMPLE, p.setBookCondition as (v: string) => void)}
      </>
    );
  }

  if (kind === "beauty") {
    return (
      <>
        <FieldLabel required>Expiry Date (DD/MM/YYYY)</FieldLabel>
        <TextInput
          style={[styles.input, fieldErr.beautyExpiry && styles.inputErr]}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={C.muted}
          value={p.beautyExpiry as string}
          onChangeText={p.setBeautyExpiry as (t: string) => void}
        />
        <FieldLabel required>Brand</FieldLabel>
        <TextInput
          style={[styles.input, fieldErr.beautyBrand && styles.inputErr]}
          value={p.beautyBrand as string}
          onChangeText={p.setBeautyBrand as (t: string) => void}
        />
        {sel("Product type", p.beautyType as string, BEAUTY_TYPES, "beautyType", p.setBeautyType as (v: string) => void)}
        <FieldLabel>Product status</FieldLabel>
        {(["sealed", "used"] as const).map((k) => (
          <Pressable
            key={k}
            style={styles.radioLine}
            onPress={() => (p.setBeautyProdCond as (v: typeof k) => void)(k)}
          >
            <Ionicons
              name={p.beautyProdCond === k ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={p.beautyProdCond === k ? C.primary : C.muted}
            />
            <Text style={styles.radioTxt}>{k === "sealed" ? "Sealed / New" : "Opened / Used"}</Text>
          </Pressable>
        ))}
        <FieldLabel>Quantity</FieldLabel>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={p.beautyQty as string}
          onChangeText={p.setBeautyQty as (t: string) => void}
        />
      </>
    );
  }

  if (kind === "electronics") {
    return (
      <>
        <FieldLabel required>Brand / Model</FieldLabel>
        <TextInput
          style={[styles.input, fieldErr.brandModel && styles.inputErr]}
          value={p.brandModel as string}
          onChangeText={p.setBrandModel as (t: string) => void}
        />
        {radioRow("Condition", p.elecCondition as string, CONDITION_SIMPLE, p.setElecCondition as (v: string) => void)}
        <FieldLabel>Working status</FieldLabel>
        {["Fully working", "Works with issues", "Needs repair", "Parts only"].map((ws) => (
          <Pressable
            key={ws}
            style={styles.radioLine}
            onPress={() => (p.setWorkingStatus as (v: string) => void)(ws)}
          >
            <Ionicons
              name={p.workingStatus === ws ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={p.workingStatus === ws ? C.primary : C.muted}
            />
            <Text style={styles.radioTxt}>{ws}</Text>
          </Pressable>
        ))}
        <Text style={styles.sectionTitle}>Accessories</Text>
        {(["charger", "cable", "box", "manual", "headphones"] as const).map((k) => (
          <ToggleRow
            key={k}
            label={k.charAt(0).toUpperCase() + k.slice(1)}
            value={(p.acc as Record<string, boolean>)[k]}
            onToggle={(v) =>
              (p.setAcc as (fn: (o: Record<string, boolean>) => Record<string, boolean>) => void)((o) => ({
                ...o,
                [k]: v,
              }))
            }
          />
        ))}
      </>
    );
  }

  if (kind === "services") {
    return (
      <>
        {sel("Service type", p.serviceType as string, SERVICE_TYPES, "serviceType", p.setServiceType as (v: string) => void)}
        <FieldLabel>Duration</FieldLabel>
        <TextInput
          style={styles.input}
          value={p.serviceDuration as string}
          onChangeText={p.setServiceDuration as (t: string) => void}
          placeholder="One-time, hourly…"
          placeholderTextColor={C.muted}
        />
        <FieldLabel>Experience level</FieldLabel>
        {(["beginner", "intermediate", "expert"] as const).map((lv) => (
          <Pressable
            key={lv}
            style={styles.radioLine}
            onPress={() => (p.setExperienceLevel as (v: typeof lv) => void)(lv)}
          >
            <Ionicons
              name={p.experienceLevel === lv ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={p.experienceLevel === lv ? C.primary : C.muted}
            />
            <Text style={styles.radioTxt}>{lv}</Text>
          </Pressable>
        ))}
      </>
    );
  }

  if (kind === "education") {
    return (
      <>
        <FieldLabel required>Subject or course</FieldLabel>
        <TextInput
          style={[styles.input, fieldErr.courseSubject && styles.inputErr]}
          value={p.courseSubject as string}
          onChangeText={p.setCourseSubject as (t: string) => void}
        />
        {sel("Level", p.eduLevel as string, EDU_LEVELS, "eduLevel", p.setEduLevel as (v: string) => void)}
        <FieldLabel>Format</FieldLabel>
        {(["online", "inperson", "hybrid"] as const).map((f) => (
          <Pressable
            key={f}
            style={styles.radioLine}
            onPress={() => (p.setEduFormat as (v: typeof f) => void)(f)}
          >
            <Ionicons
              name={p.eduFormat === f ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={p.eduFormat === f ? C.primary : C.muted}
            />
            <Text style={styles.radioTxt}>{f}</Text>
          </Pressable>
        ))}
        <FieldLabel>Duration</FieldLabel>
        <TextInput
          style={styles.input}
          value={p.eduDuration as string}
          onChangeText={p.setEduDuration as (t: string) => void}
          placeholder="e.g. 8 weeks"
          placeholderTextColor={C.muted}
        />
      </>
    );
  }

  if (kind === "sports") {
    return (
      <>
        {sel("Equipment type", p.equipmentType as string, SPORT_TYPES, "equipmentType", p.setEquipmentType as (v: string) => void)}
        {radioRow("Condition", p.sportsCondition as string, CONDITION_SIMPLE, p.setSportsCondition as (v: string) => void)}
      </>
    );
  }

  if (kind === "pets") {
    return (
      <>
        {sel("Pet type", p.petType as string, PET_TYPES, "petType", p.setPetType as (v: string) => void)}
        {sel("Accessory type", p.petItemType as string, PET_ITEMS, "petItemType", p.setPetItemType as (v: string) => void)}
        {radioRow("Condition", p.petCondition as string, CONDITION_SIMPLE, p.setPetCondition as (v: string) => void)}
      </>
    );
  }

  return (
    <>
      <FieldLabel required>Overall condition</FieldLabel>
      {CONDITION_SIMPLE.map((opt) => (
        <Pressable key={opt} style={styles.radioLine} onPress={() => (p.setOtherCondition as (v: string) => void)(opt)}>
          <Ionicons
            name={p.otherCondition === opt ? "radio-button-on" : "radio-button-off"}
            size={20}
            color={p.otherCondition === opt ? C.primary : C.muted}
          />
          <Text style={styles.radioTxt}>{opt}</Text>
        </Pressable>
      ))}
      <FieldLabel>Specific pickup location</FieldLabel>
      <TextInput
        style={styles.input}
        value={p.pickupLocation as string}
        onChangeText={p.setPickupLocation as (t: string) => void}
      />
      <FieldLabel>Availability</FieldLabel>
      <TextInput
        style={styles.textareaSm}
        value={p.availabilityNote as string}
        onChangeText={p.setAvailabilityNote as (t: string) => void}
        multiline
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === "ios" ? 52 : 28 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  iconBtn: { padding: 8, minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: C.text },
  progressOuter: {
    height: 4,
    backgroundColor: C.inputBg,
    marginHorizontal: 24,
    marginTop: 12,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressInner: { height: "100%", backgroundColor: C.primary },
  stepLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 24, marginTop: 8 },
  stepLbl: { fontSize: 11, fontWeight: "600", color: C.muted },
  stepLblOn: { color: C.primary, fontWeight: "800" },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: C.text, marginTop: 16, marginBottom: 10 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  catChip: {
    width: "47%",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  catChipOn: { backgroundColor: C.primary, borderColor: C.primary },
  catChipTxt: { fontSize: 13, fontWeight: "700", color: C.text, textAlign: "center" },
  catChipTxtOn: { color: "#FFF" },
  fieldLbl: { fontSize: 13, fontWeight: "700", color: C.text, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: C.inputBg,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 15,
    color: C.text,
  },
  inputErr: { borderColor: C.err, borderWidth: 1 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.inputBg,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  inputLike: { flex: 1, fontSize: 15, color: C.text, fontWeight: "600" },
  textarea: {
    backgroundColor: C.inputBg,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 120,
    fontSize: 15,
    color: C.text,
  },
  textareaSm: {
    backgroundColor: C.inputBg,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 72,
    fontSize: 15,
    color: C.text,
    textAlignVertical: "top",
  },
  counter: { alignSelf: "flex-end", fontSize: 11, color: C.muted, marginTop: 4 },
  chk: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  chkTxt: { fontSize: 14, color: C.text, flex: 1 },
  radioLine: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  radioTxt: { fontSize: 14, color: C.text },
  errBanner: { color: C.err, fontWeight: "700", marginTop: 12 },
  primaryBtn: {
    backgroundColor: C.secondary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  primaryBtnTxt: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  outlineBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  outlineBtnTxt: { color: C.primary, fontWeight: "800", fontSize: 16 },
  dropZone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.bg,
    paddingVertical: 28,
    alignItems: "center",
    gap: 6,
    minHeight: 120,
  },
  dropTitle: { fontSize: 14, fontWeight: "800", color: C.text },
  dropSub: { fontSize: 12, color: C.muted },
  dropHint: { fontSize: 11, color: C.muted },
  thumbRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  thumbWrap: { position: "relative" },
  thumb: { width: 80, height: 80, borderRadius: 8 },
  thumbX: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 12,
    padding: 4,
  },
  muted: { marginTop: 8, color: C.muted },
  aiNote: { marginTop: 8, color: C.primary, fontSize: 13, lineHeight: 18 },
  previewCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  previewImg: { width: "100%", height: 140, borderRadius: 12, marginBottom: 10 },
  ph: { backgroundColor: C.inputBg },
  previewTitle: { fontSize: 16, fontWeight: "800", color: C.text },
  previewMeta: { fontSize: 13, color: C.muted, marginTop: 4 },
  draftTxt: { textAlign: "center", marginTop: 12, color: C.muted, fontWeight: "600" },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    maxHeight: "80%",
  },
  modalTitle: { fontSize: 16, fontWeight: "800", marginBottom: 10, color: C.text },
  modalRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  modalRowTxt: { fontSize: 15, color: C.text, fontWeight: "600" },
});