import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync } from "node:fs";

try {
  execFileSync("git", ["rev-parse", "--git-dir"], { stdio: "ignore" });
} catch {
  console.log("Git hooks dilewati: direktori ini bukan checkout Git.");
  process.exit(0);
}

const hooksResult = spawnSync("git", ["config", "--get", "core.hooksPath"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
if (![0, 1].includes(hooksResult.status))
  throw new Error("Gagal membaca konfigurasi Git hooks.");
const hooksPath = hooksResult.stdout;
if (hooksPath.trim() && hooksPath.trim() !== ".githooks") {
  throw new Error(
    "core.hooksPath sudah dikonfigurasi; gabungkan hooks yang ada terlebih dahulu.",
  );
}
for (const hook of ["pre-commit", "pre-push"]) {
  chmodSync(`.githooks/${hook}`, 0o755);
}
execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"]);
console.log(
  "Git hooks aktif: pemeriksaan path privat + Gitleaks sebelum commit/push.",
);
