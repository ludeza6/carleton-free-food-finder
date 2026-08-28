import { collectCurrentStudentsEvents } from "./current-students";
import { classifyFoodEvent } from "../food-detector";
import { createAdminClient } from "@/lib/supabase/admin";

export async function ingestCurrentStudentsFoodEvents() {
  const events = await collectCurrentStudentsEvents();

  const classifiedEvents = events.map((event) => ({
    event,
    classification: classifyFoodEvent(event),
  }));

  const freeFoodEvents = classifiedEvents.filter(
    ({ classification }) =>
      classification.hasFood && classification.isFree,
  );

  console.log(`Collected ${events.length} total events`);
  console.log(`Detected ${freeFoodEvents.length} free food events`);

  if (freeFoodEvents.length === 0) {
    return {
      collected: events.length,
      detected: 0,
      stored: 0,
      events: [],
    };
  }

  const rows = freeFoodEvents.map(({ event, classification }) => ({
    title: event.title,
    description: event.description,
    start_time: event.startTime,
    end_time: event.endTime,
    building: event.building ?? "Location TBD",
    room: event.room,

    food_type: classification.foodType,

    is_free: classification.isFree,
    registration_required: false,

    source_name: event.sourceName,
    source_url: event.sourceUrl,

    confidence: classification.confidence,
  }));

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("food_events")
    .upsert(rows, {
      onConflict: "source_url",
    })
    .select(
      "id, title, source_url, food_type, confidence",
    );

  if (error) {
    throw new Error(`Failed to store food events: ${error.message}`);
  }

  return {
    collected: events.length,
    detected: freeFoodEvents.length,
    stored: data?.length ?? 0,
    events: data ?? [],
  };
}