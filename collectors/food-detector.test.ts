import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyFoodEvent, isLikelyFoodEvent } from "./food-detector";
import type { CollectedEvent } from "./types";

function event(description: string | null, title = "Campus event"): CollectedEvent {
  return {
    title, description, startTime: "2026-10-01T12:00:00Z", endTime: null,
    building: null, room: null, sourceName: "Test", sourceUrl: "https://example.test/event",
  };
}

const freeCases: Array<[string, string | null]> = [
  ["free food", null], ["free lunch", "Lunch"], ["free dinner", "Dinner"],
  ["free breakfast", "Breakfast"], ["free snacks", "Snacks"],
  ["free refreshments", "Refreshments"], ["free pizza", "Pizza"],
  ["complimentary food", null], ["complimentary dinner", "Dinner"],
  ["complimentary lunch", "Lunch"], ["complimentary breakfast", "Breakfast"],
  ["complimentary snacks", "Snacks"], ["complimentary refreshments", "Refreshments"],
  ["pizza dinner provided", "Pizza"], ["dinner provided", "Dinner"],
  ["food and drink provided", "Drinks"], ["food and drinks provided", "Drinks"],
  ["food and beverages provided", "Drinks"], ["snacks and refreshments", "Snacks"],
  ["refreshments provided", "Refreshments"], ["lunch included", "Lunch"],
  ["meal included", "Meal"], ["free pizza and pop", "Pizza"],
  ["free pizza and drinks", "Pizza"], ["free BBQ", "BBQ"],
  ["FREE\nPIZZA\tAND DRINKS!", "Pizza"], ["Food & beverages will be provided.", "Drinks"],
  ["Complimentary coffee and pastries", "Coffee"], ["Free barbeque", "BBQ"],
  ["Lunch with complimentary pastries", "Pastries"],
  ["Pizza discussion with free snacks", "Snacks"],
  ...["food", "lunch", "dinner", "breakfast", "refreshments", "snacks", "pizza"].flatMap(
    (food): Array<[string, string | null]> => [
      [`${food} provided`, food === "food" ? null : food[0].toUpperCase() + food.slice(1)],
      [`${food} will be provided`, food === "food" ? null : food[0].toUpperCase() + food.slice(1)],
    ],
  ),
];
for (const [phrase, foodType] of freeCases) {
  test(`free food: ${phrase}`, () => {
    assert.deepEqual(classifyFoodEvent(event(phrase)), {
      hasFood: true, isFree: true, foodType, confidence: 0.95,
    });
    assert.equal(isLikelyFoodEvent(event(null, phrase)), true);
  });
}

for (const phrase of [
  "Pizza available for purchase", "Food for purchase", "Purchase food on campus",
  "Food vendors", "Lunch for sale", "Bring your own lunch", "Bring your own food",
  "Free pizza. Drinks available for purchase", "Complimentary dinner. Food for sale",
  "Lunch included. Dinner sold separately", "Free admission. Food is not included",
]) {
  test(`paid priority: ${phrase}`, () => {
    const result = classifyFoodEvent(event(phrase));
    assert.equal(result.hasFood, true);
    assert.equal(result.isFree, false);
    assert.equal(result.confidence, 0.95);
    assert.equal(isLikelyFoodEvent(event(phrase)), false);
  });
}

for (const phrase of [
  "food court", "food services", "food available", "Pizza party",
  "Free admission at the food court", "Free parking. Food available",
  "Feel free to bring lunch", "Gluten-free pizza", "Dairy–free snacks",
  "Sugar-free refreshments", "No free pizza", "No complimentary lunch",
  "Lunch will not be provided", "No snacks and refreshments",
  "Snacks and refreshments will not be provided", "Snacks and refreshments are not included",
  "Dinner provided at an additional cost", "Lunch provided for $10",
  "Meal included for a fee", "Pizza provided for purchase",
]) {
  test(`not evidence of free food: ${phrase}`, () => {
    assert.equal(classifyFoodEvent(event(phrase)).hasFood, true);
    assert.equal(isLikelyFoodEvent(event(phrase)), false);
  });
}

for (const phrase of [null, "", "Free admission to a lecture", "A freedom workshop", "Team meeting", "Coffeemaking equipment", "Lunchbox design"]) {
  test(`no food: ${phrase}`, () => {
    assert.deepEqual(classifyFoodEvent(event(phrase)), {
      hasFood: false, isFree: false, foodType: null, confidence: 1,
    });
  });
}

test("does not join a title's unrelated free with description food", () => {
  assert.equal(isLikelyFoodEvent(event("Pizza available", "Entry is free")), false);
});

test("explicit evidence can accompany generic mentions", () => {
  assert.equal(isLikelyFoodEvent(event("Meet at the food court. Complimentary dinner.")), true);
});
