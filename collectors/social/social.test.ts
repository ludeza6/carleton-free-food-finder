import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeBlueskyFeed, createBlueskySources } from "./sources/bluesky";
import { extractSocialEvent } from "./extract-event";
import { collectAllSocialEvents } from "./collect-all";
import { collectAllEventSources } from "../collect-all";
import { deduplicateEvents } from "../deduplication";
import type { SocialPost } from "./types";

const now = new Date("2026-10-13T15:00:00Z");
const post: SocialPost = { text: "Pizza meetup\nFree pizza tomorrow 1-3 PM at University Centre room 123", postedAt: now.toISOString(), sourceName: "Bluesky @example.test", sourceUrl: "https://bsky.app/profile/did:plc:example/post/abc" };
const item = { post: { uri: "at://did:plc:example/app.bsky.feed.post/abc", author: { handle: "example.test" }, record: { text: post.text, createdAt: post.postedAt } } };

test("normalizes public posts and excludes old posts, future posts, reposts and replies", () => {
  assert.deepEqual(normalizeBlueskyFeed({ feed: [item] }, now), [post]);
  const dated = (createdAt: string) => ({ post: { ...item.post, record: { ...item.post.record, createdAt } } });
  assert.deepEqual(normalizeBlueskyFeed({ feed: [dated("2026-10-06T14:59:59Z"), dated("2026-10-14T15:00:00Z"), { ...item, reason: {} }, { ...item, reply: {} }, {}] }, now), []);
  assert.throws(() => normalizeBlueskyFeed({}, now), /Invalid/);
});

test("extracts free food with Toronto date, range, location and room", () => {
  const result = extractSocialEvent(post, now);
  assert.ok(result.event);
  assert.equal(result.event.title, "Pizza meetup");
  assert.equal(result.event.startTime, "2026-10-14T17:00:00.000Z");
  assert.equal(result.event.endTime, "2026-10-14T19:00:00.000Z");
  assert.equal(result.event.building, "University Centre");
  assert.equal(result.event.room, "123");
});

test("rejects paid food, unrelated posts and missing or ambiguous dates/times", () => {
  for (const text of ["Pizza for sale tomorrow 1 PM", "Study tomorrow 1 PM", "Free pizza 1 PM", "Free pizza tomorrow", "Free pizza today or tomorrow 1 PM", "Free pizza 10/15 1 PM", "Free pizza next Thursday 1 PM", "Free pizza tomorrow 1 PM or 3 PM", "Free pizza tomorrow 11-1 PM", "Free pizza February 30 1 PM"]) {
    assert.equal(extractSocialEvent({ ...post, text }, now).event, null, text);
  }
});

test("supports today, weekdays, short/long month names and minutes", () => {
  for (const [date, iso] of [["today", "2026-10-13"], ["Thursday", "2026-10-15"], ["Oct 15", "2026-10-15"], ["October 15", "2026-10-15"]]) {
    assert.equal(extractSocialEvent({ ...post, text: `Free pizza ${date} 1:30pm` }, now).event?.startTime, `${iso}T17:30:00.000Z`);
  }
});

test("relative dates use Toronto publication day; winter offsets and DST ambiguity", () => {
  const winter = new Date("2026-12-15T01:00:00Z"); // Dec 14 locally
  assert.equal(extractSocialEvent({ ...post, postedAt: winter.toISOString(), text: "Free pizza tomorrow 1 PM" }, winter).event?.startTime, "2026-12-15T18:00:00.000Z");
  for (const [timestamp, text] of [["2026-10-31T16:00:00Z", "Free pizza tomorrow 1:30 AM"], ["2026-03-07T16:00:00Z", "Free pizza tomorrow 2:30 AM"]]) {
    assert.equal(extractSocialEvent({ ...post, postedAt: timestamp, text }, new Date(timestamp)).event, null);
  }
});

test("retries with timeout and headers, then succeeds", async (t) => {
  const timeout = t.mock.method(AbortSignal, "timeout", () => new AbortController().signal);
  const delays: number[] = [];
  let attempts = 0;
  const [source] = createBlueskySources(["example.test"], { now: () => now, sleep: async (ms) => { delays.push(ms); }, fetch: async (input, init) => {
    assert.equal(new URL(String(input)).searchParams.get("actor"), "example.test");
    assert.ok(init?.headers && init.signal);
    assert.match(JSON.stringify(init.headers), /User-Agent/);
    if (++attempts < 3) return new Response(null, { status: 503 });
    return Response.json({ feed: [item] });
  } });
  assert.equal((await source.collect()).length, 1);
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [1000, 2000]);
  assert.deepEqual(timeout.mock.calls.map((call) => call.arguments), [[15000], [15000], [15000]]);
});

test("one failed account cannot kill other accounts or central collection", async (t) => {
  t.mock.method(console, "error", () => {});
  const sources = createBlueskySources(["bad.test", "example.test"], { now: () => now, sleep: async () => {}, fetch: async (input) => {
    if (new URL(String(input)).searchParams.get("actor") === "bad.test") throw new Error("Offline");
    return Response.json({ feed: [item] });
  } });
  assert.equal((await collectAllSocialEvents(sources)).length, 1);
  assert.equal((await collectAllEventSources([], sources)).length, 1);
  assert.deepEqual(await collectAllSocialEvents([sources[0]]), []);
});

test("exact URLs and conservative social/official fingerprints deduplicate", () => {
  const event = extractSocialEvent(post, now).event!;
  const official = { ...event, sourceName: "Carleton Current Students", sourceUrl: "https://students.carleton.ca/example" };
  assert.deepEqual(deduplicateEvents([official, event]), [official]);
  assert.equal(deduplicateEvents([event, { ...event, description: "Updated" }]).length, 1);
  for (const changed of [{ title: "Another meetup" }, { building: null }, { startTime: "2026-10-15T17:00:00Z" }]) {
    assert.equal(deduplicateEvents([official, { ...event, ...changed }]).length, 2);
  }
});

test("pagination uses cursors, remains bounded and isolates exhausted retries", async (t) => {
  t.mock.method(console, "error", () => {});
  let pages = 0;
  const [source] = createBlueskySources(["example.test"], { now: () => now, fetch: async (input) => {
    const cursor = new URL(String(input)).searchParams.get("cursor");
    assert.equal(cursor, pages ? `page-${pages}` : null);
    pages++;
    return Response.json({ feed: [], cursor: `page-${pages}` });
  } });
  assert.deepEqual(await source.collect(), []);
  assert.equal(pages, 5);
  let attempts = 0;
  const [broken] = createBlueskySources(["broken.test"], { sleep: async () => {}, fetch: async () => { attempts++; throw new Error("Offline"); } });
  assert.deepEqual(await collectAllSocialEvents([broken]), []);
  assert.equal(attempts, 3);
});

test("free-food announcements with no time log an explicit skip reason", async (t) => {
  const log = t.mock.method(console, "info", () => {});
  const [source] = createBlueskySources(["example.test"], { now: () => now, fetch: async () => Response.json({ feed: [{ post: { ...item.post, record: { ...item.post.record, text: "Free pizza tomorrow" } } }] }) });
  assert.deepEqual(await source.collect(), []);
  assert.match(String(log.mock.calls[0].arguments[0]), /Skipped.*Missing or ambiguous event time/);
});
