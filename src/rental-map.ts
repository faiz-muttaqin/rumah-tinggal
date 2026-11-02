import { escapeHTML as esc } from "./geo.ts";
import { googleMapsLocation, googleMapsRoute } from "./maps-links.ts";
import {
  checkedDate,
  distanceText,
  monthlyRent,
  RENTAL_LABELS,
  type ResearchMosque,
  type ResearchRental,
  rentText,
  safeUrl,
} from "./research-data.ts";

export const RENTAL_MAP_GROUPS = [
  { id: "kontrakan", label: "Kontrakan", color: "#9a6435" },
  { id: "apartemen", label: "Apartemen", color: "#477592" },
  { id: "kos", label: "Kos", color: "#805c8e" },
  { id: "lainnya", label: "Sewa lainnya", color: "#65755b" },
] as const;

export type RentalMapKind = (typeof RENTAL_MAP_GROUPS)[number]["id"];

export function rentalMapKind(rental: ResearchRental): RentalMapKind {
  switch (rental.rentalType) {
    case "kontrakan":
    case "rumah-sewa":
      return "kontrakan";
    case "apartemen-sewa":
      return "apartemen";
    case "kos-keluarga":
      return "kos";
    default:
      return "lainnya";
  }
}

export function rentalLocationLabel(rental: ResearchRental): string {
  const point = rental.location;
  if (!point) return "Lokasi belum terbukti · belum ada pin";
  return point.precision === "approximate"
    ? "Pin perkiraan portal"
    : `${point.precision === "building" ? "Titik gedung" : "Titik kompleks"} · ${point.label}`;
}

export function rentalMosqueSummary(rental: ResearchRental): string {
  const closest = rental.nearbyMosques?.[0];
  return closest
    ? `${closest.name} · ≈ ${distanceText(closest.km)} dari titik acuan`
    : "Belum ada masjid Ihrish dalam 1,5 km dari titik acuan";
}

// Beberapa iklan di satu gedung/kompleks tetap pada satu titik, tanpa jitter.
export function rentalPinGroups(rentals: ResearchRental[]): ResearchRental[][] {
  const groups = new Map<string, ResearchRental[]>();
  for (const rental of rentals) {
    if (!rental.location) continue;
    const key = `${rental.location.lat},${rental.location.lng}`;
    const group = groups.get(key) ?? [];
    group.push(rental);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function rentalPopupHTML(
  rentals: ResearchRental[],
  mosques: ResearchMosque[] = [],
): string {
  const external = 'target="_blank" rel="noopener noreferrer"';
  return `<div class="mosque-popup" data-testid="rental-popup">${rentals.length > 1 ? `<h2>${rentals.length} sewa pada titik yang sama</h2>` : ""}${rentals
    .map((rental) => {
      const point = rental.location;
      if (!point) return "";
      const nearby = (rental.nearbyMosques ?? [])
        .map((near) => {
          const mosque = mosques.find((item) => item.id === near.id);
          return `<li><button class="rental-mosque-link" data-rental-mosque="${esc(near.id)}">${esc(near.name)} · ≈ ${esc(distanceText(near.km))}</button>${mosque ? `<a href="${esc(googleMapsRoute(point, mosque))}" ${external}>Rute dari titik acuan ↗</a>` : ""}</li>`;
        })
        .join("");
      return `<article class="rental-popup-item"><span class="mosque-kicker">${esc(RENTAL_LABELS[rental.rentalType])}</span><h2>${esc(rental.title)}</h2><p><strong>${esc(rentText(rental))}</strong></p><p>${esc(rentalLocationLabel(rental))}</p><p class="mosque-note">${esc(point.note)} Lokasi dicek ${esc(checkedDate(point.checkedAt))}; harga dicek ${esc(checkedDate(rental.lastChecked))}. Konfirmasi harga dan ketersediaan ke portal.</p><a href="${esc(safeUrl(point.url))}" ${external}>Sumber titik ↗</a><h3>Masjid Ihrish sekitar</h3>${nearby ? `<ul class="mosque-transit">${nearby}</ul>` : `<p class="mosque-note">${esc(rentalMosqueSummary(rental))}.</p>`}<p class="mosque-note">Jarak garis lurus dari titik acuan ${point.precision === "approximate" ? "perkiraan portal" : point.precision === "complex" ? "kompleks" : "gedung"}, bukan jarak dari pintu unit atau rute berjalan.</p><div class="mosque-actions"><a href="/?koleksi=sewa&sewa=${encodeURIComponent(rental.id)}">Tautan pin sewa</a><a href="${esc(googleMapsLocation(point))}" ${external}>Titik di Google Maps ↗</a><a href="/riset#${encodeURIComponent(rental.id)}">Bukti & rincian ↗</a><a href="${esc(safeUrl(rental.listingUrl))}" ${external}>Buka listing ↗</a></div></article>`;
    })
    .join("")}</div>`;
}

export function filterMapRentals(
  rentals: ResearchRental[],
  filters: {
    kinds: ReadonlySet<RentalMapKind>;
    area: string;
    query: string;
    maxMonthlyRent: number;
    sort: string;
    mosque?: string;
  },
): ResearchRental[] {
  const query = filters.query.trim().toLocaleLowerCase("id-ID");
  const result = rentals.filter((rental) => {
    const text = [
      rental.title,
      rental.area,
      rental.locationText,
      rental.buildingOrCluster ?? "",
      ...rental.evidence.map((item) => item.quote),
      ...rental.nearStationsClaim.map(
        (item) => `${item.station} ${item.quote}`,
      ),
      ...(rental.areaHighlights ?? []).map(
        (item) => `${item.name} ${item.description} ${item.relation}`,
      ),
      ...(rental.nearbyMosques ?? []).map((item) => item.name),
    ]
      .join(" ")
      .toLocaleLowerCase("id-ID");
    return (
      filters.kinds.has(rentalMapKind(rental)) &&
      (filters.area === "Semua" || rental.area === filters.area) &&
      (!query || text.includes(query)) &&
      (!filters.mosque ||
        filters.mosque === "all" ||
        (filters.mosque === "near"
          ? Boolean(rental.nearbyMosques?.length)
          : rental.nearbyMosques?.some(
              (item) => item.id === filters.mosque,
            ))) &&
      (!filters.maxMonthlyRent || monthlyRent(rental) <= filters.maxMonthlyRent)
    );
  });
  if (filters.sort === "price")
    result.sort((a, b) => monthlyRent(a) - monthlyRent(b));
  else
    result.sort(
      (a, b) =>
        (a.nearbyMosques?.[0]?.km ?? Infinity) -
        (b.nearbyMosques?.[0]?.km ?? Infinity),
    );
  return result;
}
