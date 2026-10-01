import { createCalendarSource, type CalendarDependencies } from "./wordpress-calendar";

export const GO_ISSO_SOURCE_NAME = "Carleton Global Opportunities & International Student Services Office";
// Discovered from /go-isso/events/ -> api.w.org -> advertised REST routes.
// See GO-ISSO-SOURCE.md for verification and field mapping.
export const GO_ISSO_CALENDAR_URL =
  "https://carleton.ca/go-isso/wp-json/cutheme/v1/cu-calendar";

export function createGoIssoSource(dependencies?: CalendarDependencies) {
  return createCalendarSource({
    sourceName: GO_ISSO_SOURCE_NAME,
    calendarUrl: GO_ISSO_CALENDAR_URL,
    detailUrl: "https://carleton.ca/go-isso/wp-json/wp/v2/cu_event/",
  }, dependencies);
}

export const goIssoSource = createGoIssoSource();
