import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager } from "react-native";

export type Locale = "en" | "ar";

const STORAGE_KEY = "jodonate_locale_v1";

const en = {
  settings: "Settings",
  profile: "Profile",
  myRequests: "My Requests",
  myAds: "My Ads",
  requestDonation: "Request donation",
  adminPanel: "Admin panel",
  committeeReviews: "Committee reviews",
  verifyEmail: "Verify your email",
  home: "Home",
  donations: "Donations",
  notifications: "Notifications",
  nearMe: "Near me",
  useGps: "Use my location",

  viewAllCategories: "View all categories",
  browseCategories: "Browse Categories",
  hotDonations: "Hot Donations",
  activeListings: "Active listings",
  categories: "Categories",
  inFeedNow: "In feed now",
  searchPlaceholder: "Search donations or requests",

  foodGrocery: "Food & Grocery",
  clothesFashion: "Clothes & Fashion",
  services: "Services",
  companyEquipment: "Company Equipment",
games: "Games",
electronics: "Electronics",
sportsFitness: "Sports & Fitness",
educationTraining: "Education & Training",
petsAccessories: "Pets & Accessories",
beautyHealth: "Beauty & Health",
books: "Books",
} as const;


const ar: Record<keyof typeof en, string> = {
  settings: "الإعدادات",
  profile: "الملف الشخصي",
  myRequests: "طلباتي",
  myAds: "إعلاناتي",
  requestDonation: "طلب تبرع",
  adminPanel: "لوحة الإدارة",
  committeeReviews: "مراجعات اللجنة",
  verifyEmail: "تحقق من بريدك الإلكتروني",
  home: "الرئيسية",
  donations: "التبرعات",
  notifications: "الإشعارات",
  nearMe: "بالقرب مني",
  useGps: "استخدم موقعي",

  viewAllCategories: "عرض جميع الفئات",
  browseCategories: "تصفح الفئات",
  hotDonations: "أحدث التبرعات",
  activeListings: "الإعلانات النشطة",
  categories: "الفئات",
  inFeedNow: "المعروض حالياً",
  searchPlaceholder: "ابحث عن تبرعات أو طلبات",

  foodGrocery: "الأغذية والبقالة",
  clothesFashion: "الملابس والأزياء",
  services: "الخدمات",
  companyEquipment: "معدات الشركات",
games: "الألعاب",
electronics: "الإلكترونيات",
sportsFitness: "الرياضة واللياقة",
educationTraining: "التعليم والتدريب",
petsAccessories: "الحيوانات الأليفة وملحقاتها",
beautyHealth: "الجمال والصحة",
books: "الكتب",
};

const dict: Record<Locale, Record<keyof typeof en, string>> = { en, ar };

let currentLocale: Locale = "en";

export function t(key: keyof typeof en): string {
  return dict[currentLocale][key] ?? dict.en[key] ?? key;
}

export function getLocale(): Locale {
  return currentLocale;
}

export async function loadLocale(): Promise<Locale> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === "ar" || raw === "en") {
      currentLocale = raw;
      applyRtl(raw === "ar");
    }
  } catch {
    /* ignore */
  }
  return currentLocale;
}

export async function setLocale(locale: Locale): Promise<void> {
  currentLocale = locale;
  await AsyncStorage.setItem(STORAGE_KEY, locale);
  applyRtl(locale === "ar");
}

function applyRtl(rtl: boolean) {
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
}