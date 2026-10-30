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

Mosques with regular kajian and Islamic education for children come from
research/context/islamic.json; each project lists the evidenced facilities
within its radius, nearest first, plus claims quoted from project sources.

Planned LRT/KRL stations come from research/planned-stations.json. A project
may also be published when it lies within maxDistanceKm of a planned station
whose segment is under construction or formally planned; those stations are
listed separately as nearestPlanned and never mixed into nearest. App
stations that the planned file marks as not yet operating carry that status.
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
MAX_PLANNED = 3
STATION_STATUSES = {
    "operating", "partially-operating", "under-construction", "tendering-or-preparation",
    "approved-plan", "proposed-study", "stalled-or-cancelled", "unclear",
}
# Hanya status ini yang boleh membuat proyek terbit karena dekat stasiun rencana.
QUALIFYING = {"partially-operating", "under-construction", "tendering-or-preparation", "approved-plan"}
# Proyek berfasilitas atau berkonsep islami tetap dicantumkan walau jauh dari stasiun.
ISLAMIC_LISTING = {"mosque-in-estate", "musholla-in-estate", "kajian", "tpq-or-school-in-estate", "syariah-concept"}
# Kontak pribadi tidak boleh ikut dipublikasikan.
CONTACT = re.compile(
    r"(?:\+?62|\b0)8\d{2}[\s.-]?\d{3,4}[\s.-]?\d{3,5}|wa\.me/|[\w.+-]+@[\w-]+\.[\w.]+"
)
SOCIAL_HOSTS = ("instagram.com", "facebook.com", "threads.net", "tiktok.com")
# Tautan media sosial resmi hanya dicatat, tidak pernah dibuka otomatis.
SOCIAL_PLATFORMS = {
    "instagram": ("instagram.com",),
    "facebook": ("facebook.com", "fb.com"),
    "tiktok": ("tiktok.com",),
    "youtube": ("youtube.com", "youtu.be"),
    "x": ("x.com", "twitter.com"),
    "threads": ("threads.net", "threads.com"),
    # Halaman tautan bio (pengganti Linktree) milik proyek, developer, atau masjid.
    "linkbio": ("linktr.ee", "lynk.id", "ini.bio", "pamer.bio", "berbagi.link", "bio.link", "heylink.me", "msha.ke", "s.id", "davdigi.com"),
}
CONTACT_HOSTS = ("wa.me", "whatsapp.com", "wa.link")


def contact_page(value, field):
    # Hanya tautan ke halaman publik yang memuat kontak; nomor tidak pernah disimpan.
    if not value:
        return None
    link = url(value, field)
    host = urllib.parse.urlsplit(link).netloc.lower()
    if any(host == h or host.endswith("." + h) for h in CONTACT_HOSTS) or re.search(r"\d{9,}", link):
        raise Invalid(f"{field}: tautan kontak harus ke halaman sumber, bukan nomor atau WhatsApp")
    return link


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


def social_links(links, field, owners=("project", "developer")):
    out, seen = [], set()
    for i, link in enumerate(links or []):
        where = f"{field}[{i}]"
        platform = link.get("platform")
        if platform not in SOCIAL_PLATFORMS:
            raise Invalid(f"{where}.platform tidak dikenal")
        link_url = url(link.get("url"), f"{where}.url")
        host = urllib.parse.urlsplit(link_url).netloc.lower()
        if not any(host == h or host.endswith("." + h) for h in SOCIAL_PLATFORMS[platform]):
            raise Invalid(f"{where}: host {host} bukan {platform}")
        if link.get("via") not in ("official-site", "search-result", "osm-tag", "user-lead") or link.get("owner") not in owners:
            raise Invalid(f"{where}: via atau owner tidak dikenal")
        if link_url in seen:
            continue
        seen.add(link_url)
        seen_at = link.get("seenAt")
        out.append({
            "platform": platform,
            "url": link_url,
            "owner": link["owner"],
            "via": link["via"],
            "seenAt": seen_at if isinstance(seen_at, str) and seen_at.startswith(("http://", "https://")) else None,
        })
    return out[:6]


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


FACILITY_KINDS = {
    "masjid", "musholla", "tpq-tpa", "ra-tk-islam", "mi-sd-islam", "smp-mts-islam",
    "madrasah-diniyah", "rumah-tahfidz", "pesantren", "other",
}
FEE_PERIODS = {"one-time", "monthly", "yearly", "per-semester", "unknown"}


def dated(value, field):
    if value is not None and not is_date(value):
        raise Invalid(f"{field} harus YYYY-MM-DD")
    return value[:10] if value else None


def load_islamic(path=ROOT / "research/context/islamic.json"):
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    if not is_date(data.get("checkedAt")):
        raise Invalid("islamic.checkedAt harus YYYY-MM-DD")
    facilities = []
    for i, item in enumerate(data.get("facilities", [])):
        field = f"islamic.facilities[{i}]"
        if item.get("kind") not in FACILITY_KINDS:
            raise Invalid(f"{field}.kind tidak dikenal")
        lat, lng = item.get("lat"), item.get("lng")
        if not all(isinstance(v, (int, float)) for v in (lat, lng)) or not (
            BBOX[0] <= lng <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]
        ):
            raise Invalid(f"{field}: koordinat di luar Jabodetabek")
        kajian = [
            {
                "schedule": text(k.get("schedule"), f"{field}.kajian[{j}].schedule", QUOTE_LIMIT),
                "frequency": text(k.get("frequency"), f"{field}.kajian[{j}].frequency", 20),
                "audience": text(k.get("audience"), f"{field}.kajian[{j}].audience", 20, optional=True),
                "url": url(k.get("url"), f"{field}.kajian[{j}].url"),
                "pageDate": dated(k.get("pageDate"), f"{field}.kajian[{j}].pageDate"),
            }
            for j, k in enumerate(item.get("kajian") or [])
        ]
        education = item.get("education")
        if education:
            fees = []
            for j, fee in enumerate(education.get("fees") or []):
                amount = fee.get("amount")
                if amount is not None and (not isinstance(amount, int) or not 10_000 <= amount <= 1_000_000_000):
                    raise Invalid(f"{field}.fees[{j}].amount di luar rentang wajar")
                if fee.get("period") not in FEE_PERIODS:
                    raise Invalid(f"{field}.fees[{j}].period tidak dikenal")
                fees.append({
                    "label": text(fee.get("label"), f"{field}.fees[{j}].label", 80),
                    "amount": amount,
                    "currency": "IDR",
                    "period": fee["period"],
                    "academicYear": text(fee.get("academicYear"), f"{field}.fees[{j}].academicYear", 20, optional=True),
                    "quote": text(fee.get("quote"), f"{field}.fees[{j}].quote", QUOTE_LIMIT),
                    "url": url(fee.get("url"), f"{field}.fees[{j}].url"),
                    "pageDate": dated(fee.get("pageDate"), f"{field}.fees[{j}].pageDate"),
                })
            education = {
                "levels": [text(level, f"{field}.levels", 40) for level in education.get("levels") or []],
                "program": text(education.get("program"), f"{field}.program", 160, optional=True),
                "fees": fees[:4],
                "url": url(education.get("url"), f"{field}.education.url"),
            }
        if not kajian and not education:
            continue
        facilities.append({
            "id": text(item.get("id"), f"{field}.id", 80),
            "name": text(item.get("name"), f"{field}.name", 160),
            "kind": item["kind"],
            # 6 desimal (sekitar 0,1 m) cukup; digit panjang juga menyerupai nomor telepon.
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "coordinateSource": text(item.get("coordinateSource"), f"{field}.coordinateSource", 40),
            "coordinateUrl": url(item.get("coordinateUrl"), f"{field}.coordinateUrl"),
            "evidence": item.get("evidence") if item.get("evidence") in ("strong", "partial") else "partial",
            "social": social_links(item.get("social"), f"{field}.social", ("facility",)),
            "kajian": kajian[:3],
            "education": education,
        })
    claims = {}
    for pid, items in (data.get("projectClaims") or {}).items():
        # Satu klaim per jenis lebih dulu, baru klaim tambahan, agar jenis lain tidak tergeser.
        kinds = set()
        first = [c for c in items if not (c.get("kind") in kinds or kinds.add(c.get("kind")))]
        items = first + [c for c in items if c not in first]
        claims[pid] = [
            {
                "kind": text(c.get("kind"), f"islamic.claims.{pid}.kind", 40),
                "quote": text(c.get("quote"), f"islamic.claims.{pid}.quote", QUOTE_LIMIT),
                "url": url(c.get("url"), f"islamic.claims.{pid}.url"),
                "pageDate": dated(c.get("pageDate"), f"islamic.claims.{pid}.pageDate"),
            }
            for c in items[:4]
        ]
    return {
        "checkedAt": data["checkedAt"],
        "radiusKm": data.get("radiusKm", 1.5),
        "method": text(data.get("method"), "islamic.method", 600),
        "caveats": [text(c, "islamic.caveats", 300) for c in data.get("caveats", [])],
        "facilities": facilities,
        "claims": claims,
    }


def islamic_listing(pid, islamic):
    return any(c["kind"] in ISLAMIC_LISTING for c in (islamic or {}).get("claims", {}).get(pid, []))


def area_from_text(location):
    lowered = location.lower()
    return next((area for area in ("Jakarta", "Bekasi", "Depok", "Tangerang", "Bogor") if area.lower() in lowered), None)


def islamic_of(pid, point, islamic):
    if not islamic:
        return None
    near = [] if point is None else sorted(
        (
            dict(f, km=round(distance(point, (f["lng"], f["lat"])), 2))
            for f in islamic["facilities"]
        ),
        key=lambda f: f["km"],
    )
    near = [f for f in near if f["km"] <= islamic["radiusKm"]]
    pick = lambda f: {k: f[k] for k in ("id", "name", "kind", "km", "evidence", "lat", "lng", "social")}  # noqa: E731
    kajian = [dict(pick(f), kajian=f["kajian"]) for f in near if f["kajian"]][:3]
    education = [dict(pick(f), education=f["education"]) for f in near if f["education"]][:4]
    claims = islamic["claims"].get(pid, [])
    if not (kajian or education or claims):
        return None
    return {"kajian": kajian, "education": education, "claims": claims}


LEAD_TYPES = {"project", "account", "service", "hashtag", "rental"}
LEAD_STATUSES = {"unverified", "unreached"}


def load_leads(path=ROOT / "research/leads.json"):
    # Petunjuk belum terverifikasi (misalnya akun Instagram) ditampilkan terpisah dan berlabel.
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    leads = []
    for i, lead in enumerate(data.get("leads", [])):
        field = f"leads[{i}]"
        if lead.get("type") not in LEAD_TYPES or lead.get("status") not in LEAD_STATUSES:
            raise Invalid(f"{field}: type atau status tidak dikenal")
        if lead.get("area") is not None and lead["area"] not in AREAS:
            raise Invalid(f"{field}.area tidak dikenal")
        links = [
            {"label": text(link.get("label"), f"{field}.links[{j}].label", 80), "url": url(link.get("url"), f"{field}.links[{j}].url")}
            for j, link in enumerate(lead.get("links") or [])
        ]
        if not links:
            raise Invalid(f"{field}.links wajib diisi")
        leads.append({
            "id": text(lead.get("id"), f"{field}.id", 80),
            "name": text(lead.get("name"), f"{field}.name", 160),
            "type": lead["type"],
            "status": lead["status"],
            "area": lead.get("area"),
            "claim": text(lead.get("claim"), f"{field}.claim", 400),
            "check": text(lead.get("check"), f"{field}.check", 300, optional=True),
            "related": lead.get("related"),
            "contactUrl": contact_page(lead.get("contactUrl"), f"{field}.contactUrl"),
            "links": links,
        })
    return {
        "checkedAt": data["checkedAt"] if is_date(data.get("checkedAt")) else None,
        "source": text(data.get("source"), "leads.source", 200),
        "note": text(data.get("note"), "leads.note", 600),
        "leads": leads,
    }


RENTAL_TYPES = {"kontrakan", "rumah-sewa", "apartemen-sewa", "kos-keluarga", "lainnya"}


def load_rentals(path=ROOT / "research/rentals.json"):
    # Sewa: tanpa nama/kontak pemilik; rumah perorangan tanpa koordinat.
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    rentals = []
    for i, item in enumerate(data.get("rentals", [])):
        field = f"rentals[{i}]"
        if item.get("rentalType") not in RENTAL_TYPES or item.get("kind") not in KINDS or item.get("area") not in AREAS:
            raise Invalid(f"{field}: rentalType, kind, atau area tidak dikenal")
        if item.get("verdict") not in VERDICTS or not is_date(item.get("lastChecked")):
            raise Invalid(f"{field}: verdict atau lastChecked tidak valid")
        if item.get("coordinates") and item.get("ownerType") == "individual":
            raise Invalid(f"{field}: rumah perorangan tidak boleh berkoordinat")
        rent = item.get("rent") or {}
        amount = number(rent.get("amount"), f"{field}.rent.amount", integer=True)
        if rent.get("period") not in ("monthly", "yearly") or not 100_000 <= amount <= 200_000_000:
            raise Invalid(f"{field}.rent di luar rentang wajar atau periode tidak dikenal")
        evidence = [
            {"quote": text(e.get("quote"), f"{field}.evidence[{j}].quote", QUOTE_LIMIT), "url": url(e.get("url"), f"{field}.evidence[{j}].url")}
            for j, e in enumerate(item.get("evidence") or [])
        ]
        if not evidence:
            raise Invalid(f"{field}.evidence wajib diisi")
        rentals.append({
            "id": text(item.get("id"), f"{field}.id", 90),
            "title": text(item.get("title"), f"{field}.title", 160),
            "rentalType": item["rentalType"],
            "kind": item["kind"],
            "area": item["area"],
            "locationText": text(item.get("locationText"), f"{field}.locationText", 160),
            "buildingOrCluster": text(item.get("buildingOrCluster"), f"{field}.buildingOrCluster", 120, optional=True),
            "rent": {
                "amount": amount,
                "period": rent["period"],
                "quote": text(rent.get("quote"), f"{field}.rent.quote", QUOTE_LIMIT),
                "url": url(rent.get("url"), f"{field}.rent.url"),
                "pageDate": dated(rent.get("pageDate"), f"{field}.rent.pageDate"),
            },
            "bedrooms": item.get("bedrooms") if isinstance(item.get("bedrooms"), int) else None,
            "sizeM2": number(item.get("sizeM2"), f"{field}.sizeM2", optional=True),
            "furnished": item.get("furnished") if item.get("furnished") in ("unfurnished", "semi", "full") else None,
            "evidence": evidence[:3],
            "nearStationsClaim": [
                {"station": text(c.get("station"), f"{field}.station", 80), "quote": text(c.get("quote"), f"{field}.station.quote", QUOTE_LIMIT), "url": url(c.get("url"), f"{field}.station.url")}
                for c in (item.get("nearStationsClaim") or [])[:2]
            ],
            "listingUrl": url(item.get("listingUrl"), f"{field}.listingUrl"),
            "sourcePortal": text(item.get("sourcePortal"), f"{field}.sourcePortal", 60),
            "postedOrUpdated": dated(item.get("postedOrUpdated"), f"{field}.postedOrUpdated"),
            "ownerType": item.get("ownerType") if item.get("ownerType") in ("individual", "agent", "management", "developer") else "unknown",
            "social": social_links(item.get("social"), f"{field}.social", owners=("building", "management", "developer")),
            "verdict": item["verdict"],
            "lastChecked": item["lastChecked"][:10],
        })
    return {"checkedAt": data["checkedAt"], "note": text(data.get("note"), "rentals.note", 600), "rentals": rentals}


SALE_CATEGORIES = {"rumah", "kavling"}


def load_sale_ads(path=ROOT / "research/sale-ads.json"):
    # Iklan unit dan kavling dijual: tanpa data penjual dan tanpa koordinat.
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    ads = []
    for i, item in enumerate(data.get("ads", [])):
        field = f"saleAds[{i}]"
        if item.get("category") not in SALE_CATEGORIES or item.get("kind") not in ("Rumah", "Tanah") or item.get("area") not in AREAS:
            raise Invalid(f"{field}: category, kind, atau area tidak dikenal")
        if item.get("verdict") not in VERDICTS or not is_date(item.get("lastChecked")):
            raise Invalid(f"{field}: verdict atau lastChecked tidak valid")
        if "coordinate" in item or "coordinates" in item:
            raise Invalid(f"{field}: iklan unit tidak boleh berkoordinat")
        price = item.get("price") or {}
        amount = number(price.get("amount"), f"{field}.price.amount", integer=True)
        if not 10_000_000 <= amount <= 20_000_000_000:
            raise Invalid(f"{field}.price di luar rentang wajar")
        near = item.get("nearMosque")
        if near:
            near = {
                "name": text(near.get("name"), f"{field}.nearMosque.name", 120),
                "quote": text(near.get("quote"), f"{field}.nearMosque.quote", QUOTE_LIMIT),
                "url": url(near.get("url"), f"{field}.nearMosque.url"),
            }
        evidence = [
            {"quote": text(e.get("quote"), f"{field}.evidence[{j}].quote", QUOTE_LIMIT), "url": url(e.get("url"), f"{field}.evidence[{j}].url")}
            for j, e in enumerate(item.get("evidence") or [])
        ]
        if not near and not evidence:
            raise Invalid(f"{field}: wajib ada bukti masjid atau lingkungan islami")
        ads.append({
            "id": text(item.get("id"), f"{field}.id", 90),
            "title": text(item.get("title"), f"{field}.title", 160),
            "category": item["category"],
            "kind": item["kind"],
            "area": item["area"],
            "locationText": text(item.get("locationText"), f"{field}.locationText", 160),
            "projectOrCluster": text(item.get("projectOrCluster"), f"{field}.projectOrCluster", 120, optional=True),
            "price": {
                "amount": amount,
                "quote": text(price.get("quote"), f"{field}.price.quote", QUOTE_LIMIT),
                "url": url(price.get("url"), f"{field}.price.url"),
                "pageDate": dated(price.get("pageDate"), f"{field}.price.pageDate"),
            },
            "landM2": number(item.get("landM2"), f"{field}.landM2", optional=True),
            "buildingM2": number(item.get("buildingM2"), f"{field}.buildingM2", optional=True),
            "bedrooms": item.get("bedrooms") if isinstance(item.get("bedrooms"), int) else None,
            "nearMosque": near,
            "evidence": evidence[:3],
            "listingUrl": url(item.get("listingUrl"), f"{field}.listingUrl"),
            "sourcePortal": text(item.get("sourcePortal"), f"{field}.sourcePortal", 60),
            "postedOrUpdated": dated(item.get("postedOrUpdated"), f"{field}.postedOrUpdated"),
            "ownerType": item.get("ownerType") if item.get("ownerType") in ("individual", "agent", "developer") else "unknown",
            "verdict": item["verdict"],
            "lastChecked": item["lastChecked"][:10],
            "note": text(item.get("note"), f"{field}.note", 300, optional=True),
        })
    return {
        "checkedAt": data["checkedAt"] if is_date(data.get("checkedAt")) else None,
        "hub": text(data.get("hub"), "saleAds.hub", 120),
        "note": text(data.get("note"), "saleAds.note", 600),
        "ads": ads,
    }


def load_planned(path=ROOT / "research/planned-stations.json"):
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    if not is_date(data.get("checkedAt")):
        raise Invalid("planned.checkedAt harus YYYY-MM-DD")
    lines = {}
    for i, line in enumerate(data.get("lines", [])):
        field = f"planned.lines[{i}]"
        lid = text(line.get("id"), f"{field}.id", 60)
        if line.get("mode") not in ("KRL", "LRT", "MRT") or line.get("status") not in STATION_STATUSES:
            raise Invalid(f"{field}: mode atau status tidak dikenal")
        if line.get("statusAsOf") is not None and not is_date(line["statusAsOf"]):
            raise Invalid(f"{field}.statusAsOf harus YYYY-MM-DD")
        sources = [
            {
                "url": url(source.get("url"), f"{field}.sources[{j}].url"),
                "title": text(source.get("title"), f"{field}.sources[{j}].title", 200),
                "publisher": text(source.get("publisher"), f"{field}.sources[{j}].publisher", 120),
                "kind": text(source.get("kind"), f"{field}.sources[{j}].kind", 40),
                "pageDate": source["pageDate"][:10] if is_date(source.get("pageDate")) else None,
            }
            for j, source in enumerate(line.get("sources") or [])
        ]
        if not sources:
            raise Invalid(f"{field}.sources wajib diisi")
        lines[lid] = {
            "id": lid,
            "name": text(line.get("name"), f"{field}.name", 160),
            "mode": line["mode"],
            "operator": text(line.get("operator"), f"{field}.operator", 120, optional=True),
            "segment": text(line.get("segment"), f"{field}.segment", 200),
            "status": line["status"],
            "statusAsOf": line.get("statusAsOf"),
            "statusQuote": text(line.get("statusQuote"), f"{field}.statusQuote", QUOTE_LIMIT, optional=True),
            "targetOpening": text(line.get("targetOpening"), f"{field}.targetOpening", 300, optional=True),
            "note": text(line.get("note"), f"{field}.note", 400, optional=True),
            "sources": sources,
        }
    stations = []
    for i, station in enumerate(data.get("stations", [])):
        field = f"planned.stations[{i}]"
        line = lines.get(station.get("line"))
        if not line or station.get("status") not in STATION_STATUSES:
            raise Invalid(f"{field}: jalur atau status tidak dikenal")
        lat, lng = station.get("lat"), station.get("lng")
        if not all(isinstance(v, (int, float)) for v in (lat, lng)) or not (
            BBOX[0] <= lng <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]
        ):
            raise Invalid(f"{field}: koordinat di luar Jabodetabek")
        stations.append({
            "name": text(station.get("name"), f"{field}.name", 120),
            "mode": line["mode"],
            "line": line["id"],
            "status": station["status"],
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "precision": text(station.get("precision"), f"{field}.precision", 60),
            "coordinateUrl": url(station.get("coordinateUrl"), f"{field}.coordinateUrl"),
            "locationText": text(station.get("locationText"), f"{field}.locationText", 200, optional=True),
        })
    app_status = {}
    for i, item in enumerate(data.get("appStatus", [])):
        field = f"planned.appStatus[{i}]"
        if item.get("status") not in STATION_STATUSES:
            raise Invalid(f"{field}.status tidak dikenal")
        app_status[(item.get("mode"), item.get("name"))] = {
            "status": item["status"],
            "line": item.get("line") if item.get("line") in lines else None,
        }
    return {
        "checkedAt": data["checkedAt"],
        "note": text(data.get("note"), "planned.note", 600, optional=True),
        "lines": list(lines.values()),
        "stations": stations,
        "appStatus": app_status,
    }


def planned_near(point, planned, max_km):
    if not planned:
        return []
    ranked = sorted(
        (
            {"mode": s["mode"], "name": s["name"], "line": s["line"], "status": s["status"],
             "km": round(distance(point, (s["lng"], s["lat"])), 2), "lat": s["lat"], "lng": s["lng"]}
            for s in planned["stations"]
            if s["status"] in QUALIFYING
        ),
        key=lambda s: s["km"],
    )
    return [s for s in ranked if s["km"] <= max_km][:MAX_PLANNED]


def population_of(pid, point, population):
    estimate = (population or {}).get("properties", {}).get(pid)
    # Estimasi dibuang bila titik proyek berubah sesudah raster dihitung.
    if not estimate or (round(estimate["lng"], 6), round(estimate["lat"], 6)) != point:
        return None
    values = {k: estimate.get(k) for k in ("within500m", "within1km", "densityKm2")}
    if not all(isinstance(v, int) and v >= 0 for v in values.values()):
        raise Invalid(f"{pid}.population: nilai harus bilangan bulat >= 0")
    return values


def build_property(entry, stations, regions, max_km, population=None, planned=None, islamic=None):
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
    islamic_only = islamic_listing(pid, islamic)
    if coordinate is None and not islamic_only:
        return None, "belum ada koordinat terverifikasi, jarak stasiun belum bisa dihitung"
    point, ranked, nearest, upcoming, region, fallback = None, [], [], [], None, False
    if coordinate is not None:
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
        for station in nearest:
            flagged = (planned or {}).get("appStatus", {}).get((station["mode"], station["name"]))
            if flagged:
                station["status"] = flagged["status"]
                if flagged["line"]:
                    station["line"] = flagged["line"]
        upcoming = planned_near(point, planned, max_km)
        if not nearest and not upcoming and not islamic_only:
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
        "area": (region["area"] if region and region["area"] in AREAS else None) if point else area_from_text(entry.get("locationText") or ""),
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
        "contactUrl": contact_page(entry.get("contactUrl"), field("contactUrl")),
        "social": social_links(entry.get("social"), field("social")),
        "coordinate": {
            "method": text(coordinate.get("method"), field("coordinate.method"), 80),
            "url": url(coordinate.get("url"), field("coordinate.url")),
            "precision": text(coordinate.get("precision"), field("coordinate.precision"), 40),
            "note": "Wilayah dari batas terdekat; titik berada di tepi batas yang disederhanakan."
            if fallback else text(coordinate.get("note"), field("coordinate.note"), 200, optional=True),
        } if coordinate else None,
        "listingBasis": "transit" if nearest or upcoming else "islamic",
        "nearestAny": ranked[0] if ranked else None,
        "nearest": nearest,
        "nearestPlanned": upcoming,
        "population": population_of(pid, point, population),
        "islamic": islamic_of(pid, point, islamic),
        "verdict": entry["verdict"],
        "sources": sources,
        "lastChecked": entry["lastChecked"][:10],
        "corridor": text(entry.get("corridor"), field("corridor"), 60),
        "methods": [text(m, field("methods"), 60) for m in entry.get("methods") or []],
    }
    return {
        "type": "Feature",
        "id": pid,
        "geometry": {"type": "Point", "coordinates": list(point)} if point else None,
        "properties": properties,
    }, None


def excluded_summary(entry, reason, islamic=None):
    # Proyek yang belum terbit tetap menampilkan harga bersumber dan tautan resmi.
    item = {"id": entry["id"], "name": text(entry.get("name"), "name", 160), "reason": reason}
    price = entry.get("price") or {}
    if isinstance(price.get("min"), int) and price.get("url") and not entry.get("excludeReason"):
        item["price"] = {
            "min": number(price["min"], f"{entry['id']}.price.min", integer=True),
            "max": number(price.get("max"), f"{entry['id']}.price.max", optional=True, integer=True),
            "url": url(price["url"], f"{entry['id']}.price.url"),
        }
        item["kind"] = entry.get("kind") if entry.get("kind") in KINDS else None
        item["locationText"] = text(entry.get("locationText"), f"{entry['id']}.locationText", 200, optional=True)
        item["social"] = social_links(entry.get("social"), f"{entry['id']}.social")
        item["claims"] = (islamic or {}).get("claims", {}).get(entry["id"], [])[:2]
    return item


def build(
    source,
    planned_path=ROOT / "research/planned-stations.json",
    leads_path=ROOT / "research/leads.json",
    rentals_path=ROOT / "research/rentals.json",
    sale_ads_path=ROOT / "research/sale-ads.json",
):
    regions = json.loads((ROOT / "public/data/regions.geojson").read_text())["features"]
    stations = load_stations()
    population = load_population()
    planned = load_planned(planned_path)
    islamic = load_islamic()
    leads = load_leads(leads_path)
    rentals = load_rentals(rentals_path)
    sale_ads = load_sale_ads(sale_ads_path)
    max_km = source.get("maxDistanceKm", 3)
    features, dropped, seen = [], [], set()
    for entry in source.get("properties", []):
        if entry.get("id") in seen:
            raise Invalid(f"id ganda: {entry.get('id')}")
        seen.add(entry.get("id"))
        feature, reason = build_property(entry, stations, regions, max_km, population, planned, islamic)
        if feature:
            features.append(feature)
        else:
            dropped.append(excluded_summary(entry, reason, islamic))
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
            "islamicListingNote": "Proyek dengan bukti masjid, musholla, kajian, TPQ, sekolah Islam di kawasan, atau konsep islami tetap dicantumkan walau jauh dari stasiun atau titiknya belum terverifikasi.",
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
            "leads": leads,
            "rentals": rentals,
            "saleAds": sale_ads,
            "islamic": {
                "checkedAt": islamic["checkedAt"],
                "radiusKm": islamic["radiusKm"],
                "method": islamic["method"],
                "caveats": islamic["caveats"],
            } if islamic else None,
            "planned": {
                "checkedAt": planned["checkedAt"],
                "note": planned["note"],
                "qualifyingStatuses": sorted(QUALIFYING),
                "lines": planned["lines"],
                "stations": planned["stations"],
            } if planned else None,
        },
        "features": features,
    }, dropped


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", type=pathlib.Path, default=ROOT / "research/properties.json")
    parser.add_argument("output", nargs="?", type=pathlib.Path, default=ROOT / "public/data/properties.geojson")
    parser.add_argument("--check", action="store_true", help="fail if OUTPUT is not up to date")
    parser.add_argument("--planned", type=pathlib.Path, default=ROOT / "research/planned-stations.json")
    parser.add_argument("--leads", type=pathlib.Path, default=ROOT / "research/leads.json")
    parser.add_argument("--rentals", type=pathlib.Path, default=ROOT / "research/rentals.json")
    parser.add_argument("--sale-ads", type=pathlib.Path, default=ROOT / "research/sale-ads.json")
    args = parser.parse_args()
    try:
        result, dropped = build(json.loads(args.input.read_text()), args.planned, args.leads, args.rentals, args.sale_ads)
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
