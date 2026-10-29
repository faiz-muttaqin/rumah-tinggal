import type {
  FilterSpecification,
  LayerSpecification,
  VectorSourceSpecification,
} from "maplibre-gl";

// An original, compact style using the public OpenMapTiles schema. Roads and
// buildings are separate vector layers, so hiding buildings preserves streets.
export const BASEMAP_GLYPHS =
  "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

export const BASEMAP_SOURCE: VectorSourceSpecification = {
  type: "vector",
  url: "https://tiles.openfreemap.org/planet",
  attribution:
    '<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://openmaptiles.org/">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
};

const roadFilter: FilterSpecification = [
  "all",
  ["==", ["geometry-type"], "LineString"],
  [
    "!",
    [
      "match",
      ["get", "class"],
      ["rail", "transit", "ferry", "aerialway"],
      true,
      false,
    ],
  ],
];

export const BASEMAP_LAYERS: LayerSpecification[] = [
  {
    id: "basemap-landcover",
    type: "fill",
    source: "basemap",
    "source-layer": "landcover",
    paint: { "fill-color": "#dce6d4", "fill-opacity": 0.55 },
  },
  {
    id: "basemap-water",
    type: "fill",
    source: "basemap",
    "source-layer": "water",
    paint: { "fill-color": "#b9d7dd" },
  },
  {
    id: "basemap-waterways",
    type: "line",
    source: "basemap",
    "source-layer": "waterway",
    paint: {
      "line-color": "#a8cbd3",
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 16, 3],
    },
  },
  {
    id: "basemap-buildings",
    type: "fill",
    source: "basemap",
    "source-layer": "building",
    minzoom: 12,
    layout: { visibility: "none" },
    paint: {
      "fill-color": "#d1d2c8",
      "fill-outline-color": "#babeb1",
      "fill-opacity": 0.8,
    },
  },
  {
    id: "basemap-road-casing",
    type: "line",
    source: "basemap",
    "source-layer": "transportation",
    filter: roadFilter,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#c4c8ba",
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        1.2,
        12,
        3,
        16,
        9,
        18,
        20,
      ],
    },
  },
  {
    id: "basemap-roads",
    type: "line",
    source: "basemap",
    "source-layer": "transportation",
    filter: roadFilter,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": [
        "match",
        ["get", "class"],
        ["motorway", "trunk"],
        "#eed2a0",
        ["primary", "secondary"],
        "#fff1d2",
        "#fffef8",
      ],
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        0.6,
        12,
        1.8,
        16,
        7,
        18,
        17,
      ],
    },
  },
  {
    id: "basemap-road-labels",
    type: "symbol",
    source: "basemap",
    "source-layer": "transportation_name",
    minzoom: 13,
    layout: {
      "symbol-placement": "line",
      "text-field": ["coalesce", ["get", "name"], ["get", "ref"], ""],
      "text-font": ["Noto Sans Regular"],
      "text-size": 11,
      "text-max-angle": 30,
    },
    paint: {
      "text-color": "#536353",
      "text-halo-color": "#fffef8",
      "text-halo-width": 2,
    },
  },
  {
    id: "basemap-place-labels",
    type: "symbol",
    source: "basemap",
    "source-layer": "place",
    filter: [
      "match",
      ["get", "class"],
      ["city", "town", "village", "suburb", "neighbourhood"],
      true,
      false,
    ],
    layout: {
      "text-field": ["coalesce", ["get", "name"], ""],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 14, 14],
      "text-max-width": 8,
    },
    paint: {
      "text-color": "#485d4e",
      "text-halo-color": "#fffef8",
      "text-halo-width": 2,
    },
  },
];
