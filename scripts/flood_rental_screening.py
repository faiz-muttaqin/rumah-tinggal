"""Screen catalog coordinates against official historic flood evidence, not hazard scores.

Uses BIG polygon cache from all_station_catchments.py (downloads only with --run).
A report in the same kelurahan does not imply a flooded dwelling.
"""
import argparse
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("catchments", ROOT / "scripts/all_station_catchments.py")
geo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geo)
DATE = "2026-11-26"
EVIDENCE = ROOT / f"research/flood-official-evidence-{DATE}.json"


def read(path):
    return json.loads(path.read_text())


def matching_area(point, polygons):
    x, y = point
    hits = [row for row, parts, (w, s, e, n) in polygons
            if w <= x <= e and s <= y <= n and geo.polygon_distance(point, parts) == 0]
    return hits[0] if len(hits) == 1 else None


def build(rentals, locations, evidence, polygons):
    locs = {r["rentalId"]: r["location"] for r in locations}
    associations = {}
    for rid, a in evidence["reportLocalities"].items():
        key = a["bigCode"]
        associations.setdefault(key, []).append(rid)
    items = []
    for rental in rentals:
        rid = rental["id"]
        loc = locs[rid]
        row = {"rentalId": rid, "hazardStatus": "unknown", "locationStatus": "no-pin"}
        if loc:
            point = [loc["lng"], loc["lat"]]
            nearest = sorted((geo.haversine(point, [e["lng"], e["lat"]]), e["id"]) for e in evidence["points"])
            row.update(locationStatus="pinned", locationPrecision=loc["precision"],
                       nearestOfficialEvent={"id": nearest[0][1], "distanceMeters": round(nearest[0][0], 1)},
                       eventsWithin1km=[{"id": eid, "distanceMeters": round(d, 1)} for d, eid in nearest if d <= 1000],
                       eventsWithin3kmCount=sum(d <= 3000 for d, _ in nearest))
            area = matching_area(point, polygons)
            row["localityStatus"] = "mapped" if area else "unresolved"
            if area:
                row["locality"] = {k: area[k] for k in ("code", "name", "district", "city", "boundaryStatus")}
                key = area["code"]
                row["sameLocalityReportIds"] = associations.get(key, [])
        items.append(row)
    return items


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", action="store_true", help="Use/download BIG polygons")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    rentals = read(ROOT / "research/rentals.json")["rentals"]
    locations = read(ROOT / "research/rental-locations.json")["items"]
    evidence = read(EVIDENCE)
    polygons = geo.load_polygons(geo.stops())[1] if args.run else []
    items = build(rentals, locations, evidence, polygons)
    result = {"schemaVersion": 1, "checkedAt": DATE, "evidence": str(EVIDENCE.relative_to(ROOT)),
              "localitySource": geo.SOURCE, "localityMode": "BIG-polygons" if args.run else "not-run",
              "note": "Historical records, not risk classes. Distance to a public landmark is straight-line, not extent of flood or access route. Same-locality means a part of the area was reported. Unknown/no match never means safe.",
              "summary": {"rentals": len(items), "pinned": sum(r["locationStatus"] == "pinned" for r in items),
                          "mappedLocality": sum(r.get("localityStatus") == "mapped" for r in items),
                          "within1kmOfOfficialEvent": sum(bool(r.get("eventsWithin1km")) for r in items),
                          "within3kmOfOfficialEvent": sum(bool(r.get("eventsWithin3kmCount")) for r in items),
                          "sameLocalityReport": sum(bool(r.get("sameLocalityReportIds")) for r in items),
                          "hazardUnknown": len(items)}, "items": items}
    geo.dump(args.output, result)
    print(json.dumps(result["summary"]))


if __name__ == "__main__":
    main()
