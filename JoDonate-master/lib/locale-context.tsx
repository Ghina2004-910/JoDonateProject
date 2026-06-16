import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loadLocale, setLocale as persistLocale, type Locale } from "@/lib/i18n";
type DictKey =
  | "settings"
  | "profile"
  | "myAds"
  | "requestDonation"
  | "adminPanel"
  | "committeeReviews"
  | "verifyEmail"
  | "home"
  | "donations"
  | "notifications"
  | "nearMe"
  | "useGps"
  | "favorites"
  | "add"
  | "chat"
  | "language"
  | "english"
  | "arabic"
  | "myDonations"
  | "searchPlaceholder"
  | "viewAll"
  | "noFavorites"
  | "inAppNotifications"
  | "viewAllCategories"
| "browseCategories"
| "hotDonations"
| "activeListings"
| "categories"
| "inFeedNow"
| "foodGrocery"
| "clothesFashion"
| "services"
| "allDonations"
| "searchDonations"
| "sort"
| "allCategories"
| "condition"
| "pleaseLogin"
| "signInFavorites"
| "cancel"
| "login"
| "signUp"
| "comingSoon"
| "browseCategory"
| "account"
| "preferences"
| "privacy"
| "securityShortcuts"
| "data"
| "changeEmail"
| "changePassword"
| "profileVisibility"
| "public"
| "private"
| "showPhone"
| "showEmail"
| "allowMessages"
| "onPublicProfile"
| "otherUsersCanChat"
| "emailResetLink"
| "downloadMyData"
| "deleteAccount"
| "allCategories"
| "companyEquipment"
| "games"
| "electronics"
| "sportsFitness"
| "educationTraining"
| "petsAccessories"
| "beautyHealth"
| "books"
| "addNewDonation"
| "selectCategory"
| "donationTitle"
| "description"
| "locationCity"
| "selectCity"
| "nextImages"
| "details"
| "images"
| "review"
| "size"
| "for"
| "material"
| "brand"
  | "optional"
  | "colors"
  | "noSentRequests"
| "noReceivedRequests"
| "loading"
| "unknown"
| "newest"
| "popular"
| "mostViews"
| "any"
| "all"
| "unread"
| "messages"
| "allFilter"
| "fullName"
| "phoneNumber"
| "emailAddress"
| "cityLocation"
| "bio"
| "publicProfile"
| "othersCanSee"
| "showEmailProfile"
| "showPhoneProfile"
| "editProfile"
| "updateInfo"
| "active"
| "expired"
| "markDonated"
| "deleteConfirm"
| "forgotPassword"
| "noSentRequests"
| "noReceivedRequests"
| "loading"
| "unknown"
| "newest"
| "mostRelevant"
| "popular"
| "mostViews"
| "any"
| "all"
| "unread"
| "messages"
| "allFilter"
| "fullName"
| "phoneNumber"
| "emailAddress"
| "cityLocation"
| "bio"
| "publicProfile"
| "othersCanSee"
| "showEmailProfile"
| "showPhoneProfile"
| "editProfile"
| "updateInfo"
| "active"
| "expired"
| "markDonated"
| "deleteConfirm"
| "forgotPassword";
const en: Record<DictKey, string> = {
  settings: "Settings",
  profile: "Profile",
  myAds: "My Ads",
  browseCategory: "Browse listings in this category",
  requestDonation: "Request donation",
  adminPanel: "Admin panel",
  committeeReviews: "Committee reviews",
  verifyEmail: "Verify your email",
  home: "Home",
  donations: "Donations",
  notifications: "Notifications",
  nearMe: "Near me",
  useGps: "Use my location",
  favorites: "Favorites",
  add: "Add",
  chat: "Chat",
  language: "Language",
  english: "English",
  arabic: "Arabic",
  myDonations: "My Donations",
  searchPlaceholder: "Search donations, categories...",
  viewAll: "View All",
  noFavorites: "No favorites yet",
  inAppNotifications: "In-app notifications",
  viewAllCategories: "View all categories",
  browseCategories: "Browse Categories",
  hotDonations: "Hot Donations",
  activeListings: "Active listings",
  categories: "Categories",
  inFeedNow: "In feed now",
  foodGrocery: "Food & Grocery",
  clothesFashion: "Clothes & Fashion",
  services: "Services",
  pleaseLogin: "Please login",
  signInFavorites: "Sign in to use favorites",
  cancel: "Cancel",
  login: "Login",
  signUp: "Sign Up",
  comingSoon: "Coming Soon",
  allDonations: "All Donations",
  searchDonations: "Search donations...",
  sort: "Sort",
  condition: "Condition",
  account: "Account",
  preferences: "Preferences",
  privacy: "Privacy",
  securityShortcuts: "Security shortcuts",
  data: "Data",
  changeEmail: "Change email",
  changePassword: "Change password",
  profileVisibility: "Profile visibility",
  public: "Public",
  private: "Private",
  showPhone: "Show phone",
  showEmail: "Show email",
  allowMessages: "Allow messages",
  onPublicProfile: "On your public profile",
  otherUsersCanChat: "Other users can chat with you",
  emailResetLink: "Email me a reset link",
  downloadMyData: "Download my data",
  deleteAccount: "Delete account",
  allCategories: "All Categories",
  companyEquipment: "Company Equipment",
  games: "Games",
  electronics: "Electronics",
  sportsFitness: "Sports & Fitness",
  educationTraining: "Education & Training",
  petsAccessories: "Pets & Accessories",
  beautyHealth: "Beauty & Health",
  books: "Books",
  addNewDonation: "Add New Donation",
  selectCategory: "Select Category",
  donationTitle: "Donation Title",
  description: "Description",
  locationCity: "Location / City",
  selectCity: "Select or enter city",
  nextImages: "Next: Images",
  details: "Details",
  images: "Images",
  review: "Review",
  size: "Size",
  for: "For",
  material: "Material",
  brand: "Brand",
  optional: "Optional",
  colors: "Color(s)",
  noSentRequests: "No sent requests yet.",
  noReceivedRequests: "No received requests yet.",
  loading: "Loading...",
  unknown: "Unknown item",
  newest: "Newest",
  popular: "Popular",
  mostViews: "Most Views",
  any: "Any",
  all: "All",
  unread: "Unread",
  messages: "Messages",
  allFilter: "All",
  fullName: "Full name",
  phoneNumber: "Phone Number",
  emailAddress: "Email Address",
  cityLocation: "City / Location",
  bio: "Bio / About",
  publicProfile: "Public profile",
  othersCanSee: "Others can see your profile summary",
  showEmailProfile: "Show email",
  showPhoneProfile: "Show phone",
  editProfile: "Edit Profile",
  updateInfo: "Update your information",
  active: "Active",
  expired: "Expired",
  markDonated: "Mark Donated",
  deleteConfirm: "Delete",
  forgotPassword: "Forgot password?",
  mostRelevant: ""
};

const ar: Record<DictKey, string> = {
  settings: "الإعدادات",
  profile: "الملف الشخصي",
  myAds: "إعلاناتي",
  requestDonation: "طلب تبرع",
  adminPanel: "لوحة الإدارة",
  committeeReviews: "مراجعات اللجنة",
  verifyEmail: "تحقق من بريدك",
  home: "الرئيسية",
  donations: "التبرعات",
  notifications: "الإشعارات",
  nearMe: "بالقرب مني",
  useGps: "استخدم موقعي",
  favorites: "المفضلة",
  add: "إضافة",
  chat: "محادثات",
  language: "اللغة",
  english: "English",
  browseCategory: "تصفح العناصر في هذه الفئة",
  arabic: "العربية",
  myDonations: "تبرعاتي",
  searchPlaceholder: "ابحث عن تبرعات أو فئات...",
  viewAll: "عرض الكل",
  noFavorites: "لا توجد عناصر مفضلة",
  inAppNotifications: "إشعارات داخل التطبيق",
  viewAllCategories: "عرض جميع الفئات",
  browseCategories: "تصفح الفئات",
  hotDonations: "أحدث التبرعات",
  activeListings: "الإعلانات النشطة",
  categories: "الفئات",
  inFeedNow: "المعروض حالياً",
  foodGrocery: "الأغذية والبقالة",
  clothesFashion: "الملابس والأزياء",
  services: "الخدمات",
  pleaseLogin: "يرجى تسجيل الدخول",
  signInFavorites: "سجل دخولك لاستخدام المفضلة",
  cancel: "إلغاء",
  login: "تسجيل الدخول",
  signUp: "إنشاء حساب",
  comingSoon: "قريباً",
  allDonations: "جميع التبرعات",
  searchDonations: "ابحث عن التبرعات...",
  sort: "الترتيب",
  addNewDonation: "إضافة تبرع جديد",
  condition: "الحالة",
  account: "الحساب",
  preferences: "التفضيلات",
  privacy: "الخصوصية",
  securityShortcuts: "اختصارات الأمان",
  data: "البيانات",
  changeEmail: "تغيير البريد الإلكتروني",
  changePassword: "تغيير كلمة المرور",
  profileVisibility: "ظهور الملف الشخصي",
  public: "عام",
  private: "خاص",
  showPhone: "إظهار الهاتف",
  showEmail: "إظهار البريد الإلكتروني",
  allowMessages: "السماح بالرسائل",
  onPublicProfile: "في ملفك الشخصي العام",
  otherUsersCanChat: "يمكن للمستخدمين مراسلتك",
  emailResetLink: "إرسال رابط إعادة تعيين",
  downloadMyData: "تحميل بياناتي",
  deleteAccount: "حذف الحساب",
  allCategories: "جميع الفئات",
  companyEquipment: "معدات الشركات",
  games: "الألعاب",
  electronics: "الإلكترونيات",
  sportsFitness: "الرياضة واللياقة",
  educationTraining: "التعليم والتدريب",
  petsAccessories: "الحيوانات الأليفة ومستلزماتها",
  beautyHealth: "الجمال والصحة",
  books: "الكتب",
  selectCategory: "اختر الفئة",
  donationTitle: "عنوان التبرع",
  description: "الوصف",
  locationCity: "المدينة",
  selectCity: "اختر أو أدخل مدينة",
  nextImages: "التالي: الصور",
  details: "التفاصيل",
  images: "الصور",
  review: "المراجعة",
  size: "المقاس",
  for: "الفئة",
  material: "الخامة",
  brand: "العلامة التجارية",
  optional: "اختياري",
  colors: "الألوان",
  noSentRequests: "لا توجد طلبات مرسلة.",
  noReceivedRequests: "لا توجد طلبات واردة.",
  loading: "جار التحميل...",
  unknown: "عنصر غير معروف",
  newest: "الأحدث",
  popular: "الأكثر شهرة",
  mostViews: "الأكثر مشاهدة",
  any: "أي",
  all: "الكل",
  unread: "غير مقروء",
  messages: "الرسائل",
  allFilter: "الكل",
  fullName: "الاسم الكامل",
  phoneNumber: "رقم الهاتف",
  emailAddress: "البريد الإلكتروني",
  cityLocation: "المدينة / الموقع",
  bio: "نبذة عني",
  publicProfile: "الملف العام",
  othersCanSee: "يمكن للآخرين رؤية ملخص ملفك الشخصي",
  showEmailProfile: "إظهار البريد",
  showPhoneProfile: "إظهار الهاتف",
  editProfile: "تعديل الملف",
  updateInfo: "تحديث معلوماتك",
  active: "نشط",
  expired: "منتهي",
  markDonated: "تم التبرع",
  deleteConfirm: "حذف",
  forgotPassword: "نسيت كلمة المرور؟",
  mostRelevant: ""
};

const dict: Record<Locale, Record<DictKey, string>> = { en, ar };

type LocaleContextValue = {
  locale: Locale;
  setAppLocale: (locale: Locale) => Promise<void>;
  t: (key: DictKey) => string;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setAppLocale: async () => {},
  t: (key) => en[key],
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void loadLocale().then((loaded) => {
      setLocaleState(loaded);
      setReady(true);
    });
  }, []);

  const setAppLocale = useCallback(async (next: Locale) => {
    await persistLocale(next);
    setLocaleState(next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setAppLocale,
      t: (key) => dict[locale][key] ?? dict.en[key] ?? key,
    }),
    [locale, setAppLocale],
  );

  if (!ready) return null;

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}