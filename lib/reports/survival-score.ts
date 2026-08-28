import { FoodReport } from "@/types/report";

export type SurvivalLevel = "high" | "medium" | "low";

export type SurvivalScore = {
  score: number;
  level: SurvivalLevel;
};

function quantityBase(quantity: FoodReport["quantity"]) {
  switch (quantity) {
    case "lots":
      return 90;
    case "some":
      return 70;
    case "almost_gone":
      return 45;
  }
}

export function calculateSurvivalScore(
  report: FoodReport,
): SurvivalScore {
  const createdAt = new Date(report.created_at).getTime();
  const now = Date.now();

  const ageMinutes = Math.max(
    0,
    (now - createdAt) / (1000 * 60),
  );

  let score = quantityBase(report.quantity);

  // Food becomes less likely to remain as time passes.
  score -= ageMinutes * 0.5;

  // Community confirmations.
  score += report.still_here_count * 8;
  score -= report.gone_count * 15;

  // A recent positive confirmation is especially useful.
  if (report.last_confirmed_at) {
    const confirmedAt = new Date(
      report.last_confirmed_at,
    ).getTime();

    const confirmationAgeMinutes =
      (now - confirmedAt) / (1000 * 60);

    if (confirmationAgeMinutes <= 15) {
      score += 10;
    }
  }

  score = Math.round(
    Math.max(0, Math.min(100, score)),
  );

  let level: SurvivalLevel;

  if (score >= 70) {
    level = "high";
  } else if (score >= 40) {
    level = "medium";
  } else {
    level = "low";
  }

  return {
    score,
    level,
  };
}