"""Build a resumable 3 km transport-locality research inventory from BIG polygons.

Offline by default; --run fetches public polygons in bounded, cached batches.
Only the derived locality identifiers, approximate distances and counts are
published; raw boundary geometry stays in .runtime/research.
"""
import argparse
from collections import Counter
import datetime as dt
import json
import math
from pathlib import Path
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_DESAKEL_AR/MapServer/0/query"
FIELDS = "OBJECTID,NAMOBJ,WADMKD,WADMKC,WADMKK,WADMPR,KDEPUM,Status"
CACHE = ROOT / ".runtime/research/all-station-catchments"
RADII = (500, 1000, 1500, 2000, 3000)
MAX_RADIUS = RADII[-1]
OFFSET = 0.00001


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    tmp.replace(path)


def stops():
    rows = []
    for name in ("transit", "mobility"):
        for f in json.loads((ROOT / f"public/data/{name}.geojson").read_text())["features"]:
            if f["geometry"]["type"] == "Point":
                p = f["properties"]
                rows.append({"stopId": p["id"], "station": p["name"], "mode": p["mode"],
                             "lines": p["lines"], "coordinate": f["geometry"]["coordinates"],
                             "coordinateSource": p["source"],
                             **{k: p[k] for k in ("mappingNote", "pointKind") if k in p}})
    if len({s["stopId"] for s in rows}) != len(rows):
        raise ValueError("Duplicate stop ID")
    return sorted(rows, key=lambda s: (s["mode"], s["station"], s["stopId"]))


def read_query(params, cache_key):
    path = CACHE / (cache_key + ".json")
    if path.exists():
        return json.loads(path.read_text())
    url = SOURCE + "?" + urlencode(params)
    request = Request(url, headers={"User-Agent": "RumahTinggal public boundary research/1.0"})
    with urlopen(request, timeout=45) as response:
        raw = response.read(30_000_001)
    if len(raw) > 30_000_000:
        raise ValueError("Oversized boundary response")
    value = json.loads(raw)
    if value.get("error") or value.get("exceededTransferLimit"):
        raise ValueError("Truncated/error BIG response")
    dump(path, value)
    time.sleep(1)
    return value


def polygon_parts(geometry):
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiPolygon":
        return geometry["coordinates"]
    raise ValueError("Unexpected boundary geometry")


def contains(point, ring):
    x, y = point
    hit = False
    for a, b in zip(ring, ring[1:]):
        x1, y1 = a[:2]
        x2, y2 = b[:2]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            hit = not hit
    return hit


def edge_distance(point, ring, scale):
    x, y = point
    best = math.inf
    for a, b in zip(ring, ring[1:]):
        ax, ay = (a[0] - x) * scale, a[1] - y
        bx, by = (b[0] - x) * scale, b[1] - y
        dx, dy = bx - ax, by - ay
        sq = dx * dx + dy * dy
        t = max(0, min(1, -(ax * dx + ay * dy) / sq)) if sq else 0
        best = min(best, math.hypot(ax + t * dx, ay + t * dy))
    return best * 111195.08


def polygon_distance(point, parts):
    scale = math.cos(math.radians(point[1]))
    if any(contains(point, p[0]) and not any(contains(point, hole) for hole in p[1:]) for p in parts):
        return 0
    return min(edge_distance(point, ring, scale) for part in parts for ring in part)


def haversine(a, b):
    x, y, u, v = map(math.radians, [*a, *b])
    h = math.sin((v-y)/2)**2 + math.cos(y)*math.cos(v)*math.sin((u-x)/2)**2
    return 6371008.8 * 2 * math.asin(math.sqrt(min(1, h)))


def catalog():
    rentals = json.loads((ROOT / "research/rentals.json").read_text())["rentals"]
    locations = {i["rentalId"]: i["location"] for i in json.loads(
        (ROOT / "research/rental-locations.json").read_text())["items"]}
    points = []
    for r in rentals:
        loc = locations.get(r["id"])
        price = r["rent"]["amount"] / (12 if r["rent"]["period"] == "yearly" else 1)
        if loc and price <= 5_000_000:
            kind = "kos" if r["rentalType"].startswith("kos") else "apartemen" if r["kind"] == "Apartemen" else "rumah"
            points.append(([loc["lng"], loc["lat"]], kind))
    return points


def coverage(station, points):
    ds = [(haversine(station["coordinate"], p), kind) for p, kind in points]
    return {str(radius): {kind: sum(d <= radius and k == kind for d, k in ds)
                          for kind in ("rumah", "kos", "apartemen")} for radius in RADII}


def bounding_box(parts):
    xy = [v for p in parts for ring in p for v in ring]
    return [min(v[0] for v in xy), min(v[1] for v in xy),
            max(v[0] for v in xy), max(v[1] for v in xy)]


def load_polygons(stations):
    xs, ys = zip(*(s["coordinate"] for s in stations))
    # More than 3 km in both axes at Jabodetabek latitude.
    bbox = [min(xs)-0.035, min(ys)-0.035, max(xs)+0.035, max(ys)+0.035]
    bbox = [round(x, 6) for x in bbox]
    ids = read_query({"where": "TIPADM IN (1,2)", "geometry": ",".join(map(str,bbox)),
                      "geometryType": "esriGeometryEnvelope", "inSR": 4326,
                      "spatialRel": "esriSpatialRelIntersects", "returnIdsOnly": "true", "f": "json"},
                     "ids-" + "-".join(map(str,bbox)))["objectIds"]
    ids = sorted(set(ids))
    if not ids:
        raise ValueError("No BIG polygons")
    print(f"BIG: {len(ids)} polygon IDs", flush=True)
    polygons = []
    for i in range(0, len(ids), 100):
        batch = ids[i:i+100]
        import hashlib
        token = hashlib.sha256(",".join(map(str,batch)).encode()).hexdigest()[:16]
        result = read_query({"objectIds": ",".join(map(str,batch)), "outFields": FIELDS,
                             "returnGeometry": "true", "outSR": 4326,
                             "maxAllowableOffset": OFFSET, "f": "geojson"}, "polygons-" + token)
        features = result["features"]
        if {f["properties"]["OBJECTID"] for f in features} != set(batch):
            raise ValueError("Incomplete BIG polygon batch")
        for f in features:
            a = f["properties"]
            parts = polygon_parts(f["geometry"])
            row = {"objectId": a["OBJECTID"], "code": a.get("KDEPUM"),
                   "name": a.get("WADMKD") or a["NAMOBJ"], "district": a.get("WADMKC"),
                   "city": a.get("WADMKK"), "province": a.get("WADMPR"),
                   "boundaryStatus": a.get("Status")}
            polygons.append((row, parts, bounding_box(parts)))
        print(f"BIG: {len(polygons)}/{len(ids)} fetched", flush=True)
    return bbox, polygons


def build(stations, points, polygons):
    areas = {}
    for s in stations:
        s["existingPinnedCounts"] = coverage(s, points)
        x, y = s["coordinate"]
        matches = []
        for row, parts, (west, south, east, north) in polygons:
            if not west-0.03 <= x <= east+0.03 or not south-0.03 <= y <= north+0.03:
                continue
            distance = polygon_distance((x,y), parts)
            if distance <= MAX_RADIUS:
                oid = str(row["objectId"])
                areas[oid] = row
                matches.append({"areaId": oid, "distanceToBoundaryMeters": round(distance, 1),
                                "containsStop": distance == 0})
        s["areas"] = sorted(matches, key=lambda m: (m["distanceToBoundaryMeters"], m["areaId"]))
        s["boundaryStatus"] = "mapped" if matches else "no-intersection-returned"
    return areas


def make_queue(inventory):
    """Unique locality/type tasks; category gaps, not claims of missing market supply."""
    categories = ("rumah", "kos", "apartemen")
    stations = inventory["stations"]
    tasks = []
    for aid, area in inventory["areas"].items():
        related = [(s, a) for s in stations for a in s["areas"] if a["areaId"] == aid]
        for kind in categories:
            no_catalog = sum(not sum(s["existingPinnedCounts"]["3000"].values()) for s, _ in related)
            category_gap = sum(s["existingPinnedCounts"]["3000"][kind] == 0 for s, _ in related)
            near_gap = sum(s["existingPinnedCounts"]["1000"][kind] == 0 for s, _ in related)
            priority = 0 if no_catalog else 1 if category_gap else 2 if near_gap else 3
            tasks.append({"taskId": f'{area["code"]}:{kind}', "areaId": aid,
                          "category": kind, "priority": priority, "status": "pending",
                          "stopCount": len(related), "zeroCatalogStops": no_catalog,
                          "zeroCategoryStops3km": category_gap, "zeroCategoryStops1km": near_gap,
                          "nearestBoundaryMeters": min(a["distanceToBoundaryMeters"] for _, a in related)})
    if len({r["taskId"] for r in tasks}) != len(tasks):
        raise ValueError("Duplicate task code")
    return sorted(tasks, key=lambda r: (r["priority"], -r["zeroCatalogStops"],
                  -r["zeroCategoryStops3km"], r["nearestBoundaryMeters"], r["taskId"]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--output", type=Path, default=CACHE / "inventory.json")
    parser.add_argument("--queue-output", type=Path)
    parser.add_argument("--refresh", action="store_true", help="Discard downloaded local BIG query cache before run")
    args = parser.parse_args()
    stations = stops()
    points = catalog()
    bbox, areas = None, {}
    if args.refresh and not args.run:
        parser.error("--refresh requires --run")
    if args.run:
        if args.refresh:
            for path in CACHE.glob("*.json"):
                if path.name.startswith(("ids-", "polygons-")):
                    path.unlink()
        bbox, polygons = load_polygons(stations)
        areas = build(stations, points, polygons)
    else:
        for s in stations:
            s.update(existingPinnedCounts=coverage(s, points), areas=[], boundaryStatus="not-run")
    result = {"schemaVersion": 1, "checkedAt": dt.datetime.now(dt.timezone(dt.timedelta(hours=7))).date().isoformat(),
              "source": SOURCE, "stationSnapshot": "2026-10-29", "boundaryMode": "live-simplified-polygons" if args.run else "offline-plan",
              "boundaryBbox": bbox, "simplificationDegrees": OFFSET, "maximumRadiusMeters": MAX_RADIUS,
              "distanceMethod": "Approximate local equirectangular point-to-polygon, Haversine for catalog points; 3 km straight-line, not walking distance.",
              "note": "Mapped stop is not confirmation of service or station opening. ContainsStop means the point is inside a sourced polygon, not an entrance. BIG boundaries may be indicative; listings can be outside radius even when a locality intersects it. Catalog counts only price-filtered pinned entries, not availability.",
              "radiiMeters": RADII, "catalogPriceCapMonthly": 5000000,
              "catalogPinnedEntries": len(points), "areas": areas, "stations": stations}
    dump(args.output, result)
    if args.queue_output:
        if not args.run:
            parser.error("--queue-output requires --run")
        tasks = make_queue(result)
        dump(args.queue_output, {"schemaVersion": 1, "checkedAt": result["checkedAt"],
                                 "inventory": args.output.name,
                                 "note": "Each locality/type is searched once; inspect station references in inventory. Pending is not proof of no offers. P0 no catalog, P1 no category within 3 km, P2 no category within 1 km, P3 remaining.",
                                 "tasks": tasks})
    print(json.dumps({"stops": len(stations), "byMode": Counter(s["mode"] for s in stations),
                      "uniqueAreas": len(areas), "mapped": sum(bool(s["areas"]) for s in stations),
                      "containsStop": sum(any(a["containsStop"] for a in s["areas"]) for s in stations),
                      "pinnedEntries": len(points)}), flush=True)


if __name__ == "__main__":
    main()
