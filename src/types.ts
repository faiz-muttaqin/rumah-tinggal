export const AREAS = [
  "Jakarta",
  "Bogor",
  "Depok",
  "Tangerang",
  "Bekasi",
] as const;
export type Area = (typeof AREAS)[number];
export type HousingType = "Rumah" | "Apartemen" | "Kos";

export interface Listing {
  id: string;
  title: string;
  area: Area;
  district: string;
  price: number;
  type: HousingType;
  bedrooms: number;
  landArea: number;
  lat: number;
  lng: number;
  stationId?: string;
  sourceUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface Station {
  id: string;
  name: string;
  mode: string;
  lines: string[];
  lng: number;
  lat: number;
}

export const PIN_CATEGORIES = [
  "masjid",
  "ibadah",
  "sekolah",
  "kampus",
  "kesehatan",
  "belanja",
  "taman",
  "publik",
  "kantor",
  "lainnya",
] as const;
export type PinCategory = (typeof PIN_CATEGORIES)[number];

export interface Pin {
  id: string;
  name: string;
  category: PinCategory;
  lat: number;
  lng: number;
  notes?: string;
  createdAt: string;
}

export interface Place {
  id: string;
  name: string;
  detail: string;
  kind: string;
  lat: number;
  lng: number;
}

export interface FirebaseSettings {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
}

export interface AppConfig {
  firebase: FirebaseSettings;
  authConfigured: boolean;
}
