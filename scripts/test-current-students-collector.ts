import { collectCurrentStudentsEvents } from "../collectors/carleton/current-students";
import { classifyFoodEvent } from "../collectors/food-detector";

async function main() {
  const events = await collectCurrentStudentsEvents();

  console.log(`Collected ${events.length} total events\n`);

  for (const event of events) {
    const classification = classifyFoodEvent(event);

    if (classification.hasFood) {
      console.log({
        title: event.title,
        foodType: classification.foodType,
        isFree: classification.isFree,
        confidence: classification.confidence,
      });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});