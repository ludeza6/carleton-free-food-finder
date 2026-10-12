import assert from "node:assert/strict";
import { test } from "node:test";
import { hashClientIp, submitReport, type ReportDependencies } from "./submit";

const valid = { building: "Nicol", food_type: "Pizza", quantity: "some" };
function setup() {
  const calls: string[] = [];
  const dependencies: ReportDependencies = {
    salt: () => "test-secret",
    insert: async (hash, report) => {
      calls.push(hash);
      return { data: { id: "report-id", ...report }, error: null };
    },
  };
  const send = (body: unknown = valid, headers = { "x-forwarded-for": "192.0.2.1" }) =>
    submitReport(new Request("http://localhost/api/reports", {
      method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body),
    }), dependencies);
  return { calls, dependencies, send };
}

test("valid report uses hashed IP and returns no hash", async () => {
  const { calls, send } = setup();
  const response = await send();
  assert.equal(response.status, 201);
  assert.match(calls[0], /^[a-f0-9]{64}$/);
  assert.ok(!(await response.text()).includes(calls[0]));
});
for (const [name, body] of [
  ["malformed JSON", "{"], ["missing building", { ...valid, building: "" }],
  ["missing food", { ...valid, food_type: "" }],
  ["honeypot", { ...valid, website: "https://spam.test" }],
  ["punctuation", { ...valid, food_type: "!!!" }],
  ["one character", { ...valid, food_type: "a" }],
  ["whitespace", { ...valid, notes: "   " }],
  ...Object.entries({ building: 120, room: 80, food_type: 120, notes: 1000 }).map(
    ([field, limit]) => [`too long ${field}`, { ...valid, [field]: "a".repeat(limit + 1) }],
  ),
] as Array<[string, unknown]>) {
  test(`rejects ${name} before inserting`, async () => {
    const { calls, send } = setup();
    assert.equal((await send(body)).status, 400);
    assert.equal(calls.length, 0);
  });
}
test("database rate limit becomes clear 429", async () => {
  const { dependencies, send } = setup();
  dependencies.insert = async () => ({ data: null, error: { code: "P0429" } });
  const response = await send();
  assert.equal(response.status, 429);
  assert.match((await response.json()).error, /3 reports.*15 minutes.*10.*24 hours/);
});
test("database failure returns 500", async () => {
  const { dependencies, send } = setup();
  dependencies.insert = async () => { throw new Error("private detail"); };
  assert.equal((await send()).status, 500);
});
test("missing salt and invalid IP fail closed", async () => {
  const { dependencies, send, calls } = setup();
  assert.equal((await send(valid, { "x-forwarded-for": "invalid" })).status, 503);
  dependencies.salt = () => undefined;
  assert.equal((await send()).status, 503);
  assert.equal(calls.length, 0);
});
test("hash normalizes first forwarded address, IPv6 and mapped IPv4", () => {
  const hash = (ip: string) => hashClientIp(new Headers({ "x-forwarded-for": ip }), "salt");
  assert.equal(hash(" 192.0.2.1 , 198.51.100.1"), hash("192.0.2.1"));
  assert.equal(hash("2001:0DB8:0:0:0:0:0:1"), hash("2001:db8::1"));
  assert.equal(hash("::ffff:192.0.2.1"), hash("192.0.2.1"));
  assert.notEqual(hash("192.0.2.1"), hash("192.0.2.2"));
  assert.notEqual(hash("192.0.2.1"), hashClientIp(new Headers({ "x-real-ip": "192.0.2.1" }), "other"));
  assert.equal(hash("192.0.2.1"), hashClientIp(new Headers({ "x-real-ip": "192.0.2.1" }), "salt"));
});
