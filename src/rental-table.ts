import { distanceKm, escapeHTML as esc, nearestStation } from "./geo.ts";
import { icon } from "./icons.ts";
import {
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
import { AREAS, type Station } from "./types.ts";
import "./rental-table.css";

const modes = ["KRL", "MRT", "LRT", "TransJakarta"] as const;
export const RENTAL_RAIL_CORRIDOR = "cikarang-mrt";
const railRadiusKm = 1.2;
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
  group: (typeof RENTAL_MAP_GROUPS)[number];
  mosque?: ResearchMosque;
  mosqueKm?: number;
  stops: Partial<Record<Mode, Stop>>;
  corridorStop?: Stop;
};
type Column = {
  id: string;
  label: string;
  width: number;
  mobileWidth?: number;
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
    id: "commute",
    label: "Rute transit ke SCBD",
    width: 168,
    value: ({ rental }) =>
      rental.location
        ? { label: "Buka rute", url: googleMapsToScbd(rental.location) }
        : undefined,
  },
  {
    id: "mosque",
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
    label: "Banjir & genangan",
    width: 232,
    value: ({ rental }) => rental.review?.flood,
  },
  {
    id: "security",
    label: "Kriminalitas & keamanan",
    width: 232,
    value: ({ rental }) => rental.review?.security,
  },
  {
    id: "environment",
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
  private matches: ResearchRental[] = [];
  private selected: string[] = [];
  private ratio = preference(heightKey, 0.43);
  private frozen = Math.min(
    4,
    Math.max(0, Math.floor(preference(stickyKey, 1))),
  );
  private drag?: { y: number; height: number };
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
    },
  ) {
    this.panel = panel;
    this.workspace = workspace;
    this.onChange = callbacks.change;
    this.onSelect = callbacks.select;
    panel.innerHTML = `<div class="rent-table-grab" tabindex="0" role="separator" aria-orientation="horizontal" aria-controls="rent-table-scroll" aria-label="Tinggi tabel sewa"><span></span></div>
      <form class="rent-table-controls">
        <div class="rent-table-title"><h2 id="rent-table-title">Tabel sewa</h2><span class="rent-table-cap" title="Tarif tahunan dibagi 12 untuk pembanding. Periode pembayaran asli tercantum di tabel.">Maks. Rp5 juta/bln</span><button type="button" data-close-table class="rent-table-action">Ke kartu</button></div>
        <div class="rent-table-filters">
          <label class="rent-table-search">${icon("search")}<input type="search" name="query" aria-label="Cari di tabel sewa" placeholder="Cari hunian, kawasan, masjid…" autocomplete="off"/></label>
          <select name="kind" aria-label="Jenis hunian di tabel"><option value="">Semua jenis</option>${RENTAL_MAP_GROUPS.map((g) => `<option value="${g.id}">${g.label}</option>`).join("")}</select>
          <select name="area" aria-label="Wilayah di tabel"><option value="">Semua wilayah</option>${AREAS.map((a) => `<option>${a}</option>`).join("")}</select>
          <select name="mode" aria-label="Angkutan dekat hunian"><option value="">Semua angkutan</option><option value="${RENTAL_RAIL_CORRIDOR}">Cikarang–Sudirman + MRT</option>${modes.map((m) => `<option>${m}</option>`).join("")}</select>
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
    this.head.onclick = (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-sort]",
      );
      if (!button?.dataset.sort) return;
      this.sort = {
        id: button.dataset.sort,
        ascending: this.sort.id !== button.dataset.sort || !this.sort.ascending,
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
      if (target.closest("a")) return;
      const row = target.closest<HTMLTableRowElement>("tr[data-rental]");
      const rental = this.rows.get(row?.dataset.rental ?? "")?.rental;
      if (rental) this.onSelect(rental);
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
    const active = this.select("mode").value === RENTAL_RAIL_CORRIDOR;
    this.select("station").hidden = !active;
    if (!active) this.select("station").value = "";
    const guide = element<HTMLDetailsElement>(
      this.panel,
      ".rent-table-corridor",
    );
    guide.hidden = !active;
    if (!active) guide.open = false;
  }

  showRailCorridor(): void {
    this.select("mode").value = RENTAL_RAIL_CORRIDOR;
    this.syncCorridor();
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

  private layoutColumns(): void {
    const limit = this.freezeLimit();
    const freeze = Math.min(this.frozen, limit);
    const input = this.select("freeze");
    for (const option of input.options)
      option.disabled = Number(option.value) > limit;
    input.value = String(freeze);
    let offset = 0;
    for (const [index, column] of columns.entries()) {
      const width =
        limit === 2 ? (column.mobileWidth ?? column.width) : column.width;
      const col = element<HTMLTableColElement>(
        this.grid,
        `[data-column="${column.id}"]`,
      );
      col.style.width = `${width}px`;
      this.grid.style.setProperty(`--rent-left-${index}`, `${offset}px`);
      offset += width;
    }
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
      ["KRL Cikarang–Sudirman", krl],
      ["MRT Lebak Bulus–Bundaran HI", mrt],
    ] as const;
    this.select("station").innerHTML =
      `<option value="">Semua stasiun koridor</option>${groups
        .map(
          ([label, stops]) =>
            `<optgroup label="${label}">${stops.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</optgroup>`,
        )
        .join("")}`;
    this.rows.clear();
    for (const rental of rentals) {
      const near = rental.nearbyMosques?.[0];
      const row: Row = {
        rental,
        stops: {},
        mosque: near && idToMosque.get(near.id),
        mosqueKm: near?.km,
        group:
          RENTAL_MAP_GROUPS.find((g) => g.id === rentalMapKind(rental)) ??
          RENTAL_MAP_GROUPS[3],
      };
      if (rental.location) {
        for (const [mode, items] of byMode)
          row.stops[mode] = nearestStation(rental.location, items);
        row.corridorStop = nearestStation(rental.location, corridor);
      }
      this.rows.set(rental.id, row);
    }
  }

  private stop(row: Row): Stop | undefined {
    const mode = this.select("mode").value;
    if (mode === RENTAL_RAIL_CORRIDOR) {
      const station = this.corridorStations.get(this.select("station").value);
      return station && row.rental.location
        ? { station, distance: distanceKm(row.rental.location, station) }
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
        mode === RENTAL_RAIL_CORRIDOR &&
        row.group.id === "kos" &&
        !rental.review?.couples
      )
        return false;
      const stop = this.stop(row);
      if (
        mode &&
        (!stop ||
          stop.distance > (mode === "TransJakarta" ? 0.7 : railRadiusKm))
      )
        return false;
      if (!tokens.length) return true;
      const text = columns
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
        .querySelector("button")
        ?.setAttribute("aria-pressed", String(selected));
    }
  }

  update(rentals: ResearchRental[], selected: string[]): void {
    this.matches = rentals;
    this.selected = selected;
    this.paint();
  }

  private paint(): void {
    const column = columns.find((c) => c.id === this.sort.id) ?? columns[0];
    const sorted = this.matches
      .map((rental) => this.rows.get(rental.id))
      .filter((row): row is Row => Boolean(row))
      .sort((a, b) => {
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
    this.page = Math.max(
      0,
      Math.min(this.page, Math.ceil(sorted.length / this.pageSize) - 1),
    );
    const start = this.page * this.pageSize;
    const slice = sorted.slice(start, start + this.pageSize);
    this.head.innerHTML = `<tr>${columns
      .map((c, i) => {
        const active = c.id === this.sort.id;
        return `<th scope="col" data-col="${i}"${active ? ` aria-sort="${this.sort.ascending ? "ascending" : "descending"}"` : ""}><button type="button" data-sort="${c.id}">${esc(c.label)}<span aria-hidden="true">${active ? (this.sort.ascending ? "↑" : "↓") : "↕"}</span></button></th>`;
      })
      .join("")}</tr>`;
    this.body.innerHTML = slice.length
      ? slice
          .map((row) => {
            const stop = this.stop(row);
            const { rental, group } = row;
            const selected = this.selected.includes(rental.id);
            return `<tr data-rental="${esc(rental.id)}" data-kind="${group.id}" class="${selected ? "is-selected" : ""}" style="--rent-type:${group.color}">${columns.map((c, i) => `<td data-col="${i}">${i === 0 ? `<button type="button" aria-pressed="${selected}" title="${esc(rental.title)}">${esc(rental.title)}</button>` : i === 1 ? `<span class="rent-table-type">${group.label}</span>` : cellHTML(c.value(row, stop), c)}</td>`).join("")}</tr>`;
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
