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

// Shared cross-source identity component; room and source checks are applied
// separately. This is not a database key.
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

// Deliberately conservative: no fuzzy title/location matching or unzoned dates.
export function isCrossSourceDuplicate(a: CollectedEvent, b: CollectedEvent): boolean {
  return a.sourceName !== b.sourceName &&
    a.sourceName.startsWith("Carleton ") && b.sourceName.startsWith("Carleton ") &&
    Boolean(a.building?.trim() && b.building?.trim()) &&
    [a, b].every((event) => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(event.startTime) &&
      Number.isFinite(Date.parse(event.startTime))) &&
    createEventFingerprint(a) === createEventFingerprint(b) &&
    normalizeText(a.room ?? "") === normalizeText(b.room ?? "");
}

export function deduplicateCarletonEvents(events: readonly CollectedEvent[]): CollectedEvent[] {
  const unique: CollectedEvent[] = [];
  for (const event of deduplicateEventsBySourceUrl(events)) {
    if (!unique.some((prior) => isCrossSourceDuplicate(prior, event))) unique.push(event);
  }
  return unique;
}
