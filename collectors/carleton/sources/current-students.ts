import type { CollectedEvent, EventSource } from "../../types";

type FeedSource = {
  url: string;
  sourceName: string;
};

const EVENT_FEEDS: FeedSource[] = [
  {
    url: "https://students.carleton.ca/wp-json/stu-api/v2/event-calendar-feed/",
    sourceName: "Carleton Current Students",
  },
  {
    url: "https://students.carleton.ca/wp-json/stu-api/v2/event-calendar-varsity/",
    sourceName: "Carleton Varsity",
  },
  {
    url: "https://students.carleton.ca/wp-json/stu-api/v2/event-calendar-academics/",
    sourceName: "Carleton Academics",
  },
];

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;
const REQUEST_TIMEOUT_MS = 15_000;

type CarletonFeedEvent = {
  id: number;
  title: string;
  start: string;
  end: string | null;
  description: string;
  url: string;
  type: string;
  tags_event_type: string[];
  location?: string | null;
};

export function parseLocation(location?: string | null) {
  if (!location) {
    return {
      building: null,
      room: null,
    };
  }

  const [buildingPart, roomPart] = location.split(" - ");

  return {
    building: buildingPart?.trim() || null,
    room: roomPart?.trim() || null,
  };
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function fetchWithRetry(
  feed: FeedSource,
  dependencies: CollectionDependencies,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await dependencies.fetch(feed.url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          "User-Agent": "CF3-Carleton-Free-Food-Finder/1.0",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `${feed.sourceName} returned HTTP ${response.status}`,
        );
      }

      return response;
    } catch (error) {
      lastError = error;

      console.warn(
        `Failed to fetch ${feed.sourceName} ` +
          `(attempt ${attempt}/${MAX_RETRIES})`,
      );

      if (attempt < MAX_RETRIES) {
        await dependencies.sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to fetch ${feed.sourceName}`);
}

async function fetchFeed(
  feed: FeedSource,
  dependencies: CollectionDependencies,
): Promise<CollectedEvent[]> {
  const response = await fetchWithRetry(feed, dependencies);

  const data = (await response.json()) as CarletonFeedEvent[];

  if (!Array.isArray(data)) {
    throw new Error(
      `${feed.sourceName} returned an unexpected response`,
    );
  }

  return data.map((event) => {
    const { building, room } = parseLocation(event.location);

    return {
      title: event.title,
      description: event.description || null,
      startTime: event.start,
      endTime: event.end || null,
      building,
      room,
      sourceName: feed.sourceName,
      sourceUrl: event.url,
    };
  });
}

type CollectionDependencies = {
  fetch: typeof fetch;
  sleep: (milliseconds: number) => Promise<unknown>;
};

// Dependencies can be replaced in tests without network calls or retry delays.
export function createCurrentStudentsSources(
  dependencies: CollectionDependencies = { fetch, sleep },
): EventSource[] {
  return EVENT_FEEDS.map((feed) => ({
    name: feed.sourceName,
    collect: () => fetchFeed(feed, dependencies),
  }));
}

export const currentStudentsSources = createCurrentStudentsSources();
