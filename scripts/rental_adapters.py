"""Explicit public-page adapters. Missing location is never filled from city centers."""

import html
from html.parser import HTMLParser
import json
import math
import re
import urllib.parse
import xml.etree.ElementTree as ET


def plain(value):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value or ""))).strip()


def number(value):
    try:
        n = float(value)
        return n if math.isfinite(n) and n >= 0 else None
    except (TypeError, ValueError):
        return None


class Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])


class Adapter:
    def __init__(self, name, core, cancel=None):
        self.name, self.core, self.cancel = name, core, cancel
        self.origin = {"jendela360": "https://jendela360.com", "realoka": "https://www.realoka.com",
                       "brighton": "https://www.brighton.co.id", "jakartaprime": "https://jakartaprime.com",
                       "mamikos": "https://mamikos.com"}[name]

    def canonical(self, value):
        u = urllib.parse.urlsplit(urllib.parse.urljoin(self.origin + "/", value))
        expected = urllib.parse.urlsplit(self.origin)
        if u.scheme != "https" or u.netloc != expected.netloc or u.username or u.password or u.fragment:
            raise ValueError("URL outside provider")
        p = u.path.rstrip("/")
        patterns = {
            "realoka": r"/(?:robots\.txt|(?:rumah|apartemen)-disewakan/[a-z0-9-]+|[1-9][0-9]{3,}-[a-z0-9-]+)",
            "brighton": r"/(?:robots\.txt|disewa/(?:rumah|apartment)/[a-z0-9-]+|cari-properti/view/[a-z0-9-]+)",
            "jendela360": r"/(?:robots\.txt|apartemen/[a-z0-9-]+|apartemen-[a-z0-9-]+|sewa-apartemen-[a-z0-9-]+(?:/[A-Z][A-Z0-9]{3,11})?)",
            "jakartaprime": r"/(?:robots\.txt|sewa-rumah|sewa-apartemen/(?:jakarta-selatan|jakarta-pusat)|listing/disewakan-[a-z0-9-]+)",
            "mamikos": r"/(?:robots\.txt|room/kost-[a-z0-9-]+|sitemaps/sitemap/sitemap-room-kost-(?:jakarta|bekasi|bogor|depok|tangerang)-[1-9][0-9]?\.xml)",
        }
        if not re.fullmatch(patterns[self.name], p):
            raise ValueError("URL outside public rental routes")
        pairs = urllib.parse.parse_qsl(u.query, keep_blank_values=True)
        if pairs and (self.name != "realoka" or len(pairs) != 1 or pairs[0][0] != "page"
                      or not re.fullmatch(r"[1-9][0-9]{0,3}", pairs[0][1]) or self.is_detail(self.origin+p)):
            raise ValueError("Unsupported provider query")
        return self.origin+p+("?"+urllib.parse.urlencode(pairs) if pairs else "")

    def is_detail(self, url):
        path = urllib.parse.urlsplit(url).path
        if self.name == "realoka":
            return bool(re.fullmatch(r"/[1-9][0-9]{3,}-[a-z0-9-]+", path))
        if self.name == "brighton":
            return path.startswith("/cari-properti/view/")
        if self.name == "jakartaprime":
            return path.startswith("/listing/disewakan-")
        if self.name == "mamikos":
            return path.startswith("/room/kost-")
        return bool(re.fullmatch(r"/sewa-apartemen-[a-z0-9-]+/[A-Z][A-Z0-9]{3,11}", path))

    def sources(self, paths, config):
        urls = []
        for path in paths:
            parts = path.split("/")
            city = config.get("cityAliases", {}).get(parts[1], parts[1])
            if city not in config["cities"]:
                continue
            if self.name == "realoka":
                urls += [self.origin + "/" + kind + "-disewakan/" + city for kind in ("rumah", "apartemen")]
            elif self.name == "brighton":
                urls += [self.origin + "/disewa/" + kind + "/" + city for kind in ("rumah", "apartment")]
            elif self.name == "jakartaprime":
                urls += [self.origin + "/sewa-apartemen/" + city, self.origin + "/sewa-rumah"]
            elif self.name == "mamikos":
                urls += [self.origin + f"/sitemaps/sitemap/sitemap-room-kost-{city}-{page}.xml"
                         for page in range(1, config["sitemapPages"][city] + 1)]
            else:
                district = parts[2] if len(parts) > 2 else ""
                if district in config.get("districts", []):
                    urls.append(self.origin + "/apartemen-" + district)
                urls.append(self.origin + "/apartemen/" + city)
        return list(dict.fromkeys(self.canonical(url) for url in urls))

    def parse_search(self, text, url):
        if self.name == "mamikos":
            try:
                root = ET.fromstring(text)
            except ET.ParseError as exc:
                raise ValueError("Source structure changed Mamikos sitemap") from exc
            ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
            if root.tag != ns + "urlset":
                raise ValueError("Source structure changed Mamikos sitemap")
            cards = {}
            # Only top-level property locations. Image locations are not listings.
            for node in root.findall(ns + "url"):
                loc = node.find(ns + "loc")
                if loc is None or not loc.text:
                    continue
                try:
                    link = self.canonical(loc.text.strip())
                    if self.is_detail(link):
                        cards[link] = {"url": link}
                except ValueError:
                    continue
            if not cards:
                raise ValueError("Source structure changed Mamikos room links")
            return {"cards": list(cards.values()), "total": len(cards), "page": 1, "pages": 1,
                    "locationLabel": urllib.parse.urlsplit(url).path.rsplit("/", 1)[-1]}
        parser = Links()
        parser.feed(text)
        cards = {}
        for raw in parser.links:
            try:
                link = self.canonical(raw)
                if self.is_detail(link):
                    cards[link] = {"url": link}
            except ValueError:
                pass
        page = int(dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(url).query)).get("page", "1"))
        if self.name == "jendela360":
            data = self.core.script_json(text, "__NEXT_DATA__")["props"]["pageProps"]["data"]
            units = data.get("server_side_initial_units", data.get("initial_units"))
            if not isinstance(units, list):
                raise ValueError("Source structure changed Jendela360 units")
            # HTML contains recommendation links too. Only explicit rental cards qualify.
            cards = {}
            for unit in units:
                try:
                    link = self.canonical(self.origin + "/sewa-apartemen-" + unit["apartment_slug"] + "/" + unit["code"])
                except (ValueError, KeyError, TypeError):
                    continue
                if not unit.get("is_sell") and not unit.get("selling_price"):
                    cards[link] = {"url": link, "rented": unit.get("is_available") not in (1, True)}
            total = data.get("server_side_total_units", data.get("total_unit", len(cards)))
            total = int(total or 0)
            if total and not cards:
                raise ValueError("Source structure changed rental cards")
        else:
            # Fail closed on a 200 page whose layout is no longer recognized.
            if not re.search(r"<h1\b", text, re.I) or (not cards and not re.search(r"tidak (?:ada|ditemukan)|belum ada|0 properti", plain(text), re.I)):
                raise ValueError("Source structure changed search cards")
            found = re.search(r"Menampilkan\s+([\d.,]+)\s+properti", plain(text), re.I)
            total = int(re.sub(r"\D", "", found[1])) if found else len(cards)
        # Brighton forbids query pagination; Jendela360 public SSR has no proven cursor.
        pages = 1
        if self.name == "realoka":
            pages = max([page]+[int(v) for raw in parser.links for k, v in urllib.parse.parse_qsl(urllib.parse.urlsplit(raw).query)
                               if k == "page" and re.fullmatch(r"[1-9][0-9]{0,3}", v)])
        return {"cards": list(cards.values()), "total": total, "page": page, "pages": pages,
                "locationLabel": self.core.public_text(urllib.parse.urlsplit(url).path.split("/")[-1])}

    def base(self, url, kind):
        return {"url": url, "adapterVersion": self.core.ADAPTER_VERSION, "provider": self.name,
                "kind": kind, "amount": None, "period": None, "monthlyEquivalent": None,
                "sourceUpdatedAt": None, "sourceUpdatedLabel": None, "sourceStatus": "public-offer",
                "locality": "", "location": None, "bedrooms": None, "buildingAreaM2": None,
                "landAreaM2": None, "imageHashes": [], "issues": [],
                "availability": "not-confirmed-with-advertiser"}

    def finish(self, row):
        amount, period = row["amount"], row["period"]
        if type(amount) not in (int, float) or not math.isfinite(amount) or not 100_000 <= amount <= 200_000_000:
            row["amount"] = None
            row["issues"].append("invalid-rent")
        if period not in ("monthly", "yearly"):
            row["issues"].append("unknown-rent-period")
        if row["amount"] and period:
            row["monthlyEquivalent"] = row["amount"] / (12 if period == "yearly" else 1)
        if not row["location"]:
            row["issues"].append("no-proven-location")
        row["imageHashes"] = sorted(set(row["imageHashes"]))
        return row

    def parse_mamikos(self, text, url):
        match = re.search(r"\bvar\s+detail\s*=\s*(?=\{)", text)
        if not match:
            raise ValueError("Source structure changed Mamikos detail")
        # Decode one JSON value. Never evaluate the surrounding JavaScript.
        data, _ = json.JSONDecoder().raw_decode(text[match.end():])
        if not isinstance(data, dict) or data.get("slug") != urllib.parse.urlsplit(url).path.rsplit("/", 1)[-1]:
            raise ValueError("Mamikos room identity mismatch")
        row = self.base(url, "Kos")
        formats = data.get("price_title_formats") or {}
        options = []
        for months, key, label in [(1, "price_monthly", "bulan"), (3, "price_quarterly", "3 bulan"),
                                   (6, "price_semiannualy", "6 bulan"), (12, "price_yearly", "tahun")]:
            value = number(data.get(key))
            if not value:
                continue
            display = formats.get("price_semiannually" if months == 6 else key) or {}
            if display.get("currency_symbol") != "Rp":
                row["issues"].append("non-idr-price-needs-review")
                continue
            shown = str(display.get("price") or "")
            shown_amount = int(shown.replace(".", "")) if re.fullmatch(r"[0-9]+(?:\.[0-9]{3})*", shown) else None
            if shown_amount != value or display.get("rent_type_unit") != label:
                row["issues"].append("payment-options-needs-review")
                continue
            if display.get("long_term_rate") is not None:
                row["issues"].append("payment-options-needs-review")
                continue
            options.append({"months": months, "amount": value})
        row["priceOptions"] = options
        chosen = next((p for months in (1, 12) for p in options if p["months"] == months), None)
        if chosen:
            row.update(amount=chosen["amount"], period="monthly" if chosen["months"] == 1 else "yearly")
        minimum = data.get("min_month")
        if type(minimum) is int and 1 <= minimum <= 120:
            row["minimumRentMonths"] = minimum
        elif isinstance(minimum, str) and (term := re.fullmatch(r"Min\.\s*([1-9][0-9]{0,2})\s*Bln", minimum, re.I)) and int(term[1]) <= 120:
            row["minimumRentMonths"] = int(term[1])
        rooms = number(data.get("available_room"))
        if type(data.get("status")) is not int or data["status"] != 0 or rooms is None or rooms <= 0:
            row["issues"].append("inactive-or-rented")
        else:
            row["sourceStatus"] = "unit_type_status.active"
        if data.get("not_updated") is True or data.get("is_inactive_owner") is True:
            row["issues"].append("source-availability-needs-review")
        rules = data.get("booking_rules") or {}
        row["residentPolicy"] = {"marriedCouplesAllowed": rules.get("is_married") if type(rules.get("is_married")) is bool else None,
                                 "childrenAllowed": rules.get("is_bring_child") if type(rules.get("is_bring_child")) is bool else None}
        # Campur alone does not establish permission for couples or children.
        if type(data.get("gender")) is not int or data["gender"] != 0 or any(v is not True for v in row["residentPolicy"].values()):
            row["issues"].append("resident-policy-needs-review")
        point = self.core.point(str(data.get("latitude")) + "," + str(data.get("longitude")))
        if point:
            row["location"] = {"lat": round(point[0], 6), "lng": round(point[1], 6), "precision": "approximate"}
        row["locality"] = ", ".join(self.core.public_text(data.get(k), 90) for k in ("area_subdistrict", "area_city") if data.get(k))
        size = re.fullmatch(r"\s*([0-9]+(?:[.,][0-9]+)?)\s*[xX×]\s*([0-9]+(?:[.,][0-9]+)?)\s*", str(data.get("size") or ""))
        if size:
            area = float(size[1].replace(",", ".")) * float(size[2].replace(",", "."))
            if 2 <= area <= 200:
                row["buildingAreaM2"] = round(area, 2)
        row["bedrooms"] = 1
        stamp = data.get("updated_at")
        row["sourceUpdatedAt"] = stamp if isinstance(stamp, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?", stamp) else None
        row["sourceDateKind"] = "modified" if row["sourceUpdatedAt"] else "not-published"
        photos = data.get("photo_url") or {}
        photos = photos.get("large", []) if isinstance(photos, dict) else []
        if isinstance(photos, str):
            photos = [photos]
        if isinstance(photos, list):
            row["imageHashes"] = [self.photo_hash(p) for p in photos[:5] if isinstance(p, str)]
        row["issues"] = list(dict.fromkeys(row["issues"]))
        return self.finish(row)

    def photo_hash(self, url):
        # Normalize common image proxy wrappers before comparing source paths.
        path = urllib.parse.urlsplit(url).path
        path = re.sub(r"^/unsafe/(?:[^/]+/)*plain/", "/", path)
        return self.core.digest(path)

    def parse_detail(self, text, url):
        if self.name == "mamikos":
            return self.parse_mamikos(text, url)
        if self.name == "jakartaprime":
            return self.parse_prime(text, url)
        if self.name == "jendela360":
            props = self.core.script_json(text, "__NEXT_DATA__")["props"]["pageProps"]
            data = props["unitDetailProps"]["data"]
            if not url.endswith("/"+data["code"]):
                raise ValueError("Unit code mismatch")
            row = self.base(url, "Apartemen")
            # Never treat display_price or a yearly/12 marketing figure as monthly rent.
            if (value := number(data.get("price_per_1_month"))) and value > 0:
                row.update(amount=value, period="monthly", minimumRentMonths=1)
            elif (value := number(data.get("price_per_12_months"))) and value > 0:
                row.update(amount=value, period="yearly", minimumRentMonths=12)
            else:
                row["issues"].append("no-supported-payment-period")
            row["priceOptions"] = [{"months": months, "amount": value} for months, key in [(1, "price_per_1_month"), (3, "price_per_3_months"), (6, "price_per_6_months"), (12, "price_per_12_months")]
                                   if (value := number(data.get(key))) and value > 0]
            row["minimumRentMonths"] = min((p["months"] for p in row["priceOptions"]), default=None)
            if data.get("is_dollar"):
                row["issues"].append("non-idr-price-needs-review")
            if data.get("is_available") not in (1, True):
                row["issues"].append("inactive-or-rented")
            else:
                row["sourceStatus"] = "unit_type_status.active"
            coords = self.core.point(str(data.get("latitude"))+","+str(data.get("longitude")))
            if coords:
                row["location"] = {"lat": round(coords[0], 6), "lng": round(coords[1], 6), "precision": "building"}
            row["bedrooms"], row["buildingAreaM2"] = number(data.get("bedroom")), number(data.get("unit_area"))
            row["buildingName"] = self.core.public_text(data.get("apartment_name"), 100)
            crumb = data.get("breadcrumb") or {}
            row["locality"] = self.core.public_text(", ".join((crumb.get(key) or {}).get("name", "") for key in ("district", "area")))
            row["imageHashes"] = [self.photo_hash(p["image"]) for p in data.get("photos", [])[:5] if p.get("image")]
            # The site does not publish an update timestamp for these unit records.
            row["sourceDateKind"] = "not-published"
            return self.finish(row)
        if self.name == "brighton":
            blocks = re.findall(r'<script\b[^>]*type=[\'"]application/ld\+json[\'"][^>]*>(.*?)</script>', text, re.S | re.I)
            nodes = []
            for block in blocks:
                parsed = json.loads(block)
                nodes += parsed if isinstance(parsed, list) else parsed.get("@graph", [parsed])
            listing = next((n for n in nodes if n.get("@type") == "RealEstateListing"), None)
            if listing is None:
                raise ValueError("Source structure changed Brighton listing")
            offers, entity = listing.get("offers") or {}, listing.get("mainEntity") or {}
            if isinstance(offers, list) and len(offers) == 1:
                offers = offers[0]
            if not isinstance(offers, dict) or not isinstance(entity, dict):
                raise ValueError("Source structure changed Brighton offer or residence")
            kind = "Apartemen" if "Apartment" in str(entity.get("@type")) else "Rumah"
            row = self.base(url, kind)
            if entity.get("@type") not in ("Apartment", "ApartmentComplex", "SingleFamilyResidence", "House"):
                row["issues"].append("property-kind-needs-review")
            if "LeaseOut" not in json.dumps(offers.get("businessFunction", {})):
                row["issues"].append("not-a-rental-offer")
            if offers.get("priceCurrency") != "IDR":
                row["issues"].append("non-idr-price-needs-review")
            row["amount"] = number(offers.get("price"))
            description = plain(listing.get("description", ""))
            periods = set()
            for pattern, period in [(r"(?:per\s*|/\s*)(?:tahun|thn?\b|year\b)|pertahun", "yearly"),
                                    (r"(?:per\s*|/\s*)(?:bulan|bln\b|month\b)|perbulan", "monthly")]:
                if re.search(pattern, description, re.I):
                    periods.add(period)
            if len(periods) == 1:
                row["period"] = periods.pop()
            if "InStock" in str(offers.get("availability")):
                row["sourceStatus"] = "unit_type_status.active"
            else:
                row["issues"].append("inactive-or-rented")
            row["sourceUpdatedAt"] = listing.get("dateModified") or listing.get("datePosted")
            row["sourceDateKind"] = "modified" if listing.get("dateModified") else "posted"
            row["locality"] = self.core.public_text((entity.get("address") or {}).get("addressLocality"))
            row["bedrooms"] = number(entity.get("numberOfRooms"))
            row["buildingAreaM2"] = number((entity.get("floorSize") or {}).get("value"))
            row["landAreaM2"] = number((entity.get("additionalProperty") or {}).get("value"))
            image = listing.get("image") or []
            image = [image] if isinstance(image, str) else image
            row["imageHashes"] = [self.photo_hash(v) for v in image[:5] if isinstance(v, str)]
            # Banner ads also contain coordinates. They are never the listing location.
            return self.finish(row)
        row = self.base(url, "Rumah")
        heading = re.search(r"<h1\b[^>]*>(.*?)</h1>", text, re.S | re.I)
        if not heading:
            raise ValueError("Source structure changed Realoka rental")
        if not re.search(r"apartemen|rumah|kontrakan", plain(heading[1]), re.I):
            row["issues"].append("property-kind-needs-review")
        if re.search("apartemen", plain(heading[1]), re.I):
            row["kind"] = "Apartemen"
        price_matches = re.findall(r'<span class="detailpage-angka">([\d.,]+)</span>\s*<span class="harian">(Bulanan|Tahunan|Harian)</span>', text)
        options = [{"amount": int(re.sub(r"\D", "", value)), "period": {"Bulanan": "monthly", "Tahunan": "yearly", "Harian": "daily"}[period]}
                   for value, period in price_matches]
        row["priceOptions"] = options
        chosen = next((o for o in options if o["period"] == "monthly"), None) or next((o for o in options if o["period"] == "yearly"), None)
        if chosen:
            row.update(chosen)
        specs = {plain(k): plain(v) for k, v in re.findall(r'<span class="p-f-box-head[^"]*">(.*?)</span>\s*<span class="p-f-box-info[^"]*">(.*?)</span>', text, re.S)}
        row["bedrooms"] = number(specs.get("Kamar Tidur"))
        for field, label in [("buildingAreaM2", "Luas Bangunan"), ("landAreaM2", "Luas Tanah")]:
            raw = re.match(r"[\d.,]+", specs.get(label, ""))
            row[field] = number(raw[0]) if raw else None
        row["sourceUpdatedLabel"] = self.core.public_text(specs.get("Diperbarui"), 70)
        row["sourceDateKind"] = "relative-or-unknown"
        address = re.search(r'<span class="post-address2">(.*?)</span>', text, re.S)
        if address:
            cities = re.findall(r"Jakarta (?:Selatan|Barat|Timur|Pusat|Utara)|Tangerang Selatan|Tangerang|Depok|Bekasi|Bogor|Bandung(?: Barat)?", plain(address[1]), re.I)
            row["locality"] = ", ".join(dict.fromkeys(cities))
        image = re.search(r'<meta[^>]*property="og:image"[^>]*content="([^"]+)"', text)
        if image:
            row["imageHashes"] = [self.photo_hash(image[1])]
        return self.finish(row)

    def parse_prime(self, text, url):
        nodes = []
        for block in re.findall(r'<script\b[^>]*type=[\'"]application/ld\+json[\'"][^>]*>(.*?)</script>', text, re.S | re.I):
            parsed = json.loads(block)
            nodes += parsed if isinstance(parsed, list) else parsed.get("@graph", [parsed])
        listing = next((n for n in nodes if n.get("@type") == "RealEstateListing"), None)
        if not listing or self.canonical(listing.get("url", "")) != self.canonical(url):
            raise ValueError("Source structure changed Jakarta Prime listing")
        name = plain(listing.get("name"))
        kind = "Apartemen" if re.search(r"\bapart(?:emen|ment)\b", name, re.I) else "Rumah"
        row = self.base(url, kind)
        if not re.search(r"\b(?:apartemen|apartment|rumah|house)\b", name, re.I):
            row["issues"].append("property-kind-needs-review")
        if not self.is_detail(self.canonical(url)) or not re.search(r"disewa|sewa|for rent", name, re.I):
            row["issues"].append("not-a-rental-offer")
        offer = listing.get("offers") or {}
        spec = offer.get("priceSpecification") or {}
        row["sourceCurrency"] = offer.get("priceCurrency")
        if row["sourceCurrency"] != "IDR" or spec.get("priceCurrency", row["sourceCurrency"]) != "IDR":
            row["issues"].append("non-idr-price-needs-review")
        else:
            amount = number(offer.get("price"))
            if spec.get("price") is not None and number(spec["price"]) != amount:
                row["issues"].append("invalid-rent")
            else:
                row["amount"] = amount
        # Billing period is explicit; it is neither an equivalent nor a minimum term.
        row["period"] = {"P1M": "monthly", "P1Y": "yearly", "P12M": "yearly"}.get(spec.get("billingDuration"))
        if offer.get("availability") == "https://schema.org/InStock":
            row["sourceStatus"] = "unit_type_status.active"
        else:
            row["issues"].append("inactive-or-rented")
        row["sourceUpdatedAt"] = listing.get("dateModified") or listing.get("datePosted")
        row["sourceDateKind"] = "modified" if listing.get("dateModified") else "posted" if listing.get("datePosted") else "not-published"
        address = listing.get("address") or {}
        row["locality"] = self.core.public_text(", ".join(str(address.get(k) or "") for k in ("addressLocality", "addressRegion")))
        # Only the primary specification block, never related-unit cards or descriptions.
        bedroom = re.search(r'<dd\b[^>]*>(.*?)</dd>\s*<dt\b[^>]*>Kamar tidur</dt>', text, re.S | re.I)
        if bedroom:
            label = plain(bedroom[1])
            row["bedrooms"] = 0 if label.lower() == "studio" else number(label)
        images = listing.get("image") or []
        images = [images] if isinstance(images, str) else images
        row["imageHashes"] = [self.photo_hash(v) for v in images[:5] if isinstance(v, str)]
        # The RealEstateAgent geo is an office. No proven property pin in sampled HTML.
        # Never publish the full description, street address, contact or agent identity.
        return self.finish(row)
