import type { Cell, Sheet } from "write-excel-file/universal";
import { nearestStation } from "./geo.ts";
import { googleMapsLocation } from "./maps-links.ts";
import {
  monthlyRent,
  nearestRail,
  RENTAL_LABELS,
  type ResearchData,
  type ResearchLead,
  type ResearchMosque,
  type ResearchProperty,
  type ResearchRental,
  type ResearchSaleAd,
  STATION_STATUS_LABELS,
  STATUS_LABELS,
  safeUrl,
} from "./research-data.ts";
import type { Listing, Station } from "./types.ts";

type Value = string | number | null | undefined;

export interface ExportSheet {
  name: string;
  headers: string[];
  rows: Value[][];
}

export interface ResearchSelection {
  properties: ResearchProperty[];
  rentals: ResearchRental[];
  saleAds: ResearchSaleAd[];
  mosques: ResearchMosque[];
  leads: ResearchLead[];
}

const verdict = (value: "confirmed" | "partial") =>
  value === "confirmed" ? "Terverifikasi" : "Sebagian terverifikasi";
const url = (value: string | null | undefined) => {
  const result = safeUrl(value);
  return result === "#" ? "" : result;
};
const evidence = (items: { quote: string; url: string }[]) =>
  items.map((item) => `${item.quote}\n${url(item.url)}`).join("\n\n");

export function propertySheet(properties: ResearchProperty[]): ExportSheet {
  return {
    name: "Proyek Developer",
    headers: [
      "ID",
      "Nama proyek",
      "Developer",
      "Jenis hunian",
      "Daerah",
      "Lokasi",
      "Harga minimum (Rp)",
      "Harga maksimum (Rp)",
      "Basis harga",
      "Bukti harga",
      "Sumber harga",
      "Tanggal sumber harga",
      "Status proyek",
      "Bukti status",
      "Sumber status",
      "Verifikasi",
      "Tanggal cek",
      "Latitude",
      "Longitude",
      "Ketelitian titik",
      "Sumber titik",
      "Catatan titik",
      "Stasiun beroperasi terdekat",
      "Jarak stasiun beroperasi (km garis lurus)",
      "Stasiun rencana terdekat",
      "Jarak stasiun rencana (km garis lurus)",
      "Status stasiun rencana",
      "Masjid dengan kajian",
      "Pendidikan Islam anak",
      "Klaim proyek",
      "Tipe unit",
      "Situs resmi",
      "Semua sumber",
      "Tautan riset",
    ],
    rows: properties.map((property) => {
      const operating = nearestRail(property);
      const planned = nearestRail(property, undefined, "planned");
      return [
        property.id,
        property.name,
        property.developer,
        property.kind,
        property.area ?? "Luar Jabodetabek",
        property.locationText,
        property.price.min,
        property.price.max,
        property.price.basis,
        property.price.quote,
        url(property.price.url),
        property.price.pageDate,
        STATUS_LABELS[property.status],
        property.statusQuote,
        url(property.statusUrl),
        verdict(property.verdict),
        property.lastChecked,
        property.lat,
        property.lng,
        property.coordinate?.precision,
        url(property.coordinate?.url),
        property.coordinate?.note,
        operating ? `${operating.mode} ${operating.name}` : null,
        operating?.km,
        planned ? `${planned.mode} ${planned.name}` : null,
        planned?.km,
        planned?.status ? STATION_STATUS_LABELS[planned.status] : null,
        (property.islamic?.kajian ?? [])
          .map(
            (place) =>
              `${place.name} (${place.km} km garis lurus)\n${(place.kajian ?? []).map((item) => `${item.schedule}\n${url(item.url)}`).join("\n")}`,
          )
          .join("\n\n"),
        (property.islamic?.education ?? [])
          .map(
            (place) =>
              `${place.name} (${place.km} km garis lurus)\n${place.education?.levels.join(", ") ?? ""}\n${url(place.education?.url)}`,
          )
          .join("\n\n"),
        evidence(property.islamic?.claims ?? []),
        property.units
          .map(
            (unit) =>
              `${unit.label}; kamar: ${unit.bedrooms ?? "belum diketahui"}; LT: ${unit.landArea ?? "belum diketahui"}; LB: ${unit.buildingArea ?? "belum diketahui"}; harga Rp: ${unit.price ?? "belum diketahui"}`,
          )
          .join("\n"),
        url(property.officialUrl),
        property.sources
          .map(
            (source) =>
              `${source.title}\n${url(source.url)}\n${source.fetched ? "Dibuka saat pengecekan" : "Belum dibuka langsung"}${source.note ? `; ${source.note}` : ""}`,
          )
          .join("\n\n"),
        `/riset#${encodeURIComponent(property.id)}`,
      ];
    }),
  };
}

function rentalSheet(rentals: ResearchRental[]): ExportSheet {
  return {
    name: "Sewa",
    headers: [
      "ID",
      "Nama",
      "Jenis sewa",
      "Daerah",
      "Lokasi kawasan",
      "Bangunan / klaster",
      "Harga sewa (Rp)",
      "Periode",
      "Setara bulanan (Rp, perkiraan)",
      "Kamar tidur",
      "Luas (m²)",
      "Bukti harga",
      "Sumber harga",
      "Tanggal sumber harga",
      "Bukti lingkungan",
      "Klaim stasiun (dari sumber)",
      "Fasilitas kawasan dan batas hubungan",
      "Catatan",
      "Portal",
      "Tautan listing",
      "Tanggal iklan",
      "Verifikasi",
      "Tanggal cek",
    ],
    rows: rentals.map((rental) => [
      rental.id,
      rental.title,
      RENTAL_LABELS[rental.rentalType],
      rental.area,
      rental.locationText,
      rental.buildingOrCluster,
      rental.rent.amount,
      rental.rent.period === "monthly" ? "Per bulan" : "Per tahun",
      monthlyRent(rental),
      rental.bedrooms,
      rental.sizeM2,
      rental.rent.quote,
      url(rental.rent.url),
      rental.rent.pageDate,
      evidence(rental.evidence),
      evidence(rental.nearStationsClaim),
      (rental.areaHighlights ?? [])
        .map(
          (item) =>
            `${item.name}: ${item.description}\n${url(item.url)}\nHubungan: ${item.relation}\n${url(item.relationUrl)}`,
        )
        .join("\n\n"),
      rental.note,
      rental.sourcePortal,
      url(rental.listingUrl),
      rental.postedOrUpdated,
      verdict(rental.verdict),
      rental.lastChecked,
    ]),
  };
}

function saleSheet(ads: ResearchSaleAd[]): ExportSheet {
  return {
    name: "Iklan Dijual",
    headers: [
      "ID",
      "Nama",
      "Jenis",
      "Daerah",
      "Lokasi kawasan",
      "Proyek / klaster",
      "Harga (Rp)",
      "Luas tanah (m²)",
      "Luas bangunan (m²)",
      "Kamar tidur",
      "Bukti harga",
      "Sumber harga",
      "Tanggal sumber harga",
      "Masjid (klaim sumber)",
      "Bukti hubungan masjid",
      "Sumber hubungan masjid",
      "Bukti lingkungan",
      "Catatan",
      "Portal",
      "Tautan listing",
      "Tanggal iklan",
      "Verifikasi",
      "Tanggal cek",
    ],
    rows: ads.map((ad) => [
      ad.id,
      ad.title,
      ad.kind,
      ad.area,
      ad.locationText,
      ad.projectOrCluster,
      ad.price.amount,
      ad.landM2,
      ad.buildingM2,
      ad.bedrooms,
      ad.price.quote,
      url(ad.price.url),
      ad.price.pageDate,
      ad.nearMosque?.name,
      ad.nearMosque?.quote,
      url(ad.nearMosque?.url),
      evidence(ad.evidence),
      ad.note,
      ad.sourcePortal,
      url(ad.listingUrl),
      ad.postedOrUpdated,
      verdict(ad.verdict),
      ad.lastChecked,
    ]),
  };
}

function mosqueSheet(mosques: ResearchMosque[]): ExportSheet {
  return {
    name: "Masjid",
    headers: [
      "ID",
      "Nama masjid",
      "Daerah",
      "Alamat",
      "Latitude",
      "Longitude",
      "Jadwal tercatat",
      "Jadwal profil dibatalkan (bila diperiksa)",
      "Proyek sekitar (km garis lurus)",
      "Iklan dan petunjuk kawasan",
      "Google Maps",
      "Sumber jadwal",
    ],
    rows: mosques.map((mosque) => [
      mosque.id,
      mosque.name,
      mosque.area ?? "Luar Jabodetabek",
      mosque.address,
      mosque.lat,
      mosque.lng,
      mosque.eventCount,
      mosque.profile?.cancelledUpcoming,
      mosque.nearbyProperties
        .map((property) => `${property.name}: ${property.km} km`)
        .join("\n"),
      mosque.relatedListings
        .map(
          (listing) =>
            `${listing.title} (${listing.kind === "lead" ? "Petunjuk belum diverifikasi" : listing.kind === "rental" ? "Sewa" : "Dijual"})\n${listing.relation}\n${listing.note}\n/riset#${encodeURIComponent(listing.id)}`,
        )
        .join("\n\n"),
      url(mosque.googleMapsUrl),
      url(mosque.sourceUrl),
    ]),
  };
}

function leadSheet(leads: ResearchLead[]): ExportSheet {
  return {
    name: "Petunjuk",
    headers: [
      "ID",
      "Nama",
      "Jenis petunjuk",
      "Daerah",
      "Status",
      "Klaim belum diverifikasi",
      "Hasil cek",
      "Proyek terkait",
      "Sumber",
    ],
    rows: leads.map((lead) => [
      lead.id,
      lead.name,
      lead.type,
      lead.area,
      lead.status === "unreached"
        ? "Belum terjangkau otomatis"
        : "Belum diverifikasi",
      lead.claim,
      lead.check,
      lead.related,
      lead.links.map((link) => `${link.label}\n${url(link.url)}`).join("\n\n"),
    ]),
  };
}

export function researchSheets(
  selection: ResearchSelection,
  research: ResearchData,
  filters: [string, string][],
): ExportSheet[] {
  const sheets = [
    propertySheet(selection.properties),
    rentalSheet(selection.rentals),
    saleSheet(selection.saleAds),
    mosqueSheet(selection.mosques),
    leadSheet(selection.leads),
  ].filter((sheet) => sheet.rows.length);
  return [
    ...sheets,
    {
      name: "Catatan",
      headers: ["Keterangan", "Nilai"],
      rows: [
        [
          "Cakupan ekspor",
          "Hasil sesuai filter aktif saat tombol Export Excel ditekan; setiap daftar memakai filter tambahannya sendiri.",
        ],
        ...filters,
        ...sheets.map((sheet): Value[] => [
          `Jumlah ${sheet.name}`,
          sheet.rows.length,
        ]),
        ["Tanggal cek dataset", research.checkedAt],
        [
          "Proyek developer",
          "Harga, status, dan nama developer mengikuti sumber. Konfirmasi harga, stok, dan legalitas ke pengelola.",
        ],
        [
          "Jarak",
          "Semua jarak adalah garis lurus dari titik kawasan/proyek, bukan rute atau akses unit.",
        ],
        ["Koordinat kosong", "Titik belum terverifikasi; bukan koordinat nol."],
        ["Sewa", research.rentals?.note],
        ["Iklan dijual", research.saleAds?.note],
        ["Masjid", research.mosques?.note],
        ["Tanggal cek masjid", research.mosques?.checkedAt],
        [
          "Jumlah jadwal",
          "Snapshot dapat mencakup pembatalan dan tanggal yang sudah lewat. Profil yang belum diperiksa dibiarkan kosong. Ada kajian cukup; tidak harus rutin.",
        ],
        ["Petunjuk", research.leads?.note],
        ["Tautan riset", "Tautan /riset dibuka dari situs Rumah Tinggal."],
      ],
    },
  ];
}

export function listingSheets(
  listings: Listing[],
  stations: Station[],
  filters: [string, string][],
): ExportSheet[] {
  return [
    {
      name: "Listingku",
      headers: [
        "ID",
        "Nama hunian",
        "Daerah",
        "Kecamatan / lingkungan",
        "Jenis hunian",
        "Harga beli (Rp)",
        "Kamar tidur",
        "Luas tanah / unit (m²)",
        "Latitude",
        "Longitude",
        "Stasiun KRL terdekat",
        "Jarak KRL (km garis lurus)",
        "Tautan sumber",
        "Catatan survei",
        "Tanggal disimpan",
        "Google Maps",
      ],
      rows: listings.map((listing) => {
        const nearest = nearestStation(listing, stations);
        return [
          listing.id,
          listing.title,
          listing.area,
          listing.district,
          listing.type,
          listing.price,
          listing.bedrooms,
          listing.landArea,
          listing.lat,
          listing.lng,
          nearest?.station.name,
          nearest ? Math.round(nearest.distance * 1000) / 1000 : null,
          url(listing.sourceUrl),
          listing.notes,
          listing.createdAt,
          googleMapsLocation(listing),
        ];
      }),
    },
    {
      name: "Catatan",
      headers: ["Keterangan", "Nilai"],
      rows: [
        [
          "Koleksi",
          "Listing pribadi akun yang sedang masuk, sesuai filter dan urutan aktif.",
        ],
        ...filters,
        ["Jumlah listing", listings.length],
        [
          "Jarak KRL",
          "Jarak garis lurus ke titik stasiun; bukan rute berjalan atau akses pintu masuk.",
        ],
      ],
    },
  ];
}

export async function createExcelBlob(sheets: ExportSheet[]): Promise<Blob> {
  // Load the writer only on export. Explicit string cells preserve user text,
  // including a leading '=' or '+', without turning it into an Excel formula.
  const { default: writeExcelFile } = await import(
    "write-excel-file/universal"
  );
  const workbook: Sheet<Blob>[] = sheets.map((sheet) => ({
    sheet: sheet.name,
    stickyRowsCount: 1,
    columns: sheet.headers.map((header) => ({
      width:
        /bukti|sumber|catatan|alamat|lokasi|kajian|pendidikan|tautan|klaim|kawasan|nilai/i.test(
          header,
        )
          ? 55
          : 25,
    })),
    data: [
      sheet.headers.map(
        (header): Cell => ({
          value: header,
          type: String,
          fontWeight: "bold",
          backgroundColor: "#174F43",
          textColor: "#FFFFFF",
          wrap: true,
        }),
      ),
      ...sheet.rows.map((row) =>
        row.map(
          (value): Cell =>
            value === null || value === undefined
              ? null
              : typeof value === "number"
                ? {
                    value,
                    type: Number,
                    format: Number.isInteger(value) ? "#,##0" : "0.######",
                  }
                : { value, type: String, wrap: true },
        ),
      ),
    ],
  }));
  return writeExcelFile(workbook).toBlob();
}

export function downloadExcel(blob: Blob, prefix: string): void {
  const date = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${prefix}-${date}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
