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
  | "inAppNotifications";

const en: Record<DictKey, string> = {
  settings: "Settings",
  profile: "Profile",
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
  arabic: "العربية",
  myDonations: "تبرعاتي",
  searchPlaceholder: "ابحث عن تبرعات أو فئات...",
  viewAll: "عرض الكل",
  noFavorites: "لا توجد عناصر مفضلة",
  inAppNotifications: "إشعارات داخل التطبيق",
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
