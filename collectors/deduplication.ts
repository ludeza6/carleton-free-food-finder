import type { CollectedEvent } from "./types";

// Exact URLs match the database uniqueness constraint. Preserve the existing
// last-source-wins policy in configured source order, not completion order.
export function deduplicateEventsBySourceUrl(
  events: readonly CollectedEvent[],
): CollectedEvent[] {
  return Array.from(
    new Map(events.map((event) => [event.sourceUrl, event])).values(),
  );
}

function normalizeText(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

// Prepared for future cross-source matching; deliberately not used to drop
// events or as a database key. Similar events may still be distinct occurrences.
export function createEventFingerprint(
  event: Pick<CollectedEvent, "title" | "startTime" | "building">,
): string {
  const startTime = event.startTime.trim();
  const timestamp = Date.parse(startTime);
  // Only convert explicitly zoned times to UTC. Unzoned feed values must not
  // acquire the timezone of the machine running the collector.
  const normalizedStart = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(startTime) &&
    Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : startTime;

  return JSON.stringify([
    normalizeText(event.title),
    normalizedStart,
    normalizeText(event.building ?? ""),
  ]);
}
