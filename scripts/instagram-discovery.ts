// Kandidat bukti dari akun Instagram bisnis/kreator developer melalui
// Instagram Graph API resmi (Business Discovery, Instagram API with Facebook
// Login). Membutuhkan akun profesional milik sendiri yang terhubung ke Halaman
// Facebook dan token pengguna. Skrip tidak membuka halaman instagram.com,
// berhenti sebelum batas laju, dan hanya menulis kandidat untuk dicek manual.
//
// Pemakaian:
//   IG_USER_ID=… IG_ACCESS_TOKEN=… node scripts/instagram-discovery.ts akun1 akun2
// Opsional: IG_GRAPH_VERSION (bawaan v26.0), IG_MEDIA_LIMIT (bawaan 25),
// IG_STOP_PERCENT (bawaan 75). Hasil: .runtime/instagram/discovery-<tanggal>.json

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface Candidate {
  account: string;
  permalink: string;
  timestamp: string;
  mediaType: string;
  excerpt: string;
  prices: string[];
  stations: string[];
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
]);
const PRICE = /\b(?:Rp\.?|IDR)\s?[\d.,]+\s?(?:juta|jt|miliar|milyar|m)?\b/gi;
const STATION =
  /\b(?:stasiun|st\.|krl|mrt|lrt)\s+[A-Z][\w-]*(?:\s+[A-Z][\w-]*)?/gi;
const CONTACT =
  /(?:\+?62|\b0)8\d{2}[\s.-]?\d{3,4}[\s.-]?\d{3,5}|wa\.me\/\S+|[\w.+-]+@[\w-]+\.[\w.]+/gi;
const KEYWORDS = /\b(?:stasiun|krl|mrt|lrt|commuter|tod)\b/i;

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
): Candidate | undefined {
  const caption = media.caption ?? "";
  const prices = [...caption.matchAll(PRICE)].map((match) => match[0].trim());
  if (!media.permalink || !prices.length || !KEYWORDS.test(caption))
    return undefined;
  return {
    account,
    permalink: media.permalink,
    timestamp: media.timestamp ?? "",
    mediaType: media.media_type ?? "",
    excerpt: redact(caption.replace(/\s+/g, " ").trim()).slice(0, 280),
    prices: [...new Set(prices)],
    stations: [
      ...new Set([...caption.matchAll(STATION)].map((m) => m[0].trim())),
    ],
  };
}

export async function discover(options: {
  userId: string;
  token: string;
  usernames: string[];
  version?: string;
  limit?: number;
  stopPercent?: number;
  fetcher?: typeof fetch;
}): Promise<DiscoveryResult> {
  const fetcher = options.fetcher ?? fetch;
  const version = options.version ?? "v26.0";
  const limit = options.limit ?? 25;
  const stopPercent = options.stopPercent ?? 75;
  const result: DiscoveryResult = { candidates: [], accounts: [], requests: 0 };
  for (const username of options.usernames) {
    if (!/^[A-Za-z0-9._]{1,30}$/.test(username)) {
      result.accounts.push({ username, status: "nama akun tidak valid" });
      continue;
    }
    const url = new URL(
      `https://graph.facebook.com/${version}/${encodeURIComponent(options.userId)}`,
    );
    url.searchParams.set(
      "fields",
      `business_discovery.username(${username}){username,media.limit(${limit}){caption,permalink,timestamp,media_type}}`,
    );
    url.searchParams.set("access_token", options.token);
    const response = await fetcher(url);
    result.requests += 1;
    const body = (await response.json().catch(() => ({}))) as {
      error?: { code?: number; message?: string };
      business_discovery?: { media?: { data?: GraphMedia[] } };
    };
    const code = body.error?.code;
    if (code !== undefined && STOP_CODES.has(code)) {
      result.accounts.push({ username, status: `berhenti (kode ${code})` });
      result.stopped = `${STOP_CODES.get(code)} (kode ${code})`;
      break;
    }
    if (!response.ok || body.error) {
      result.accounts.push({
        username,
        status: `dilewati (kode ${code ?? response.status})`,
      });
    } else {
      const media = body.business_discovery?.media?.data ?? [];
      const found = media.flatMap((item) => {
        const candidate = toCandidate(username, item);
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
  const userId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  const usernames = process.argv.slice(2);
  if (!userId || !token || !usernames.length) {
    console.error(
      "Butuh IG_USER_ID, IG_ACCESS_TOKEN, dan minimal satu nama akun developer.",
    );
    process.exitCode = 1;
    return;
  }
  const result = await discover({
    userId,
    token,
    usernames,
    version: process.env.IG_GRAPH_VERSION,
    limit: Number(process.env.IG_MEDIA_LIMIT) || undefined,
    stopPercent: Number(process.env.IG_STOP_PERCENT) || undefined,
  });
  const directory = join(".runtime", "instagram");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = join(
    directory,
    `discovery-${new Date().toISOString().slice(0, 10)}.json`,
  );
  await writeFile(file, `${JSON.stringify(result, null, 2)}\n`, {
    mode: 0o600,
  });
  console.log(
    `${result.candidates.length} kandidat dari ${result.accounts.length} akun, ${result.requests} permintaan${result.stopped ? `; berhenti: ${result.stopped}` : ""}. Ditulis ke ${file}. Cek manual sebelum masuk research/properties.json.`,
  );
}

if (import.meta.main) await main();
