import { escapeHTML as esc } from "./geo.ts";
import { googleMapsLocation } from "./maps-links.ts";
import { checkedDate } from "./research-data.ts";

export const INCIDENT_LAYERS = {
  banjir: { label: "Banjir", icon: "drop", color: "#1e5f8b" },
  kriminalitas: { label: "Kriminalitas", icon: "shield", color: "#9d4829" },
} as const;

export type IncidentKind = keyof typeof INCIDENT_LAYERS;

export interface Incident {
  id: string;
  kind: IncidentKind;
  title: string;
  date: string;
  place: string;
  lat: number;
  lng: number;
  summary: string;
  precision: string;
  source: { label: string; url: string };
  locationSource: { label: string; url: string };
  followUp?: { label: string; url: string };
}

// Pin menggunakan acuan publik yang disebut sumber. Laporan setingkat RW atau
// kompleks tanpa acuan yang lebih spesifik dicatat di spreadsheet saja.
export const incidents: Incident[] = [
  {
    id: "banjir-sdn-pangkalanjati-2026-01",
    kind: "banjir",
    title: "Genangan di lingkungan SDN Pangkalanjati 2",
    date: "2026-01-11",
    place: "Jl. Al Barkah, Pangkalan Jati Baru, Cinere, Depok",
    lat: -6.323137,
    lng: 106.805232,
    summary:
      "Lurah melaporkan genangan sekitar 30 cm di sejumlah titik RW 01, termasuk lingkungan sekolah. Lokasi ditinjau pada 12 Januari.",
    precision:
      "Pin mengikuti koordinat sekolah di Kemendikdasmen. Ketinggian berlaku pada titik yang dilaporkan.",
    source: {
      label: "Laporan peninjauan lurah",
      url: "https://www.siarandepok.com/baca/20260114/langkah-cepat-tangani-banjir-lurah-pangkalan-jati-baru-aktifkan-drainase-dan-pompa-air.html",
    },
    locationSource: {
      label: "Koordinat sekolah · Kemendikdasmen",
      url: "https://referensi.data.kemendikdasmen.go.id/pendidikan/npsn/20228851",
    },
  },
  {
    id: "banjir-jembatan-kemang-pratama-2025-03",
    kind: "banjir",
    title: "Akses Jembatan Kemang Pratama rusak saat banjir",
    date: "2025-03-04",
    place: "Jembatan di Jl. Kemang Pratama Raya, Kota Bekasi",
    lat: -6.266395,
    lng: 106.985378,
    summary:
      "Akses dekat jembatan ditutup setelah bagian jalan ambles saat banjir. Balai Jalan melaporkan jembatan dibangun ulang dan dibuka untuk lalu lintas pada 19 Agustus 2026.",
    precision:
      "Pin memakai acuan jembatan. Posisi lubang dan muka air di sekitar jembatan tidak dirinci.",
    source: {
      label: "Laporan lapangan 4 Maret",
      url: "https://kumparan.com/kumparannews/jalan-kemang-pratama-bekasi-amblas-karena-banjir-lubang-menganga-24cDAWNQkZ8",
    },
    locationSource: {
      label: "Letak jembatan · OpenStreetMap",
      url: "https://www.openstreetmap.org/way/320758162",
    },
    followUp: {
      label: "Pembukaan kembali · Kementerian PU",
      url: "https://binamarga.pu.go.id/balai-dki-jabar/berita/jembatan-kemang-pratama-kembali-dibuka-pulihkan-akses-warga-bekasi",
    },
  },
  {
    id: "curanmor-veteran-bekasi-2026-06",
    kind: "kriminalitas",
    title: "Laporan curanmor di parkir Circle K Veteran",
    date: "2026-06-05",
    place: "Circle K, Jl. Veteran, Margajaya, Bekasi Selatan",
    lat: -6.237856,
    lng: 106.999876,
    summary:
      "Liputan menyebut satu sepeda motor dicuri di area parkir depan gerai pada siang hari.",
    precision:
      "Pin memakai acuan gerai yang disebut dalam liputan. Petak parkir tidak dirinci.",
    source: {
      label: "Liputan dengan foto lokasi",
      url: "https://rakyatbekasi.com/vespa-rp50-juta-raib-di-parkiran-circle-k-korban-kecewa-kinerja-polrestro-bekasi-kota/",
    },
    locationSource: {
      label: "Letak gerai · OpenStreetMap",
      url: "https://www.openstreetmap.org/way/936287614",
    },
  },
  {
    id: "curanmor-tangcity-2026-03",
    kind: "kriminalitas",
    title: "Laporan curanmor di depan Tangcity Mall",
    date: "2026-03-03",
    place: "Tangcity Mall, Jl. Jenderal Sudirman, Kota Tangerang",
    lat: -6.193937,
    lng: 106.634084,
    summary:
      "Polda Metro Jaya melaporkan pencurian satu sepeda motor di parkiran luar tepi jalan di depan mal pada malam hari.",
    precision:
      "Pin memakai acuan mal. Sumber menempatkan kejadian di parkir luar depan mal tanpa koordinat petaknya.",
    source: {
      label: "Laporan Polda Metro Jaya",
      url: "https://tribratanews.metro.polri.go.id/motor-raib-di-parkiran-tangcity-polisi-lacak-lewat-gps-dan-tangkap-pelaku-di-bogor/",
    },
    locationSource: {
      label: "Letak mal · OpenStreetMap",
      url: "https://www.openstreetmap.org/way/230188982",
    },
  },
];

export function incidentPopup(incident: Incident): HTMLElement {
  const content = document.createElement("article");
  content.className = "mosque-popup incident-detail";
  const links = [
    incident.source,
    incident.locationSource,
    ...(incident.followUp ? [incident.followUp] : []),
    { label: "Titik di Google Maps", url: googleMapsLocation(incident) },
  ];
  const surveyNote =
    incident.kind === "banjir"
      ? "Cek riwayat air di unit, elevasi lantai terhadap jalan, dan jalur keluar."
      : "Cek pengamanan parkir, penerangan dan akses unit.";
  content.innerHTML = `<span class="mosque-kicker">${INCIDENT_LAYERS[incident.kind].label} · ${esc(checkedDate(incident.date))}</span><h2>${esc(incident.title)}</h2><p><strong>${esc(incident.place)}</strong></p><p>${esc(incident.summary)}</p><p class="mosque-note">${esc(incident.precision)} Riwayat satu kejadian. ${surveyNote}</p><div class="mosque-actions">${links.map(({ label, url }) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`).join("")}<a href="/?kejadian=${encodeURIComponent(incident.id)}">Tautan kejadian</a></div>`;
  return content;
}
