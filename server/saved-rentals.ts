import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { SQLOutputValue } from "node:sqlite";
import type {
  RentalComment,
  SavedRental,
  SavedRentalEntry,
  SavedRentalFields,
  SharedRental,
} from "../src/types.ts";
import type { Identity } from "./auth.ts";
import { BookmarkStore } from "./bookmark-collections.ts";
import { openDatabase } from "./store.ts";

type CatalogRental = {
  id: string;
  title: string;
  kind: string;
  rentalType: string;
  locationText: string;
  location?: { lat: number; lng: number } | null;
  rent: {
    amount: number;
    period: "monthly" | "yearly";
    minimumMonths?: number;
  };
  listingUrl: string;
};

export function catalogRentalReader(filename: string) {
  let contents: Promise<Map<string, CatalogRental>> | undefined;
  return async (id: string): Promise<SavedRentalEntry | undefined> => {
    contents ??= readFile(filename, "utf8")
      .then((body) => {
        const rentals: CatalogRental[] =
          JSON.parse(body).metadata.rentals.rentals;
        return new Map(rentals.map((rental) => [rental.id, rental]));
      })
      .catch((error: unknown) => {
        contents = undefined;
        throw error;
      });
    const rental = (await contents).get(id);
    if (!rental) return undefined;
    const now = new Date().toISOString();
    return {
      rentalId: rental.id,
      title: rental.title,
      locationText: rental.locationText,
      kind: rental.rentalType.startsWith("kos")
        ? "Kos"
        : rental.kind === "Apartemen"
          ? "Apartemen"
          : "Rumah",
      sourceUrl: rental.listingUrl,
      location: rental.location
        ? { lat: rental.location.lat, lng: rental.location.lng }
        : null,
      amount: rental.rent.amount,
      period: rental.rent.period,
      minimumMonths: rental.rent.minimumMonths ?? null,
      note: "",
      savedAt: now,
      updatedAt: now,
    };
  };
}

const ownerQuery = `SELECT r.content_json, s.token FROM saved_rentals r
  LEFT JOIN rental_shares s USING (owner_uid, rental_id)`;

function entry(row: Record<string, SQLOutputValue>): SavedRentalEntry {
  return JSON.parse(row.content_json as string) as SavedRentalEntry;
}

function ownerEntry(row: Record<string, SQLOutputValue>): SavedRental {
  return { ...entry(row), shareToken: row.token as string | null };
}

export class SavedRentalStore {
  private database: ReturnType<typeof openDatabase>;
  readonly bookmarks: BookmarkStore;

  constructor(directory: string) {
    this.database = openDatabase(directory, "saved-rentals.sqlite");
    try {
      this.database.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS saved_rentals (
          owner_uid TEXT NOT NULL,
          rental_id TEXT NOT NULL,
          content_json TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (owner_uid, rental_id)
        );
        CREATE TABLE IF NOT EXISTS rental_shares (
          owner_uid TEXT NOT NULL,
          rental_id TEXT NOT NULL,
          token TEXT UNIQUE,
          PRIMARY KEY (owner_uid, rental_id),
          FOREIGN KEY (owner_uid, rental_id) REFERENCES saved_rentals ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS rental_comments (
          id TEXT PRIMARY KEY,
          owner_uid TEXT NOT NULL,
          rental_id TEXT NOT NULL,
          share_token TEXT NOT NULL,
          author TEXT NOT NULL,
          text TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (owner_uid, rental_id) REFERENCES rental_shares ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS rental_comments_thread
          ON rental_comments(share_token, created_at, id);
      `);
      this.bookmarks = new BookmarkStore(this.database);
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  list(uid: string): SavedRental[] {
    return this.database
      .prepare(
        `${ownerQuery} WHERE r.owner_uid = ? ORDER BY r.updated_at DESC, r.rental_id`,
      )
      .all(uid)
      .map(ownerEntry);
  }

  get(uid: string, id: string): SavedRental | undefined {
    const row = this.database
      .prepare(`${ownerQuery} WHERE r.owner_uid = ? AND r.rental_id = ?`)
      .get(uid, id);
    return row && ownerEntry(row);
  }

  save(uid: string, rental: SavedRentalEntry): SavedRental | undefined {
    this.database
      .prepare(`INSERT INTO saved_rentals VALUES (?, ?, ?, ?)
      ON CONFLICT (owner_uid, rental_id) DO NOTHING`)
      .run(uid, rental.rentalId, JSON.stringify(rental), rental.updatedAt);
    return this.get(uid, rental.rentalId);
  }

  update(
    uid: string,
    id: string,
    fields: Partial<SavedRentalFields>,
  ): SavedRental | undefined {
    const row = this.database
      .prepare(`SELECT content_json FROM saved_rentals
      WHERE owner_uid = ? AND rental_id = ?`)
      .get(uid, id);
    if (!row) return undefined;
    const rental = {
      ...entry(row),
      ...fields,
      updatedAt: new Date().toISOString(),
    };
    this.database
      .prepare(`UPDATE saved_rentals SET content_json = ?, updated_at = ?
      WHERE owner_uid = ? AND rental_id = ?`)
      .run(JSON.stringify(rental), rental.updatedAt, uid, id);
    return this.get(uid, id);
  }

  remove(uid: string, id: string): boolean {
    return (
      this.database
        .prepare(`DELETE FROM saved_rentals
      WHERE owner_uid = ? AND rental_id = ?`)
        .run(uid, id).changes === 1
    );
  }

  setSharing(
    uid: string,
    id: string,
    enabled: boolean,
  ): SavedRental | undefined {
    if (enabled) {
      const token = randomBytes(24).toString("base64url");
      this.database
        .prepare(`INSERT INTO rental_shares (owner_uid, rental_id, token)
        SELECT owner_uid, rental_id, ? FROM saved_rentals WHERE owner_uid = ? AND rental_id = ?
        ON CONFLICT (owner_uid, rental_id) DO UPDATE SET token = excluded.token
        WHERE rental_shares.token IS NULL`)
        .run(token, uid, id);
    } else {
      this.database
        .prepare(`UPDATE rental_shares SET token = NULL
        WHERE owner_uid = ? AND rental_id = ?`)
        .run(uid, id);
    }
    return this.get(uid, id);
  }

  shared(token: string): SharedRental | undefined {
    const row = this.database
      .prepare(`SELECT r.content_json FROM rental_shares s
      JOIN saved_rentals r USING (owner_uid, rental_id) WHERE s.token = ?`)
      .get(token);
    if (!row) return undefined;
    const comments = this.database
      .prepare(`SELECT id, author, text, created_at AS createdAt
      FROM rental_comments WHERE share_token = ? ORDER BY created_at, id`)
      .all(token) as unknown as RentalComment[];
    return { rental: entry(row), comments };
  }

  comment(
    token: string,
    identity: Identity,
    text: string,
  ): RentalComment | undefined {
    const id = randomUUID();
    const inserted = this.database
      .prepare(`INSERT INTO rental_comments
      (id, owner_uid, rental_id, share_token, author, text, created_at)
      SELECT ?, s.owner_uid, s.rental_id, s.token,
        CASE WHEN s.owner_uid = ? THEN 'Pemilik' ELSE ? END, ?, ?
      FROM rental_shares s JOIN saved_rentals r USING (owner_uid, rental_id)
      WHERE s.token = ? AND json_extract(r.content_json, '$.note') <> ''
      RETURNING id, author, text, created_at AS createdAt`)
      .get(
        id,
        identity.uid,
        identity.name ?? "Pengunjung",
        text,
        new Date().toISOString(),
        token,
      );
    return inserted as unknown as RentalComment | undefined;
  }

  close(): void {
    this.database.close();
  }
}
