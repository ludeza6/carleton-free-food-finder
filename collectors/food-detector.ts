import { CollectedEvent } from "./types";

export type FoodClassification = {
  hasFood: boolean;
  isFree: boolean;
  foodType: string | null;
  confidence: number;
};

const FREE_PHRASES = [
  "free food",
  "free lunch",
  "free dinner",
  "free breakfast",
  "free pizza",
  "free snacks",
  "free refreshments",

  "food provided",
  "food will be provided",

  "lunch provided",
  "lunch will be provided",

  "dinner provided",
  "dinner will be provided",

  "breakfast provided",
  "breakfast will be provided",

  "refreshments provided",
  "refreshments will be provided",

  "snacks provided",
  "snacks will be provided",

  "pizza provided",
  "pizza will be provided",

  "complimentary food",
  "complimentary lunch",
  "complimentary dinner",
  "complimentary breakfast",
  "complimentary refreshments",
  "complimentary snacks",
];

const PAID_PHRASES = [
  "available for purchase",
  "food for purchase",
  "purchase food",
  "food vendors",
  "for sale",
  "bring your own lunch",
  "bring your own food",
];

const FOOD_TYPES: Array<{
  label: string;
  keywords: string[];
}> = [
  {
    label: "Pizza",
    keywords: ["pizza"],
  },
  {
    label: "BBQ",
    keywords: ["bbq", "barbecue"],
  },
  {
    label: "Lunch",
    keywords: ["lunch"],
  },
  {
    label: "Dinner",
    keywords: ["dinner"],
  },
  {
    label: "Breakfast",
    keywords: ["breakfast"],
  },
  {
    label: "Coffee",
    keywords: ["coffee"],
  },
  {
    label: "Snacks",
    keywords: ["snacks", "snack"],
  },
  {
    label: "Refreshments",
    keywords: ["refreshments", "refreshment"],
  },
  {
    label: "Pastries",
    keywords: ["pastries", "pastry"],
  },
];

const GENERIC_FOOD_KEYWORDS = [
  "food",
  "meal",
  "pizza",
  "bbq",
  "barbecue",
  "lunch",
  "dinner",
  "breakfast",
  "coffee",
  "snack",
  "snacks",
  "refreshments",
  "pastries",
];

function getEventText(event: CollectedEvent) {
  return [
    event.title,
    event.description ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function detectFoodType(text: string) {
  for (const food of FOOD_TYPES) {
    if (food.keywords.some((keyword) => text.includes(keyword))) {
      return food.label;
    }
  }

  return null;
}

export function classifyFoodEvent(
  event: CollectedEvent,
): FoodClassification {
  const text = getEventText(event);

  const hasPaidPhrase = PAID_PHRASES.some((phrase) =>
    text.includes(phrase),
  );

  if (hasPaidPhrase) {
    return {
      hasFood: true,
      isFree: false,
      foodType: detectFoodType(text),
      confidence: 0.95,
    };
  }

  const hasFreePhrase = FREE_PHRASES.some((phrase) =>
    text.includes(phrase),
  );

  const hasFoodKeyword = GENERIC_FOOD_KEYWORDS.some((keyword) =>
    text.includes(keyword),
  );

  const foodType = detectFoodType(text);

  if (hasFreePhrase) {
    return {
      hasFood: true,
      isFree: true,
      foodType,
      confidence: 0.95,
    };
  }

  if (hasFoodKeyword) {
    return {
      hasFood: true,
      isFree: false,
      foodType,
      confidence: 0.6,
    };
  }

  return {
    hasFood: false,
    isFree: false,
    foodType: null,
    confidence: 1,
  };
}

export function isLikelyFoodEvent(event: CollectedEvent) {
  const result = classifyFoodEvent(event);

  return result.hasFood && result.isFree;
}