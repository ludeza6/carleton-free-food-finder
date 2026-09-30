import { collectAllCarletonEvents } from "./collect-all";
import { currentStudentsSources } from "./sources/current-students";

// Keep the original entry point compatible for existing callers.
export function collectCurrentStudentsEvents() {
  return collectAllCarletonEvents(currentStudentsSources);
}
