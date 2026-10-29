import type { GeoJSONSource, Map as MapInstance, Marker } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { escapeHTML, money } from "./geo.ts";
import type { Area, Listing } from "./types.ts";

// MapLibre 6 requires an explicit bundled worker URL with Vite.
maplibregl.setWorkerUrl(workerUrl);

export const AREA_COLORS: Record<Area, string> = {
  Jakarta: "#ca8150",
  Bogor: "#4c8772",
  Depok: "#9b78a1",
  Tangerang: "#8d994b",
  Bekasi: "#5b8fa7",
};

export class HousingMap {
  map: MapInstance;
  markers: Marker[] = [];
  ready: Promise<void>;
  constructor(
    regions: GeoJSON.FeatureCollection,
    transit: GeoJSON.FeatureCollection,
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
          'Wilayah: <a href="https://gitlab.com/adenaufal/nafkah" target="_blank" rel="noopener">Nafkah · HDX</a> · KRL: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>',
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
      container.setAttribute("aria-busy", "false");
    });
    this.ready = new Promise((resolve) =>
      this.map.once("load", () => {
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
        this.map.addSource("transit", { type: "geojson", data: transit });
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
        this.map.on("click", "region-fill", (event) => {
          if (
            this.map.queryRenderedFeatures(event.point, {
              layers: ["stations"],
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
        this.map.addSource("basemap", {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution:
            '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
        });
        this.map.addLayer(
          {
            id: "basemap",
            type: "raster",
            source: "basemap",
            paint: { "raster-opacity": 0.8, "raster-saturation": -0.7 },
          },
          "region-fill",
        );
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

  async showBasemap(visible: boolean): Promise<void> {
    await this.ready;
    this.map.setLayoutProperty(
      "basemap",
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
