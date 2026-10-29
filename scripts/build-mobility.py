"""Build public transit GeoJSON from cached OSM relation/<id>/full.json files.

Usage: python3 scripts/build-mobility.py INPUT_DIR OUTPUT --snapshot YYYY-MM-DD
Download the masters below, then their child route relations, into
INPUT_DIR/relation-<id>.json using https://api.openstreetmap.org/api/0.6/.
No network requests or raw editor/user metadata are included in the output.
"""

import argparse
import collections
import datetime
import hashlib
import json
import math
import pathlib
import re


SPECS = [
    ("mrt-north-south", 9677671, "MRT", "MRT Jakarta", "MRT Utara–Selatan", "#CE0037"),
    ("lrt-jakarta", 10693161, "LRT", "LRT Jakarta", "LRT Jakarta · Lin Selatan", "#f16227"),
    ("lrt-cibubur", 16035222, "LRT", "LRT Jabodebek", "LRT Jabodebek · Cibubur", "#20409A"),
    ("lrt-bekasi", 16079480, "LRT", "LRT Jabodebek", "LRT Jabodebek · Bekasi", "#0E6938"),
]
TJ_MASTERS = [16739342, 6783311, 17027439, 14717457, 16871390, 17011751,
              16035086, 17027438, 16935599, 17003245, 17004173, 16873303,
              13251860, 16732070]
TJ_COLORS = ["#cf1d24", "#264598", "#b59600", "#562a62", "#bc581a", "#2ea43f",
             "#e1245a", "#cc2790", "#409592", "#8e181e", "#2d4ca4", "#368349",
             "#802b7c", "#c36814"]
SPECS += [(f"tj-{n}", rid, "TransJakarta", "TransJakarta BRT",
           f"TransJakarta Koridor {n}", TJ_COLORS[n - 1])
          for n, rid in enumerate(TJ_MASTERS, 1)]


def normalize(value):
    return re.sub(r"[^a-z0-9]", "", value.lower())


def distance(a, b):
    lat = math.radians((a[1] + b[1]) / 2)
    return 111.2 * math.hypot((a[0] - b[0]) * math.cos(lat), a[1] - b[1])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    parser.add_argument("--snapshot", required=True, type=datetime.date.fromisoformat)
    args = parser.parse_args()
    source_versions = {}

    def load(rid):
        raw = (args.input / f"relation-{rid}.json").read_bytes()
        data = json.loads(raw)
        index = {(entry["type"], entry["id"]): entry for entry in data["elements"]}
        relation = index["relation", rid]
        source_versions[str(rid)] = {
            "version": relation["version"],
            "updatedAt": relation["timestamp"],
            "sha256": hashlib.sha256(raw).hexdigest(),
        }
        return relation, index

    lines = []
    stops = []
    stop_groups = collections.defaultdict(list)
    skipped_ways = collections.Counter()
    for line_id, master_id, mode, network, name, color in SPECS:
        master, _ = load(master_id)
        assert master["tags"].get("type") == "route_master", master_id
        route_ids = [member["ref"] for member in master["members"]
                     if member["type"] == "relation"]
        assert route_ids, master_id
        segments, station_ids, seen_ways = [], [], set()
        for rid in route_ids:
            relation, index = load(rid)
            assert relation["tags"].get("type") == "route", rid
            if mode == "TransJakarta":
                assert relation["tags"].get("ref") == line_id.removeprefix("tj-"), rid
            members = relation["members"]
            # Bus platforms are the waiting places. Rail relations here supply
            # stop_position nodes, which are not verified station entrances.
            stop_role = "platform" if mode == "TransJakarta" else "stop"
            for member in members:
                item = index[member["type"], member["ref"]]
                tags = item.get("tags", {})
                if member["type"] == "way" and member["role"] in ("", "forward", "backward"):
                    if member["ref"] in seen_ways:
                        continue
                    valid = (bool(tags.get("highway")) and tags["highway"] != "construction"
                             if mode == "TransJakarta"
                             else tags.get("railway") == ("subway" if mode == "MRT" else "light_rail"))
                    if not valid:
                        skipped_ways[line_id] += 1
                        continue
                    seen_ways.add(member["ref"])
                    coordinates = [[round(index["node", nid]["lon"], 7),
                                    round(index["node", nid]["lat"], 7)] for nid in item["nodes"]]
                    if len(coordinates) >= 2:
                        segments.append(coordinates)
                if not member["role"].startswith(stop_role) or not tags.get("name"):
                    continue
                if member["type"] == "node":
                    point = [item["lon"], item["lat"]]
                    point_kind = "platform" if mode == "TransJakarta" else "stop-position"
                elif member["type"] == "way":
                    nodes = list(dict.fromkeys(item["nodes"]))
                    point = [sum(index["node", nid][axis] for nid in nodes) / len(nodes)
                             for axis in ("lon", "lat")]
                    point_kind = "platform-centroid"
                else:
                    raise ValueError(f"Unsupported stop member: {member['type']} {member['ref']}")
                key = (mode, network, normalize(tags["name"]))
                candidates = stop_groups[key]
                existing = next((stop for stop in candidates
                                 if distance(stop["geometry"]["coordinates"], point) <= 0.35), None)
                source = f"https://www.openstreetmap.org/{member['type']}/{member['ref']}"
                if existing is None:
                    sid = f"{mode.lower()}-{member['type']}-{member['ref']}"
                    existing = {"type": "Feature", "id": sid, "properties": {
                        "id": sid, "name": tags["name"], "mode": mode, "network": network,
                        "color": color, "lines": [], "source": source, "sources": [],
                        "pointKind": point_kind,
                    }, "geometry": {"type": "Point", "coordinates": [round(x, 7) for x in point]}}
                    stops.append(existing)
                    candidates.append(existing)
                props = existing["properties"]
                if line_id not in props["lines"]:
                    props["lines"].append(line_id)
                if source not in props["sources"]:
                    props["sources"].append(source)
                if props["id"] not in station_ids:
                    station_ids.append(props["id"])
        assert segments and station_ids, line_id
        lines.append({"type": "Feature", "id": line_id, "properties": {
            "id": line_id, "name": name, "mode": mode, "network": network,
            "color": color, "source": f"https://www.openstreetmap.org/relation/{master_id}",
            "routeRelations": route_ids, "stationIds": station_ids,
            "geometryKind": "osm-highway" if mode == "TransJakarta" else "osm-railway",
            "snapshotDate": args.snapshot.isoformat(),
        }, "geometry": {"type": "MultiLineString", "coordinates": segments}})
    features = lines + sorted(stops, key=lambda stop: (stop["properties"]["mode"], stop["properties"]["name"]))
    all_coords = [point for line in lines for segment in line["geometry"]["coordinates"] for point in segment]
    all_coords += [stop["geometry"]["coordinates"] for stop in stops]
    assert all(106.35 <= x <= 107.30 and -6.85 <= y <= -6.0 for x, y in all_coords)
    assert len({feature["id"] for feature in features}) == len(features)
    collection = {"type": "FeatureCollection", "name": "MRT, LRT & TransJakarta — Rumah Tinggal",
                  "bbox": [min(p[0] for p in all_coords), min(p[1] for p in all_coords),
                           max(p[0] for p in all_coords), max(p[1] for p in all_coords)],
                  "metadata": {
                      "snapshotDate": args.snapshot.isoformat(), "attribution": "© OpenStreetMap contributors",
                      "attributionUrl": "https://www.openstreetmap.org/copyright",
                      "license": "ODbL-1.0", "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
                      "coverageNote": "MRT Utara–Selatan, LRT Jakarta, LRT Jabodebek Cibubur/Bekasi; TransJakarta 14 koridor utama BRT, tanpa pengumpan/Mikrotrans.",
                      "geometryNote": "Geometri way rel/jalan OSM tanpa sambungan buatan. Titik rail adalah stop_position; titik bus adalah platform atau centroid platform, bukan pintu masuk terverifikasi. Nama sama dalam satu jaringan dengan jarak <=350m digabung dari dua arah.",
                      "serviceNote": "Snapshot geografis komunitas, bukan jadwal, tarif atau status operasional; konfirmasi perjalanan ke operator.",
                      "skippedNonOperatingWays": dict(skipped_ways), "relationVersions": source_versions,
                  }, "features": features}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(json.dumps({"lines": len(lines), "stops": dict(collections.Counter(stop["properties"]["mode"] for stop in stops)),
                      "bytes": args.output.stat().st_size, "skippedWays": dict(skipped_ways)}))


if __name__ == "__main__":
    main()
