import type { CollectedEvent } from "./types";

export type FoodClassification = {
  hasFood: boolean;
  isFree: boolean;
  foodType: string | null;
  confidence: number;
};

// Specific foods precede meal names: a pizza dinner should be Pizza.
const FOOD_TYPES = [
  { label: "Pizza", pattern: /\bpizza\b/ },
  { label: "BBQ", pattern: /\b(?:bbq|barbecue|barbeque)\b/ },
  { label: "Coffee", pattern: /\bcoffee\b/ },
  { label: "Pastries", pattern: /\b(?:pastries|pastry)\b/ },
  { label: "Lunch", pattern: /\blunch\b/ },
  { label: "Dinner", pattern: /\bdinner\b/ },
  { label: "Breakfast", pattern: /\bbreakfast\b/ },
  { label: "Snacks", pattern: /\bsnacks?\b/ },
  { label: "Refreshments", pattern: /\brefreshments?\b/ },
  { label: "Meal", pattern: /\bmeals?\b/ },
  { label: "Drinks", pattern: /\b(?:drinks?|beverages?|pop|tea)\b/ },
];

const FOOD = "(?:food|meals?|pizza|bbq|barbecue|barbeque|lunch|dinner|breakfast|coffee|tea|snacks?|refreshments?|pastries|pastry|drinks?|beverages?|pop)";
const FOOD_ITEM = `${FOOD}(?: (?:lunch|dinner|meal))?`;
const FOOD_LIST = `${FOOD_ITEM}(?:(?:,? (?:and|&) |, )${FOOD_ITEM})*`;
const FREE_PATTERNS = [
  // A hyphen before free usually indicates a dietary claim, e.g. gluten-free.
  new RegExp(`(?<![\\w-])(?:free|complimentary) ${FOOD_LIST}\\b`, "g"),
  new RegExp(`\\b${FOOD_LIST} (?:will be |is |are )?(?:provided|included)\\b`, "g"),
  // Common university hospitality shorthand, even without "provided".
  /\bsnacks? (?:and|&) refreshments?\b/g,
];
const FOOD_KEYWORD = new RegExp(`\\b${FOOD}\\b`);

// Preserve conservative precedence, including mixed free and paid offerings.
const PAID_PATTERN = /\b(?:available for purchase|food for purchase|purchase food|food vendors|for sale|bring your own (?:lunch|food)|(?:food|meals?|pizza|lunch|dinner|breakfast|snacks?|refreshments?|drinks?|beverages?) (?:are |is )?(?:for purchase|sold separately|not included)|(?:food|meals?|pizza|lunch|dinner|breakfast) (?:costs?|at an additional cost))\b/;

function detectFoodType(text: string) {
  return FOOD_TYPES.find((food) => food.pattern.test(text))?.label ?? null;
}

function getFreeEvidence(text: string) {
  return FREE_PATTERNS.flatMap((pattern) =>
    [...text.matchAll(pattern)]
      .filter((match) => {
        const before = text.slice(0, match.index);
        const after = text.slice(match.index + match[0].length);
        return !/\b(?:no|not|without) (?:\w+ ){0,2}$/.test(before)
          && !/^ (?:will not be|(?:is|are) not|not)\b/.test(after)
          && !/^ (?:at (?:an? )?(?:additional )?(?:cost|charge)|for (?:purchase|a fee)|for \$|\$)/.test(after);
      })
      .map((match) => match[0]),
  );
}

export function classifyFoodEvent(event: CollectedEvent): FoodClassification {
  // Keep fields separate so a title ending in "free" cannot modify the description.
  const fields = [event.title, event.description ?? ""].map((text) =>
    text.toLowerCase().replace(/[\u2010-\u2015]/g, "-").replace(/\s+/g, " ").trim(),
  );
  const text = fields.join(". ");
  const foodType = detectFoodType(text);

  if (fields.some((field) => PAID_PATTERN.test(field))) {
    return { hasFood: true, isFree: false, foodType, confidence: 0.95 };
  }

  const evidence = fields.flatMap(getFreeEvidence);
  if (evidence.length > 0) {
    return {
      hasFood: true,
      isFree: true,
      foodType: detectFoodType(evidence.join(". ")) ?? foodType,
      confidence: 0.95,
    };
  }

  if (FOOD_KEYWORD.test(text)) {
    return { hasFood: true, isFree: false, foodType, confidence: 0.6 };
  }

  return { hasFood: false, isFree: false, foodType: null, confidence: 1 };
}

export function isLikelyFoodEvent(event: CollectedEvent) {
  const result = classifyFoodEvent(event);
  return result.hasFood && result.isFree;
}
