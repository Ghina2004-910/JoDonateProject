import * as Location from "expo-location";
import { Alert } from "react-native";

export type Coords = { latitude: number; longitude: number };

export async function getCurrentCoords(): Promise<Coords | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) return null;

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
  } catch {
    return null;
  }
}

export function distanceKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function withinRadiusKm(
  user: Coords,
  item: { latitude?: number; longitude?: number },
  radiusKm: number,
): boolean {
  if (item.latitude == null || item.longitude == null) return false;
  return distanceKm(user, { latitude: item.latitude, longitude: item.longitude }) <= radiusKm;
}

export async function requestLocationForFilter(): Promise<Coords | null> {
  const coords = await getCurrentCoords();
  if (!coords) {
    Alert.alert(
      "Location unavailable",
      "Enable location permission and GPS, then try again.",
    );
  }
  return coords;
}
