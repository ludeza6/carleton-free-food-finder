import { CollectedEvent } from "../types";

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

function parseLocation(location?: string | null) {
  if (!location) {
    return {
      building: null,
      room: null,
    };
  }

  const [buildingPart, roomPart] = location.split(" - ");

  const building = buildingPart?.trim() || null;
  const room = roomPart?.trim() || null;

  return {
    building,
    room,
  };
}

async function fetchFeed(
  feed: FeedSource,
): Promise<CollectedEvent[]> {
  const response = await fetch(feed.url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${feed.sourceName} feed: ${response.status}`,
    );
  }

  const data =
    (await response.json()) as CarletonFeedEvent[];

  return data.map((event) => {
    const { building, room } =
      parseLocation(event.location);

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

export async function collectCurrentStudentsEvents(): Promise<
  CollectedEvent[]
> {
  const results = await Promise.all(
    EVENT_FEEDS.map((feed) => fetchFeed(feed)),
  );

  const allEvents = results.flat();

  const uniqueEvents = Array.from(
    new Map(
      allEvents.map((event) => [
        event.sourceUrl,
        event,
      ]),
    ).values(),
  );

  return uniqueEvents;
}