import assert from "node:assert/strict";
import { test } from "node:test";
import fixture from "./fixtures/engineering-calendar.json";
import { createEngineeringDesignSource, ENGINEERING_CALENDAR_URL, parseEngineeringCalendarEvent, parseEngineeringDescription, parseTorontoDateTime } from "./sources/engineering-design";
import { deduplicateCarletonEvents, isCrossSourceDuplicate } from "../deduplication";

const item = fixture.posts[0];
const parsed = parseEngineeringCalendarEvent(item).event;

test("public calendar fixture maps structured fields and Toronto times", () => {
  assert.deepEqual(parsed, {
    title: "FED Pride: Meet and Treat", description: null,
    startTime: "2026-10-14T15:30:00.000Z", endTime: "2026-10-14T17:30:00.000Z",
    building: "Mackenzie", room: "EDC Atrium",
    sourceName: "Carleton Faculty of Engineering and Design", sourceUrl: item.link,
  });
  assert.equal(parseTorontoDateTime("2026-01-14 11:30:00"), "2026-01-14T16:30:00.000Z");
  for (const value of ["2026-03-08 02:30:00", "2026-11-01 01:30:00", "2026-02-30 10:00:00", null]) {
    assert.throws(() => parseTorontoDateTime(value));
  }
  const virtual = parseEngineeringCalendarEvent({ ...item, cu_event_location_type: { value: "virtual" }, cu_event_end_date: "" }).event;
  assert.equal(virtual.building, null);
  assert.equal(virtual.room, null);
  assert.equal(virtual.endTime, null);
  const offsite = parseEngineeringCalendarEvent({ ...item, cu_event_meeting_address_type: { value: "off-campus" }, cu_event_meeting_address_full: "123 Main Street" }).event;
  assert.equal(offsite.building, "123 Main Street");
});

test("REST description becomes text without scripts or forms", () => {
  assert.equal(parseEngineeringDescription({ id: item.id, content: { rendered: '<p>Free &amp; tasty</p><script>bad()</script><form>Private field</form><p>Lunch</p>' } }, item.id), "Free & tasty Lunch");
  assert.throws(() => parseEngineeringDescription({ id: 0 }, item.id));
});

test("collects only upcoming unique IDs and retries detail failures", async (t) => {
  t.mock.method(console, "warn", () => {});
  const calls: string[] = [];
  const delays: number[] = [];
  const source = createEngineeringDesignSource({
    now: () => Date.parse("2026-10-01T00:00:00Z"),
    sleep: async (ms) => { delays.push(ms); },
    fetch: async (url, options) => {
      calls.push(String(url));
      assert.ok(options?.signal);
      if (url === ENGINEERING_CALENDAR_URL) return Response.json({ pagination: { total: 3 }, posts: [item, item, { ...item, id: 1, cu_event_start_date: "2025-01-01 12:00:00", cu_event_end_date: "2025-01-01 13:00:00" }] });
      if (calls.length === 2) return new Response(null, { status: 503 });
      return Response.json({ id: item.id, content: { rendered: "<p>Free treats</p>" } });
    },
  });
  assert.deepEqual(await source.collect(), [{ ...parsed, description: "Free treats" }]);
  assert.deepEqual(delays, [2000]);
  assert.equal(calls.length, 3);
  assert.equal(calls[1], `https://carleton.ca/engineering-design/wp-json/wp/v2/cu_event/${item.id}?_fields=id,content`);
});

test("fails invalid/truncated feeds and exhausted requests; accepts empty feed", async (t) => {
  t.mock.method(console, "warn", () => {});
  for (const payload of [{}, { ...fixture, pagination: { total: 2 } }, { pagination: { total: 1 }, posts: [{}] }]) {
    await assert.rejects(createEngineeringDesignSource({ fetch: async () => Response.json(payload), sleep: async () => {}, now: () => 0 }).collect());
  }
  let attempts = 0;
  await assert.rejects(createEngineeringDesignSource({ fetch: async () => { attempts++; throw new Error("offline"); }, sleep: async () => {}, now: () => 0 }).collect(), /offline/);
  assert.equal(attempts, 3);
  assert.deepEqual(await createEngineeringDesignSource({ fetch: async () => Response.json({ pagination: { total: 0 }, posts: [] }), sleep: async () => {}, now: () => 0 }).collect(), []);
});

test("partial detail failure retains healthy events", async (t) => {
  t.mock.method(console, "warn", () => {});
  const source = createEngineeringDesignSource({ now: () => 0, sleep: async () => {}, fetch: async (url) => {
    if (url === ENGINEERING_CALENDAR_URL) return Response.json({ pagination: { total: 2 }, posts: [item, { ...item, id: 1 }] });
    if (String(url).includes("/1?")) throw new Error("offline");
    return Response.json({ id: item.id, content: { rendered: "Treats" } });
  } });
  assert.deepEqual(await source.collect(), [{ ...parsed, description: "Treats" }]);
});

test("cross-source matching works for prior stored events and keeps distinct occurrences", () => {
  const prior = { ...parsed, sourceName: "Carleton Current Students", sourceUrl: "https://students.carleton.ca/events/pride/", startTime: "2026-10-14T11:30:00-04:00", title: " FED PRIDE: Meet and Treat " };
  assert.equal(isCrossSourceDuplicate(prior, parsed), true);
  assert.deepEqual(deduplicateCarletonEvents([prior, parsed]), [prior]);
  for (const change of [{ room: "Other" }, { building: null }, { startTime: "2026-10-15T15:30:00Z" }, { startTime: "2026-10-14T11:30:00" }, { sourceName: prior.sourceName }]) {
    assert.equal(isCrossSourceDuplicate(prior, { ...parsed, ...change }), false);
  }
});
