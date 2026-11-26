import {
  createExcelBlob,
  downloadExcel,
  type ExportSheet,
} from "./excel-export.ts";
import { distanceKm, escapeHTML as esc, nearestStation } from "./geo.ts";
import { icon } from "./icons.ts";
import {
  ARTHA_GRAHA_SCBD,
  googleMapsLocation,
  googleMapsToScbd,
  googleMapsWalkToStation,
} from "./maps-links.ts";
import {
  filterMapRentals,
  RENTAL_MAP_GROUPS,
  type RentalMapKind,
  rentalLocationLabel,
  rentalMapKind,
} from "./rental-map.ts";
import {
  checkedDate,
  MAX_RENT_PER_MONTH,
  type ResearchMosque,
  type ResearchRental,
  safeUrl,
} from "./research-data.ts";
import { rentalSaveButton } from "./saved-rentals.ts";
import {
  AREAS,
  type BookmarkLibrary,
  type BookmarkSummary,
  type Station,
} from "./types.ts";
import "./rental-table.css";

const modes = ["KRL", "MRT", "LRT", "TransJakarta"] as const;
export const RENTAL_RAIL_CORRIDOR = "cikarang-mrt";
export const RENTAL_KRL_CORRIDOR = "cikarang-sudirman";
export const RENTAL_SCBD_RADIUS = "8km";
type CorridorMode = typeof RENTAL_RAIL_CORRIDOR | typeof RENTAL_KRL_CORRIDOR;

export function isRentalCorridor(mode: string | null): mode is CorridorMode {
  return mode === RENTAL_RAIL_CORRIDOR || mode === RENTAL_KRL_CORRIDOR;
}

const railRadiusKm = 1.2;
const scbdRadiusKm = 8;
const cikarangStops = [
  "Cikarang",
  "Metland Telagamurni",
  "Cibitung",
  "Tambun",
  "Bekasi Timur",
  "Bekasi",
  "Kranji",
  "Cakung",
  "Klender Baru",
  "Buaran",
  "Klender",
  "Jatinegara",
  "Matraman",
  "Manggarai",
  "Sudirman",
];
const allKinds = new Set(RENTAL_MAP_GROUPS.map((group) => group.id));
type Mode = (typeof modes)[number];
type Stop = NonNullable<ReturnType<typeof nearestStation>>;
type Source = { label: string; url: string };
type Value = number | string | Source | undefined | null;
type Row = {
  rental: ResearchRental;
  bookmarked: boolean;
  group: (typeof RENTAL_MAP_GROUPS)[number];
  mosque?: ResearchMosque;
  mosqueKm?: number;
  scbdKm?: number;
  stops: Partial<Record<Mode, Stop>>;
  corridorStop?: Stop;
  krlCorridorStop?: Stop;
};
type Column = {
  id: string;
  label: string;
  width: number;
  mobileWidth?: number;
  link?: true;
  value: (row: Row, stop: Stop | undefined) => Value;
  format?: (value: number) => string;
};
const collator = new Intl.Collator("id-ID", {
  numeric: true,
  sensitivity: "base",
});
const numberFormat = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});
const rupiah = (value: number) =>
  `Rp ${Math.round(value).toLocaleString("id-ID")}`;
const decimal = (value: number) => numberFormat.format(value);
const yesNo = (value?: boolean) =>
  value == null
    ? undefined
    : value
      ? "Ya, menurut sumber"
      : "Tidak, menurut sumber";
const tier = ({ rental }: Row) => {
  const { sizeM2, review } = rental;
  const floors = review?.floors ?? 0;
  if (!sizeM2 && !floors) return undefined;
  return (sizeM2 ?? 0) > 80 || floors >= 3
    ? 3
    : (sizeM2 ?? 0) > 45 || floors === 2
      ? 2
      : 1;
};
const tierBudget = (row: Row) => {
  const t = tier(row);
  return t ? (t + 2) * 1_000_000 : undefined;
};
const mosqueCoverageLabels = {
  "within-radius": "Dalam radius 1,5 km",
  "outside-radius": "Di luar radius",
  "no-pin": "Pin belum ada saat riset",
};
const columns: Column[] = [
  {
    id: "bookmark",
    label: "Bookmark",
    width: 64,
    value: ({ bookmarked }) => Number(bookmarked),
  },
  {
    id: "title",
    label: "Hunian",
    width: 252,
    mobileWidth: 151,
    value: ({ rental }) => rental.title,
  },
  {
    id: "type",
    label: "Jenis",
    width: 121,
    mobileWidth: 93,
    value: ({ group }) => group.label,
  },
  {
    id: "rent",
    label: "Setara / bulan",
    width: 136,
    value: ({ rental }) =>
      rental.rent.amount / (rental.rent.period === "yearly" ? 12 : 1),
    format: rupiah,
  },
  {
    id: "area",
    label: "Kawasan",
    width: 209,
    value: ({ rental }) => rental.locationText,
  },
  {
    id: "station",
    link: true,
    label: "Stasiun / halte",
    width: 184,
    value: ({ rental }, stop) =>
      stop && rental.location
        ? {
            label: `${stop.station.mode} · ${stop.station.name}`,
            url: googleMapsWalkToStation(rental.location, stop.station),
          }
        : undefined,
  },
  {
    id: "distance",
    label: "Jarak angkutan (km)",
    width: 145,
    value: (_, stop) => stop?.distance,
    format: decimal,
  },
  {
    id: "scbdKm",
    label: "Jarak Artha Graha (km)",
    width: 169,
    value: ({ scbdKm }) => scbdKm,
    format: decimal,
  },
  {
    id: "commute",
    link: true,
    label: "Rute transit ke SCBD",
    width: 168,
    value: ({ rental }) =>
      rental.location
        ? { label: "Buka rute", url: googleMapsToScbd(rental.location) }
        : undefined,
  },
  {
    id: "mosque",
    link: true,
    label: "Masjid Ihrish",
    width: 200,
    value: ({ mosque }) =>
      mosque ? { label: mosque.name, url: mosque.sourceUrl } : undefined,
  },
  {
    id: "mosqueKm",
    label: "Jarak masjid (km)",
    width: 138,
    value: ({ mosqueKm }) => mosqueKm,
    format: decimal,
  },
  {
    id: "kitchen",
    label: "Dapur",
    width: 155,
    value: ({ rental }) =>
      rental.kitchen === "private"
        ? "Dalam unit"
        : rental.kitchen === "shared"
          ? "Bersama"
          : undefined,
  },
  {
    id: "couples",
    label: "Pasutri",
    width: 153,
    value: ({ rental }) => yesNo(rental.review?.couples),
  },
  {
    id: "children",
    label: "Anak",
    width: 153,
    value: ({ rental }) => yesNo(rental.review?.children),
  },
  {
    id: "original",
    label: "Harga asli",
    width: 146,
    value: ({ rental }) => rental.rent.amount,
    format: rupiah,
  },
  {
    id: "period",
    label: "Periode sewa",
    width: 114,
    value: ({ rental }) =>
      rental.rent.period === "yearly" ? "Tahunan" : "Bulanan",
  },
  {
    id: "minimum",
    label: "Minimum (bln)",
    width: 126,
    value: ({ rental }) => rental.rent.minimumMonths,
  },
  {
    id: "bedrooms",
    label: "Kamar tidur",
    width: 115,
    value: ({ rental }) => rental.bedrooms,
    format: (v) => (v === 0 ? "Studio" : String(v)),
  },
  {
    id: "size",
    label: "Luas (m²)",
    width: 100,
    value: ({ rental }) => rental.sizeM2,
    format: decimal,
  },
  {
    id: "floors",
    label: "Lantai",
    width: 90,
    value: ({ rental }) => rental.review?.floors,
  },
  { id: "tier", label: "Tier", width: 80, value: tier, format: (v) => `T${v}` },
  {
    id: "tierBudget",
    label: "Plafon tier / bln",
    width: 135,
    value: tierBudget,
    format: rupiah,
  },
  {
    id: "tierStatus",
    label: "Evaluasi harga",
    width: 150,
    value: (row) => {
      const b = tierBudget(row);
      const { rent } = row.rental;
      return b
        ? rent.amount <= b * (rent.period === "yearly" ? 12 : 1)
          ? "Dalam tier"
          : "Di atas plafon tier"
        : undefined;
    },
  },
  {
    id: "sizeCompleteness",
    label: "Ukuran lengkap?",
    width: 131,
    value: ({ rental }) =>
      rental.sizeM2 != null && rental.review?.floors != null
        ? "Ya"
        : "Belum lengkap",
  },
  {
    id: "flood",
    link: true,
    label: "Banjir & genangan",
    width: 232,
    value: ({ rental }) => rental.review?.flood,
  },
  {
    id: "security",
    link: true,
    label: "Kriminalitas & keamanan",
    width: 232,
    value: ({ rental }) => rental.review?.security,
  },
  {
    id: "environment",
    link: true,
    label: "Akses & lingkungan",
    width: 232,
    value: ({ rental }) => rental.review?.environment,
  },
  {
    id: "sudirman",
    label: "Est. Sudirman (mnt)",
    width: 143,
    value: ({ rental }) => rental.review?.commuteMinutes,
  },
  {
    id: "basis",
    label: "Dasar estimasi",
    width: 213,
    value: ({ rental }) => rental.review?.commuteBasis,
  },
  {
    id: "krl",
    label: "Jarak KRL (km)",
    width: 137,
    value: ({ stops }) => stops.KRL?.distance,
    format: decimal,
  },
  {
    id: "mosqueCoverage",
    label: "Cakupan 10 masjid (riset)",
    width: 181,
    value: ({ rental }) =>
      rental.review?.mosqueCoverage
        ? mosqueCoverageLabels[rental.review.mosqueCoverage]
        : undefined,
  },
  {
    id: "careerArea",
    label: "Koridor karier pangan",
    width: 175,
    value: ({ rental }) => rental.review?.careerArea,
  },
  {
    id: "career",
    link: true,
    label: "Bukti lowongan",
    width: 167,
    value: ({ rental }) => rental.review?.career,
  },
  {
    id: "status",
    label: "Status bukti",
    width: 156,
    value: ({ rental }) =>
      rental.verdict === "confirmed"
        ? "Terverifikasi"
        : "Sebagian terverifikasi",
  },
  {
    id: "checked",
    label: "Tanggal cek",
    width: 120,
    value: ({ rental }) => rental.lastChecked,
  },
  {
    id: "location",
    link: true,
    label: "Titik hunian",
    width: 169,
    value: ({ rental }) =>
      rental.location
        ? {
            label: rentalLocationLabel(rental),
            url: googleMapsLocation(rental.location),
          }
        : "Pin belum diketahui",
  },
  {
    id: "mosqueMap",
    link: true,
    label: "Peta masjid",
    width: 128,
    value: ({ mosque }) =>
      mosque
        ? { label: "Google Maps", url: googleMapsLocation(mosque) }
        : undefined,
  },
  {
    id: "notes",
    label: "Catatan / risiko",
    width: 255,
    value: ({ rental }) => rental.note ?? rental.locationNote,
  },
  {
    id: "source",
    link: true,
    label: "Iklan",
    width: 122,
    value: ({ rental }) => ({
      label: rental.sourcePortal,
      url: rental.listingUrl,
    }),
  },
  { id: "id", label: "ID", width: 220, value: ({ rental }) => rental.id },
];

const defaultPageSize = 40;
const pageSizes = [defaultPageSize, 100, 250, 500, 750, 1000, 2000];
const pageSizeKey = "rumah-tinggal:baris-tabel-sewa";
const heightKey = "rumah-tinggal:tinggi-tabel-sewa";
const stickyKey = "rumah-tinggal:kolom-beku-sewa";
const widthKey = (id: string) => `rumah-tinggal:lebar-sewa:${id}`;
const minColumnWidth = 64;
const maxColumnWidth = 960;
function preference(key: string, fallback: number): number {
  try {
    const value = localStorage.getItem(key);
    return value !== null && Number.isFinite(Number(value))
      ? Number(value)
      : fallback;
  } catch {
    return fallback;
  }
}
function savePreference(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Pengaturan tetap berlaku untuk sesi ini.
  }
}

function sortValue(value: Value): number | string | null {
  return typeof value === "object" ? (value?.label ?? null) : (value ?? null);
}

function cellHTML(value: Value, column: Column): string {
  if (value == null)
    return '<span class="rent-table-missing" aria-label="Belum diketahui">—</span>';
  if (typeof value === "object")
    return `<a href="${esc(safeUrl(value.url))}" title="${esc(value.label)}" target="_blank" rel="noopener noreferrer">${esc(value.label)} ↗</a>`;
  const display =
    typeof value === "number"
      ? (column.format?.(value) ?? String(value))
      : column.id === "checked"
        ? checkedDate(value)
        : value;
  return `<span title="${esc(display)}">${esc(display)}</span>`;
}

function element<T extends Element>(root: ParentNode, selector: string): T {
  const item = root.querySelector<T>(selector);
  if (!item) throw new Error(`Elemen tabel sewa hilang: ${selector}`);
  return item;
}

export class RentalTable {
  open = false;
  private panel: HTMLElement;
  private workspace: HTMLElement;
  private grab: HTMLElement;
  private scroller: HTMLElement;
  private controls: HTMLFormElement;
  private head: HTMLTableSectionElement;
  private body: HTMLTableSectionElement;
  private grid: HTMLTableElement;
  private corridorStations = new Map<string, Station>();
  private rows = new Map<string, Row>();
  private bookmarkGroups = new Map<string, Set<string>>();
  private allBookmarked = new Set<string>();
  private matches: ResearchRental[] = [];
  private selected: string[] = [];
  private ratio = preference(heightKey, 0.43);
  private frozen = Math.min(
    4,
    Math.max(0, Math.floor(preference(stickyKey, 2))),
  );
  private drag?: { y: number; height: number };
  private columnDrag?: {
    id: string;
    x: number;
    width: number;
    pointer: number;
  };
  private widths = new Map(
    columns.map(({ id }) => [id, preference(widthKey(id), 0)]),
  );
  private page = 0;
  private pageSize = defaultPageSize;
  private sort = { id: "rent", ascending: true };
  private onChange: () => void;
  private onSelect: (rental: ResearchRental) => void;

  constructor(
    panel: HTMLElement,
    workspace: HTMLElement,
    callbacks: {
      change: () => void;
      select: (rental: ResearchRental) => void;
      close: () => void;
      reset: () => void;
      resize: () => void;
      message: (message: string) => void;
    },
  ) {
    this.panel = panel;
    this.workspace = workspace;
    this.onChange = callbacks.change;
    this.onSelect = callbacks.select;
    panel.innerHTML = `<div class="rent-table-grab" tabindex="0" role="separator" aria-orientation="horizontal" aria-controls="rent-table-scroll" aria-label="Tinggi tabel sewa"><span></span></div>
      <form class="rent-table-controls">
        <div class="rent-table-title">
          <h2 id="rent-table-title" title="Plafon Rp5 juta per bulan ekuivalen. Periode bayar asli ada di tabel.">Tabel sewa</h2>
          <select name="bookmark" class="rent-table-action rent-bookmark-choice" aria-label="Prioritaskan koleksi bookmark" title="Pilih koleksi agar hunian tersimpan muncul di atas"><option value="">Semua koleksi</option></select>
          <button type="button" data-open-saved-rentals class="rent-table-action rent-table-icon" aria-haspopup="dialog" aria-label="Bookmark" title="Bookmark">${icon("bookmark")}</button>
          <button type="button" data-download-excel class="rent-table-action rent-table-icon" aria-label="Unduh Excel tabel sewa" title="Unduh hasil tabel sebagai Excel">${icon("download")}</button>
          <button type="button" data-close-table class="rent-table-action">Ke kartu</button>
        </div>
        <div class="rent-table-filters">
          <label class="rent-table-search">${icon("search")}<input type="search" name="query" aria-label="Cari di tabel sewa" placeholder="Cari hunian, kawasan, masjid…" autocomplete="off"/></label>
          <select name="scbd" aria-label="Radius Artha Graha SCBD" title="Jarak garis lurus dari pin hunian ke Gedung Artha Graha"><option value="">Semua jarak SCBD</option><option value="${RENTAL_SCBD_RADIUS}">≤ 8 km Artha Graha</option></select>
          <select name="kind" aria-label="Jenis hunian di tabel"><option value="">Semua jenis</option>${RENTAL_MAP_GROUPS.map((g) => `<option value="${g.id}">${g.label}</option>`).join("")}</select>
          <select name="area" aria-label="Wilayah di tabel"><option value="">Semua wilayah</option>${AREAS.map((a) => `<option>${a}</option>`).join("")}</select>
          <select name="mode" aria-label="Angkutan dekat hunian"><option value="">Semua angkutan</option><option value="${RENTAL_KRL_CORRIDOR}">KRL Cikarang–Sudirman</option><option value="${RENTAL_RAIL_CORRIDOR}">Cikarang–Sudirman + MRT</option>${modes.map((m) => `<option>${m}</option>`).join("")}</select>
          <select name="station" aria-label="Stasiun di koridor" hidden><option value="">Semua stasiun koridor</option></select>
          <label class="rent-table-kitchen"><input type="checkbox" name="kitchen"/> Dapur dalam unit</label>
          <select name="freeze" aria-label="Bekukan kolom kiri">${Array.from({ length: 5 }, (_, i) => `<option value="${i}">${i ? `Bekukan ${i} kolom` : "Tanpa kolom beku"}</option>`).join("")}</select>
          <button class="rent-table-action" data-reset type="button">Reset filter</button>
        </div>
      </form>
      <details class="rent-table-corridor" hidden><summary>Panduan rute · radius 1,2 km</summary><p>Jarak dihitung garis lurus. Kos menampilkan iklan yang mengizinkan pasutri. Ke SCBD, turun di MRT Istora atau Senayan. Dari KRL, pilih kereta via Manggarai yang berhenti di Sudirman, lalu pindah ke MRT Dukuh Atas.</p></details>
      <div class="rent-table-scroll" id="rent-table-scroll" role="region" aria-label="Data sewa, gulir mendatar untuk melihat semua kolom" tabindex="0">
        <table class="rent-table-grid" aria-label="Cari hunian sewa"><colgroup>${columns.map((c) => `<col data-column="${c.id}"/>`).join("")}</colgroup><thead></thead><tbody></tbody></table>
      </div>
      <div class="rent-table-foot"><span data-table-count role="status"></span><div class="rent-table-pages"><select class="rent-table-action" aria-label="Baris per halaman" data-page-size>${pageSizes.map((size) => `<option value="${size}">${decimal(size)} baris</option>`).join("")}</select><button class="rent-table-action" type="button" data-page="-1" aria-label="Halaman sebelumnya">‹</button><button class="rent-table-action" type="button" data-page="1" aria-label="Halaman berikutnya">›</button></div></div>`;
    this.grab = element<HTMLElement>(panel, ".rent-table-grab");
    this.scroller = element<HTMLElement>(panel, ".rent-table-scroll");
    this.controls = element<HTMLFormElement>(panel, "form");
    this.head = element<HTMLTableSectionElement>(panel, "thead");
    this.body = element<HTMLTableSectionElement>(panel, "tbody");
    this.grid = element<HTMLTableElement>(panel, "table");
    this.controls.onsubmit = (event) => event.preventDefault();
    this.controls.oninput = (event) => {
      const name = (event.target as HTMLElement).getAttribute("name");
      if (name === "bookmark") {
        if (this.sort.id === "bookmark") this.sort.ascending = false;
        this.page = 0;
        this.scroller.scrollTop = 0;
        this.paint();
        return;
      }
      if (name === "mode") this.syncCorridor();
      if (name === "freeze") {
        this.frozen = Number(this.select("freeze").value);
        savePreference(stickyKey, this.frozen);
        this.layoutColumns();
      } else {
        this.page = 0;
        this.scroller.scrollTop = 0;
        this.onChange();
      }
    };
    element<HTMLButtonElement>(panel, "[data-reset]").onclick = () => {
      this.controls.reset();
      this.syncCorridor();
      this.select("freeze").value = String(
        Math.min(this.frozen, this.freezeLimit()),
      );
      this.page = 0;
      this.scroller.scrollTop = 0;
      this.sort = { id: "rent", ascending: true };
      callbacks.reset();
    };
    element<HTMLButtonElement>(panel, "[data-close-table]").onclick =
      callbacks.close;
    const download = element<HTMLButtonElement>(panel, "[data-download-excel]");
    download.onclick = async () => {
      download.disabled = true;
      try {
        const sheet = this.exportSheet();
        if (!sheet.rows.length)
          callbacks.message("Belum ada hunian untuk diekspor.");
        else downloadExcel(await createExcelBlob([sheet]), "tabel-sewa");
      } catch {
        callbacks.message("Ekspor tabel sewa belum berhasil. Coba lagi.");
      } finally {
        download.disabled = false;
      }
    };
    this.head.onclick = (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-sort]",
      );
      const id = button?.dataset.sort;
      if (!id) return;
      this.sort = {
        id,
        ascending:
          this.sort.id === id ? !this.sort.ascending : id !== "bookmark",
      };
      this.page = 0;
      this.scroller.scrollTop = 0;
      this.paint();
      this.head
        .querySelector<HTMLButtonElement>(`[data-sort="${this.sort.id}"]`)
        ?.focus({ preventScroll: true });
    };
    this.body.onclick = (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("a, [data-save-rental]")) return;
      const row = target.closest<HTMLTableRowElement>("tr[data-rental]");
      const rental = this.rows.get(row?.dataset.rental ?? "")?.rental;
      if (rental) this.onSelect(rental);
    };
    this.head.onpointerdown = (event) => {
      const handle = (event.target as Element).closest<HTMLElement>(
        "[data-resize-column]",
      );
      const id = handle?.dataset.resizeColumn;
      if (!handle || !id || event.button !== 0 || this.columnDrag) return;
      event.preventDefault();
      handle.focus({ preventScroll: true });
      this.columnDrag = {
        id,
        x: event.clientX,
        width: Number(handle.getAttribute("aria-valuenow")),
        pointer: event.pointerId,
      };
      handle.setPointerCapture(event.pointerId);
      this.grid.classList.add("is-resizing");
    };
    this.head.onpointermove = (event) => {
      const drag = this.columnDrag;
      if (drag?.pointer === event.pointerId)
        this.setColumnWidth(drag.id, drag.width + event.clientX - drag.x);
    };
    this.head.onlostpointercapture = (event) => {
      const drag = this.columnDrag;
      if (drag?.pointer !== event.pointerId) return;
      savePreference(widthKey(drag.id), this.widths.get(drag.id) ?? 0);
      this.columnDrag = undefined;
      this.grid.classList.remove("is-resizing");
    };
    this.head.onkeydown = (event) => {
      const handle = (event.target as Element).closest<HTMLElement>(
        "[data-resize-column]",
      );
      const id = handle?.dataset.resizeColumn;
      if (!handle || !id) return;
      const width = Number(handle.getAttribute("aria-valuenow"));
      const size = {
        ArrowLeft: width - 16,
        ArrowRight: width + 16,
        Home: minColumnWidth,
        End: maxColumnWidth,
      }[event.key];
      if (size === undefined) return;
      event.preventDefault();
      this.setColumnWidth(id, size);
      savePreference(widthKey(id), this.widths.get(id) ?? 0);
    };
    this.head.ondblclick = (event) => {
      const id = (event.target as Element).closest<HTMLElement>(
        "[data-resize-column]",
      )?.dataset.resizeColumn;
      if (!id) return;
      this.widths.delete(id);
      savePreference(widthKey(id), 0);
      this.layoutColumns();
    };
    const pageSize = element<HTMLSelectElement>(panel, "[data-page-size]");
    const savedPageSize = preference(pageSizeKey, defaultPageSize);
    if (pageSizes.includes(savedPageSize)) this.pageSize = savedPageSize;
    pageSize.value = String(this.pageSize);
    pageSize.onchange = () => {
      this.pageSize = Number(pageSize.value);
      savePreference(pageSizeKey, this.pageSize);
      this.page = 0;
      this.paint();
      this.scroller.scrollTop = 0;
    };
    for (const button of panel.querySelectorAll<HTMLButtonElement>(
      "[data-page]",
    ))
      button.onclick = () => {
        this.page += Number(button.dataset.page);
        this.paint();
        this.scroller.scrollTop = 0;
      };
    this.grab.onpointerdown = (event) => {
      if (event.button !== 0) return;
      this.grab.setPointerCapture(event.pointerId);
      this.drag = {
        y: event.clientY,
        height: panel.getBoundingClientRect().height,
      };
    };
    this.grab.onpointermove = (event) => {
      if (this.drag)
        this.setHeight(this.drag.height + this.drag.y - event.clientY);
    };
    this.grab.onlostpointercapture = () => {
      if (this.drag) savePreference(heightKey, this.ratio);
      this.drag = undefined;
    };
    this.grab.onkeydown = (event) => {
      const { min, max } = this.heightLimits();
      const current = panel.getBoundingClientRect().height;
      const height = {
        ArrowUp: current + 24,
        ArrowDown: current - 24,
        Home: min,
        End: max,
      }[event.key];
      if (height === undefined) return;
      event.preventDefault();
      this.setHeight(height);
      savePreference(heightKey, this.ratio);
    };
    const mapPanel = element<HTMLElement>(workspace, ".map-panel");
    new ResizeObserver(callbacks.resize).observe(mapPanel);
    new ResizeObserver(() => {
      if (panel.hidden) return;
      this.applyHeight();
      this.layoutColumns();
    }).observe(workspace);
  }

  private select(name: string): HTMLSelectElement {
    return this.controls.elements.namedItem(name) as HTMLSelectElement;
  }

  private syncCorridor(): void {
    const mode = this.select("mode").value;
    const active = isRentalCorridor(mode);
    const stations = this.select("station");
    const krlOnly = mode === RENTAL_KRL_CORRIDOR;
    const mrt = stations.querySelector<HTMLOptGroupElement>(
      'optgroup[data-mode="MRT"]',
    );
    if (mrt) {
      mrt.disabled = krlOnly;
      mrt.hidden = krlOnly;
    }
    if (
      !active ||
      (krlOnly && this.corridorStations.get(stations.value)?.mode === "MRT")
    ) {
      stations.value = "";
    }
    stations.hidden = !active;
    const guide = element<HTMLDetailsElement>(
      this.panel,
      ".rent-table-corridor",
    );
    guide.hidden = !active;
    if (!active) guide.open = false;
  }

  showRailCorridor(mode: CorridorMode): void {
    this.select("mode").value = mode;
    this.syncCorridor();
  }

  showScbdRadius(): void {
    this.select("scbd").value = RENTAL_SCBD_RADIUS;
  }

  setBookmarkCollections(library?: BookmarkLibrary): void {
    const personal = library?.collections ?? [];
    const pinned = library?.pinned ?? [];
    const choices = this.select("bookmark");
    const previous = choices.value;
    this.allBookmarked.clear();
    this.bookmarkGroups.clear();
    for (const { id, rentalIds } of [...personal, ...pinned]) {
      this.bookmarkGroups.set(id, new Set(rentalIds));
      for (const rentalId of rentalIds) this.allBookmarked.add(rentalId);
    }
    const group = (label: string, entries: BookmarkSummary[]) =>
      entries.length
        ? `<optgroup label="${label}">${entries.map(({ id, name }) => `<option value="${esc(id)}">${esc(name)}</option>`).join("")}</optgroup>`
        : "";
    choices.innerHTML =
      '<option value="">Semua koleksi</option>' +
      group("Koleksi saya", personal) +
      group("Disematkan dari tautan", pinned);
    choices.value = this.bookmarkGroups.has(previous) ? previous : "";
    this.paint();
  }

  private freezeLimit(): number {
    const width = this.workspace.clientWidth;
    return width <= 760 ? 2 : width < 900 ? 3 : 4;
  }

  private heightLimits(): { min: number; max: number; total: number } {
    const total = Math.max(1, this.workspace.clientHeight);
    const mobile = this.workspace.clientWidth <= 760;
    const min = Math.min(mobile ? 172 : 162, Math.round(total * 0.48));
    const max = Math.max(
      min,
      Math.min(Math.round(total * 0.72), total - (mobile ? 160 : 200)),
    );
    return { min, max, total };
  }

  private setHeight(height: number): void {
    const { min, max, total } = this.heightLimits();
    this.ratio = Math.max(min, Math.min(max, height)) / total;
    this.applyHeight();
  }

  private applyHeight(): void {
    const { min, max, total } = this.heightLimits();
    const h = Math.max(min, Math.min(max, Math.round(total * this.ratio)));
    this.workspace.style.setProperty("--rent-table-height", `${h}px`);
    this.grab.setAttribute("aria-valuemin", String(min));
    this.grab.setAttribute("aria-valuemax", String(max));
    this.grab.setAttribute("aria-valuenow", String(h));
  }

  private width(column: Column): number {
    const saved = this.widths.get(column.id);
    return saved && saved > 0
      ? Math.min(maxColumnWidth, Math.max(minColumnWidth, saved))
      : this.workspace.clientWidth <= 760
        ? (column.mobileWidth ?? column.width)
        : column.width;
  }

  private setColumnWidth(id: string, size: number): void {
    this.widths.set(
      id,
      Math.round(Math.min(maxColumnWidth, Math.max(minColumnWidth, size))),
    );
    this.layoutColumns();
  }

  private layoutColumns(): void {
    const maxFrozen = this.freezeLimit();
    const available = this.scroller.clientWidth - 72;
    let limit = 0;
    let offset = 0;
    for (const [index, column] of columns.entries()) {
      const width = this.width(column);
      const col = element<HTMLTableColElement>(
        this.grid,
        `[data-column="${column.id}"]`,
      );
      col.style.width = `${width}px`;
      this.head
        .querySelector(`[data-resize-column="${column.id}"]`)
        ?.setAttribute("aria-valuenow", String(width));
      this.grid.style.setProperty(`--rent-left-${index}`, `${offset}px`);
      offset += width;
      if (index < maxFrozen && offset <= available) limit++;
    }
    const freeze = Math.min(this.frozen, limit);
    const input = this.select("freeze");
    for (const option of input.options)
      option.disabled = Number(option.value) > limit;
    input.value = String(freeze);
    this.grid.style.width = `${offset}px`;
    this.grid.dataset.frozen = String(freeze);
  }

  setData(
    rentals: ResearchRental[],
    stations: Station[],
    mosques: ResearchMosque[],
  ): void {
    const idToMosque = new Map(mosques.map((m) => [m.id, m]));
    const byMode = modes.map(
      (mode) => [mode, stations.filter((s) => s.mode === mode)] as const,
    );
    const krl = stations
      .filter(
        (s) =>
          s.mode === "KRL" &&
          s.lines.includes("cikarang") &&
          cikarangStops.includes(s.name),
      )
      .sort(
        (a, b) => cikarangStops.indexOf(a.name) - cikarangStops.indexOf(b.name),
      );
    const mrt = stations
      .filter((s) => s.mode === "MRT" && s.lines.includes("mrt-north-south"))
      .sort((a, b) => a.lat - b.lat);
    const corridor = [...krl, ...mrt];
    this.corridorStations = new Map(corridor.map((s) => [s.id, s]));
    const groups = [
      ["KRL", "KRL Cikarang–Sudirman", krl],
      ["MRT", "MRT Lebak Bulus–Bundaran HI", mrt],
    ] as const;
    this.select("station").innerHTML =
      `<option value="">Semua stasiun koridor</option>${groups
        .map(
          ([mode, label, stops]) =>
            `<optgroup data-mode="${mode}" label="${label}">${stops.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</optgroup>`,
        )
        .join("")}`;
    this.syncCorridor();
    this.rows.clear();
    for (const rental of rentals) {
      const near = rental.nearbyMosques?.[0];
      const row: Row = {
        rental,
        bookmarked: false,
        stops: {},
        mosque: near && idToMosque.get(near.id),
        mosqueKm: near?.km,
        group:
          RENTAL_MAP_GROUPS.find((g) => g.id === rentalMapKind(rental)) ??
          RENTAL_MAP_GROUPS[3],
      };
      if (rental.location) {
        row.scbdKm = distanceKm(rental.location, ARTHA_GRAHA_SCBD);
        for (const [mode, items] of byMode)
          row.stops[mode] = nearestStation(rental.location, items);
        row.corridorStop = nearestStation(rental.location, corridor);
        row.krlCorridorStop = nearestStation(rental.location, krl);
      }
      this.rows.set(rental.id, row);
    }
  }

  private stop(row: Row): Stop | undefined {
    const mode = this.select("mode").value;
    if (isRentalCorridor(mode)) {
      const station = this.corridorStations.get(this.select("station").value);
      return station && row.rental.location
        ? { station, distance: distanceKm(row.rental.location, station) }
        : mode === RENTAL_KRL_CORRIDOR
          ? row.krlCorridorStop
          : row.corridorStop;
    }
    if (mode) return row.stops[mode as Mode];
    return Object.values(row.stops).reduce<Stop | undefined>(
      (closest, stop) =>
        !closest || (stop && stop.distance < closest.distance) ? stop : closest,
      undefined,
    );
  }

  filtered(mosque: string): ResearchRental[] {
    const kind = this.select("kind").value as RentalMapKind | "";
    const group = kind ? new Set([kind]) : allKinds;
    const mode = this.select("mode").value;
    const corridor = isRentalCorridor(mode);
    const scbd = this.select("scbd").value === RENTAL_SCBD_RADIUS;
    const tokens = (
      this.controls.elements.namedItem("query") as HTMLInputElement
    ).value
      .toLocaleLowerCase("id-ID")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return filterMapRentals(
      [...this.rows.values()].map((row) => row.rental),
      {
        kinds: group,
        area: this.select("area").value || "Semua",
        query: "",
        privateKitchen: (
          this.controls.elements.namedItem("kitchen") as HTMLInputElement
        ).checked,
        maxMonthlyRent: MAX_RENT_PER_MONTH,
        sort: "recommended",
        mosque,
      },
    ).filter((rental) => {
      const row = this.rows.get(rental.id);
      if (!row) return false;
      if (
        (scbd || corridor) &&
        (rental.review?.couples === false ||
          (row.group.id === "kos" && !rental.review?.couples))
      )
        return false;
      const stop = this.stop(row);
      const nearScbd = row.scbdKm !== undefined && row.scbdKm <= scbdRadiusKm;
      const nearTransit =
        !mode ||
        (stop &&
          stop.distance <= (mode === "TransJakarta" ? 0.7 : railRadiusKm));
      const matchesLocation =
        scbd && corridor
          ? nearScbd || nearTransit
          : (!scbd || nearScbd) && nearTransit;
      if (!matchesLocation) return false;
      if (!tokens.length) return true;
      const text = columns
        .filter((c) => c.id !== "bookmark")
        .map((c) => sortValue(c.value(row, stop)))
        .join(" ")
        .toLocaleLowerCase("id-ID");
      return tokens.every((word) => text.includes(word));
    });
  }

  show(visible: boolean): void {
    this.panel.hidden = !visible;
    this.workspace.classList.toggle("with-rental-table", visible);
    if (visible) {
      this.applyHeight();
      this.layoutColumns();
    }
  }

  highlight(ids: string[]): void {
    this.selected = ids;
    for (const element of this.body.querySelectorAll<HTMLTableRowElement>(
      "tr[data-rental]",
    )) {
      const selected = this.selected.includes(element.dataset.rental ?? "");
      element.classList.toggle("is-selected", selected);
      element
        .querySelector(".rent-table-name")
        ?.setAttribute("aria-pressed", String(selected));
    }
  }

  update(rentals: ResearchRental[], selected: string[]): void {
    this.matches = rentals;
    this.selected = selected;
    this.paint();
  }

  private sortedRows(): Row[] {
    const column = columns.find((c) => c.id === this.sort.id) ?? columns[0];
    const collection = this.bookmarkGroups.get(this.select("bookmark").value);
    const saved = collection ?? this.allBookmarked;
    const rows = this.matches
      .map((rental) => this.rows.get(rental.id))
      .filter((row): row is Row => Boolean(row));
    for (const row of rows) row.bookmarked = saved.has(row.rental.id);
    return rows.sort((a, b) => {
      if (
        collection &&
        column.id !== "bookmark" &&
        a.bookmarked !== b.bookmarked
      )
        return Number(b.bookmarked) - Number(a.bookmarked);
      const x = sortValue(column.value(a, this.stop(a)));
      const y = sortValue(column.value(b, this.stop(b)));
      if (x == null || y == null)
        return (x == null ? 1 : 0) - (y == null ? 1 : 0);
      const order =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : collator.compare(String(x), String(y));
      return (
        (this.sort.ascending ? order : -order) ||
        collator.compare(a.rental.title, b.rental.title)
      );
    });
  }

  private exportSheet(): ExportSheet {
    return {
      name: "Tabel Sewa",
      headers: columns.flatMap((column) =>
        column.link ? [column.label, `Tautan ${column.label}`] : [column.label],
      ),
      rows: this.sortedRows().map((row) => {
        const stop = this.stop(row);
        return columns.flatMap((column) => {
          if (column.id === "bookmark")
            return [row.bookmarked ? "Tersimpan" : "Belum tersimpan"];
          const value = column.value(row, stop);
          const label = sortValue(value);
          if (!column.link) return [label];
          const link =
            value && typeof value === "object" ? safeUrl(value.url) : "#";
          return [label, link === "#" ? null : link];
        });
      }),
    };
  }

  private paint(): void {
    const sorted = this.sortedRows();
    const bookmarkCollection = this.select("bookmark").value;
    this.page = Math.max(
      0,
      Math.min(this.page, Math.ceil(sorted.length / this.pageSize) - 1),
    );
    const start = this.page * this.pageSize;
    const slice = sorted.slice(start, start + this.pageSize);
    this.head.innerHTML = `<tr>${columns
      .map((c, i) => {
        const active = c.id === this.sort.id;
        return `<th scope="col" data-col="${i}"${active ? ` aria-sort="${this.sort.ascending ? "ascending" : "descending"}"` : ""}><button type="button" data-sort="${c.id}"${c.id === "bookmark" ? ' aria-label="Urutkan bookmark" title="Urutkan bookmark"' : ""}>${c.id === "bookmark" ? icon("bookmark") : esc(c.label)}<span aria-hidden="true">${active ? (this.sort.ascending ? "↑" : "↓") : "↕"}</span></button><span class="rent-column-resize" data-resize-column="${c.id}" role="separator" aria-orientation="vertical" aria-label="Ubah lebar kolom ${esc(c.label)}" aria-valuemin="${minColumnWidth}" aria-valuemax="${maxColumnWidth}" aria-valuenow="${this.width(c)}" tabindex="0" title="Geser batas kolom atau gunakan tombol panah"></span></th>`;
      })
      .join("")}</tr>`;
    this.body.innerHTML = slice.length
      ? slice
          .map((row) => {
            const stop = this.stop(row);
            const { rental, group } = row;
            const selected = this.selected.includes(rental.id);
            return `<tr data-rental="${esc(rental.id)}" data-kind="${group.id}" class="${selected ? "is-selected" : ""}" style="--rent-type:${group.color}">${columns.map((c, i) => `<td data-col="${i}">${c.id === "bookmark" ? rentalSaveButton(rental.id, row.bookmarked, true, bookmarkCollection) : c.id === "title" ? `<button class="rent-table-name" type="button" aria-pressed="${selected}" title="${esc(rental.title)}">${esc(rental.title)}</button>` : c.id === "type" ? `<span class="rent-table-type">${group.label}</span>` : cellHTML(c.value(row, stop), c)}</td>`).join("")}</tr>`;
          })
          .join("")
      : `<tr><td class="rent-table-empty" colspan="${columns.length}">Belum ada hunian yang cocok. Ubah pencarian atau reset filter.</td></tr>`;
    element<HTMLElement>(this.panel, "[data-table-count]").textContent =
      slice.length
        ? `${decimal(start + 1)}–${decimal(start + slice.length)} dari ${decimal(sorted.length)} penawaran`
        : "0 penawaran";
    element<HTMLButtonElement>(this.panel, '[data-page="-1"]').disabled =
      !this.page;
    element<HTMLButtonElement>(this.panel, '[data-page="1"]').disabled =
      start + this.pageSize >= sorted.length;
  }
}
