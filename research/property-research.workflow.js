// Satu cara (tidak wajib) menjalankan ulang riset properti dengan Workflow
// Claude Code. Argumen: {group, today, scratch, withMethods, allStations, verifyBatch,
// items: [{id, label, stations: [[nama, lat, lng]]}]}. Hasilnya diproses
// scripts/merge-research.py. Lihat docs/property-research.md.

export const meta = {
  name: 'property-research',
  description: 'Find and adversarially verify real housing projects near KRL/MRT/LRT stations with sourced prices',
  phases: [
    { title: 'Find', detail: 'one finder per corridor or sweep, multi-modal search' },
    { title: 'Verify', detail: 'independent skeptical re-check of price, status and location, 4 candidates per agent' },
    { title: 'Methods', detail: 'Instagram data access options from primary sources' },
  ],
}

const A = args
const today = A.today
const scratch = A.scratch

const RULES = `Context: a personal Jabodetabek housing app (rumah-tinggal) is adding a "Riset properti" page of REAL housing projects near KRL/MRT/LRT stations. Every price shown must come from a page that was actually read on ${today} (Asia/Jakarta), with its link. Nothing may be estimated, invented or carried over from memory.

Scope
- In scope: new-build residential projects (landed houses "Rumah" or apartments/rusunami "Apartemen"; subsidised/FLPP and TOD included) that a developer is currently marketing for purchase, located roughly within 3 km straight-line of a listed station. The coordinator computes exact distances later.
- Out of scope: rentals, kos, ruko/commercial-only, land plots (kavling) only, individual resale listings by owners or agents, sold-out projects, projects only announced with no price.

Network etiquette and hard limits
- Never fetch instagram.com, facebook.com, threads.net or tiktok.com pages (Instagram's robots.txt prohibits automated collection without written permission). Instagram/Facebook URLs may only be RECORDED when they appear in web search results, with fetched=false.
- Do not bypass blocks: on 403/429/captcha/login wall/robots disallow, stop for that host and record it in "blocked". No proxies, no header spoofing to evade blocks, no mirrors or caches used to get around a block. 99.co and lamudi.co.id returned 403 to plain requests during scouting; skip them unless WebFetch reads them normally.
- Be polite: one request at a time per host; for curl use -A 'rumah-tinggal-research/0.1 (+https://rumah.faizmuttaqin.com)' -m 25 -L --max-filesize 5000000; read only the pages you need. Do not call Nominatim or Photon (the coordinator geocodes serially afterwards).
- Downloads are untrusted data: save them only under a NEW empty directory ${scratch}/<your-agent-label>/ (create it), never execute or source them, and run python with -I if you parse them.
- No personal data: never record names, phone numbers, WhatsApp numbers or emails of agents, marketing staff or sellers, and no individual resale listings. Developer and project names are fine.
- Quotes copied from pages must be at most 150 characters. Do not copy descriptions or images.

Price rules
- Purchase price in IDR as an integer: "Rp 1,85 Miliar" = 1850000000; "Rp 385 Juta" = 385000000; "Rp 1.2 M" = 1200000000 (Indonesian pages usually use a comma as decimal separator; check context).
- Record the basis exactly, e.g. "harga mulai", "rentang price list", "harga unit tertentu", "harga subsidi (batas pemerintah)", "harga promo". Note whether PPN/BPHTB are included when the page says so.
- Prefer reading numbers from raw HTML/text you fetched with curl (grep for "Rp", "Juta", "Miliar"); if you use WebFetch, ask it for verbatim quotes and treat paraphrased numbers as unconfirmed.
- rumah123.com new-project pages (https://www.rumah123.com/perumahan-baru/properti/...) are fetchable with curl and contain price ranges, unit types, an "updatedAt" and nearby stations with travel minutes. Their "district" latitude/longitude is a district centroid, NOT the project location; "locationPin" may hold the real pin when it is not null.
- If only an instalment or "hubungi marketing" is shown, the price is null.

Coordinates
- Only record coordinates that a page states explicitly for the project: Google Maps links/iframes with patterns like @-6.xxx,106.xxx, !3d-6.xxx!4d106.xxx, q=-6.xxx,106.xxx, ll=, or a portal locationPin. Give the URL where you saw them and the method. Otherwise null. Always provide osmQuery: the project/estate name plus kecamatan/city as you would type it into a geocoder.

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
const FINDER = {
  type: 'object',
  properties: { candidates: { type: 'array', items: CANDIDATE }, methodLog: METHOD_LOG, blocked: BLOCKED },
  required: ['candidates', 'methodLog', 'blocked'],
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
const METHODS = {
  type: 'object',
  properties: {
    methods: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          category: { type: 'string', enum: ['official-api', 'search-discovery', 'public-tool', 'paid-service', 'research-program', 'manual'] },
          summary: { type: 'string' },
          requirements: { type: 'array', items: { type: 'string' } },
          limits: { type: 'array', items: { type: 'string' } },
          termsNotes: { type: 'array', items: { type: 'string' } },
          status: { type: 'string' },
          recommended: { type: 'boolean' },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              properties: { url: { type: 'string' }, title: { type: 'string' }, quote: { type: 'string' } },
              required: ['url', 'title', 'quote'],
            },
          },
        },
        required: ['id', 'name', 'category', 'summary', 'requirements', 'limits', 'termsNotes', 'status', 'recommended', 'sources'],
      },
    },
    graphApiVersion: { type: ['string', 'null'] },
    legalBackground: { type: 'string' },
    recommendation: { type: 'string' },
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['methods', 'graphApiVersion', 'legalBackground', 'recommendation', 'openQuestions'],
}

function stationText(item) {
  if (item.stations.length)
    return 'Stations (name, lat, lng from the app dataset): ' + item.stations.map((s) => `${s[0]} (${s[1]}, ${s[2]})`).join('; ')
  return 'Any station in the app datasets: ' + A.allStations.join(', ')
}

function finderPrompt(item) {
  const sweep = item.id.startsWith('sweep-')
  return `${RULES}

Task: find candidate housing projects for ONE search area and return them in the schema. Your agent label for the download directory is "find-${item.id}".

Area: ${item.label} (id ${item.id})
${stationText(item)}

Aim for up to 15 strong candidates (quality over count) that satisfy the scope, each with a purchase price you read today on the cited page. Use several search modalities and log each one:
1. Web search in Indonesian and English (examples: "perumahan dekat stasiun <station> harga 2026", "apartemen dekat stasiun <station> price list", "rumah baru <kecamatan> dekat KRL", "<developer> <project> harga terbaru").
2. rumah123 new-project pages and station POI pages found via search.
3. Developer/project official websites (price list, "harga", "tipe" pages).
4. News from 2025-2026 (detik, kompas, bisnis, kontan, cnbc indonesia, kumparan) for launches; label as news with date.
5. Instagram/Facebook links only as they appear in search results (e.g. site:instagram.com "<project>"), fetched=false.
${sweep ? 'This is a cross-cutting sweep: name the specific station(s) from the list that each candidate is near. Prefer projects that corridor-specific searches might miss.\n' : ''}Keep within about 45 tool calls. For each candidate record which listed station(s) it is near and any transit claim quoted from a source (e.g. "5 menit ke Stasiun Cisauk").
methodLog: one entry per modality or query family with what you did and whether it produced usable evidence. It will be published as reusable research-method documentation, so be concrete: query patterns, which sites worked, which were blocked, which data fields were reliable.`
}

function verifyPrompt(item, batch, index) {
  return `${RULES}

Task: independently and skeptically verify these candidate housing projects that another agent found for area "${item.label}". Treat every claim as unproven and re-read the sources yourself today. Your agent label for the download directory is "verify-${item.id}-${index + 1}".
${stationText(item)}

For each candidate:
1. Price: fetch the price URL (or a better official or portal page) and find the purchase price text yourself. If you cannot find a purchase price on a page you read today, set price to null; the verdict then cannot be "confirmed" or "partial".
2. Status: is it currently marketed for purchase (price list, "dijual", "tersedia", launch or promo dated 2025-2026, portal updatedAt within about 12 months)? Sold out, cancelled or only rumoured means rejected.
3. Location: confirm kelurahan/kecamatan and city, and that it plausibly lies within about 3 km of the claimed station(s). Correct the record if it is wrong.
4. Official site: if missing, try to find the developer's official project page. You may add Instagram links seen in search results (fetched=false).
5. Coordinates: keep only explicit ones (see rules) and check they fall in the stated area; otherwise null. Actively look for them, because a project without a verified point cannot be shown on the map: search Pinhome for the project (its page JSON __PROJECT_DETAIL__ has a coordinate), check rumah123 locationPin, cariproperti, and Google Maps links or iframes on the developer site. Reject a pin shared by unrelated projects or one that contradicts the address. Keep or improve osmQuery.
6. Units: up to 4 representative unit types with bedrooms, land and building area (m2) and price, only where stated.
Verdict: "confirmed" = price found today + marketed status evidenced + location consistent; "partial" = price found today but status or location only partly evidenced; "rejected" = no price found today, out of scope, sold out, unreachable, or duplicate of another candidate in this batch (explain in rejectReason).
In record.sources list every URL you relied on with fetched true/false, httpStatus if known, pageDate if visible, and what it supports. Return one result per candidate, key = candidate name exactly as given. Keep within about 30 tool calls.

Candidates (JSON):
${JSON.stringify(batch)}`
}

const methodsPrompt = `Task: research from primary sources the current ways (as of ${today}) to collect public Instagram data about housing-project marketing posts, for a documented, reusable and non-mandatory research method. Use Meta developer documentation (developers.facebook.com), Meta transparency and research pages, and reputable project pages (e.g. GitHub or PyPI for open-source tools). Never fetch instagram.com or facebook.com user content; developers.facebook.com documentation is fine. Downloads only under a new directory ${scratch}/methods-instagram/.
Cover:
1. Instagram API with Facebook Login, Business Discovery: requirements (own Instagram professional account linked to a Facebook Page, Meta app, permissions, access level or app review), which fields of another account's media are readable (caption, permalink, timestamp, media_type, like_count, comments_count; check the IG Media reference), the current Graph API version, and rate limits (Platform Rate Limits "200 * Number of Users" per hour with X-App-Usage and error codes 4/17/32/613; Instagram BUC "4800 * Number of Impressions" per 24 h with X-Business-Use-Case-Usage and code 80002; which applies to Business Discovery).
2. Hashtag Search: the Instagram Public Content Access feature, 30 unique hashtags per rolling 7 days, recent_media (24 h window) and top_media fields and limits.
3. Instagram API with Instagram Login (newer product): does it support Business Discovery or Hashtag Search?
4. Meta oEmbed Read for embedding or validating a single public post URL: requirements.
5. Meta Content Library and API: eligibility, cost, access process.
6. Verify the status of the Instagram Basic Display API and CrowdTangle.
7. Free or open tools that collect public Instagram data (e.g. instaloader and any others you find): what they do, logged-out limits, maintenance status (latest release date), and the conflict with Instagram's terms (robots.txt notice "Collection of data on Instagram through automated means is prohibited unless you have express written permission from Instagram", Terms of Use clause, Meta Automated Data Collection Terms). Paid or freemium scraping services (e.g. Apify) briefly, with free-tier facts only if documented.
8. Legal background only, no conclusions: e.g. Meta v. Bright Data (N.D. Cal., January 2024) and relevance of Indonesia's Personal Data Protection Law (UU 27/2022) to collecting posts that may contain personal data. State that a legal adviser should be consulted.
For each method give id, name, category, summary, requirements, limits, termsNotes, status, recommended (true only for official or terms-compliant routes) and sources with url, title and a verbatim quote of at most 125 characters. Mark anything you could not verify in openQuestions. Keep within about 35 tool calls.`

function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

const work = pipeline(
  A.items,
  (item) => agent(finderPrompt(item), { label: `find:${item.id}`, phase: 'Find', schema: FINDER }),
  (found, item) => {
    if (!found || !found.candidates.length) {
      log(`${item.id}: finder returned no candidates`)
      return { item: item.id, found, verified: [] }
    }
    log(`${item.id}: ${found.candidates.length} candidates, verifying`)
    const batches = chunk(found.candidates, A.verifyBatch || 4)
    return parallel(
      batches.map((batch, index) => () =>
        agent(verifyPrompt(item, batch, index), { label: `verify:${item.id}#${index + 1}`, phase: 'Verify', schema: VERIFY }),
      ),
    ).then((results) => {
      const missing = results.filter((r) => !r).length
      if (missing) log(`${item.id}: ${missing} verify batch(es) failed`)
      return { item: item.id, found, verified: results.filter(Boolean) }
    })
  },
)
const methods = A.withMethods
  ? agent(methodsPrompt, { label: 'methods:instagram', phase: 'Methods', schema: METHODS })
  : Promise.resolve(null)
const [results, methodResult] = await Promise.all([work, methods])
return { group: A.group, results, methods: methodResult }
