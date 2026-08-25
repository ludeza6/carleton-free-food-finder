import { CollectedEvent } from "./types";

const FOOD_KEYWORDS = [
  "free food",
  "food provided",
  "lunch provided",
  "dinner provided",
  "breakfast provided",
  "refreshments",
  "pizza",
  "bbq",
  "barbecue",
  "snacks",
  "coffee",
  "pastries",
  "meal",
  "lunch",
  "dinner",
  "breakfast",
];

const PAID_FOOD_PHRASES = [
  "available for purchase",
  "food for purchase",
  "purchase food",
  "food vendors",
  "bring your own lunch",
  "bring your own food",
];

export function isLikelyFoodEvent(event: CollectedEvent) {
  const text = [event.title, event.description ?? ""].join(" ").toLowerCase();

  const containsPaidFoodPhrase = PAID_FOOD_PHRASES.some((phrase) =>
    text.includes(phrase),
  );

  if (containsPaidFoodPhrase) {
    return false;
  }

  return FOOD_KEYWORDS.some((keyword) => text.includes(keyword));
}
