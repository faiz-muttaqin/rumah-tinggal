"""SCBD locality discovery: offline plan by default; explicit --run queries official DKI polygons.

The 10 km straight-line buffer is only a superset for possible 10 km road routes.
It does not establish road accessibility or distance. Outside DKI requires BIG polygons.
Results are private review artifacts, never automatically imported.
"""
import argparse
import json
import math
import os
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "https://gis-dpmptsp.jakarta.go.id/arcgis/rest/services/Hosted/Batas_Administrasi_Kelurahan_DKI_Jakarta/FeatureServer/85/query"
FIELDS = "fid,wadmkd,wadmkc,wadmkk,kdepum"


def query_url(anchor, meters):
    return SOURCE + "?" + urlencode({
        "where": "1=1", "geometry": f"{anchor['lng']},{anchor['lat']}",
        "geometryType": "esriGeometryPoint", "inSR": 4326,
        "spatialRel": "esriSpatialRelIntersects", "distance": meters,
        "units": "esriSRUnit_Meter", "outFields": FIELDS,
        "returnGeometry": "false", "f": "json",
    })


def parse_rows(payload):
    if payload.get("error") or payload.get("exceededTransferLimit"):
        raise ValueError("Service error or truncated boundary response")
    if not isinstance(payload.get("features"), list) or not payload["features"]:
        raise ValueError("Missing boundary features")
    rows = {}
    for feature in payload["features"]:
        a = feature["attributes"]
        code = a["kdepum"]
        if not code or not all(a.get(k) for k in ("wadmkd", "wadmkc", "wadmkk")):
            raise ValueError("Missing administrative identity")
        row = {"code": code, "name": a["wadmkd"], "district": a["wadmkc"], "city": a["wadmkk"]}
        if code in rows and rows[code] != row:
            raise ValueError("Conflicting administrative code")
        rows[code] = row
    return rows


def km(a, b):
    lat1, lat2 = map(math.radians, (a["lat"], b["lat"]))
    dlat = lat2 - lat1
    dlng = math.radians(b["lng"] - a["lng"])
    h = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2)**2
    return 6371.0088 * 2 * math.asin(math.sqrt(min(1.0, h)))


def within_scope(straight_km, road_km):
    for value in (straight_km, road_km):
        if value is not None and (not math.isfinite(value) or value < 0):
            raise ValueError("Invalid distance")
    if straight_km is not None and straight_km <= 8:
        return "eligible-straight"
    if road_km is not None and road_km <= 10:
        return "eligible-road"
    if straight_km is not None and straight_km > 10:
        return "outside"  # Road path cannot be shorter than geodesic distance.
    if straight_km is not None and road_km is not None:
        return "outside"
    return "unverified"


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", action="store_true")
    args = parser.parse_args()
    seed = json.loads((ROOT / "research/scbd-area-seeds-2026-11-26.json").read_text())
    report = {"anchor": seed["anchor"], "source": SOURCE, "scope": "DKI only",
              "mode": "live" if args.run else "plan", "queries": [], "areas": []}
    results = {}
    for meters in (8000, 10000):
        url = query_url(seed["anchor"], meters)
        entry = {"meters": meters, "url": url, "status": "not-run"}
        if args.run:
            try:
                req = Request(url, headers={"User-Agent": "RumahTinggal SCBD boundary research/1.0"})
                with urlopen(req, timeout=30) as response:
                    results[meters] = parse_rows(json.load(response))
                entry.update(status="ok", count=len(results[meters]))
            except (OSError, ValueError, KeyError, TypeError) as exc:
                entry.update(status="error", error=type(exc).__name__)
        report["queries"].append(entry)
    if len(results) == 2:
        if not results[8000].keys() <= results[10000].keys():
            report["consistencyError"] = "Non-nested results"
        else:
            report["areas"] = [
                {**row, "intersects8km": code in results[8000], "road10km": "unverified"}
                for code, row in sorted(results[10000].items())
            ]
    output = ROOT / ".runtime/research/scbd-catchment"
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    (output / "boundaries.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"seedAreas": len(seed["areas"]), "queries": report["queries"],
                      "verifiedPolygonCandidates": len(report["areas"])}))
    return int(args.run and (len(results) != 2 or "consistencyError" in report))


if __name__ == "__main__":
    raise SystemExit(main())
