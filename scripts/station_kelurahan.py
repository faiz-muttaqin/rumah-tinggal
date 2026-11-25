"""Plan/query BIG village polygons intersecting a station buffer.

Offline by default. --run explicitly enables public REST requests. Never
publishes output or mutates the crawler's manually reviewed targets.
"""
import argparse
import datetime as dt
import json
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
SOURCE = "https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_DESAKEL_AR/MapServer/0/query"
FIELDS = "OBJECTID,NAMOBJ,WADMKD,WADMKC,WADMKK,WADMPR,KDEPUM,Status"
RADII = (500, 1000, 1500, 2000)


def query_url(station, radius):
    lng, lat = station["coordinate"]
    return SOURCE + "?" + urlencode({
        "where": "TIPADM IN (1,2)", "geometry": f"{lng},{lat}",
        "geometryType": "esriGeometryPoint", "inSR": 4326,
        "spatialRel": "esriSpatialRelIntersects", "distance": radius,
        "units": "esriSRUnit_Meter", "outFields": FIELDS,
        "returnGeometry": "false", "f": "json",
    })


def parse_response(payload):
    if payload.get("error") or payload.get("exceededTransferLimit"):
        raise ValueError("BIG error or truncated response")
    if not isinstance(payload.get("features"), list):
        raise ValueError("Missing BIG features")
    rows = []
    for item in payload["features"]:
        a = item["attributes"]
        if not a.get("NAMOBJ") and not a.get("WADMKD"):
            raise ValueError("Missing village name")
        rows.append({"objectId": a["OBJECTID"], "code": a.get("KDEPUM"),
                     "name": a.get("WADMKD") or a["NAMOBJ"], "district": a.get("WADMKC"),
                     "city": a.get("WADMKK"), "province": a.get("WADMPR"),
                     "boundaryStatus": a.get("Status")})
    return sorted(rows, key=lambda a: a["objectId"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--station", action="append", default=[], help="Exact seed station name; repeatable")
    parser.add_argument("--output", type=Path, default=ROOT / ".runtime/research/corridor/boundaries.json")
    args = parser.parse_args()
    target = json.loads((ROOT / "research/koridor-station-targets.json").read_text())
    stations = [s for s in target["stations"] if not args.station or s["station"] in args.station]
    if not stations or set(args.station) - {s["station"] for s in stations}:
        parser.error("Unknown station")
    output = args.output.resolve()
    if not output.is_relative_to(ROOT / ".runtime/research"):
        parser.error("Output must be inside .runtime/research")
    report = {"source": SOURCE, "retrievedAtUTC": dt.datetime.now(dt.timezone.utc).isoformat(),
              "mode": "live" if args.run else "plan", "stations": []}
    for s in stations:
        entry = {"station": s["station"], "stopId": s["stopId"], "queries": []}
        previous = set()
        for radius in RADII:
            url = query_url(s, radius)
            row = {"radiusMeters": radius, "url": url, "status": "not-run"}
            if args.run:
                try:
                    req = Request(url, headers={"User-Agent": "RumahTinggal station boundary research/1.0"})
                    with urlopen(req, timeout=25) as response:
                        villages = parse_response(json.load(response))
                    ids = {v["objectId"] for v in villages}
                    if not ids or not previous <= ids:
                        raise ValueError("Empty or inconsistent nested buffer")
                    previous = ids
                    row.update(status="ok", villages=villages)
                except (OSError, ValueError, KeyError, TypeError) as exc:
                    row.update(status="error", error=type(exc).__name__)
                time.sleep(2)
            entry["queries"].append(row)
        report["stations"].append(entry)
    output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    errors = sum(q["status"] == "error" for s in report["stations"] for q in s["queries"])
    print(json.dumps({"stations": len(stations), "queries": len(stations) * len(RADII), "errors": errors}))
    return int(bool(errors))


if __name__ == "__main__":
    raise SystemExit(main())
