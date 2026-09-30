import type { CollectedEvent, EventSource } from "../types";
import { deduplicateEventsBySourceUrl } from "../deduplication";
import { currentStudentsSources } from "./sources/current-students";

// Register additional independent Carleton sources here.
export const carletonSources: readonly EventSource[] = [
  ...currentStudentsSources,
];

export async function collectAllCarletonEvents(
  sources: readonly EventSource[] = carletonSources,
): Promise<CollectedEvent[]> {
  if (sources.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(
    // Also isolate collectors that throw synchronously before returning a promise.
    sources.map((source) => Promise.resolve().then(() => source.collect())),
  );

  const events: CollectedEvent[] = [];
  let successfulSources = 0;

  results.forEach((result, index) => {
    const source = sources[index];
    if (result.status === "fulfilled") {
      successfulSources++;
      console.log(`${source.name}: collected ${result.value.length} events`);
      events.push(...result.value);
    } else {
      console.error(`${source.name}: collection failed`, result.reason);
    }
  });

  if (successfulSources === 0) {
    throw new Error("All Carleton event sources failed. No ingestion performed.");
  }

  return deduplicateEventsBySourceUrl(events);
}
