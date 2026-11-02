"""Bounded public rental discovery. Outputs review candidates, never publishes."""

import argparse
import datetime as dt
import fcntl
import hashlib
import html
from html.parser import HTMLParser
import json
import math
import os
from pathlib import Path
import re
import signal
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://www.pinhome.id"
AGENT = "RumahTinggalResearch/1.0 (+https://rumah.faizmuttaqin.com)"
UTC = dt.timezone.utc
ADAPTER_VERSION = 2


def now():
    return dt.datetime.now(UTC).isoformat(timespec="seconds")


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_suffix(path.suffix + ".tmp")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(temporary, path)
    path.chmod(0o600)


def km(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    value = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 6371 * 2 * math.asin(min(1, math.sqrt(value)))


def canonical(value, base=ORIGIN):
    url = urllib.parse.urlsplit(urllib.parse.urljoin(base, value))
    if (url.scheme != "https" or url.netloc != "www.pinhome.id"
            or url.username or url.password or url.fragment):
        raise ValueError("URL outside public source")
    path = url.path.rstrip("/")
    if not (re.fullmatch(r"/sewa/(rumah|apartemen)(/[a-z0-9-]+){1,5}", path)
            or re.fullmatch(r"/disewa/(rumah-sekunder|apartemen-sekunder)/unit/[a-z0-9-]+", path)
            or path == "/robots.txt"):
        raise ValueError("URL outside rental pages")
    pairs = urllib.parse.parse_qsl(url.query, keep_blank_values=True)
    if pairs and (len(pairs) != 1 or pairs[0][0] != "page" or not re.fullmatch(r"[1-9][0-9]{0,3}", pairs[0][1])):
        raise ValueError("Unsupported query")
    if pairs and "/unit/" in path:
        raise ValueError("Query on detail")
    return ORIGIN + path + ("?" + urllib.parse.urlencode(pairs) if pairs else "")


def catalog_url(value):
    """Catalog can also contain other portals; do not apply the crawl allowlist."""
    u = urllib.parse.urlsplit(value)
    host = "www.pinhome.id" if u.hostname == "pinhome.id" else u.netloc
    return urllib.parse.urlunsplit((u.scheme, host, u.path.rstrip("/"), "", ""))


def public_text(value, limit=160):
    # No advertiser identity, phone, email, house number, or full description.
    text = html.unescape(re.sub(r"<[^>]+>", " ", str(value or "")))
    text = re.sub(r"(?:https?://|www\.|wa\.me/|\S+@)\S+", "", text, flags=re.I)
    text = re.sub(r"(?<!\w)(?:\+?62|0)\d[\d\s().-]{7,}\d", "[kontak dihapus]", text)
    text = re.sub(r"\b(?:no\.?|nomor)\s*[A-Za-z]?\d+[\w/-]*", "", text, flags=re.I)
    return re.sub(r"\s+", " ", text).strip()[:limit]


def script_json(text, identifier):
    found = re.search(r'<script\b[^>]*\bid=[\'"]' + re.escape(identifier) + r'[\'"][^>]*>(.*?)</script\s*>', text, re.S | re.I)
    if not found:
        raise ValueError("Source structure changed: " + identifier)
    return json.loads(found[1])


def astro_value(value):
    # Astro serializes primitives/objects as [0, value] and arrays as [1, items].
    if value == [0]:
        return None
    if not isinstance(value, list) or len(value) != 2:
        raise ValueError("Unsupported Astro value")
    kind, raw = value
    if kind == 0:
        return {k: astro_value(v) for k, v in raw.items()} if isinstance(raw, dict) else raw
    if kind == 1:
        return [astro_value(v) for v in raw]
    if kind == 6:
        return None
    raise ValueError("Unsupported Astro type")


class SearchParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.cards = []
        self.links = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a" and attrs.get("href"):
            try:
                self.links.add(canonical(attrs["href"]))
            except ValueError:
                pass
        if tag != "astro-island" or not attrs.get("props"):
            return
        props = json.loads(attrs["props"])
        if "propertyData" not in props:
            return
        raw = props["propertyData"][1]
        data = {k: astro_value(raw[k]) for k in ("href", "buildingType", "priceText", "lastModifiedAt", "isRented", "listingType") if k in raw}
        if data.get("listingType") != "property_listing_type.rent":
            return
        try:
            url = canonical(data["href"])
        except (KeyError, ValueError):
            return
        if "/unit/" not in url:
            return
        self.cards.append({
            "url": url,
            "kind": data.get("buildingType"),
            "priceLabel": public_text(data.get("priceText"), 100),
            "sourceUpdatedAt": data.get("lastModifiedAt"),
            "rented": data.get("isRented") is True,
        })


def parse_search(text, url):
    pagination = script_json(text, "__SEARCH_RESULT_PAGINATION__")
    filters = script_json(text, "__DATA_FILTER_VALUE__")
    if filters.get("listingType") != "property_listing_type.rent":
        raise ValueError("Search is not rent")
    parser = SearchParser()
    parser.feed(text)
    cards = {r["url"]: r for r in parser.cards}
    # Plain links are a discovery fallback, never evidence of price or location.
    for link in sorted(parser.links):
        if "/unit/" in link:
            cards.setdefault(link, {"url": link})
    current = int(pagination["currentPage"])
    total, size = int(pagination["total"]), int(pagination["pageSize"])
    requested = int(dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(url).query)).get("page", "1"))
    if current != requested or size <= 0 or total < 0:
        raise ValueError("Invalid pagination")
    if total and not cards:
        raise ValueError("Search cards missing")
    # Reject a silent redirect to a different geography.
    location = filters.get("locationWithParents") or {}
    path_slugs = urllib.parse.urlsplit(url).path.split("/")[3:]
    if location.get("slug") and location["slug"] != path_slugs[-1]:
        raise ValueError("Search geography changed")
    return {"cards": list(cards.values()), "total": total, "page": current,
            "pages": math.ceil(total / size), "locationLabel": public_text(location.get("title"))}


def monthly_hint(card):
    """Ordering hint only. A detail page is still required for a candidate price."""
    label = card.get("priceLabel", "")
    match = re.search(r"Rp\s*([\d.,]+)\s*(Ribu|Rb|Juta|Jt|Miliar)?\s*/\s*(Bulan|Tahun)", label, re.I)
    if not match:
        return math.inf
    scale = {"ribu": 1_000, "rb": 1_000, "juta": 1_000_000, "jt": 1_000_000, "miliar": 1_000_000_000}.get((match[2] or "").lower(), 1)
    number = match[1].replace(".", "").replace(",", ".")
    try:
        return float(number) * scale / (12 if match[3].lower() == "tahun" else 1)
    except ValueError:
        return math.inf


def point(value):
    if not isinstance(value, str):
        return None
    try:
        nums = [float(v) for v in value.strip(" ()").split(",")]
    except ValueError:
        return None
    if len(nums) != 2 or not all(math.isfinite(v) for v in nums) or not -11 <= nums[0] <= 6 or not 95 <= nums[1] <= 142:
        return None
    return nums


def parse_detail(text, url):
    data = script_json(text, "__UNIT_DETAIL__")
    issues = []
    rent_type = data.get("rentPeriod")
    period = {"rent_period_type.yearly": "yearly", "rent_period_type.monthly": "monthly"}.get(rent_type)
    amount = data.get("price")
    valid_amount = type(amount) in (int, float) and math.isfinite(amount) and 100_000 <= amount <= 200_000_000
    if not valid_amount:
        amount = None
        issues.append("invalid-rent")
    if not period:
        issues.append("unknown-rent-period")
    if data.get("status") != "unit_type_status.active":
        issues.append("inactive-or-rented")
    kind = "Apartemen" if "/apartemen-sekunder/" in url else "Rumah"
    location = data.get("location") or {}
    coords = point(location.get("coordinate"))
    if coords and any((p := point((location.get(k) or {}).get("coordinate"))) and km(coords, p) < 0.001
                      for k in ("province", "city", "district", "subDistrict")):
        coords = None
        issues.append("administrative-default-rejected")
    if not coords:
        issues.append("no-proven-location")
    specs = {s.get("localeKey"): s.get("value") for s in data.get("specifications", [])}
    def number(key):
        try:
            val = float(specs.get("specifications." + key))
            return val if math.isfinite(val) and val > 0 else None
        except (TypeError, ValueError):
            return None
    # Location evidence uses locality names, never the private street/house field.
    labels = [public_text((location.get(k) or {}).get("name") or (location.get(k) or {}).get("title"), 70)
              for k in ("subDistrict", "district", "city")]
    description = str(data.get("description") or "")
    if re.search(r"\b(?:ruko|toko|kantor|gudang|harian|per\s*hari)\b", description, re.I):
        issues.append("usage-or-period-needs-review")
    images = data.get("photos") or data.get("images") or []
    image_hashes = []
    for image in images[:5]:
        value = image if isinstance(image, str) else image.get("url") or image.get("imageUrl") or image.get("originalUrl")
        if value:
            image_hashes.append(digest(urllib.parse.urlsplit(value).path))
    updated = str(data.get("lastModifiedAt") or "")
    if not re.match(r"\d{4}-\d{2}-\d{2}T", updated):
        issues.append("missing-source-date")
        updated = None
    return {
        "url": url, "adapterVersion": ADAPTER_VERSION, "kind": kind, "amount": amount, "period": period,
        "monthlyEquivalent": amount / (12 if period == "yearly" else 1) if amount and period else None,
        "sourceUpdatedAt": updated, "sourceStatus": data.get("status"),
        "minimumRentMonths": data.get("minimumRentTermMonth") if type(data.get("minimumRentTermMonth")) is int and 1 <= data["minimumRentTermMonth"] <= 120 else None,
        "locality": ", ".join(v for v in labels if v),
        "location": {"lat": round(coords[0], 6), "lng": round(coords[1], 6), "precision": "approximate"} if coords else None,
        "bedrooms": number("total_bedroom"), "buildingAreaM2": number("building_area"),
        "landAreaM2": number("surface_area"), "imageHashes": sorted(set(image_hashes)),
        "issues": issues, "availability": "not-confirmed-with-advertiser",
    }


class Robots:
    """RFC 9309 groups, longest matching rule, wildcard and end anchor."""
    def __init__(self, text, agent=AGENT):
        groups, agents, rules, delay = [], [], [], 0
        in_rules = False
        for line in text.splitlines() + ["user-agent: __end__"]:
            line = line.split("#", 1)[0].strip()
            if ":" not in line:
                continue
            key, value = [p.strip() for p in line.split(":", 1)]
            key = key.lower()
            if key == "user-agent":
                if in_rules:
                    groups.append((agents, rules, delay))
                    agents, rules, delay, in_rules = [], [], 0, False
                agents.append(value.lower())
            elif agents and key in ("allow", "disallow", "crawl-delay"):
                in_rules = True
                if key == "crawl-delay":
                    try:
                        delay = max(delay, float(value))
                    except ValueError:
                        pass
                elif value:
                    rules.append((key == "allow", value))
        matches = [(max((len(a) if a != "*" else 0 for a in agents if a == "*" or a in agent.lower()), default=-1), rules, delay)
                   for agents, rules, delay in groups]
        best = max((m[0] for m in matches), default=-1)
        self.rules = [rule for score, rules, _ in matches if score == best for rule in rules]
        self.delay = max((delay for score, _, delay in matches if score == best), default=0)

    def allowed(self, url):
        u = urllib.parse.urlsplit(url)
        path = u.path + ("?" + u.query if u.query else "")
        matched = []
        for allow, pattern in self.rules:
            expression = re.escape(pattern.rstrip("$")).replace(r"\*", ".*")
            if re.match("^" + expression + ("$" if pattern.endswith("$") else ""), path):
                matched.append((len(pattern.replace("*", "").rstrip("$")), allow))
        return max(matched, default=(0, True))[1]


class StopSource(Exception):
    pass


class RedirectGuard(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed, normalize=canonical):
        self.allowed = allowed
        self.normalize = normalize

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        target = self.normalize(newurl)
        if not self.allowed(target):
            raise ValueError("Redirect disallowed by robots")
        return super().redirect_request(req, fp, code, msg, headers, target)


class Client:
    def __init__(self, delay_seconds=1.5, adapter=None):
        self.robots = None
        self.delay = delay_seconds
        self.last_request = 0
        self.requests = 0
        self.stopped = None
        self.normalize = adapter.canonical if adapter else canonical
        self.origin = adapter.origin if adapter else ORIGIN
        self.cancel = getattr(adapter, "cancel", None)

    def get(self, url):
        if self.cancel and self.cancel.is_set():
            raise StopSource("operator-or-time-limit")
        if self.stopped:
            raise StopSource(self.stopped)
        url = self.normalize(url)
        if self.robots and not self.robots.allowed(url):
            raise ValueError("robots-disallowed")
        time.sleep(max(0, self.last_request + self.delay - time.monotonic()))
        self.last_request = time.monotonic()
        self.requests += 1
        opener = urllib.request.build_opener(RedirectGuard(lambda target: not self.robots or self.robots.allowed(target), self.normalize))
        try:
            with opener.open(urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept": "text/html,text/plain"}), timeout=20) as response:
                if self.normalize(response.geturl()) != url:
                    raise ValueError("redirected-page-needs-review")
                raw = response.read(5_000_001)
                if len(raw) > 5_000_000:
                    raise ValueError("response-too-large")
                text = raw.decode("utf-8")
                if re.search(r"<title[^>]*>[^<]*(?:just a moment|access denied|captcha)", text, re.I):
                    self.stopped = "challenge-no-retry"
                    raise StopSource(self.stopped)
                return text
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403, 429):
                self.stopped = "http-" + str(exc.code) + "-no-retry"
                raise StopSource(self.stopped) from None
            raise ValueError("http-" + str(exc.code)) from None

    def start(self):
        text = self.get(self.origin + "/robots.txt")
        self.robots = Robots(text)
        self.delay = max(self.delay, self.robots.delay)
        return {"checkedAt": now(), "sha256": digest(text), "url": self.origin + "/robots.txt"}


def priority(mosque, stops, paths):
    nearest = []
    for mode in ("KRL", "MRT", "LRT", "TransJakarta"):
        found = [(km((mosque["lat"], mosque["lng"]), (s["lat"], s["lng"])), s) for s in stops if s["mode"] == mode]
        if found:
            distance, s = min(found, key=lambda pair: pair[0])
            nearest.append({"mode": mode, "name": s["name"], "km": round(distance, 3),
                            "near": distance <= (0.7 if mode == "TransJakarta" else 1.5)})
    near = any(s["near"] for s in nearest)
    south = any("/jakarta-selatan/" in "/" + p + "/" for p in paths)
    # Blok M is an ordering reference, not the user's home or a route origin.
    outward = km((mosque["lat"], mosque["lng"]), (-6.244574, 106.800616))
    return {"tier": 0 if near and south else 1 if near else 2 if south else 3,
            "southJakarta": south, "fromBlokMKm": round(outward, 3), "transit": nearest}


def plan(config):
    mosques = json.loads((ROOT / "research/masjid/ihrish-mosques.json").read_text())["mosques"]
    stops = []
    for file in ("transit.geojson", "mobility.geojson"):
        for f in json.loads((ROOT / "public/data" / file).read_text())["features"]:
            if f["geometry"]["type"] == "Point":
                lng, lat = f["geometry"]["coordinates"]
                stops.append({**f["properties"], "lat": lat, "lng": lng})
    targets = config["targets"]
    if set(targets) != {m["id"] for m in mosques}:
        raise ValueError("Config must cover every Ihrish mosque exactly")
    rows = []
    for m in mosques:
        paths = targets[m["id"]]
        if not paths:
            raise ValueError("Missing search area")
        sources = [canonical(ORIGIN + "/sewa/" + kind + "/" + path)
                   for path in paths for kind in ("rumah", "apartemen")]
        rows.append({"id": m["id"], "name": m["name"], "lat": m["lat"], "lng": m["lng"],
                     "sources": sources, "priority": priority(m, stops, paths)})
    return sorted(rows, key=lambda r: (r["priority"]["tier"], r["priority"]["fromBlokMKm"], r["id"]))


def fresh(record, hours):
    if not record or record.get("error"):
        return False
    try:
        stamp = dt.datetime.fromisoformat(record["retrievedAtUTC"])
        age = (dt.datetime.now(UTC) - stamp).total_seconds()
        return 0 <= age < hours * 3600
    except (ValueError, KeyError):
        return False


def detail_fresh(record, hours):
    return fresh(record, hours) and record.get("adapterVersion") == ADAPTER_VERSION


def detail_queue(cards, details, hours):
    # Explore new URLs before refreshing old ones, so the cheapest first page
    # cannot monopolize every daily run. Expired records stay explicitly stale.
    ordered = sorted(cards, key=lambda card: (card["url"] in details, monthly_hint(card), card["url"]))
    return list(dict.fromkeys(card["url"] for card in ordered if not detail_fresh(details.get(card["url"]), hours)))


def assess(detail, mosques, radius=1.5):
    row = {**detail, "issues": list(detail.get("issues", []))}
    coords = row.get("location")
    nearby = []
    if coords:
        for rank, m in enumerate(mosques):
            distance = km((coords["lat"], coords["lng"]), (m["lat"], m["lng"]))
            if distance <= radius:  # Filter before rounding, as the public builder does.
                nearby.append({"id": m["id"], "name": m["name"], "km": round(distance, 3), "rank": rank})
    row["nearbyMosques"] = sorted(nearby, key=lambda m: (m["rank"], m["km"]))
    row["reviewStatus"] = "candidate" if nearby and not row["issues"] and not row.get("error") else "held"
    return row


def mark_duplicates(rows):
    by_point, images = {}, {}
    for row in rows:
        if loc := row.get("location"):
            by_point.setdefault((loc["lat"], loc["lng"]), []).append(row)
        for image in row.get("imageHashes", []):
            images.setdefault(image, []).append(row)
    for group in by_point.values():
        if len(group) > 1:
            for row in group:
                if all(r["location"].get("precision") == "building" for r in group):
                    row["sharedBuildingReference"] = True
                elif "shared-point-needs-review" not in row["issues"]:
                    row["issues"].append("shared-point-needs-review")
    for group in images.values():
        if len(group) > 1:
            for row in group:
                if "possible-duplicate-photo" not in row["issues"]:
                    row["issues"].append("possible-duplicate-photo")
    for row in rows:
        if row["issues"]:
            row["reviewStatus"] = "held"


def report(state, mosques, config):
    catalog = json.loads((ROOT / "research/rentals.json").read_text())["rentals"]
    known = {catalog_url(r["listingUrl"]) for r in catalog}
    rows = [assess(detail, mosques, config.get("radiusKm", 1.5)) for detail in state["details"].values()]
    mark_duplicates(rows)
    for row in rows:
        row["alreadyCatalogued"] = row["url"] in known
        row["stale"] = not detail_fresh(row, config["detailCacheHours"])
        if row["stale"]:
            row["reviewStatus"] = "held"
    rows.sort(key=lambda r: (min((m["rank"] for m in r["nearbyMosques"]), default=999), r.get("monthlyEquivalent") or math.inf, r["url"]))
    coverage = []
    for m in mosques:
        discovered = {card["url"] for page, record in state["pages"].items()
                      if page.split("?")[0] in m["sources"] for card in record.get("cards", [])}
        nearby = [r for r in rows if any(n["id"] == m["id"] for n in r["nearbyMosques"])]
        valid = [r for r in nearby if r["reviewStatus"] == "candidate"]
        statuses = [{"url": s, "retrievedAtUTC": state["pages"].get(s, {}).get("retrievedAtUTC"),
                     "error": state["pages"].get(s, {}).get("error"),
                     "total": state["pages"].get(s, {}).get("total"),
                     "fresh": fresh(state["pages"].get(s), config["searchCacheHours"])} for s in m["sources"]]
        coverage.append({**m, "sourceStatus": statuses, "discovered": len(discovered),
                         "detailsAttempted": len(discovered & state["details"].keys()),
                         "detailsRead": sum(bool(state["details"][u].get("sha256")) for u in discovered & state["details"].keys()),
                         "candidates": len(valid), "newCandidates": sum(not r["alreadyCatalogued"] for r in valid),
                         "heldNearby": len(nearby) - len(valid)})
    return {"schemaVersion": 1, "generatedAtUTC": now(), "robots": state.get("robots"),
            "run": state.get("lastRun"), "note": "Kandidat untuk kurasi. Titik perkiraan portal dan jarak garis lurus; stok belum dikonfirmasi. Nol hasil bukan bukti tidak ada sewa.",
            "summary": {"mosques": len(mosques), "mosquesWithCandidates": sum(c["candidates"] > 0 for c in coverage),
                        "detailAttempts": len(rows), "details": sum(bool(r.get("sha256")) for r in rows),
                        "candidates": sum(r["reviewStatus"] == "candidate" for r in rows),
                        "newCandidates": sum(r["reviewStatus"] == "candidate" and not r["alreadyCatalogued"] for r in rows)},
            "coverage": coverage, "results": rows}


def markdown(result):
    s = result["summary"]
    lines = ["# Pantauan sewa sekitar masjid Ihrish", "", result["note"], "",
             f"Dibuat {result['generatedAtUTC']}. {s['details']} detail dibaca; {s['newCandidates']} kandidat baru untuk diperiksa; {s['mosquesWithCandidates']}/{s['mosques']} masjid punya kandidat.", "",
             "Prioritas: dekat transportasi (rel ≤1,5 km / halte TJ ≤0,7 km), Jakarta Selatan lalu menjauh dari Blok M. Semua jarak garis lurus.", "",
             "| Masjid | Transit terdekat | Kandidat baru | Detail dibaca |", "| --- | --- | ---: | ---: |"]
    for c in result["coverage"]:
        near = sorted(c["priority"]["transit"], key=lambda t: (not t["near"], t["km"]))
        transit = f"{near[0]['mode']} {near[0]['name']} ≈{near[0]['km']} km" if near else "Belum ada dalam dataset"
        lines.append(f"| {c['name']} | {transit} | {c['newCandidates']} | {c['detailsRead']}/{c['discovered']} |")
    lines += ["", "## Kandidat baru untuk kurasi", ""]
    for r in result["results"]:
        if r["reviewStatus"] != "candidate" or r["alreadyCatalogued"]:
            continue
        near = r["nearbyMosques"][0]
        date = r.get("sourceUpdatedAt")
        date = date[:10] if date else "tidak ditampilkan"
        lines.append(f"- [{r['kind']} {r.get('bedrooms') or '?'} kamar, {r['locality']}]({r['url']}) — Rp{r['amount']:,.0f}/{r['period']}; {near['name']} ≈{near['km']} km. Pembaruan sumber {date}.")
    return "\n".join(lines) + "\n"


def run(config, mosques, directory, source_limit=None, detail_limit=None, adapter=None, cancel=None):
    path = directory / "state.json"
    state = json.loads(path.read_text()) if path.exists() else {"schemaVersion": 1, "pages": {}, "details": {}, "cursors": {}}
    if state.get("schemaVersion") != 1:
        raise ValueError("Unknown state version")
    client = Client(config["delaySeconds"], adapter) if adapter else Client(config["delaySeconds"])
    if cancel is not None:
        client.cancel = cancel
    search_parser = adapter.parse_search if adapter else parse_search
    detail_parser = adapter.parse_detail if adapter else parse_detail
    state["lastRun"] = {"startedAtUTC": now(), "status": "running"}
    save(path, state)
    sources = list(dict.fromkeys(s for m in mosques for s in m["sources"]))
    count, detail_count = 0, 0
    try:
        state["robots"] = client.start()
        # Unvisited/stale areas first; priority order is preserved within each group.
        sources.sort(key=lambda s: fresh(state["pages"].get(s), config["searchCacheHours"]))
        for source in sources:
            if count >= (source_limit or config["maxSearchRequests"]):
                break
            pages = [source]
            if fresh(state["pages"].get(source), config["searchCacheHours"]):
                pages = []
            for url in pages:
                try:
                    text = client.get(url)
                    parsed = search_parser(text, url)
                    state["pages"][url] = {**parsed, "retrievedAtUTC": now(), "sha256": digest(text)}
                except (ValueError, KeyError, TypeError, OSError, TimeoutError) as exc:
                    state["pages"][url] = {"retrievedAtUTC": now(), "error": safe_error(exc), "cards": []}
                count += 1
                save(path, state)
        # A second pass rotates pagination, so large areas do not starve other mosques.
        cursor = state.get("paginationCursor", 0) % len(sources)
        for index in list(range(cursor, len(sources))) + list(range(cursor)):
            if count >= (source_limit or config["maxSearchRequests"]):
                break
            source = sources[index]
            state["paginationCursor"] = (index + 1) % len(sources)
            first = state["pages"].get(source, {})
            total = min(first.get("pages", 0), config["maxPagesPerArea"])
            if total < 2:
                continue
            page = state["cursors"].get(source, 2)
            if page > total:
                page = 2
            url = source + "?page=" + str(page)
            if not fresh(state["pages"].get(url), config["searchCacheHours"]):
                try:
                    text = client.get(url)
                    state["pages"][url] = {**search_parser(text, url), "retrievedAtUTC": now(), "sha256": digest(text)}
                except (ValueError, KeyError, TypeError, OSError, TimeoutError) as exc:
                    state["pages"][url] = {"retrievedAtUTC": now(), "error": safe_error(exc), "cards": []}
                count += 1
            state["cursors"][source] = page + 1
            save(path, state)
        # Fair rounds across source areas. Previously read details are refreshed at TTL.
        queues = []
        for source in dict.fromkeys(s for m in mosques for s in m["sources"]):
            cards = [c for page, record in state["pages"].items()
                     if page.split("?")[0] == source and fresh(record, config["searchCacheHours"])
                     for c in record.get("cards", []) if not c.get("rented")]
            queues.append(detail_queue(cards, state["details"], config["detailCacheHours"]))
        seen = set()
        while any(queues) and detail_count < (detail_limit or config["maxDetailRequests"]):
            for queue in queues:
                if not queue or detail_count >= (detail_limit or config["maxDetailRequests"]):
                    continue
                url = queue.pop(0)
                if url in seen:
                    continue
                seen.add(url)
                try:
                    text = client.get(url)
                    state["details"][url] = {**detail_parser(text, url), "retrievedAtUTC": now(), "sha256": digest(text)}
                except (ValueError, KeyError, TypeError, OSError, TimeoutError) as exc:
                    state["details"][url] = {"url": url, "retrievedAtUTC": now(), "error": safe_error(exc), "issues": ["detail-unavailable"]}
                detail_count += 1
                save(path, state)
        state["lastRun"]["status"] = "complete-with-limits"
    except StopSource as exc:
        state["lastRun"].update(status="source-stopped", reason=str(exc))
    except KeyboardInterrupt:
        state["lastRun"].update(status="interrupted", reason="operator-or-time-limit")
    except Exception as exc:
        state["lastRun"].update(status="failed", reason=safe_error(exc))
    finally:
        state["lastRun"].update(finishedAtUTC=now(), requests=client.requests, searchRequests=count, detailRequests=detail_count)
        save(path, state)
        result = report(state, mosques, config)
        save(directory / "latest.json", result)
        (directory / "latest.md").write_text(markdown(result))
        (directory / "latest.md").chmod(0o600)
        print(json.dumps({**result["summary"], "run": state["lastRun"], "output": str(directory / "latest.md")}))
    return 0 if state["lastRun"]["status"] == "complete-with-limits" else 2


def safe_error(exc):
    # Error messages from remote pages must not be copied into journals or state.
    if isinstance(exc, ValueError) and re.fullmatch(r"[A-Za-z0-9 :_-]{1,100}", str(exc)):
        return str(exc)
    return type(exc).__name__


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=ROOT / "research/rental-crawl-sources.json")
    parser.add_argument("--output-dir", type=Path, default=ROOT / ".runtime/research/rental-crawl")
    parser.add_argument("--run", action="store_true", help="Explicitly enable network acquisition")
    parser.add_argument("--max-search", type=int)
    parser.add_argument("--max-detail", type=int)
    args = parser.parse_args()
    if any(n is not None and not 1 <= n <= 1000 for n in (args.max_search, args.max_detail)):
        parser.error("Request limits must be 1..1000")
    config = json.loads(args.config.read_text())
    if config.get("schemaVersion") != 1 or not 1 <= config["delaySeconds"] <= 30:
        raise ValueError("Invalid crawl config")
    for key in ("maxSearchRequests", "maxDetailRequests", "maxPagesPerArea", "searchCacheHours", "detailCacheHours"):
        if type(config.get(key)) is not int or not 1 <= config[key] <= 1000:
            raise ValueError("Invalid config limit: " + key)
    if not 0 < config.get("radiusKm", 0) <= 3:
        raise ValueError("Invalid radius")
    mosques = plan(config)
    directory = args.output_dir.resolve()
    private_local = directory.is_relative_to(ROOT / ".runtime/research") and directory != ROOT / ".runtime/research"
    if not private_local and directory != Path("/var/lib/rumah-tinggal-rental-crawl").resolve():
        raise ValueError("Output must be a private research subdirectory")
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    if not args.run:
        save(directory / "plan.json", {"generatedAtUTC": now(), "mosques": mosques})
        print(json.dumps({"mode": "offline-plan", "mosques": len(mosques), "sources": len({s for m in mosques for s in m["sources"]}), "first": [m["id"] for m in mosques[:10]]}))
        return 0
    def stop(_signum, _frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop)
    with (directory / "crawl.lock").open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("A crawl is already running")
            return 0
        return run(config, mosques, directory, args.max_search, args.max_detail)


if __name__ == "__main__":
    raise SystemExit(main())
