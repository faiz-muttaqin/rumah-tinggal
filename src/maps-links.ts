export interface MapCoordinates {
  lat: number;
  lng: number;
}

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

export function googleMapsLocation(location: MapCoordinates): string {
  return mapsUrl("search/", { query: coordinates(location) });
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
