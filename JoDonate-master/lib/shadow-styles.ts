import { Platform, type ViewStyle } from "react-native";


export function cardShadowSoft(): ViewStyle {
  if (Platform.OS === "web") {
    return { boxShadow: "0px 1px 4px rgba(0, 0, 0, 0.07)" };
  }
  if (Platform.OS === "ios") {
    return {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.07,
      shadowRadius: 5,
    };
  }
  return { elevation: 2 };
}

export function cardShadowMedium(): ViewStyle {
  if (Platform.OS === "web") {
    return { boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.08)" };
  }
  if (Platform.OS === "ios") {
    return {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    };
  }
  return { elevation: 4 };
}
