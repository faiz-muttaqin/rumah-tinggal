"""Propose OSM coordinates for research entries that have none.

Usage: python3 scripts/geocode-properties.py [INPUT] [--write] [--contact URL]
Default INPUT: research/properties.json. Reads each entry with "coordinate":
null and an "osmQuery", asks OpenStreetMap Nominatim once per entry, and
accepts a result only when its OSM name shares a distinctive word with the
project name and its class is a residential area, place or building.

Nominatim usage policy: at most one request per second, an identifying
User-Agent, and caching. Results are cached in .runtime/research/ (ignored by
Git). Without --write the script only prints proposals. Existing coordinates
are never overwritten. Unmatched entries are listed for manual review.
"""

import argparse
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / ".runtime/research/geocode-cache.json"
ENDPOINT = "https://nominatim.openstreetmap.org/search"
VIEWBOX = "106.3,-5.75,107.31,-6.85"
GENERIC = {
    "perumahan", "residence", "residences", "apartemen", "apartment", "apartments",
    "city", "the", "park", "garden", "gardens", "village", "regency", "tower", "towers", "cluster",
    "new", "grand", "kota", "taman", "griya", "graha", "puri", "permata", "hills", "dan", "di",
    "at", "by", "jakarta", "bekasi", "bogor", "depok", "tangerang", "selatan", "barat", "timur",
    "utara", "tod", "hunian", "rumah", "estate", "mansion", "sky", "one",
}
# Desa/kelurahan (place=village) sengaja ditolak: namanya sering sama dengan
# nama proyek, tetapi titiknya pusat desa, bukan lokasi proyek.
ACCEPT = {
    ("place", "suburb"), ("place", "neighbourhood"), ("place", "quarter"),
    ("landuse", "residential"), ("building", "apartments"),
    ("building", "residential"), ("building", "yes"),
}
PRECISION = {"building": "gedung OSM", "landuse": "kawasan OSM", "place": "kawasan OSM"}


def words(value):
    return {w for w in re.findall(r"[a-z0-9]+", value.lower()) if len(w) > 2 and w not in GENERIC}


def accepted(result, name):
    category = result.get("category") or result.get("class")
    if (category, result.get("type")) not in ACCEPT:
        return False
    wanted = words(name)
    common = words(result.get("name") or "") & wanted
    # Minimal separuh kata khas nama proyek harus ada pada nama OSM.
    return bool(common) and len(common) * 2 >= len(wanted)


def search(query, contact, cache):
    if query in cache:
        return cache[query], False
    params = urllib.parse.urlencode({
        "q": query, "format": "jsonv2", "limit": 5, "countrycodes": "id",
        "viewbox": VIEWBOX, "bounded": 1,
    })
    request = urllib.request.Request(
        f"{ENDPOINT}?{params}",
        headers={"User-Agent": f"rumah-tinggal-research/0.1 (+{contact})", "Accept-Language": "id"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        cache[query] = json.loads(response.read())
    return cache[query], True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", type=pathlib.Path, default=ROOT / "research/properties.json")
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--contact", default="https://rumah.faizmuttaqin.com")
    args = parser.parse_args()
    data = json.loads(args.input.read_text())
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    changed, unmatched = 0, []
    for entry in data.get("properties", []):
        if entry.get("coordinate") or not entry.get("osmQuery"):
            continue
        results, remote = search(entry["osmQuery"], args.contact, cache)
        if remote:
            time.sleep(1.1)
        match = next((r for r in results if accepted(r, entry["name"])), None)
        if not match:
            unmatched.append(f"{entry['id']}: {entry['osmQuery']} ({len(results)} hasil, tidak ada nama cocok)")
            continue
        category = match.get("category") or match.get("class")
        entry["coordinate"] = {
            "lat": round(float(match["lat"]), 6),
            "lng": round(float(match["lon"]), 6),
            "method": "OSM Nominatim",
            "url": f"https://www.openstreetmap.org/{match['osm_type']}/{match['osm_id']}",
            "precision": PRECISION.get(category, "kawasan OSM"),
            "note": f"Cocok dengan nama OSM \"{match.get('name')}\"; bukan titik pemasaran resmi.",
        }
        changed += 1
        print(f"{entry['id']}: {match.get('name')} {entry['coordinate']['url']}")
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False))
    for line in unmatched:
        print(f"Perlu cek manual: {line}")
    if args.write and changed:
        args.input.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(f"{changed} titik diusulkan{' dan ditulis' if args.write else ''}, {len(unmatched)} perlu cek manual")


if __name__ == "__main__":
    main()
