import assert from "node:assert/strict";
import { test } from "node:test";
import calendar from "./fixtures/go-isso-calendar.json";
import detail from "./fixtures/go-isso-detail.json";
import { carletonSources, collectAllCarletonEvents } from "./collect-all";
import { createGoIssoSource, GO_ISSO_CALENDAR_URL, GO_ISSO_SOURCE_NAME, goIssoSource } from "./sources/go-isso";
import { parseCalendarEvent } from "./sources/wordpress-calendar";

const now = () => Date.parse("2026-10-01T00:00:00Z");
const sleep = async () => {};
const cafe = calendar.posts.find((item) => item.id === 44095)!;
const virtual = calendar.posts.find((item) => item.id === 44923)!;
const single = { pagination: { total: 1 }, posts: [cafe] };
const fetchFixture: typeof fetch = async (url) => Response.json(url === GO_ISSO_CALENDAR_URL ? single : detail);

test("GO-ISSO is registered and maps its verified calendar and description", async () => {
  assert.ok(carletonSources.includes(goIssoSource));
  const urls: string[] = [];
  const source = createGoIssoSource({ now, sleep, fetch: async (url) => {
    urls.push(String(url));
    return fetchFixture(url);
  } });
  const events = await source.collect();
  assert.equal(events.length, 1);
  assert.deepEqual({ ...events[0], description: null }, {
    title: "Global Café", description: null,
    startTime: "2026-10-13T17:30:00.000Z", endTime: "2026-10-13T19:30:00.000Z",
    building: "MacOdrum Library", room: "TBD",
    sourceName: GO_ISSO_SOURCE_NAME, sourceUrl: cafe.link,
  });
  assert.match(events[0].description!, /engaging activities and warm drinks/);
  assert.doesNotMatch(events[0].description!, /<[^>]+>|Email|registration script/);
  assert.deepEqual(urls, [GO_ISSO_CALENDAR_URL, "https://carleton.ca/go-isso/wp-json/wp/v2/cu_event/44095?_fields=id,content"]);
});

test("GO-ISSO virtual events have no physical location", () => {
  const { event } = parseCalendarEvent(virtual, GO_ISSO_SOURCE_NAME);
  assert.equal(event.building, null);
  assert.equal(event.room, null);
  assert.equal(event.startTime, "2026-10-13T15:00:00.000Z");
});

test("GO-ISSO filters ended events before fetching details", async () => {
  const source = createGoIssoSource({ now: () => Date.parse("2026-10-14T00:00:00Z"), sleep, fetch: async (url) => {
    assert.equal(url, GO_ISSO_CALENDAR_URL);
    return Response.json(calendar);
  } });
  assert.deepEqual(await source.collect(), []);
});

test("GO-ISSO retries failed details and preserves healthy events", async (t) => {
  t.mock.method(console, "warn", () => {});
  const delays: number[] = [];
  let failures = 0;
  const source = createGoIssoSource({ now, sleep: async (ms) => { delays.push(ms); }, fetch: async (url) => {
    if (url === GO_ISSO_CALENDAR_URL) return Response.json(calendar);
    if (String(url).includes("/44923?")) { failures++; return new Response(null, { status: 503 }); }
    return Response.json(detail);
  } });
  assert.equal((await source.collect())[0].title, "Global Café");
  assert.equal(failures, 3);
  assert.deepEqual(delays, [2000, 4000]);
});

test("GO-ISSO duplicate matching keeps other source URLs and separate occurrences", async (t) => {
  t.mock.method(console, "log", () => {});
  const prior = { ...parseCalendarEvent(cafe, "Carleton Current Students").event, sourceUrl: "https://students.carleton.ca/events/global-cafe/", startTime: "2026-10-13T13:30:00-04:00" };
  const later = { ...prior, startTime: "2026-10-27T13:30:00-04:00", sourceUrl: "https://students.carleton.ca/events/global-cafe-next/" };
  const events = await collectAllCarletonEvents([
    { name: prior.sourceName, collect: async () => [prior, later] },
    createGoIssoSource({ now, sleep, fetch: fetchFixture }),
  ]);
  assert.deepEqual(events, [prior, later]);
});
