"""Merge verified research results into research/properties.json.

Usage: python3 scripts/merge-research.py RESULT.json [RESULT.json ...]
       --checked-at YYYY-MM-DD [--labels LABELS.json] [--research FILE]

RESULT.json is the return value of a research run: {"results": [{"item":
ID, "found": {"candidates": [...]}, "verified": [{"results": [{"key",
"verdict", "checks", "record"}]}]}]}. This is the shape produced by
research/property-research.workflow.js, but any tool producing it works.
LABELS.json maps item ID to a readable coverage label.

Only "confirmed" and "partial" verdicts with a purchase price are merged.
Projects found in several corridors are merged by normalised name, keeping
the stronger verdict and the union of sources. An existing entry with the
same id is replaced by the fresh check, keeping its coordinate when the new
check has none. Methods and gaps already in the research file are kept. The
script prints every adjustment that needs a human look; it never invents
missing values.
"""

import argparse
import json
import pathlib
import re
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTACT = re.compile(r"(?:\+?62|\b0)8\d{2}[\s.-]?\d{3,4}[\s.-]?\d{3,5}|wa\.me/|[\w.+-]+@[\w-]+\.[\w.]+")
RANK = {"confirmed": 2, "partial": 1}
METHOD_BY_KIND = {
    "portal": "portal-proyek-baru",
    "developer": "situs-developer",
    "news": "berita",
    "government": "program-pemerintah",
    "instagram": "tautan-instagram-dari-pencarian",
}


def slug(name):
    plain = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return "prj-" + re.sub(r"[^a-z0-9]+", "-", plain.lower()).strip("-")[:70].strip("-")


def norm(name):
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", name).lower())


def clean(value, limit, where, notes):
    if value is None:
        return None
    value = re.sub(r"\s+", " ", str(value)).strip()
    if CONTACT.search(value):
        notes.append(f"{where}: kontak pribadi dihapus dari teks")
        value = CONTACT.sub("[kontak dihapus]", value)
    if len(value) > limit:
        notes.append(f"{where}: dipotong ke {limit} karakter")
        value = value[: limit - 1].rstrip() + "…"
    return value or None


def kind_of(record, notes, where):
    if record["kind"] in ("Rumah", "Apartemen"):
        return record["kind"]
    text = " ".join([record.get("name", ""), record["price"].get("basis", "")] + [u.get("label", "") for u in record.get("units") or []]).lower()
    kind = "Apartemen" if re.search(r"apartemen|apartment|studio|\b[123] ?br\b|tower|rusun", text) else "Rumah"
    notes.append(f"{where}: jenis Campuran dipetakan ke {kind}; periksa")
    return kind


def entry_from(record, verdict, corridor, checked_at, notes):
    where = record["name"]
    price = record["price"]
    sources, seen = [], set()
    for source in record.get("sources") or []:
        if source["url"] in seen:
            continue
        seen.add(source["url"])
        sources.append({
            "url": source["url"],
            "kind": source["kind"],
            "title": clean(source.get("title") or source["url"], 200, where, notes),
            "fetched": bool(source.get("fetched")) and source["kind"] != "instagram",
            "pageDate": (source.get("pageDate") or "")[:10] or None,
            "supports": source.get("supports") or [],
            "note": clean(source.get("note"), 300, where, notes),
        })
    if price["url"] not in seen:
        sources.insert(0, {"url": price["url"], "kind": "other", "title": "Sumber harga", "fetched": True,
                           "pageDate": (price.get("pageDate") or "")[:10] or None, "supports": ["harga"], "note": None})
        notes.append(f"{where}: URL harga ditambahkan sebagai sumber; periksa jenisnya")
    coordinates = record.get("coordinates")
    status = record.get("status") or {}
    claim = record.get("transitClaim")
    return {
        "id": slug(record["name"]),
        "name": clean(record["name"], 160, where, notes),
        "developer": clean(record.get("developer"), 160, where, notes),
        "kind": kind_of(record, notes, where),
        "subsidized": record.get("subsidized"),
        "locationText": clean(record["locationText"], 200, where, notes),
        "status": status.get("value") if status.get("value") != "habis" else "tidak-jelas",
        "statusQuote": clean(status.get("quote"), 150, where, notes),
        "statusUrl": status.get("url"),
        "price": {
            "min": price["min"],
            "max": price.get("max") if price.get("max") and price["max"] > price["min"] else None,
            "basis": clean(price["basis"], 120, where, notes),
            "quote": clean(price["quote"], 150, where, notes),
            "url": price["url"],
            "pageDate": (price.get("pageDate") or "")[:10] or None,
        },
        "units": [
            {k: unit.get(k) for k in ("label", "bedrooms", "landArea", "buildingArea", "price")}
            for unit in (record.get("units") or [])[:4]
        ],
        "transitClaim": {"quote": clean(claim["quote"], 150, where, notes), "url": claim["url"]} if claim else None,
        "officialUrl": record.get("officialUrl"),
        "coordinate": {
            "lat": coordinates["lat"], "lng": coordinates["lng"], "method": clean(coordinates["method"], 80, where, notes),
            "url": coordinates["url"], "precision": "titik proyek", "note": None,
        } if coordinates else None,
        "osmQuery": record.get("osmQuery"),
        "sources": sources,
        "verdict": verdict,
        "lastChecked": checked_at,
        "corridor": corridor,
        "methods": sorted({METHOD_BY_KIND[s["kind"]] for s in sources if s["kind"] in METHOD_BY_KIND}),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("results", nargs="+", type=pathlib.Path)
    parser.add_argument("--checked-at", required=True)
    parser.add_argument("--labels", type=pathlib.Path)
    parser.add_argument("--research", type=pathlib.Path, default=ROOT / "research/properties.json")
    args = parser.parse_args()
    research = json.loads(args.research.read_text()) if args.research.exists() else {"maxDistanceKm": 3, "methods": [], "gaps": []}
    labels = json.loads(args.labels.read_text()) if args.labels else {}
    merged, coverage, notes = {}, {c["id"]: c for c in research.get("coverage", [])}, []
    for path in args.results:
        for item in json.loads(path.read_text())["results"]:
            found = (item.get("found") or {}).get("candidates") or []
            coverage[item["item"]] = {"id": item["item"], "label": labels.get(item["item"], item["item"]), "found": len(found)}
            for batch in item.get("verified") or []:
                for result in batch.get("results") or []:
                    record = result["record"]
                    if result["verdict"] not in RANK or not record.get("price") or not record["price"].get("min"):
                        continue
                    entry = entry_from(record, result["verdict"], item["item"], args.checked_at, notes)
                    key = norm(entry["name"])
                    old = merged.get(key)
                    if old:
                        notes.append(f"{entry['name']}: muncul di {old['corridor']} dan {entry['corridor']}, digabung")
                        stronger, weaker = (entry, old) if RANK[entry["verdict"]] > RANK[old["verdict"]] else (old, entry)
                        urls = {s["url"] for s in stronger["sources"]}
                        stronger["sources"] += [s for s in weaker["sources"] if s["url"] not in urls]
                        stronger["coordinate"] = stronger["coordinate"] or weaker["coordinate"]
                        entry = stronger
                    merged[key] = entry
    by_id = {e["id"]: e for e in research.get("properties", [])}
    for entry in merged.values():
        previous = by_id.get(entry["id"])
        if previous and not entry["coordinate"]:
            entry["coordinate"] = previous.get("coordinate")
        by_id[entry["id"]] = entry
    research["checkedAt"] = args.checked_at
    research["coverage"] = sorted(coverage.values(), key=lambda c: c["id"])
    research["properties"] = sorted(by_id.values(), key=lambda e: e["id"])
    args.research.parent.mkdir(parents=True, exist_ok=True)
    args.research.write_text(json.dumps(research, ensure_ascii=False, indent=2) + "\n")
    for note in notes:
        print(f"Periksa: {note}")
    missing = sum(1 for e in research["properties"] if not e.get("coordinate"))
    print(f"{len(merged)} proyek digabung; {len(research['properties'])} total; {missing} belum punya koordinat")


if __name__ == "__main__":
    main()
