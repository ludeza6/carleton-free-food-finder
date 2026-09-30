import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const now = new Date();
  // Match the notification watcher: assume two hours when no end time exists.
  const fallbackStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const { data: events, error } = await supabase
    .from("food_events")
    .select(
      `
      id,
      title,
      description,
      start_time,
      end_time,
      building,
      room,
      latitude,
      longitude,
      food_type,
      is_free,
      registration_required,
      source_name,
      source_url,
      confidence
      `,
    )
    .or(
      `start_time.gte.${now.toISOString()},end_time.gte.${now.toISOString()},and(end_time.is.null,start_time.gte.${fallbackStart.toISOString()})`,
    )
    .order("start_time", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load food events" },
      { status: 500 },
    );
  }

  return NextResponse.json(events);
}
