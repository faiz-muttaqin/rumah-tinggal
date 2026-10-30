import "@fontsource-variable/plus-jakarta-sans";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import {
  getUser,
  initializeAuth,
  login,
  loginErrorMessage,
  logout,
  privateAPI,
} from "./auth.ts";
import { demoListings } from "./demo.ts";
import { distanceKm, escapeHTML as esc, money, nearestStation } from "./geo.ts";
import { icon } from "./icons.ts";
import { HousingMap, type TransitMode } from "./map.ts";
import {
  googleMapsDirections,
  googleMapsLocation,
  googleMapsRoute,
  googleMapsWalkToStation,
} from "./maps-links.ts";
import { guessCategory, PIN_STYLES, pinIcon } from "./pins.ts";
import {
  checkedDate,
  distanceText,
  isOperating,
  loadResearch,
  nearestRail,
  type PlannedContext,
  type PopulationContext,
  plusSummary,
  populationText,
  priceRange,
  type ResearchProperty,
  researchToListing,
  researchToPin,
  SOCIAL_LABELS,
  STATION_STATUS_LABELS,
  safeUrl,
  stationLabel,
} from "./research-data.ts";
import {
  type AppConfig,
  AREAS,
  type Listing,
  PIN_CATEGORIES,
  type Pin,
  type Place,
  type Station,
} from "./types.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

$("app").innerHTML = `
  <a class="skip-link" href="#results">Langsung ke daftar hunian</a>
  <header class="masthead">
    <a class="brand" href="/" aria-label="Rumah Tinggal, beranda"><span class="brand-mark">${icon("home")}</span><span>rumah<span class="brand-light">tinggal</span><span class="brand-dot">.</span></span></a>
    <nav class="main-nav" aria-label="Navigasi utama"><a class="active" href="#explorer">Jelajahi peta</a><a href="/riset">${icon("research")} Riset properti</a><button id="nav-saved">${icon("bookmark")} Listingku</button></nav>
    <div class="header-right"><span class="coverage">Jabodetabek <span class="live-dot"></span></span><button class="button login-button" id="account-button"><span class="google-g" aria-hidden="true">G</span><span id="account-label">Masuk dengan Google</span></button></div>
  </header>
  <main id="explorer" class="explorer">
    <aside class="sidebar" aria-label="Pencarian dan daftar hunian">
      <div class="sidebar-top">
        <div class="eyebrow"><span class="tiny-line"></span> RUANG UNTUK PULANG</div>
        <h1>Rumah yang pas.<br/><span>Hidup lebih dekat.</span></h1>
        <p class="intro">Kenali wilayah dan akses transportasinya,<br class="desktop-break"/> lalu temukan tempatmu bertumbuh.</p>
        <div class="search-box">${icon("search")}<input id="search" aria-label="Cari wilayah, hunian, stasiun, atau tempat" type="search" placeholder="Wilayah, hunian, stasiun, atau tempat…" autocomplete="off"/><kbd>/</kbd></div>
        <div id="station-results" class="station-results"></div><div id="place-results" class="station-results place-results" aria-live="polite"></div>
        <div class="area-chips" aria-label="Filter wilayah"><button class="chip selected" data-area="Semua" aria-pressed="true">Semua</button>${AREAS.map((area) => `<button class="chip" data-area="${area}" aria-pressed="false">${area}</button>`).join("")}</div>
        <div class="filter-grid"><label>Anggaran beli<select id="budget" aria-label="Anggaran maksimum"><option value="0">Semua anggaran</option><option value="500000000">Hingga Rp 500 juta</option><option value="750000000">Hingga Rp 750 juta</option><option value="1000000000">Hingga Rp 1 miliar</option></select></label><label>Jenis hunian<select id="housing-type" aria-label="Jenis hunian"><option value="Semua">Semua jenis</option><option>Rumah</option><option>Apartemen</option><option>Kos</option></select></label></div>
        <div class="commute-filter">${icon("train")}<label for="station-distance">Jarak ke stasiun KRL</label><select id="station-distance" aria-label="Jarak maksimum ke stasiun KRL"><option value="0">Bebas</option><option value="1">≤ 1 km</option><option value="3">≤ 3 km</option><option value="5">≤ 5 km</option></select></div>
        <div class="data-tabs" aria-label="Koleksi hunian"><button id="demo-tab" class="active" aria-pressed="true">Contoh hunian <span>8</span></button><button id="private-tab" aria-pressed="false">${icon("bookmark")} Listingku</button><button id="pins-tab" aria-pressed="false">${icon("pin")} Pin tempat</button><button id="research-tab" aria-pressed="false">${icon("research")} Riset <span id="research-count">…</span></button></div>
      </div>
      <section id="results" class="results" tabindex="-1" aria-label="Hasil pencarian">
        <div class="results-toolbar"><div><strong id="result-count">8 hunian</strong><span id="result-scope"> di Jabodetabek</span></div><select id="sort" aria-label="Urutkan hunian"><option value="recommended">Rekomendasi</option><option value="price">Harga terendah</option><option value="station">Terdekat KRL</option></select></div>
        <div class="example-note" id="example-note"><span class="sample-dot"></span> Data contoh · harga & lokasi ilustratif</div><div class="example-note research-note" id="research-note" hidden><span class="sample-dot"></span> Data nyata · harga dari sumber per tanggal cek · <a href="/riset">bukti lengkap ↗</a></div>
        <div id="listing-list" class="listing-list" aria-live="polite"></div>
      </section>
      <footer class="sidebar-footer"><span>Pilihan baik dimulai dari mengenal tempat.</span><button id="sources-button">${icon("info")} Sumber data</button></footer>
    </aside>
    <section class="map-panel" aria-label="Peta hunian Jabodetabek">
      <div id="map" class="map" aria-label="Peta interaktif, gunakan tombol panah untuk menggeser"></div>
      <div class="map-heading"><span class="map-heading-icon">${icon("pin")}</span><div><strong>Jabodetabek</strong><span>KRL · MRT · LRT · TransJakarta</span></div><button id="map-reset" class="icon-button" aria-label="Tampilkan seluruh Jabodetabek">${icon("target")}</button></div>
      <div id="map-status" class="map-status" role="status">Peta dasar belum termuat. Wilayah dan KRL tetap bisa dijelajahi.</div>
      <div class="map-tools" role="group" aria-label="Lapisan peta">
        <label class="layer-control">${icon("train")} Jalur KRL <input id="rail-toggle" aria-label="Jalur KRL" type="checkbox" checked/><span class="switch" aria-hidden="true"></span></label>
        <label class="layer-control">${icon("train")} MRT <input id="mrt-toggle" aria-label="Jalur MRT" type="checkbox" checked/><span class="switch" aria-hidden="true"></span></label>
        <label class="layer-control" title="LRT Jakarta dan LRT Jabodebek">${icon("train")} LRT <input id="lrt-toggle" aria-label="Jalur LRT" type="checkbox" checked/><span class="switch" aria-hidden="true"></span></label>
        <label class="layer-control" title="TransJakarta · 14 koridor utama BRT">${icon("bus")} <span class="transjakarta-label">TransJakarta</span><input id="tj-toggle" aria-label="Jalur TransJakarta" type="checkbox"/><span class="switch" aria-hidden="true"></span></label>
        <label class="layer-control" title="Masjid, sekolah, dan TK sekitar · tampil saat peta diperbesar">${icon("pin")} <span class="community-label">Masjid & sekolah</span><input id="community-toggle" aria-label="Masjid dan sekolah sekitar" type="checkbox" checked/><span class="switch" aria-hidden="true"></span></label>
        <label class="layer-control">${icon("home")} Bangunan <input id="buildings-toggle" aria-label="Bangunan pada peta" type="checkbox"/><span class="switch" aria-hidden="true"></span></label>
        <label class="layer-control">${icon("pin")} Hunian <input id="listings-toggle" aria-label="Marker dan detail hunian" type="checkbox" checked/><span class="switch" aria-hidden="true"></span></label>
        <span class="map-road-note">Jalan selalu tampil · bangunan, masjid & sekolah saat diperbesar</span>
        <div class="add-actions"><button class="add-floating add-pin" id="add-pin">${icon("pin")} Tambah pin</button><button class="add-floating" id="add-listing">${icon("plus")} Tambah listing</button></div>
      </div>
      <details class="rail-legend" id="transit-legend"><summary>Legenda transportasi</summary><div id="rail-legend"><span data-legend-mode="KRL"><i style="--line:#DC2626"></i>KRL Bogor / Nambo</span><span data-legend-mode="KRL"><i style="--line:#2563EB"></i>KRL Cikarang</span><span data-legend-mode="KRL"><i style="--line:#16A34A"></i>KRL Rangkasbitung</span><span data-legend-mode="KRL"><i style="--line:#92400E"></i>KRL Tangerang</span><span data-legend-mode="KRL"><i style="--line:#DB2777"></i>KRL Tj. Priok</span><span data-legend-mode="MRT"><i style="--line:#CE0037"></i>MRT Utara–Selatan</span><span data-legend-mode="LRT"><i style="--line:#f16227"></i>LRT Jakarta</span><span data-legend-mode="LRT"><i style="--line:#20409A"></i>LRT Cibubur</span><span data-legend-mode="LRT"><i style="--line:#0E6938"></i>LRT Bekasi</span><span data-legend-mode="TransJakarta" hidden><i style="--line:#2477a8"></i>TransJakarta · warna per koridor</span></div></details>
      <div class="map-bottom-note">${icon("info")} Jarak stasiun dihitung garis lurus, bukan rute berjalan kaki.</div>
      <div id="detail-card" class="detail-card" hidden></div>
    </section>
  </main>
  <div class="mobile-view"><button id="mobile-map">${icon("pin")} Peta</button><button id="mobile-list" class="active">${icon("home")} Daftar</button></div>
  <dialog id="sources-dialog" aria-labelledby="sources-title"><div class="dialog-header"><span class="eyebrow">TRANSPARANSI DATA</span><button class="icon-button" data-close="sources-dialog" aria-label="Tutup sumber data">${icon("close")}</button></div><h2 id="sources-title">Sumber & catatan data</h2><div class="source-block"><h3>Wilayah Jabodetabek</h3><p>14 batas kabupaten/kota dari geometri Nafkah / HDX COD-AB, disederhanakan untuk gambaran wilayah. Batas ini tidak cukup rinci untuk memastikan alamat atau batas bidang tanah. Kepulauan Seribu sangat disederhanakan pada sumber.</p><a href="https://gitlab.com/adenaufal/nafkah" target="_blank" rel="noopener noreferrer">Nafkah · Ade Naufal · CC BY 4.0 ↗</a></div><div class="source-block"><h3>KRL, MRT, LRT & TransJakarta</h3><p>Snapshot geografis OpenStreetMap, 29 Oktober 2026: 80 titik KRL, 13 MRT, 29 LRT, serta 251 titik halte pada 14 koridor utama BRT TransJakarta. LRT mencakup LRT Jakarta dan LRT Jabodebek. TransJakarta belum mencakup pengumpan/Mikrotrans dan awalnya disembunyikan.</p><p>Geometri mengikuti rel/jalan yang dipetakan; titik stasiun/halte bukan pintu masuk terverifikasi. Data ini bukan jadwal, tarif, status operasi, atau waktu tempuh aktual. Periksa perjalanan ke operator.</p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors · ODbL ↗</a></div><div class="source-block"><h3>Listing & jarak</h3><p>Semua hunian pada tab Contoh hunian adalah data ilustratif, bukan iklan atau penawaran properti. Listingku berisi data pribadi yang kamu masukkan sendiri. Jarak ke KRL adalah garis lurus ke titik stasiun terdekat, bukan akses pintu masuk atau rute berjalan.</p></div><div class="source-block"><h3>Peta jalan & bangunan</h3><p>Peta vektor OpenFreeMap, skema © OpenMapTiles, data © OpenStreetMap contributors. Bangunan dapat disembunyikan terpisah; jalan tetap tampil. Ikon masjid & sekolah sekitar berasal dari titik POI tile yang sama (zoom 14 ke atas). Cakupan bangunan, masjid, dan sekolah mengikuti data OSM dan tidak membuktikan status operasi.</p><a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap · OpenMapTiles · OpenStreetMap ↗</a></div><div class="source-block"><h3>Riset properti</h3><p>Kandidat proyek nyata di sekitar KRL, MRT, dan LRT. Harga dan status mengikuti sumber bertanggal; bukti yang belum lengkap diberi label sebagian terverifikasi. Nama developer dari sumber publik belum membuktikan kepemilikan unit. Jarak dihitung aplikasi secara garis lurus ke titik stasiun OSM. Bukan iklan atau penawaran; konfirmasi ke developer.</p><a href="/riset#metode">Metode dan bukti lengkap ↗</a></div><div class="source-block"><h3>Pencarian tempat</h3><p>Hasil pencarian tempat berasal dari Photon (komoot) berbasis OpenStreetMap, dibatasi wilayah Jabodetabek. Pin tempat yang kamu simpan hanya dapat dilihat akunmu.</p><a href="https://photon.komoot.io/" target="_blank" rel="noopener noreferrer">Photon · © OpenStreetMap contributors ↗</a></div><p class="fine-print">Peta dasar OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors. Tampilan terinspirasi pola peta Nafkah; implementasi aplikasi dibuat untuk Rumah Tinggal.</p></dialog>
  <dialog id="listing-dialog" aria-labelledby="listing-title"><div class="dialog-header"><span class="eyebrow">KOLEKSI PRIBADIMU</span><button class="icon-button" data-close="listing-dialog" aria-label="Tutup tambah listing">${icon("close")}</button></div><h2 id="listing-title">Tambahkan calon rumah</h2><p class="dialog-intro">Simpan lokasi, harga beli, dan catatan survei. Hanya akunmu yang dapat melihatnya.</p><form id="listing-form"><label>Nama hunian<input name="title" required maxlength="160" placeholder="Contoh: Rumah dekat Stasiun Pondok Ranji"/></label><div class="form-grid"><label>Wilayah<select name="area">${AREAS.map((area) => `<option>${area}</option>`).join("")}</select></label><label>Kecamatan / lingkungan<input name="district" required maxlength="100"/></label><label>Harga beli (Rp)<input name="price" type="number" min="1" max="1000000000000" required/></label><label>Jenis<select name="type"><option>Rumah</option><option>Apartemen</option><option>Kos</option></select></label><label>Kamar tidur<input name="bedrooms" type="number" min="0" max="30" value="2" required/></label><label>Luas tanah / unit (m²)<input name="landArea" type="number" min="1" max="100000" required/></label><label>Latitude<input id="form-lat" name="lat" type="number" step="any" min="-6.85" max="-5.75" required value="-6.3"/></label><label>Longitude<input id="form-lng" name="lng" type="number" step="any" min="106.3" max="107.31" required value="106.8"/></label></div><button type="button" id="pick-map" class="text-button">${icon("pin")} Pilih koordinat di peta</button><label>Tautan sumber (opsional)<input name="sourceUrl" type="url" maxlength="2000" placeholder="https://…"/></label><label>Catatan survei (opsional)<textarea name="notes" maxlength="3000" rows="3" placeholder="Akses jalan, kondisi lingkungan, hal yang perlu dicek…"></textarea></label><p id="form-error" class="form-error" role="alert"></p><button class="button primary wide" type="submit">Simpan ke Listingku ${icon("arrow")}</button></form></dialog>
  <dialog id="pin-dialog" aria-labelledby="pin-title"><div class="dialog-header"><span class="eyebrow">TEMPAT PENTING</span><button class="icon-button" data-close="pin-dialog" aria-label="Tutup tambah pin">${icon("close")}</button></div><h2 id="pin-title">Tandai tempat penting</h2><p class="dialog-intro">Masjid, sekolah, tempat kerja, atau tempat lain yang sering kamu datangi. Hanya akunmu yang dapat melihatnya.</p><form id="pin-form"><label>Nama tempat<input name="name" required maxlength="160" placeholder="Contoh: Masjid Al-Ikhlas"/></label><fieldset class="pin-categories"><legend>Ikon / kategori</legend>${PIN_CATEGORIES.map((category, index) => `<label class="pin-category" style="--pin:${PIN_STYLES[category].color}"><input type="radio" name="category" value="${category}" ${index === 0 ? "checked" : ""}/><span>${pinIcon(category, 18)}</span>${PIN_STYLES[category].label}</label>`).join("")}</fieldset><div class="form-grid"><label>Latitude<input id="pin-lat" name="lat" type="number" step="any" min="-6.85" max="-5.75" required value="-6.3"/></label><label>Longitude<input id="pin-lng" name="lng" type="number" step="any" min="106.3" max="107.31" required value="106.8"/></label></div><button type="button" id="pin-pick-map" class="text-button">${icon("pin")} Pilih titik di peta</button><label>Catatan (opsional)<textarea name="notes" maxlength="2000" rows="2" placeholder="Jam buka, akses jalan, alasan penting…"></textarea></label><p id="pin-error" class="form-error" role="alert"></p><button class="button primary wide" type="submit">Simpan pin ${icon("arrow")}</button></form></dialog>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
`;

let map: HousingMap | undefined;
let stations: Station[] = [];
let transportStops: Station[] = [];
let privateListings: Listing[] = [];
let collection: "demo" | "private" | "pins" | "research" = "demo";
let researchProperties: ResearchProperty[] = [];
let researchPopulation: PopulationContext | null = null;
let researchPlanned: PlannedContext | null = null;
let researchListings: Listing[] = [];
let pins: Pin[] = [];
let selectedArea = "Semua";
let selectedListing: Listing | undefined;
let listingsVisible = true;
let pickingPoint: "listing" | "pin" | undefined;
let toastTimer: ReturnType<typeof setTimeout>;

function toast(message: string): void {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 6000);
}

function filteredListings(): Listing[] {
  const query = $<HTMLInputElement>("search")
    .value.trim()
    .toLocaleLowerCase("id-ID");
  const budget = Number($<HTMLSelectElement>("budget").value);
  const housingType = $<HTMLSelectElement>("housing-type").value;
  const stationDistance = Number(
    $<HTMLSelectElement>("station-distance").value,
  );
  const listings = (
    collection === "demo"
      ? demoListings
      : collection === "research"
        ? researchListings
        : privateListings
  ).filter((listing) => {
    const nearest = nearestStation(listing, stations);
    const text =
      `${listing.title} ${listing.area} ${listing.district} ${nearest?.station.name ?? ""}`.toLocaleLowerCase(
        "id-ID",
      );
    return (
      (selectedArea === "Semua" || selectedArea === listing.area) &&
      (!query || text.includes(query)) &&
      (!budget || listing.price <= budget) &&
      (housingType === "Semua" || housingType === listing.type) &&
      (!stationDistance || (nearest && nearest.distance <= stationDistance))
    );
  });
  const sort = $<HTMLSelectElement>("sort").value;
  if (sort === "price") listings.sort((a, b) => a.price - b.price);
  if (sort === "station")
    listings.sort(
      (a, b) =>
        (nearestStation(a, stations)?.distance ?? Infinity) -
        (nearestStation(b, stations)?.distance ?? Infinity),
    );
  return listings;
}

function render(): void {
  const listings = filteredListings();
  $("result-count").textContent = `${listings.length} hunian`;
  $("result-scope").textContent =
    ` di ${selectedArea === "Semua" ? "Jabodetabek" : selectedArea}`;
  $("example-note").hidden = collection !== "demo";
  $("research-note").hidden = collection !== "research";
  $("research-tab").classList.toggle("active", collection === "research");
  $("research-tab").setAttribute(
    "aria-pressed",
    String(collection === "research"),
  );
  $("demo-tab").classList.toggle("active", collection === "demo");
  $("private-tab").classList.toggle("active", collection === "private");
  $("demo-tab").setAttribute("aria-pressed", String(collection === "demo"));
  $("private-tab").setAttribute(
    "aria-pressed",
    String(collection === "private"),
  );
  $("pins-tab").classList.toggle("active", collection === "pins");
  $("pins-tab").setAttribute("aria-pressed", String(collection === "pins"));
  $("sort").hidden = collection === "pins";
  if (collection === "pins") {
    $("result-count").textContent = `${pins.length} pin`;
    $("result-scope").textContent = " tempat penting";
    renderPinList();
  } else if (collection === "private" && !getUser()) {
    $("listing-list").innerHTML =
      `<div class="empty-state"><span class="empty-icon">${icon("bookmark")}</span><h2>Ruang untuk pilihanmu.</h2><p>Masuk dengan Google untuk menyimpan dan memetakan listing pribadi. Koleksimu hanya dapat diakses oleh akunmu.</p><button class="button primary" id="empty-login">Masuk dengan Google ${icon("arrow")}</button></div>`;
    $("empty-login").onclick = doLogin;
  } else if (!listings.length) {
    $("listing-list").innerHTML =
      `<div class="empty-state" data-testid="empty-state"><span class="empty-icon">${icon("search")}</span><h2>${collection === "private" && !privateListings.length ? "Mulai dari satu pilihan." : "Tidak ada hunian yang cocok"}</h2><p>${collection === "private" && !privateListings.length ? "Tambahkan lokasi yang kamu temukan, lalu bandingkan akses wilayah dan KRL-nya." : "Coba perluas wilayah, anggaran, atau jarak ke stasiun."}</p><button class="button" id="empty-action">${collection === "private" && !privateListings.length ? "Tambah listing" : "Reset filter"}</button></div>`;
    $("empty-action").onclick =
      collection === "private" && !privateListings.length
        ? showListingForm
        : resetFilters;
  } else {
    $("listing-list").innerHTML = listings
      .map((listing, index) => {
        const nearest = nearestStation(listing, stations);
        const research = researchFor(listing);
        const rail =
          research &&
          (nearestRail(research) ??
            nearestRail(research, undefined, "planned"));
        return `<button class="listing-card ${selectedListing?.id === listing.id ? "selected" : ""}" data-testid="listing-card" data-listing="${esc(listing.id)}"><span class="card-top"><span class="card-area"><i class="area-dot area-${listing.area.toLowerCase()}"></i>${listing.area} <span>· ${esc(listing.district)}</span></span><span class="card-number">${String(index + 1).padStart(2, "0")}</span></span><span class="card-title">${esc(listing.title)}</span><span class="card-price">${money(listing.price)} <span>${research ? esc(research.price.basis) : `harga beli${collection === "demo" ? " contoh" : ""}`}</span></span><span class="card-specs">${research ? `<span>${listing.type}</span><span>${research.verdict === "confirmed" ? "Terverifikasi" : "Sebagian terverifikasi"}</span><span>dicek ${esc(checkedDate(research.lastChecked))}</span>` : `<span>${listing.type}</span><span>${listing.bedrooms} kamar</span><span>${listing.landArea} m²</span>`}</span><span class="card-commute">${icon("train")}<span>${rail ? `${distanceText(rail.km)} · ${esc(stationLabel(rail))}` : nearest ? `${nearest.distance.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km · ${esc(nearest.station.name)}` : "Data jarak stasiun belum tersedia"}</span><span class="card-arrow">↗</span></span></button>`;
      })
      .join("");
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      "[data-listing]",
    )) {
      button.onclick = () => {
        const listing = listings.find(
          (item) => item.id === button.dataset.listing,
        );
        if (listing) selectListing(listing);
      };
    }
  }
  if (
    selectedListing &&
    !listings.some((listing) => listing.id === selectedListing?.id)
  ) {
    clearSelection();
  }
  void map?.update(
    listingsVisible ? listings : [],
    selectedListing?.id,
    selectListing,
  );
  if (researchPlanned)
    void map?.showPlanned(
      plannedPoints(researchPlanned),
      collection === "research",
    );
}

function plannedPoints(planned: PlannedContext): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: planned.stations.map((station) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [station.lng, station.lat] },
      properties: {
        mode: station.mode,
        label: `${station.mode} ${station.name} (${STATION_STATUS_LABELS[station.status].toLocaleLowerCase("id-ID")})`,
      },
    })),
  };
}

function renderPinList(): void {
  if (!getUser()) {
    $("listing-list").innerHTML =
      `<div class="empty-state"><span class="empty-icon">${icon("pin")}</span><h2>Tandai tempat pentingmu.</h2><p>Masuk dengan Google untuk menyimpan masjid, sekolah, tempat kerja, dan tempat lain sebagai pin di peta.</p><button class="button primary" id="empty-login">Masuk dengan Google ${icon("arrow")}</button></div>`;
    $("empty-login").onclick = doLogin;
    return;
  }
  if (!pins.length) {
    $("listing-list").innerHTML =
      `<div class="empty-state"><span class="empty-icon">${icon("pin")}</span><h2>Belum ada pin.</h2><p>Cari tempat lalu pilih "Simpan sebagai pin", atau tandai titik langsung di peta.</p><button class="button" id="empty-action">Tambah pin</button></div>`;
    $("empty-action").onclick = () => showPinForm();
    return;
  }
  $("listing-list").innerHTML = pins
    .map(
      (pin) =>
        `<button class="pin-card" data-pin="${esc(pin.id)}" style="--pin:${PIN_STYLES[pin.category].color}"><span class="pin-badge">${pinIcon(pin.category)}</span><span class="pin-text"><strong>${esc(pin.name)}</strong><small>${esc(PIN_STYLES[pin.category].label)}${pin.notes ? ` · ${esc(pin.notes)}` : ""}</small></span><span class="card-arrow">↗</span></button>`,
    )
    .join("");
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-pin]",
  ))
    button.onclick = () => {
      const pin = pins.find((item) => item.id === button.dataset.pin);
      if (!pin) return;
      void map?.openPin(pin, pinPopup);
      if (matchMedia("(max-width: 760px)").matches) setMobileView("map");
    };
}

function pinPopup(pin: Pin, close: () => void): HTMLElement {
  const style = PIN_STYLES[pin.category];
  const distance = selectedListing
    ? `<p class="pin-distance">${distanceKm(selectedListing, pin).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km garis lurus dari ${esc(selectedListing.title)}</p>`
    : "";
  const element = document.createElement("div");
  element.className = "pin-popup";
  element.innerHTML = `<span class="pin-popup-label" style="--pin:${style.color}">${pinIcon(pin.category, 13)} ${esc(style.label)}</span><strong>${esc(pin.name)}</strong>${pin.notes ? `<p>${esc(pin.notes)}</p>` : ""}<p>${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}</p>${distance}<a href="${esc(googleMapsLocation(pin))}" target="_blank" rel="noopener noreferrer">Buka Google Maps ↗</a> · <a href="${esc(selectedListing ? googleMapsRoute(selectedListing, pin) : googleMapsDirections(pin))}" target="_blank" rel="noopener noreferrer">${selectedListing ? "Rute dari hunian ↗" : "Rute ↗"}</a><button type="button" class="popup-action danger" data-delete-pin>Hapus pin</button>`;
  element
    .querySelector<HTMLButtonElement>("[data-delete-pin]")
    ?.addEventListener("click", async () => {
      if (!confirm(`Hapus pin "${pin.name}"?`)) return;
      try {
        await privateAPI(`/api/pins/${encodeURIComponent(pin.id)}`, {
          method: "DELETE",
        });
        close();
        toast("Pin sudah dihapus.");
        await loadPins();
      } catch (error) {
        toast(error instanceof Error ? error.message : "Pin belum terhapus.");
      }
    });
  return element;
}

async function loadPins(): Promise<void> {
  const uid = getUser()?.uid;
  if (!uid) return;
  try {
    const result = await privateAPI<{ pins: Pin[] }>("/api/pins");
    if (getUser()?.uid !== uid) return;
    pins = result.pins;
  } catch (error) {
    if (getUser()?.uid !== uid) return;
    pins = [];
    toast(error instanceof Error ? error.message : "Pin belum termuat.");
  }
  void map?.updatePins(pins, pinPopup);
  render();
}

function showPinForm(
  preset?: Partial<Pick<Pin, "name" | "lat" | "lng" | "category" | "notes">>,
): void {
  if (!getUser()) {
    collection = "pins";
    render();
    void doLogin().then(() => {
      if (getUser()) showPinForm(preset);
    });
    return;
  }
  const form = $<HTMLFormElement>("pin-form");
  if (preset) {
    form.reset();
    if (preset.name)
      (form.elements.namedItem("name") as HTMLInputElement).value = preset.name;
    if (preset.lat !== undefined)
      $<HTMLInputElement>("pin-lat").value = preset.lat.toFixed(6);
    if (preset.lng !== undefined)
      $<HTMLInputElement>("pin-lng").value = preset.lng.toFixed(6);
    if (preset.notes)
      (form.elements.namedItem("notes") as HTMLTextAreaElement).value =
        preset.notes;
    const radio = form.querySelector<HTMLInputElement>(
      `input[name="category"][value="${preset.category ?? "masjid"}"]`,
    );
    if (radio) radio.checked = true;
  }
  $("pin-error").textContent = "";
  $<HTMLDialogElement>("pin-dialog").showModal();
}

function clearSelection(): void {
  selectedListing = undefined;
  $("detail-card").hidden = true;
  void map?.clearFocus();
}

function selectArea(area: string): void {
  selectedArea = area;
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-area]",
  )) {
    button.classList.toggle("selected", button.dataset.area === area);
    button.setAttribute("aria-pressed", String(button.dataset.area === area));
  }
  render();
  void map?.showArea(area);
}

function selectListing(listing: Listing): void {
  listingsVisible = true;
  $<HTMLInputElement>("listings-toggle").checked = true;
  selectedListing = listing;
  const research = researchFor(listing);
  const rail =
    research &&
    (nearestRail(research) ?? nearestRail(research, undefined, "planned"));
  const krl = nearestStation(listing, stations);
  const nearest = rail
    ? { station: rail, distance: rail.km, label: stationLabel(rail) }
    : krl && { ...krl, label: krl.station.name };
  const saveable = collection === "demo" || research !== undefined;
  const eyebrow = research
    ? "RISET PROPERTI"
    : collection === "demo"
      ? "CONTOH HUNIAN"
      : "LISTING PRIBADI";
  const detail = $("detail-card");
  detail.hidden = false;
  detail.innerHTML = `<div class="detail-top"><span class="eyebrow">${eyebrow} · ${esc(listing.area)}</span><button id="detail-close" class="icon-button" aria-label="Tutup detail hunian">${icon("close")}</button></div><h2>${esc(listing.title)}</h2><strong class="detail-price">${research ? priceRange(research) : money(listing.price)}</strong>${research ? `<div class="card-specs"><span>${listing.type}</span><span>${esc(research.price.basis)}</span><span>${research.verdict === "confirmed" ? "Terverifikasi" : "Sebagian terverifikasi"}</span></div>` : `<div class="card-specs"><span>${listing.type}</span><span>${listing.bedrooms} kamar</span><span>${listing.landArea} m²</span></div>`}<div class="detail-transit">${icon("train")}<div><strong>${nearest ? esc(nearest.label) : "Stasiun belum ditemukan"}</strong><span>${nearest ? `${nearest.distance.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km garis lurus dari titik hunian` : "Periksa data stasiun terlebih dahulu"}</span></div></div>
    <div class="maps-links" aria-label="Google Maps">
      <a class="button wide" data-map-link="location" href="${esc(googleMapsLocation(listing))}" target="_blank" rel="noopener noreferrer">${icon("pin")} Lokasi di Google Maps ↗</a>
      <a class="button wide" data-map-link="directions" href="${esc(googleMapsDirections(listing))}" target="_blank" rel="noopener noreferrer">${icon("arrow")} Rute ke hunian ↗</a>
      ${nearest ? `<a class="button wide" data-map-link="station" href="${esc(googleMapsWalkToStation(listing, nearest.station))}" target="_blank" rel="noopener noreferrer">${icon("train")} ${rail && !isOperating(rail) ? `Arah ke lokasi stasiun rencana ${esc(rail.name)}` : `Jalan ke ${esc(nearest.station.name)}`} ↗</a>` : ""}
      <p>Pilih titik asal, lalu cek jarak dan waktu perjalanan di Google Maps.${collection === "demo" ? " Lokasi hunian ini hanya ilustrasi." : ""}${research?.coordinate ? ` Titik ${esc(research.coordinate.precision)} dari ${esc(research.coordinate.method)}; pastikan lokasi persis ke developer.` : ""}</p>
    </div>
    ${nearbyPins(listing)}
    ${research ? researchEvidence(research) : `<p class="detail-notes">${esc(listing.notes || "Belum ada catatan survei.")}</p>${listing.sourceUrl ? `<a class="source-link" href="${esc(safeUrl(listing.sourceUrl))}" target="_blank" rel="noopener noreferrer">Buka sumber listing ↗</a>` : ""}`}<button id="detail-action" class="button ${saveable ? "primary" : "danger"} wide">${saveable ? `${icon("bookmark")} Simpan ke Listingku` : "Hapus dari Listingku"}</button>`;
  if (research) {
    detail.insertAdjacentHTML(
      "beforeend",
      `<button id="detail-pin" class="button wide">${icon("pin")} Simpan sebagai pin</button>`,
    );
    $("detail-pin").onclick = () => showPinForm(researchToPin(research));
  }
  for (const button of detail.querySelectorAll<HTMLButtonElement>(
    "[data-near-pin]",
  ))
    button.onclick = () => {
      const pin = pins.find((item) => item.id === button.dataset.nearPin);
      if (pin) void map?.openPin(pin, pinPopup);
    };
  $("detail-close").onclick = () => {
    clearSelection();
    render();
  };
  $("detail-action").onclick = async () => {
    if (!getUser()) {
      await doLogin();
      if (!getUser()) return;
    }
    const button = $<HTMLButtonElement>("detail-action");
    button.disabled = true;
    try {
      if (saveable) {
        await privateAPI("/api/listings", {
          method: "POST",
          body: JSON.stringify(listing),
        });
        toast(
          research
            ? "Disimpan ke Listingku dengan tautan sumber dan tanggal cek."
            : "Contoh disimpan ke Listingku. Lengkapi dengan data hasil surveimu.",
        );
      } else {
        if (!confirm("Hapus listing ini dari koleksi pribadimu?")) return;
        await privateAPI(`/api/listings/${encodeURIComponent(listing.id)}`, {
          method: "DELETE",
        });
        toast("Listing sudah dihapus.");
      }
      await loadPrivateListings();
      clearSelection();
      render();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Listing belum tersimpan.",
      );
    } finally {
      button.disabled = false;
    }
  };
  void map?.focus(listing.lng, listing.lat);
  if (matchMedia("(max-width: 760px)").matches) setMobileView("map");
  render();
}

function researchFor(listing: Listing): ResearchProperty | undefined {
  return collection === "research"
    ? researchProperties.find((property) => property.id === listing.id)
    : undefined;
}

function researchEvidence(property: ResearchProperty): string {
  return `<div class="detail-evidence"><strong>Bukti harga</strong><p>“${esc(property.price.quote)}”</p><a class="source-link" href="${esc(safeUrl(property.price.url))}" target="_blank" rel="noopener noreferrer">Sumber harga ↗</a>${property.officialUrl ? ` · <a class="source-link" href="${esc(safeUrl(property.officialUrl))}" target="_blank" rel="noopener noreferrer">Situs resmi ↗</a>` : ""}${(property.social ?? []).map((link) => ` · <a class="source-link" data-testid="detail-social" href="${esc(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer">${esc(SOCIAL_LABELS[link.platform])} ↗</a>`).join("")}<small>Dicek ${esc(checkedDate(property.lastChecked))} · ${property.sources.length} sumber · <a href="/riset#${encodeURIComponent(property.id)}">bukti lengkap ↗</a></small>${plusSummary(property) ? `<small data-testid="detail-plus">Poin plus: ${esc(plusSummary(property))} · <a href="/riset#${encodeURIComponent(property.id)}">rincian ↗</a></small>` : ""}${property.population && researchPopulation ? `<small data-testid="detail-population">Penduduk sekitar: ${esc(populationText(property.population, researchPopulation))}; bukan keramaian siang hari.</small>` : ""}</div>`;
}

function nearbyPins(listing: Listing): string {
  if (!pins.length) return "";
  const nearest = pins
    .map((pin) => ({ pin, distance: distanceKm(listing, pin) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);
  return `<div class="detail-pins"><strong>Tempat penting terdekat</strong>${nearest
    .map(
      ({ pin, distance }) =>
        `<button type="button" data-near-pin="${esc(pin.id)}" style="--pin:${PIN_STYLES[pin.category].color}"><span class="pin-badge">${pinIcon(pin.category, 13)}</span><span>${esc(pin.name)}</span><em>${distance.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km</em></button>`,
    )
    .join("")}<small>Jarak garis lurus, bukan rute.</small></div>`;
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

async function loadPrivateListings(): Promise<void> {
  const uid = getUser()?.uid;
  if (!uid) return;
  try {
    const result = await privateAPI<{ listings: Listing[] }>("/api/listings");
    if (getUser()?.uid !== uid) return;
    privateListings = result.listings;
  } catch (error) {
    if (getUser()?.uid !== uid) return;
    privateListings = [];
    toast(error instanceof Error ? error.message : "Koleksi belum termuat.");
  }
  render();
}

function showListingForm(): void {
  if (!getUser()) {
    collection = "private";
    render();
    void doLogin();
    return;
  }
  $("form-error").textContent = "";
  $<HTMLDialogElement>("listing-dialog").showModal();
}

function resetFilters(): void {
  $<HTMLInputElement>("search").value = "";
  $<HTMLSelectElement>("budget").value = "0";
  $<HTMLSelectElement>("housing-type").value = "Semua";
  $<HTMLSelectElement>("station-distance").value = "0";
  $("station-results").innerHTML = "";
  clearPlaces();
  selectArea("Semua");
}

function setMobileView(view: "map" | "list"): void {
  document.body.classList.toggle("show-map", view === "map");
  $("mobile-map").classList.toggle("active", view === "map");
  $("mobile-list").classList.toggle("active", view === "list");
  setTimeout(() => map?.resize(), 30);
}

for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-area]",
))
  button.onclick = () => selectArea(button.dataset.area ?? "Semua");
for (const id of ["budget", "housing-type", "station-distance", "sort"])
  $(id).onchange = render;
let placeTimer: ReturnType<typeof setTimeout>;
let placeRequest: AbortController | undefined;
function clearPlaces(): void {
  clearTimeout(placeTimer);
  placeRequest?.abort();
  $("place-results").innerHTML = "";
}
function searchPlaces(query: string): void {
  clearPlaces();
  if (query.length < 3) return;
  placeTimer = setTimeout(async () => {
    const request = new AbortController();
    placeRequest = request;
    let places: Place[];
    try {
      const response = await fetch(
        `/api/places?${new URLSearchParams({ q: query })}`,
        { signal: request.signal },
      );
      if (!response.ok) throw new Error();
      places = ((await response.json()) as { places: Place[] }).places;
    } catch {
      if (!request.signal.aborted)
        $("place-results").innerHTML =
          '<p class="place-note">Pencarian tempat belum tersedia.</p>';
      return;
    }
    if (request.signal.aborted) return;
    $("place-results").innerHTML = places.length
      ? `<p class="place-note">Tempat · OpenStreetMap</p>${places
          .map(
            (place, index) =>
              `<button data-place="${index}">${icon("pin")} <span class="place-name"><strong>${esc(place.name)}</strong>${place.detail ? `<small>${esc(place.detail)}</small>` : ""}</span><span>lihat di peta ↗</span></button>`,
          )
          .join("")}`
      : "";
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      "[data-place]",
    ))
      button.onclick = () => {
        const place = places[Number(button.dataset.place)];
        if (!place) return;
        void map?.showPlace(place);
        if (matchMedia("(max-width: 760px)").matches) setMobileView("map");
      };
  }, 350);
}
$("search").oninput = () => {
  render();
  searchPlaces($<HTMLInputElement>("search").value.trim());
  const query = $<HTMLInputElement>("search").value.trim().toLowerCase();
  const matches =
    query.length >= 3
      ? transportStops
          .filter((station) => station.name.toLowerCase().includes(query))
          .slice(0, 3)
      : [];
  $("station-results").innerHTML = matches
    .map(
      (station) =>
        `<button data-station="${esc(station.id)}">${icon(station.mode === "TransJakarta" ? "bus" : "train")} ${esc(station.mode)} · ${esc(station.name)} <span>lihat di peta ↗</span></button>`,
    )
    .join("");
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-station]",
  ))
    button.onclick = () => {
      const station = transportStops.find(
        (item) => item.id === button.dataset.station,
      );
      if (station) {
        const modeToggle =
          station.mode === "KRL"
            ? "rail-toggle"
            : station.mode === "MRT"
              ? "mrt-toggle"
              : station.mode === "LRT"
                ? "lrt-toggle"
                : "tj-toggle";
        $<HTMLInputElement>(modeToggle).checked = true;
        if (station.mode === "KRL") void map?.showRail(true);
        else void map?.showTransit(station.mode as TransitMode, true);
        updateTransitLegend();
        void map?.focus(station.lng, station.lat, 14);
        if (matchMedia("(max-width: 760px)").matches) setMobileView("map");
      }
    };
};
$("rail-toggle").onchange = () => {
  const checked = $<HTMLInputElement>("rail-toggle").checked;
  void map?.showRail(checked);
  updateTransitLegend();
};
const transitToggles = [
  ["mrt-toggle", "MRT"],
  ["lrt-toggle", "LRT"],
  ["tj-toggle", "TransJakarta"],
] as const;
function updateTransitLegend(): void {
  let anyVisible = false;
  for (const [id, mode] of [["rail-toggle", "KRL"], ...transitToggles]) {
    const visible = $<HTMLInputElement>(id).checked;
    anyVisible ||= visible;
    for (const entry of document.querySelectorAll<HTMLElement>(
      `[data-legend-mode="${mode}"]`,
    ))
      entry.hidden = !visible;
  }
  $("transit-legend").hidden = !anyVisible;
}
for (const [id, mode] of transitToggles)
  $(id).onchange = () => {
    void map?.showTransit(mode, $<HTMLInputElement>(id).checked);
    updateTransitLegend();
  };
$("community-toggle").onchange = () => {
  void map?.showCommunity($<HTMLInputElement>("community-toggle").checked);
};
$("buildings-toggle").onchange = () => {
  void map?.showBuildings($<HTMLInputElement>("buildings-toggle").checked);
};
$("listings-toggle").onchange = () => {
  listingsVisible = $<HTMLInputElement>("listings-toggle").checked;
  if (!listingsVisible) clearSelection();
  render();
};
$("map-reset").onclick = resetFilters;
$("sources-button").onclick = () =>
  $<HTMLDialogElement>("sources-dialog").showModal();
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-close]",
))
  button.onclick = () =>
    $<HTMLDialogElement>(button.dataset.close ?? "").close();
$("demo-tab").onclick = () => {
  collection = "demo";
  selectedListing = undefined;
  $("detail-card").hidden = true;
  render();
};
function openPrivate(): void {
  collection = "private";
  selectedListing = undefined;
  $("detail-card").hidden = true;
  render();
  if (getUser()) void loadPrivateListings();
}
$("private-tab").onclick = openPrivate;
$("research-tab").onclick = () => {
  collection = "research";
  selectedListing = undefined;
  $("detail-card").hidden = true;
  render();
};
$("pins-tab").onclick = () => {
  collection = "pins";
  render();
  if (getUser()) void loadPins();
};
$("add-pin").onclick = () => showPinForm();
$("pin-pick-map").onclick = () => {
  pickingPoint = "pin";
  $<HTMLDialogElement>("pin-dialog").close();
  setMobileView("map");
  toast("Klik titik tempat pada peta. Koordinat akan diisi otomatis.");
};
$("pin-form").onsubmit = async (event) => {
  event.preventDefault();
  const form = $<HTMLFormElement>("pin-form");
  const data = Object.fromEntries(new FormData(form));
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    const result = await privateAPI<{ pin: Pin }>("/api/pins", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        lat: Number(data.lat),
        lng: Number(data.lng),
      }),
    });
    $<HTMLDialogElement>("pin-dialog").close();
    form.reset();
    await loadPins();
    void map?.openPin(result.pin, pinPopup);
    toast("Pin tersimpan.");
  } catch (error) {
    $("pin-error").textContent =
      error instanceof Error ? error.message : "Pin belum tersimpan.";
  } finally {
    if (button) button.disabled = false;
  }
};
$("nav-saved").onclick = openPrivate;
$("account-button").onclick = async () => {
  if (getUser()) {
    await logout();
    toast("Kamu sudah keluar.");
  } else await doLogin();
};
$("add-listing").onclick = showListingForm;
$("mobile-map").onclick = () => setMobileView("map");
$("mobile-list").onclick = () => setMobileView("list");
$("pick-map").onclick = () => {
  pickingPoint = "listing";
  $<HTMLDialogElement>("listing-dialog").close();
  setMobileView("map");
  toast("Klik titik lokasi hunian pada peta. Koordinat akan diisi otomatis.");
};
$("listing-form").onsubmit = async (event) => {
  event.preventDefault();
  const form = $<HTMLFormElement>("listing-form");
  const data: Record<string, FormDataEntryValue | number> = Object.fromEntries(
    new FormData(form),
  );
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    for (const key of ["price", "bedrooms", "landArea", "lat", "lng"])
      data[key] = Number(data[key]);
    await privateAPI("/api/listings", {
      method: "POST",
      body: JSON.stringify(data),
    });
    $<HTMLDialogElement>("listing-dialog").close();
    form.reset();
    collection = "private";
    resetFilters();
    await loadPrivateListings();
    toast("Listing berhasil disimpan ke koleksi pribadimu.");
  } catch (error) {
    $("form-error").textContent =
      error instanceof Error ? error.message : "Listing belum tersimpan.";
  } finally {
    if (button) button.disabled = false;
  }
};
document.addEventListener("keydown", (event) => {
  const inInput =
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    event.target instanceof HTMLSelectElement;
  if (
    event.key === "/" &&
    !inInput &&
    !document.querySelector("dialog[open]")
  ) {
    event.preventDefault();
    setMobileView("list");
    $("search").focus();
  }
  if (event.key === "Escape" && selectedListing) {
    clearSelection();
    render();
  }
});
render();

async function start(): Promise<void> {
  const resources = await Promise.allSettled([
    fetch("/data/regions.geojson").then((response) => {
      if (!response.ok) throw new Error("Wilayah gagal dimuat");
      return response.json() as Promise<GeoJSON.FeatureCollection>;
    }),
    fetch("/data/transit.geojson").then((response) => {
      if (!response.ok) throw new Error("Transit gagal dimuat");
      return response.json() as Promise<GeoJSON.FeatureCollection>;
    }),
    fetch("/data/mobility.geojson").then((response) => {
      if (!response.ok)
        throw new Error("Data MRT/LRT/TransJakarta gagal dimuat");
      return response.json() as Promise<GeoJSON.FeatureCollection>;
    }),
    fetch("/api/config").then((response) => {
      if (!response.ok) throw new Error("Konfigurasi gagal dimuat");
      return response.json() as Promise<AppConfig>;
    }),
    loadResearch(),
  ]);
  const [
    regionsResult,
    transitResult,
    mobilityResult,
    configResult,
    researchResult,
  ] = resources;
  if (researchResult.status === "fulfilled") {
    researchProperties = researchResult.value.properties;
    researchPopulation = researchResult.value.population;
    researchPlanned = researchResult.value.planned;
    researchListings = researchProperties.flatMap((property) => {
      const listing = researchToListing(property);
      return listing ? [listing] : [];
    });
  }
  $("research-count").textContent =
    researchResult.status === "fulfilled"
      ? String(researchListings.length)
      : "–";
  const empty: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };
  const regions =
    regionsResult.status === "fulfilled" ? regionsResult.value : empty;
  const transit =
    transitResult.status === "fulfilled" ? transitResult.value : empty;
  const mobility =
    mobilityResult.status === "fulfilled" ? mobilityResult.value : empty;
  stations = transit.features.flatMap((feature) => {
    if (feature.geometry.type !== "Point") return [];
    const props = feature.properties ?? {};
    return [
      {
        id: String(props.id ?? feature.id),
        name: String(props.name),
        mode: "KRL",
        lines: Array.isArray(props.lines) ? props.lines : [],
        lng: feature.geometry.coordinates[0] ?? 0,
        lat: feature.geometry.coordinates[1] ?? 0,
      },
    ];
  });
  transportStops = [
    ...stations,
    ...mobility.features.flatMap((feature): Station[] => {
      if (feature.geometry.type !== "Point") return [];
      const props = feature.properties ?? {};
      if (!["MRT", "LRT", "TransJakarta"].includes(props.mode)) return [];
      return [
        {
          id: String(props.id ?? feature.id),
          name: String(props.name),
          mode: props.mode,
          lines: Array.isArray(props.lines) ? props.lines : [],
          lng: feature.geometry.coordinates[0] ?? 0,
          lat: feature.geometry.coordinates[1] ?? 0,
        },
      ];
    }),
  ];
  if (
    regionsResult.status === "rejected" ||
    transitResult.status === "rejected" ||
    mobilityResult.status === "rejected"
  )
    toast("Sebagian data peta belum termuat. Coba muat ulang halaman.");
  try {
    map = new HousingMap(
      regions,
      transit,
      mobility,
      (area) => {
        if (!pickingPoint) selectArea(area);
      },
      (lng, lat) => {
        if (!pickingPoint) return;
        const target = pickingPoint;
        pickingPoint = undefined;
        const prefix = target === "pin" ? "pin" : "form";
        $<HTMLInputElement>(`${prefix}-lng`).value = lng.toFixed(6);
        $<HTMLInputElement>(`${prefix}-lat`).value = lat.toFixed(6);
        $<HTMLDialogElement>(`${target}-dialog`).showModal();
      },
    );
    map.onPinPlace = (place) =>
      showPinForm({
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        category: guessCategory(place.name, place.kind),
      });
    void map.showBuildings($<HTMLInputElement>("buildings-toggle").checked);
    void map.showCommunity($<HTMLInputElement>("community-toggle").checked);
    void map.showRail($<HTMLInputElement>("rail-toggle").checked);
    for (const [id, mode] of transitToggles)
      void map.showTransit(mode, $<HTMLInputElement>(id).checked);
    updateTransitLegend();
    render();
  } catch {
    $("map").innerHTML =
      '<div class="map-unavailable"><h2>Peta interaktif belum tersedia</h2><p>Browser perlu mendukung WebGL. Daftar, pencarian, dan jarak stasiun tetap dapat digunakan.</p></div>';
    toast("Peta memerlukan WebGL. Kamu tetap bisa menggunakan daftar hunian.");
    render();
  }
  const params = new URLSearchParams(location.search);
  const researchId = params.get("riset");
  if (researchId || params.get("koleksi") === "riset") {
    collection = "research";
    const listing = researchListings.find((item) => item.id === researchId);
    if (listing) selectListing(listing);
    else render();
  } else if (params.get("koleksi") === "listingku") openPrivate();
  if (configResult.status === "fulfilled") {
    try {
      await initializeAuth(configResult.value, (user) => {
        $("account-label").textContent = user
          ? `${user.displayName?.split(" ")[0] || "Akun"} · Keluar`
          : "Masuk dengan Google";
        if (user) {
          void loadPrivateListings();
          void loadPins();
        } else {
          privateListings = [];
          pins = [];
          void map?.updatePins(pins, pinPopup);
          render();
        }
      });
    } catch {
      toast("Login belum dapat dimuat. Peta contoh tetap dapat digunakan.");
    }
  }
}
void start().catch(() =>
  toast("Aplikasi belum dapat memuat data. Coba muat ulang halaman."),
);
