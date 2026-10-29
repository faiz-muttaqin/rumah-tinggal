import "@fontsource-variable/plus-jakarta-sans";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { getUser, initializeAuth, login, logout, privateAPI } from "./auth.ts";
import { demoListings } from "./demo.ts";
import { escapeHTML as esc, money, nearestStation } from "./geo.ts";
import { HousingMap } from "./map.ts";
import {
  googleMapsDirections,
  googleMapsLocation,
  googleMapsWalkToStation,
} from "./maps-links.ts";
import { type AppConfig, AREAS, type Listing, type Station } from "./types.ts";

const icons = {
  home: '<path d="m3 10 9-7 9 7v11H3z"/><path d="M9 21v-8h6v8"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  train:
    '<rect x="5" y="3" width="14" height="15" rx="4"/><path d="M5 10h14M9 18l-2 3m8-3 2 3M9 14h.01M15 14h.01"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  target:
    '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
};
function icon(name: keyof typeof icons): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}
const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

$("app").innerHTML = `
  <a class="skip-link" href="#results">Langsung ke daftar hunian</a>
  <header class="masthead">
    <a class="brand" href="/" aria-label="Rumah Tinggal, beranda"><span class="brand-mark">${icon("home")}</span><span>rumah<span class="brand-light">tinggal</span><span class="brand-dot">.</span></span></a>
    <nav class="main-nav" aria-label="Navigasi utama"><a class="active" href="#explorer">Jelajahi peta</a><button id="nav-saved">${icon("bookmark")} Listingku</button></nav>
    <div class="header-right"><span class="coverage">Jabodetabek <span class="live-dot"></span></span><button class="button login-button" id="account-button"><span class="google-g" aria-hidden="true">G</span><span id="account-label">Masuk dengan Google</span></button></div>
  </header>
  <main id="explorer" class="explorer">
    <aside class="sidebar" aria-label="Pencarian dan daftar hunian">
      <div class="sidebar-top">
        <div class="eyebrow"><span class="tiny-line"></span> RUANG UNTUK PULANG</div>
        <h1>Rumah yang pas.<br/><span>Hidup lebih dekat.</span></h1>
        <p class="intro">Kenali wilayahnya, cek akses KRL-nya,<br class="desktop-break"/> lalu temukan tempatmu bertumbuh.</p>
        <div class="search-box">${icon("search")}<input id="search" aria-label="Cari wilayah, hunian, atau stasiun" type="search" placeholder="Wilayah, hunian, atau stasiun…" autocomplete="off"/><kbd>/</kbd></div>
        <div id="station-results" class="station-results"></div>
        <div class="area-chips" aria-label="Filter wilayah"><button class="chip selected" data-area="Semua" aria-pressed="true">Semua</button>${AREAS.map((area) => `<button class="chip" data-area="${area}" aria-pressed="false">${area}</button>`).join("")}</div>
        <div class="filter-grid"><label>Anggaran beli<select id="budget" aria-label="Anggaran maksimum"><option value="0">Semua anggaran</option><option value="500000000">Hingga Rp 500 juta</option><option value="750000000">Hingga Rp 750 juta</option><option value="1000000000">Hingga Rp 1 miliar</option></select></label><label>Jenis hunian<select id="housing-type" aria-label="Jenis hunian"><option value="Semua">Semua jenis</option><option>Rumah</option><option>Apartemen</option><option>Kos</option></select></label></div>
        <div class="commute-filter">${icon("train")}<label for="station-distance">Jarak ke stasiun KRL</label><select id="station-distance" aria-label="Jarak maksimum ke stasiun KRL"><option value="0">Bebas</option><option value="1">≤ 1 km</option><option value="3">≤ 3 km</option><option value="5">≤ 5 km</option></select></div>
        <div class="data-tabs" aria-label="Koleksi hunian"><button id="demo-tab" class="active" aria-pressed="true">Contoh hunian <span>8</span></button><button id="private-tab" aria-pressed="false">${icon("bookmark")} Listingku</button></div>
      </div>
      <section id="results" class="results" tabindex="-1" aria-label="Hasil pencarian">
        <div class="results-toolbar"><div><strong id="result-count">8 hunian</strong><span id="result-scope"> di Jabodetabek</span></div><select id="sort" aria-label="Urutkan hunian"><option value="recommended">Rekomendasi</option><option value="price">Harga terendah</option><option value="station">Terdekat KRL</option></select></div>
        <div class="example-note" id="example-note"><span class="sample-dot"></span> Data contoh · harga & lokasi ilustratif</div>
        <div id="listing-list" class="listing-list" aria-live="polite"></div>
      </section>
      <footer class="sidebar-footer"><span>Pilihan baik dimulai dari mengenal tempat.</span><button id="sources-button">${icon("info")} Sumber data</button></footer>
    </aside>
    <section class="map-panel" aria-label="Peta hunian Jabodetabek">
      <div id="map" class="map" aria-label="Peta interaktif, gunakan tombol panah untuk menggeser"></div>
      <div class="map-heading"><span class="map-heading-icon">${icon("pin")}</span><div><strong>Jabodetabek</strong><span>5 area · <span id="station-count">Memuat</span> stasiun KRL</span></div><button id="map-reset" class="icon-button" aria-label="Tampilkan seluruh Jabodetabek">${icon("target")}</button></div>
      <div id="map-status" class="map-status" role="status">Peta dasar belum termuat. Wilayah dan KRL tetap bisa dijelajahi.</div>
      <div class="map-tools" role="group" aria-label="Lapisan peta">
        <label class="layer-control">${icon("train")} Jalur KRL <input id="rail-toggle" aria-label="Jalur KRL" type="checkbox" checked/><span class="switch" aria-hidden="true"></span></label>
        <label class="layer-control">${icon("home")} Bangunan <input id="buildings-toggle" aria-label="Bangunan pada peta" type="checkbox"/><span class="switch" aria-hidden="true"></span></label>
        <label class="layer-control">${icon("pin")} Hunian <input id="listings-toggle" aria-label="Marker dan detail hunian" type="checkbox" checked/><span class="switch" aria-hidden="true"></span></label>
        <span class="map-road-note">Jalan selalu tampil · bangunan saat diperbesar</span>
        <button class="add-floating" id="add-listing">${icon("plus")} Tambah listing</button>
      </div>
      <div class="rail-legend" id="rail-legend"><span><i style="--line:#b33c39"></i>Bogor / Nambo</span><span><i style="--line:#2d6da6"></i>Cikarang</span><span><i style="--line:#278365"></i>Rangkasbitung</span><span><i style="--line:#956542"></i>Tangerang</span><span><i style="--line:#c95d9a"></i>Tj. Priok</span></div>
      <div class="map-bottom-note">${icon("info")} Jarak stasiun dihitung garis lurus, bukan rute berjalan kaki.</div>
      <div id="detail-card" class="detail-card" hidden></div>
    </section>
  </main>
  <div class="mobile-view"><button id="mobile-map">${icon("pin")} Peta</button><button id="mobile-list" class="active">${icon("home")} Daftar</button></div>
  <dialog id="sources-dialog" aria-labelledby="sources-title"><div class="dialog-header"><span class="eyebrow">TRANSPARANSI DATA</span><button class="icon-button" data-close="sources-dialog" aria-label="Tutup sumber data">${icon("close")}</button></div><h2 id="sources-title">Sumber & catatan data</h2><div class="source-block"><h3>Wilayah Jabodetabek</h3><p>14 batas kabupaten/kota dari geometri Nafkah / HDX COD-AB, disederhanakan untuk gambaran wilayah. Batas ini tidak cukup rinci untuk memastikan alamat atau batas bidang tanah. Kepulauan Seribu sangat disederhanakan pada sumber.</p><a href="https://gitlab.com/adenaufal/nafkah" target="_blank" rel="noopener noreferrer">Nafkah · Ade Naufal · CC BY 4.0 ↗</a></div><div class="source-block"><h3>Jalur & stasiun KRL</h3><p>Geometri rel dan titik stasiun dari OpenStreetMap, snapshot 29 Oktober 2026. Lapisan ini memberi konteks spasial, tanpa jadwal, tarif, status operasi, atau waktu tempuh aktual.</p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors · ODbL ↗</a></div><div class="source-block"><h3>Listing & jarak</h3><p>Semua hunian pada tab Contoh hunian adalah data ilustratif, bukan iklan atau penawaran properti. Listingku berisi data pribadi yang kamu masukkan sendiri. Jarak ke KRL adalah garis lurus ke titik stasiun terdekat, bukan akses pintu masuk atau rute berjalan.</p></div><div class="source-block"><h3>Peta jalan & bangunan</h3><p>Peta vektor OpenFreeMap, skema © OpenMapTiles, data © OpenStreetMap contributors. Bangunan dapat disembunyikan terpisah; jalan tetap tampil. Cakupan bangunan mengikuti data OSM.</p><a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap · OpenMapTiles · OpenStreetMap ↗</a></div><p class="fine-print">Peta dasar OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors. Tampilan terinspirasi pola peta Nafkah; implementasi aplikasi dibuat untuk Rumah Tinggal.</p></dialog>
  <dialog id="listing-dialog" aria-labelledby="listing-title"><div class="dialog-header"><span class="eyebrow">KOLEKSI PRIBADIMU</span><button class="icon-button" data-close="listing-dialog" aria-label="Tutup tambah listing">${icon("close")}</button></div><h2 id="listing-title">Tambahkan calon rumah</h2><p class="dialog-intro">Simpan lokasi, harga beli, dan catatan survei. Hanya akunmu yang dapat melihatnya.</p><form id="listing-form"><label>Nama hunian<input name="title" required maxlength="160" placeholder="Contoh: Rumah dekat Stasiun Pondok Ranji"/></label><div class="form-grid"><label>Wilayah<select name="area">${AREAS.map((area) => `<option>${area}</option>`).join("")}</select></label><label>Kecamatan / lingkungan<input name="district" required maxlength="100"/></label><label>Harga beli (Rp)<input name="price" type="number" min="1" max="1000000000000" required/></label><label>Jenis<select name="type"><option>Rumah</option><option>Apartemen</option><option>Kos</option></select></label><label>Kamar tidur<input name="bedrooms" type="number" min="0" max="30" value="2" required/></label><label>Luas tanah / unit (m²)<input name="landArea" type="number" min="1" max="100000" required/></label><label>Latitude<input id="form-lat" name="lat" type="number" step="any" min="-6.85" max="-5.75" required value="-6.3"/></label><label>Longitude<input id="form-lng" name="lng" type="number" step="any" min="106.3" max="107.31" required value="106.8"/></label></div><button type="button" id="pick-map" class="text-button">${icon("pin")} Pilih koordinat di peta</button><label>Tautan sumber (opsional)<input name="sourceUrl" type="url" maxlength="2000" placeholder="https://…"/></label><label>Catatan survei (opsional)<textarea name="notes" maxlength="3000" rows="3" placeholder="Akses jalan, kondisi lingkungan, hal yang perlu dicek…"></textarea></label><p id="form-error" class="form-error" role="alert"></p><button class="button primary wide" type="submit">Simpan ke Listingku ${icon("arrow")}</button></form></dialog>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
`;

let map: HousingMap | undefined;
let stations: Station[] = [];
let privateListings: Listing[] = [];
let collection: "demo" | "private" = "demo";
let selectedArea = "Semua";
let selectedListing: Listing | undefined;
let listingsVisible = true;
let pickingPoint = false;
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
    collection === "demo" ? demoListings : privateListings
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
  $("demo-tab").classList.toggle("active", collection === "demo");
  $("private-tab").classList.toggle("active", collection === "private");
  $("demo-tab").setAttribute("aria-pressed", String(collection === "demo"));
  $("private-tab").setAttribute(
    "aria-pressed",
    String(collection === "private"),
  );
  if (collection === "private" && !getUser()) {
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
        return `<button class="listing-card ${selectedListing?.id === listing.id ? "selected" : ""}" data-testid="listing-card" data-listing="${esc(listing.id)}"><span class="card-top"><span class="card-area"><i class="area-dot area-${listing.area.toLowerCase()}"></i>${listing.area} <span>· ${esc(listing.district)}</span></span><span class="card-number">${String(index + 1).padStart(2, "0")}</span></span><span class="card-title">${esc(listing.title)}</span><span class="card-price">${money(listing.price)} <span>harga beli${collection === "demo" ? " contoh" : ""}</span></span><span class="card-specs"><span>${listing.type}</span><span>${listing.bedrooms} kamar</span><span>${listing.landArea} m²</span></span><span class="card-commute">${icon("train")}<span>${nearest ? `${nearest.distance.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km · ${esc(nearest.station.name)}` : "Data jarak stasiun belum tersedia"}</span><span class="card-arrow">↗</span></span></button>`;
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
  const nearest = nearestStation(listing, stations);
  const detail = $("detail-card");
  detail.hidden = false;
  detail.innerHTML = `<div class="detail-top"><span class="eyebrow">${collection === "demo" ? "CONTOH HUNIAN" : "LISTING PRIBADI"} · ${esc(listing.area)}</span><button id="detail-close" class="icon-button" aria-label="Tutup detail hunian">${icon("close")}</button></div><h2>${esc(listing.title)}</h2><strong class="detail-price">${money(listing.price)}</strong><div class="card-specs"><span>${listing.type}</span><span>${listing.bedrooms} kamar</span><span>${listing.landArea} m²</span></div><div class="detail-transit">${icon("train")}<div><strong>${nearest ? esc(nearest.station.name) : "Stasiun belum ditemukan"}</strong><span>${nearest ? `${nearest.distance.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km garis lurus dari titik hunian` : "Periksa data stasiun terlebih dahulu"}</span></div></div>
    <div class="maps-links" aria-label="Google Maps">
      <a class="button wide" data-map-link="location" href="${esc(googleMapsLocation(listing))}" target="_blank" rel="noopener noreferrer">${icon("pin")} Lokasi di Google Maps ↗</a>
      <a class="button wide" data-map-link="directions" href="${esc(googleMapsDirections(listing))}" target="_blank" rel="noopener noreferrer">${icon("arrow")} Rute ke hunian ↗</a>
      ${nearest ? `<a class="button wide" data-map-link="station" href="${esc(googleMapsWalkToStation(listing, nearest.station))}" target="_blank" rel="noopener noreferrer">${icon("train")} Jalan ke ${esc(nearest.station.name)} ↗</a>` : ""}
      <p>Pilih titik asal, lalu cek jarak dan waktu perjalanan di Google Maps.${collection === "demo" ? " Lokasi hunian ini hanya ilustrasi." : ""}</p>
    </div>
    <p class="detail-notes">${esc(listing.notes || "Belum ada catatan survei.")}</p>${listing.sourceUrl ? `<a class="source-link" href="${esc(listing.sourceUrl)}" target="_blank" rel="noopener noreferrer">Buka sumber listing ↗</a>` : ""}<button id="detail-action" class="button ${collection === "demo" ? "primary" : "danger"} wide">${collection === "demo" ? `${icon("bookmark")} Simpan ke Listingku` : "Hapus dari Listingku"}</button>`;
  $("detail-close").onclick = () => {
    clearSelection();
    render();
  };
  $("detail-action").onclick = async () => {
    if (!getUser()) {
      await doLogin();
      return;
    }
    const button = $<HTMLButtonElement>("detail-action");
    button.disabled = true;
    try {
      if (collection === "demo") {
        await privateAPI("/api/listings", {
          method: "POST",
          body: JSON.stringify(listing),
        });
        toast(
          "Contoh disimpan ke Listingku. Lengkapi dengan data hasil surveimu.",
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

async function doLogin(): Promise<void> {
  $<HTMLButtonElement>("account-button").disabled = true;
  try {
    await login();
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    toast(
      code === "auth/popup-closed-by-user"
        ? "Jendela login ditutup. Kamu bisa mencoba lagi."
        : code === "auth/unauthorized-domain"
          ? "Domain ini perlu ditambahkan ke Authorized domains Firebase."
          : code === "auth/popup-blocked"
            ? "Izinkan popup untuk masuk dengan Google."
            : error instanceof Error && !code
              ? error.message
              : "Login belum berhasil. Periksa koneksi dan pengaturan Google/Firebase.",
    );
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
$("search").oninput = () => {
  render();
  const query = $<HTMLInputElement>("search").value.trim().toLowerCase();
  const matches =
    query.length >= 3
      ? stations
          .filter((station) => station.name.toLowerCase().includes(query))
          .slice(0, 3)
      : [];
  $("station-results").innerHTML = matches
    .map(
      (station) =>
        `<button data-station="${esc(station.id)}">${icon("train")} Stasiun ${esc(station.name)} <span>lihat di peta ↗</span></button>`,
    )
    .join("");
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-station]",
  ))
    button.onclick = () => {
      const station = stations.find(
        (item) => item.id === button.dataset.station,
      );
      if (station) {
        void map?.focus(station.lng, station.lat, 14);
        if (matchMedia("(max-width: 760px)").matches) setMobileView("map");
      }
    };
};
$("rail-toggle").onchange = () => {
  const checked = $<HTMLInputElement>("rail-toggle").checked;
  void map?.showRail(checked);
  $("rail-legend").hidden = !checked;
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
  pickingPoint = true;
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
    fetch("/api/config").then((response) => {
      if (!response.ok) throw new Error("Konfigurasi gagal dimuat");
      return response.json() as Promise<AppConfig>;
    }),
  ]);
  const [regionsResult, transitResult, configResult] = resources;
  const empty: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };
  const regions =
    regionsResult.status === "fulfilled" ? regionsResult.value : empty;
  const transit =
    transitResult.status === "fulfilled" ? transitResult.value : empty;
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
  $("station-count").textContent = String(stations.length);
  if (
    regionsResult.status === "rejected" ||
    transitResult.status === "rejected"
  )
    toast("Sebagian data peta belum termuat. Coba muat ulang halaman.");
  try {
    map = new HousingMap(
      regions,
      transit,
      (area) => {
        if (!pickingPoint) selectArea(area);
      },
      (lng, lat) => {
        if (!pickingPoint) return;
        pickingPoint = false;
        $<HTMLInputElement>("form-lng").value = lng.toFixed(6);
        $<HTMLInputElement>("form-lat").value = lat.toFixed(6);
        $<HTMLDialogElement>("listing-dialog").showModal();
      },
    );
    void map.showBuildings($<HTMLInputElement>("buildings-toggle").checked);
    void map.showRail($<HTMLInputElement>("rail-toggle").checked);
    render();
  } catch {
    $("map").innerHTML =
      '<div class="map-unavailable"><h2>Peta interaktif belum tersedia</h2><p>Browser perlu mendukung WebGL. Daftar, pencarian, dan jarak stasiun tetap dapat digunakan.</p></div>';
    toast("Peta memerlukan WebGL. Kamu tetap bisa menggunakan daftar hunian.");
    render();
  }
  if (configResult.status === "fulfilled") {
    try {
      await initializeAuth(configResult.value, (user) => {
        $("account-label").textContent = user
          ? `${user.displayName?.split(" ")[0] || "Akun"} · Keluar`
          : "Masuk dengan Google";
        if (user) void loadPrivateListings();
        else {
          privateListings = [];
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
