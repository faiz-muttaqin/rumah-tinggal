// Satu cara (tidak wajib) memverifikasi ulang kandidat tertunda dengan Workflow
// Claude Code, tanpa tahap penemuan. Argumen: {step, today, scratch,
// withContext, batches: [{id, item, file}]}. Tiap file batch berisi {item,
// label, stations: [[nama, lat, lng]], candidates}; kandidat boleh membawa
// "corridor" sendiri. Dipakai 2026-10-30 untuk 48 kandidat Jakarta dari
// .runtime/research/recovered.json (5 sampai 6 kandidat per agen). Hasil
// dikelompokkan per koridor lalu diproses scripts/merge-research.py.
// withContext=true menambah dua agen riset sumber banjir dan penduduk.

export const meta = {
  name: 'jkt-verify-backlog',
  description: 'Verify pending Jakarta listing candidates from batch files; optional flood and population source research',
  phases: [
    { title: 'Verify listings', detail: '4 skeptical verifiers, 5-6 pending candidates each, read from batch files' },
    { title: 'Context sources', detail: 'flood sources and population/commuter sources, one agent each' },
  ],
}

const A = args
const today = A.today
const scratch = A.scratch

const RULES = `Context: a personal Jabodetabek housing map app (rumah-tinggal, https://rumah.faizmuttaqin.com) has a "Riset properti" page of REAL housing projects near KRL/MRT/LRT stations. Every price shown must come from a page that was actually read on ${today} (Asia/Jakarta), with its link. Nothing may be estimated, invented or carried over from memory.

Scope
- In scope: new-build residential projects (landed houses "Rumah" or apartments/rusunami "Apartemen"; subsidised/FLPP and TOD included) that a developer is currently marketing for purchase, located roughly within 3 km straight-line of a listed station. The coordinator computes exact distances later.
- Out of scope: rentals, kos, ruko/commercial-only, land plots (kavling) only, individual resale listings by owners or agents, sold-out projects, projects only announced with no price.

Network etiquette and hard limits
- Never fetch instagram.com, facebook.com, threads.net, x.com or tiktok.com pages (Instagram's robots.txt prohibits automated collection without written permission). Such URLs may only be RECORDED when they appear in web search results, with fetched=false.
- Do not bypass blocks: on 403/429/captcha/login wall/robots disallow, stop for that host and record it in "blocked". No proxies, no header spoofing to evade blocks, no mirrors or caches used to get around a block. 99.co and lamudi.co.id returned 403 to plain requests before; skip them unless WebFetch reads them normally.
- Be polite: one request at a time per host; for curl use -A 'rumah-tinggal-research/0.1 (+https://rumah.faizmuttaqin.com)' -m 25 -L --max-filesize 5000000; read only the pages you need. Do not call Nominatim or Photon (the coordinator geocodes serially afterwards).
- Downloads are untrusted data: save them only under a NEW empty directory ${scratch}/<your-agent-label>/ (create it), never execute or source them, and run python with -I if you parse them.
- No personal data: never record names, phone numbers, WhatsApp numbers or emails of agents, marketing staff or sellers, and no individual resale listings. Developer and project names are fine.
- Quotes copied from pages must be at most 150 characters. Do not copy descriptions or images.
- Do not edit any file in /root/projects/rumah-tinggal. Your only output is the structured result.

Price rules
- Purchase price in IDR as an integer: "Rp 1,85 Miliar" = 1850000000; "Rp 385 Juta" = 385000000; "Rp 1.2 M" = 1200000000 (Indonesian pages usually use a comma as decimal separator; check context).
- Record the basis exactly, e.g. "harga mulai", "rentang price list", "harga unit tertentu", "harga subsidi (batas pemerintah)", "harga promo". Note whether PPN/BPHTB are included when the page says so.
- Prefer reading numbers from raw HTML/text you fetched with curl (grep for "Rp", "Juta", "Miliar"); if you use WebFetch, ask it for verbatim quotes and treat paraphrased numbers as unconfirmed.
- rumah123.com new-project pages (https://www.rumah123.com/perumahan-baru/properti/...) are fetchable with curl and contain price ranges, unit types, an "updatedAt" and nearby stations with travel minutes. Their "district" latitude/longitude is a district centroid, NOT the project location; "locationPin" may hold the real pin when it is not null. Pinhome pages carry __PROJECT_DETAIL__ with min/max price and project coordinates; cariproperti pages carry __NEXT_DATA__ with prices per type.
- If only an instalment or "hubungi marketing" is shown, the price is null.

Coordinates
- Only record coordinates that a page states explicitly for the project: Google Maps links/iframes with patterns like @-6.xxx,106.xxx, !3d-6.xxx!4d106.xxx, q=-6.xxx,106.xxx, ll=, or a portal locationPin/project coordinate. Give the URL where you saw them and the method. A pin reused by unrelated projects, or one that contradicts the stated address, must be dropped. Otherwise null. Always provide osmQuery: the project/estate name plus kecamatan/city as you would type it into a geocoder.

Honesty
- Unknown = null. Do not guess developer, status, coordinates or prices. If a source is a news article, say so and give its date.`

const SOURCE = {
  type: 'object',
  properties: {
    url: { type: 'string' },
    kind: { type: 'string', enum: ['developer', 'portal', 'news', 'instagram', 'government', 'osm', 'other'] },
    title: { type: 'string' },
    fetched: { type: 'boolean' },
    httpStatus: { type: ['integer', 'null'] },
    pageDate: { type: ['string', 'null'] },
    supports: { type: 'array', items: { type: 'string', enum: ['harga', 'status', 'lokasi', 'transit', 'unit'] } },
    note: { type: ['string', 'null'] },
  },
  required: ['url', 'kind', 'title', 'fetched', 'supports'],
}
const CANDIDATE = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    developer: { type: ['string', 'null'] },
    kind: { type: 'string', enum: ['Rumah', 'Apartemen', 'Campuran'] },
    subsidized: { type: ['boolean', 'null'] },
    locationText: { type: 'string', description: 'kelurahan/kecamatan, kota/kabupaten' },
    regionClaim: { type: ['string', 'null'], description: 'kota/kabupaten name' },
    nearStations: { type: 'array', items: { type: 'string' } },
    transitClaim: {
      type: ['object', 'null'],
      properties: { quote: { type: 'string' }, url: { type: 'string' } },
      required: ['quote', 'url'],
    },
    officialUrl: { type: ['string', 'null'] },
    price: {
      type: ['object', 'null'],
      properties: {
        min: { type: ['integer', 'null'] },
        max: { type: ['integer', 'null'] },
        basis: { type: 'string' },
        quote: { type: 'string' },
        url: { type: 'string' },
        pageDate: { type: ['string', 'null'] },
        readVia: { type: 'string', enum: ['curl', 'webfetch', 'other'] },
      },
      required: ['min', 'basis', 'quote', 'url', 'readVia'],
    },
    status: {
      type: 'object',
      properties: {
        value: { type: 'string', enum: ['dipasarkan', 'pre-launch', 'inden', 'siap-huni', 'tidak-jelas', 'habis'] },
        quote: { type: ['string', 'null'] },
        url: { type: ['string', 'null'] },
      },
      required: ['value'],
    },
    units: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          bedrooms: { type: ['integer', 'null'] },
          landArea: { type: ['number', 'null'] },
          buildingArea: { type: ['number', 'null'] },
          price: { type: ['integer', 'null'] },
        },
        required: ['label'],
      },
    },
    coordinates: {
      type: ['object', 'null'],
      properties: { lat: { type: 'number' }, lng: { type: 'number' }, url: { type: 'string' }, method: { type: 'string' } },
      required: ['lat', 'lng', 'url', 'method'],
    },
    osmQuery: { type: 'string' },
    sources: { type: 'array', items: SOURCE },
    notes: { type: ['string', 'null'] },
  },
  required: ['name', 'kind', 'locationText', 'nearStations', 'price', 'status', 'osmQuery', 'sources'],
}
const METHOD_LOG = {
  type: 'array',
  items: {
    type: 'object',
    properties: { method: { type: 'string' }, detail: { type: 'string' }, outcome: { type: 'string' } },
    required: ['method', 'detail', 'outcome'],
  },
}
const BLOCKED = {
  type: 'array',
  items: { type: 'object', properties: { url: { type: 'string' }, reason: { type: 'string' } }, required: ['url', 'reason'] },
}
const VERIFY = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'candidate name exactly as given' },
          verdict: { type: 'string', enum: ['confirmed', 'partial', 'rejected'] },
          rejectReason: { type: ['string', 'null'] },
          checks: {
            type: 'object',
            properties: {
              priceFound: { type: 'boolean' },
              statusConfirmed: { type: 'boolean' },
              locationConfirmed: { type: 'boolean' },
              officialSiteFound: { type: 'boolean' },
            },
            required: ['priceFound', 'statusConfirmed', 'locationConfirmed', 'officialSiteFound'],
          },
          record: CANDIDATE,
        },
        required: ['key', 'verdict', 'checks', 'record'],
      },
    },
    methodLog: METHOD_LOG,
    blocked: BLOCKED,
  },
  required: ['results', 'methodLog', 'blocked'],
}

function verifyPrompt(b) {
  return `${RULES}

Task: independently and skeptically verify the pending candidate housing projects in the JSON file ${b.file}. Read that file first (Read tool). It holds {item, label, stations: [[name, lat, lng]], candidates}. Another agent found these candidates earlier today, but nobody verified them; their prices and statuses are unproven leads. Re-read sources yourself today. Your agent label for the download directory is "verify-${b.id}".

For each candidate:
1. Price: fetch the price URL (or a better official or portal page) and find the purchase price text yourself. If you cannot find a purchase price on a page you read today, set price to null; the verdict then cannot be "confirmed" or "partial".
2. Status: is it currently marketed for purchase (price list, "dijual", "tersedia", launch or promo dated 2025-2026, portal updatedAt within about 12 months)? Sold out, cancelled or only rumoured means rejected.
3. Location: confirm kelurahan/kecamatan and city, and that it plausibly lies within about 3 km of the listed station(s) in the file. Correct the record if it is wrong.
4. Official site: if missing, try to find the developer's official project page. You may add Instagram links seen in search results (fetched=false).
5. Coordinates: keep only explicit ones (see rules) and check they fall in the stated area; otherwise null. Actively look for them, because a project without a verified point cannot be shown on the map: search Pinhome for the project (its page JSON __PROJECT_DETAIL__ has a coordinate), check rumah123 locationPin, cariproperti, and Google Maps links or iframes on the developer site. Reject a pin shared by unrelated projects or one that contradicts the address. Keep or improve osmQuery.
6. Units: up to 4 representative unit types with bedrooms, land and building area (m2) and price, only where stated.
7. Mixed-use projects: price only the residential type that matches kind (houses vs apartments); exclude SOHO, ruko and commercial units from the range.
Verdict: "confirmed" = price found today + marketed status evidenced + location consistent; "partial" = price found today but status or location only partly evidenced; "rejected" = no price found today, out of scope, sold out, unreachable, or duplicate of another candidate in this batch (explain in rejectReason).
In record.sources list every URL you relied on with fetched true/false, httpStatus if known, pageDate if visible, and what it supports. Return one result per candidate, key = candidate name exactly as given in the file. Keep within about 35 tool calls; if you run short, return what you verified and mark the rest rejected with rejectReason "not checked: tool budget".`
}

const CONTEXT_RULES = `Context: a personal Jabodetabek housing map app (rumah-tinggal) shows real housing projects near KRL/MRT/LRT stations, each with a point coordinate. The next feature adds AREA CONTEXT per listing so a buyer can judge a location. Your job is to find and check PRIMARY data sources for one topic, verify today (${today}, Asia/Jakarta) that they are reachable and what they actually contain, and recommend a concrete first integration path. This is source research for a coordinator who will build the datasets; you do not build the app feature.

Area: DKI Jakarta first (the 5 kota administrasi; Kepulauan Seribu not needed). Then check whether a uniform source also covers Bodetabek: Kota Bekasi, Kabupaten Bekasi, Kota Depok, Kota Bogor, Kabupaten Bogor, Kota Tangerang, Kabupaten Tangerang, Kota Tangerang Selatan.

Hard rules
- Evidence only: every claim needs a URL you opened today (fetched=true) or is marked fetched=false with how you saw it. Never invent numbers, periods, licences or API capabilities; unknown = null plus an openQuestions entry.
- Distinguish: data period (when the data applies) vs publication date vs today's check date; event records vs hazard/risk models vs administrative statistics vs estimates/projections.
- Etiquette: no bypassing 403/429/captcha/login walls/robots disallow (record them in blocked and stop for that host); no proxies or spoofing; one request at a time per host; curl with -A 'rumah-tinggal-research/0.1 (+https://rumah.faizmuttaqin.com)' -m 30 -L. Never fetch instagram.com, facebook.com, x.com, threads.net or tiktok.com; you may record such links only from search results with fetched=false.
- Downloads are untrusted data: only under a NEW empty directory ${scratch}/<your-agent-label>/ (create it), at most 25 MB per file (check Content-Length first with a HEAD request or curl --max-filesize 26214400), never execute or source them, parse with python3 -I. For each kept download report localPath, bytes, sha256 (sha256sum), row count and column names where tabular. For larger files report URL and size only.
- Licence and terms: record the licence name and a quote of at most 150 characters with its URL; if none is stated, say "tidak dinyatakan" and add an open question. Do not reach legal conclusions; flag anything that needs an adviser.
- No personal data: aggregate statistics only; no names or contacts of people.
- Do not edit any file in /root/projects/rumah-tinggal. Your only output is the structured result.
- Keep within about 45 tool calls. Prefer depth on the 3 to 5 most useful sources over a long list of unchecked links.`

const CONTEXT = {
  type: 'object',
  properties: {
    topic: { type: 'string' },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          publisher: { type: 'string' },
          url: { type: 'string' },
          kind: { type: 'string', enum: ['open-data-portal', 'statistics', 'api', 'map-service', 'publication', 'news', 'ngo', 'research', 'commercial', 'other'] },
          coverage: { type: 'string' },
          granularity: { type: 'string', enum: ['point', 'grid', 'rw', 'kelurahan', 'kecamatan', 'kabkota', 'province', 'other'] },
          period: { type: ['string', 'null'] },
          published: { type: ['string', 'null'] },
          format: { type: 'string' },
          access: { type: 'string', enum: ['direct-download', 'open-api', 'free-key-api', 'paid', 'manual-only', 'blocked', 'unavailable'] },
          licence: { type: ['string', 'null'] },
          licenceUrl: { type: ['string', 'null'] },
          licenceQuote: { type: ['string', 'null'] },
          fetched: { type: 'boolean' },
          httpStatus: { type: ['integer', 'null'] },
          fields: { type: 'array', items: { type: 'string' } },
          quote: { type: ['string', 'null'], description: 'verbatim, max 150 chars, showing the data or its definition' },
          usable: { type: 'string', enum: ['yes', 'partial', 'no'] },
          notes: { type: 'string' },
        },
        required: ['id', 'name', 'publisher', 'url', 'kind', 'coverage', 'granularity', 'format', 'access', 'fetched', 'usable', 'notes'],
      },
    },
    downloads: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourceId: { type: 'string' },
          url: { type: 'string' },
          localPath: { type: 'string' },
          bytes: { type: 'integer' },
          sha256: { type: 'string' },
          rows: { type: ['integer', 'null'] },
          columns: { type: 'array', items: { type: 'string' } },
          period: { type: ['string', 'null'] },
          note: { type: ['string', 'null'] },
        },
        required: ['sourceId', 'url', 'localPath', 'bytes', 'sha256'],
      },
    },
    keyFacts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          value: { type: ['string', 'null'] },
          unit: { type: ['string', 'null'] },
          period: { type: ['string', 'null'] },
          area: { type: ['string', 'null'] },
          sourceUrl: { type: 'string' },
          quote: { type: ['string', 'null'] },
        },
        required: ['claim', 'sourceUrl'],
      },
    },
    recommendation: {
      type: 'object',
      properties: {
        firstRelease: { type: 'string', description: 'what to show per listing in a first release and from which source ids' },
        steps: { type: 'array', items: { type: 'string' } },
        joinKey: { type: 'string', description: 'how a listing point is joined to the data (point query, kelurahan name/code, kecamatan, grid cell)' },
        boundarySources: { type: 'array', items: { type: 'string' }, description: 'source ids for kelurahan/kecamatan boundaries or codes that match the data' },
        caveats: { type: 'array', items: { type: 'string' } },
        later: { type: 'array', items: { type: 'string' } },
      },
      required: ['firstRelease', 'steps', 'joinKey', 'caveats'],
    },
    methodLog: METHOD_LOG,
    blocked: BLOCKED,
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['topic', 'sources', 'downloads', 'keyFacts', 'recommendation', 'methodLog', 'blocked', 'openQuestions'],
}

const floodPrompt = `${CONTEXT_RULES}

Topic: FLOOD (banjir/genangan). Your agent label is "ctx-flood".
Answer, with checked sources:
1. Event history: which kelurahan and RW were flooded in recent events (2020 to 2026), with dates, water depth and counts, from BPBD DKI Jakarta, Satu Data Jakarta (satudata.jakarta.go.id) or the older data.jakarta.go.id portal. Find machine-readable datasets (CSV/XLSX/JSON/API), their latest period, fields and licence. Download the most useful recent ones within the size limit.
2. Hazard or risk models: BNPB InaRISK (inarisk.bnpb.go.id) flood hazard index. Is there a documented public map service (ArcGIS REST, WMS) that can be queried at a point or downloaded, and what do its terms say? Try one point query only if the service is public and documented (example point: -6.2297, 106.8296). Also any Jakarta Dinas SDA rawan genangan map.
3. Real-time or crowd reports: PetaBencana.id API (licence, coverage, what an area query returns) and Pantau Banjir Jakarta (pantaubanjir.jakarta.go.id; water gauges vs area flooding). Note whether these suit a static listing annotation.
4. Bodetabek: any uniform source (InaRISK, BNPB DIBI dibi.bnpb.go.id event counts per kab/kota) or local open data portals with flood events.
5. Boundaries: kelurahan/RW boundary or code sources that match the flood dataset naming (Satu Data Jakarta boundary files, BIG/geoportal, Kemendagri codes) and their licence.
Recommend what a first release should show per listing (e.g. "kelurahan X: N RW tergenang pada kejadian <tanggal> (sumber, periode)" and/or a hazard class at the point) and the exact join method. Also log the search method concretely (queries, portals, API patterns) so it can be reused.`

const popPrompt = `${CONTEXT_RULES}

Topic: POPULATION, DENSITY, COMMUTER FLOWS and CROWDEDNESS proxies. Your agent label is "ctx-population".
Answer, with checked sources:
1. Population and density by kecamatan, and by kelurahan if available, for DKI Jakarta, latest period: BPS DKI Jakarta (jakarta.bps.go.id statistics tables and "Dalam Angka" publications), Satu Data Jakarta (Dukcapil registered population per kelurahan), Dukcapil Kemendagri open data if public. State the definition (registered population vs BPS projection vs census) and period for each. Download the most useful machine-readable tables within the size limit.
2. Bodetabek: kecamatan population and area or density from the BPS kab/kota sites (the 8 kab/kota listed). Note format and period; download if machine-readable and small.
3. BPS Web API (webapi.bps.go.id): does it need a key, is it free, and which table/variable ids would serve kecamatan population? Do not register an account; just document.
4. Commuter flows: the latest BPS Jabodetabek commuter statistics (Survei Komuter / "Statistik Komuter Jabodetabek"; check whether a 2023 or newer edition exists). Record the publication URL, period, definitions and the key origin-destination numbers by kab/kota with page references, as keyFacts with verbatim quotes. Do not download PDFs over 25 MB.
5. Gridded population usable at a point for all of Jabodetabek: WorldPop (Indonesia 100 m, latest year, licence), Meta/HDX high-resolution population density, GHSL. Record file URLs, sizes, licence and year; do not download files over 25 MB.
6. Crowdedness of places: check from official Google documentation whether Google Maps "popular times"/busyness is available through the official Places API (yes or no, with a quote). Record any other open, official source of place or station crowding (for example operator ridership per station published by KAI Commuter, MRT Jakarta, LRT Jakarta or Satu Data Jakarta). No scraping of Google Maps.
Recommend what a first release should show per listing (e.g. kecamatan density with period and source, gridded density at the point, commuter context for its kab/kota, station ridership if open) and the exact join method. Also log the search method concretely so it can be reused.`

const verifyJobs = A.batches.map((b) => () =>
  agent(verifyPrompt(b), { label: `verify:${b.id}`, phase: 'Verify listings', schema: VERIFY }).then((r) => ({ item: b.item, id: b.id, result: r })),
)
const contextJobs = !A.withContext ? [] : [
  () => agent(floodPrompt, { label: 'ctx:flood', phase: 'Context sources', schema: CONTEXT }),
  () => agent(popPrompt, { label: 'ctx:population', phase: 'Context sources', schema: CONTEXT }),
]
const [verified, context] = await Promise.all([parallel(verifyJobs), parallel(contextJobs)])
const failed = verified.filter((v) => !v || !v.result).length
if (failed) log(`${failed} verify batch(es) returned nothing`)
return { step: A.step, verified: verified.filter(Boolean), context: A.withContext ? { flood: context[0], population: context[1] } : null }
