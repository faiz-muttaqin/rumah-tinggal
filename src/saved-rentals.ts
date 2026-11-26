import { getUser, login, loginErrorMessage, privateAPI } from "./auth.ts";
import { escapeHTML as esc } from "./geo.ts";
import { icon } from "./icons.ts";
import { googleMapsLocation } from "./maps-links.ts";
import { safeUrl } from "./research-data.ts";
import type {
  RentalComment,
  SavedRental,
  SavedRentalEntry,
  SavedRentalFields,
  SharedRental,
} from "./types.ts";
import "./saved-rentals.css";

const collectionPath = "/api/saved-rentals";
const sharedPath = "/api/shared-rentals";
type View =
  | { kind: "list" }
  | { kind: "edit"; id: string }
  | { kind: "shared"; token: string; details?: SharedRental };

function shareToken(): string | null {
  return new URLSearchParams(location.hash.slice(1)).get("bagikan");
}

function shareUrl(token: string): string {
  const url = new URL("/", location.origin);
  url.hash = new URLSearchParams({ bagikan: token }).toString();
  return url.href;
}

export function saveLabel(saved: boolean): string {
  return saved ? "Buka bookmark" : "Simpan hunian";
}

export function rentalSaveButton(
  id: string,
  saved: boolean,
  compact = false,
  collectionId?: string,
): string {
  const label = saveLabel(saved);
  const target = collectionId
    ? ` data-bookmark-collection="${esc(collectionId)}"`
    : "";
  return `<button type="button" class="rental-save-button${compact ? " is-compact" : " button"}" data-save-rental="${esc(id)}"${target} data-saved="${saved}" aria-label="${label}" title="${label}">${icon("bookmark")}${compact ? "" : `<span>${label}</span>`}</button>`;
}

export function rentalPrice(rental: SavedRentalEntry): string {
  return `Rp ${rental.amount.toLocaleString("id-ID")} / ${rental.period === "yearly" ? "tahun" : "bulan"}${rental.minimumMonths ? ` · min. ${rental.minimumMonths} bulan` : ""}`;
}

export function rentalLinks(rental: SavedRentalEntry): string {
  const external = 'target="_blank" rel="noopener noreferrer"';
  return `<div class="saved-rental-links"><a href="${esc(safeUrl(rental.sourceUrl))}" ${external}>Iklan sumber ↗</a>${rental.location ? `<a href="${esc(googleMapsLocation(rental.location))}" ${external}>Titik di Google Maps ↗</a>` : ""}</div>`;
}

export function formFields(form: HTMLFormElement): SavedRentalFields {
  const values = new FormData(form);
  const minimum = values.get("minimumMonths");
  return {
    title: String(values.get("title")),
    locationText: String(values.get("locationText")),
    amount: Number(values.get("amount")),
    period: values.get("period") === "yearly" ? "yearly" : "monthly",
    minimumMonths: minimum ? Number(minimum) : null,
    note: String(values.get("note")),
  };
}

export function rentalEditFields(rental: SavedRentalEntry): string {
  return `<label>Nama simpanan<input name="title" required maxlength="200" value="${esc(rental.title)}"/></label><label>Kawasan<input name="locationText" required maxlength="240" value="${esc(rental.locationText)}"/></label>
      <div class="form-grid"><label>Harga sewa (Rp)<input type="number" name="amount" min="1" step="1" required value="${rental.amount}"/></label><label>Periode<select name="period"><option value="monthly">Bulanan</option><option value="yearly" ${rental.period === "yearly" ? "selected" : ""}>Tahunan</option></select></label></div>
      <label>Minimum sewa (bulan)<input type="number" name="minimumMonths" min="1" max="120" step="1" value="${rental.minimumMonths ?? ""}"/></label><label>Catatan<textarea name="note" rows="4" maxlength="4000" placeholder="Hal yang perlu dicek saat survei…">${esc(rental.note)}</textarea></label>`;
}

export class SavedRentals {
  private dialog: HTMLDialogElement;
  private heading: HTMLElement;
  private body: HTMLElement;
  private feedback: HTMLElement;
  private view?: View;
  private entries = new Map<string, SavedRental>();
  private accountVersion = 0;
  private listVersion = 0;

  constructor() {
    this.dialog = document.createElement("dialog");
    this.dialog.className = "saved-rental-dialog";
    this.dialog.setAttribute("aria-labelledby", "saved-rental-title");
    this.dialog.innerHTML = `<div class="saved-rental-heading"><h2 id="saved-rental-title"></h2><button type="button" class="icon-button" data-saved-action="close" aria-label="Tutup simpanan hunian">${icon("close")}</button></div><p class="saved-rental-feedback" role="status" aria-live="polite"></p><div data-saved-body></div>`;
    document.body.append(this.dialog);
    this.heading = this.dialog.querySelector("h2") as HTMLElement;
    this.feedback = this.dialog.querySelector("[role=status]") as HTMLElement;
    this.body = this.dialog.querySelector("[data-saved-body]") as HTMLElement;
    this.dialog.onclick = (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "[data-saved-action]",
      );
      if (button) void this.action(button);
    };
    this.dialog.onsubmit = (event) => {
      event.preventDefault();
      const form = event.target as HTMLFormElement;
      if (form.matches("[data-saved-edit]")) void this.update(form);
      if (form.matches("[data-saved-comment]")) void this.addComment(form);
    };
    this.dialog.onclose = () => {
      if (this.dialog.open) return;
      if (this.view?.kind === "shared" && shareToken() === this.view.token)
        history.replaceState(
          history.state,
          "",
          location.pathname + location.search,
        );
      this.view = undefined;
      this.body.replaceChildren();
      this.feedback.textContent = "";
    };
    window.addEventListener("hashchange", () => this.checkHash());
    this.checkHash();
  }

  authChanged(): void {
    this.accountVersion++;
    this.entries.clear();
    if (this.view?.kind === "shared") {
      if (this.view.details) this.renderShared(this.view.details);
    } else if (this.dialog.open) {
      this.openList();
    }
  }

  openList(): void {
    const view = { kind: "list" } as const;
    this.show(view, "Hunian tersimpan lama");
    if (!getUser()) {
      this.body.innerHTML = `<p>Masuk untuk menyimpan hunian dan membuka catatanmu.</p><button type="button" class="button primary" data-saved-action="login">Masuk dengan Google</button>`;
      return;
    }
    this.renderList();
    void this.loadList(view);
  }

  private async loadList(view?: View): Promise<void> {
    const account = this.accountVersion;
    const request = ++this.listVersion;
    try {
      const { rentals } = await privateAPI<{ rentals: SavedRental[] }>(
        collectionPath,
      );
      if (account !== this.accountVersion || request !== this.listVersion)
        return;
      this.entries = new Map(
        rentals.map((rental) => [rental.rentalId, rental]),
      );
      if (view && this.current(view)) this.renderList();
    } catch (error) {
      if (view && account === this.accountVersion && this.current(view))
        this.message(error);
    }
  }

  private renderList(): void {
    const rentals = [...this.entries.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    this.body.innerHTML = rentals.length
      ? `<ul class="saved-rental-list">${rentals.map((rental) => `<li><button type="button" data-saved-action="edit" data-id="${esc(rental.rentalId)}"><strong>${esc(rental.title)}</strong><span>${esc(rentalPrice(rental))}</span><span>${esc(rental.locationText)}${rental.shareToken ? " · Dibagikan" : ""}</span></button></li>`).join("")}</ul>`
      : "<p>Belum ada simpanan dari versi sebelumnya.</p>";
  }

  private async openRental(id: string): Promise<void> {
    if (!getUser()) {
      this.openList();
      return;
    }
    const view = { kind: "edit", id } as const;
    this.show(view, "Hunian tersimpan lama");
    const existing = this.entries.get(id);
    if (existing) {
      this.renderEditor(existing);
      return;
    }
    this.body.innerHTML = "<p>Menyimpan hunian…</p>";
    await this.saveRequest(view, { method: "PUT" }, this.accountVersion);
  }

  private renderEditor(rental: SavedRental): void {
    this.body.innerHTML = `<button type="button" class="text-button" data-saved-action="list">← Semua simpanan</button>${rentalLinks(rental)}
      <form data-saved-edit>${rentalEditFields(rental)}<button class="button primary" type="submit">Simpan perubahan</button></form>
      <section class="saved-share-panel" data-saved-sharing></section><button type="button" class="text-button saved-remove" data-saved-action="remove">Hapus simpanan</button>`;
    this.renderSharing(rental);
  }

  private renderSharing(rental: SavedRental): void {
    const panel = this.body.querySelector("[data-saved-sharing]");
    if (!panel) return;
    const url = rental.shareToken
      ? esc(shareUrl(rental.shareToken))
      : undefined;
    panel.innerHTML = `<h3>Bagikan hunian</h3>${
      url
        ? `<label>Tautan berbagi<input data-saved-link readonly value="${url}"/></label><div class="saved-rental-links"><button type="button" class="button" data-saved-action="copy">Salin tautan</button><a href="${url}" target="_blank" rel="noopener noreferrer">Buka tautan ↗</a><button type="button" class="text-button" data-saved-action="revoke">Nonaktifkan tautan</button></div>`
        : `<p>Pemilik tautan dapat membaca detail dan catatan tersimpan.</p><button type="button" class="button" data-saved-action="share">Aktifkan tautan</button>`
    }`;
  }

  private async update(form: HTMLFormElement): Promise<void> {
    const view = this.view;
    const submit = form.querySelector<HTMLButtonElement>("button[type=submit]");
    if (view?.kind !== "edit" || !submit || submit.disabled) return;
    submit.disabled = true;
    await this.saveRequest(
      view,
      { method: "PATCH", body: JSON.stringify(formFields(form)) },
      this.accountVersion,
    );
    submit.disabled = false;
  }

  private async saveRequest(
    view: Extract<View, { kind: "edit" }>,
    options: RequestInit,
    account: number,
  ): Promise<void> {
    try {
      const { rental } = await privateAPI<{ rental: SavedRental }>(
        `${collectionPath}/${encodeURIComponent(view.id)}`,
        options,
      );
      if (account !== this.accountVersion) return;
      this.record(rental);
      if (this.current(view)) {
        if (options.method === "PUT") this.renderEditor(rental);
        this.message(
          options.method === "PUT"
            ? "Hunian tersimpan."
            : "Perubahan tersimpan.",
        );
      }
    } catch (error) {
      if (account === this.accountVersion && this.current(view))
        this.message(error);
    }
  }

  private async action(button: HTMLButtonElement): Promise<void> {
    const action = button.dataset.savedAction;
    if (action === "close") this.dialog.close();
    else if (action === "list") this.openList();
    else if (action === "edit" && button.dataset.id)
      await this.openRental(button.dataset.id);
    else if (action === "login") {
      button.disabled = true;
      try {
        await login();
      } catch (error) {
        this.message(loginErrorMessage(error));
      } finally {
        button.disabled = false;
      }
    } else if (action === "copy") {
      const link =
        this.body.querySelector<HTMLInputElement>("[data-saved-link]");
      if (!link) return;
      try {
        await navigator.clipboard.writeText(link.value);
        this.message("Tautan disalin.");
      } catch {
        link.select();
        this.message("Tautan dipilih. Salin dari kolom tautan.");
      }
    } else if (
      action === "share" ||
      action === "revoke" ||
      action === "remove"
    ) {
      await this.changeSharing(button, action);
    }
  }

  private async changeSharing(
    button: HTMLButtonElement,
    action: "share" | "revoke" | "remove",
  ): Promise<void> {
    const view = this.view;
    if (view?.kind !== "edit" || button.disabled) return;
    if (
      action === "remove" &&
      !window.confirm("Hapus simpanan beserta catatan dan komentarnya?")
    )
      return;
    const account = this.accountVersion;
    const path = `${collectionPath}/${encodeURIComponent(view.id)}`;
    button.disabled = true;
    try {
      if (action === "remove") {
        await privateAPI(path, { method: "DELETE" });
        if (account !== this.accountVersion) return;
        this.listVersion++;
        this.entries.delete(view.id);
        if (this.current(view)) this.openList();
      } else {
        const { rental } = await privateAPI<{ rental: SavedRental }>(
          `${path}/share`,
          { method: action === "share" ? "PUT" : "DELETE" },
        );
        if (account !== this.accountVersion) return;
        this.record(rental);
        if (this.current(view)) {
          this.renderSharing(rental);
          this.message(
            action === "share"
              ? "Tautan siap disalin."
              : "Tautan dinonaktifkan.",
          );
        }
      }
    } catch (error) {
      if (account === this.accountVersion && this.current(view))
        this.message(error);
    } finally {
      button.disabled = false;
    }
  }

  private checkHash(): void {
    const token = shareToken();
    if (token !== null) void this.openShared(token);
    else if (this.view?.kind === "shared") this.dialog.close();
  }

  private async openShared(token: string): Promise<void> {
    const view: Extract<View, { kind: "shared" }> = { kind: "shared", token };
    this.show(view, "Hunian yang dibagikan");
    this.body.innerHTML = "<p>Memuat hunian…</p>";
    try {
      const response = await fetch(sharedPath, {
        headers: { "X-Rental-Share": token },
      });
      if (!response.ok) throw new Error("Tautan hunian tidak tersedia.");
      const details: SharedRental = await response.json();
      if (!this.current(view)) return;
      view.details = details;
      this.renderShared(details);
    } catch (error) {
      if (!this.current(view)) return;
      this.body.replaceChildren();
      this.message(error);
    }
  }

  private renderShared({ rental, comments }: SharedRental): void {
    this.body.innerHTML = `<article class="saved-rental-public"><h3>${esc(rental.title)}</h3><p>${esc(rental.kind)} · ${esc(rental.locationText)}</p><p><strong>${esc(rentalPrice(rental))}</strong></p>${rentalLinks(rental)}<h4>Catatan</h4><p class="saved-note">${rental.note ? esc(rental.note) : "Belum ada catatan."}</p></article><section class="saved-comment-panel"><h4>Komentar</h4><ol data-shared-comments></ol>${
      rental.note
        ? getUser()
          ? `<form data-saved-comment><label>Tulis komentar<textarea name="text" rows="3" required maxlength="2000"></textarea></label><button type="submit" class="button primary">Kirim komentar</button></form>`
          : `<button type="button" class="button" data-saved-action="login">Masuk dengan Google untuk berkomentar</button>`
        : ""
    }</section>`;
    this.renderComments(comments);
  }

  private renderComments(comments: RentalComment[]): void {
    const list = this.body.querySelector("[data-shared-comments]");
    if (!list) return;
    list.innerHTML = comments.length
      ? comments
          .map(
            (comment) =>
              `<li><strong>${esc(comment.author)}</strong><p>${esc(comment.text)}</p></li>`,
          )
          .join("")
      : "<li>Belum ada komentar.</li>";
  }

  private async addComment(form: HTMLFormElement): Promise<void> {
    const view = this.view;
    const submit = form.querySelector<HTMLButtonElement>("button[type=submit]");
    if (view?.kind !== "shared" || !view.details || !submit || submit.disabled)
      return;
    const text = new FormData(form).get("text");
    const account = this.accountVersion;
    submit.disabled = true;
    try {
      const { comment } = await privateAPI<{ comment: RentalComment }>(
        `${sharedPath}/comments`,
        {
          method: "POST",
          headers: { "X-Rental-Share": view.token },
          body: JSON.stringify({ text }),
        },
      );
      if (!this.current(view) || account !== this.accountVersion) return;
      view.details.comments.push(comment);
      this.renderComments(view.details.comments);
      form.reset();
      this.message("Komentar terkirim.");
    } catch (error) {
      if (this.current(view) && account === this.accountVersion)
        this.message(error);
    } finally {
      submit.disabled = false;
    }
  }

  private record(rental: SavedRental): void {
    this.listVersion++;
    this.entries.set(rental.rentalId, rental);
  }

  private show(view: View, heading: string): void {
    this.view = view;
    this.heading.textContent = heading;
    this.feedback.textContent = "";
    if (!this.dialog.open) this.dialog.showModal();
  }

  private current(view: View): boolean {
    return this.dialog.open && this.view === view;
  }

  private message(value: unknown): void {
    this.feedback.textContent =
      value instanceof Error ? value.message : String(value);
  }
}
