import { distanceKm, escapeHTML as esc, nearestStation } from "./geo.ts";
import { googleMapsRoute, googleMapsWalkToStation } from "./maps-links.ts";
import {
  checkedDate,
  distanceText,
  type MosqueEvent,
  type ResearchMosque,
  type ResearchMosques,
  type ResearchRental,
  rentText,
  safeUrl,
} from "./research-data.ts";
import type { Listing, Station } from "./types.ts";

const external = 'target="_blank" rel="noopener noreferrer"';

// Enam titik Bandung tetap ada di direktori; peta ini mencakup Jabodetabek.
export function mappedMosques(items: ResearchMosque[]): ResearchMosque[] {
  return items.filter(
    (mosque) =>
      mosque.area !== null &&
      Number.isFinite(mosque.lat) &&
      Number.isFinite(mosque.lng) &&
      mosque.lat >= -6.85 &&
      mosque.lat <= -5.75 &&
      mosque.lng >= 106.3 &&
      mosque.lng <= 107.31,
  );
}

export function nearestMosqueStops(mosque: ResearchMosque, stops: Station[]) {
  return (["KRL", "MRT", "LRT", "TransJakarta"] as const).flatMap((mode) => {
    const closest = nearestStation(
      mosque,
      stops.filter((stop) => stop.mode === mode),
    );
    return closest ? [{ mode, ...closest }] : [];
  });
}

export function currentMosqueEvents(
  events: MosqueEvent[],
  now = new Date(),
): MosqueEvent[] {
  const today = new Date(now.getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  // Hari ini tetap ditampilkan: jam salat pada sumber bisa berupa perkiraan.
  return events
    .filter((event) => event.startsAt.slice(0, 10) >= today)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function mosqueScheduleHTML(mosque: ResearchMosque): string {
  const saved = mosque.profile?.events;
  if (!saved)
    return '<p class="mosque-note">Rincian jadwal belum tersalin. Buka jadwal terbaru di Ihrish.</p>';
  const events = currentMosqueEvents(saved);
  if (!events.length)
    return '<p class="mosque-note">Tanggal jadwal tersimpan sudah lewat. Buka jadwal terbaru di Ihrish.</p>';
  const topicLabels: Record<string, string> = {
    umum: "Umum",
    fiqih: "Fiqih",
    hadits: "Hadits",
    quran: "Al-Qur’an",
    aqidah: "Aqidah",
    tafsir: "Tafsir",
    sirah: "Sirah",
    akhlak: "Akhlak",
  };
  const formatter = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `<ul class="mosque-events">${events
    .slice(0, 5)
    .map(
      (event) =>
        `<li${event.cancelled ? ' class="mosque-event-cancelled"' : ""}><strong>${esc(formatter.format(new Date(event.startsAt)))}</strong><span>${esc(event.timeLabel ? `${event.timeLabel} WIB` : "Waktu: cek Ihrish")} · ${esc(topicLabels[event.topic] ?? event.topic)}${event.cancelled ? " · <b>Dibatalkan</b>" : ""}</span></li>`,
    )
    .join(
      "",
    )}</ul>${events.length > 5 ? `<p class="mosque-note">${events.length - 5} jadwal lainnya tersimpan. Jadwal lengkap di Ihrish.</p>` : ""}<p class="mosque-note">Jam mengikuti sumber; jadwal hari ini bisa sudah lewat. Periksa perubahan dan pembatalan sebelum berangkat.</p>`;
}

export function mosquePopupHTML(
  mosque: ResearchMosque,
  context: ResearchMosques,
  stops: Station[],
  selection?: { home: Listing; example: boolean },
  rentalLeadIds: string[] = [],
  locatedRentals: ResearchRental[] = [],
): string {
  const near = nearestMosqueStops(mosque, stops);
  const mappedRentals = locatedRentals.filter(
    (rental) =>
      rental.location &&
      rental.nearbyMosques?.some((item) => item.id === mosque.id),
  );
  const rentals = mosque.relatedListings.filter(
    (listing) =>
      !mappedRentals.some((rental) => rental.id === listing.id) &&
      (listing.kind === "rental" ||
        (listing.kind === "lead" && rentalLeadIds.includes(listing.id))),
  );
  return `<article class="mosque-popup" data-testid="mosque-popup">
    <span class="mosque-kicker">Masjid dengan kajian · Ihrish</span>
    <h2>${esc(mosque.name)}</h2><p>${esc(mosque.address)}</p>
    <p class="mosque-note">${mosque.eventCount} jadwal tercatat · snapshot ${esc(checkedDate(context.checkedAt))}, dapat mencakup pembatalan. Pin direktori belum disurvei.</p>
    <h3>Jadwal tersimpan</h3>${mosqueScheduleHTML(mosque)}
    <a href="${esc(safeUrl(mosque.sourceUrl))}" ${external}>Cek jadwal terbaru di Ihrish ↗</a>
    <h3>Transportasi terdekat per moda</h3>
    ${near.length ? `<ul class="mosque-transit">${near.map(({ mode, station, distance }) => `<li><a href="${esc(googleMapsWalkToStation(mosque, station))}" ${external}>${esc(mode)} · ${esc(station.name)} · ${esc(distanceText(distance))} ↗</a></li>`).join("")}</ul><p class="mosque-note">Jarak garis lurus ke titik dalam dataset. Tautan membuka rute berjalan di Google Maps; pintu masuk dan waktu tempuh perlu dicek.</p>` : '<p class="mosque-note">Data transportasi belum tersedia.</p>'}
    ${selection ? `<p class="mosque-home">${esc(selection.home.title)}${selection.example ? " (contoh hunian)" : ""}: ${esc(distanceText(distanceKm(mosque, selection.home)))} garis lurus dari masjid. <a href="${esc(googleMapsRoute(selection.home, mosque))}" ${external}>Cek rute hunian → masjid ↗</a></p>` : ""}
    <h3>Kontrakan / sewa sekitar</h3>
    ${mappedRentals.length ? `<ul class="mosque-rentals">${mappedRentals.map((rental) => `<li><a href="/?koleksi=sewa&sewa=${encodeURIComponent(rental.id)}">${esc(rental.title)}</a><small>${esc(rentText(rental))} · ≈ ${esc(distanceText(rental.nearbyMosques?.find((item) => item.id === mosque.id)?.km ?? 0))} dari titik acuan ${rental.location?.precision === "approximate" ? "perkiraan portal" : rental.location?.precision === "complex" ? "kompleks" : "gedung"}, bukan posisi unit. Harga dicek ${esc(checkedDate(rental.lastChecked))}.</small></li>`).join("")}</ul>` : ""}
    ${rentals.length ? `<ul class="mosque-rentals">${rentals.map((listing) => `<li><a href="/riset#${encodeURIComponent(listing.id)}">${esc(listing.title)}</a>${listing.kind === "lead" ? " · Petunjuk belum diverifikasi" : ""}<small>${esc(listing.relation)} ${esc(listing.note)}</small></li>`).join("")}</ul>` : mappedRentals.length ? "" : '<p class="mosque-note">Belum ada kontrakan atau sewa yang terhubung dalam katalog. Cari dari kawasan masjid; jarak unit belum diketahui.</p>'}
    <div class="mosque-actions"><a href="/riset#sewa">Jelajahi sewa & kontrakan ↗</a><a href="/riset#${encodeURIComponent(mosque.id)}">Hunian sekitar masjid ↗</a><a href="${esc(safeUrl(mosque.googleMapsUrl))}" ${external}>Titik Google Maps ↗</a><button type="button" class="popup-action" data-pin-mosque>Simpan sebagai pin</button></div>
  </article>`;
}
