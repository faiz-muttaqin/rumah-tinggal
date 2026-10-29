#!/bin/sh
set -eu
project_dir=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"
command -v npm >/dev/null
# Install official, pinned toolchain packages only; other server apps are unchanged.
npm install --prefix "$project_dir/.tools" --cache "$project_dir/.tools/npm-cache" \
  --no-audit --no-fund --save-exact node@26.13.0 pnpm@12.16.1
./dev install --frozen-lockfile
node scripts/install-hooks.mjs
