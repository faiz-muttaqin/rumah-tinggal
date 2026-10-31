// Impor ekspor JSON/NDJSON dari penyedia ke kandidat riset privat.
// Tidak menghubungi Instagram/penyedia dan tidak mengubah katalog publik.
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { type Candidate, redact, toCandidate } from "./instagram-discovery.ts";

export type Provider = "brightdata" | "apify";

export interface ImportResult {
  provider: Provider;
  networkRequests: 0;
  rows: number;
  skipped: {
    unavailable: number;
    outsideWatchlist: number;
    irrelevant: number;
    duplicate: number;
  };
  candidates: Candidate[];
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function parseExport(text: string): unknown[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    const rows: unknown = JSON.parse(trimmed);
    if (Array.isArray(rows)) return rows;
  }
  return trimmed
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as unknown);
}

export function importPosts(
  rows: unknown[],
  provider: Provider,
  watchlist: unknown,
): ImportResult {
  const accounts = object(watchlist)?.accounts;
  if (!Array.isArray(accounts) || !["brightdata", "apify"].includes(provider))
    throw new Error("Provider atau watchlist tidak valid.");
  if (rows.length > 1000)
    throw new Error("Impor maksimal 1.000 baris per batch.");
  const allowed = new Set<string>();
  for (const value of accounts) {
    const account = object(value);
    if (
      !account ||
      typeof account.username !== "string" ||
      !/^[A-Za-z0-9._]{1,30}$/.test(account.username) ||
      !["project", "developer", "facility"].includes(String(account.owner)) ||
      !["Bogor", "Depok", "Bekasi"].includes(String(account.area))
    )
      throw new Error(
        "Watchlist hanya untuk akun organisasi di wilayah riset.",
      );
    allowed.add(account.username.toLowerCase());
  }
  const result: ImportResult = {
    provider,
    networkRequests: 0,
    rows: rows.length,
    skipped: {
      unavailable: 0,
      outsideWatchlist: 0,
      irrelevant: 0,
      duplicate: 0,
    },
    candidates: [],
  };
  const seen = new Set<string>();
  for (const value of rows) {
    const row = object(value);
    if (
      !row ||
      row.error ||
      row.is_private === true ||
      row.isPrivate === true
    ) {
      result.skipped.unavailable++;
      continue;
    }
    const owner =
      provider === "brightdata" ? row.user_posted : row.ownerUsername;
    const username =
      typeof owner === "string" ? owner.replace(/^@/, "").toLowerCase() : "";
    if (!allowed.has(username)) {
      result.skipped.outsideWatchlist++;
      continue;
    }
    const caption = provider === "brightdata" ? row.description : row.caption;
    const date = provider === "brightdata" ? row.date_posted : row.timestamp;
    const timestamp =
      typeof date === "string" &&
      /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(date) &&
      Number.isFinite(Date.parse(date))
        ? new Date(date).toISOString()
        : "";
    const rawType = String(
      provider === "brightdata" ? row.content_type : row.type,
    ).toLowerCase();
    const mediaType = ["reels", "reel", "video"].includes(rawType)
      ? "VIDEO"
      : rawType === "image"
        ? "IMAGE"
        : ["sidecar", "carousel"].includes(rawType)
          ? "CAROUSEL_ALBUM"
          : "";
    const candidate = toCandidate(
      username,
      {
        caption: redact(typeof caption === "string" ? caption : ""),
        permalink: typeof row.url === "string" ? row.url : "",
        timestamp,
        media_type: mediaType,
      },
      "muslim-family",
    );
    if (!candidate) {
      result.skipped.irrelevant++;
      continue;
    }
    const shortcode = new URL(candidate.permalink).pathname.split("/")[2];
    if (seen.has(shortcode)) {
      result.skipped.duplicate++;
      continue;
    }
    seen.add(shortcode);
    result.candidates.push(candidate);
  }
  return result;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      provider: { type: "string", default: "brightdata" },
      watchlist: {
        type: "string",
        default: "research/instagram-watchlist.json",
      },
      "dry-run": { type: "boolean", default: false },
    },
  });
  if (!values.input || !["brightdata", "apify"].includes(values.provider))
    throw new Error("Butuh --input dan --provider brightdata atau apify.");
  if ((await stat(values.input)).size > 20_000_000)
    throw new Error("Ekspor maksimal 20 MB.");
  const rows = parseExport(await readFile(values.input, "utf8"));
  const watchlist: unknown = JSON.parse(
    await readFile(values.watchlist, "utf8"),
  );
  const result = importPosts(rows, values.provider as Provider, watchlist);
  let file: string | undefined;
  if (!values["dry-run"]) {
    const directory = join(".runtime", "instagram");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const importedAt = new Date().toISOString();
    file = join(
      directory,
      `import-${values.provider}-${importedAt.replace(/[:.]/g, "-")}.json`,
    );
    await writeFile(
      file,
      `${JSON.stringify({ importedAt, status: "candidate-only", ...result }, null, 2)}\n`,
      { mode: 0o600, flag: "wx" },
    );
  }
  console.log(
    JSON.stringify({
      provider: result.provider,
      rows: result.rows,
      candidates: result.candidates.length,
      skipped: result.skipped,
      networkRequests: 0,
      file,
    }),
  );
}

if (import.meta.main) {
  try {
    await main();
  } catch {
    console.error(
      "Impor gagal: periksa format ekspor, provider, watchlist, serta batas berkas. Isi data tidak dicetak.",
    );
    process.exitCode = 1;
  }
}
