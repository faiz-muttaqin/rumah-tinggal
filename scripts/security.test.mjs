import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  accessSync,
  constants,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("..", import.meta.url));
const gitExecutable = findExecutable("git");
const fixtureFiles = [
  ".gitignore",
  ".gitleaks.toml",
  ".githooks/pre-commit",
  ".githooks/pre-push",
  "scripts/security.mjs",
  "scripts/install-hooks.mjs",
];

function findExecutable(name) {
  for (const directory of process.env.PATH.split(path.delimiter)) {
    const candidate = path.join(directory, name);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {}
  }
  throw new Error(`Required executable is unavailable: ${name}`);
}

function run(cwd, executable, args, env = process.env) {
  const result = spawnSync(executable, args, {
    cwd,
    env,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return { ...result, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function git(cwd, args, env) {
  return run(cwd, gitExecutable, args, env);
}

function succeeds(result) {
  assert.equal(result.status, 0, "Expected the isolated command to succeed.");
  return result;
}

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "rumah-tinggal-security-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const repo = path.join(directory, "repo");
  mkdirSync(repo);
  for (const name of fixtureFiles) {
    const target = path.join(repo, name);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(project, name), target);
  }
  succeeds(git(repo, ["init", "--initial-branch=main"]));
  succeeds(git(repo, ["config", "user.name", "Isolated Security Test"]));
  succeeds(
    git(repo, ["config", "user.email", "security-test@example.invalid"]),
  );
  succeeds(git(repo, ["config", "commit.gpgsign", "false"]));
  succeeds(run(repo, process.execPath, ["scripts/install-hooks.mjs"]));
  return { directory, repo };
}

function write(repo, name, value) {
  const target = path.join(repo, name);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value);
}

function baseline(repo) {
  write(repo, "README.md", "Isolated security-hook fixture.\n");
  succeeds(git(repo, ["add", "."]));
  succeeds(git(repo, ["commit", "-m", "Clean baseline"]));
}

function syntheticSecret() {
  // Random offline test data, never an issued credential or usable API token.
  // Balanced characters make entropy-based scanning deterministic.
  return (
    ["ghp", ""].join("_") +
    "0123456789abcdef".repeat(2) +
    randomBytes(2).toString("hex")
  );
}

function blockedSecret(result, secret) {
  assert.notEqual(result.status, 0, "The hook must reject a synthetic secret.");
  assert.match(result.output, /github-pat|leaks? found/i);
  assert.ok(
    !result.output.includes(secret),
    "Scanner output must redact the synthetic token.",
  );
}

test("clean initial commit and push succeed with active hooks", (t) => {
  const { directory, repo } = fixture(t);
  write(
    repo,
    ".env.example",
    [
      "HOST=127.0.0.1",
      "PORT=3100",
      "APP_ORIGIN=http://localhost:3100",
      "DATA_DIR=./data",
      "FIREBASE_PROJECT_ID=",
      "FIREBASE_API_KEY=",
      "FIREBASE_AUTH_DOMAIN=",
      "FIREBASE_MESSAGING_SENDER_ID=",
      "FIREBASE_STORAGE_BUCKET=",
      "ALLOWED_EMAILS=",
      "GOOGLE_CLIENT_ID=",
      "GOOGLE_CLIENT_SECRET=",
      "",
    ].join("\n"),
  );
  baseline(repo);
  const remote = path.join(directory, "remote.git");
  succeeds(git(directory, ["init", "--bare", remote]));
  succeeds(git(repo, ["push", remote, "HEAD:main"]));
  assert.equal(git(remote, ["rev-parse", "refs/heads/main"]).status, 0);
});

test("example exceptions reject nested files and nonempty private or unknown fields", (t) => {
  const { repo } = fixture(t);
  write(repo, "packages/backend/.env.example", "CUSTOM_SETTING=\n");
  const nested = git(repo, [
    "check-ignore",
    "--no-index",
    "packages/backend/.env.example",
  ]);
  assert.equal(nested.status, 0);
  for (const key of ["FIREBASE_API_KEY", "CUSTOM_INTERNAL_SETTING"]) {
    const value = "synthetic-private-value";
    write(repo, ".env.example", `${key}=${value}\n`);
    succeeds(git(repo, ["add", ".env.example"]));
    const result = git(repo, ["commit", "-m", "Must be blocked"]);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /\.env\.example/);
    assert.ok(result.output.includes(key));
    assert.ok(!result.output.includes(value));
    assert.notEqual(git(repo, ["rev-parse", "--verify", "HEAD"]).status, 0);
  }
});

test("a clean working example cannot hide its populated staged version", (t) => {
  const { repo } = fixture(t);
  const value = "synthetic-private-project";
  write(repo, ".env.example", `FIREBASE_PROJECT_ID=${value}\n`);
  succeeds(git(repo, ["add", ".env.example"]));
  write(repo, ".env.example", "FIREBASE_PROJECT_ID=\n");
  const result = git(repo, ["commit", "-m", "Must be blocked"]);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /\.env\.example: FIREBASE_PROJECT_ID/);
  assert.ok(!result.output.includes(value));
  assert.notEqual(git(repo, ["rev-parse", "--verify", "HEAD"]).status, 0);
});

test("a removed populated historical example blocks a push", (t) => {
  const { directory, repo } = fixture(t);
  baseline(repo);
  const value = "synthetic-private-value";
  write(repo, ".env.example", `CUSTOM_INTERNAL_SETTING=${value}\n`);
  succeeds(git(repo, ["add", ".env.example"]));
  succeeds(
    git(repo, [
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-m",
      "Legacy populated example",
    ]),
  );
  unlinkSync(path.join(repo, ".env.example"));
  succeeds(git(repo, ["add", "--update"]));
  succeeds(
    git(repo, [
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-m",
      "Remove populated example",
    ]),
  );
  assert.equal(git(repo, ["status", "--porcelain"]).stdout, "");
  const remote = path.join(directory, "remote.git");
  succeeds(git(directory, ["init", "--bare", remote]));
  const result = git(repo, ["push", remote, "HEAD:main"]);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /\.env\.example: CUSTOM_INTERNAL_SETTING/);
  assert.ok(!result.output.includes(value));
  assert.notEqual(
    git(remote, ["rev-parse", "--verify", "refs/heads/main"]).status,
    0,
  );
});

test("a force-staged .env is blocked before the first commit", (t) => {
  const { repo } = fixture(t);
  write(repo, ".env", "LOCAL_SETTING=synthetic-only\n");
  succeeds(git(repo, ["add", "--force", ".env"]));
  const result = git(repo, ["commit", "-m", "Must be blocked"]);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /file privat\/ignored/);
  assert.match(result.output, /"\.env"/);
  assert.notEqual(git(repo, ["rev-parse", "--verify", "HEAD"]).status, 0);
});

test("a staged source secret is detected and output is redacted", (t) => {
  const { repo } = fixture(t);
  const secret = syntheticSecret();
  write(repo, "src/app.ts", `export const token = "${secret}";\n`);
  succeeds(git(repo, ["add", "src/app.ts"]));
  blockedSecret(git(repo, ["commit", "-m", "Must be blocked"]), secret);
});

test("the staged version is scanned even when the working file is clean", (t) => {
  const { repo } = fixture(t);
  const secret = syntheticSecret();
  write(repo, "src/app.ts", `export const token = "${secret}";\n`);
  succeeds(git(repo, ["add", "src/app.ts"]));
  write(repo, "src/app.ts", "export const token = null;\n");
  blockedSecret(git(repo, ["commit", "-m", "Must be blocked"]), secret);
});

test("a deleted historical secret blocks an actual push with a clean index", (t) => {
  const { directory, repo } = fixture(t);
  baseline(repo);
  const secret = syntheticSecret();
  write(repo, "src/removed.ts", `export const token = "${secret}";\n`);
  succeeds(git(repo, ["add", "src/removed.ts"]));
  // Deliberately simulate a legacy commit created before protection existed.
  succeeds(
    git(repo, [
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-m",
      "Legacy fixture",
    ]),
  );
  unlinkSync(path.join(repo, "src/removed.ts"));
  succeeds(git(repo, ["add", "--update"]));
  succeeds(
    git(repo, [
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-m",
      "Remove fixture",
    ]),
  );
  assert.equal(git(repo, ["status", "--porcelain"]).stdout, "");
  const remote = path.join(directory, "remote.git");
  succeeds(git(directory, ["init", "--bare", remote]));
  blockedSecret(git(repo, ["push", remote, "HEAD:main"]), secret);
  assert.notEqual(
    git(remote, ["rev-parse", "--verify", "refs/heads/main"]).status,
    0,
  );
});

test("a removed private path in history blocks a push despite a clean index", (t) => {
  const { directory, repo } = fixture(t);
  baseline(repo);
  write(
    repo,
    "private/removed notes.txt",
    "Synthetic private document without a recognizable secret.\n",
  );
  succeeds(git(repo, ["add", "--force", "private/removed notes.txt"]));
  succeeds(
    git(repo, [
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-m",
      "Legacy private file",
    ]),
  );
  unlinkSync(path.join(repo, "private/removed notes.txt"));
  succeeds(git(repo, ["add", "--update"]));
  succeeds(
    git(repo, [
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-m",
      "Remove private file",
    ]),
  );
  assert.equal(git(repo, ["status", "--porcelain"]).stdout, "");
  const remote = path.join(directory, "remote.git");
  succeeds(git(directory, ["init", "--bare", remote]));
  const result = git(repo, ["push", remote, "HEAD:main"]);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /file privat\/ignored/);
  assert.match(result.output, /"private\/removed notes\.txt"/);
  assert.notEqual(
    git(remote, ["rev-parse", "--verify", "refs/heads/main"]).status,
    0,
  );
});

test("an unborn HEAD still scans existing refs before they are pushed", (t) => {
  const { directory, repo } = fixture(t);
  baseline(repo);
  const secret = syntheticSecret();
  write(repo, "src/legacy.ts", `export const token = "${secret}";\n`);
  succeeds(git(repo, ["add", "src/legacy.ts"]));
  succeeds(
    git(repo, ["-c", "core.hooksPath=/dev/null", "commit", "-m", "Legacy ref"]),
  );
  succeeds(git(repo, ["symbolic-ref", "HEAD", "refs/heads/unborn"]));
  succeeds(git(repo, ["read-tree", "--empty"]));
  assert.notEqual(git(repo, ["rev-parse", "--verify", "HEAD"]).status, 0);
  assert.equal(git(repo, ["ls-files"]).stdout, "");
  const remote = path.join(directory, "remote.git");
  succeeds(git(directory, ["init", "--bare", remote]));
  blockedSecret(git(repo, ["push", remote, "refs/heads/main:main"]), secret);
  assert.notEqual(
    git(remote, ["rev-parse", "--verify", "refs/heads/main"]).status,
    0,
  );
});

test("ordinary filenames with spaces are accepted and private paths with spaces are blocked", (t) => {
  const { repo } = fixture(t);
  write(repo, "src/file with spaces.ts", "export const healthy = true;\n");
  baseline(repo);
  write(repo, "private/notes with spaces.txt", "Synthetic private document.\n");
  succeeds(git(repo, ["add", "--force", "private/notes with spaces.txt"]));
  const result = git(repo, ["commit", "-m", "Must be blocked"]);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /"private\/notes with spaces\.txt"/);
});

test("a missing Gitleaks executable fails closed through the real commit hook", (t) => {
  const { directory, repo } = fixture(t);
  const bin = path.join(directory, "limited-bin");
  mkdirSync(bin);
  symlinkSync(gitExecutable, path.join(bin, "git"));
  symlinkSync(process.execPath, path.join(bin, "node"));
  write(repo, "README.md", "A clean file still requires the scanner.\n");
  succeeds(git(repo, ["add", "README.md"]));
  const result = git(repo, ["commit", "-m", "Must be blocked"], {
    ...process.env,
    PATH: bin,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.output, /Gitleaks tidak tersedia/);
  assert.notEqual(git(repo, ["rev-parse", "--verify", "HEAD"]).status, 0);
});

test("hook installation preserves an existing custom hooks directory", (t) => {
  const { repo } = fixture(t);
  succeeds(git(repo, ["config", "core.hooksPath", ".custom-hooks"]));
  const result = run(repo, process.execPath, ["scripts/install-hooks.mjs"]);
  assert.notEqual(result.status, 0);
  assert.equal(
    git(repo, ["config", "--get", "core.hooksPath"]).stdout.trim(),
    ".custom-hooks",
  );
  assert.match(
    readFileSync(path.join(repo, ".githooks/pre-commit"), "utf8"),
    /security\.mjs staged/,
  );
});
