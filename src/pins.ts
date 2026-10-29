import type { PinCategory } from "./types.ts";

// Ikon garis 24×24 dan warna penanda untuk setiap kategori pin.
export const PIN_STYLES: Record<
  PinCategory,
  { label: string; color: string; icon: string }
> = {
  masjid: {
    label: "Masjid / musala",
    color: "#15803d",
    icon: '<path d="M3 21h18M5 21v-7a7 7 0 0 1 14 0v7"/><path d="M12 7V3m-1.5 1.5L12 3l1.5 1.5M10 21v-4a2 2 0 0 1 4 0v4"/>',
  },
  ibadah: {
    label: "Tempat ibadah lain",
    color: "#7c3aed",
    icon: '<path d="M12 2v5M9.5 4.5h5M5 21v-9l7-4 7 4v9z"/><path d="M10 21v-4h4v4"/>',
  },
  sekolah: {
    label: "Sekolah",
    color: "#d97706",
    icon: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v6"/>',
  },
  kampus: {
    label: "Kampus",
    color: "#b45309",
    icon: '<path d="M3 21h18M4 10h16M12 3l9 7H3z"/><path d="M6 10v8m4-8v8m4-8v8m4-8v8"/>',
  },
  kesehatan: {
    label: "Rumah sakit / klinik",
    color: "#dc2626",
    icon: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
  },
  belanja: {
    label: "Pasar / belanja",
    color: "#db2777",
    icon: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  },
  taman: {
    label: "Taman / olahraga",
    color: "#4d7c0f",
    icon: '<path d="M12 22v-7"/><path d="M12 15a5 5 0 0 0 5-5 5 5 0 0 0-5-8 5 5 0 0 0-5 8 5 5 0 0 0 5 5z"/>',
  },
  publik: {
    label: "Layanan publik",
    color: "#2563eb",
    icon: '<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>',
  },
  kantor: {
    label: "Kantor / tempat kerja",
    color: "#475569",
    icon: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  },
  lainnya: {
    label: "Lainnya",
    color: "#0f766e",
    icon: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  },
};

export function pinIcon(category: PinCategory, size = 16): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PIN_STYLES[category].icon}</svg>`;
}

// Tebakan kategori dari nama dan jenis tempat OpenStreetMap (Photon).
export function guessCategory(name: string, kind: string): PinCategory {
  const text = `${name} ${kind}`.toLowerCase();
  const rules: [RegExp, PinCategory][] = [
    [/masjid|mosque|mus[h]?al+[ae]|surau|langgar/, "masjid"],
    [/place of worship|gereja|church|pura|vihara|klenteng|temple/, "ibadah"],
    [/universit|college|kampus|institut|politeknik/, "kampus"],
    [
      /school|kindergarten|sekolah|\bsd\b|\bsmp\b|\bsma\b|\bsmk\b|\btk\b/,
      "sekolah",
    ],
    [
      /hospital|clinic|doctors|pharmacy|rumah sakit|\brs\b|puskesmas|klinik|apotek/,
      "kesehatan",
    ],
    [
      /marketplace|mall|supermarket|pasar|convenience|department store/,
      "belanja",
    ],
    [/park|sports|stadium|pitch|taman|playground|gor\b/, "taman"],
    [
      /townhall|police|fire station|post office|library|kelurahan|kecamatan|polsek|polres|samsat/,
      "publik",
    ],
    [/office|kantor|company|coworking/, "kantor"],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? "lainnya";
}
