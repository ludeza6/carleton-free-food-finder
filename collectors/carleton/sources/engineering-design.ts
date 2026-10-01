import { createCalendarSource, parseCalendarEvent, type CalendarDependencies } from "./wordpress-calendar";
export { parseTorontoDateTime, parseCalendarDescription as parseEngineeringDescription } from "./wordpress-calendar";

export const ENGINEERING_SOURCE_NAME = "Carleton Faculty of Engineering and Design";
// Both routes are advertised by the page-linked REST index. See SOURCE.md.
export const ENGINEERING_CALENDAR_URL =
  "https://carleton.ca/engineering-design/wp-json/cutheme/v1/cu-calendar";

export function parseEngineeringCalendarEvent(value: unknown) {
  return parseCalendarEvent(value, ENGINEERING_SOURCE_NAME);
}

export function createEngineeringDesignSource(dependencies?: CalendarDependencies) {
  return createCalendarSource({
    sourceName: ENGINEERING_SOURCE_NAME,
    calendarUrl: ENGINEERING_CALENDAR_URL,
    detailUrl: "https://carleton.ca/engineering-design/wp-json/wp/v2/cu_event/",
  }, dependencies);
}

export const engineeringDesignSource = createEngineeringDesignSource();
