import {
  chmodSync,
  closeSync,
  constants,
  lstatSync,
  mkdirSync,
  openSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync as Database } from "node:sqlite";
import type { Listing, Pin } from "../src/types.ts";

export const MAX_LISTINGS_PER_OWNER = 500;
export const MAX_PINS_PER_OWNER = 500;

export function openDatabase(directory: string, name: string): Database {
  const dataDir = resolve(directory);
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const directoryStat = lstatSync(dataDir);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new Error("Direktori data tidak valid.");
  }
  chmodSync(dataDir, 0o700);
  const filename = join(dataDir, name);
  try {
    closeSync(
      openSync(
        filename,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
        0o600,
      ),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const fileStat = lstatSync(filename);
  if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
    throw new Error("File data tidak valid.");
  }
  chmodSync(filename, 0o600);
  const database = new Database(filename);
  try {
    database.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
  } catch (error) {
    database.close();
    throw error;
  }
  return database;
}

export class ListingStore {
  private database: Database;

  constructor(directory: string) {
    this.database = openDatabase(directory, "rumah-tinggal.sqlite");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS listings (
        id TEXT PRIMARY KEY,
        owner_uid TEXT NOT NULL,
        content_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS listings_owner_created
        ON listings(owner_uid, created_at DESC);
      CREATE TABLE IF NOT EXISTS pins (
        id TEXT PRIMARY KEY,
        owner_uid TEXT NOT NULL,
        content_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS pins_owner_created
        ON pins(owner_uid, created_at DESC);
    `);
  }

  list(uid: string): Listing[] {
    const rows = this.database
      .prepare(
        "SELECT content_json FROM listings WHERE owner_uid = ? ORDER BY created_at DESC, id",
      )
      .all(uid);
    return rows.map((row) => JSON.parse(row.content_json as string) as Listing);
  }

  add(uid: string, listing: Listing): boolean {
    return (
      this.database
        .prepare(
          `INSERT INTO listings (id, owner_uid, content_json, created_at)
           SELECT ?, ?, ?, ?
           WHERE (SELECT COUNT(*) FROM listings WHERE owner_uid = ?) < ?`,
        )
        .run(
          listing.id,
          uid,
          JSON.stringify(listing),
          listing.createdAt,
          uid,
          MAX_LISTINGS_PER_OWNER,
        ).changes === 1
    );
  }

  remove(uid: string, id: string): boolean {
    return (
      this.database
        .prepare("DELETE FROM listings WHERE owner_uid = ? AND id = ?")
        .run(uid, id).changes === 1
    );
  }

  listPins(uid: string): Pin[] {
    const rows = this.database
      .prepare(
        "SELECT content_json FROM pins WHERE owner_uid = ? ORDER BY created_at DESC, id",
      )
      .all(uid);
    return rows.map((row) => JSON.parse(row.content_json as string) as Pin);
  }

  addPin(uid: string, pin: Pin): boolean {
    return (
      this.database
        .prepare(
          `INSERT INTO pins (id, owner_uid, content_json, created_at)
           SELECT ?, ?, ?, ?
           WHERE (SELECT COUNT(*) FROM pins WHERE owner_uid = ?) < ?`,
        )
        .run(
          pin.id,
          uid,
          JSON.stringify(pin),
          pin.createdAt,
          uid,
          MAX_PINS_PER_OWNER,
        ).changes === 1
    );
  }

  removePin(uid: string, id: string): boolean {
    return (
      this.database
        .prepare("DELETE FROM pins WHERE owner_uid = ? AND id = ?")
        .run(uid, id).changes === 1
    );
  }

  close(): void {
    this.database.close();
  }
}
