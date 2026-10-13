import { classifyFoodEvent } from "../food-detector";
import type { CollectedEvent } from "../types";
import { parseTorontoDateTime } from "../carleton/sources/wordpress-calendar";
import type { SocialPost } from "./types";

const DAY = 86_400_000;
const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const buildings = ["University Centre", "Nideyinàn", "Teraanga Commons", "Richcraft Hall", "Nicol Building", "MacOdrum Library", "Minto Centre", "Dunton Tower", "Southam Hall", "Azrieli Theatre", "Loeb Building", "Canal Building", "Tory Building", "Mackenzie Building"];

export type Extraction = { event: CollectedEvent; reason?: never } | { event: null; reason: string };

// Relative dates refer to the author's publication day, never the ingestion day.
export function extractSocialEvent(post: SocialPost, now = new Date()): Extraction {
  const event: CollectedEvent = {
    title: post.text.split(/\n|\.\s/)[0].trim(), description: post.text,
    startTime: "", endTime: null, building: null, room: null,
    sourceName: post.sourceName, sourceUrl: post.sourceUrl,
  };
  const food = classifyFoodEvent(event);
  if (!food.hasFood || !food.isFree) return { event: null, reason: "No free-food evidence (or paid food)" };
  const posted = Date.parse(post.postedAt);
  if (!Number.isFinite(posted)) return { event: null, reason: "Invalid publication time" };
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(posted).map(({ type, value }) => [type, value]));
  const base = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
  const text = post.text.toLowerCase().replace(/[–—]/g, "-");
  const datePattern = new RegExp(`\\b(today|tomorrow|${weekdays.join("|")}|(?:${months.map((m) => `${m}|${m.slice(0, 3)}`).join("|")})\\.? \\d{1,2}(?:,? \\d{4})?)\\b`, "g");
  const dates = [...text.matchAll(datePattern)];
  // Numeric dates, multiple dates and qualified weekdays are deliberately unsupported.
  if (dates.length !== 1 || /\b\d{1,2}\/\d{1,2}\b|\b(?:next|last|this)\s+(?:sun|mon|tues|wednes|thurs|fri|satur)day\b/.test(text)) {
    return { event: null, reason: "Missing or ambiguous event date" };
  }
  const dateText = dates[0][0];
  let date = new Date(base);
  if (dateText === "tomorrow") date = new Date(+base + DAY);
  else if (weekdays.includes(dateText)) date = new Date(+base + ((weekdays.indexOf(dateText) - base.getUTCDay() + 7) % 7) * DAY);
  else if (dateText !== "today") {
    const match = /^(\w+)\.? (\d{1,2})(?:,? (\d{4}))?$/.exec(dateText)!;
    const month = months.findIndex((m) => m === match[1] || m.slice(0, 3) === match[1]);
    date = new Date(Date.UTC(Number(match[3] ?? parts.year), month, Number(match[2])));
    if (date.getUTCMonth() !== month || date.getUTCDate() !== Number(match[2])) return { event: null, reason: "Invalid event date" };
    // Never infer a year rollover from an announcement.
  }
  const times = [...text.matchAll(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)?\s*-\s*(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b|\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/g)];
  if (times.length !== 1) return { event: null, reason: "Missing or ambiguous event time" };
  const time = times[0];
  const range = Boolean(time[4]);
  // A shared meridiem is safe only for an ascending range within that half-day.
  if (range && !time[3] && Number(time[1]) >= Number(time[4])) return { event: null, reason: "Ambiguous time range" };
  function wallTime(hour: string, minute: string | undefined, meridiem: string) {
    const h = Number(hour);
    if (h < 1 || h > 12) throw new Error("Invalid hour");
    return parseTorontoDateTime(`${date.toISOString().slice(0, 10)} ${String(h % 12 + (meridiem === "pm" ? 12 : 0)).padStart(2, "0")}:${minute ?? "00"}:00`);
  }
  try {
    event.startTime = range ? wallTime(time[1], time[2], time[3] ?? time[6]) : wallTime(time[7], time[8], time[9]);
    if (range) {
      event.endTime = wallTime(time[4], time[5], time[6]);
      if (event.endTime <= event.startTime) throw new Error("Invalid range");
    }
  } catch {
    return { event: null, reason: "Invalid, ambiguous or nonexistent Toronto time" };
  }
  const start = Date.parse(event.startTime);
  if (start < now.getTime() - DAY || start > now.getTime() + 366 * DAY || start < posted - DAY) return { event: null, reason: "Event outside future/recent window" };
  const locations = buildings.filter((building) => text.includes(building.toLowerCase()));
  if (locations.length > 1) return { event: null, reason: "Ambiguous location" };
  event.building = locations[0] ?? null;
  event.room = /\broom\s+([a-z]?\d{1,4}[a-z]?)\b/i.exec(post.text)?.[1] ?? null;
  return { event };
}
