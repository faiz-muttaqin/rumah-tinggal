import { getUser, login, loginErrorMessage, privateAPI } from "./auth.ts";
import { escapeHTML as esc } from "./geo.ts";
import { icon } from "./icons.ts";
import type { ResearchRental } from "./research-data.ts";
import {
  formFields,
  rentalEditFields,
  rentalLinks,
  rentalPrice,
  saveLabel,
} from "./saved-rentals.ts";
import type {
  BookmarkChange,
  BookmarkItem,
  BookmarkLibrary,
  BookmarkPermission,
  OwnedBookmark,
  RentalComment,
  SharedBookmark,
} from "./types.ts";

const libraryPath = "/api/bookmark-collections";
const sharedPath = "/api/shared-bookmark-collection";
const hashKey = "bagikan-koleksi";
const permissions: Record<BookmarkPermission, string> = {
  view: "Lihat saja",
  comment: "Boleh komentar",
  edit: "Boleh edit",
};
const historyLabels: Record<BookmarkChange["action"], string> = {
  create: "Membuat koleksi",
  rename: "Mengubah nama koleksi",
  add: "Menambah hunian",
  edit: "Mengedit hunian",
  remove: "Mengeluarkan hunian",
  share: "Mengubah akses tautan",
};
const fieldLabels: Record<BookmarkChange["fields"][number]["key"], string> = {
  name: "Nama koleksi",
  title: "Nama hunian",
  locationText: "Kawasan",
  amount: "Harga sewa (Rp)",
  period: "Periode",
  minimumMonths: "Minimum sewa (bulan)",
  note: "Catatan",
  permission: "Izin tautan",
};
const historyDate = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

type Ref = { id: string } | { token: string };
type Collection = OwnedBookmark | SharedBookmark;
type History = { changes: BookmarkChange[]; next: number | null };
type LibraryView = { kind: "library"; rentalId?: string; busy?: boolean };
type DetailView = {
  kind: "detail";
  ref: Ref;
  collection?: Collection;
  itemId?: string;
  history?: History;
  busy?: boolean;
};
type View = LibraryView | DetailView;

function tokenFromHash(): string | null {
  return new URLSearchParams(location.hash.slice(1)).get(hashKey);
}

function shareLink(token: string): string {
  const url = new URL("/", location.origin);
  url.hash = new URLSearchParams({ [hashKey]: token }).toString();
  return url.href;
}

function pathFor(ref: Ref): string {
  return "token" in ref
    ? sharedPath
    : `${libraryPath}/${encodeURIComponent(ref.id)}`;
}

function write(method: string, fields: object): RequestInit {
  return { method, body: JSON.stringify(fields) };
}

function historyValue(
  field: BookmarkChange["fields"][number]["key"],
  value: string | number | null,
): string {
  if (value === null || value === "") return "—";
  if (field === "permission") return permissions[value as BookmarkPermission];
  if (field === "period") return value === "yearly" ? "Tahunan" : "Bulanan";
  return typeof value === "number" ? value.toLocaleString("id-ID") : value;
}

export class BookmarkCollections {
  private dialog: HTMLDialogElement;
  private heading: HTMLElement;
  private body: HTMLElement;
  private feedback: HTMLElement;
  private view?: View;
  private library?: BookmarkLibrary;
  private account = 0;
  private listRequest = 0;
  private rentals: () => readonly ResearchRental[];
  private openLegacy: () => void;

  constructor(
    rentals: () => readonly ResearchRental[],
    openLegacy: () => void,
  ) {
    this.rentals = rentals;
    this.openLegacy = openLegacy;
    this.dialog = document.createElement("dialog");
    this.dialog.className = "saved-rental-dialog bookmark-dialog";
    this.dialog.setAttribute("aria-labelledby", "bookmark-dialog-title");
    this.dialog.innerHTML = `<div class="saved-rental-heading"><h2 id="bookmark-dialog-title"></h2><button type="button" class="icon-button" data-bookmark-action="close" aria-label="Tutup koleksi simpanan">${icon("close")}</button></div><p class="saved-rental-feedback" role="status"></p><div data-saved-body></div>`;
    document.body.append(this.dialog);
    this.heading = this.dialog.querySelector("h2") as HTMLElement;
    this.body = this.dialog.querySelector("[data-saved-body]") as HTMLElement;
    this.feedback = this.dialog.querySelector("[role=status]") as HTMLElement;
    this.dialog.onclick = (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "[data-bookmark-action]",
      );
      if (button) void this.action(button);
    };
    this.dialog.onsubmit = (event) => {
      event.preventDefault();
      const form = event.target as HTMLFormElement;
      void this.submit(form);
    };
    this.dialog.oninput = (event) => {
      const input = event.target;
      if (
        input instanceof HTMLInputElement &&
        input.matches("[data-bookmark-search]")
      )
        this.search(input.value);
    };
    this.dialog.onclose = () => {
      if (this.dialog.open) return;
      const view = this.view;
      if (
        view?.kind === "detail" &&
        "token" in view.ref &&
        tokenFromHash() === view.ref.token
      )
        history.replaceState(
          history.state,
          "",
          location.pathname + location.search,
        );
      this.view = undefined;
      this.body.replaceChildren();
      this.message("");
    };
    document.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "[data-save-rental], [data-open-saved-rentals]",
      );
      if (button) this.openLibrary(button.dataset.saveRental);
    });
    window.addEventListener("hashchange", () => this.checkHash());
    this.checkHash();
  }

  has(rentalId: string): boolean {
    return (
      this.library?.collections.some((collection) =>
        collection.rentalIds.includes(rentalId),
      ) ?? false
    );
  }

  authChanged(): void {
    this.account++;
    this.library = undefined;
    this.syncButtons();
    const view = this.view;
    if (view?.kind === "detail" && "token" in view.ref) {
      if (view.collection && this.dialog.open) this.renderDetail(view);
    } else if (this.dialog.open) {
      this.openLibrary(view?.kind === "library" ? view.rentalId : undefined);
      return;
    }
    if (getUser()) void this.loadLibrary();
  }

  private show(view: View, title: string): void {
    this.view = view;
    this.heading.textContent = title;
    this.message("");
    if (!this.dialog.open) this.dialog.showModal();
  }

  private current(view: View): boolean {
    return this.view === view && this.dialog.open;
  }

  private async task<T>(
    view: View,
    request: () => Promise<T>,
    complete: (result: T) => void,
    privateAccount = true,
  ): Promise<void> {
    if (view.busy) return;
    const account = this.account;
    view.busy = true;
    const buttons = this.body.querySelectorAll<HTMLButtonElement>(
      "button:not(:disabled)",
    );
    for (const button of buttons) button.disabled = true;
    const valid = () =>
      this.current(view) && (!privateAccount || account === this.account);
    try {
      const result = await request();
      if (valid()) complete(result);
    } catch (error) {
      if (valid()) this.message(error);
    } finally {
      view.busy = false;
      for (const button of buttons) button.disabled = false;
    }
  }

  private message(input: unknown): void {
    this.feedback.textContent =
      input instanceof Error ? input.message : String(input);
  }

  private openLibrary(rentalId?: string): void {
    const view: LibraryView = { kind: "library", rentalId };
    this.show(view, "Simpanan hunian");
    if (!getUser()) {
      this.body.innerHTML = `<p>Masuk untuk menyimpan hunian ke koleksi.</p><button type="button" class="button primary" data-bookmark-action="login">Masuk dengan Google</button>`;
      return;
    }
    this.renderLibrary(view);
    void this.loadLibrary(view);
  }

  private async loadLibrary(view?: LibraryView): Promise<void> {
    const account = this.account;
    const sequence = ++this.listRequest;
    try {
      const library = await privateAPI<BookmarkLibrary>(libraryPath);
      if (account !== this.account || sequence !== this.listRequest) return;
      this.library = library;
      this.syncButtons();
      if (view && this.current(view)) this.renderLibrary(view);
    } catch (error) {
      if (view && account === this.account && this.current(view))
        this.message(error);
    }
  }

  private renderLibrary(view: LibraryView): void {
    const rental = view.rentalId
      ? this.rentals().find((item) => item.id === view.rentalId)
      : undefined;
    const collections = this.library?.collections ?? [];
    const draft =
      this.body.querySelector<HTMLInputElement>(
        '[data-bookmark-form="create"] input',
      )?.value ?? "";
    this.body.innerHTML = `${view.rentalId ? `<p>Pilih koleksi untuk menyimpan <strong>${esc(rental?.title ?? "hunian ini")}</strong>.</p>` : ""}
      ${collections.length ? `<ul class="saved-rental-list">${collections.map((collection) => `<li><button type="button" data-bookmark-action="open" data-id="${esc(collection.id)}"><strong>${esc(collection.name)}</strong><span>${collection.rentalIds.length} hunian${view.rentalId && collection.rentalIds.includes(view.rentalId) ? " · Sudah tersimpan" : ""}</span></button></li>`).join("")}</ul>` : ""}
      <form data-bookmark-form="create"><label>Nama koleksi baru<input name="name" maxlength="120" required value="${esc(draft)}" placeholder="Misalnya Pilihan survei"/></label><button class="button primary" type="submit">${view.rentalId ? "Buat koleksi dan simpan" : "Buat koleksi"}</button></form>
      ${this.library?.hasLegacyRentals ? '<button class="saved-remove text-button" type="button" data-bookmark-action="legacy">Kelola simpanan lama</button>' : ""}`;
  }

  private record(collection: OwnedBookmark): void {
    this.listRequest++;
    const library = this.library ?? {
      collections: [],
      hasLegacyRentals: false,
    };
    this.library = {
      ...library,
      collections: [
        {
          id: collection.id,
          name: collection.name,
          revision: collection.revision,
          rentalIds: collection.items.map(({ rental }) => rental.rentalId),
        },
        ...library.collections.filter(({ id }) => id !== collection.id),
      ],
    };
    this.syncButtons();
  }

  private syncButtons(): void {
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      "[data-save-rental]",
    )) {
      const saved = this.has(button.dataset.saveRental ?? "");
      const label = saveLabel(saved);
      button.dataset.saved = String(saved);
      button.setAttribute("aria-label", label);
      button.title = label;
      const span = button.querySelector("span");
      if (span) span.textContent = label;
    }
  }

  private checkHash(): void {
    const token = tokenFromHash();
    if (token !== null) void this.openDetail({ token });
    else if (this.view?.kind === "detail" && "token" in this.view.ref)
      this.dialog.close();
  }

  private async openDetail(
    ref: Ref,
    collection?: Collection,
    itemId?: string,
  ): Promise<void> {
    const view: DetailView = { kind: "detail", ref, collection, itemId };
    this.show(
      view,
      collection?.name ??
        ("token" in ref ? "Koleksi yang dibagikan" : "Simpanan hunian"),
    );
    if (collection) this.renderDetail(view);
    else {
      this.body.innerHTML = "<p>Memuat koleksi…</p>";
      await this.reload(view);
    }
  }

  private async reload(view: DetailView): Promise<void> {
    await this.task(
      view,
      async () => {
        if (!("token" in view.ref))
          return privateAPI<{ collection: Collection }>(pathFor(view.ref));
        const response = await fetch(sharedPath, {
          headers: { "X-Rental-Share": view.ref.token },
        });
        if (!response.ok) {
          if (response.status === 404) view.collection = undefined;
          throw new Error("Tautan koleksi tidak tersedia.");
        }
        return (await response.json()) as { collection: Collection };
      },
      ({ collection }) => {
        this.message("");
        view.collection = collection;
        if ("id" in collection) this.record(collection);
        this.renderDetail(view);
      },
      !("token" in view.ref),
    );
    if (this.current(view) && !view.collection) this.body.replaceChildren();
  }

  private canEdit(collection: Collection): boolean {
    return (
      "id" in collection ||
      (collection.permission === "edit" && Boolean(getUser()))
    );
  }

  private renderDetail(view: DetailView): void {
    const { collection } = view;
    if (!collection) return;
    this.heading.textContent = collection.name;
    if (view.history) {
      this.renderHistory(view.history);
      return;
    }
    const item = collection.items.find(
      ({ rental }) => rental.rentalId === view.itemId,
    );
    if (item) {
      this.renderItem(collection, item);
      return;
    }
    const shared = "permission" in collection;
    const edit = this.canEdit(collection);
    this.body.innerHTML = `<div class="bookmark-actions">${shared ? `<span>${permissions[collection.permission]}</span>` : '<button type="button" class="text-button" data-bookmark-action="library">← Semua koleksi</button>'}<button type="button" class="text-button" data-bookmark-action="reload">Muat ulang</button></div>
      ${shared && collection.permission !== "view" && !getUser() ? `<button class="button" type="button" data-bookmark-action="login">Masuk dengan Google untuk ${collection.permission === "edit" ? "mengedit" : "berkomentar"}</button>` : ""}
      ${collection.items.length ? `<ul class="saved-rental-list">${collection.items.map(({ rental, comments }) => `<li><button data-bookmark-action="item" data-id="${esc(rental.rentalId)}" type="button"><strong>${esc(rental.title)}</strong><span>${esc(rentalPrice(rental))}</span><span>${esc(rental.locationText)}${comments.length ? ` · ${comments.length} komentar` : ""}</span></button></li>`).join("")}</ul>` : "<p>Belum ada hunian di koleksi ini.</p>"}
      ${
        edit
          ? `<details class="bookmark-section"><summary>Tambah hunian</summary><label>Cari di katalog sewa<input data-bookmark-search type="search" placeholder="Nama hunian atau kawasan"/></label><div class="bookmark-search-results" data-bookmark-results></div></details>
      <details class="bookmark-section"><summary>Ubah nama koleksi</summary><form data-bookmark-form="rename"><label>Nama koleksi<input name="name" maxlength="120" required value="${esc(collection.name)}"/></label><button type="submit" class="button">Simpan nama</button></form></details>`
          : ""
      }
      ${"id" in collection ? `${this.sharing(collection)}<button type="button" class="button saved-remove" data-bookmark-action="history">Riwayat edit</button>` : ""}`;
  }

  private sharing(collection: OwnedBookmark): string {
    const { share } = collection;
    const url = share && esc(shareLink(share.token));
    return `<section class="bookmark-section"><h3>Bagikan koleksi</h3><p>Izin berlaku untuk setiap orang yang memiliki tautan ini.</p><form data-bookmark-form="share"><label>Izin tautan<select name="permission">${Object.entries(
      permissions,
    )
      .map(
        ([value, label]) =>
          `<option value="${value}"${share?.permission === value ? " selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></label><button type="submit" class="button">${share ? "Simpan izin" : "Aktifkan tautan"}</button></form>
      ${url ? `<label>Tautan koleksi<input data-bookmark-link readonly value="${url}"/></label><div class="saved-rental-links"><button type="button" class="button" data-bookmark-action="copy">Salin tautan</button><a href="${url}" target="_blank" rel="noopener noreferrer">Buka tautan ↗</a><button type="button" class="text-button" data-bookmark-action="revoke">Nonaktifkan tautan</button></div>` : ""}</section>`;
  }

  private search(value: string): void {
    const results = this.body.querySelector("[data-bookmark-results]");
    if (!results) return;
    const query = value.trim().toLocaleLowerCase("id-ID");
    if (query.length < 2) {
      results.replaceChildren();
      return;
    }
    const view = this.view;
    if (view?.kind !== "detail") return;
    const saved = new Set(
      view.collection?.items.map(({ rental }) => rental.rentalId),
    );
    const matches = this.rentals()
      .filter(
        (rental) =>
          !saved.has(rental.id) &&
          `${rental.title} ${rental.locationText}`
            .toLocaleLowerCase("id-ID")
            .includes(query),
      )
      .slice(0, 10);
    results.innerHTML = matches.length
      ? `<ul class="saved-rental-list">${matches.map((rental) => `<li><button type="button" data-bookmark-action="add" data-id="${esc(rental.id)}"><strong>${esc(rental.title)}</strong><span>${esc(rental.locationText)}</span></button></li>`).join("")}</ul>`
      : "<p>Belum ada hasil pencarian.</p>";
  }

  private renderItem(
    collection: Collection,
    { rental, comments }: BookmarkItem,
  ): void {
    const canComment =
      "id" in collection
        ? Boolean(collection.share)
        : collection.permission !== "view";
    const edit = this.canEdit(collection);
    this.body.innerHTML = `<div class="bookmark-actions"><button type="button" class="text-button" data-bookmark-action="back">← Isi koleksi</button><button type="button" class="text-button" data-bookmark-action="reload">Muat ulang</button></div><article class="saved-rental-public"><h3>${esc(rental.title)}</h3><p>${esc(rental.locationText)}</p><p><strong>${esc(rentalPrice(rental))}</strong></p>${rentalLinks(rental)}<h4>Catatan</h4><p class="saved-note">${rental.note ? esc(rental.note) : "Belum ada catatan."}</p></article>
      ${edit ? `<details class="bookmark-section"><summary>Edit hunian dan catatan</summary><form data-bookmark-form="item">${rentalEditFields(rental)}<button type="submit" class="button primary">Simpan perubahan</button></form></details>` : ""}
      ${
        canComment || comments.length
          ? `<section class="saved-comment-panel"><h4>Komentar</h4><ol>${comments.length ? comments.map((comment) => `<li><strong>${esc(comment.author)}</strong><p>${esc(comment.text)}</p></li>`).join("") : "<li>Belum ada komentar.</li>"}</ol>${
              rental.note && canComment
                ? getUser()
                  ? '<form data-bookmark-form="comment"><label>Tulis komentar<textarea name="text" rows="3" required maxlength="2000"></textarea></label><button type="submit" class="button primary">Kirim komentar</button></form>'
                  : '<button class="button" type="button" data-bookmark-action="login">Masuk dengan Google untuk berkomentar</button>'
                : ""
            }</section>`
          : ""
      }
      ${edit ? '<button type="button" class="text-button saved-remove" data-bookmark-action="remove">Keluarkan dari koleksi</button>' : ""}`;
  }

  private renderHistory(history: History): void {
    this.body.innerHTML = `<button type="button" class="text-button" data-bookmark-action="back">← Isi koleksi</button><h3 class="bookmark-history-title">Riwayat edit</h3><ol class="bookmark-history">${history.changes.map((change) => `<li><strong>${historyLabels[change.action]}${change.item ? ` · ${esc(change.item)}` : ""}</strong><p>${esc(change.author)} · <time datetime="${esc(change.createdAt)}">${esc(historyDate.format(new Date(change.createdAt)))} WIB</time></p>${change.fields.length ? `<dl>${change.fields.map((field) => `<dt>${fieldLabels[field.key]}</dt><dd><span>Sebelum</span><p>${esc(historyValue(field.key, field.before))}</p><span>Sesudah</span><p>${esc(historyValue(field.key, field.after))}</p></dd>`).join("")}</dl>` : ""}</li>`).join("")}</ol>${history.next ? '<button type="button" class="button" data-bookmark-action="history-more">Lihat perubahan lebih lama</button>' : ""}`;
  }

  private async history(view: DetailView, more: boolean): Promise<void> {
    if (!("id" in view.ref)) return;
    const before = more ? view.history?.next : undefined;
    await this.task(
      view,
      () =>
        privateAPI<History>(
          `${pathFor(view.ref)}/history${before ? `?before=${before}` : ""}`,
        ),
      (result) => {
        view.history = {
          ...result,
          changes: more
            ? [...(view.history?.changes ?? []), ...result.changes]
            : result.changes,
        };
        this.message("");
        this.renderDetail(view);
      },
    );
  }

  private async select(view: LibraryView, id: string): Promise<void> {
    const entry = this.library?.collections.find(
      (collection) => collection.id === id,
    );
    if (!entry) return;
    const rentalId = view.rentalId;
    if (!rentalId || entry.rentalIds.includes(rentalId)) {
      await this.openDetail({ id }, undefined, rentalId);
      return;
    }
    await this.task(
      view,
      () =>
        privateAPI<{ collection: OwnedBookmark }>(
          `${libraryPath}/${id}/items/${encodeURIComponent(rentalId)}`,
          write("PUT", { revision: entry.revision }),
        ),
      ({ collection }) => {
        this.record(collection);
        void this.openDetail({ id }, collection, rentalId);
        this.message("Hunian tersimpan di koleksi.");
      },
    );
    if (this.current(view)) void this.loadLibrary(view);
  }

  private async action(button: HTMLButtonElement): Promise<void> {
    const view = this.view;
    if (!view) return;
    const action = button.dataset.bookmarkAction;
    const id = button.dataset.id;
    if (action === "close") this.dialog.close();
    else if (action === "login")
      await this.task(
        view,
        () =>
          login().catch((error) => {
            throw new Error(loginErrorMessage(error));
          }),
        () => {},
      );
    else if (action === "library") this.openLibrary();
    else if (action === "legacy") {
      this.dialog.close();
      this.openLegacy();
    } else if (view.kind === "library") {
      if (action === "open" && id) await this.select(view, id);
    } else if (view.collection) {
      if (action === "item" || action === "back") {
        view.itemId = action === "item" ? id : undefined;
        view.history = undefined;
        this.message("");
        this.renderDetail(view);
      } else if (action === "reload") await this.reload(view);
      else if (action === "history" || action === "history-more")
        await this.history(view, action === "history-more");
      else if (action === "copy") {
        const field = this.body.querySelector<HTMLInputElement>(
          "[data-bookmark-link]",
        );
        if (!field) return;
        try {
          await navigator.clipboard.writeText(field.value);
          this.message("Tautan disalin.");
        } catch {
          field.select();
          this.message("Tautan dipilih. Salin dari kolom tautan.");
        }
      } else if (action === "add" && id) {
        await this.change(
          view,
          `/items/${encodeURIComponent(id)}`,
          "PUT",
          {},
          "Hunian ditambahkan ke koleksi.",
        );
      } else if (
        action === "remove" &&
        view.itemId &&
        window.confirm("Keluarkan hunian beserta komentar dari koleksi ini?")
      ) {
        await this.change(
          view,
          `/items/${encodeURIComponent(view.itemId)}`,
          "DELETE",
          {},
          "Hunian dikeluarkan dari koleksi.",
        );
      } else if (action === "revoke")
        await this.change(
          view,
          "/share",
          "DELETE",
          {},
          "Tautan dinonaktifkan.",
        );
    }
  }

  private options(
    view: DetailView,
    method: string,
    fields: object,
  ): RequestInit {
    const options = write(method, fields);
    if ("token" in view.ref)
      options.headers = { "X-Rental-Share": view.ref.token };
    return options;
  }

  private async change(
    view: DetailView,
    suffix: string,
    method: string,
    fields: object,
    message: string,
  ): Promise<void> {
    await this.task(
      view,
      () =>
        privateAPI<{ collection: Collection }>(
          pathFor(view.ref) + suffix,
          this.options(view, method, {
            ...fields,
            revision: view.collection?.revision,
          }),
        ),
      ({ collection }) => {
        view.collection = collection;
        if (method === "DELETE" && suffix.startsWith("/items/"))
          view.itemId = undefined;
        if ("id" in collection) this.record(collection);
        this.renderDetail(view);
        this.message(message);
      },
    );
  }

  private async submit(form: HTMLFormElement): Promise<void> {
    const view = this.view;
    if (!view) return;
    const fields = new FormData(form);
    if (view.kind === "library") {
      await this.task(
        view,
        () =>
          privateAPI<{ collection: OwnedBookmark }>(
            libraryPath,
            write("POST", {
              name: fields.get("name"),
              rentalId: view.rentalId,
            }),
          ),
        ({ collection }) => {
          this.record(collection);
          void this.openDetail(
            { id: collection.id },
            collection,
            view.rentalId,
          );
          this.message(
            view.rentalId
              ? "Koleksi dibuat dan hunian tersimpan."
              : "Koleksi dibuat.",
          );
        },
      );
      return;
    }
    switch (form.dataset.bookmarkForm) {
      case "rename":
        await this.change(
          view,
          "",
          "PATCH",
          { name: fields.get("name") },
          "Nama koleksi diperbarui.",
        );
        break;
      case "share":
        await this.change(
          view,
          "/share",
          "PUT",
          { permission: fields.get("permission") },
          "Izin tautan tersimpan.",
        );
        break;
      case "item":
        if (view.itemId)
          await this.change(
            view,
            `/items/${encodeURIComponent(view.itemId)}`,
            "PATCH",
            formFields(form),
            "Perubahan tersimpan di riwayat.",
          );
        break;
      case "comment": {
        const item = view.collection?.items.find(
          ({ rental }) => rental.rentalId === view.itemId,
        );
        if (!item) return;
        const path = `${pathFor(view.ref)}/items/${encodeURIComponent(item.rental.rentalId)}/comments`;
        await this.task(
          view,
          () =>
            privateAPI<{ comment: RentalComment }>(
              path,
              this.options(view, "POST", { text: fields.get("text") }),
            ),
          ({ comment }) => {
            item.comments.push(comment);
            this.renderDetail(view);
            this.message("Komentar terkirim.");
          },
        );
        break;
      }
    }
  }
}
