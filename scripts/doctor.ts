import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";

for (const [name, command, args] of [
  ["Node", "node", ["--version"]],
  ["pnpm", "pnpm", ["--version"]],
  ["TypeScript", "tsc", ["--version"]],
  ["Biome", "biome", ["--version"]],
] as const) {
  console.log(
    `${name}: ${execFileSync(command, [...args], { encoding: "utf8" }).trim()}`,
  );
}
execFileSync("gitleaks", ["git", "--help"], { stdio: "ignore" });
console.log("Gitleaks: tersedia (mendukung pemindaian staged dan riwayat)");
const hooks = execFileSync("git", ["config", "--get", "core.hooksPath"], {
  encoding: "utf8",
}).trim();
if (hooks !== ".githooks") throw new Error("Git security hooks belum aktif.");
console.log(`Git hooks: ${hooks}`);
console.log(
  `Rencana aplikasi: ${statSync("../_DOCS/rumah-tinggal/chat-plan.md", { throwIfNoEntry: false })?.size ? "tersedia" : "belum tersedia / masih kosong"}`,
);
