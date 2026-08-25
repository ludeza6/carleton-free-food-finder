import { collectCurrentStudentsEvents } from "./current-students";
import { isLikelyFoodEvent } from "../food-detector";
import { createAdminClient } from "@/lib/supabase/admin";

export async function ingestCurrentStudentsFoodEvents() {
  const events = await collectCurrentStudentsEvents();

  const foodEvents = events.filter(isLikelyFoodEvent);

  console.log(`Collected ${events.length} total events`);
  console.log(`Detected ${foodEvents.length} likely food events`);

  if (foodEvents.length === 0) {
    return {
      collected: events.length,
      detected: 0,
      stored: 0,
    };
  }

  const rows = foodEvents.map((event) => ({
    title: event.title,
    description: event.description,
    start_time: event.startTime,
    end_time: event.endTime,
    building: event.building ?? "Location TBD",
    room: event.room,

    food_type: null,

    is_free: true,
    registration_required: false,

    source_name: event.sourceName,
    source_url: event.sourceUrl,

    confidence: 0.8,
  }));

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("food_events")
    .upsert(rows, {
      onConflict: "source_url",
    })
    .select("id, title, source_url");

  if (error) {
    throw new Error(`Failed to store food events: ${error.message}`);
  }

  return {
    collected: events.length,
    detected: foodEvents.length,
    stored: data?.length ?? 0,
    events: data ?? [],
  };
}
