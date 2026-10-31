import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

export interface ExcelSheet {
  rows: Record<string, string | number | null>[];
  formulaCount: number;
  frozenRows: number;
}

export function readExcel(buffer: Buffer): Record<string, ExcelSheet> {
  const result = spawnSync("python3", ["-I", "tests/read-excel.py"], {
    input: buffer,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  assert.equal(
    result.status,
    0,
    result.stderr || result.error?.message || "Excel reader failed",
  );
  return JSON.parse(result.stdout) as Record<string, ExcelSheet>;
}
