import assert from "node:assert/strict";
import test from "node:test";
import {
  currentMosqueEvents,
  mappedMosques,
  mosquePopupHTML,
  mosqueScheduleHTML,
  nearestMosqueStops,
} from "../src/mosques.ts";
import type { MosqueEvent, ResearchMosques } from "../src/research-data.ts";
import type { Station } from "../src/types.ts";
import { researchFixture } from "../tests/research-fixture.ts";

const context = researchFixture.metadata.mosques as unknown as ResearchMosques;
const mosque = context.items[0];
const event = (startsAt: string, cancelled = false): MosqueEvent => ({
  startsAt,
  cancelled,
  timeLabel: "sekitar 09.30",
  regular: false,
  topic: "fiqih",
});

test("mosque schedules follow the WIB calendar and retain cancellations without inventing recurrence", () => {
  const events = [
    event("2026-11-02T09:30:00+07:00", true),
    event("2026-11-01T09:30:00+07:00"),
    event("2026-11-03T09:30:00+07:00"),
  ];
  assert.deepEqual(
    currentMosqueEvents(events, new Date("2026-11-01T17:01:00Z")),
    [events[0], events[2]],
  );
  assert.deepEqual(
    currentMosqueEvents(events, new Date("2026-11-01T16:59:00Z")),
    [events[1], events[0], events[2]],
  );
  const copy = JSON.stringify(events);
  currentMosqueEvents(events, new Date("2026-12-01T00:00:00Z"));
  assert.equal(JSON.stringify(events), copy);
});

test("mosque map keeps out-of-coverage and invalid pins in the directory and computes each transit mode independently", () => {
  assert.deepEqual(
    mappedMosques([
      ...context.items,
      { ...mosque, lat: Number.NaN },
      { ...mosque, lng: 108 },
    ]),
    [mosque],
  );
  const stop = (mode: string, lat: number): Station => ({
    id: `${mode}-${lat}`,
    name: `Titik ${mode}`,
    mode,
    lat,
    lng: mosque.lng,
    lines: [],
  });
  const closest = stop("KRL", mosque.lat + 0.001);
  const stops = [
    stop("KRL", mosque.lat + 0.1),
    closest,
    stop("LRT", mosque.lat + 0.002),
    stop("TransJakarta", mosque.lat + 0.003),
  ];
  const result = nearestMosqueStops(mosque, stops);
  assert.deepEqual(
    result.map((item) => item.mode),
    ["KRL", "LRT", "TransJakarta"],
  );
  assert.equal(result[0].station, closest);
  assert.ok(result[0].distance > 0.11 && result[0].distance < 0.112);
  assert.deepEqual(nearestMosqueStops(mosque, []), []);
});

test("mosque schedule fallback distinguishes missing details from expired dates and preserves approximate time and cancellation", () => {
  assert.match(
    mosqueScheduleHTML({ ...mosque, profile: null }),
    /belum tersalin/,
  );
  const profile = context.items[1].profile;
  assert.ok(profile);
  const withEvents = (events: MosqueEvent[]) => ({
    ...mosque,
    profile: { ...profile, events },
  });
  assert.match(
    mosqueScheduleHTML(withEvents([event("2000-01-01T09:30:00+07:00")])),
    /sudah lewat/,
  );
  const html = mosqueScheduleHTML(
    withEvents([event("2099-01-01T09:30:00+07:00", true)]),
  );
  assert.match(html, /sekitar 09.30 WIB/);
  assert.match(html, /Dibatalkan/);
  assert.doesNotMatch(html, /rutin/);
});

test("mosque popup escapes source text, links to the right point and does not turn sale leads into rental proximity", () => {
  const unsafe = {
    ...mosque,
    name: '<img src=x onerror="alert(1)">',
    sourceUrl: "javascript:alert(1)",
    relatedListings: [
      ...mosque.relatedListings,
      {
        id: "sale-lead",
        title: "Petunjuk jual",
        kind: "lead" as const,
        relation: "kawasan",
        note: "belum diukur",
      },
      {
        id: "rent-lead",
        title: "Petunjuk sewa",
        kind: "lead" as const,
        relation: "kawasan",
        note: "belum diukur",
      },
    ],
  };
  const stop: Station = {
    id: "krl",
    name: "KRL Uji",
    mode: "KRL",
    lines: [],
    lat: -6.257,
    lng: 107.03,
  };
  const html = mosquePopupHTML(unsafe, context, [stop], undefined, [
    "rent-lead",
  ]);
  assert.doesNotMatch(html, /<img|javascript:|Petunjuk jual/);
  assert.match(html, /&lt;img/);
  assert.match(html, /Petunjuk sewa/);
  assert.match(html, /Kontrakan Keluarga Uji/);
  assert.match(html, /Jarak dari unit belum dihitung/);
  assert.match(html, /31 Okt 2026/);
  const href = html.match(/href="([^"]+)"[^>]*>KRL/);
  assert.ok(href);
  const route = new URL(href[1].replaceAll("&amp;", "&"));
  assert.equal(route.searchParams.get("origin"), `${mosque.lat},${mosque.lng}`);
  assert.equal(
    route.searchParams.get("destination"),
    `${stop.lat},${stop.lng}`,
  );
  assert.equal(route.searchParams.get("travelmode"), "walking");
});
