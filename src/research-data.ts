import { money } from "./geo.ts";
import { AREAS, type Area, type Listing, type Pin } from "./types.ts";

// Data riset properti nyata dari /data/properties.geojson, dibangun oleh
// scripts/build-properties.py. Harga selalu dari sumber yang dibuka pada
// tanggal cek; jarak stasiun dihitung garis lurus, bukan klaim pemasaran.

export type ResearchStatus =
  | "dipasarkan"
  | "pre-launch"
  | "inden"
  | "siap-huni"
  | "tidak-jelas";
export type ResearchSourceKind =
  | "developer"
  | "portal"
  | "news"
  | "instagram"
  | "government"
  | "osm"
  | "other";
export type RailMode = "KRL" | "MRT" | "LRT";

export interface ResearchSource {
  url: string;
  kind: ResearchSourceKind;
  title: string;
  fetched: boolean;
  pageDate: string | null;
  supports: string[];
  note: string | null;
}

export interface ResearchStation {
  mode: RailMode;
  name: string;
  km: number;
  lat: number;
  lng: number;
}

export interface ResearchUnit {
  label: string;
  bedrooms: number | null;
  landArea: number | null;
  buildingArea: number | null;
  price: number | null;
}

// Estimasi penduduk tempat tinggal di sekitar titik proyek, dari raster
// WorldPop yang dihitung scripts/build-population-context.py.
export interface ResearchPopulation {
  within500m: number;
  within1km: number;
  densityKm2: number;
}

export interface PopulationContext {
  source: {
    id: string;
    name: string;
    publisher: string;
    url: string;
    licence: string;
    licenceUrl: string;
    year: number;
    checkedAt: string;
  };
  method: string;
  caveats: string[];
  radiiKm: number[];
}

export interface ResearchProperty {
  id: string;
  name: string;
  developer: string | null;
  kind: "Rumah" | "Apartemen";
  subsidized: boolean | null;
  locationText: string;
  region: string | null;
  area: Area | null;
  status: ResearchStatus;
  statusQuote: string | null;
  statusUrl: string | null;
  price: {
    min: number;
    max: number | null;
    basis: string;
    quote: string;
    url: string;
    pageDate: string | null;
    currency: "IDR";
  };
  units: ResearchUnit[];
  transitClaim: { quote: string; url: string } | null;
  officialUrl: string | null;
  coordinate: {
    method: string;
    url: string;
    precision: string;
    note: string | null;
  } | null;
  nearest: ResearchStation[];
  population?: ResearchPopulation | null;
  verdict: "confirmed" | "partial";
  sources: ResearchSource[];
  lastChecked: string;
  corridor: string;
  methods: string[];
  lat: number | null;
  lng: number | null;
}

export interface ResearchMethod {
  id: string;
  name: string;
  category: string;
  summary: string;
  steps: string[];
  limits: string[];
  recommended: boolean;
  lastUsed: string;
  sources: { url: string; title: string }[];
}

export interface ResearchCoverage {
  id: string;
  label: string;
  found: number;
  included: number;
}

export interface ResearchData {
  checkedAt: string;
  maxDistanceKm: number;
  properties: ResearchProperty[];
  methods: ResearchMethod[];
  coverage: ResearchCoverage[];
  gaps: string[];
  excluded: { id: string; name: string; reason: string }[];
  population: PopulationContext | null;
}

export const STATUS_LABELS: Record<ResearchStatus, string> = {
  dipasarkan: "Dipasarkan",
  "pre-launch": "Pra-peluncuran",
  inden: "Inden",
  "siap-huni": "Siap huni",
  "tidak-jelas": "Status belum jelas",
};

export const SOURCE_LABELS: Record<ResearchSourceKind, string> = {
  developer: "Situs developer",
  portal: "Portal properti",
  news: "Berita",
  instagram: "Instagram",
  government: "Pemerintah/BUMN",
  osm: "OpenStreetMap",
  other: "Sumber lain",
};

export async function loadResearch(): Promise<ResearchData> {
  const response = await fetch("/data/properties.geojson");
  if (!response.ok) throw new Error("Data riset properti belum termuat.");
  const data = (await response.json()) as GeoJSON.FeatureCollection & {
    metadata?: Partial<Omit<ResearchData, "properties">>;
  };
  const properties = data.features.map((feature) => {
    const point =
      feature.geometry?.type === "Point"
        ? feature.geometry.coordinates
        : undefined;
    return {
      ...(feature.properties as Omit<ResearchProperty, "lat" | "lng">),
      lat: point?.[1] ?? null,
      lng: point?.[0] ?? null,
    };
  });
  const metadata = data.metadata ?? {};
  return {
    checkedAt: metadata.checkedAt ?? "",
    maxDistanceKm: metadata.maxDistanceKm ?? 3,
    methods: metadata.methods ?? [],
    coverage: metadata.coverage ?? [],
    gaps: metadata.gaps ?? [],
    excluded: metadata.excluded ?? [],
    population: metadata.population ?? null,
    properties,
  };
}

export function priceRange(property: ResearchProperty): string {
  const { min, max } = property.price;
  return max && max > min ? `${money(min)} – ${money(max)}` : money(min);
}

export function checkedDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return value ?? "";
  return new Date(`${value.slice(0, 10)}T12:00:00+07:00`).toLocaleDateString(
    "id-ID",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    },
  );
}

// Estimasi model dibulatkan ke ratusan agar tidak terbaca sebagai hitungan pasti.
export function peopleText(value: number): string {
  return value < 100
    ? "<100"
    : `±${(Math.round(value / 100) * 100).toLocaleString("id-ID")}`;
}

export function populationText(
  population: ResearchPopulation,
  context: PopulationContext,
): string {
  return `${peopleText(population.within1km)} jiwa dalam 1 km · ${peopleText(population.within500m)} dalam 500 m · ${peopleText(population.densityKm2)}/km² (estimasi ${context.source.publisher.split(",")[0]} ${context.source.year})`;
}

export function distanceText(km: number): string {
  return `${km.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`;
}

export function nearestRail(
  property: ResearchProperty,
  mode?: RailMode,
): ResearchStation | undefined {
  return property.nearest.find((station) => !mode || station.mode === mode);
}

// Tautan sumber hanya http(s); nilai lain tidak dijadikan href.
export function safeUrl(value: string | null | undefined): string {
  if (!value) return "#";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.toString()
      : "#";
  } catch {
    return "#";
  }
}

function clip(value: string, maximum: number): string {
  return value.length > maximum ? `${value.slice(0, maximum - 1)}…` : value;
}

function representativeUnit(property: ResearchProperty) {
  return (
    property.units.find((unit) => unit.price === property.price.min) ??
    property.units[0]
  );
}

export function researchNote(property: ResearchProperty): string {
  const unit = representativeUnit(property);
  const station = nearestRail(property);
  return clip(
    [
      `Dari Riset properti, dicek ${checkedDate(property.lastChecked)}.`,
      `${property.price.basis}: ${priceRange(property)} (sumber: ${property.price.url}).`,
      property.developer ? `Developer: ${property.developer}.` : "",
      property.officialUrl ? `Situs proyek: ${property.officialUrl}.` : "",
      ...property.sources
        .filter((source) => source.kind === "instagram")
        .map((source) => `Instagram (isi belum diverifikasi): ${source.url}.`),
      station
        ? `${station.mode} ${station.name} ${distanceText(station.km)} garis lurus.`
        : "",
      unit?.bedrooms === null || unit?.bedrooms === undefined
        ? "Jumlah kamar/luas belum tercatat dari sumber."
        : "",
      "Harga dan ketersediaan dapat berubah; konfirmasi ke developer.",
      `Bukti riset: /riset#${property.id}`,
    ]
      .filter(Boolean)
      .join(" "),
    3900,
  );
}

// Bentuk Listing agar riset bisa tampil di peta dan disimpan ke Listingku.
export function researchToListing(
  property: ResearchProperty,
): Listing | undefined {
  if (
    property.lat === null ||
    property.lng === null ||
    !property.area ||
    !AREAS.includes(property.area)
  )
    return undefined;
  const unit = representativeUnit(property);
  return {
    id: property.id,
    title: clip(property.name, 160),
    area: property.area,
    district: clip(property.locationText, 120),
    price: property.price.min,
    type: property.kind,
    bedrooms: unit?.bedrooms ?? 0,
    landArea: unit?.landArea ?? unit?.buildingArea ?? 0,
    lat: property.lat,
    lng: property.lng,
    sourceUrl: property.price.url,
    notes: researchNote(property),
    createdAt: property.lastChecked,
  };
}

export function researchToPin(
  property: ResearchProperty,
): Omit<Pin, "id" | "createdAt"> | undefined {
  if (property.lat === null || property.lng === null) return undefined;
  return {
    name: clip(property.name, 160),
    category: "lainnya",
    lat: property.lat,
    lng: property.lng,
    notes: clip(researchNote(property), 1900),
  };
}
