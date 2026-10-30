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
  checkedDate,
  distanceText,
  loadResearch,
  nearestRail,
  priceRange,
  type RailMode,
  type ResearchData,
  type ResearchProperty,
  researchToListing,
  researchToPin,
  SOURCE_LABELS,
  STATUS_LABELS,
  safeUrl,
} from "./research-data.ts";
import { type AppConfig, AREAS } from "./types.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;
const external = 'target="_blank" rel="noopener noreferrer"';

$("app").innerHTML = `
  <a class="skip-link" href="#research-results">Langsung ke daftar proyek</a>
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
      <dl class="research-stats" id="research-stats"></dl>
      <div class="research-links"><a class="button primary" href="/?koleksi=riset">${icon("pin")} Lihat semua di peta</a><a class="button" href="#metode">${icon("info")} Cara riset ini dibuat</a></div>
    </section>
    <section class="research-filters" aria-label="Filter riset properti">
      <div class="search-box">${icon("search")}<input id="research-search" type="search" aria-label="Cari proyek, developer, lokasi, atau stasiun" placeholder="Proyek, developer, lokasi, atau stasiun…" autocomplete="off"/></div>
      <div class="area-chips" aria-label="Filter wilayah"><button class="chip selected" data-area="Semua" aria-pressed="true">Semua</button>${AREAS.map((area) => `<button class="chip" data-area="${area}" aria-pressed="false">${area}</button>`).join("")}</div>
      <div class="research-selects">
        <label>Moda<select id="research-mode"><option value="">KRL, MRT & LRT</option><option>KRL</option><option>MRT</option><option>LRT</option></select></label>
        <label>Jarak garis lurus<select id="research-distance"><option value="3">≤ 3 km</option><option value="2">≤ 2 km</option><option value="1">≤ 1 km</option></select></label>
        <label>Jenis<select id="research-type"><option value="">Semua jenis</option><option>Rumah</option><option>Apartemen</option></select></label>
        <label>Harga mulai<select id="research-budget"><option value="0">Semua harga</option><option value="500000000">≤ Rp 500 jt</option><option value="1000000000">≤ Rp 1 M</option><option value="2000000000">≤ Rp 2 M</option></select></label>
        <label>Bukti<select id="research-verdict"><option value="">Semua bukti</option><option value="confirmed">Terverifikasi penuh</option></select></label>
        <label>Urutkan<select id="research-sort"><option value="price">Harga terendah</option><option value="distance">Terdekat stasiun</option><option value="name">Nama A–Z</option></select></label>
      </div>
    </section>
    <section id="research-results" class="research-results" tabindex="-1" aria-label="Daftar proyek">
      <div class="results-toolbar"><strong id="research-count">Memuat data riset…</strong><span id="research-scope"></span></div>
      <div id="research-list" class="research-list" aria-live="polite"></div>
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

function filtered(): ResearchProperty[] {
  if (!data) return [];
  const query = value("research-search").trim().toLocaleLowerCase("id-ID");
  const mode = (value("research-mode") || undefined) as RailMode | undefined;
  const maxKm = Number(value("research-distance"));
  const type = value("research-type");
  const budget = Number(value("research-budget"));
  const verdict = value("research-verdict");
  const list = data.properties.filter((property) => {
    const station = nearestRail(property, mode);
    const text = [
      property.name,
      property.developer ?? "",
      property.locationText,
      property.region ?? "",
      ...property.nearest.map((item) => `${item.mode} ${item.name}`),
    ]
      .join(" ")
      .toLocaleLowerCase("id-ID");
    return (
      station !== undefined &&
      station.km <= maxKm &&
      (selectedArea === "Semua" || property.area === selectedArea) &&
      (!query || text.includes(query)) &&
      (!type || property.kind === type) &&
      (!budget || property.price.min <= budget) &&
      (!verdict || property.verdict === verdict)
    );
  });
  const sort = value("research-sort");
  const km = (property: ResearchProperty) =>
    nearestRail(property, mode)?.km ?? Infinity;
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
        `<li><span class="source-kind kind-${source.kind}">${SOURCE_LABELS[source.kind] ?? source.kind}</span><a href="${esc(safeUrl(source.url))}" ${external}>${esc(source.title)} ↗</a><small>${source.fetched ? "Dibuka saat pengecekan" : "Tautan dari hasil pencarian, isi belum dibuka"}${source.pageDate ? ` · tanggal halaman ${esc(checkedDate(source.pageDate))}` : ""}${source.supports.length ? ` · mendukung ${esc(source.supports.join(", "))}` : ""}${source.note ? ` · ${esc(source.note)}` : ""}</small></li>`,
    )
    .join("")}</ul></details>`;
}

function card(property: ResearchProperty): string {
  const mappable = researchToListing(property) !== undefined;
  const precision = property.coordinate
    ? `${property.coordinate.precision} (${property.coordinate.method})`
    : "lokasi";
  return `<article class="research-card" id="${esc(property.id)}" data-testid="research-card">
    <div class="research-card-top"><span class="card-area"><i class="area-dot area-${esc((property.area ?? "luar").toLowerCase())}"></i>${esc(property.area ?? "Di luar 14 wilayah")} <span>· ${esc(property.locationText)}</span></span><span class="verdict verdict-${property.verdict}">${property.verdict === "confirmed" ? "Terverifikasi" : "Sebagian terverifikasi"}</span></div>
    <h3>${esc(property.name)}</h3>
    <p class="research-meta">${esc(property.developer ?? "Developer belum tercatat")} · ${esc(property.kind)}${property.subsidized ? " subsidi" : ""} · ${STATUS_LABELS[property.status] ?? esc(property.status)}</p>
    <div class="research-price"><strong>${priceRange(property)}</strong><span>${esc(property.price.basis)}</span></div>
    <blockquote class="research-quote">“${esc(property.price.quote)}” <a href="${esc(safeUrl(property.price.url))}" ${external}>sumber harga ↗</a>${property.price.pageDate ? ` <small>tanggal halaman ${esc(checkedDate(property.price.pageDate))}</small>` : ""}</blockquote>
    <ul class="research-stations" aria-label="Stasiun terdekat">${property.nearest
      .map(
        (station) =>
          `<li><span class="mode mode-${esc(station.mode.toLowerCase())}">${esc(station.mode)}</span>${esc(station.name)}<em>${distanceText(station.km)}</em></li>`,
      )
      .join("")}</ul>
    <p class="research-note">Jarak garis lurus dari titik ${esc(precision)} ke titik stasiun OSM, bukan rute berjalan.</p>
    ${property.transitClaim ? `<p class="research-claim">Klaim sumber: “${esc(property.transitClaim.quote)}” <a href="${esc(safeUrl(property.transitClaim.url))}" ${external}>↗</a></p>` : ""}
    ${units(property)}
    ${sources(property)}
    <div class="research-actions">
      ${mappable ? `<a class="button" href="/?riset=${encodeURIComponent(property.id)}">${icon("pin")} Lihat di peta</a><button class="button primary" type="button" data-save="${esc(property.id)}">${icon("bookmark")} Simpan ke Listingku</button>` : '<span class="button" aria-disabled="true">Lokasi belum dipetakan</span>'}
      ${researchToPin(property) ? `<button class="button" type="button" data-save-pin="${esc(property.id)}">${icon("pin")} Simpan sebagai pin</button>` : ""}
      ${property.officialUrl ? `<a class="button" href="${esc(safeUrl(property.officialUrl))}" ${external}>Situs resmi ↗</a>` : ""}
    </div>
    <p class="research-checked">Dicek ${esc(checkedDate(property.lastChecked))}</p>
  </article>`;
}

function render(): void {
  if (!data) return;
  const list = filtered();
  $("research-count").textContent = `${list.length} proyek`;
  $("research-scope").textContent =
    ` dari ${data.properties.length} · ${selectedArea === "Semua" ? "Jabodetabek" : selectedArea}`;
  $("research-list").innerHTML = list.length
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
    <div><dt>Proyek</dt><dd>${research.properties.length}</dd></div>
    <div><dt>Terverifikasi penuh</dt><dd>${confirmed}</dd></div>
    <div><dt>Harga mulai</dt><dd>${prices.length ? `${money(Math.min(...prices))} – ${money(Math.max(...prices))}` : "–"}</dd></div>
    <div><dt>Cek terakhir</dt><dd>${esc(checkedDate(research.checkedAt))}</dd></div>
    <div><dt>Radius</dt><dd>≤ ${research.maxDistanceKm} km garis lurus</dd></div>`;
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
  }${research.gaps.length ? `<ul class="coverage-gaps">${research.gaps.map((gap) => `<li>${esc(gap)}</li>`).join("")}</ul>` : ""}${research.excluded.length ? `<details class="coverage-excluded"><summary>Ditemukan tetapi belum masuk daftar (${research.excluded.length})</summary><ul>${research.excluded.map((item) => `<li><strong>${esc(item.name)}</strong>: ${esc(item.reason)}</li>`).join("")}</ul></details>` : ""}`;
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
  "research-distance",
  "research-type",
  "research-budget",
  "research-verdict",
  "research-sort",
])
  $(id).onchange = render;
$("research-search").oninput = render;
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-area]",
))
  button.onclick = () => {
    selectedArea = button.dataset.area ?? "Semua";
    for (const chip of document.querySelectorAll<HTMLButtonElement>(
      "[data-area]",
    )) {
      chip.classList.toggle("selected", chip === button);
      chip.setAttribute("aria-pressed", String(chip === button));
    }
    render();
  };
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
  render();
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
