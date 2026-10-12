import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { submitReport } from "./submit";
import { PGlite } from "@electric-sql/pglite";

// Disposable real PostgreSQL engine; never connects to the application database.
test("SQL enforces short/daily limits, independent hashes, rollback and private access", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create table public.food_reports (
        id bigint generated always as identity primary key,
        building text not null, room text, food_type text not null,
        quantity text not null, notes text, status text not null, expires_at timestamptz
      );
      grant insert, select on public.food_reports to anon, authenticated;
    `);
    await db.exec(await readFile("supabase/report-abuse-protection.sql", "utf8"));
    await db.exec(await readFile("supabase/tests/report-abuse-protection.sql", "utf8"));
    // The function must work as the actual invoker, not only as the database owner.
    await db.exec("grant usage on sequence public.food_reports_id_seq to service_role; set role service_role;");
    const result = await db.query<{ report: { building: string } }>(
      "select public.submit_community_report($1, $2::jsonb) as report",
      ["c".repeat(64), JSON.stringify({ building: "Nicol", food_type: "Pizza", quantity: "some" })],
    );
    assert.equal(result.rows[0].report.building, "Nicol");
    assert.ok(!JSON.stringify(result.rows[0]).includes("c".repeat(64)));
    await db.exec("reset role");
    const send = (ip = "192.0.2.20") => submitReport(new Request("http://localhost/api/reports", {
      method: "POST", headers: { "x-forwarded-for": ip },
      body: JSON.stringify({ building: "Nicol", food_type: "Pizza", quantity: "some" }),
    }), {
      salt: () => "integration-test-secret",
      insert: async (hash, report) => {
        try {
          const inserted = await db.query<{ report: unknown }>(
            "select public.submit_community_report($1, $2::jsonb) as report",
            [hash, JSON.stringify(report)],
          );
          return { data: inserted.rows[0].report, error: null };
        } catch (error) {
          return { data: null, error: { code: (error as { code: string }).code } };
        }
      },
    });
    for (let n = 0; n < 3; n++) assert.equal((await send()).status, 201);
    assert.equal((await send()).status, 429);
    assert.equal((await send("192.0.2.21")).status, 201);
    for (let n = 3; n < 10; n++) {
      await db.exec("update public.report_rate_limits set created_at = clock_timestamp() - interval '1 hour'");
      assert.equal((await send()).status, 201);
    }
    await db.exec("update public.report_rate_limits set created_at = clock_timestamp() - interval '1 hour'");
    assert.equal((await send()).status, 429);

  } finally {
    await db.close();
  }
});
