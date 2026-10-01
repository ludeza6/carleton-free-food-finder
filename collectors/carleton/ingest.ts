import { collectAllCarletonEvents } from "./collect-all";
import { isCrossSourceDuplicate } from "../deduplication";
import type { CollectedEvent } from "../types";
import { classifyFoodEvent } from "../food-detector";
import { createAdminClient } from "@/lib/supabase/admin";

export async function ingestCarletonFoodEvents() {
  const events = await collectAllCarletonEvents();

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

  // Match prior runs too, including when the original source is unavailable.
  const timestamps = freeFoodEvents.map(({ event }) => Date.parse(event.startTime));
  if (timestamps.some((time) => !Number.isFinite(time))) {
    throw new Error("Cannot check duplicates for an invalid event start time");
  }
  const existing: CollectedEvent[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data: stored, error: lookupError } = await supabase
      .from("food_events")
      .select("title, start_time, building, room, source_name, source_url")
      .gte("start_time", new Date(Math.min(...timestamps)).toISOString())
      .lte("start_time", new Date(Math.max(...timestamps)).toISOString())
      .order("id")
      .range(offset, offset + 499);
    if (lookupError) throw new Error(`Failed to check existing events: ${lookupError.message}`);
    for (const row of stored ?? []) {
      existing.push({
        title: row.title, startTime: row.start_time, building: row.building,
        room: row.room, sourceName: row.source_name ?? "", sourceUrl: row.source_url ?? "",
        description: null, endTime: null,
      });
    }
    if (!stored || stored.length < 500) break;
  }
  const uniqueRows = rows.filter((row, index) => !existing.some((stored) =>
    stored.sourceUrl !== row.source_url &&
    isCrossSourceDuplicate(stored, freeFoodEvents[index].event),
  ));
  if (uniqueRows.length === 0) {
    return { collected: events.length, detected: freeFoodEvents.length, stored: 0, events: [] };
  }

  const { data, error } = await supabase
    .from("food_events")
    .upsert(uniqueRows, {
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

// Compatibility alias for existing scripts and callers.
export const ingestCurrentStudentsFoodEvents = ingestCarletonFoodEvents;
