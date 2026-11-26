"""Produce Green Line proposals and station-by-station check ledgers.

Only the 16 points of the current production snapshot are import scope.
The supplemental four points are checked geometrically but are research-only.
No auto-import; search hints do not prove location or property availability.
"""
import argparse
from collections import Counter
import datetime as dt
import importlib.util
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("curate", ROOT / "scripts/corridor_priority_curate.py")
curate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(curate)
geo, screen, core = curate.geo, curate.screen, curate.core
DATE = "2026-11-26"
INVENTORY = ROOT / f"research/koridor-all-3km-{DATE}.json"
EXTENSION = ROOT / f"research/koridor-green-line-extension-{DATE}.json"


def read(path):
    return json.loads(Path(path).read_text())


def near(point, stops):
    distances = sorted((geo.haversine(point, st["coordinate"]), st["stopId"], st["station"], st["mode"]) for st in stops)
    return [{"stopId": sid, "station": station, "mode": mode, "km": round(distance / 1000, 3)}
            for distance, sid, station, mode in distances if distance <= 3000]


def production_scope(row, production_ids):
    return any(st["stopId"] in production_ids for st in row.get("nearbyGreenLine", []))


def prior_references():
    by_url = {}
    for path in sorted((ROOT / "research").glob("koridor-*-results-*.json")):
        if "green-line" in path.name:
            continue
        for run in read(path)["runs"]:
            for row in run["results"]:
                if row["status"] == "detail-read":
                    by_url[core.catalog_url(row["url"]).lower()] = {
                        "url": row["url"], "previousLedger": path.name, "status": row["status"],
                        "resolution": row["resolution"], "checkedAt": row.get("checkedAt"),
                        "location": row.get("location"), "category": curate.category(row)}
    for row in curate.read("rentals.json")["rentals"]:
        # A catalog entry takes precedence as the current catalog reference, not as a live stock check.
        key = core.catalog_url(row["listingUrl"]).lower()
        by_url.setdefault(key, {"url": row["listingUrl"], "previousLedger": "rentals.json",
                               "status": "catalogued", "checkedAt": row.get("lastChecked"),
                               "category": curate.catalog_category(row)})
        by_url[key]["catalogId"] = row["id"]
    return by_url


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("seeds", type=Path)
    parser.add_argument("live", type=Path, nargs="+")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    seeds = read(args.seeds)
    day = dt.date.fromisoformat(seeds["checkedAt"])
    inventory = read(INVENTORY)
    base = [s for s in inventory["stations"] if s["mode"] == "KRL" and "rangkasbitung" in s["lines"]]
    extension = read(EXTENSION)["stations"]
    stops = base + extension
    production_ids = {s["stopId"] for s in base}
    # Retain original BIG cache extent for existing stations. Fetch a small
    # separate supplemental bbox rather than changing historical snapshots.
    _, bp = geo.load_polygons(geo.stops())
    _, ep = geo.load_polygons(extension)
    polygons = list({p[0]["objectId"]: p for p in bp + ep}.values())
    rental_rows = curate.read("rentals.json")["rentals"]
    locs = {r["rentalId"]: r["location"] for r in curate.read("rental-locations.json")["items"]}
    sources = {s["url"]: s for s in seeds["sources"]}
    seed_lookup = {r["url"]: r for r in seeds["seeds"]}
    buildings = {(x["provider"], x["buildingName"], x["bigCode"]): x for x in seeds.get("buildingLocalityEvidence", [])}
    runs, proposals = [], []
    seen = set()
    for path in args.live:
        for run in read(path)["runs"]:
            for row in run["results"]:
                key = core.catalog_url(row["url"]).lower()
                if key in seen:
                    raise ValueError(f"Duplicate detail in combined runs: {key}")
                seen.add(key)
                hints = set(row.get("stationHints", []))
                hints.update(seed_lookup.get(row["url"], {}).get("stationHints", []))
                hints.update(sources.get(row.get("discovery"), {}).get("stationHints", []))
                row["stationHints"] = sorted(hints)
                loc = row.get("location")
                area = None
                row["nearbyGapTransit"] = []  # original gap task is not the criterion for this pass
                row["nearbyGreenLine"] = []
                if loc:
                    point = [loc["lng"], loc["lat"]]
                    row["nearbyGreenLine"] = near(point, stops)
                    area = screen.matching_area(point, polygons)
                row["eligibleTaskTransit"] = ([s for s in row["nearbyGreenLine"] if s["stopId"] in production_ids]
                                              or row["nearbyGreenLine"])
                if area:
                    row["bigLocality"] = {k: area[k] for k in ("code", "name", "district", "city", "province", "boundaryStatus")}
                    row["matchedTaskId"] = area["code"] + ":" + curate.category(row)
                    evidence = buildings.get((row["provider"], row.get("buildingName"), area["code"]))
                    if evidence and loc["precision"] == "building":
                        row["buildingLocalityEvidence"] = evidence
                row["resolution"] = curate.resolution(row, area, day)
                if row["resolution"] != "candidate":
                    continue
                category = curate.category(row)
                # Tiny or fractional specs can be a source typo, not an importable dwelling.
                if row["buildingAreaM2"] < (4 if category == "kos" else 10) or row["bedrooms"] != int(row["bedrooms"]):
                    row["resolution"] = "hold-implausible-specifications"
                    continue
                suspects = curate.duplicate(row, rental_rows, locs)
                if suspects:
                    row.update(resolution="hold-possible-duplicate", possibleDuplicates=suspects)
                    continue
                # The production map ends at Tigaraksa and has a five-region schema.
                outside_radius = not production_scope(row, production_ids)
                unsupported_region = not any(n in area["city"].lower() for n in ("jakarta", "depok", "bekasi", "tangerang", "bogor"))
                if outside_radius or unsupported_region:
                    lead_id = "green-research-" + hashlib.sha256(key.encode()).hexdigest()[:12]
                    row.update(resolution="research-only-outside-production", researchLeadId=lead_id,
                               productionScopeReason="outside-production-radius" if outside_radius else "unsupported-region")
                    # Also screen near-duplicates among research-only candidates.
                    rental_rows.append({"id":lead_id,"listingUrl":row["url"],"rentalType":"kos-keluarga" if category=="kos" else "apartemen-sewa" if category=="apartemen" else "rumah-sewa",
                                        "kind":"Apartemen" if category=="apartemen" else "Rumah","sourcePortal":row["provider"],
                                        "sizeM2":row["buildingAreaM2"],"bedrooms":row["bedrooms"],"rent":{"amount":row["amount"],"period":row["period"]}})
                    locs[lead_id] = loc
                    continue
                p = curate.proposal(row, area)
                proposals.append(p)
                new = p["rental"]
                rental_rows.append(new)
                locs[new["id"]] = p["location"]["location"]
                row.update(resolution="proposed-partial", rentalId=new["id"])
            runs.append(run)
    prior = prior_references()
    checks = []
    rows = [row for run in runs for row in run["results"]]
    search_rows = [row for run in runs for row in run["searches"]]
    for q in seeds["stationQueries"]:
        st = next(s for s in stops if s["station"] == q["station"])
        name, sid = st["station"], st["stopId"]
        targeted = [r for r in rows if name in r["stationHints"]]
        nearby = [r for r in rows if any(s["stopId"] == sid for s in r["nearbyGreenLine"])]
        search = [s for s in search_rows if name in sources.get(s["url"], {}).get("stationHints", [])]
        prev = []
        for url in sorted(set(q["alreadyCheckedUrls"])):
            ref = prior.get(core.catalog_url(url).lower())
            if not ref:
                continue
            ref = dict(ref)
            loc = ref.pop("location", None)
            if ref.get("catalogId") and locs.get(ref["catalogId"]):
                loc = locs[ref["catalogId"]]
            ref["distanceMeters"] = round(geo.haversine([loc["lng"],loc["lat"]],st["coordinate"]), 1) if loc else None
            prev.append(ref)
        checks.append({"station":name,"stopId":sid,"scope":"production" if sid in production_ids else "research-only",
                       "coordinate":st["coordinate"],"coordinateSource":st["coordinateSource"],
                       "localitiesWithin3km":len(st["areas"]),"queries":q["queries"],"webResultCount":q["webResultCount"],
                       "searchPages":[{"url":r["url"],"status":r["status"],"selected":r.get("selected",0)} for r in search],
                       "targetedDetailCount":len(targeted),"targetedDetailRead":sum(r["status"]=="detail-read" for r in targeted),
                       "targetedResolutions":dict(Counter(r["resolution"] for r in targeted)),
                       "detailsWithActualPinWithin3km":len(nearby),
                       "nearbyResolutions":dict(Counter(r["resolution"] for r in nearby)),
                       "priorReferences":prev,
                       "supplementalQueries":[r["query"] for r in seeds.get("supplementalDiscovery",[]) if r["station"]==name],
                       "manualLeads":[r["url"] for r in seeds.get("manualLeads",[]) if r["station"]==name],
                       "newCandidates":[{"url":r["url"],"resolution":r["resolution"],"category":curate.category(r),
                                         "distanceKm":next(s["km"] for s in r["nearbyGreenLine"] if s["stopId"]==sid)}
                                        for r in nearby if r["resolution"] in ("proposed-partial","research-only-outside-production")],
                       "before":geo.coverage(st,geo.catalog()),
                       "note":"Bounded observations, not exhaustive; no qualifying match does not prove absence of supply."})
    data = {"schemaVersion":1,"checkedAt":seeds["checkedAt"],"mode":"live","inventory":INVENTORY.name,
            "extension":EXTENSION.name,"seeds":args.seeds.name,"note":"No advertiser contact. Research-only outside production points. Pins are approximate; distance is straight-line.",
            "runs":runs,"stationChecks":checks,"proposals":proposals,"summary":dict(Counter(r["resolution"] for r in rows))}
    geo.dump(args.output,data)
    print(json.dumps(data["summary"]))


if __name__ == "__main__":
    main()
