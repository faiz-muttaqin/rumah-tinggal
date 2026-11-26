export interface MapCoordinates {
  lat: number;
  lng: number;
}

// Gedung Artha Graha, SCBD Lot 25. Building reference point, not an entrance.
export const ARTHA_GRAHA_SCBD = {
  lat: -6.2246,
  lng: 106.8109,
  name: "Gedung Artha Graha",
  area: "SCBD Lot 25",
};

// Map pin for Gedung Artha Graha, from the Google Maps place page. The 8 km filter
// and route links keep ARTHA_GRAHA_SCBD so their boundary does not move.
export const ARTHA_GRAHA_PIN: MapCoordinates = {
  lat: -6.2244179,
  lng: 106.8105479,
};

function coordinates(point: MapCoordinates): string {
  return `${point.lat},${point.lng}`;
}

function mapsUrl(
  path: "search/" | "dir/",
  parameters: Record<string, string>,
): string {
  const url = new URL(`https://www.google.com/maps/${path}`);
  url.search = new URLSearchParams({ api: "1", ...parameters }).toString();
  return url.toString();
}

export function googleMapsLocation(location: MapCoordinates | string): string {
  return mapsUrl("search/", {
    query: typeof location === "string" ? location : coordinates(location),
  });
}

export function googleMapsDirections(destination: MapCoordinates): string {
  return mapsUrl("dir/", { destination: coordinates(destination) });
}

export function googleMapsWalkToStation(
  home: MapCoordinates,
  station: MapCoordinates,
): string {
  return mapsUrl("dir/", {
    origin: coordinates(home),
    destination: coordinates(station),
    travelmode: "walking",
  });
}

export function googleMapsRoute(
  origin: MapCoordinates,
  destination: MapCoordinates,
): string {
  return mapsUrl("dir/", {
    origin: coordinates(origin),
    destination: coordinates(destination),
  });
}

export function googleMapsToScbd(origin: MapCoordinates): string {
  return mapsUrl("dir/", {
    origin: coordinates(origin),
    destination: `${ARTHA_GRAHA_SCBD.name}, ${ARTHA_GRAHA_SCBD.area}, Jakarta`,
    travelmode: "transit",
  });
}
