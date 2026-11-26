"""Create review proposals and a task ledger for a bounded corridor crawl.

Does not modify the catalog. Requires cached/accessible BIG polygons, public
detail pins, explicit price and active status. A proposed listing is not a
confirmation of housing availability or flood safety.
"""
import argparse
from collections import Counter
import datetime as dt
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("screen", ROOT / "scripts/flood_rental_screening.py")
screen = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(screen)
geo = screen.geo
SPEC = importlib.util.spec_from_file_location("priority", ROOT / "scripts/corridor_priority_batch.py")
priority = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(priority)
core = priority.core


def read(name):
    return json.loads((ROOT / "research" / name).read_text())


def category(row):
    return "kos" if row["provider"] == "mamikos" else "apartemen" if row.get("kind") == "Apartemen" else "rumah"


def catalog_category(row):
    return "kos" if row["rentalType"].startswith("kos") else "apartemen" if row["kind"] == "Apartemen" else "rumah"


def normal(text):
    return re.sub(r"[^a-z0-9]", "", text.lower())


def resolution(row, area, day):
    if row["status"] != "detail-read":
        return row["status"]
    if row.get("sourceStatus") != "unit_type_status.active":
        return "hold-availability"
    if row.get("issues"):
        return "hold-source-issues"
    if row["provider"] == "pinhome" and re.search(r"(?:^|[-/])kos(?:t|an|kosan)?(?:-|/|$)", row["url"]):
        return "hold-room-or-house-use"
    amount, period = row.get("amount"), row.get("period")
    if type(amount) not in (int, float) or not math.isfinite(amount) or amount != int(amount) or not 100000 <= amount <= 200000000 or period not in ("monthly", "yearly"):
        return "hold-price"
    monthly = amount / (12 if period == "yearly" else 1)
    if monthly > 5_000_000:
        return "outside-budget"
    if row.get("monthlyEquivalent") != monthly:
        return "hold-price"
    if not row.get("location") or row["location"].get("precision") not in ("building", "approximate") or not row.get("nearbyGapTransit"):
        return "outside-gap-or-no-pin"
    if not area:
        return "hold-unresolved-big-locality"
    # Detail labels are a separate check from point-in-polygon. Require
    # district/locality corroboration rather than treating a search hint as proof.
    raw_labels = [x.strip() for x in (row.get("locality") or "").split(",") if x.strip()]
    labels = [normal(re.sub(r"^(?:kecamatan|kec\.?|kelurahan|kel\.?|desa)\s+", "", x, flags=re.I)) for x in raw_labels]
    if row["provider"] == "pinhome":
        # Parenthesized aliases such as Rawabuntu (Rawa Buntu) are explicit in the detail.
        aliases = [normal(x) for x in re.split(r"[()]", raw_labels[0])] if raw_labels else []
        matches = normal(area["name"]) in aliases
    else:
        matches = any(normal(area[k]) in labels for k in ("name", "district"))
    if not matches and not row.get("buildingLocalityEvidence"):
        return "hold-locality-mismatch"
    stamp = row.get("sourceUpdatedAt")
    if stamp:
        try:
            age = (day - dt.date.fromisoformat(stamp[:10])).days
        except ValueError:
            return "hold-source-date"
        if not 0 <= age <= 365:
            return "hold-source-date"
    if category(row) == "kos":
        policy = row.get("residentPolicy") or {}
        if row.get("residentGender") != "campur" or policy.get("marriedCouplesAllowed") is not True or policy.get("childrenAllowed") is not True:
            return "hold-resident-policy"
    if category(row) == "apartemen" and (row["provider"] == "jendela360" and not row.get("buildingName")):
        return "hold-building-name"
    if row.get("bedrooms") is None or row.get("buildingAreaM2") is None:
        return "hold-missing-specifications"
    return "candidate"


def duplicate(row, rentals, locs):
    url = core.catalog_url(row["url"]).lower()
    slug = url.rstrip("/").split("/")[-1]
    result = []
    for r in rentals:
        existing_url = core.catalog_url(r["listingUrl"]).lower()
        if url == existing_url:
            return [r["id"]]
        if catalog_category(r) != category(row):
            continue
        # Different explicit unit codes on the same provider are separate offers.
        if row["provider"] == "jendela360" and r.get("sourcePortal") == "jendela360" and "/sewa-apartemen/" in existing_url and slug != existing_url.rstrip("/").split("/")[-1]:
            continue
        p = locs.get(r["id"])
        size, other_size = row.get("buildingAreaM2"), r.get("sizeM2")
        if not p or not size or not other_size or r.get("bedrooms") != row.get("bedrooms"):
            continue
        distance = geo.haversine([row["location"]["lng"], row["location"]["lat"]], [p["lng"], p["lat"]])
        old = r["rent"]["amount"] / (12 if r["rent"]["period"] == "yearly" else 1)
        if distance <= 100 and abs(size - other_size) <= 5 and abs(old - row["monthlyEquivalent"]) <= max(old, row["monthlyEquivalent"]) * .1:
            result.append(r["id"])
    return result


def proposal(row, area):
    provider, url = row["provider"], row["url"]
    amount, period = int(row["amount"]), row["period"]
    kind = category(row)
    bedrooms, size = int(row["bedrooms"]), row["buildingAreaM2"]
    building = row.get("buildingName")
    city = area["city"]
    if city in ("Bogor", "Tangerang", "Bekasi") and area["code"].startswith(("32.01.", "36.03.", "32.16.")):
        city = "Kabupaten " + city
    local = f'{area["name"]}, {area["district"]}, {city}'
    where = next((n for n in ("Jakarta", "Depok", "Bekasi", "Tangerang", "Bogor") if n.lower() in area["city"].lower()), None)
    if not where:
        raise ValueError(f"unsupported catalog region: {area['city']}")
    if kind == "apartemen":
        title = f'{building or "Apartemen " + area["name"]} — {"Studio" if bedrooms == 0 else str(bedrooms) + " kamar"}, {size:g} m²'
        if provider == "jendela360":
            title += f' ({url.rstrip("/").split("/")[-1]})'
        note = "Harga paket pada detail portal, bukan jaminan stok. Konfirmasi harga akhir, IPL, deposit, utilitas, dan ketentuan penghuni. "
        rt = "apartemen-sewa"
    elif kind == "kos":
        title = f'Kos keluarga {area["name"]} — {size:g} m²'
        note = "Detail portal menandai kos campur, pasutri dan anak diizinkan. Konfirmasi biaya penghuni tambahan, deposit, syarat, dan stok. "
        rt = "kos-keluarga"
    else:
        title = f'{"Kontrakan" if period == "monthly" else "Rumah sewa"} {area["name"]} — {bedrooms} kamar, {size:g} m²'
        note = "Harga dan status aktif pada detail portal; konfirmasi ketersediaan, pembayaran, deposit, biaya lain dan lokasi sebelum survei. "
        rt = "kontrakan" if period == "monthly" else "rumah-sewa"
    near = row["nearbyGapTransit"][0]
    note += f'Jarak garis lurus sekitar {near["km"]:.2f} km ke {near["mode"]} {near["station"]}.'
    rid = "sewa-" + provider + "-" + hashlib.sha256(url.lower().encode()).hexdigest()[:12]
    quote = f'Rp{amount:,}'.replace(",", ".") + ("/tahun" if period == "yearly" else "/bulan")
    posted = row["sourceUpdatedAt"][:10] if row.get("sourceUpdatedAt") else None
    rent = dict(amount=amount, period=period, quote=quote, url=url, pageDate=posted)
    if period == "yearly":
        rent["minimumMonths"] = 12
    elif row.get("minimumRentMonths"):
        rent["minimumMonths"] = int(row["minimumRentMonths"])
    evidence = [dict(quote=quote, url=url)]
    if address := row.get("buildingLocalityEvidence"):
        evidence.append(dict(quote=address["label"], url=address["url"]))
        note += " Alamat gedung dicocokkan dengan sumber alamat dan batas BIG."
    rental = dict(id=rid, title=title, kind="Apartemen" if kind == "apartemen" else "Rumah", rentalType=rt, area=where, locationText=local,
                  buildingOrCluster=building, rent=rent, bedrooms=bedrooms, sizeM2=size, furnished=None,
                  evidence=evidence, nearStationsClaim=[], listingUrl=url, sourcePortal=provider,
                  postedOrUpdated=posted, ownerType="unknown", social=[], verdict="partial",
                  lastChecked=row["checkedAt"], note=note)
    review = {}
    if kind == "kos":
        evidence.append(dict(quote="Detail portal: kategori campur; pasutri dan anak diizinkan.", url=url))
        rental["residentGender"] = {"value": "mixed", "checkedAt": row["checkedAt"]}
        review.update(couples=True, children=True)
    loc = row["location"]
    location = dict(rentalId=rid, location={**loc, "label": f'Acuan gedung {provider}' if loc["precision"] == "building" else f'Pin perkiraan {provider}',
                    "url": url, "method": "Titik publik pada detail penawaran; dicocokkan dengan batas BIG", "checkedAt": row["checkedAt"]},
                    note="Titik acuan gedung/portal, bukan koordinat unit. Jarak garis lurus; verifikasi lokasi pintu masuk dan rute aktual.")
    return {"rental": rental, "location": location, "review": review}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("live", type=Path)
    parser.add_argument("seeds", type=Path)
    parser.add_argument("--inventory", type=Path, default=ROOT / "research/koridor-all-3km-2026-11-26.json")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.live.read_text())
    seeds = json.loads(args.seeds.read_text())
    day = dt.date.fromisoformat(seeds["checkedAt"])
    inventory = json.loads(args.inventory.read_text())
    positions = geo.load_polygons(geo.stops())[1]
    rentals = read("rentals.json")["rentals"]
    locs = {r["rentalId"]: r["location"] for r in read("rental-locations.json")["items"]}
    old_points = geo.catalog()
    tasks = {q["taskId"]: {"taskId": q["taskId"], "query": q["q"], "detailMatches": 0, "proposed": 0}
             for b in seeds["batches"] for q in b["queries"]}
    gaps = [s for s in inventory["stations"] if not sum(s["existingPinnedCounts"]["3000"].values())]
    buildings = {(x["provider"], x["buildingName"], x["bigCode"]): x for x in seeds.get("buildingLocalityEvidence", [])}
    proposals = []
    for run in data["runs"]:
        for row in run["results"]:
            loc = row.get("location")
            area = screen.matching_area([loc["lng"], loc["lat"]], positions) if loc else None
            if loc:
                # Re-evaluate with the inventory distance definition before rounding.
                near = sorted((geo.haversine([loc["lng"], loc["lat"]], s["coordinate"]), s["stopId"], s["station"], s["mode"]) for s in gaps)
                row["nearbyGapTransit"] = [{"stopId": sid, "station": station, "mode": mode, "km": round(distance / 1000, 3)}
                                           for distance, sid, station, mode in near if distance <= 3000]
            task_id = None
            if area:
                match = buildings.get((row["provider"], row.get("buildingName"), area["code"]))
                if match and loc["precision"] == "building":
                    row["buildingLocalityEvidence"] = match
                row["bigLocality"] = {k: area[k] for k in ("code", "name", "district", "city", "boundaryStatus")}
                task_id = area["code"] + ":" + category(row)
                row["matchedTaskId"] = task_id
                if task_id in tasks:
                    tasks[task_id]["detailMatches"] += 1
            row["resolution"] = resolution(row, area, day)
            if row["resolution"] != "candidate":
                continue
            suspects = duplicate(row, rentals, locs)
            if suspects:
                row.update(resolution="hold-possible-duplicate", possibleDuplicates=suspects)
                continue
            p = proposal(row, area)
            proposals.append(p)
            rental = p["rental"]
            rentals.append(rental)
            locs[rental["id"]] = p["location"]["location"]
            row.update(resolution="proposed-partial", rentalId=rental["id"])
            if task_id in tasks:
                tasks[task_id]["proposed"] += 1
    for t in tasks.values():
        t["status"] = "bounded-detail-match" if t["detailMatches"] else "attempted-no-matching-detail"
    points = old_points + [([p["location"]["location"]["lng"], p["location"]["location"]["lat"]], catalog_category(p["rental"])) for p in proposals]
    data["tasks"] = list(tasks.values())
    data["gapCoverage"] = [{"stopId": s["stopId"], "station": s["station"], "mode": s["mode"],
                           "before": geo.coverage(s, old_points), "proposed": geo.coverage(s, points)} for s in gaps]
    data["summary"] = dict(Counter(r["resolution"] for g in data["runs"] for r in g["results"]))
    data["proposals"] = proposals
    geo.dump(args.output, data)
    print(json.dumps(data["summary"]))


if __name__ == "__main__":
    main()
