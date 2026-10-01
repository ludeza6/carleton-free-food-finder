import assert from "node:assert/strict";
import { test } from "node:test";
import calendar from "./fixtures/student-experience-calendar.json";
import detail from "./fixtures/student-experience-detail.json";
import { carletonSources, collectAllCarletonEvents } from "./collect-all";
import { createStudentExperienceSource, STUDENT_EXPERIENCE_CALENDAR_URL, STUDENT_EXPERIENCE_SOURCE_NAME, studentExperienceSource } from "./sources/student-experience";
import { parseCalendarEvent } from "./sources/wordpress-calendar";

const now = () => Date.parse("2026-10-01T00:00:00Z");
const sleep = async () => {};
const item = calendar.posts[0];

test("SEO is registered and its public fixtures populate every collected field", async () => {
  assert.ok(carletonSources.includes(studentExperienceSource));
  const urls: string[] = [];
  const source = createStudentExperienceSource({ now, sleep, fetch: async (url) => {
    urls.push(String(url));
    return Response.json(url === STUDENT_EXPERIENCE_CALENDAR_URL ? calendar : detail);
  } });
  const events = await source.collect();
  assert.equal(source.name, STUDENT_EXPERIENCE_SOURCE_NAME);
  assert.equal(events.length, 1);
  assert.deepEqual({ ...events[0], description: null }, {
    title: "Campus to Community – Post Panda Cleanup", description: null,
    startTime: "2026-10-05T13:00:00.000Z", endTime: "2026-10-05T16:00:00.000Z",
    building: "1005 Bank St, Ottawa, ON K1S 3W7, Canada", room: null,
    sourceName: STUDENT_EXPERIENCE_SOURCE_NAME, sourceUrl: item.link,
  });
  assert.match(events[0].description!, /Gloves and garbage pickers will be available/);
  assert.doesNotMatch(events[0].description!, /<[^>]+>/);
  assert.deepEqual(urls, [STUDENT_EXPERIENCE_CALENDAR_URL, "https://carleton.ca/seo/wp-json/wp/v2/cu_event/36840?_fields=id,content"]);
});

test("SEO omits past records without requesting their details", async () => {
  const source = createStudentExperienceSource({ now: () => Date.parse("2026-10-06T00:00:00Z"), sleep, fetch: async (url) => {
    assert.equal(url, STUDENT_EXPERIENCE_CALENDAR_URL);
    return Response.json(calendar);
  } });
  assert.deepEqual(await source.collect(), []);
});

test("SEO retries network failures and is isolated from healthy sources", async (t) => {
  const warnings = t.mock.method(console, "warn", () => {});
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "log", () => {});
  let requests = 0;
  const delays: number[] = [];
  const source = createStudentExperienceSource({ now, sleep: async (ms) => { delays.push(ms); }, fetch: async () => {
    requests++;
    throw new Error("offline");
  } });
  assert.deepEqual(await collectAllCarletonEvents([source, { name: "Healthy", collect: async () => [] }]), []);
  assert.equal(requests, 3);
  assert.deepEqual(delays, [2000, 4000]);
  assert.match(String(warnings.mock.calls[0].arguments[0]), /Carleton Student Experience Office/);
});

test("SEO matches a Current Students duplicate even with another URL", async (t) => {
  t.mock.method(console, "log", () => {});
  const source = createStudentExperienceSource({ now, sleep, fetch: async (url) => Response.json(url === STUDENT_EXPERIENCE_CALENDAR_URL ? calendar : detail) });
  const event = parseCalendarEvent(item, "Carleton Current Students").event;
  const prior = { ...event, sourceUrl: "https://students.carleton.ca/events/post-panda-cleanup/", startTime: "2026-10-05T09:00:00-04:00" };
  assert.deepEqual(await collectAllCarletonEvents([{ name: prior.sourceName, collect: async () => [prior] }, source]), [prior]);
});
