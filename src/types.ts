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

export interface SavedRentalFields {
  title: string;
  locationText: string;
  amount: number;
  period: "monthly" | "yearly";
  minimumMonths: number | null;
  note: string;
}

export interface SavedRentalEntry extends SavedRentalFields {
  rentalId: string;
  kind: HousingType;
  sourceUrl: string;
  location: { lat: number; lng: number } | null;
  savedAt: string;
  updatedAt: string;
}

export interface SavedRental extends SavedRentalEntry {
  shareToken: string | null;
}

export interface RentalComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface SharedRental {
  rental: SavedRentalEntry;
  comments: RentalComment[];
}

export const BOOKMARK_PERMISSIONS = ["view", "comment", "edit"] as const;
export type BookmarkPermission = (typeof BOOKMARK_PERMISSIONS)[number];

export interface BookmarkSummary {
  id: string;
  name: string;
  revision: number;
  rentalIds: string[];
}

export interface BookmarkItem {
  rental: SavedRentalEntry;
  comments: RentalComment[];
}

export interface BookmarkContents {
  name: string;
  revision: number;
  items: BookmarkItem[];
}

export interface OwnedBookmark extends BookmarkContents {
  id: string;
  share: { token: string; permission: BookmarkPermission } | null;
}

export interface SharedBookmark extends BookmarkContents {
  permission: BookmarkPermission;
}

export interface BookmarkLibrary {
  collections: BookmarkSummary[];
  hasLegacyRentals: boolean;
}

export interface BookmarkChange {
  revision: number;
  action: "create" | "rename" | "add" | "edit" | "remove" | "share";
  author: string;
  createdAt: string;
  item?: string;
  fields: {
    key: keyof SavedRentalFields | "name" | "permission";
    before: string | number | null;
    after: string | number | null;
  }[];
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
