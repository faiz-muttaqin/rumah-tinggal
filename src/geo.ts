import type { Listing, Station } from "./types.ts";

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function nearestStation(
  listing: Pick<Listing, "lat" | "lng">,
  stations: Station[],
): { station: Station; distance: number } | undefined {
  let closest: { station: Station; distance: number } | undefined;
  for (const station of stations) {
    const distance = distanceKm(listing, station);
    if (!closest || distance < closest.distance)
      closest = { station, distance };
  }
  return closest;
}

export function money(value: number): string {
  return value >= 1000000000
    ? `Rp ${(value / 1000000000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`
    : `Rp ${(value / 1000000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} jt`;
}

export function escapeHTML(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] ?? char,
  );
}
