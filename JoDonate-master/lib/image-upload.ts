import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 10000;
export const UPLOAD_QUALITY = 0.72;

export type PreparedImage = {
  uri: string;
  width?: number;
  height?: number;
};

export type ImagePickSource = "camera" | "gallery";

export function validatePickerAsset(asset: ImagePicker.ImagePickerAsset): string | null {
  if (asset.fileSize != null && asset.fileSize > MAX_IMAGE_BYTES) {
    return `Image must be under ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB.`;
  }
  const w = asset.width ?? 0;
  const h = asset.height ?? 0;
  if (w > MAX_IMAGE_DIMENSION || h > MAX_IMAGE_DIMENSION) {
    return `Image dimensions must be at most ${MAX_IMAGE_DIMENSION}px.`;
  }
  return null;
}

export function buildImagePickerOptions(
  remaining: number,
  source: ImagePickSource,
): ImagePicker.ImagePickerOptions {
  return {
    mediaTypes: ["images"],
    quality: UPLOAD_QUALITY,
    allowsMultipleSelection: source === "gallery" && remaining > 1,
    selectionLimit: remaining,
    exif: false,
  };
}

export async function requestImagePermission(source: ImagePickSource): Promise<boolean> {
  if (source === "camera") {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === "granted";
  }
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === "granted";
}

export async function pickImageAssets(
  source: ImagePickSource,
  remaining: number,
): Promise<ImagePicker.ImagePickerAsset[] | null> {
  const granted = await requestImagePermission(source);
  if (!granted) {
    Alert.alert(
      "Permission needed",
      source === "camera"
        ? "Allow camera access to take a photo."
        : "Allow photo access to upload images.",
    );
    return null;
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(buildImagePickerOptions(1, "camera"))
      : await ImagePicker.launchImageLibraryAsync(buildImagePickerOptions(remaining, "gallery"));

  if (result.canceled) return null;
  return result.assets;
}

export function promptImageSource(onPick: (source: ImagePickSource) => void) {
  Alert.alert("Add photo", "Choose a source", [
    { text: "Camera", onPress: () => onPick("camera") },
    { text: "Gallery", onPress: () => onPick("gallery") },
    { text: "Cancel", style: "cancel" },
  ]);
}

export function showImageValidationError(message: string) {
  Alert.alert("Image not accepted", message);
}
