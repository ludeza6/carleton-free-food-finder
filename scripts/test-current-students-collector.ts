import { collectCurrentStudentsEvents } from "../collectors/carleton/current-students";
import { isLikelyFoodEvent } from "../collectors/food-detector";

async function main() {
  const events = await collectCurrentStudentsEvents();

  const foodEvents = events.filter(isLikelyFoodEvent);

  console.log(`Collected ${events.length} total events`);
  console.log(`Detected ${foodEvents.length} likely food events`);

  console.log(
    foodEvents.map((event) => ({
      title: event.title,
      startTime: event.startTime,
      building: event.building,
      room: event.room,
      sourceUrl: event.sourceUrl,
    })),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
