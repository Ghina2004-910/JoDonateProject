if (typeof global.DOMException === 'undefined') {
  global.DOMException = class DOMException extends Error {
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name || 'DOMException';
    }
  } as any;
}
import { LogBox } from 'react-native';

LogBox.ignoreLogs([
  'setLayoutAnimationEnabledExperimental',
]);

import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import {
  Href,
  Stack,
  useNavigationContainerRef,
  useRouter,
  useSegments,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { consumePendingRoute, getRouteForUser } from "@/lib/route-intent";
import { UserProfileProvider } from "@/lib/user-profile-context";
import { LocaleProvider } from "@/lib/locale-context";

function AuthGate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationRef = useNavigationContainerRef();
  const [navReady, setNavReady] = useState(() => navigationRef.isReady());
  const hasRouted = useRef(false);

  useEffect(() => {
    if (navigationRef.isReady()) {
      setNavReady(true);
      return;
    }
    const onState = () => {
      if (navigationRef.isReady()) setNavReady(true);
    };
    const unsub = navigationRef.addListener("state", onState);
    const t = setTimeout(onState, 0);
    return () => {
      unsub();
      clearTimeout(t);
    };
  }, [navigationRef]);

  useEffect(() => {
    if (loading || !navReady) return;

    const group = segments[0];
    if (group !== "(onboarding)" && group !== "(private)") return;

    const inOnboarding = group === "(onboarding)";
    const inPrivate = group === "(private)";

    if (user && inOnboarding) {
      if ((segments as string[]).includes("verify-email")) return;
      if (hasRouted.current) return;

      const pendingRoute = consumePendingRoute();
      if (pendingRoute) {
        hasRouted.current = true;
        router.replace(pendingRoute as Href);
      } else {
        hasRouted.current = true;
        void getRouteForUser(user.uid).then((route) => {
          router.replace(route as Href);
        });
      }
    } else if (!user && inPrivate) {
      hasRouted.current = false;
      router.replace("/(onboarding)" as Href);
    }
  }, [user, loading, segments, router, navReady]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <LocaleProvider>
        <UserProfileProvider>
          <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(private)" />
              <Stack.Screen name="modal" options={{ presentation: "modal" }} />
            </Stack>
            <AuthGate />
            <StatusBar style="auto" />
          </ThemeProvider>
        </UserProfileProvider>
      </LocaleProvider>
    </AuthProvider>
  );
}