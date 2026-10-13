import type { CollectedEvent, EventSource } from "../types";
import { createBlueskySources } from "./sources/bluesky";

export async function collectAllSocialEvents(sources: readonly EventSource[] = createBlueskySources()): Promise<CollectedEvent[]> {
  const results = await Promise.allSettled(sources.map((source) => Promise.resolve().then(() => source.collect())));
  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") return result.value;
    console.error(`[social] ${sources[index].name}: collection failed`, result.reason);
    return [];
  });
}
