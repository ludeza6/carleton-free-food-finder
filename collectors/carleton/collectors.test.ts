import assert from "node:assert/strict";
import { test } from "node:test";
import type { CollectedEvent, EventSource } from "../types";
import {
  createEventFingerprint,
  deduplicateEventsBySourceUrl,
} from "../deduplication";
import { collectAllCarletonEvents } from "./collect-all";
import {
  createCurrentStudentsSources,
  parseLocation,
} from "./sources/current-students";

const event: CollectedEvent = {
  title: "Free Pizza",
  description: "Free pizza provided",
  startTime: "2026-09-30T12:00:00-04:00",
  endTime: null,
  building: "University Centre",
  room: null,
  sourceName: "Test source",
  sourceUrl: "https://example.test/event",
};

function source(name: string, events: CollectedEvent[]): EventSource {
  return { name, collect: async () => events };
}

function failingSource(name: string): EventSource {
  return { name, collect: async () => { throw new Error("Unavailable"); } };
}

test("keeps successful sources and logs each outcome", async (t) => {
  const log = t.mock.method(console, "log", () => {});
  const error = t.mock.method(console, "error", () => {});
  const result = await collectAllCarletonEvents([
    source("Working", [event]),
    failingSource("Unavailable"),
    { name: "Sync failure", collect: () => { throw new Error("Sync"); } },
  ]);
  assert.deepEqual(result, [event]);
  assert.equal(log.mock.calls[0].arguments[0], "Working: collected 1 events");
  assert.deepEqual(error.mock.calls.map((call) => call.arguments[0]), [
    "Unavailable: collection failed",
    "Sync failure: collection failed",
  ]);
});

test("empty successful sources do not fail the run", async (t) => {
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});
  assert.deepEqual(await collectAllCarletonEvents([
    failingSource("Failed"), source("Empty", []),
  ]), []);
  assert.deepEqual(await collectAllCarletonEvents([source("Empty", [])]), []);
  assert.deepEqual(await collectAllCarletonEvents([]), []);
});

test("rejects only when every configured source fails", async (t) => {
  t.mock.method(console, "error", () => {});
  await assert.rejects(
    collectAllCarletonEvents([failingSource("One"), failingSource("Two")]),
    /All Carleton event sources failed/,
  );
});

test("runs sources concurrently and deduplicates in configuration order", async (t) => {
  t.mock.method(console, "log", () => {});
  let resolveFirst!: (events: CollectedEvent[]) => void;
  const first = new Promise<CollectedEvent[]>((resolve) => { resolveFirst = resolve; });
  const later = { ...event, sourceName: "Later configured source" };
  const result = await collectAllCarletonEvents([
    { name: "First", collect: () => first },
    { name: "Second", collect: async () => {
      resolveFirst([event]);
      return [later];
    } },
  ]);
  assert.deepEqual(result, [later]);
});

test("URL deduplication preserves distinct URLs even for matching fingerprints", () => {
  const distinct = { ...event, sourceUrl: "https://example.test/another" };
  const replacement = { ...event, description: "Updated" };
  const input = [event, distinct, replacement];
  assert.deepEqual(deduplicateEventsBySourceUrl(input), [replacement, distinct]);
  assert.equal(input.length, 3);
  assert.equal(createEventFingerprint(event), createEventFingerprint(distinct));
});

test("fingerprints normalize text and zoned times while distinguishing occurrences", () => {
  assert.equal(createEventFingerprint(event), createEventFingerprint({
    ...event,
    title: "  FREE   PIZZA ",
    building: " UNIVERSITY\nCENTRE ",
    startTime: "2026-09-30T16:00:00Z",
  }));
  for (const changed of [
    { ...event, title: "Free Lunch" },
    { ...event, building: "Library" },
    { ...event, startTime: "2026-10-01T16:00:00Z" },
  ]) {
    assert.notEqual(createEventFingerprint(event), createEventFingerprint(changed));
  }
  assert.deepEqual(JSON.parse(createEventFingerprint({
    ...event, building: null, startTime: "2026-09-30T12:00:00",
  })), ["free pizza", "2026-09-30T12:00:00", ""]);
});

test("parses feed locations without changing existing mapping", () => {
  assert.deepEqual(parseLocation(" University Centre - 123 "), {
    building: "University Centre", room: "123",
  });
  assert.deepEqual(parseLocation(null), { building: null, room: null });
  assert.deepEqual(parseLocation("Library"), { building: "Library", room: null });
});

test("the three existing feeds map into compatible collected events", async () => {
  const urls: string[] = [];
  const sources = createCurrentStudentsSources({
    fetch: async (url) => {
      urls.push(String(url));
      return Response.json([{
        title: event.title, description: event.description,
        start: event.startTime, end: null, url: event.sourceUrl,
        location: "University Centre - 123",
      }]);
    },
    sleep: async () => { throw new Error("Unexpected retry"); },
  });
  assert.deepEqual(sources.map((entry) => entry.name), [
    "Carleton Current Students", "Carleton Varsity", "Carleton Academics",
  ]);
  for (const entry of sources) {
    assert.deepEqual(await entry.collect(), [{ ...event, room: "123", sourceName: entry.name }]);
  }
  assert.deepEqual(urls, [
    "https://students.carleton.ca/wp-json/stu-api/v2/event-calendar-feed/",
    "https://students.carleton.ca/wp-json/stu-api/v2/event-calendar-varsity/",
    "https://students.carleton.ca/wp-json/stu-api/v2/event-calendar-academics/",
  ]);
});

test("preserves request timeout, headers, three attempts and retry delays", async (t) => {
  t.mock.method(console, "warn", () => {});
  const signal = new AbortController().signal;
  const timeout = t.mock.method(AbortSignal, "timeout", () => signal);
  const delays: number[] = [];
  let attempts = 0;
  const [entry] = createCurrentStudentsSources({
    fetch: async (_url, options) => {
      attempts++;
      assert.equal(options?.signal, signal);
      assert.deepEqual(options?.headers, {
        "User-Agent": "CF3-Carleton-Free-Food-Finder/1.0", Accept: "application/json",
      });
      if (attempts === 1) throw new DOMException("Timeout", "TimeoutError");
      if (attempts === 2) return new Response(null, { status: 503 });
      return Response.json([]);
    },
    sleep: async (delay) => { delays.push(delay); },
  });
  assert.deepEqual(await entry.collect(), []);
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [2000, 4000]);
  assert.deepEqual(timeout.mock.calls.map((call) => call.arguments), [[15000], [15000], [15000]]);
});

test("stops retrying after three failed requests", async (t) => {
  t.mock.method(console, "warn", () => {});
  let attempts = 0;
  const delays: number[] = [];
  const [entry] = createCurrentStudentsSources({
    fetch: async () => { attempts++; throw new Error("Offline"); },
    sleep: async (delay) => { delays.push(delay); },
  });
  await assert.rejects(entry.collect(), /Offline/);
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [2000, 4000]);
});

test("invalid feed responses fail independently", async (t) => {
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});
  let response = 0;
  const sources = createCurrentStudentsSources({
    fetch: async () => {
      response++;
      if (response === 1) return Response.json({ unexpected: true });
      if (response === 2) return new Response("malformed JSON");
      return Response.json([]);
    },
    sleep: async () => {},
  });
  assert.deepEqual(await collectAllCarletonEvents(sources), []);
});
