export type CollectedEvent = {
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  building: string | null;
  room: string | null;
  sourceName: string;
  sourceUrl: string;
};

export type EventSource = {
  name: string;
  collect(): Promise<CollectedEvent[]>;
};
