import { initializeApp, getApp, getApps } from "firebase/app";

import { initializeAuth, getAuth } from "firebase/auth";
import type { Persistence } from "firebase/auth";

import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { Platform } from "react-native";


const firebaseConfig = {
   apiKey: "AIzaSyA2IKwcqRyKgkw_RM5JaPYicMwvgyxSVEA",
  authDomain: "jo-donate-68a86.firebaseapp.com",
  projectId: "jo-donate-68a86",
  storageBucket: "jo-donate-68a86.firebasestorage.app",
  messagingSenderId: "966467786465",
  appId: "1:966467786465:web:842ba445278e2d6f1689a0",
  measurementId: "G-MW0R3LRLRR"
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createAuth() {
  if (Platform.OS === "web") {
    return getAuth(app);
  }

  const { getReactNativePersistence } = require("firebase/auth") as {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
  };
  const rnPersistence = getReactNativePersistence;
  if (typeof rnPersistence !== "function") {
    return getAuth(app);
  }

  try {
    return initializeAuth(app, {
      persistence: rnPersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

export const auth = createAuth();

export const db = getFirestore(app);

/** Callable functions (categorizeItemFromImage) deploy to us-central1 by default. */
export const functions = getFunctions(app, "us-central1");

//export const storage = getStorage(app);

