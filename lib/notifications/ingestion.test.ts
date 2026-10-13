import assert from "node:assert/strict";
import { test } from "node:test";
import seo from "../../collectors/carleton/fixtures/student-experience-calendar.json";
import isso from "../../collectors/carleton/fixtures/go-isso-calendar.json";

test("SEO and GO-ISSO free food flows through ingestion and alerts; stored cross-source duplicates are skipped", async (t) => {
  const originalEnv = { ...process.env };
  t.after(() => { process.env = originalEnv; });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.RESEND_API_KEY = "re_test";
  process.env.CF3_ALERT_EMAIL = "owner@example.com";
  process.env.CF3_FROM_EMAIL = "CF3 <alerts@example.com>";
  t.mock.method(console, "log", () => {});
  const rows: Record<string, unknown>[] = [];
  const emails: string[] = [];
  let upserts = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === "students.carleton.ca") return Response.json([]);
    if (url.hostname === "carleton.ca") {
      if (url.pathname.endsWith("/cu-calendar")) {
        const item = url.pathname.startsWith("/seo/") ? seo.posts[0]
          : url.pathname.startsWith("/go-isso/") ? isso.posts.find((event) => event.id === 44095) : null;
        const posts = item ? [{ ...item, cu_event_start_date: "2099-10-13 13:30:00", cu_event_end_date: "2099-10-13 15:30:00" }] : [];
        return Response.json({ pagination: { total: posts.length }, posts });
      }
      const id = Number(url.pathname.split("/").at(-1));
      return Response.json({ id, content: { rendered: "<p>Free pizza and refreshments provided.</p>" } });
    }
    if (url.hostname === "api.resend.com") {
      emails.push(String(init?.body));
      return Response.json({ id: `email-${emails.length}` });
    }
    assert.equal(url.hostname, "example.supabase.co");
    assert.equal(url.pathname, "/rest/v1/food_events");
    if (init?.method === "POST") {
      upserts++;
      assert.equal(url.searchParams.get("on_conflict"), "source_url");
      const incoming = JSON.parse(String(init.body)) as Record<string, unknown>[];
      for (const row of incoming) rows.push({ ...row, id: `event-${rows.length}`, notified_at: null });
      return Response.json(rows);
    }
    const idFilter = url.searchParams.get("id");
    const selected = idFilter ? rows.filter((row) => `eq.${row.id}` === idFilter) : rows;
    if (init?.method === "PATCH") {
      for (const row of selected) Object.assign(row, JSON.parse(String(init.body)));
      return Response.json(selected);
    }
    const pending = url.searchParams.has("notified_at")
      ? selected.filter((row) => row.notified_at === null) : selected;
    return Response.json(pending);
  });
  // Import after installing fetch so the existing feed factories capture it.
  const { ingestCarletonFoodEvents } = await import("../../collectors/carleton/ingest");
  const result = await ingestCarletonFoodEvents();
  assert.equal(result.detected, 2);
  assert.equal(result.stored, 2);
  assert.equal(upserts, 1);
  assert.equal(emails.length, 2);
  assert.ok(rows.every((row) => row.is_free === true && row.food_type === "Pizza" && row.notified_at));
  assert.ok(emails.some((email) => email.includes("Student Experience Office")));
  assert.ok(emails.some((email) => email.includes("International Student Services Office")));

  // A prior source can own the same occurrence under another URL and omit room.
  for (const row of rows) {
    row.source_name = "Carleton Current Students";
    row.source_url = `https://students.carleton.ca/events/${row.id}/`;
    row.room = null;
  }
  const repeat = await ingestCarletonFoodEvents();
  assert.equal(repeat.stored, 0);
  assert.equal(upserts, 1);
  assert.equal(emails.length, 2);
});

test("social ingestion isolates account failures and suppresses persisted duplicates without repeat email", async (t) => {
  const originalEnv = { ...process.env };
  t.after(() => { process.env = originalEnv; });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://social-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.RESEND_API_KEY = "re_test";
  process.env.CF3_ALERT_EMAIL = "owner@example.com";
  process.env.CF3_FROM_EMAIL = "CF3 <alerts@example.com>";
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});
  const rows: Record<string, unknown>[] = [];
  let emails = 0;
  let upserts = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === "api.resend.com") { emails++; return Response.json({ id: "email" }); }
    assert.equal(url.hostname, "social-test.supabase.co");
    if (init?.method === "POST") {
      upserts++;
      for (const row of JSON.parse(String(init.body))) {
        const existing = rows.find((stored) => stored.source_url === row.source_url);
        if (existing) Object.assign(existing, row);
        else rows.push({ ...row, id: "event-1", notified_at: null });
      }
      return Response.json(rows);
    }
    if (init?.method === "PATCH") { Object.assign(rows[0], JSON.parse(String(init.body))); return Response.json(rows); }
    if (url.searchParams.has("notified_at")) return Response.json(rows.filter((row) => row.notified_at === null));
    if (url.searchParams.has("id")) return Response.json(rows[0]);
    return Response.json(rows);
  });
  const { ingestCarletonFoodEvents } = await import("../../collectors/carleton/ingest");
  const { collectAllEventSources } = await import("../../collectors/collect-all");
  const event = { title: "Pizza meetup", description: "Free pizza", startTime: "2099-10-13T17:00:00Z", endTime: null, building: "University Centre", room: null, sourceName: "Bluesky @example.test", sourceUrl: "https://bsky.app/profile/did:plc:example/post/abc" };
  const collect = () => collectAllEventSources([], [
    { name: "Failed account", collect: async () => { throw new Error("Offline"); } },
    { name: event.sourceName, collect: async () => [event] },
  ]);
  assert.equal((await ingestCarletonFoodEvents(collect)).stored, 1);
  assert.equal(emails, 1);
  await ingestCarletonFoodEvents(collect); // Exact URL upsert preserves notified_at.
  assert.equal(emails, 1);
  rows[0].source_name = "Carleton Current Students";
  rows[0].source_url = "https://students.carleton.ca/events/pizza/";
  assert.equal((await ingestCarletonFoodEvents(collect)).stored, 0);
  assert.equal(upserts, 2);
  assert.equal(emails, 1);
});
