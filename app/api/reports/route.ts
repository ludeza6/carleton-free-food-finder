import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { submitReport } from "@/lib/reports/submit";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("food_reports")
    .select("*")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load reports" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  return submitReport(request, {
    salt: () => process.env.REPORT_RATE_LIMIT_SALT,
    insert: async (ipHash, report) => createAdminClient().rpc("submit_community_report", {
      p_ip_hash: ipHash, p_report: report,
    }),
  });
}
