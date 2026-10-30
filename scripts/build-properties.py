"""Build public/data/properties.geojson from the curated research file.

Usage: python3 scripts/build-properties.py [INPUT] [OUTPUT] [--check]
Defaults: research/properties.json -> public/data/properties.geojson.

The script makes no network requests. It validates every entry (links,
price, dates, quotes, no personal contact data), then computes the region
and the nearest KRL/MRT/LRT stations itself from the app's own GeoJSON, so
the published distance never relies on a marketing claim. Entries farther
than maxDistanceKm from every station are dropped and reported.

Area context is merged from research/context/population.json, written by
scripts/build-population-context.py. An estimate is kept only when it was
computed for the project's current coordinate.
"""

import argparse
import datetime
import json
import math
import pathlib
import re
import sys
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
BBOX = (106.3, -6.85, 107.31, -5.75)
KINDS = {"Rumah", "Apartemen"}
STATUSES = {"dipasarkan", "pre-launch", "inden", "siap-huni", "tidak-jelas"}
VERDICTS = {"confirmed", "partial"}
SOURCE_KINDS = {"developer", "portal", "news", "instagram", "government", "osm", "other"}
SUPPORTS = {"harga", "status", "lokasi", "transit", "unit"}
AREAS = {"Jakarta", "Bogor", "Depok", "Tangerang", "Bekasi"}
QUOTE_LIMIT = 150
MAX_STATIONS = 4
# Kontak pribadi tidak boleh ikut dipublikasikan.
CONTACT = re.compile(
    r"(?:\+?62|\b0)8\d{2}[\s.-]?\d{3,4}[\s.-]?\d{3,5}|wa\.me/|[\w.+-]+@[\w-]+\.[\w.]+"
)
SOCIAL_HOSTS = ("instagram.com", "facebook.com", "threads.net", "tiktok.com")


class Invalid(ValueError):
    pass


def distance(a, b):
    lat = math.radians((a[1] + b[1]) / 2)
    return 111.2 * math.hypot((a[0] - b[0]) * math.cos(lat), a[1] - b[1])


def is_date(value):
    try:
        datetime.date.fromisoformat(str(value)[:10])
        return True
    except ValueError:
        return False


def url(value, field):
    if not isinstance(value, str):
        raise Invalid(f"{field}: URL wajib berupa teks")
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or "@" in parsed.netloc:
        raise Invalid(f"{field}: URL harus http(s) tanpa kredensial: {value}")
    return value


def text(value, field, limit=400, optional=False):
    if value is None and optional:
        return None
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise Invalid(f"{field}: teks wajib, maksimal {limit} karakter")
    if CONTACT.search(value):
        raise Invalid(f"{field}: memuat nomor telepon/WhatsApp/email")
    return value.strip()


def number(value, field, optional=False, integer=False):
    if value is None and optional:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0:
        raise Invalid(f"{field}: angka positif wajib")
    if integer and int(value) != value:
        raise Invalid(f"{field}: harus bilangan bulat")
    return int(value) if integer else value


def load_stations():
    stations = []
    transit = json.loads((ROOT / "public/data/transit.geojson").read_text())
    mobility = json.loads((ROOT / "public/data/mobility.geojson").read_text())
    for feature in transit["features"] + mobility["features"]:
        props = feature["properties"]
        mode = props.get("mode", "KRL")
        if feature["geometry"]["type"] != "Point" or mode not in ("KRL", "MRT", "LRT"):
            continue
        lng, lat = feature["geometry"]["coordinates"]
        stations.append({"mode": mode, "name": props["name"], "lng": lng, "lat": lat})
    return stations


def inside(point, ring):
    x, y = point
    hit = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            hit = not hit
    return hit


def segment_km(point, a, b):
    # Jarak titik ke segmen dalam proyeksi ekuirektangular lokal.
    scale = math.cos(math.radians(point[1]))
    px, py = point[0] * scale, point[1]
    ax, ay, bx, by = a[0] * scale, a[1], b[0] * scale, b[1]
    dx, dy = bx - ax, by - ay
    t = 0 if dx == dy == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return 111.2 * math.hypot(px - ax - t * dx, py - ay - t * dy)


def locate_region(point, regions):
    for feature in regions:
        rings = feature["geometry"]["coordinates"]
        if inside(point, rings[0]) and not any(inside(point, hole) for hole in rings[1:]):
            return feature["properties"], False
    # Batas wilayah disederhanakan; titik tepi dekat batas diberi wilayah terdekat.
    best = min(
        (
            (min(segment_km(point, a, b) for a, b in zip(ring, ring[1:])), feature["properties"])
            for feature in regions
            for ring in feature["geometry"]["coordinates"][:1]
        ),
        key=lambda item: item[0],
    )
    return (best[1], True) if best[0] <= 2 else (None, False)


def validate_source(source, field):
    if not isinstance(source, dict):
        raise Invalid(f"{field}: sumber tidak valid")
    link = url(source.get("url"), f"{field}.url")
    kind = source.get("kind")
    if kind not in SOURCE_KINDS:
        raise Invalid(f"{field}.kind tidak dikenal: {kind}")
    fetched = source.get("fetched")
    if not isinstance(fetched, bool):
        raise Invalid(f"{field}.fetched wajib boolean")
    host = urllib.parse.urlsplit(link).netloc.lower()
    if fetched and any(host == h or host.endswith("." + h) for h in SOCIAL_HOSTS):
        raise Invalid(f"{field}: media sosial tidak boleh diambil otomatis ({link})")
    supports = source.get("supports") or []
    if not set(supports) <= SUPPORTS:
        raise Invalid(f"{field}.supports tidak dikenal: {supports}")
    page_date = source.get("pageDate")
    if page_date is not None and not is_date(page_date):
        raise Invalid(f"{field}.pageDate harus YYYY-MM-DD")
    return {
        "url": link,
        "kind": kind,
        "title": text(source.get("title"), f"{field}.title", 200),
        "fetched": fetched,
        "pageDate": page_date[:10] if page_date else None,
        "supports": sorted(set(supports), key=["harga", "status", "lokasi", "transit", "unit"].index),
        "note": text(source.get("note"), f"{field}.note", 300, optional=True),
    }


def load_population():
    path = ROOT / "research/context/population.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    source = data.get("source") or {}
    for key in ("id", "name", "publisher", "licence"):
        text(source.get(key), f"population.source.{key}", 160)
    for key in ("url", "fileUrl", "licenceUrl"):
        url(source.get(key), f"population.source.{key}")
    if not is_date(source.get("checkedAt")) or not is_date(source.get("published")):
        raise Invalid("population.source: checkedAt/published harus YYYY-MM-DD")
    return data


def population_of(pid, point, population):
    estimate = (population or {}).get("properties", {}).get(pid)
    # Estimasi dibuang bila titik proyek berubah sesudah raster dihitung.
    if not estimate or (round(estimate["lng"], 6), round(estimate["lat"], 6)) != point:
        return None
    values = {k: estimate.get(k) for k in ("within500m", "within1km", "densityKm2")}
    if not all(isinstance(v, int) and v >= 0 for v in values.values()):
        raise Invalid(f"{pid}.population: nilai harus bilangan bulat >= 0")
    return values


def build_property(entry, stations, regions, max_km, population=None):
    pid = entry.get("id")
    if not isinstance(pid, str) or not re.fullmatch(r"prj-[a-z0-9-]{3,80}", pid):
        raise Invalid(f"id tidak valid: {pid}")
    field = lambda name: f"{pid}.{name}"  # noqa: E731
    if entry.get("excludeReason"):
        return None, text(entry["excludeReason"], field("excludeReason"), 400)
    if entry.get("kind") not in KINDS:
        raise Invalid(f"{field('kind')} harus Rumah atau Apartemen")
    if entry.get("status") not in STATUSES:
        raise Invalid(f"{field('status')} tidak dikenal")
    if entry.get("verdict") not in VERDICTS:
        raise Invalid(f"{field('verdict')} harus confirmed atau partial")
    if not is_date(entry.get("lastChecked")):
        raise Invalid(f"{field('lastChecked')} harus YYYY-MM-DD")
    price = entry.get("price") or {}
    low = number(price.get("min"), field("price.min"), integer=True)
    high = number(price.get("max"), field("price.max"), optional=True, integer=True)
    if high is not None and high < low:
        raise Invalid(f"{field('price')}: max lebih kecil dari min")
    if not 50_000_000 <= low <= 100_000_000_000:
        raise Invalid(f"{field('price.min')} di luar rentang wajar: {low}")
    if price.get("pageDate") is not None and not is_date(price["pageDate"]):
        raise Invalid(f"{field('price.pageDate')} harus YYYY-MM-DD")
    coordinate = entry.get("coordinate")
    if coordinate is None:
        return None, "belum ada koordinat terverifikasi, jarak stasiun belum bisa dihitung"
    if not isinstance(coordinate, dict):
        raise Invalid(f"{field('coordinate')} tidak valid")
    lat, lng = coordinate.get("lat"), coordinate.get("lng")
    if not all(isinstance(v, (int, float)) for v in (lat, lng)) or not (
        BBOX[0] <= lng <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]
    ):
        raise Invalid(f"{field('coordinate')} di luar Jabodetabek")
    point = (round(lng, 6), round(lat, 6))
    ranked = sorted(
        (
            {"mode": s["mode"], "name": s["name"], "km": round(distance(point, (s["lng"], s["lat"])), 2),
             "lat": s["lat"], "lng": s["lng"]}
            for s in stations
        ),
        key=lambda s: s["km"],
    )
    nearest = [s for s in ranked if s["km"] <= max_km][:MAX_STATIONS]
    if not nearest:
        return None, f"di luar radius: stasiun terdekat {ranked[0]['mode']} {ranked[0]['name']} {ranked[0]['km']} km"
    region, fallback = locate_region(point, regions)
    sources = [validate_source(s, f"{field('sources')}[{i}]") for i, s in enumerate(entry.get("sources") or [])]
    if not sources:
        raise Invalid(f"{field('sources')} wajib diisi")
    if len({s["url"] for s in sources}) != len(sources):
        raise Invalid(f"{field('sources')} memuat URL ganda")
    if not any(s["fetched"] and "harga" in s["supports"] for s in sources):
        raise Invalid(f"{field('sources')}: harga harus didukung sumber yang dibuka")
    units = []
    for i, unit in enumerate(entry.get("units") or []):
        units.append({
            "label": text(unit.get("label"), f"{field('units')}[{i}].label", 120),
            "bedrooms": unit.get("bedrooms") if isinstance(unit.get("bedrooms"), int) else None,
            "landArea": number(unit.get("landArea"), f"{field('units')}[{i}].landArea", optional=True),
            "buildingArea": number(unit.get("buildingArea"), f"{field('units')}[{i}].buildingArea", optional=True),
            "price": number(unit.get("price"), f"{field('units')}[{i}].price", optional=True, integer=True),
        })
    claim = entry.get("transitClaim")
    official = entry.get("officialUrl")
    properties = {
        "id": pid,
        "name": text(entry.get("name"), field("name"), 160),
        "developer": text(entry.get("developer"), field("developer"), 160, optional=True),
        "kind": entry["kind"],
        "subsidized": entry.get("subsidized") if isinstance(entry.get("subsidized"), bool) else None,
        "locationText": text(entry.get("locationText"), field("locationText"), 200),
        "region": region["name"] if region else None,
        "area": region["area"] if region and region["area"] in AREAS else None,
        "status": entry["status"],
        "statusQuote": text(entry.get("statusQuote"), field("statusQuote"), QUOTE_LIMIT, optional=True),
        "statusUrl": url(entry["statusUrl"], field("statusUrl")) if entry.get("statusUrl") else None,
        "price": {
            "min": low,
            "max": high,
            "basis": text(price.get("basis"), field("price.basis"), 120),
            "quote": text(price.get("quote"), field("price.quote"), QUOTE_LIMIT),
            "url": url(price.get("url"), field("price.url")),
            "pageDate": price["pageDate"][:10] if price.get("pageDate") else None,
            "currency": "IDR",
        },
        "units": units,
        "transitClaim": {
            "quote": text(claim.get("quote"), field("transitClaim.quote"), QUOTE_LIMIT),
            "url": url(claim.get("url"), field("transitClaim.url")),
        } if claim else None,
        "officialUrl": url(official, field("officialUrl")) if official else None,
        "coordinate": {
            "method": text(coordinate.get("method"), field("coordinate.method"), 80),
            "url": url(coordinate.get("url"), field("coordinate.url")),
            "precision": text(coordinate.get("precision"), field("coordinate.precision"), 40),
            "note": "Wilayah dari batas terdekat; titik berada di tepi batas yang disederhanakan."
            if fallback else text(coordinate.get("note"), field("coordinate.note"), 200, optional=True),
        },
        "nearest": nearest,
        "population": population_of(pid, point, population),
        "verdict": entry["verdict"],
        "sources": sources,
        "lastChecked": entry["lastChecked"][:10],
        "corridor": text(entry.get("corridor"), field("corridor"), 60),
        "methods": [text(m, field("methods"), 60) for m in entry.get("methods") or []],
    }
    return {
        "type": "Feature",
        "id": pid,
        "geometry": {"type": "Point", "coordinates": list(point)},
        "properties": properties,
    }, None


def build(source):
    regions = json.loads((ROOT / "public/data/regions.geojson").read_text())["features"]
    stations = load_stations()
    population = load_population()
    max_km = source.get("maxDistanceKm", 3)
    features, dropped, seen = [], [], set()
    for entry in source.get("properties", []):
        if entry.get("id") in seen:
            raise Invalid(f"id ganda: {entry.get('id')}")
        seen.add(entry.get("id"))
        feature, reason = build_property(entry, stations, regions, max_km, population)
        if feature:
            features.append(feature)
        else:
            dropped.append({"id": entry["id"], "name": text(entry.get("name"), "name", 160), "reason": reason})
    features.sort(key=lambda f: f["id"])
    included = {}
    for feature in features:
        corridor = feature["properties"]["corridor"]
        included[corridor] = included.get(corridor, 0) + 1
    if not is_date(source.get("checkedAt")):
        raise Invalid("checkedAt harus YYYY-MM-DD")
    methods = []
    for method in source.get("methods", []):
        methods.append({
            "id": text(method.get("id"), "methods.id", 60),
            "name": text(method.get("name"), "methods.name", 120),
            "category": text(method.get("category"), "methods.category", 60),
            "summary": text(method.get("summary"), "methods.summary", 600),
            "steps": [text(s, "methods.steps", 400) for s in method.get("steps", [])],
            "limits": [text(s, "methods.limits", 400) for s in method.get("limits", [])],
            "recommended": bool(method.get("recommended")),
            "lastUsed": method.get("lastUsed") if is_date(method.get("lastUsed")) else source["checkedAt"],
            "sources": [
                {"url": url(s.get("url"), "methods.sources.url"), "title": text(s.get("title"), "methods.sources.title", 160)}
                for s in method.get("sources", [])
            ],
        })
    return {
        "type": "FeatureCollection",
        "metadata": {
            "title": "Riset proyek hunian dekat KRL, MRT, dan LRT",
            "checkedAt": source["checkedAt"],
            "timezone": "Asia/Jakarta",
            "currency": "IDR",
            "maxDistanceKm": max_km,
            "distanceNote": "Jarak garis lurus dari titik proyek ke titik stasiun OSM snapshot 2026-10-29, dihitung scripts/build-properties.py.",
            "priceNote": "Harga dari halaman sumber yang dibuka pada tanggal cek; bukan penawaran, dapat berubah.",
            "methods": methods,
            "coverage": [
                {"id": c["id"], "label": c["label"], "found": c["found"], "included": included.get(c["id"], 0)}
                for c in source.get("coverage", [])
            ],
            "gaps": [text(g, "gaps", 400) for g in source.get("gaps", [])],
            "excluded": sorted(dropped, key=lambda d: d["id"]),
            "population": {
                "source": population["source"],
                "method": text(population["method"], "population.method", 400),
                "caveats": [text(c, "population.caveats", 300) for c in population["caveats"]],
                "radiiKm": population["radiiKm"],
            } if population else None,
        },
        "features": features,
    }, dropped


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", type=pathlib.Path, default=ROOT / "research/properties.json")
    parser.add_argument("output", nargs="?", type=pathlib.Path, default=ROOT / "public/data/properties.geojson")
    parser.add_argument("--check", action="store_true", help="fail if OUTPUT is not up to date")
    args = parser.parse_args()
    try:
        result, dropped = build(json.loads(args.input.read_text()))
    except Invalid as error:
        sys.exit(f"Data riset tidak valid: {error}")
    body = json.dumps(result, ensure_ascii=False, indent=1) + "\n"
    for item in dropped:
        print(f"Dilewati: {item['id']}: {item['reason']}", file=sys.stderr)
    if args.check:
        if not args.output.exists() or args.output.read_text() != body:
            sys.exit(f"{args.output} belum diperbarui; jalankan scripts/build-properties.py")
        print(f"OK: {len(result['features'])} proyek, {len(dropped)} dilewati")
        return
    args.output.write_text(body)
    print(f"Ditulis {args.output}: {len(result['features'])} proyek, {len(dropped)} dilewati")


if __name__ == "__main__":
    main()
