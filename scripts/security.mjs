import { execFileSync, spawnSync } from "node:child_process";

const mode = process.argv[2];
if (mode !== "staged" && mode !== "history") {
  console.error("Usage: node scripts/security.mjs staged|history");
  process.exit(2);
}

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

process.chdir(git(["rev-parse", "--show-toplevel"]).trim());
const indexed = git(["ls-files", "-z"]).split("\0").filter(Boolean);
let paths = indexed;
const hasCommits = Boolean(git(["rev-list", "--all", "--max-count=1"]).trim());
if (mode === "history" && hasCommits) {
  const historical = git(["log", "--all", "--format=", "--name-only", "-z"])
    .split("\0")
    .map((name) => name.replace(/^\n+/, ""))
    .filter(Boolean);
  paths = [...new Set([...indexed, ...historical])];
}

if (paths.length) {
  const ignored = spawnSync(
    "git",
    ["check-ignore", "--no-index", "--stdin", "-z"],
    {
      input: `${paths.join("\0")}\0`,
      encoding: "utf8",
    },
  );
  if (ignored.error || ![0, 1].includes(ignored.status)) {
    console.error("Pemeriksaan path privat gagal; commit/push diblokir.");
    process.exit(2);
  }
  if (ignored.status === 0) {
    console.error(
      "Commit/push diblokir: file privat/ignored ditemukan di index atau riwayat.",
    );
    for (const name of ignored.stdout.split("\0").filter(Boolean)) {
      console.error(`  ${JSON.stringify(name)}`);
    }
    console.error(
      "Hapus file dari index dengan git rm --cached; rahasia di riwayat harus dibersihkan sebelum push.",
    );
    process.exit(1);
  }
}

// Examples are public too: inspect Git blobs, never the potentially cleaner
// working copy. Unknown fields may be introduced with empty values only.
const safeExampleValues = new Map([
  ["HOST", "127.0.0.1"],
  ["PORT", "3100"],
  ["APP_ORIGIN", "http://localhost:3100"],
  ["DATA_DIR", "./data"],
]);
const exampleBlobs = new Set();
if (indexed.includes(".env.example")) {
  exampleBlobs.add(git(["rev-parse", ":.env.example"]).trim());
}
if (mode === "history" && hasCommits) {
  for (const object of git([
    "rev-list",
    "--objects",
    "--all",
    "--",
    ".env.example",
  ]).split("\n")) {
    const separator = object.indexOf(" ");
    if (object.slice(separator + 1) === ".env.example") {
      exampleBlobs.add(object.slice(0, separator));
    }
  }
}
const invalidExampleKeys = new Set();
for (const objectID of exampleBlobs) {
  for (const line of git(["cat-file", "blob", objectID]).split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const assignment = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/,
    );
    if (!assignment) {
      invalidExampleKeys.add("<invalid-assignment>");
      continue;
    }
    const [, key, rawValue] = assignment;
    const value = rawValue.replace(/^(["'])(.*)\1$/, "$2");
    if (value !== "" && safeExampleValues.get(key) !== value) {
      invalidExampleKeys.add(key);
    }
  }
}
if (invalidExampleKeys.size) {
  console.error(
    "Commit/push diblokir: .env.example harus kosong atau memakai nilai lokal yang diizinkan.",
  );
  for (const key of invalidExampleKeys) {
    console.error(`  .env.example: ${key}`);
  }
  process.exit(1);
}

if (mode === "history" && !hasCommits) {
  console.log("Belum ada commit; tidak ada riwayat untuk dipindai.");
  process.exit(0);
}

const scanArgs =
  mode === "staged" ? ["--pre-commit", "--staged"] : ["--log-opts=--all"];
const result = spawnSync(
  "gitleaks",
  [
    "git",
    ...scanArgs,
    "--redact=100",
    "--no-banner",
    "--no-color",
    "--ignore-gitleaks-allow",
    "--gitleaks-ignore-path=.tools/no-gitleaks-allowlist",
    "--config=.gitleaks.toml",
    ".",
  ],
  { stdio: "inherit" },
);
if (result.error) {
  console.error(
    "Gitleaks tidak tersedia; commit/push diblokir. Instal Gitleaks terlebih dahulu.",
  );
  process.exit(2);
}
process.exit(result.status ?? 2);
