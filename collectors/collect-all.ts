import { carletonSources, collectAllCarletonEvents } from "./carleton/collect-all";
import { collectAllSocialEvents } from "./social/collect-all";
import { createBlueskySources } from "./social/sources/bluesky";
import type { EventSource } from "./types";

export async function collectAllEventSources(
  official: readonly EventSource[] = carletonSources,
  social: readonly EventSource[] = createBlueskySources(),
) {
  const [officialEvents, socialEvents] = await Promise.all([
    collectAllCarletonEvents(official), collectAllSocialEvents(social),
  ]);
  return [...officialEvents, ...socialEvents];
}
