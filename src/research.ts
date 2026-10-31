import "@fontsource-variable/plus-jakarta-sans";
import "./style.css";
import "./research.css";
import {
  getUser,
  initializeAuth,
  login,
  loginErrorMessage,
  logout,
  privateAPI,
} from "./auth.ts";
import { escapeHTML as esc, money } from "./geo.ts";
import { icon } from "./icons.ts";
import {
  budgetBounds,
  checkedDate,
  distanceText,
  FACILITY_LABELS,
  feeText,
  hasIslamicEducation,
  hasKajian,
  isOperating,
  loadResearch,
  monthlyRent,
  nearestRail,
  populationText,
  priceRange,
  type RailMode,
  RENTAL_LABELS,
  type ResearchData,
  type ResearchLead,
  type ResearchMosque,
  type ResearchProperty,
  type ResearchRental,
  type ResearchSaleAd,
  rentText,
  researchToListing,
  researchToPin,
  SOCIAL_LABELS,
  SOURCE_LABELS,
  type SocialLink,
  STATION_STATUS_LABELS,
  STATUS_LABELS,
  type StationScope,
  safeUrl,
  stationLabel,
  stationsFor,
  withinBudget,
} from "./research-data.ts";
import { type AppConfig, AREAS } from "./types.ts";

const SALE_STEPS = [
  200_000_000, 300_000_000, 500_000_000, 750_000_000, 1_000_000_000,
  1_500_000_000, 2_000_000_000, 3_000_000_000, 5_000_000_000,
];
const RENT_STEPS = [
  500_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000,
];
const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;
const external = 'target="_blank" rel="noopener noreferrer"';

$("app").innerHTML = `
  <a class="skip-link" id="catalog-skip" href="#research-results">Langsung ke daftar hunian</a>
  <header class="masthead">
    <a class="brand" href="/" aria-label="Rumah Tinggal, beranda"><span class="brand-mark">${icon("home")}</span><span>rumah<span class="brand-light">tinggal</span><span class="brand-dot">.</span></span></a>
    <nav class="main-nav" aria-label="Navigasi utama"><a href="/">Jelajahi peta</a><a class="active" href="/riset" aria-current="page">${icon("research")} Riset properti</a><a href="/?koleksi=listingku">${icon("bookmark")} Listingku</a></nav>
    <div class="header-right"><button class="button login-button" id="account-button"><span class="google-g" aria-hidden="true">G</span><span id="account-label">Masuk dengan Google</span></button></div>
  </header>
  <main class="research-main">
    <section class="research-hero">
      <a class="research-back" href="/">← Kembali ke peta</a>
      <div class="eyebrow"><span class="tiny-line"></span> RISET PROPERTI NYATA</div>
      <h1>Hunian dekat KRL, MRT & LRT.<br/><span>Lengkap dengan buktinya.</span></h1>
      <p class="intro">Temukan proyek hunian di sekitar stasiun Jabodetabek, lengkap dengan harga, developer, tautan asli, dan tanggal cek. Simpan pilihanmu ke Listingku atau sebagai pin pribadi. Harga dan ketersediaan perlu dikonfirmasi ke developer.</p>
      <p class="research-note">Verifikasi mencakup sumber harga dan lokasi. Nama developer mengikuti sumber publik; kepemilikan unit belum diverifikasi.</p>
      <div class="card-legend" aria-label="Penanda jenis properti"><span class="type-badge type-house-sale">Rumah dijual</span><span class="type-badge type-apartment">Apartemen</span><span class="type-badge type-rental">Kontrakan / rumah sewa</span></div>
      <dl class="research-stats" id="research-stats"></dl>
      <div class="research-links"><a class="button primary" href="/?koleksi=riset">${icon("pin")} Lihat proyek di peta</a><a class="button" href="#masjid" id="mosques-shortcut" hidden>Masjid dengan kajian</a><a class="button" href="#sewa" id="rentals-shortcut">Sewa apartemen & kontrakan</a><a class="button" href="#iklan-dijual" id="sale-ads-shortcut">Iklan dijual dekat masjid kajian</a><a class="button" href="#belum-diverifikasi" id="leads-shortcut">Petunjuk belum diverifikasi</a><a class="button" href="#metode">${icon("info")} Cara riset ini dibuat</a></div>
    </section>
    <section class="research-filters" id="catalog-filters" aria-label="Filter seluruh daftar">
      <div class="research-selects catalog-selects">
        <label>Daerah<select id="catalog-area"><option>Semua</option>${AREAS.map((area) => `<option>${area}</option>`).join("")}<option value="outside">Luar Jabodetabek</option></select></label>
        <label>Tipe penawaran<select id="catalog-offer"><option value="all">Semua penawaran</option><option value="rental-house">Kontrakan / rumah sewa</option><option value="developer">Properti developer</option></select></label>
      </div>
      <div class="area-chips" aria-label="Filter wilayah"><button class="chip selected" data-area="Semua" aria-pressed="true">Semua</button>${AREAS.map((area) => `<button class="chip" data-area="${area}" aria-pressed="false">${area}</button>`).join("")}</div>
      <p class="research-note">Daerah berlaku untuk seluruh daftar hunian dan masjid. Properti developer berisi proyek baru; kontrakan / rumah sewa tidak mencakup kos atau apartemen sewa.</p>
      <p class="research-note" id="catalog-status" role="status"></p>
    </section>
    <section class="research-filters" id="developer-filters" aria-label="Filter riset properti">
      <p class="research-note">Filter tambahan untuk properti developer</p>
      <div class="search-box">${icon("search")}<input id="research-search" type="search" aria-label="Cari proyek, developer, lokasi, masjid, sekolah, atau stasiun" placeholder="Proyek, lokasi, masjid, sekolah, atau stasiun…" autocomplete="off"/></div>
      <div class="research-selects">
        <label>Moda<select id="research-mode"><option value="">KRL, MRT & LRT</option><option>KRL</option><option>MRT</option><option>LRT</option></select></label>
        <label>Stasiun<select id="research-station-scope"><option value="all">Beroperasi & rencana</option><option value="operating">Beroperasi saja</option><option value="planned">Rencana saja</option></select></label>
        <label>Jarak garis lurus<select id="research-distance"><option value="any">Semua jarak</option><option value="3">≤ 3 km</option><option value="2">≤ 2 km</option><option value="1">≤ 1 km</option></select></label>
        <label>Bangunan developer<select id="research-type"><option value="">Semua jenis</option><option>Rumah</option><option>Apartemen</option></select></label>
        <label>Budget dari<select id="research-budget-min">${budgetOptions(SALE_STEPS, "Rp 0")}</select></label>
        <label>Budget sampai<select id="research-budget-max">${budgetOptions(SALE_STEPS, "Tanpa batas")}</select></label>
        <label>Poin plus<select id="research-plus"><option value="">Semua</option><option value="kajian">Ada masjid dengan kajian</option><option value="education">Ada pendidikan Islam anak</option><option value="both">Keduanya</option><option value="concept">Konsep islami (klaim proyek)</option></select></label>
        <label>Bukti<select id="research-verdict"><option value="">Semua bukti</option><option value="confirmed">Terverifikasi penuh</option></select></label>
        <label>Urutkan<select id="research-sort"><option value="price">Harga terendah</option><option value="distance">Terdekat stasiun</option><option value="name">Nama A–Z</option></select></label>
      </div>
    </section>
    <section id="research-results" class="research-results" tabindex="-1" aria-label="Daftar proyek">
      <div class="results-toolbar"><strong id="research-count">Memuat data riset…</strong><span id="research-scope"></span></div>
      <div id="research-list" class="research-list" aria-live="polite"></div>
    </section>
    <section class="research-section" id="masjid" aria-labelledby="mosques-title" hidden>
      <div class="eyebrow"><span class="tiny-line"></span> MASJID & HUNIAN</div>
      <h2 id="mosques-title">Masjid dengan kajian</h2>
      <p class="section-intro" id="mosques-intro"></p>
      <div class="research-filters rental-filters">
        <label>Cari masjid<input id="mosque-search" type="search" placeholder="Nama masjid atau alamat…" autocomplete="off"/></label>
        <label>Wilayah masjid<select id="mosque-area"><option value="">Semua wilayah</option>${AREAS.map((area) => `<option>${area}</option>`).join("")}<option value="outside">Luar Jabodetabek</option></select></label>
      </div>
      <div class="results-toolbar"><strong id="mosque-count" aria-live="polite"></strong></div>
      <div id="mosque-list" class="research-list" aria-live="polite"></div>
    </section>
    <section class="research-section" id="sewa" aria-labelledby="rentals-title" tabindex="-1" hidden>
      <div class="eyebrow"><span class="tiny-line"></span> SEWA</div>
      <h2 id="rentals-title">Sewa apartemen dan kontrakan</h2>
      <p class="section-intro" id="rentals-intro"></p>
      <div class="area-chips" aria-label="Filter wilayah sewa" id="rental-areas"></div>
      <div class="research-filters rental-filters">
        <label>Cari sewa<input id="rental-search" type="search" placeholder="Lokasi, stasiun, masjid, sekolah…"/></label>
        <label id="rental-type-control">Jenis sewa<select id="rental-type"><option value="">Semua jenis</option><option value="house">Kontrakan / rumah sewa</option><option value="apartment">Apartemen</option></select></label>
        <label>Sewa per bulan dari<select id="rental-budget-min">${budgetOptions(RENT_STEPS, "Rp 0", rentMoney)}</select></label>
        <label>sampai<select id="rental-budget-max">${budgetOptions(RENT_STEPS, "Tanpa batas", rentMoney)}</select></label>
      </div>
      <div class="results-toolbar"><strong id="rental-count" aria-live="polite"></strong></div>
      <div id="rental-list" class="research-list" aria-live="polite"></div>
    </section>
    <section class="research-section" id="iklan-dijual" aria-labelledby="sale-ads-title" hidden>
      <div class="eyebrow"><span class="tiny-line"></span> IKLAN DIJUAL</div>
      <h2 id="sale-ads-title">Rumah dan kavling dijual dekat masjid kajian</h2>
      <p class="section-intro" id="sale-ads-intro"></p>
      <div class="research-filters rental-filters">
        <label>Budget dari<select id="sale-budget-min">${budgetOptions(SALE_STEPS, "Rp 0")}</select></label>
        <label>sampai<select id="sale-budget-max">${budgetOptions(SALE_STEPS, "Tanpa batas")}</select></label>
      </div>
      <div class="results-toolbar"><strong id="sale-ad-count" aria-live="polite"></strong></div>
      <div id="sale-ad-list" class="research-list" aria-live="polite"></div>
    </section>
    <section class="research-section" id="belum-diverifikasi" aria-labelledby="leads-title" hidden>
      <div class="eyebrow"><span class="tiny-line"></span> PETUNJUK</div>
      <h2 id="leads-title">Belum diverifikasi atau belum terjangkau</h2>
      <p class="section-intro" id="leads-intro"></p>
      <div id="lead-list" class="method-list"></div>
    </section>
    <section class="research-section" id="rencana" aria-labelledby="planned-title" hidden>
      <div class="eyebrow"><span class="tiny-line"></span> RENCANA PERLUASAN</div>
      <h2 id="planned-title">Rencana perluasan LRT dan KRL</h2>
      <p class="section-intro" id="planned-intro"></p>
      <div id="planned-list" class="method-list"></div>
    </section>
    <section class="research-section" id="metode" aria-labelledby="methods-title">
      <div class="eyebrow"><span class="tiny-line"></span> METODE</div>
      <h2 id="methods-title">Cara data ini ditemukan</h2>
      <p class="section-intro">Catatan ini bisa dipakai ulang untuk pengecekan berikutnya, tetapi bukan aturan wajib. Cara baru boleh dipakai selama sumbernya terbuka, tidak mengakali pembatasan situs, tautannya disimpan, dan tanggal ceknya dicatat.</p>
      <div id="method-list" class="method-list"></div>
    </section>
    <section class="research-section" aria-labelledby="coverage-title">
      <div class="eyebrow"><span class="tiny-line"></span> CAKUPAN</div>
      <h2 id="coverage-title">Cakupan & batasan</h2>
      <div id="coverage"></div>
    </section>
  </main>
  <footer class="research-footer"><p>Titik stasiun: snapshot OpenStreetMap 29 Oktober 2026 (© OpenStreetMap contributors, ODbL). Jarak adalah garis lurus, bukan rute berjalan. Harga, status, dan klaim transportasi milik sumbernya masing-masing; halaman ini bukan iklan atau penawaran.</p></footer>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
`;

let data: ResearchData | undefined;
let selectedArea = "Semua";
let toastTimer: ReturnType<typeof setTimeout>;

function toast(message: string): void {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 6000);
}

function value(id: string): string {
  return $<HTMLInputElement | HTMLSelectElement>(id).value;
}

function inArea(area: string | null): boolean {
  return selectedArea === "Semua" || area === selectedArea;
}

function isHouseRental(rental: ResearchRental): boolean {
  return ["kontrakan", "rumah-sewa"].includes(rental.rentalType);
}

function rentalInCatalogue(rental: ResearchRental): boolean {
  return (
    inArea(rental.area) &&
    value("catalog-offer") !== "developer" &&
    (value("catalog-offer") !== "rental-house" || isHouseRental(rental))
  );
}

function leadInCatalogue(lead: ResearchLead): boolean {
  return (
    inArea(lead.area) &&
    (value("catalog-offer") === "all" ||
      (value("catalog-offer") === "rental-house" && lead.type === "rental"))
  );
}

function relatedInCatalogue(
  listing: ResearchMosque["relatedListings"][number],
): boolean {
  if (!data) return false;
  if (listing.kind === "rental") {
    const rental = data.rentals?.rentals.find((r) => r.id === listing.id);
    return Boolean(rental && rentalInCatalogue(rental));
  }
  if (listing.kind === "lead") {
    const lead = data.leads?.leads.find((lead) => lead.id === listing.id);
    return Boolean(lead && leadInCatalogue(lead));
  }
  const ad = data.saleAds?.ads.find((ad) => ad.id === listing.id);
  return value("catalog-offer") === "all" && Boolean(ad && inArea(ad.area));
}

function setCatalogueArea(area: string): void {
  selectedArea = area;
  renderCatalogue();
}

function renderCatalogue(): void {
  if (!data) return;
  $<HTMLSelectElement>("catalog-area").value = selectedArea;
  $<HTMLSelectElement>("mosque-area").value =
    selectedArea === "Semua" ? "" : selectedArea;
  for (const chip of document.querySelectorAll<HTMLButtonElement>(
    "[data-area]",
  )) {
    const selected = chip.dataset.area === selectedArea;
    chip.classList.toggle("selected", selected);
    chip.setAttribute("aria-pressed", String(selected));
  }
  const offer = value("catalog-offer");
  const area = selectedArea === "outside" ? "Luar Jabodetabek" : selectedArea;
  const label = $<HTMLSelectElement>("catalog-offer").selectedOptions[0]?.text;
  $("catalog-status").textContent = `Daerah: ${area} · ${label}`;
  $<HTMLAnchorElement>("catalog-skip").href =
    offer === "rental-house" ? "#sewa" : "#research-results";
  render();
  renderRentals(data);
  renderSaleAds(data);
  renderLeads(data);
  renderMosques(data);
  const rentals = $("sewa");
  const mosques = $("masjid");
  if (offer === "rental-house") {
    if (rentals.nextElementSibling !== mosques) mosques.before(rentals);
  } else if (mosques.nextElementSibling !== rentals) mosques.after(rentals);
  for (const [shortcut, section] of [
    ["rentals-shortcut", "sewa"],
    ["sale-ads-shortcut", "iklan-dijual"],
    ["leads-shortcut", "belum-diverifikasi"],
  ])
    $(shortcut).hidden = $(section).hidden;
}

function filtered(): ResearchProperty[] {
  if (!data || value("catalog-offer") === "rental-house") return [];
  const query = value("research-search").trim().toLocaleLowerCase("id-ID");
  const mode = (value("research-mode") || undefined) as RailMode | undefined;
  const scope = (value("research-station-scope") || "all") as StationScope;
  const anyDistance = value("research-distance") === "any";
  const maxKm = anyDistance ? Infinity : Number(value("research-distance"));
  const type = value("research-type");
  const [low, high] = budgetBounds(
    value("research-budget-min"),
    value("research-budget-max"),
  );
  const verdict = value("research-verdict");
  const plus = value("research-plus");
  const list = data.properties.filter((property) => {
    const station = nearestRail(property, mode, scope);
    const text = [
      property.name,
      property.developer ?? "",
      property.locationText,
      property.region ?? "",
      ...(property.islamic?.kajian ?? []).map((place) => place.name),
      ...(property.islamic?.education ?? []).map((place) => place.name),
      ...(property.islamic?.claims ?? []).map((claim) => claim.quote),
      ...stationsFor(property, "all").map(
        (item) => `${item.mode} ${item.name}`,
      ),
    ]
      .join(" ")
      .toLocaleLowerCase("id-ID");
    return (
      (station
        ? station.km <= maxKm
        : anyDistance && !mode && scope === "all") &&
      inArea(property.area) &&
      (!query || text.includes(query)) &&
      (!type || property.kind === type) &&
      withinBudget(property.price, low, high) &&
      (!verdict || property.verdict === verdict) &&
      matchesPlus(property, plus)
    );
  });
  const sort = value("research-sort");
  const km = (property: ResearchProperty) =>
    nearestRail(property, mode, scope)?.km ?? Infinity;
  list.sort((a, b) =>
    sort === "distance"
      ? km(a) - km(b)
      : sort === "name"
        ? a.name.localeCompare(b.name, "id-ID")
        : a.price.min - b.price.min,
  );
  return list;
}

function units(property: ResearchProperty): string {
  if (!property.units.length) return "";
  const area = (size: number | null) => (size ? `${size} m²` : "–");
  return `<details class="research-units"><summary>Tipe unit dari sumber (${property.units.length})</summary><table><thead><tr><th>Tipe</th><th>Kamar</th><th>Tanah</th><th>Bangunan</th><th>Harga</th></tr></thead><tbody>${property.units
    .map(
      (unit) =>
        `<tr><td>${esc(unit.label)}</td><td>${esc(unit.bedrooms ?? "–")}</td><td>${area(unit.landArea)}</td><td>${area(unit.buildingArea)}</td><td>${unit.price ? money(unit.price) : "–"}</td></tr>`,
    )
    .join("")}</tbody></table></details>`;
}

function sources(property: ResearchProperty): string {
  return `<details class="research-sources"><summary>Bukti & sumber (${property.sources.length})</summary><ul>${property.sources
    .map(
      (source) =>
        `<li><span class="source-kind kind-${source.kind}">${SOURCE_LABELS[source.kind] ?? source.kind}</span><a href="${esc(safeUrl(source.url))}" ${external}>${esc(source.title)} ↗</a><small>${source.fetched ? "Dibuka saat pengecekan" : "Halaman sumber belum dibuka langsung"}${source.pageDate ? ` · tanggal halaman ${esc(checkedDate(source.pageDate))}` : ""}${source.supports.length ? ` · mendukung ${esc(source.supports.join(", "))}` : ""}${source.note ? ` · ${esc(source.note)}` : ""}</small></li>`,
    )
    .join("")}</ul></details>`;
}

function matchesPlus(property: ResearchProperty, plus: string): boolean {
  const kajian = hasKajian(property);
  const education = hasIslamicEducation(property);
  return plus === "kajian"
    ? kajian
    : plus === "education"
      ? education
      : plus === "both"
        ? kajian && education
        : plus === "concept"
          ? Boolean(
              property.islamic?.claims.some(
                (claim) => claim.kind === "syariah-concept",
              ),
            )
          : true;
}

function socialLinks(links: SocialLink[] | undefined): string {
  return (links ?? [])
    .map(
      (link) =>
        `<a href="${esc(safeUrl(link.url))}" ${external} title="${link.via === "official-site" ? "Ditautkan dari situs resmi" : link.via === "osm-tag" ? "Dari tag OpenStreetMap" : link.via === "user-lead" ? "Dari daftar pengguna; kepemilikan akun belum diverifikasi" : "Ditemukan lewat hasil pencarian"}; isi belum dibuka otomatis">${esc(SOCIAL_LABELS[link.platform])}${link.via === "user-lead" ? " (belum diverifikasi)" : ""} ↗</a>`,
    )
    .join(" ");
}

function rentMoney(amount: number): string {
  return amount >= 1_000_000
    ? `Rp ${(amount / 1_000_000).toLocaleString("id-ID")} jt`
    : `Rp ${amount / 1000} rb`;
}

function budgetOptions(
  steps: number[],
  empty: string,
  format: (amount: number) => string = money,
): string {
  return [`<option value="0">${empty}</option>`]
    .concat(
      steps.map((step) => `<option value="${step}">${format(step)}</option>`),
    )
    .join("");
}

// Nomor kontak tidak disimpan; tombol membuka halaman publik yang memuatnya.
function contactLink(
  href: string | null | undefined,
  className = "button",
): string {
  return href
    ? `<a class="${className}" data-testid="contact-link" href="${esc(safeUrl(href))}" title="Nomor kontak ada di halaman sumber dan belum diverifikasi" ${external}>☎ Kontak (belum diverifikasi) ↗</a>`
    : "";
}

function projectSocial(property: ResearchProperty): string {
  if (!property.social?.length) return "";
  return `<p class="research-social" data-testid="research-social"><span>Media sosial resmi:</span> ${socialLinks(property.social)} <small>Dari situs resmi atau hasil pencarian; isi belum dibuka otomatis.</small></p>`;
}

function plusPoints(property: ResearchProperty): string {
  const islamic = property.islamic;
  const meta = data?.islamic;
  if (!islamic || !meta) return "";
  const kajian = islamic.kajian.map(
    (place) =>
      `<li><span class="plus-kind">${esc(FACILITY_LABELS[place.kind])}</span><strong>${esc(place.name)}</strong> <em>${distanceText(place.km)}</em> ${socialLinks(place.social)}${(
        place.kajian ?? []
      )
        .slice(0, 2)
        .map((item) =>
          item.url.includes("simas.kemenag.go.id")
            ? `<small>Tercatat di SIMAS Kemenag: “${esc(item.schedule)}”; jadwal tidak dipublikasikan. <a href="${esc(safeUrl(item.url))}" ${external}>profil SIMAS ↗</a></small>`
            : `<small>Kajian: “${esc(item.schedule)}” <a href="${esc(safeUrl(item.url))}" ${external}>sumber${item.pageDate ? ` ${esc(checkedDate(item.pageDate))}` : ""} ↗</a></small>`,
        )
        .join("")}</li>`,
  );
  const education = islamic.education.map((place) => {
    const info = place.education;
    return `<li><span class="plus-kind">${esc(FACILITY_LABELS[place.kind])}</span><strong>${esc(place.name)}</strong> <em>${distanceText(place.km)}</em> ${socialLinks(place.social)}${info?.levels.length ? `<small>${esc(info.levels.join(", "))}${info.program ? ` · ${esc(info.program)}` : ""}</small>` : ""}${info?.fees.length ? `<small>Biaya: ${info.fees.map((fee) => esc(feeText(fee))).join("; ")} <a href="${esc(safeUrl(info.fees[0].url))}" ${external}>sumber ↗</a></small>` : info ? `<small>Biaya belum dipublikasikan sumber. <a href="${esc(safeUrl(info.url))}" ${external}>sumber ↗</a></small>` : ""}</li>`;
  });
  const claims = islamic.claims.map(
    (claim) =>
      `<li><span class="plus-kind">${claim.kind === "syariah-concept" ? "Konsep islami (klaim pemasaran)" : "Klaim proyek"}</span>“${esc(claim.quote)}” <a href="${esc(safeUrl(claim.url))}" ${external}>↗</a>${claim.kind === "syariah-concept" ? "<small>Skema pembayaran dan legalitasnya tidak diverifikasi.</small>" : ""}</li>`,
  );
  return `<div class="research-plus" data-testid="research-plus"><strong>Poin plus keluarga muslim</strong><ul>${[...kajian, ...education, ...claims].join("")}</ul><small>Dalam ${distanceText(meta.radiusKm)} garis lurus, dicek ${esc(checkedDate(meta.checkedAt))}. Jadwal kajian dan biaya dapat berubah; konfirmasi ke pengurus masjid atau sekolah.</small></div>`;
}

function population(property: ResearchProperty): string {
  const context = data?.population;
  if (!property.population || !context) return "";
  return `<div class="research-context" data-testid="research-population"><strong>Penduduk sekitar</strong><p>${esc(populationText(property.population, context))}</p><small>Penduduk tempat tinggal hasil model, bukan sensus atau keramaian siang hari. <a href="${esc(safeUrl(context.source.url))}" ${external}>${esc(context.source.licence)} ↗</a></small></div>`;
}

function card(property: ResearchProperty): string {
  const mappable = researchToListing(property) !== undefined;
  const precision = property.coordinate
    ? `${property.coordinate.precision} (${property.coordinate.method})`
    : "lokasi";
  return `<article class="research-card card-${property.kind === "Apartemen" ? "apartment" : "house-sale"}" id="${esc(property.id)}" data-testid="research-card">
    <div class="research-card-top"><span class="card-area"><i class="area-dot area-${esc((property.area ?? "luar").toLowerCase())}"></i>${esc(property.area ?? "Di luar 14 wilayah")} <span>· ${esc(property.locationText)}</span></span><span class="verdict verdict-${property.verdict}">${property.verdict === "confirmed" ? "Terverifikasi" : "Sebagian terverifikasi"}</span></div>
    <span class="type-badge type-${property.kind === "Apartemen" ? "apartment" : "house-sale"}">${property.kind === "Apartemen" ? "Apartemen dijual" : "Rumah dijual"}</span>
    <h3>${esc(property.name)}</h3>
    <p class="research-meta">${esc(property.developer ?? "Developer belum tercatat")} · ${esc(property.kind)}${property.subsidized ? " subsidi" : ""} · ${STATUS_LABELS[property.status] ?? esc(property.status)}</p>
    <div class="research-price"><strong>${priceRange(property)}</strong><span>${esc(property.price.basis)}</span></div>
    <blockquote class="research-quote">“${esc(property.price.quote)}” <a href="${esc(safeUrl(property.price.url))}" ${external}>sumber harga ↗</a>${property.price.pageDate ? ` <small>tanggal halaman ${esc(checkedDate(property.price.pageDate))}</small>` : ""}</blockquote>
    <ul class="research-stations" aria-label="Stasiun terdekat">${stationsFor(
      property,
      "all",
    )
      .map((station) =>
        isOperating(station)
          ? `<li><span class="mode mode-${esc(station.mode.toLowerCase())}">${esc(station.mode)}</span>${esc(station.name)}<em>${distanceText(station.km)}</em></li>`
          : `<li class="planned" title="${esc(stationLabel(station))}"><span class="mode mode-${esc(station.mode.toLowerCase())}">${esc(station.mode)}</span>${esc(station.name)}<small>${esc(STATION_STATUS_LABELS[station.status ?? "unclear"])}</small><em>${distanceText(station.km)}</em></li>`,
      )
      .join("")}</ul>
    ${
      property.listingBasis === "islamic"
        ? `<p class="research-islamic-basis" data-testid="research-islamic-basis">Dicantumkan karena fasilitas atau konsep islami. ${property.nearestAny ? `Stasiun terdekat ${esc(property.nearestAny.mode)} ${esc(property.nearestAny.name)} ${property.nearestAny.km.toLocaleString("id-ID", { maximumFractionDigits: 2 })} km garis lurus, di luar radius ${data?.maxDistanceKm ?? 3} km.` : "Titik proyek belum terverifikasi, jadi jarak ke stasiun belum dihitung."}</p>`
        : ""
    }
    <p class="research-note">Jarak garis lurus dari titik ${esc(precision)} ke titik stasiun, bukan rute berjalan.${stationsFor(property, "planned").length ? ` Stasiun bertanda status belum beroperasi; lihat <a href="#rencana">rencana perluasan</a>.` : ""}</p>
    ${projectSocial(property)}
    ${property.transitClaim ? `<p class="research-claim">Klaim sumber: “${esc(property.transitClaim.quote)}” <a href="${esc(safeUrl(property.transitClaim.url))}" ${external}>↗</a></p>` : ""}
    ${plusPoints(property)}
    ${population(property)}
    ${units(property)}
    ${sources(property)}
    <div class="research-actions">
      ${mappable ? `<a class="button" href="/?riset=${encodeURIComponent(property.id)}">${icon("pin")} Lihat di peta</a><button class="button primary" type="button" data-save="${esc(property.id)}">${icon("bookmark")} Simpan ke Listingku</button>` : '<span class="button" aria-disabled="true">Lokasi belum dipetakan</span>'}
      ${researchToPin(property) ? `<button class="button" type="button" data-save-pin="${esc(property.id)}">${icon("pin")} Simpan sebagai pin</button>` : ""}
      ${property.officialUrl ? `<a class="button" href="${esc(safeUrl(property.officialUrl))}" ${external}>Situs resmi ↗</a>` : ""}
      ${contactLink(property.contactUrl)}
    </div>
    <p class="research-checked">Dicek ${esc(checkedDate(property.lastChecked))}</p>
  </article>`;
}

function render(): void {
  if (!data) return;
  const onlyRentals = value("catalog-offer") === "rental-house";
  $("developer-filters").hidden = onlyRentals;
  $("research-results").hidden = onlyRentals;
  const list = filtered();
  $("research-count").textContent = `${list.length} proyek`;
  $("research-scope").textContent =
    ` dari ${data.properties.length} · ${selectedArea === "Semua" ? "Jabodetabek" : selectedArea}`;
  $("research-list").innerHTML = onlyRentals
    ? ""
    : list.length
      ? list.map(card).join("")
      : `<div class="empty-state" data-testid="research-empty"><span class="empty-icon">${icon("search")}</span><h2>Belum ada proyek yang cocok</h2><p>Coba perluas jarak, moda, wilayah, atau harga.</p></div>`;
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-save]",
  ))
    button.onclick = () => {
      const property = data?.properties.find(
        (item) => item.id === button.dataset.save,
      );
      if (property) void save(property, button, "listing");
    };
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-save-pin]",
  ))
    button.onclick = () => {
      const property = data?.properties.find(
        (item) => item.id === button.dataset.savePin,
      );
      if (property) void save(property, button, "pin");
    };
}

function renderStatic(research: ResearchData): void {
  const confirmed = research.properties.filter(
    (property) => property.verdict === "confirmed",
  ).length;
  const prices = research.properties.map((property) => property.price.min);
  $("research-stats").innerHTML = `
    <div><dt>Proyek di katalog</dt><dd>${research.properties.length}</dd></div>
    <div><dt>Terverifikasi penuh</dt><dd>${confirmed}</dd></div>
    <div><dt>Harga mulai</dt><dd>${prices.length ? `${money(Math.min(...prices))} – ${money(Math.max(...prices))}` : "–"}</dd></div>
    <div><dt>Cek terakhir</dt><dd>${esc(checkedDate(research.checkedAt))}</dd></div>
    <div><dt>Radius</dt><dd>≤ ${research.maxDistanceKm} km garis lurus</dd></div>`;
  renderPlanned(research);
  $("method-list").innerHTML = research.methods
    .map(
      (method) =>
        `<article class="method-card" id="metode-${esc(method.id)}"><div class="method-top"><span class="source-kind">${esc(method.category)}</span>${method.recommended ? '<span class="verdict verdict-confirmed">Dianjurkan</span>' : '<span class="verdict verdict-partial">Catatan, tidak dipakai otomatis</span>'}</div><h3>${esc(method.name)}</h3><p>${esc(method.summary)}</p>${method.steps.length ? `<ol>${method.steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol>` : ""}${method.limits.length ? `<p class="method-label">Batasan</p><ul>${method.limits.map((limit) => `<li>${esc(limit)}</li>`).join("")}</ul>` : ""}${method.sources.length ? `<p class="method-sources">${method.sources.map((source) => `<a href="${esc(safeUrl(source.url))}" ${external}>${esc(source.title)} ↗</a>`).join("")}</p>` : ""}<small>${method.recommended ? "Terakhir dipakai" : "Dicatat"} ${esc(checkedDate(method.lastUsed))}</small></article>`,
    )
    .join("");
  $("coverage").innerHTML = `${
    research.coverage.length
      ? `<table class="coverage-table"><thead><tr><th>Area pencarian</th><th>Kandidat</th><th>Masuk daftar</th></tr></thead><tbody>${research.coverage
          .map(
            (item) =>
              `<tr><td>${esc(item.label)}</td><td>${item.found}</td><td>${item.included}</td></tr>`,
          )
          .join("")}</tbody></table>`
      : ""
  }${research.gaps.length ? `<ul class="coverage-gaps">${research.gaps.map((gap) => `<li>${esc(gap)}</li>`).join("")}</ul>` : ""}${research.excluded.length ? `<details class="coverage-excluded"><summary>Ditemukan tetapi belum masuk daftar (${research.excluded.length})</summary><ul>${research.excluded.map((item) => `<li><strong>${esc(item.name)}</strong>: ${esc(item.reason)}${item.price ? ` <span class="excluded-price">· ${esc(item.kind ?? "")} ${item.price.max && item.price.max > item.price.min ? `${money(item.price.min)} – ${money(item.price.max)}` : money(item.price.min)} <a href="${esc(safeUrl(item.price.url))}" ${external}>sumber harga ↗</a></span>` : ""}${item.social?.length ? ` · ${socialLinks(item.social)}` : ""}${(item.claims ?? []).map((claim) => `<small class="excluded-claim">${claim.kind === "syariah-concept" ? "Konsep islami (klaim pemasaran)" : "Klaim proyek"}: “${esc(claim.quote)}” <a href="${esc(safeUrl(claim.url))}" ${external}>↗</a></small>`).join("")}</li>`).join("")}</ul></details>` : ""}`;
}

function mosqueCard(mosque: ResearchMosque, radiusKm: number): string {
  const radius = radiusKm.toLocaleString("id-ID");
  const cancelled = mosque.profile?.cancelledUpcoming ?? 0;
  const listingLabels = {
    rental: "Sewa",
    sale: "Dijual",
    lead: "Petunjuk belum diverifikasi",
  };
  return `<article class="research-card mosque-card" data-testid="mosque-card" id="${esc(mosque.id)}">
    <div class="research-card-top"><span class="source-kind">${esc(mosque.area ?? "Luar Jabodetabek")}</span><span class="verdict verdict-partial">${mosque.eventCount} jadwal tercatat</span></div>
    <h3>${esc(mosque.name)}</h3>
    <p class="research-meta">${esc(mosque.address)}</p>
    ${cancelled ? `<p class="research-note" data-testid="mosque-cancelled">${cancelled} jadwal dibatalkan pada profil yang diperiksa. Jumlah jadwal tercatat dapat mencakup pembatalan.</p>` : ""}
    ${value("catalog-offer") === "rental-house" ? "" : `<div class="research-context"><strong>Proyek bertitik ≤ ${radius} km</strong>${mosque.nearbyProperties.length ? `<ul class="mosque-related">${mosque.nearbyProperties.map((property) => `<li><a href="/?riset=${encodeURIComponent(property.id)}">${esc(property.name)}</a> · ${esc(distanceText(property.km))} garis lurus</li>`).join("")}</ul><small>Dihitung dari titik proyek dan masjid; akses dari setiap unit perlu dicek.</small>` : `<p>Belum ada proyek bertitik dalam radius ${radius} km di katalog.</p>`}</div>`}
    ${value("catalog-offer") === "rental-house" && !mosque.relatedListings.length ? '<p class="research-note">Belum ada kontrakan / rumah sewa yang terhubung dalam katalog.</p>' : ""}
    ${mosque.relatedListings.length ? `<div class="research-context"><strong>Iklan & petunjuk kawasan</strong><ul class="mosque-related">${mosque.relatedListings.map((listing) => `<li><a href="/riset#${encodeURIComponent(listing.id)}" data-mosque-listing="${esc(listing.id)}" data-listing-kind="${listing.kind}">${esc(listing.title)}</a><small>${listingLabels[listing.kind]} · ${esc(listing.relation)}</small><small>${esc(listing.note)}</small></li>`).join("")}</ul></div>` : ""}
    <div class="research-actions"><a class="button" href="${esc(safeUrl(mosque.googleMapsUrl))}" ${external}>${icon("pin")} Titik Google Maps ↗</a><a class="button" href="${esc(safeUrl(mosque.sourceUrl))}" ${external}>Jadwal di Ihrish ↗</a></div>
  </article>`;
}

function renderMosques(research: ResearchData): void {
  const mosques = research.mosques;
  if (!mosques?.items.length) return;
  $("masjid").hidden = false;
  $("mosques-shortcut").hidden = false;
  $("mosques-intro").textContent =
    `${mosques.note} Ada kajian tercatat sudah cukup; tidak harus rutin. Dicek ${checkedDate(mosques.checkedAt)}.`;
  const query = value("mosque-search").trim().toLocaleLowerCase("id-ID");
  const area = value("mosque-area");
  const items = mosques.items.filter(
    (mosque) =>
      (!area ||
        (area === "outside" ? mosque.area === null : mosque.area === area)) &&
      (!query ||
        `${mosque.name} ${mosque.address}`
          .toLocaleLowerCase("id-ID")
          .includes(query)),
  );
  $("mosque-count").textContent =
    `${items.length} dari ${mosques.items.length} masjid`;
  $("mosque-list").innerHTML = items.length
    ? items
        .map((mosque) =>
          mosqueCard(
            {
              ...mosque,
              nearbyProperties:
                value("catalog-offer") === "rental-house"
                  ? []
                  : mosque.nearbyProperties.filter((nearby) => {
                      const property = research.properties.find(
                        (p) => p.id === nearby.id,
                      );
                      return property && inArea(property.area);
                    }),
              relatedListings:
                mosque.relatedListings.filter(relatedInCatalogue),
            },
            mosques.radiusKm,
          ),
        )
        .join("")
    : '<p class="research-note" data-testid="mosque-empty">Belum ada masjid yang cocok. Coba nama, alamat, atau wilayah lain.</p>';
  for (const link of $("mosque-list").querySelectorAll<HTMLAnchorElement>(
    "[data-mosque-listing]",
  )) {
    link.onclick = () => {
      if (!document.getElementById(link.dataset.mosqueListing ?? "")) {
        if (link.dataset.listingKind === "rental") {
          for (const id of ["rental-search", "rental-type"])
            $<HTMLInputElement>(id).value = "";
          for (const id of ["rental-budget-min", "rental-budget-max"])
            $<HTMLSelectElement>(id).value = "0";
          renderRentals(research);
        } else if (link.dataset.listingKind === "sale") {
          for (const id of ["sale-budget-min", "sale-budget-max"])
            $<HTMLSelectElement>(id).value = "0";
          renderSaleAds(research);
        }
      }
      requestAnimationFrame(highlight);
    };
  }
  $("mosque-search").oninput = () => renderMosques(research);
  $("mosque-area").onchange = () =>
    setCatalogueArea(value("mosque-area") || "Semua");
}

function renderLeads(research: ResearchData): void {
  const leads = research.leads;
  if (!leads?.leads.length) return;
  const items = leads.leads.filter(leadInCatalogue);
  $("belum-diverifikasi").hidden = !items.length;
  $("leads-intro").textContent = `${leads.note} Sumber: ${leads.source}.`;
  const names = new Map(research.properties.map((p) => [p.id, p.name]));
  $("lead-list").innerHTML = items
    .map(
      (lead) =>
        `<article class="method-card lead-card" data-testid="lead-card" id="${esc(lead.id)}"><div class="method-top"><span class="source-kind">${esc(lead.area ?? "Jabodetabek")}</span><span class="verdict verdict-unverified">${lead.status === "unreached" ? "Belum terjangkau otomatis" : "Belum diverifikasi"}</span></div><h3>${esc(lead.name)}</h3><p>Petunjuk: ${esc(lead.claim)}</p>${lead.check ? `<p class="method-label">Hasil cek</p><p>${esc(lead.check)}</p>` : ""}${lead.related && names.has(lead.related) ? `<p><a href="#${esc(lead.related)}">Lihat proyek terverifikasi: ${esc(names.get(lead.related))} ↓</a></p>` : ""}<p class="method-sources">${lead.links.map((link) => `<a href="${esc(safeUrl(link.url))}" ${external}>${esc(link.label)} ↗</a>`).join("")}${contactLink(lead.contactUrl, "")}</p>${lead.links.some((link) => link.url.includes("instagram.com")) ? "<small>Buka tautan Instagram saat masuk ke akun Instagram untuk memeriksa sendiri.</small>" : ""}</article>`,
    )
    .join("");
}

function renderSaleAds(research: ResearchData): void {
  const sale = research.saleAds;
  if (!sale?.ads.length) return;
  if (value("catalog-offer") !== "all") {
    $("iklan-dijual").hidden = true;
    $("sale-ad-list").replaceChildren();
    return;
  }
  $("iklan-dijual").hidden = false;
  $("sale-ads-intro").textContent =
    `${sale.note} Dicek ${checkedDate(sale.checkedAt)}.`;
  const [low, high] = budgetBounds(
    value("sale-budget-min"),
    value("sale-budget-max"),
  );
  const list = sale.ads
    .filter(
      (ad) =>
        inArea(ad.area) &&
        withinBudget({ min: ad.price.amount, max: null }, low, high),
    )
    .sort((a, b) => a.price.amount - b.price.amount);
  const size = (ad: ResearchSaleAd) =>
    [
      ad.landM2 ? `LT ${ad.landM2} m²` : "",
      ad.buildingM2 ? `LB ${ad.buildingM2} m²` : "",
      ad.bedrooms ? `${ad.bedrooms} kamar` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  $("sale-ad-count").textContent = `${list.length} iklan dijual`;
  $("sale-ad-list").innerHTML = list.length
    ? list
        .map(
          (ad) =>
            `<article class="research-card card-${ad.category === "rumah" ? "house-sale" : "land"}" data-testid="sale-ad-card" id="${esc(ad.id)}"><div class="research-card-top"><span class="card-area"><i class="area-dot area-${esc(ad.area.toLowerCase())}"></i>${esc(ad.area)} <span>· ${esc(ad.locationText)}</span></span><span class="verdict verdict-${ad.verdict}">${ad.verdict === "confirmed" ? "Terverifikasi" : "Sebagian terverifikasi"}</span></div><span class="type-badge type-${ad.category === "rumah" ? "house-sale" : "land"}">${ad.category === "rumah" ? "Rumah dijual" : "Kavling dijual"}</span><h3>${esc(ad.title)}</h3><p class="research-meta">${ad.category === "kavling" ? "Kavling" : "Rumah"}${ad.projectOrCluster ? ` · ${esc(ad.projectOrCluster)}` : ""}${size(ad) ? ` · ${esc(size(ad))}` : ""}</p><div class="research-price"><strong>${esc(money(ad.price.amount))}</strong><span>${esc(ad.sourcePortal)}${ad.postedOrUpdated ? ` · terdaftar ${esc(checkedDate(ad.postedOrUpdated))}` : ""}</span></div><blockquote class="research-quote">“${esc(ad.price.quote)}” <a href="${esc(safeUrl(ad.price.url))}" ${external}>sumber harga ↗</a></blockquote>${ad.nearMosque ? `<p class="research-claim">Menurut iklan, dekat ${esc(ad.nearMosque.name)}: “${esc(ad.nearMosque.quote)}” <a href="${esc(safeUrl(ad.nearMosque.url))}" ${external}>↗</a></p>` : ""}${ad.evidence.length ? `<div class="research-plus"><strong>Poin keluarga muslim</strong><ul>${ad.evidence.map((e) => `<li>“${esc(e.quote)}” <a href="${esc(safeUrl(e.url))}" ${external}>↗</a></li>`).join("")}</ul></div>` : ""}${ad.note ? `<p class="research-note">${esc(ad.note)}</p>` : ""}<div class="research-actions"><a class="button" href="${esc(safeUrl(ad.listingUrl))}" ${external}>Buka iklan ↗</a></div><p class="research-checked">Dicek ${esc(checkedDate(ad.lastChecked))} · lokasi sampai tingkat kawasan; konfirmasi langsung lewat portal.</p></article>`,
        )
        .join("")
    : '<p class="research-note" data-testid="sale-ad-empty">Belum ada iklan yang cocok dengan daerah dan budget ini.</p>';
  for (const id of ["sale-budget-min", "sale-budget-max"])
    $(id).onchange = () => renderSaleAds(research);
}

function rentalHighlights(rental: ResearchRental): string {
  const highlights = rental.areaHighlights ?? [];
  if (!highlights.length) return "";
  return `<div class="research-plus" data-testid="rental-highlights"><strong>Tempat untuk ditelusuri</strong><ul>${highlights.map((item) => `<li><strong>${esc(item.name)}</strong> <span class="plus-kind">${esc(item.kind)}</span><small>${esc(item.description)} <a href="${esc(safeUrl(item.url))}" ${external}>sumber ↗</a></small><small>${esc(item.relation)} <a href="${esc(safeUrl(item.relationUrl))}" ${external}>sumber lokasi ↗</a></small></li>`).join("")}</ul></div>`;
}

function renderRentals(research: ResearchData): void {
  const rentals = research.rentals;
  if (!rentals?.rentals.length) return;
  if (value("catalog-offer") === "developer") {
    $("sewa").hidden = true;
    $("rental-list").replaceChildren();
    return;
  }
  const [low, high] = budgetBounds(
    value("rental-budget-min"),
    value("rental-budget-max"),
  );
  const query = value("rental-search").trim().toLocaleLowerCase("id-ID");
  const type = value("rental-type");
  $("sewa").hidden = false;
  $("rental-type-control").hidden = value("catalog-offer") === "rental-house";
  $("rentals-intro").textContent =
    `${rentals.note} Dicek ${checkedDate(rentals.checkedAt)}.`;
  const areas = [
    "Semua",
    ...AREAS.filter((a) => rentals.rentals.some((r) => r.area === a)),
  ];
  $("rental-areas").innerHTML = areas
    .map(
      (a) =>
        `<button class="chip ${a === selectedArea ? "selected" : ""}" data-rental-area="${esc(a)}" aria-pressed="${a === selectedArea}">${esc(a)}</button>`,
    )
    .join("");
  const list = rentals.rentals
    .filter(
      (r) =>
        rentalInCatalogue(r) &&
        (!type ||
          (type === "house" ? isHouseRental(r) : r.kind === "Apartemen")) &&
        (!query ||
          [
            r.title,
            r.locationText,
            r.buildingOrCluster ?? "",
            ...r.evidence.map((e) => e.quote),
            ...r.nearStationsClaim.map((c) => `${c.station} ${c.quote}`),
            ...(r.areaHighlights ?? []).map(
              (h) => `${h.name} ${h.description} ${h.relation}`,
            ),
          ]
            .join(" ")
            .toLocaleLowerCase("id-ID")
            .includes(query)) &&
        withinBudget({ min: monthlyRent(r), max: null }, low, high),
    )
    .sort((a, b) => monthlyRent(a) - monthlyRent(b));
  $("rental-count").textContent = `${list.length} sewa`;
  $("rental-list").innerHTML = list
    .map(
      (r) =>
        `<article class="research-card card-${r.kind === "Apartemen" ? "apartment" : "rental"}" data-testid="rental-card" id="${esc(r.id)}"><div class="research-card-top"><span class="card-area"><i class="area-dot area-${esc(r.area.toLowerCase())}"></i>${esc(r.area)} <span>· ${esc(r.locationText)}</span></span><span class="verdict verdict-${r.verdict}">${r.verdict === "confirmed" ? "Terverifikasi" : "Sebagian terverifikasi"}</span></div><span class="type-badge type-${r.kind === "Apartemen" ? "apartment" : "rental"}">${esc(RENTAL_LABELS[r.rentalType])}</span><h3>${esc(r.title)}</h3><p class="research-meta">${esc(RENTAL_LABELS[r.rentalType])}${r.buildingOrCluster ? ` · ${esc(r.buildingOrCluster)}` : ""}${r.bedrooms ? ` · ${r.bedrooms} kamar` : ""}${r.sizeM2 ? ` · ${r.sizeM2} m²` : ""}</p><div class="research-price"><strong>${esc(rentText(r))}</strong><span>${esc(r.sourcePortal)}${r.postedOrUpdated ? ` · tanggal iklan ${esc(checkedDate(r.postedOrUpdated))}` : ""}</span></div><blockquote class="research-quote">“${esc(r.rent.quote)}” <a href="${esc(safeUrl(r.rent.url))}" ${external}>sumber harga ↗</a></blockquote><div class="research-plus"><strong>Keterangan dari sumber</strong><ul>${r.evidence.map((e) => `<li>“${esc(e.quote)}” <a href="${esc(safeUrl(e.url))}" ${external}>↗</a></li>`).join("")}</ul></div>${r.nearStationsClaim.length ? `<p class="research-claim">Klaim dekat stasiun: ${r.nearStationsClaim.map((c) => `“${esc(c.quote)}” <a href="${esc(safeUrl(c.url))}" ${external}>sumber ↗</a>`).join("; ")}</p>` : ""}${rentalHighlights(r)}${r.note ? `<p class="research-note">${esc(r.note)}</p>` : ""}${r.social.length ? `<p class="research-social">Media sosial: ${socialLinks(r.social)}</p>` : ""}<div class="research-actions"><a class="button" href="${esc(safeUrl(r.listingUrl))}" ${external}>Buka listing ↗</a></div><p class="research-checked">Dicek ${esc(checkedDate(r.lastChecked))} · lokasi sampai tingkat kawasan; konfirmasi langsung ke pemilik lewat portal.</p></article>`,
    )
    .join("");
  if (!list.length)
    $("rental-list").innerHTML =
      '<p class="research-note" data-testid="rental-empty">Belum ada sewa yang cocok dengan filter ini.</p>';
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-rental-area]",
  ))
    button.onclick = () =>
      setCatalogueArea(button.dataset.rentalArea ?? "Semua");
  for (const id of ["rental-budget-min", "rental-budget-max", "rental-type"])
    $(id).onchange = () => renderRentals(research);
  $("rental-search").oninput = () => renderRentals(research);
}

function renderPlanned(research: ResearchData): void {
  const planned = research.planned;
  if (!planned?.lines.length) return;
  $("rencana").hidden = false;
  $("planned-intro").textContent =
    `${planned.note ?? ""} Dicek ${checkedDate(planned.checkedAt)}. Proyek dekat stasiun rencana ikut tampil hanya bila segmennya ${planned.qualifyingStatuses.map((status) => STATION_STATUS_LABELS[status].toLocaleLowerCase("id-ID")).join(", ")}; target operasi adalah kutipan sumber, bukan kepastian.`.trim();
  $("planned-list").innerHTML = planned.lines
    .map((line) => {
      const stations = planned.stations.filter(
        (station) => station.line === line.id,
      );
      return `<article class="method-card planned-line" id="rencana-${esc(line.id)}" data-testid="planned-line"><div class="method-top"><span class="mode mode-${esc(line.mode.toLowerCase())}">${esc(line.mode)}</span><span class="verdict ${line.status === "under-construction" || line.status === "partially-operating" ? "verdict-confirmed" : "verdict-partial"}">${esc(STATION_STATUS_LABELS[line.status])}</span></div><h3>${esc(line.name)}</h3><p>${esc(line.segment)}${line.operator ? ` · ${esc(line.operator)}` : ""}</p>${line.statusQuote ? `<blockquote class="research-quote">“${esc(line.statusQuote)}”</blockquote>` : ""}${line.targetOpening ? `<p class="method-label">Target menurut sumber</p><p>${esc(line.targetOpening)}</p>` : ""}${line.note ? `<p>${esc(line.note)}</p>` : ""}${stations.length ? `<p class="method-label">Stasiun dengan titik (${stations.length})</p><ul>${stations.map((station) => `<li>${esc(station.name)} <small>· ${esc(STATION_STATUS_LABELS[station.status])} · titik ${esc(station.precision)}</small></li>`).join("")}</ul>` : ""}<p class="method-sources">${line.sources.map((source) => `<a href="${esc(safeUrl(source.url))}" ${external}>${esc(source.publisher)}: ${esc(source.title)}${source.pageDate ? ` (${esc(checkedDate(source.pageDate))})` : ""} ↗</a>`).join("")}</p>${line.statusAsOf ? `<small>Status per ${esc(checkedDate(line.statusAsOf))}</small>` : ""}</article>`;
    })
    .join("");
}

async function doLogin(): Promise<void> {
  $<HTMLButtonElement>("account-button").disabled = true;
  try {
    await login();
  } catch (error) {
    toast(loginErrorMessage(error));
  } finally {
    $<HTMLButtonElement>("account-button").disabled = false;
  }
}

async function save(
  property: ResearchProperty,
  button: HTMLButtonElement,
  target: "listing" | "pin",
): Promise<void> {
  const entry =
    target === "pin" ? researchToPin(property) : researchToListing(property);
  if (!entry) return;
  if (!getUser()) {
    await doLogin();
    if (!getUser()) return;
  }
  button.disabled = true;
  try {
    await privateAPI(target === "pin" ? "/api/pins" : "/api/listings", {
      method: "POST",
      body: JSON.stringify(entry),
    });
    toast(
      `${property.name} disimpan ${target === "pin" ? "sebagai pin pribadi" : "ke Listingku"}, lengkap dengan tautan sumber dan tanggal cek.`,
    );
  } catch (error) {
    toast(error instanceof Error ? error.message : "Listing belum tersimpan.");
  } finally {
    button.disabled = false;
  }
}

for (const id of [
  "research-mode",
  "research-station-scope",
  "research-distance",
  "research-type",
  "research-budget-min",
  "research-budget-max",
  "research-verdict",
  "research-plus",
  "research-sort",
])
  $(id).onchange = render;
$("research-search").oninput = render;
$("catalog-area").onchange = () => setCatalogueArea(value("catalog-area"));
$("catalog-offer").onchange = () => {
  $<HTMLSelectElement>("rental-type").value = "";
  renderCatalogue();
};
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-area]",
))
  button.onclick = () => setCatalogueArea(button.dataset.area ?? "Semua");
$("account-button").onclick = async () => {
  if (getUser()) {
    await logout();
    toast("Kamu sudah keluar.");
  } else await doLogin();
};

async function start(): Promise<void> {
  try {
    data = await loadResearch();
  } catch (error) {
    $("research-count").textContent = "Data riset belum tersedia";
    toast(error instanceof Error ? error.message : "Data riset belum termuat.");
    return;
  }
  renderStatic(data);
  renderCatalogue();
  highlight();
}

function highlight(): void {
  let target: string;
  try {
    target = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  for (const element of document.querySelectorAll(".research-card.highlight"))
    element.classList.remove("highlight");
  const element = target ? document.getElementById(target) : null;
  if (!element?.classList.contains("research-card")) return;
  element.classList.add("highlight");
  element.scrollIntoView({ block: "start" });
}
addEventListener("hashchange", highlight);
void start();
void fetch("/api/config")
  .then((response) => {
    if (!response.ok) throw new Error();
    return response.json() as Promise<AppConfig>;
  })
  .then((config) =>
    initializeAuth(config, (user) => {
      $("account-label").textContent = user
        ? `${user.displayName?.split(" ")[0] || "Akun"} · Keluar`
        : "Masuk dengan Google";
    }),
  )
  .catch(() => undefined);
