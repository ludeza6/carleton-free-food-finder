import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const VALID_VOTES = ["still_here", "gone"];

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const { id } = await context.params;

  const reportId = Number(id);

  if (!Number.isInteger(reportId)) {
    return NextResponse.json(
      { error: "Invalid report ID" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const vote = body.vote;

  if (!VALID_VOTES.includes(vote)) {
    return NextResponse.json(
      { error: "Invalid confirmation type" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: report, error: readError } =
    await supabase
      .from("food_reports")
      .select(
        `
        id,
        status,
        expires_at,
        still_here_count,
        gone_count
      `,
      )
      .eq("id", reportId)
      .single();

  if (readError || !report) {
    return NextResponse.json(
      { error: "Report not found" },
      { status: 404 },
    );
  }

  if (
    report.status !== "active" ||
    new Date(report.expires_at).getTime() <= Date.now()
  ) {
    return NextResponse.json(
      { error: "Report is no longer active" },
      { status: 409 },
    );
  }

  const nextGoneCount =
  vote === "gone"
    ? report.gone_count + 1
    : report.gone_count;

const nextStillHereCount =
  vote === "still_here"
    ? report.still_here_count + 1
    : report.still_here_count;

const shouldMarkGone =
  nextGoneCount >= 3 &&
  nextGoneCount > nextStillHereCount;

const updates: {
  still_here_count: number;
  gone_count: number;
  status: string;
  last_confirmed_at?: string;
} = {
  still_here_count: nextStillHereCount,
  gone_count: nextGoneCount,
  status: shouldMarkGone
    ? "gone"
    : report.status,
};

if (vote === "still_here") {
  updates.last_confirmed_at =
    new Date().toISOString();
}

  const { data, error } = await supabase
    .from("food_reports")
    .update(updates)
    .eq("id", reportId)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to confirm report" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}