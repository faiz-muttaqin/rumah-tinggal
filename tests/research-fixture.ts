// Fictional research dataset for browser tests. Names, prices and links are
// invented (example.invalid); only the station names match the app dataset.
const source = (kind: string, url: string, fetched = true) => ({
  url,
  kind,
  title: `Sumber uji ${kind}`,
  fetched,
  pageDate: fetched ? "2026-10-01" : null,
  supports: fetched ? ["harga", "status"] : [],
  note: null,
});

function project(
  id: string,
  name: string,
  overrides: Record<string, unknown>,
  [lng, lat]: [number, number],
) {
  return {
    type: "Feature",
    id,
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
      id,
      name,
      developer: "Developer Uji",
      subsidized: false,
      region: null,
      status: "dipasarkan",
      statusQuote: null,
      statusUrl: null,
      units: [],
      transitClaim: null,
      officialUrl: `https://developer.example.invalid/${id}`,
      coordinate: {
        method: "uji",
        url: "https://osm.example.invalid/uji",
        precision: "titik uji",
        note: null,
      },
      lastChecked: "2026-10-30",
      corridor: "uji",
      methods: ["uji"],
      ...overrides,
    },
  };
}

export const researchFixture = {
  type: "FeatureCollection",
  metadata: {
    checkedAt: "2026-10-30",
    maxDistanceKm: 3,
    methods: [
      {
        id: "uji-portal",
        name: "Metode uji portal",
        category: "search-discovery",
        summary: "Ringkasan metode uji.",
        steps: ["Langkah uji pertama"],
        limits: ["Batasan uji"],
        recommended: true,
        lastUsed: "2026-10-30",
        sources: [{ url: "https://docs.example.invalid/", title: "Dok uji" }],
      },
    ],
    coverage: [{ id: "uji", label: "Koridor uji", found: 5, included: 3 }],
    gaps: ["Celah cakupan uji."],
    excluded: [
      { id: "prj-uji-jauh", name: "Proyek Uji Jauh", reason: "di luar radius" },
    ],
    population: {
      source: {
        id: "raster-uji",
        name: "Raster penduduk uji",
        publisher: "Penerbit Uji, Universitas Uji",
        url: "https://raster.example.invalid/uji",
        licence: "CC BY 4.0",
        licenceUrl: "https://raster.example.invalid/lisensi",
        year: 2025,
        checkedAt: "2026-10-30",
      },
      method: "Metode uji penjumlahan piksel.",
      caveats: ["Estimasi uji."],
      radiiKm: [0.5, 1],
    },
  },
  features: [
    project(
      "prj-uji-cisauk",
      "Hunian Uji Cisauk",
      {
        kind: "Rumah",
        area: "Tangerang",
        locationText: "Cisauk, Kabupaten Tangerang",
        verdict: "confirmed",
        price: {
          min: 450_000_000,
          max: 620_000_000,
          basis: "harga mulai",
          quote: "Harga uji mulai Rp 450 Juta",
          url: "https://portal.example.invalid/uji-cisauk",
          pageDate: "2026-10-01",
          currency: "IDR",
        },
        units: [
          {
            label: "Tipe uji 36/60",
            bedrooms: 2,
            landArea: 60,
            buildingArea: 36,
            price: 450_000_000,
          },
        ],
        transitClaim: {
          quote: "Klaim uji 5 menit ke stasiun",
          url: "https://portal.example.invalid/uji-cisauk",
        },
        nearest: [
          {
            mode: "KRL",
            name: "Cisauk",
            km: 0.8,
            lat: -6.32444,
            lng: 106.64163,
          },
        ],
        population: { within500m: 4230, within1km: 15870, densityKm2: 5050 },
        sources: [
          source("portal", "https://portal.example.invalid/uji-cisauk"),
          source("instagram", "https://instagram.example.invalid/p/uji", false),
        ],
      },
      [106.645, -6.33],
    ),
    project(
      "prj-uji-lebak-bulus",
      "Apartemen Uji Lebak Bulus",
      {
        kind: "Apartemen",
        area: "Jakarta",
        locationText: "Cilandak, Jakarta Selatan",
        verdict: "partial",
        price: {
          min: 1_200_000_000,
          max: null,
          basis: "harga unit tertentu",
          quote: "Unit uji Rp 1,2 Miliar",
          url: "https://developer.example.invalid/uji-lebak-bulus",
          pageDate: null,
          currency: "IDR",
        },
        nearest: [
          {
            mode: "MRT",
            name: "Lebak Bulus Bank Syariah Indonesia",
            km: 0.6,
            lat: -6.28925,
            lng: 106.77494,
          },
        ],
        sources: [
          source("developer", "https://developer.example.invalid/uji-lebak"),
        ],
      },
      [106.779, -6.292],
    ),
    project(
      "prj-uji-bekasi-timur",
      "Rumah Uji Bekasi Timur",
      {
        kind: "Rumah",
        area: "Bekasi",
        locationText: "Bekasi Timur, Kota Bekasi",
        verdict: "confirmed",
        price: {
          min: 780_000_000,
          max: null,
          basis: "harga mulai",
          quote: "Mulai Rp 780 Juta (uji)",
          url: "https://developer.example.invalid/uji-bekasi",
          pageDate: "2026-09-12",
          currency: "IDR",
        },
        nearest: [
          {
            mode: "KRL",
            name: "Bekasi Timur",
            km: 1.8,
            lat: -6.2468,
            lng: 107.0181,
          },
          {
            mode: "LRT",
            name: "Jatimulya",
            km: 2.5,
            lat: -6.26413,
            lng: 107.02167,
          },
        ],
        sources: [
          source("developer", "https://developer.example.invalid/uji-bekasi"),
        ],
      },
      [107.03, -6.255],
    ),
  ],
};
