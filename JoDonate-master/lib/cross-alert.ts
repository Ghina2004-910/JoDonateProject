import { Alert, Platform } from "react-native";

type AlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

export function crossAlert(
  title: string,
  message: string,
  buttons?: AlertButton[],
) {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons);
    return;
  }

  if (!buttons || buttons.length === 0) {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  const cancelBtn = buttons.find((b) => b.style === "cancel");
  const actionBtn = buttons.find((b) => b.style !== "cancel") ?? buttons[0];

  if (buttons.length <= 1) {
    window.alert(`${title}\n\n${message}`);
    actionBtn?.onPress?.();
    return;
  }

  const result = window.confirm(`${title}\n\n${message}`);
  if (result) {
    actionBtn?.onPress?.();
  } else {
    cancelBtn?.onPress?.();
  }
}
