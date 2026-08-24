import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

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
    .order("start_time", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load food events" },
      { status: 500 },
    );
  }

  return NextResponse.json(events);
}
