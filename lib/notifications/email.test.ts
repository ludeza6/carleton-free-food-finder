import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { formatEventEmail, isAlertEligible, type AlertEvent } from "./email";
import { notifyPendingEvents } from "./notify-events";

const event: AlertEvent = {
  id: "event-1", title: 'Pizza <party> & friends', food_type: "pizza",
  building: "Nicol", room: "101", start_time: "2099-07-01T16:00:00Z",
  end_time: null, source_name: "Current Students", source_url: "https://carleton.ca/event?a=1&b=2",
  notified_at: null,
};

test("email includes escaped details, Toronto time, and a plain-text alternative", () => {
  const email = formatEventEmail(event);
  assert.match(email.html, /Pizza &lt;party&gt; &amp; friends/);
  for (const value of ["pizza", "Nicol, 101", "America/Toronto", "Current Students"]) {
    assert.ok(email.text.includes(value));
    assert.ok(email.html.includes(value));
  }
  assert.match(email.text, /12:00/);
  assert.ok(email.text.includes(event.source_url));
  assert.match(formatEventEmail({ ...event, start_time: "2099-01-01T16:00:00Z" }).text, /11:00/);
  assert.throws(() => formatEventEmail({ ...event, source_url: "javascript:alert(1)" }));
});

test("already notified, started, expired, and invalid-date events are ineligible", () => {
  assert.equal(isAlertEligible(event), true);
  for (const changes of [
    { notified_at: "2026-01-01T00:00:00Z" },
    { start_time: "2000-01-01T00:00:00Z" },
    { end_time: "2000-01-01T00:00:00Z" },
    { start_time: "invalid" },
  ]) assert.equal(isAlertEligible({ ...event, ...changes }), false);
});

test("failed send retries later; success marks once; repeat runs do not resend", async (t) => {
  const originalEnv = { ...process.env };
  t.after(() => { process.env = originalEnv; });
  process.env.RESEND_API_KEY = "re_test";
  process.env.CF3_ALERT_EMAIL = "owner@example.com";
  process.env.CF3_FROM_EMAIL = "CF3 <alerts@example.com>";
  let stored = { ...event };
  let sends = 0;
  let writes = 0;
  let failSend = true;
  let failWrite = false;
  const keys: string[] = [];
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "info", () => {});
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === "api.resend.com") {
      sends++;
      keys.push(new Headers(init?.headers).get("idempotency-key")!);
      assert.equal(writes, 0);
      return Response.json(failSend ? { name: "rate_limit_exceeded", message: "retry later" } : { id: "email-1" }, { status: failSend ? 429 : 200 });
    }
    assert.equal(url.pathname, "/rest/v1/food_events");
    if (init?.method === "PATCH") {
      if (failWrite) return Response.json({ code: "DB_DOWN", message: "unavailable" }, { status: 500 });
      writes++;
      stored = { ...stored, ...JSON.parse(String(init.body)) };
      return Response.json([{ id: event.id }]);
    }
    return Response.json(stored.notified_at ? [] : [stored]);
  });
  const client = createClient("https://example.supabase.co", "test-key", { auth: { persistSession: false } });
  await notifyPendingEvents(client);
  assert.equal(sends, 1);
  assert.equal(stored.notified_at, null);
  assert.equal(writes, 0);
  failSend = false;
  failWrite = true;
  await notifyPendingEvents(client);
  assert.equal(stored.notified_at, null);
  failWrite = false;
  await notifyPendingEvents(client);
  assert.ok(stored.notified_at);
  assert.equal(writes, 1);
  await notifyPendingEvents(client);
  assert.equal(sends, 3);
  assert.deepEqual(keys, Array(3).fill("cf3-food-event/event-1"));
  delete process.env.RESEND_API_KEY;
  await notifyPendingEvents(client);
  assert.equal(sends, 3);
});
