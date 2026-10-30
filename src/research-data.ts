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
export type StationStatus =
  | "operating"
  | "partially-operating"
  | "under-construction"
  | "tendering-or-preparation"
  | "approved-plan"
  | "proposed-study"
  | "stalled-or-cancelled"
  | "unclear";
export type StationScope = "all" | "operating" | "planned";

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
  status?: StationStatus;
  line?: string;
  planned?: boolean;
}

// Rencana perluasan LRT/KRL dari research/planned-stations.json. Status dan
// target selalu mengutip sumber bertanggal; target bukan kepastian operasi.
export interface PlannedLine {
  id: string;
  name: string;
  mode: RailMode;
  operator: string | null;
  segment: string;
  status: StationStatus;
  statusAsOf: string | null;
  statusQuote: string | null;
  targetOpening: string | null;
  note: string | null;
  sources: {
    url: string;
    title: string;
    publisher: string;
    kind: string;
    pageDate: string | null;
  }[];
}

export interface PlannedStation {
  name: string;
  mode: RailMode;
  line: string;
  status: StationStatus;
  lat: number;
  lng: number;
  precision: string;
  coordinateUrl: string;
  locationText: string | null;
}

export interface PlannedContext {
  checkedAt: string;
  note: string | null;
  qualifyingStatuses: StationStatus[];
  lines: PlannedLine[];
  stations: PlannedStation[];
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

// Masjid dengan kajian rutin dan pendidikan Islam anak di sekitar proyek,
// dari research/context/islamic.json. Jadwal dan biaya dikutip dari sumber
// bertanggal dan dapat berubah.
export type FacilityKind =
  | "masjid"
  | "musholla"
  | "tpq-tpa"
  | "ra-tk-islam"
  | "mi-sd-islam"
  | "smp-mts-islam"
  | "madrasah-diniyah"
  | "rumah-tahfidz"
  | "pesantren"
  | "other";

export interface IslamicFee {
  label: string;
  amount: number | null;
  currency: "IDR";
  period: "one-time" | "monthly" | "yearly" | "per-semester" | "unknown";
  academicYear: string | null;
  quote: string;
  url: string;
  pageDate: string | null;
}

// Tautan media sosial resmi dicatat dari situs resmi atau hasil pencarian;
// isinya tidak pernah dibuka otomatis.
export interface SocialLink {
  platform: "instagram" | "facebook" | "tiktok" | "youtube" | "x" | "threads";
  url: string;
  owner: "project" | "developer" | "facility";
  via: "official-site" | "search-result" | "osm-tag" | "user-lead";
  seenAt: string | null;
}

export const SOCIAL_LABELS: Record<SocialLink["platform"], string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  threads: "Threads",
};

export interface IslamicPlace {
  id: string;
  name: string;
  kind: FacilityKind;
  km: number;
  evidence: "strong" | "partial";
  lat: number;
  lng: number;
  social?: SocialLink[];
  kajian?: {
    schedule: string;
    frequency: string;
    audience: string | null;
    url: string;
    pageDate: string | null;
  }[];
  education?: {
    levels: string[];
    program: string | null;
    fees: IslamicFee[];
    url: string;
  };
}

export interface IslamicNearby {
  kajian: IslamicPlace[];
  education: IslamicPlace[];
  claims: {
    kind: string;
    quote: string;
    url: string;
    pageDate: string | null;
  }[];
}

export interface IslamicMeta {
  checkedAt: string;
  radiusKm: number;
  method: string;
  caveats: string[];
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
  social?: SocialLink[];
  coordinate: {
    method: string;
    url: string;
    precision: string;
    note: string | null;
  } | null;
  nearest: ResearchStation[];
  nearestPlanned?: ResearchStation[];
  // "islamic": dicantumkan karena fasilitas atau konsep islami walau jauh dari stasiun.
  listingBasis?: "transit" | "islamic";
  nearestAny?: ResearchStation | null;
  population?: ResearchPopulation | null;
  islamic?: IslamicNearby | null;
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
  excluded: {
    id: string;
    name: string;
    reason: string;
    price?: { min: number; max: number | null; url: string };
    kind?: "Rumah" | "Apartemen" | null;
    locationText?: string | null;
    social?: SocialLink[];
    claims?: IslamicNearby["claims"];
  }[];
  population: PopulationContext | null;
  planned: PlannedContext | null;
  islamic: IslamicMeta | null;
}

export const STATUS_LABELS: Record<ResearchStatus, string> = {
  dipasarkan: "Dipasarkan",
  "pre-launch": "Pra-peluncuran",
  inden: "Inden",
  "siap-huni": "Siap huni",
  "tidak-jelas": "Status belum jelas",
};

export const STATION_STATUS_LABELS: Record<StationStatus, string> = {
  operating: "Beroperasi",
  "partially-operating": "Beroperasi sebagian",
  "under-construction": "Dalam pembangunan",
  "tendering-or-preparation": "Persiapan atau lelang",
  "approved-plan": "Rencana resmi",
  "proposed-study": "Usulan atau kajian",
  "stalled-or-cancelled": "Tertunda atau batal",
  unclear: "Status belum jelas",
};

export const FACILITY_LABELS: Record<FacilityKind, string> = {
  masjid: "Masjid",
  musholla: "Musholla",
  "tpq-tpa": "TPQ/TPA",
  "ra-tk-islam": "RA/TK Islam",
  "mi-sd-islam": "MI/SD Islam",
  "smp-mts-islam": "MTs/SMP Islam",
  "madrasah-diniyah": "Madrasah diniyah",
  "rumah-tahfidz": "Rumah tahfidz",
  pesantren: "Pesantren",
  other: "Pendidikan Islam",
};

const FEE_PERIODS: Record<IslamicFee["period"], string> = {
  "one-time": " sekali bayar",
  monthly: "/bulan",
  yearly: "/tahun",
  "per-semester": "/semester",
  unknown: "",
};

// Biaya pendidikan ditulis lengkap; money() membulatkan ke jutaan.
export function feeText(fee: IslamicFee): string {
  const amount =
    fee.amount === null
      ? "lihat sumber"
      : `Rp ${fee.amount.toLocaleString("id-ID")}${FEE_PERIODS[fee.period]}`;
  return `${fee.label} ${amount}${fee.academicYear ? ` (${fee.academicYear})` : ""}`;
}

export function plusSummary(property: ResearchProperty): string {
  const islamic = property.islamic;
  if (!islamic) return "";
  return [
    islamic.kajian.length
      ? `${islamic.kajian.length} masjid dengan pengajian rutin`
      : "",
    islamic.education.length
      ? `${islamic.education.length} pendidikan Islam anak`
      : "",
    islamic.claims.some((claim) => claim.kind === "syariah-concept")
      ? "konsep islami (klaim pemasaran)"
      : islamic.claims.length
        ? "klaim fasilitas dari sumber proyek"
        : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

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
    planned: metadata.planned ?? null,
    islamic: metadata.islamic ?? null,
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

// Stasiun aplikasi yang ditandai belum beroperasi diperlakukan sebagai rencana.
export function isOperating(station: ResearchStation): boolean {
  return (
    !station.planned &&
    (!station.status ||
      station.status === "operating" ||
      station.status === "partially-operating")
  );
}

export function stationsFor(
  property: ResearchProperty,
  scope: StationScope = "operating",
): ResearchStation[] {
  const all = [
    ...property.nearest,
    ...(property.nearestPlanned ?? []).map((station) => ({
      ...station,
      planned: true,
    })),
  ];
  return all
    .filter((station) =>
      scope === "all"
        ? true
        : scope === "operating"
          ? isOperating(station)
          : !isOperating(station),
    )
    .sort((a, b) => a.km - b.km);
}

export function nearestRail(
  property: ResearchProperty,
  mode?: RailMode,
  scope: StationScope = "operating",
): ResearchStation | undefined {
  return stationsFor(property, scope).find(
    (station) => !mode || station.mode === mode,
  );
}

export function stationLabel(station: ResearchStation): string {
  return isOperating(station)
    ? `${station.mode} ${station.name}`
    : `${station.mode} ${station.name} (rencana: ${STATION_STATUS_LABELS[station.status ?? "unclear"].toLocaleLowerCase("id-ID")})`;
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
  const station =
    nearestRail(property) ?? nearestRail(property, undefined, "planned");
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
        ? `${stationLabel(station)} ${distanceText(station.km)} garis lurus.`
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
