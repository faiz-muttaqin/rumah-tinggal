// Kandidat bukti dari akun Instagram bisnis/kreator developer melalui
// Instagram Graph API resmi (Business Discovery, Instagram API with Facebook
// Login). Membutuhkan akun profesional milik sendiri yang terhubung ke Halaman
// Facebook dan token pengguna. Skrip tidak membuka halaman instagram.com,
// berhenti sebelum batas laju, dan hanya menulis kandidat untuk dicek manual.
//
// Pemakaian:
//   node --env-file=.runtime/instagram/private.env scripts/instagram-discovery.ts akun1 akun2
// Wajib: IG_GRAPH_VERSION sesuai versi yang tersedia di dasbor aplikasi Meta.
// Opsional: IG_MEDIA_LIMIT (bawaan 25),
// IG_STOP_PERCENT (bawaan 75). Hasil: .runtime/instagram/discovery-<waktu>.json

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

export type Focus = "transit" | "muslim-family";

export interface Candidate {
  account: string;
  permalink: string;
  timestamp: string;
  mediaType: string;
  excerpt: string;
  prices: string[];
  stations: string[];
  familySignals: string[];
  areas: string[];
}

export interface DiscoveryResult {
  candidates: Candidate[];
  accounts: { username: string; status: string }[];
  requests: number;
  stopped?: string;
}

interface GraphMedia {
  caption?: string;
  permalink?: string;
  timestamp?: string;
  media_type?: string;
}

// Kode Graph API untuk batas laju (platform 4/17/32/613, Instagram BUC 80002)
// dan token tidak berlaku (190): hentikan seluruh proses, jangan dicoba ulang.
const STOP_CODES = new Map([
  [4, "batas laju aplikasi"],
  [17, "batas laju pengguna"],
  [32, "batas laju Pages API"],
  [613, "batas laju khusus"],
  [80002, "batas laju Instagram"],
  [190, "token tidak berlaku"],
  [10, "izin aplikasi belum tersedia"],
  [200, "izin akses belum tersedia"],
]);
const PRICE =
  /\b(?:(?:Rp\.?|IDR)\s?\d+(?:[.,]\d+)*\s?(?:juta(?:an)?|jt(?:-?an)?|miliar(?:an)?|milyar(?:an)?|m)?|\d+(?:[.,]\d+)*\s?(?:juta(?:an)?|jt(?:-?an)?|miliar(?:an)?|milyar(?:an)?))\b/gi;
const STATION =
  /\b(?:stasiun|st\.|krl|mrt|lrt)\s+[A-Z][\w-]*(?:\s+[A-Z][\w-]*)?/gi;
const CONTACT =
  /(?:\+?62|\b0)8\d{2}[\s.-]?\d{3,4}[\s.-]?\d{3,5}|wa\.me\/\S+|[\w.+-]+@[\w-]+\.[\w.]+/gi;
const KEYWORDS = /\b(?:stasiun|krl|mrt|lrt|commuter|tod)\b/i;
const FAMILY_SIGNALS = [
  ["masjid", /\b(?:masjid|mush?[oa]l{1,2}a|musala)\b/i],
  ["kajian", /\b(?:kajian|pengajian|taklim|ta[’']?lim)\b/i],
  [
    "pendidikan-anak",
    /\b(?:tpq|tpa|tahfi[dzs]+|tahfizh|tahsin|pesantren|kutt?ab|tkit|sdit|smpit|sekolah\s+(?:islam|sunnah)|rumah\s+qur[’']?an)\b/i,
  ],
  ["lingkungan-muslim", /\b(?:muslim|islami)\b/i],
] as const;

function instagramPermalink(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["instagram.com", "www.instagram.com"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      !/^\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
    )
      return undefined;
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

export function redact(text: string): string {
  return text.replace(CONTACT, "[kontak dihapus]");
}

// Persentase pemakaian tertinggi dari header X-App-Usage dan
// X-Business-Use-Case-Usage (call_count, total_cputime, total_time).
export function usagePercent(headers: Headers): number {
  let highest = 0;
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) for (const item of value) visit(item);
    else if (value && typeof value === "object")
      for (const [key, item] of Object.entries(value)) {
        if (
          ["call_count", "total_cputime", "total_time"].includes(key) &&
          typeof item === "number"
        )
          highest = Math.max(highest, item);
        else visit(item);
      }
  };
  for (const name of ["x-app-usage", "x-business-use-case-usage"]) {
    const raw = headers.get(name);
    if (!raw) continue;
    try {
      visit(JSON.parse(raw));
    } catch {
      // Header tidak dapat dibaca: anggap tidak ada data pemakaian.
    }
  }
  return highest;
}

export function toCandidate(
  account: string,
  media: GraphMedia,
  focus: Focus = "transit",
): Candidate | undefined {
  const caption = redact(media.caption ?? "");
  const prices = [...caption.matchAll(PRICE)].map((match) => match[0].trim());
  const permalink = instagramPermalink(media.permalink);
  const familySignals = FAMILY_SIGNALS.filter(([, pattern]) =>
    pattern.test(caption),
  ).map(([name]) => name);
  if (
    !permalink ||
    (focus === "transit" && (!prices.length || !KEYWORDS.test(caption))) ||
    (focus === "muslim-family" && !familySignals.length)
  )
    return undefined;
  return {
    account,
    permalink,
    timestamp: media.timestamp ?? "",
    mediaType: media.media_type ?? "",
    excerpt: redact(caption.replace(/\s+/g, " ").trim()).slice(0, 280),
    prices: [...new Set(prices)],
    stations: [
      ...new Set([...caption.matchAll(STATION)].map((m) => m[0].trim())),
    ],
    familySignals,
    // Hanya nama wilayah yang tertulis; bukan hasil geocoding atau bukti lokasi.
    areas: ["Bogor", "Depok", "Bekasi"].filter((area) =>
      new RegExp(`\\b${area}\\b`, "i").test(caption),
    ),
  };
}

export async function discover(options: {
  userId: string;
  token: string;
  usernames: string[];
  version: string;
  focus?: Focus;
  limit?: number;
  stopPercent?: number;
  fetcher?: typeof fetch;
}): Promise<DiscoveryResult> {
  const fetcher = options.fetcher ?? fetch;
  const version = options.version;
  const limit = options.limit ?? 25;
  const stopPercent = options.stopPercent ?? 75;
  if (
    !/^v\d+\.\d+$/.test(version) ||
    !/^\d+$/.test(options.userId) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isFinite(stopPercent) ||
    stopPercent <= 0 ||
    stopPercent > 100
  )
    throw new Error("Konfigurasi Graph API tidak valid; belum ada permintaan.");
  const result: DiscoveryResult = { candidates: [], accounts: [], requests: 0 };
  for (const username of new Set(options.usernames)) {
    if (!/^[A-Za-z0-9._]{1,30}$/.test(username)) {
      result.accounts.push({
        username: "[tidak valid]",
        status: "nama akun tidak valid",
      });
      continue;
    }
    const url = new URL(
      `https://graph.facebook.com/${version}/${encodeURIComponent(options.userId)}`,
    );
    url.searchParams.set(
      "fields",
      `business_discovery.username(${username}){username,media.limit(${limit}){caption,permalink,timestamp,media_type}}`,
    );
    result.requests += 1;
    let response: Response;
    try {
      response = await fetcher(url, {
        headers: { Authorization: `Bearer ${options.token}` },
        signal: AbortSignal.timeout(20_000),
        redirect: "error",
      });
    } catch {
      // Jangan mencetak error transport yang mungkin memuat URL atau kredensial.
      result.stopped = "koneksi API gagal atau waktu habis; tidak dicoba ulang";
      break;
    }
    if (response.status === 429) {
      result.stopped = "batas laju HTTP 429; tidak dicoba ulang";
      break;
    }
    const body = ((await response.json().catch(() => ({}))) ?? {}) as {
      error?: { code?: number; message?: string };
      business_discovery?: { media?: { data?: GraphMedia[] } };
    };
    const code = body.error?.code;
    if (code !== undefined && STOP_CODES.has(code)) {
      result.accounts.push({ username, status: `berhenti (kode ${code})` });
      result.stopped = `${STOP_CODES.get(code)} (kode ${code})`;
      break;
    }
    if (
      !response.ok ||
      body.error ||
      !Array.isArray(body.business_discovery?.media?.data)
    ) {
      result.accounts.push({
        username,
        status:
          !response.ok || body.error
            ? `dilewati (kode ${code ?? response.status})`
            : "dilewati (data media tidak tersedia)",
      });
    } else {
      const media = body.business_discovery?.media?.data ?? [];
      const found = media.flatMap((item) => {
        const candidate = toCandidate(username, item, options.focus);
        return candidate ? [candidate] : [];
      });
      result.candidates.push(...found);
      result.accounts.push({
        username,
        status: `${media.length} media, ${found.length} kandidat`,
      });
    }
    const usage = usagePercent(response.headers);
    if (usage >= stopPercent) {
      result.stopped = `pemakaian ${usage}% dari batas laju`;
      break;
    }
  }
  return result;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      focus: { type: "string", default: "transit" },
      watchlist: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });
  if (!["transit", "muslim-family"].includes(values.focus))
    throw new Error("Pilih --focus transit atau muslim-family.");
  const focus = values.focus as Focus;
  const userId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  const version = process.env.IG_GRAPH_VERSION;
  const usernames = [...positionals];
  if (values.watchlist) {
    const watchlist = JSON.parse(await readFile(values.watchlist, "utf8")) as {
      accounts?: { username: string; owner: string; area: string }[];
    };
    if (
      !Array.isArray(watchlist.accounts) ||
      watchlist.accounts.some(
        (account) =>
          !/^[A-Za-z0-9._]{1,30}$/.test(account.username) ||
          !["project", "developer", "facility"].includes(account.owner) ||
          !["Bogor", "Depok", "Bekasi"].includes(account.area),
      )
    )
      throw new Error(
        "Watchlist wajib berisi akun organisasi di Bogor/Depok/Bekasi.",
      );
    usernames.push(...watchlist.accounts.map((account) => account.username));
  }
  if (values["dry-run"]) {
    console.log(
      JSON.stringify({
        focus,
        accounts: [...new Set(usernames)],
        networkRequests: 0,
        missingConfig: [
          "IG_USER_ID",
          "IG_ACCESS_TOKEN",
          "IG_GRAPH_VERSION",
        ].filter((key) => !process.env[key]),
      }),
    );
    return;
  }
  if (!userId || !token || !version || !usernames.length) {
    console.error(
      "Butuh IG_USER_ID, IG_ACCESS_TOKEN, IG_GRAPH_VERSION, dan minimal satu nama akun organisasi.",
    );
    process.exitCode = 1;
    return;
  }
  const result = await discover({
    userId,
    token,
    usernames,
    version,
    focus,
    limit: process.env.IG_MEDIA_LIMIT
      ? Number(process.env.IG_MEDIA_LIMIT)
      : undefined,
    stopPercent: process.env.IG_STOP_PERCENT
      ? Number(process.env.IG_STOP_PERCENT)
      : undefined,
  });
  const directory = join(".runtime", "instagram");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = join(
    directory,
    `discovery-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  await writeFile(file, `${JSON.stringify({ focus, ...result }, null, 2)}\n`, {
    mode: 0o600,
    flag: "wx",
  });
  console.log(
    `${result.candidates.length} kandidat dari ${result.accounts.length} akun, ${result.requests} permintaan${result.stopped ? `; berhenti: ${result.stopped}` : ""}. Ditulis ke ${file}. Cek manual sebelum masuk research/properties.json.`,
  );
}

if (import.meta.main) {
  try {
    await main();
  } catch {
    console.error(
      "Riset Instagram gagal: periksa argumen, berkas watchlist, dan konfigurasi privat. Detail error tidak dicetak agar kredensial tetap privat.",
    );
    process.exitCode = 1;
  }
}
