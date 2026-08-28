"use client";

import { useEffect, useState } from "react";
import { FoodReport } from "@/types/report";
import {
  calculateSurvivalScore,
} from "@/lib/reports/survival-score";

function quantityLabel(
  quantity: FoodReport["quantity"],
) {
  switch (quantity) {
    case "lots":
      return "Lots available";

    case "some":
      return "Some available";

    case "almost_gone":
      return "Almost gone";
  }
}

function survivalLabel(score: number) {
  if (score >= 70) {
    return "Very likely still there";
  }

  if (score >= 40) {
    return "May still be there";
  }

  return "Probably running out";
}

export default function ReportCard({
  report,
}: {
  report: FoodReport;
}) {
  const [currentReport, setCurrentReport] =
  useState(report);

const [submitting, setSubmitting] =
  useState(false);

const [voted, setVoted] = useState(false);

useEffect(() => {
  const hasVoted =
    localStorage.getItem(
      `cf3-report-vote-${report.id}`,
    ) === "true";

  setVoted(hasVoted);
}, [report.id]);

const survival =
  calculateSurvivalScore(currentReport);
  async function confirmFood(
    vote: "still_here" | "gone",
  ) {
    if (submitting || voted) {
      return;
    }

    setSubmitting(true);

    const response = await fetch(
      `/api/reports/${currentReport.id}/confirm`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vote }),
      },
    );

    if (!response.ok) {
      setSubmitting(false);
      return;
    }

    const updatedReport =
  (await response.json()) as FoodReport;

setCurrentReport(updatedReport);

localStorage.setItem(
  `cf3-report-vote-${currentReport.id}`,
  "true",
);

setVoted(true);
setSubmitting(false);

if (updatedReport.status === "gone") {
  window.location.reload();
}
  }

  return (
    <article className="rounded-lg border p-4">
      <h3 className="text-lg font-semibold">
        {currentReport.food_type}
      </h3>

      <p>
        {currentReport.building}

        {currentReport.room &&
          ` · Room ${currentReport.room}`}
      </p>

      <p className="mt-2">
        {quantityLabel(currentReport.quantity)}
      </p>

      {currentReport.notes && (
        <p className="mt-2 text-sm">
          {currentReport.notes}
        </p>
      )}

      <div className="mt-4">
        <p className="font-medium">
          Food Survival Score: {survival.score}%
        </p>

        <p className="text-sm opacity-70">
          {survivalLabel(survival.score)}
        </p>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          disabled={submitting || voted}
          onClick={() =>
            confirmFood("still_here")
          }
          className="rounded border px-3 py-2"
        >
          Still here (
          {currentReport.still_here_count})
        </button>

        <button
          type="button"
          disabled={submitting || voted}
          onClick={() => confirmFood("gone")}
          className="rounded border px-3 py-2"
        >
          Gone ({currentReport.gone_count})
        </button>
      </div>

      {voted && (
        <p className="mt-2 text-sm">
          Thanks for confirming.
        </p>
      )}
    </article>
  );
}