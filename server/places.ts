// Pencarian tempat (geocoding) melalui Photon/OpenStreetMap tanpa API key.
// Diproksikan server agar cache, batas laju, dan User-Agent terpusat.

import type { Place } from "../src/types.ts";

export type PlaceSearch = (query: string) => Promise<Place[]>;

const PHOTON_URL = "https://photon.komoot.io/api/";
// Batas kasar Jabodetabek, sama dengan batas koordinat form listing.
const BBOX = "106.3,-6.85,107.31,-5.75";
const CACHE_LIMIT = 500;
const CACHE_TTL = 60 * 60 * 1000;

interface PhotonFeature {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 160) : "";
}

export function parsePhoton(body: unknown): Place[] {
  const features = (body as { features?: unknown })?.features;
  if (!Array.isArray(features)) return [];
  const places: Place[] = [];
  const seen = new Set<string>();
  for (const feature of features as PhotonFeature[]) {
    const [lng, lat] = Array.isArray(feature.geometry?.coordinates)
      ? (feature.geometry.coordinates as unknown[])
      : [];
    const properties = feature.properties ?? {};
    if (
      typeof lng !== "number" ||
      typeof lat !== "number" ||
      lng < 106.3 ||
      lng > 107.31 ||
      lat < -6.85 ||
      lat > -5.75
    )
      continue;
    const street = [text(properties.street), text(properties.housenumber)]
      .filter(Boolean)
      .join(" ");
    const name = text(properties.name) || street;
    if (!name) continue;
    const detail = [
      street !== name ? street : "",
      text(properties.district) || text(properties.locality),
      text(properties.city) || text(properties.county),
    ]
      .filter((part, index, parts) => part && parts.indexOf(part) === index)
      .join(", ");
    const id = `${text(properties.osm_type)}${String(properties.osm_id ?? "")}`;
    const key = `${name}|${detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({
      id: id || key,
      name,
      detail,
      kind: text(properties.osm_value).replaceAll("_", " "),
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
    });
  }
  return places.slice(0, 6);
}

export function createPhotonSearch(fetcher: typeof fetch = fetch): PlaceSearch {
  const cache = new Map<string, { at: number; places: Place[] }>();
  return async (query) => {
    const key = query.toLocaleLowerCase("id-ID");
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.places;
    const url = new URL(PHOTON_URL);
    url.search = new URLSearchParams({
      q: query,
      limit: "10",
      bbox: BBOX,
      lat: "-6.25",
      lon: "106.83",
    }).toString();
    const response = await fetcher(url, {
      headers: {
        "User-Agent": "rumah-tinggal/1.0 (+https://rumah.faizmuttaqin.com)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error(`Photon ${response.status}`);
    const places = parsePhoton(await response.json());
    cache.delete(key);
    cache.set(key, { at: Date.now(), places });
    const oldest = cache.keys().next().value;
    if (cache.size > CACHE_LIMIT && oldest !== undefined) cache.delete(oldest);
    return places;
  };
}

// Batas laju sederhana per alamat klien: jendela tetap 60 detik.
export function createRateLimiter(limit = 40, windowMs = 60_000) {
  const hits = new Map<string, { start: number; count: number }>();
  return (client: string): boolean => {
    const now = Date.now();
    if (hits.size > 5000) hits.clear();
    const entry = hits.get(client);
    if (!entry || now - entry.start >= windowMs) {
      hits.set(client, { start: now, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}
