import { escapeHTML as esc } from "./geo.ts";
import { icon } from "./icons.ts";
import { INCIDENT_LAYERS, type Incident, incidents } from "./incidents.ts";
import {
  areaReports,
  type LocationReport,
  reportScopes,
} from "./location-reports-data.ts";
import { googleMapsLocation } from "./maps-links.ts";
import { checkedDate, safeUrl } from "./research-data.ts";
import "./location-reports.css";

const points = new Map(incidents.map((incident) => [incident.id, incident]));
const reports = [
  ...areaReports,
  ...incidents.map<LocationReport>((incident) => ({
    ...incident,
    scope: "titik",
    summary: `${incident.summary} ${incident.precision}`,
    sources: [
      incident.source,
      ...(incident.followUp ? [incident.followUp] : []),
    ],
  })),
].sort((a, b) => b.date.localeCompare(a.date));

const unique = (values: string[]) => [...new Set(values)];
const years = unique(reports.map((report) => report.date.slice(0, 4)));
const regions = unique(reports.map((report) => report.region)).sort((a, b) =>
  a.localeCompare(b, "id-ID"),
);
const option = (value: string, label: string) =>
  `<option value="${esc(value)}">${esc(label)}</option>`;
const searchable = (value: string) =>
  value
    .toLocaleLowerCase("id-ID")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function reportCard(report: LocationReport): string {
  const point = points.get(report.id);
  const { label, color } = INCIDENT_LAYERS[report.kind];
  const date =
    report.date.length === 4 ? report.date : checkedDate(report.date);
  const dateLabel = report.basis ? `${report.basis} · ${date}` : date;
  const mapLink = point
    ? `<button type="button" class="button" data-report-point="${esc(report.id)}">${icon("pin")} Lihat pin di peta</button>`
    : `<a href="${esc(googleMapsLocation(report.place))}" target="_blank" rel="noopener noreferrer">Cari lokasi di Google Maps ↗</a>`;
  return `<article class="location-report" data-report="${esc(report.id)}"
      style="--report-color:${color}">
    <p class="location-report-meta"><strong>${label}</strong>
      <span>${esc(dateLabel)}</span><span>${reportScopes[report.scope]}</span></p>
    <h3>${esc(report.title)}</h3>
    <p class="location-report-place">${esc(report.place)}</p>
    <p>${esc(report.summary)}</p>
    <div class="location-report-links">
      ${report.sources
        .map(
          ({ label: source, url }) =>
            `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(source)} ↗</a>`,
        )
        .join("")}
      ${mapLink}
    </div>
  </article>`;
}

export function setupLocationReports(
  dialog: HTMLDialogElement,
  selectPoint: (incident: Incident) => void,
): (params?: URLSearchParams) => void {
  dialog.innerHTML = `<header class="location-reports-header">
    <div class="location-reports-title">
      <h2 id="location-reports-title">Berita lokasi</h2>
      <button class="icon-button" type="button" data-close="location-reports-dialog" aria-label="Tutup berita lokasi">${icon("close")}</button>
    </div>
    <form class="location-report-filters">
      <label class="location-report-search">Cari lokasi atau kata kunci
        <input type="search" name="lokasi" placeholder="Cipulir, Jatiasih, Harjamukti…" autocomplete="off" maxlength="100"/>
      </label>
      <label>Jenis berita
        <select name="berita">${option("", "Semua jenis")}${Object.entries(
          INCIDENT_LAYERS,
        )
          .map(([kind, layer]) => option(kind, layer.label))
          .join("")}</select>
      </label>
      <label>Wilayah berita
        <select name="wilayah">${option("", "Semua wilayah")}${regions.map((region) => option(region, region)).join("")}</select>
      </label>
      <label>Tahun laporan
        <select name="tahun">${option("", "Semua tahun")}${years.map((year) => option(year, year)).join("")}</select>
      </label>
      <label>Cakupan laporan
        <select name="cakupan">${option("", "Semua cakupan")}${Object.entries(
          reportScopes,
        )
          .map(([scope, label]) => option(scope, label))
          .join("")}</select>
      </label>
    </form>
    <p class="location-reports-count" role="status"></p>
  </header>
  <div class="location-reports-results" role="region" aria-label="Daftar laporan lokasi" tabindex="0"></div>`;
  const form = dialog.querySelector("form") as HTMLFormElement;
  const search = form.elements.namedItem("lokasi") as HTMLInputElement;
  const kind = form.elements.namedItem("berita") as HTMLSelectElement;
  const region = form.elements.namedItem("wilayah") as HTMLSelectElement;
  const year = form.elements.namedItem("tahun") as HTMLSelectElement;
  const scope = form.elements.namedItem("cakupan") as HTMLSelectElement;
  const count = dialog.querySelector(".location-reports-count") as HTMLElement;
  const results = dialog.querySelector(
    ".location-reports-results",
  ) as HTMLElement;

  function render(): void {
    const query = searchable(search.value);
    const matches = reports.filter((report) => {
      if (
        (kind.value && report.kind !== kind.value) ||
        (region.value && report.region !== region.value) ||
        (year.value && !report.date.startsWith(year.value)) ||
        (scope.value && report.scope !== scope.value)
      )
        return false;
      const fields = searchable(
        [
          report.title,
          report.place,
          report.region,
          report.summary,
          ...report.sources.map((source) => source.label),
        ].join(" "),
      );
      return fields.includes(query);
    });
    count.textContent = `${matches.length} dari ${reports.length} laporan`;
    results.innerHTML = matches.length
      ? matches.map(reportCard).join("")
      : '<p class="location-reports-empty">Belum ada laporan yang cocok dengan pencarian.</p>';
    results.scrollTop = 0;
  }

  form.onsubmit = (event) => event.preventDefault();
  form.oninput = render;
  results.onclick = (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-report-point]",
    );
    const report = points.get(button?.dataset.reportPoint ?? "");
    if (!report) return;
    dialog.close();
    selectPoint(report);
  };
  return (params) => {
    if (params) {
      search.value = (params.get("lokasi") ?? "").slice(0, 100);
      for (const select of [kind, region, year, scope]) {
        select.value = params.get(select.name) ?? "";
        if (select.selectedIndex < 0) select.value = "";
      }
    }
    render();
    if (!dialog.open) dialog.showModal();
  };
}
