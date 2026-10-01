import { createCalendarSource, type CalendarDependencies } from "./wordpress-calendar";

export const STUDENT_EXPERIENCE_SOURCE_NAME = "Carleton Student Experience Office";
// Discovered from /seo/events/ -> api.w.org -> advertised REST routes.
// See STUDENT-EXPERIENCE-SOURCE.md for verification and field mapping.
export const STUDENT_EXPERIENCE_CALENDAR_URL =
  "https://carleton.ca/seo/wp-json/cutheme/v1/cu-calendar";

export function createStudentExperienceSource(dependencies?: CalendarDependencies) {
  return createCalendarSource({
    sourceName: STUDENT_EXPERIENCE_SOURCE_NAME,
    calendarUrl: STUDENT_EXPERIENCE_CALENDAR_URL,
    detailUrl: "https://carleton.ca/seo/wp-json/wp/v2/cu_event/",
  }, dependencies);
}

export const studentExperienceSource = createStudentExperienceSource();
