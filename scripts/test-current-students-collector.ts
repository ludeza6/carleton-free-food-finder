import { collectAllCarletonEvents } from "../collectors/carleton/collect-all";
import { classifyFoodEvent } from "../collectors/food-detector";

async function main() {
  const events =
    await collectAllCarletonEvents();

  console.log(
    `Collected ${events.length} total events\n`,
  );

  for (const event of events) {
    const classification =
      classifyFoodEvent(event);

    if (classification.hasFood) {
      console.log({
        title: event.title,
        source: event.sourceName,
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