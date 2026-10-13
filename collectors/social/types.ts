export type { CollectedEvent, EventSource as SocialSource } from "../types";

export type SocialPost = {
  text: string;
  sourceUrl: string;
  postedAt: string;
  sourceName: string;
};
