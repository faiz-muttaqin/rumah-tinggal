import { randomBytes, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  BookmarkChange,
  BookmarkLibrary,
  BookmarkPermission,
  OwnedBookmark,
  RentalComment,
  SavedRentalEntry,
  SavedRentalFields,
  SharedBookmark,
} from "../src/types.ts";
import type { Identity } from "./auth.ts";

export type BookmarkAccess =
  | { ownerUid: string; id: string }
  | { token: string };

type CollectionRow = {
  id: string;
  owner_uid: string;
  name: string;
  revision: number;
  permission: BookmarkPermission;
  share_token: string | null;
};

type Changes = BookmarkChange["fields"];
const permissionRank = { view: 0, comment: 1, edit: 2 };

export class BookmarkError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class BookmarkStore {
  private db: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.db = database;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bookmark_collections (
        id TEXT PRIMARY KEY,
        owner_uid TEXT NOT NULL,
        name TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0,
        permission TEXT NOT NULL DEFAULT 'view' CHECK(permission IN ('view','comment','edit')),
        share_token TEXT UNIQUE,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS bookmarks_owner ON bookmark_collections(owner_uid, updated_at DESC);
      CREATE TABLE IF NOT EXISTS bookmark_items (
        collection_id TEXT NOT NULL REFERENCES bookmark_collections(id) ON DELETE CASCADE,
        rental_id TEXT NOT NULL,
        content_json TEXT NOT NULL,
        PRIMARY KEY (collection_id, rental_id)
      );
      CREATE TABLE IF NOT EXISTS bookmark_comments (
        id TEXT PRIMARY KEY,
        collection_id TEXT NOT NULL,
        rental_id TEXT NOT NULL,
        share_token TEXT NOT NULL,
        author TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (collection_id, rental_id) REFERENCES bookmark_items ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS bookmark_comments_thread ON bookmark_comments(share_token, created_at, id);
      CREATE TABLE IF NOT EXISTS bookmark_history (
        collection_id TEXT NOT NULL REFERENCES bookmark_collections(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL,
        actor_uid TEXT NOT NULL,
        content_json TEXT NOT NULL,
        PRIMARY KEY (collection_id, revision)
      );
      CREATE TABLE IF NOT EXISTS bookmark_imports (owner_uid TEXT PRIMARY KEY);
    `);
  }

  private transaction<T>(write: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = write();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private require(
    access: BookmarkAccess,
    permission: BookmarkPermission = "view",
  ): CollectionRow {
    const row = (
      "token" in access
        ? this.db
            .prepare("SELECT * FROM bookmark_collections WHERE share_token = ?")
            .get(access.token)
        : this.db
            .prepare(
              "SELECT * FROM bookmark_collections WHERE id = ? AND owner_uid = ?",
            )
            .get(access.id, access.ownerUid)
    ) as CollectionRow | undefined;
    if (!row)
      throw new BookmarkError(404, "Koleksi atau tautan tidak tersedia.");
    if (
      "token" in access &&
      permissionRank[row.permission] < permissionRank[permission]
    ) {
      throw new BookmarkError(
        403,
        "Izin tautan ini tidak mencakup tindakan tersebut.",
      );
    }
    return row;
  }

  private current(row: CollectionRow, revision: number): void {
    if (row.revision !== revision)
      throw new BookmarkError(
        409,
        "Koleksi sudah berubah. Muat ulang untuk melihat versi terbaru.",
      );
  }

  private record(
    row: CollectionRow,
    actor: Identity,
    action: BookmarkChange["action"],
    fields: Changes,
    item?: string,
  ): void {
    const createdAt = new Date().toISOString();
    const revision = row.revision + 1;
    const change: BookmarkChange = {
      revision,
      action,
      fields,
      item,
      createdAt,
      author:
        actor.uid === row.owner_uid ? "Pemilik" : (actor.name ?? "Kolaborator"),
    };
    this.db
      .prepare(
        "UPDATE bookmark_collections SET revision = ?, updated_at = ? WHERE id = ?",
      )
      .run(revision, createdAt, row.id);
    this.db
      .prepare("INSERT INTO bookmark_history VALUES (?, ?, ?, ?)")
      .run(row.id, revision, actor.uid, JSON.stringify(change));
    row.revision = revision;
  }

  private insert(actor: Identity, name: string): CollectionRow {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO bookmark_collections (id, owner_uid, name, updated_at) VALUES (?, ?, ?, ?)",
      )
      .run(id, actor.uid, name, new Date().toISOString());
    const row = this.require({ id, ownerUid: actor.uid });
    this.record(row, actor, "create", [
      { key: "name", before: null, after: name },
    ]);
    return row;
  }

  private localItem(
    row: CollectionRow,
    id: string,
  ): SavedRentalEntry | undefined {
    const item = this.db
      .prepare(
        "SELECT content_json FROM bookmark_items WHERE collection_id = ? AND rental_id = ?",
      )
      .get(row.id, id);
    return (
      item && (JSON.parse(item.content_json as string) as SavedRentalEntry)
    );
  }

  private insertItem(
    row: CollectionRow,
    rental: SavedRentalEntry,
    actor: Identity,
  ): void {
    this.db
      .prepare("INSERT INTO bookmark_items VALUES (?, ?, ?)")
      .run(row.id, rental.rentalId, JSON.stringify(rental));
    this.record(
      row,
      actor,
      "add",
      [{ key: "title", before: null, after: rental.title }],
      rental.title,
    );
  }

  list(actor: Identity): BookmarkLibrary {
    const legacy = this.db
      .prepare("SELECT content_json FROM saved_rentals WHERE owner_uid = ?")
      .all(actor.uid);
    if (legacy.length)
      this.transaction(() => {
        const imported = this.db
          .prepare("INSERT OR IGNORE INTO bookmark_imports VALUES (?)")
          .run(actor.uid).changes;
        if (!imported) return;
        const row = this.insert(actor, "Simpanan lama");
        for (const item of legacy)
          this.insertItem(row, JSON.parse(item.content_json as string), actor);
      });
    const rows = this.db
      .prepare(`SELECT c.id, c.name, c.revision, (
      SELECT json_group_array(i.rental_id) FROM bookmark_items i WHERE i.collection_id = c.id
    ) AS rental_ids FROM bookmark_collections c WHERE c.owner_uid = ? ORDER BY c.updated_at DESC, c.id`)
      .all(actor.uid);
    return {
      collections: rows.map((row) => ({
        id: row.id as string,
        name: row.name as string,
        revision: row.revision as number,
        rentalIds: JSON.parse(row.rental_ids as string) as string[],
      })),
      hasLegacyRentals: legacy.length > 0,
    };
  }

  create(
    actor: Identity,
    name: string,
    initialRental?: SavedRentalEntry,
  ): OwnedBookmark {
    const row = this.transaction(() => {
      const created = this.insert(actor, name);
      if (initialRental) this.insertItem(created, initialRental, actor);
      return created;
    });
    return this.ownerView(row);
  }

  private contents(row: CollectionRow) {
    const comments = new Map<string, RentalComment[]>();
    if (row.share_token) {
      for (const raw of this.db
        .prepare(`SELECT rental_id, id, author, text, created_at AS createdAt
          FROM bookmark_comments WHERE share_token = ? ORDER BY created_at, id`)
        .all(row.share_token)) {
        const id = raw.rental_id as string;
        const list = comments.get(id) ?? [];
        list.push({
          id: raw.id as string,
          author: raw.author as string,
          text: raw.text as string,
          createdAt: raw.createdAt as string,
        });
        comments.set(id, list);
      }
    }
    const items = this.db
      .prepare(
        "SELECT content_json FROM bookmark_items WHERE collection_id = ? ORDER BY rowid",
      )
      .all(row.id)
      .map((item) => {
        const rental = JSON.parse(
          item.content_json as string,
        ) as SavedRentalEntry;
        return { rental, comments: comments.get(rental.rentalId) ?? [] };
      });
    return { name: row.name, revision: row.revision, items };
  }

  private ownerView(row: CollectionRow): OwnedBookmark {
    return {
      ...this.contents(row),
      id: row.id,
      share: row.share_token
        ? { token: row.share_token, permission: row.permission }
        : null,
    };
  }

  read(access: BookmarkAccess): OwnedBookmark | SharedBookmark {
    const row = this.require(access);
    return "token" in access
      ? { ...this.contents(row), permission: row.permission }
      : this.ownerView(row);
  }

  rename(
    access: BookmarkAccess,
    actor: Identity,
    revision: number,
    name: string,
  ): void {
    this.transaction(() => {
      const row = this.require(access, "edit");
      this.current(row, revision);
      if (row.name === name) return;
      this.db
        .prepare("UPDATE bookmark_collections SET name = ? WHERE id = ?")
        .run(name, row.id);
      this.record(row, actor, "rename", [
        { key: "name", before: row.name, after: name },
      ]);
    });
  }

  add(
    access: BookmarkAccess,
    actor: Identity,
    revision: number,
    id: string,
    rental?: SavedRentalEntry,
  ): void {
    this.transaction(() => {
      const row = this.require(access, "edit");
      if (this.localItem(row, id)) return;
      this.current(row, revision);
      if (!rental) throw new BookmarkError(404, "Iklan sewa tidak ditemukan.");
      this.insertItem(row, rental, actor);
    });
  }

  edit(
    access: BookmarkAccess,
    actor: Identity,
    revision: number,
    id: string,
    fields: Partial<SavedRentalFields>,
  ): void {
    this.transaction(() => {
      const row = this.require(access, "edit");
      this.current(row, revision);
      const rental = this.localItem(row, id);
      if (!rental) throw new BookmarkError(404, "Hunian tidak ada di koleksi.");
      const updated = {
        ...rental,
        ...fields,
        updatedAt: new Date().toISOString(),
      };
      const delta = (Object.keys(fields) as (keyof SavedRentalFields)[])
        .filter((key) => rental[key] !== updated[key])
        .map((key) => ({ key, before: rental[key], after: updated[key] }));
      if (!delta.length) return;
      this.db
        .prepare(
          "UPDATE bookmark_items SET content_json = ? WHERE collection_id = ? AND rental_id = ?",
        )
        .run(JSON.stringify(updated), row.id, id);
      this.record(row, actor, "edit", delta, rental.title);
    });
  }

  remove(
    access: BookmarkAccess,
    actor: Identity,
    revision: number,
    id: string,
  ): void {
    this.transaction(() => {
      const row = this.require(access, "edit");
      this.current(row, revision);
      const rental = this.localItem(row, id);
      if (!rental) throw new BookmarkError(404, "Hunian tidak ada di koleksi.");
      this.db
        .prepare(
          "DELETE FROM bookmark_items WHERE collection_id = ? AND rental_id = ?",
        )
        .run(row.id, id);
      const fields = (
        [
          "title",
          "locationText",
          "amount",
          "period",
          "minimumMonths",
          "note",
        ] as const
      ).map((key) => ({ key, before: rental[key], after: null }));
      this.record(row, actor, "remove", fields, rental.title);
    });
  }

  share(
    access: Extract<BookmarkAccess, { ownerUid: string }>,
    actor: Identity,
    revision: number,
    permission: BookmarkPermission | null,
  ): void {
    this.transaction(() => {
      const row = this.require(access);
      this.current(row, revision);
      const previous = row.share_token ? row.permission : null;
      if (permission === previous) return;
      const token = permission
        ? (row.share_token ?? randomBytes(24).toString("base64url"))
        : null;
      this.db
        .prepare(
          "UPDATE bookmark_collections SET share_token = ?, permission = ? WHERE id = ?",
        )
        .run(token, permission ?? "view", row.id);
      this.record(row, actor, "share", [
        { key: "permission", before: previous, after: permission },
      ]);
    });
  }

  comment(
    access: BookmarkAccess,
    actor: Identity,
    id: string,
    text: string,
  ): RentalComment {
    return this.transaction(() => {
      const row = this.require(access, "comment");
      const rental = this.localItem(row, id);
      if (!rental) throw new BookmarkError(404, "Hunian tidak ada di koleksi.");
      if (!row.share_token || !rental.note)
        throw new BookmarkError(
          409,
          "Aktifkan berbagi dan isi catatan sebelum berkomentar.",
        );
      const comment = {
        id: randomUUID(),
        text,
        createdAt: new Date().toISOString(),
        author:
          row.owner_uid === actor.uid
            ? "Pemilik"
            : (actor.name ?? "Pengunjung"),
      };
      this.db
        .prepare("INSERT INTO bookmark_comments VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(
          comment.id,
          row.id,
          id,
          row.share_token,
          comment.author,
          text,
          comment.createdAt,
        );
      return comment;
    });
  }

  history(
    access: Extract<BookmarkAccess, { ownerUid: string }>,
    before: number,
  ) {
    const row = this.require(access);
    const changes = this.db
      .prepare(`SELECT content_json FROM bookmark_history
      WHERE collection_id = ? AND revision < ? ORDER BY revision DESC LIMIT 31`)
      .all(row.id, before)
      .map(
        (change) => JSON.parse(change.content_json as string) as BookmarkChange,
      );
    const page = changes.slice(0, 30);
    return {
      changes: page,
      next: changes.length > page.length ? page.at(-1)?.revision : null,
    };
  }
}
