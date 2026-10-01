import type { CollectedEvent, EventSource } from "../../types";
import { renderedHtmlToText } from "../../html-text";

const torontoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function localParts(timestamp: number): string {
  const parts = Object.fromEntries(
    torontoFormatter.formatToParts(timestamp).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

// The public REST index specifies America/Toronto. Do not let the host's
// timezone interpret these ACF wall-clock values, or assume a fixed UTC offset.
export function parseTorontoDateTime(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(value)) {
    throw new Error("Invalid Carleton calendar event timestamp");
  }
  const local = value.replace(" ", "T");
  const nominal = Date.parse(`${local}Z`);
  if (!Number.isFinite(nominal) || new Date(nominal).toISOString().slice(0, 19) !== local) {
    throw new Error(`Invalid event date: ${value}`);
  }
  const matches = new Set<number>();
  // Sample both sides of a possible DST transition, then round-trip candidates.
  for (const delta of [-86_400_000, 86_400_000]) {
    const probe = nominal + delta;
    const offset = Date.parse(`${localParts(probe)}Z`) - probe;
    const candidate = nominal - offset;
    if (localParts(candidate) === local) matches.add(candidate);
  }
  if (matches.size !== 1) {
    throw new Error(`Ambiguous or nonexistent Toronto event time: ${value}`);
  }
  return new Date([...matches][0]).toISOString();
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

export function parseCalendarEvent(value: unknown, sourceName: string): {
  id: number;
  event: CollectedEvent;
} {
  const item = record(value);
  const title = text(item.title);
  const link = text(item.link);
  if (!Number.isSafeInteger(item.id) || (item.id as number) <= 0 || !title || !link) {
    throw new Error("Invalid Carleton calendar entry");
  }
  const sourceUrl = new URL(link);
  if (!["http:", "https:"].includes(sourceUrl.protocol)) {
    throw new Error("Invalid event URL");
  }
  const startTime = parseTorontoDateTime(item.cu_event_start_date);
  const endValue = text(item.cu_event_end_date);
  const endTime = endValue ? parseTorontoDateTime(endValue) : null;
  if (endTime && endTime < startTime) throw new Error("Event ends before it starts");

  const inPerson = record(item.cu_event_location_type).value === "in-person";
  const onCampus = record(item.cu_event_meeting_address_type).value === "on-campus";
  // TBD/virtual entries can retain stale physical location fields in WordPress.
  const building = !inPerson ? null : onCampus
    ? text(record(item.cu_building).label)
    : text(item.cu_event_meeting_address_full) ??
      text(record(item.cu_event_meeting_address_full).address);

  return {
    id: item.id as number,
    event: {
      title: renderedHtmlToText(title), description: null,
      startTime, endTime, building,
      room: inPerson ? text(item.cu_event_meeting_room) : null,
      sourceName, sourceUrl: sourceUrl.href,
    },
  };
}

export function parseCalendarDescription(value: unknown, expectedId: number): string | null {
  const detail = record(value);
  const content = record(detail.content);
  if (detail.id !== expectedId || typeof content.rendered !== "string" || content.protected === true) {
    throw new Error(`Invalid or protected Carleton calendar detail for ${expectedId}`);
  }
  return renderedHtmlToText(content.rendered) || null;
}

export type CalendarDependencies = {
  fetch: typeof fetch;
  sleep: (milliseconds: number) => Promise<unknown>;
  now: () => number;
};

async function fetchJson(url: string, dependencies: CalendarDependencies, sourceName: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await dependencies.fetch(url, {
        signal: AbortSignal.timeout(15_000),
        headers: { "User-Agent": "CF3-Carleton-Free-Food-Finder/1.0", Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
      // Read the body inside the retry block: timeouts can occur after headers.
      return await response.json();
    } catch (error) {
      console.warn(`${sourceName}: request failed (attempt ${attempt}/3)`, url);
      if (attempt === 3) throw error;
      await dependencies.sleep(2_000 * attempt);
    }
  }
}

export function createCalendarSource(
  config: { sourceName: string; calendarUrl: string; detailUrl: string },
  dependencies: CalendarDependencies = {
    fetch,
    sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    now: Date.now,
  },
): EventSource {
  const { sourceName, calendarUrl, detailUrl } = config;
  return {
    name: sourceName,
    async collect() {
      const calendar = record(await fetchJson(calendarUrl, dependencies, sourceName));
      if (!Array.isArray(calendar.posts)) throw new Error("Invalid Carleton calendar response");
      // The advertised calendar returns all posts (per_page=-1). Fail explicitly
      // if it changes to a truncated feed, rather than silently losing events.
      const total = record(calendar.pagination).total;
      if (typeof total !== "number" || total !== calendar.posts.length) {
        throw new Error("Incomplete Carleton calendar response");
      }
      const now = dependencies.now();
      const upcoming = new Map<number, ReturnType<typeof parseCalendarEvent>>();
      let validEntries = 0;
      for (const item of calendar.posts) {
        try {
          const parsed = parseCalendarEvent(item, sourceName);
          validEntries++;
          const end = parsed.event.endTime
            ? Date.parse(parsed.event.endTime) : Date.parse(parsed.event.startTime);
          if (end >= now) upcoming.set(parsed.id, parsed);
        } catch (error) {
          console.warn(`${sourceName}: skipped invalid calendar entry`, record(item).id, error);
        }
      }
      if (calendar.posts.length > 0 && validEntries === 0) {
        throw new Error("All Carleton calendar entries are invalid");
      }
      const events: CollectedEvent[] = [];
      const entries = [...upcoming.values()];
      // Limit detail requests to four at a time; retain healthy events on partial failure.
      for (let offset = 0; offset < entries.length; offset += 4) {
        const batch = entries.slice(offset, offset + 4);
        const results = await Promise.allSettled(batch.map(async ({ id, event }) => ({
          ...event,
          description: parseCalendarDescription(await fetchJson(
            `${detailUrl}${id}?_fields=id,content`, dependencies, sourceName,
          ), id),
        })));
        results.forEach((result, index) => {
          if (result.status === "fulfilled") events.push(result.value);
          else console.warn(`${sourceName}: detail failed for ${batch[index].event.sourceUrl}`, result.reason);
        });
      }
      if (entries.length > 0 && events.length === 0) {
        throw new Error("All Carleton calendar event details failed");
      }
      return events;
    },
  };
}

