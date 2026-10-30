import type {
  FilterSpecification,
  GeoJSONSource,
  Map as MapInstance,
  Marker,
  Popup,
} from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { BASEMAP_GLYPHS, BASEMAP_LAYERS, BASEMAP_SOURCE } from "./basemap.ts";
import { escapeHTML, money } from "./geo.ts";
import { googleMapsLocation } from "./maps-links.ts";
import { PIN_STYLES, pinIcon } from "./pins.ts";
import type { Area, Listing, Pin, Place } from "./types.ts";

// MapLibre 6 requires an explicit bundled worker URL with Vite.
maplibregl.setWorkerUrl(workerUrl);

export const AREA_COLORS: Record<Area, string> = {
  Jakarta: "#ca8150",
  Bogor: "#4c8772",
  Depok: "#9b78a1",
  Tangerang: "#8d994b",
  Bekasi: "#5b8fa7",
};

export type TransitMode = "MRT" | "LRT" | "TransJakarta";

const MOBILITY_LAYERS = {
  TransJakarta: { prefix: "tj", color: "#2477a8", visibility: "none" },
  MRT: { prefix: "mrt", color: "#0076bd", visibility: "visible" },
  LRT: { prefix: "lrt", color: "#bb3f75", visibility: "visible" },
} as const;

const MOBILITY_MODES = ["TransJakarta", "MRT", "LRT"] as const;

// Masjid dan sekolah dari lapisan poi OpenMapTiles (data OSM), hanya ada
// pada tile zoom 14, sehingga tampil sebagai fasilitas sekitar saat diperbesar.
const COMMUNITY_FILTER: FilterSpecification = [
  "any",
  [
    "all",
    ["==", ["get", "class"], "place_of_worship"],
    ["==", ["get", "subclass"], "muslim"],
  ],
  [
    "all",
    ["==", ["get", "class"], "school"],
    ["match", ["get", "subclass"], ["school", "kindergarten"], true, false],
  ],
];
const COMMUNITY_LAYERS = ["community-icons", "community-labels"];

// Gambar ikon secara sinkron agar simbol langsung tersedia saat tile dimuat.
function communityIcon(category: "masjid" | "sekolah"): ImageData {
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d") as CanvasRenderingContext2D;
  context.fillStyle = PIN_STYLES[category].color;
  context.strokeStyle = "white";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.translate(10, 10);
  context.scale(28 / 24, 28 / 24);
  context.lineWidth = 2.2;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const [, path] of PIN_STYLES[category].icon.matchAll(/ d="([^"]+)"/g))
    context.stroke(new Path2D(path));
  return context.getImageData(0, 0, size, size);
}

export class HousingMap {
  map: MapInstance;
  markers: Marker[] = [];
  pinMarkers: Marker[] = [];
  ready: Promise<void>;
  private mobilityPopup?: Popup;
  private mobilityPopupMode?: TransitMode;
  private placePopup?: Popup;
  private pinPopup?: Popup;
  onPinPlace?: (place: Place) => void;
  constructor(
    regions: GeoJSON.FeatureCollection,
    transitKRL: GeoJSON.FeatureCollection,
    mobility: GeoJSON.FeatureCollection,
    onArea: (area: string) => void,
    onPoint: (lng: number, lat: number) => void,
  ) {
    this.map = new maplibregl.Map({
      container: "map",
      center: [106.82, -6.34],
      zoom: 9.45,
      minZoom: 8.2,
      maxZoom: 18,
      maxBounds: [
        [106.19, -6.94],
        [107.43, -5.72],
      ],
      style: {
        version: 8,
        glyphs: BASEMAP_GLYPHS,
        sources: {},
        layers: [
          {
            id: "paper",
            type: "background",
            paint: { "background-color": "#e9eee7" },
          },
        ],
      },
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    this.map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    this.map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution:
          'Wilayah: <a href="https://gitlab.com/adenaufal/nafkah" target="_blank" rel="noopener">Nafkah · HDX</a> · Transportasi: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>',
      }),
      "bottom-right",
    );
    this.map.on("error", (event) => {
      console.warn("Peta:", event.error.message);
      document.getElementById("map-status")?.classList.add("visible");
    });
    this.map.on("idle", () => {
      if (!this.map.getLayer("stations")) return;
      const container = this.map.getContainer();
      const regionsCount = this.map.queryRenderedFeatures({
        layers: ["region-fill"],
      }).length;
      const stationsCount = this.map.queryRenderedFeatures({
        layers: ["stations"],
      }).length;
      container.dataset.regionFeatures = String(regionsCount);
      container.dataset.stationFeatures = String(stationsCount);
      for (const mode of MOBILITY_MODES) {
        const { prefix } = MOBILITY_LAYERS[mode];
        container.dataset[`${prefix}Features`] = String(
          this.map.queryRenderedFeatures({ layers: [`${prefix}-stations`] })
            .length,
        );
        container.dataset[`${prefix}LineFeatures`] = String(
          this.map.queryRenderedFeatures({ layers: [`${prefix}-lines`] })
            .length,
        );
      }
      if (this.map.getLayer("planned-stations"))
        container.dataset.plannedFeatures = String(
          this.map.queryRenderedFeatures({ layers: ["planned-stations"] })
            .length,
        );
      container.dataset.roadFeatures = String(
        this.map.queryRenderedFeatures({ layers: ["basemap-roads"] }).length,
      );
      container.dataset.communityFeatures = String(
        this.map.queryRenderedFeatures({ layers: ["community-icons"] }).length,
      );
      container.dataset.buildingFeatures = String(
        this.map.queryRenderedFeatures({ layers: ["basemap-buildings"] })
          .length,
      );
      container.setAttribute("aria-busy", "false");
    });
    this.ready = new Promise((resolve) =>
      this.map.once("load", () => {
        this.map.addSource("basemap", BASEMAP_SOURCE);
        for (const layer of BASEMAP_LAYERS) this.map.addLayer(layer);
        this.map.addSource("regions", { type: "geojson", data: regions });
        this.map.addLayer({
          id: "region-fill",
          type: "fill",
          source: "regions",
          paint: {
            "fill-color": [
              "match",
              ["get", "area"],
              "Jakarta",
              AREA_COLORS.Jakarta,
              "Bogor",
              AREA_COLORS.Bogor,
              "Depok",
              AREA_COLORS.Depok,
              "Tangerang",
              AREA_COLORS.Tangerang,
              "Bekasi",
              AREA_COLORS.Bekasi,
              "#829483",
            ],
            "fill-opacity": 0.14,
          },
        });
        this.map.addLayer({
          id: "region-border",
          type: "line",
          source: "regions",
          paint: {
            "line-color": "#81917e",
            "line-width": 1,
            "line-opacity": 0.65,
            "line-dasharray": [3, 2],
          },
        });
        this.map.addSource("mobility", { type: "geojson", data: mobility });
        // TransJakarta is added first so its stops and lines stay below rail.
        for (const mode of MOBILITY_MODES) {
          const { prefix, color, visibility } = MOBILITY_LAYERS[mode];
          this.map.addLayer({
            id: `${prefix}-casing`,
            type: "line",
            source: "mobility",
            filter: [
              "all",
              ["==", ["get", "mode"], mode],
              ["==", ["geometry-type"], "LineString"],
            ],
            layout: { visibility },
            paint: {
              "line-color": "#fffef7",
              "line-width": ["interpolate", ["linear"], ["zoom"], 9, 4, 14, 8],
              "line-opacity": 0.85,
            },
          });
          this.map.addLayer({
            id: `${prefix}-lines`,
            type: "line",
            source: "mobility",
            filter: [
              "all",
              ["==", ["get", "mode"], mode],
              ["==", ["geometry-type"], "LineString"],
            ],
            layout: { visibility },
            paint: {
              "line-color": ["to-color", ["get", "color"], color],
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                9,
                mode === "TransJakarta" ? 1.5 : 2.5,
                14,
                mode === "TransJakarta" ? 3 : 4.5,
              ],
              "line-opacity": 0.9,
            },
          });
          this.map.addLayer({
            id: `${prefix}-stations`,
            type: "circle",
            source: "mobility",
            filter: [
              "all",
              ["==", ["get", "mode"], mode],
              ["==", ["geometry-type"], "Point"],
            ],
            layout: { visibility },
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                9,
                mode === "TransJakarta" ? 2 : 3,
                14,
                mode === "TransJakarta" ? 4.5 : 6,
              ],
              "circle-color": "#fffef7",
              "circle-stroke-color": ["to-color", ["get", "color"], color],
              "circle-stroke-width": 1.5,
            },
          });
        }
        this.map.addSource("transit", { type: "geojson", data: transitKRL });
        this.map.addLayer({
          id: "rail-casing",
          type: "line",
          source: "transit",
          filter: ["!=", ["geometry-type"], "Point"],
          paint: {
            "line-color": "#fffef7",
            "line-width": ["interpolate", ["linear"], ["zoom"], 9, 4, 14, 8],
            "line-opacity": 0.9,
          },
        });
        this.map.addLayer({
          id: "rail-lines",
          type: "line",
          source: "transit",
          filter: ["!=", ["geometry-type"], "Point"],
          paint: {
            "line-color": ["coalesce", ["get", "color"], "#a7453c"],
            "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2, 14, 4],
          },
        });
        this.map.addLayer({
          id: "stations",
          type: "circle",
          source: "transit",
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              9,
              2.5,
              14,
              6,
            ],
            "circle-color": "#fffef7",
            "circle-stroke-color": "#486157",
            "circle-stroke-width": 1.3,
          },
        });
        for (const category of ["masjid", "sekolah"] as const)
          this.map.addImage(`community-${category}`, communityIcon(category), {
            pixelRatio: 2,
          });
        this.map.addLayer({
          id: "community-icons",
          type: "symbol",
          source: "basemap",
          "source-layer": "poi",
          minzoom: 14,
          filter: COMMUNITY_FILTER,
          layout: {
            "icon-image": [
              "case",
              ["==", ["get", "class"], "school"],
              "community-sekolah",
              "community-masjid",
            ],
            "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.8, 17, 1],
            "icon-allow-overlap": true,
          },
        });
        // Label terpisah: jika glyph gagal dimuat, ikon tetap tampil.
        this.map.addLayer({
          id: "community-labels",
          type: "symbol",
          source: "basemap",
          "source-layer": "poi",
          minzoom: 15.5,
          filter: COMMUNITY_FILTER,
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["Noto Sans Regular"],
            "text-size": 10,
            "text-offset": [0, 1.3],
            "text-anchor": "top",
            "text-max-width": 9,
            "text-optional": true,
          },
          paint: {
            "text-color": "#33443a",
            "text-halo-color": "#fffef9",
            "text-halo-width": 1.4,
          },
        });
        this.map.on("click", "community-icons", (event) => {
          const feature = event.features?.[0];
          if (feature?.geometry.type !== "Point") return;
          const [lng, lat] = feature.geometry.coordinates;
          if (typeof lng !== "number" || typeof lat !== "number") return;
          const school = feature.properties.class === "school";
          const kind = school
            ? feature.properties.subclass === "kindergarten"
              ? "TK / PAUD"
              : "Sekolah"
            : "Masjid / musala";
          this.openPlacePopup({
            id: String(feature.id ?? ""),
            name: String(feature.properties.name || kind),
            detail: "OpenStreetMap",
            kind,
            lat,
            lng,
          });
        });
        this.map.on("mouseenter", "community-icons", () => {
          this.map.getCanvas().style.cursor = "pointer";
        });
        this.map.on("mouseleave", "community-icons", () => {
          this.map.getCanvas().style.cursor = "";
        });
        this.map.addSource("focus", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        this.map.addLayer({
          id: "focus-point",
          type: "circle",
          source: "focus",
          paint: {
            "circle-radius": 11,
            "circle-color": "#174f43",
            "circle-opacity": 0.25,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#174f43",
          },
        });
        this.map.on("click", "stations", (event) => {
          const feature = event.features?.[0];
          if (feature?.geometry.type !== "Point") return;
          new maplibregl.Popup({ closeButton: true })
            .setLngLat(feature.geometry.coordinates as [number, number])
            .setHTML(
              `<strong>Stasiun ${escapeHTML(feature.properties.name)}</strong><p>KRL · Data spasial OpenStreetMap</p>`,
            )
            .addTo(this.map);
        });
        for (const mode of MOBILITY_MODES) {
          const layer = `${MOBILITY_LAYERS[mode].prefix}-stations`;
          this.map.on("click", layer, (event) => {
            const feature = event.features?.[0];
            if (feature?.geometry.type !== "Point") return;
            const [lng, lat] = feature.geometry.coordinates;
            if (
              typeof lng !== "number" ||
              typeof lat !== "number" ||
              !Number.isFinite(lng) ||
              !Number.isFinite(lat)
            )
              return;
            const name = String(feature.properties.name ?? mode);
            const network = feature.properties.network;
            const networkLabel =
              typeof network === "string" && network && network !== mode
                ? ` · ${escapeHTML(network)}`
                : "";
            this.mobilityPopup?.remove();
            const popup = new maplibregl.Popup({ closeButton: true })
              .setLngLat([lng, lat])
              .setHTML(
                `<strong>${escapeHTML(name)}</strong><p>${escapeHTML(mode)}${networkLabel}</p><p>${lat.toFixed(5)}, ${lng.toFixed(5)}</p><a href="${escapeHTML(googleMapsLocation({ lat, lng }))}" target="_blank" rel="noopener noreferrer">Buka Google Maps ↗</a>`,
              );
            this.mobilityPopup = popup;
            this.mobilityPopupMode = mode;
            popup.on("close", () => {
              if (this.mobilityPopup === popup) {
                this.mobilityPopup = undefined;
                this.mobilityPopupMode = undefined;
              }
            });
            popup.addTo(this.map);
          });
          this.map.on("mouseenter", layer, () => {
            this.map.getCanvas().style.cursor = "pointer";
          });
          this.map.on("mouseleave", layer, () => {
            this.map.getCanvas().style.cursor = "";
          });
        }
        this.map.on("click", "region-fill", (event) => {
          if (
            this.map.queryRenderedFeatures(event.point, {
              layers: [
                "stations",
                "community-icons",
                ...MOBILITY_MODES.map(
                  (mode) => `${MOBILITY_LAYERS[mode].prefix}-stations`,
                ),
              ],
            }).length
          )
            return;
          const area = event.features?.[0]?.properties.area;
          if (area) onArea(area);
        });
        this.map.on("click", (event) =>
          onPoint(event.lngLat.lng, event.lngLat.lat),
        );
        this.map.on("mouseenter", "stations", () => {
          this.map.getCanvas().style.cursor = "pointer";
        });
        this.map.on("mouseleave", "stations", () => {
          this.map.getCanvas().style.cursor = "";
        });
        resolve();
      }),
    );
  }

  async update(
    listings: Listing[],
    selectedId: string | undefined,
    onSelect: (listing: Listing) => void,
  ): Promise<void> {
    await this.ready;
    for (const marker of this.markers) marker.remove();
    this.markers = listings.map((listing) => {
      const button = document.createElement("button");
      button.className = `price-pin ${selectedId === listing.id ? "selected" : ""}`;
      button.textContent = money(listing.price);
      button.setAttribute(
        "aria-label",
        `${listing.title}, ${money(listing.price)}`,
      );
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelect(listing);
      });
      return new maplibregl.Marker({
        element: button,
        anchor: "bottom",
        offset: [0, -5],
      })
        .setLngLat([listing.lng, listing.lat])
        .addTo(this.map);
    });
  }

  async focus(lng: number, lat: number, zoom = 13): Promise<void> {
    await this.ready;
    (this.map.getSource("focus") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [lng, lat] },
        },
      ],
    });
    this.map.flyTo({
      center: [lng, lat],
      zoom,
      duration: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 650,
    });
  }

  async showPlace(place: Place): Promise<void> {
    await this.focus(place.lng, place.lat, 16);
    this.openPlacePopup(place);
  }

  private openPlacePopup(place: Place): void {
    const onPin = this.onPinPlace && (() => this.onPinPlace?.(place));
    this.placePopup?.remove();
    const detail = [place.kind, place.detail].filter(Boolean).join(" · ");
    const content = document.createElement("div");
    content.innerHTML = `<strong>${escapeHTML(place.name)}</strong>${detail ? `<p>${escapeHTML(detail)}</p>` : ""}<p>${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}</p><a href="${escapeHTML(googleMapsLocation(place))}" target="_blank" rel="noopener noreferrer">Buka Google Maps ↗</a>${onPin ? '<button type="button" class="popup-action" data-pin-place>📍 Simpan sebagai pin</button>' : ""}`;
    content
      .querySelector<HTMLButtonElement>("[data-pin-place]")
      ?.addEventListener("click", () => {
        this.placePopup?.remove();
        onPin?.();
      });
    this.placePopup = new maplibregl.Popup({ closeButton: true })
      .setLngLat([place.lng, place.lat])
      .setDOMContent(content)
      .addTo(this.map);
  }

  async updatePins(
    pins: Pin[],
    popupContent: (pin: Pin, close: () => void) => HTMLElement,
  ): Promise<void> {
    await this.ready;
    for (const marker of this.pinMarkers) marker.remove();
    this.pinPopup?.remove();
    this.pinMarkers = pins.map((pin) => {
      const element = document.createElement("button");
      element.className = "pin-marker";
      element.dataset.pinId = pin.id;
      element.style.setProperty("--pin", PIN_STYLES[pin.category].color);
      element.innerHTML = pinIcon(pin.category, 15);
      element.setAttribute(
        "aria-label",
        `${PIN_STYLES[pin.category].label}: ${pin.name}`,
      );
      element.addEventListener("click", (event) => {
        // Hentikan agar klik pin tidak memilih wilayah di bawahnya.
        event.stopPropagation();
        this.openPinPopup(pin, popupContent);
      });
      return new maplibregl.Marker({ element, anchor: "bottom" })
        .setLngLat([pin.lng, pin.lat])
        .addTo(this.map);
    });
  }

  openPinPopup(
    pin: Pin,
    popupContent: (pin: Pin, close: () => void) => HTMLElement,
  ): void {
    this.pinPopup?.remove();
    const popup = new maplibregl.Popup({ closeButton: true, offset: 30 });
    popup
      .setLngLat([pin.lng, pin.lat])
      .setDOMContent(popupContent(pin, () => popup.remove()))
      .addTo(this.map);
    this.pinPopup = popup;
  }

  async openPin(
    pin: Pin,
    popupContent: (pin: Pin, close: () => void) => HTMLElement,
  ): Promise<void> {
    await this.ready;
    this.map.flyTo({
      center: [pin.lng, pin.lat],
      zoom: Math.max(this.map.getZoom(), 15),
      duration: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 650,
    });
    this.openPinPopup(pin, popupContent);
  }

  async clearFocus(): Promise<void> {
    await this.ready;
    (this.map.getSource("focus") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [],
    });
  }

  async showArea(area: string): Promise<void> {
    await this.ready;
    this.map.setPaintProperty(
      "region-fill",
      "fill-opacity",
      area === "Semua"
        ? 0.14
        : ["case", ["==", ["get", "area"], area], 0.28, 0.04],
    );
    const centers: Record<string, [number, number]> = {
      Jakarta: [106.84, -6.2],
      Bogor: [106.78, -6.52],
      Depok: [106.82, -6.39],
      Tangerang: [106.65, -6.27],
      Bekasi: [107.06, -6.29],
    };
    if (area === "Semua") this.reset();
    else this.map.flyTo({ center: centers[area], zoom: 10.5, duration: 500 });
  }

  async showRail(visible: boolean): Promise<void> {
    await this.ready;
    for (const id of ["rail-lines", "rail-casing", "stations"])
      this.map.setLayoutProperty(
        id,
        "visibility",
        visible ? "visible" : "none",
      );
  }

  async showTransit(mode: TransitMode, visible: boolean): Promise<void> {
    await this.ready;
    const { prefix } = MOBILITY_LAYERS[mode];
    for (const suffix of ["casing", "lines", "stations"])
      this.map.setLayoutProperty(
        `${prefix}-${suffix}`,
        "visibility",
        visible ? "visible" : "none",
      );
    if (!visible && this.mobilityPopupMode === mode) {
      this.mobilityPopup?.remove();
      this.mobilityPopup = undefined;
      this.mobilityPopupMode = undefined;
    }
  }

  // Stasiun rencana LRT/KRL: lingkaran berongga, hanya saat koleksi Riset aktif.
  async showPlanned(
    points: GeoJSON.FeatureCollection,
    visible: boolean,
  ): Promise<void> {
    await this.ready;
    const source = this.map.getSource("planned") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (source) source.setData(points);
    else {
      this.map.addSource("planned", { type: "geojson", data: points });
      this.map.addLayer({
        id: "planned-stations",
        type: "circle",
        source: "planned",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 3, 14, 7],
          "circle-color": "#fffef7",
          "circle-opacity": 0.6,
          "circle-stroke-color": [
            "match",
            ["get", "mode"],
            "LRT",
            MOBILITY_LAYERS.LRT.color,
            "MRT",
            MOBILITY_LAYERS.MRT.color,
            "#486157",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-opacity": 0.9,
        },
      });
      this.map.addLayer({
        id: "planned-labels",
        type: "symbol",
        source: "planned",
        minzoom: 12,
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 10,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-optional": true,
        },
        paint: {
          "text-color": "#4d5c52",
          "text-halo-color": "#fffef7",
          "text-halo-width": 1.2,
        },
      });
    }
    for (const id of ["planned-stations", "planned-labels"])
      this.map.setLayoutProperty(
        id,
        "visibility",
        visible ? "visible" : "none",
      );
  }

  async showCommunity(visible: boolean): Promise<void> {
    await this.ready;
    for (const layer of COMMUNITY_LAYERS)
      this.map.setLayoutProperty(
        layer,
        "visibility",
        visible ? "visible" : "none",
      );
    if (!visible) this.placePopup?.remove();
  }

  async showBuildings(visible: boolean): Promise<void> {
    await this.ready;
    this.map.setLayoutProperty(
      "basemap-buildings",
      "visibility",
      visible ? "visible" : "none",
    );
  }

  reset(): void {
    this.map.flyTo({ center: [106.82, -6.34], zoom: 9.45, duration: 500 });
  }
  resize(): void {
    this.map.resize();
  }
}
