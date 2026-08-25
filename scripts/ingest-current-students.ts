import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { ingestCurrentStudentsFoodEvents } from "../collectors/carleton/ingest";

async function main() {
  const result = await ingestCurrentStudentsFoodEvents();

  console.log("\nIngestion complete");
  console.log("------------------");
  console.log(`Collected: ${result.collected}`);
  console.log(`Detected:  ${result.detected}`);
  console.log(`Stored:    ${result.stored}`);

  if (result.events) {
    console.log("\nStored events:");

    for (const event of result.events) {
      console.log(`- ${event.title}`);
    }
  }
}

main().catch((error) => {
  console.error("\nIngestion failed");
  console.error(error);
  process.exit(1);
});
