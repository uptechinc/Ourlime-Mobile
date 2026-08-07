import * as Location from 'expo-location';
import { ApiService } from './ApiService';
import type { PostLocation } from './PostService';

export type LocationSearchResult = {
  displayName: string;
  lat: number;
  lng: number;
};

const isSearchResult = (value: unknown): value is LocationSearchResult => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.displayName === 'string'
    && typeof record.lat === 'number'
    && Number.isFinite(record.lat)
    && typeof record.lng === 'number'
    && Number.isFinite(record.lng);
};

export class LocationService {
  private static instance: LocationService;
  private readonly apiService = ApiService.getInstance();

  private constructor() {}

  public static getInstance(): LocationService {
    if (!LocationService.instance) LocationService.instance = new LocationService();
    return LocationService.instance;
  }

  public async search(query: string): Promise<LocationSearchResult[]> {
    const normalized = query.trim();
    if (normalized.length < 3) return [];
    const response = await this.apiService.request<unknown[]>(
      `/api/triniGeoGuesser/geocode?q=${encodeURIComponent(normalized)}&limit=6`
    );
    return response.filter(isSearchResult);
  }

  public async getCurrentLocation(): Promise<PostLocation> {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      throw new Error('Location permission was not granted.');
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return this.reverseGeocode(position.coords.latitude, position.coords.longitude);
  }

  public async reverseGeocode(lat: number, lng: number): Promise<PostLocation> {
    const matches = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const match = matches[0];
    const parts = match
      ? [match.name, match.street, match.city, match.region, match.country].filter((value): value is string => Boolean(value))
      : [];
    const address = Array.from(new Set(parts)).join(', ') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    return {
      name: match?.name || match?.city || address.split(',')[0] || 'Pinned location',
      address,
      lat,
      lng,
    };
  }

  public fromSearchResult(result: LocationSearchResult): PostLocation {
    return {
      name: result.displayName.split(',')[0]?.trim() || 'Pinned location',
      address: result.displayName,
      lat: result.lat,
      lng: result.lng,
    };
  }
}
