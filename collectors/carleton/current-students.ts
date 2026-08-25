import { CollectedEvent } from "../types";

const EVENTS_FEED_URL =
  "https://students.carleton.ca/wp-json/stu-api/v2/event-calendar-feed/";

type CarletonFeedEvent = {
  id: number;
  title: string;
  start: string;
  end: string | null;
  description: string;
  url: string;
  type: string;
  tags_event_type: string[];
  location: string;
};

function parseLocation(location: string) {
  const [buildingPart, roomPart] = location.split(" - ");

  const building = buildingPart?.trim() || null;
  const room = roomPart?.trim() || null;

  return {
    building,
    room,
  };
}

export async function collectCurrentStudentsEvents(): Promise<
  CollectedEvent[]
> {
  const response = await fetch(EVENTS_FEED_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Current Students event feed: ${response.status}`,
    );
  }

  const data = (await response.json()) as CarletonFeedEvent[];

  return data.map((event) => {
    const { building, room } = parseLocation(event.location);

    return {
      title: event.title,
      description: event.description || null,
      startTime: event.start,
      endTime: event.end || null,
      building,
      room,
      sourceName: "Carleton Current Students",
      sourceUrl: event.url,
    };
  });
}
