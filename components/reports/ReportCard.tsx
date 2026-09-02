"use client";

import {
  useEffect,
  useState,
} from "react";
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

function quantityClasses(
  quantity: FoodReport["quantity"],
) {
  switch (quantity) {
    case "lots":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

    case "some":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";

    case "almost_gone":
      return "border-red-500/30 bg-red-500/10 text-red-300";
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

function survivalClasses(score: number) {
  if (score >= 70) {
    return "text-emerald-300";
  }

  if (score >= 40) {
    return "text-amber-300";
  }

  return "text-red-300";
}

function formatReportTime(
  dateString: string,
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Toronto",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(new Date(dateString));
}

export default function ReportCard({
  report,
}: {
  report: FoodReport;
}) {
  const [
    currentReport,
    setCurrentReport,
  ] = useState(report);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [voted, setVoted] =
    useState(false);

  useEffect(() => {
    const hasVoted =
      localStorage.getItem(
        `cf3-report-vote-${report.id}`,
      ) === "true";

    setVoted(hasVoted);
  }, [report.id]);

  const survival =
    calculateSurvivalScore(
      currentReport,
    );

  async function confirmFood(
    vote:
      | "still_here"
      | "gone",
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
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          vote,
        }),
      },
    );

    if (!response.ok) {
      setSubmitting(false);
      return;
    }

    const updatedReport =
      (await response.json()) as FoodReport;

    setCurrentReport(
      updatedReport,
    );

    localStorage.setItem(
      `cf3-report-vote-${currentReport.id}`,
      "true",
    );

    setVoted(true);
    setSubmitting(false);

    if (
      updatedReport.status ===
      "gone"
    ) {
      window.location.reload();
    }
  }

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 transition hover:border-zinc-700">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${quantityClasses(
                currentReport.quantity,
              )}`}
            >
              {quantityLabel(
                currentReport.quantity,
              )}
            </span>

            <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
              Community report
            </span>
          </div>

          <h3 className="text-xl font-semibold text-zinc-100">
            {
              currentReport.food_type
            }
          </h3>

          <p className="mt-2 text-sm text-zinc-400">
            {
              currentReport.building
            }

            {currentReport.room &&
              ` · Room ${currentReport.room}`}
          </p>
        </div>

        <p className="text-xs text-zinc-500">
          Reported{" "}
          {formatReportTime(
            currentReport.created_at,
          )}
        </p>
      </div>

      {currentReport.notes && (
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          {currentReport.notes}
        </p>
      )}

      <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Food Survival Score
            </p>

            <p
              className={`mt-1 text-2xl font-bold ${survivalClasses(
                survival.score,
              )}`}
            >
              {survival.score}%
            </p>
          </div>

          <p className="text-right text-sm text-zinc-400">
            {survivalLabel(
              survival.score,
            )}
          </p>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-red-500 transition-all"
            style={{
              width: `${survival.score}%`,
            }}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={
            submitting ||
            voted
          }
          onClick={() =>
            confirmFood(
              "still_here",
            )
          }
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Still here ·{" "}
          {
            currentReport.still_here_count
          }
        </button>

        <button
          type="button"
          disabled={
            submitting ||
            voted
          }
          onClick={() =>
            confirmFood("gone")
          }
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Gone ·{" "}
          {
            currentReport.gone_count
          }
        </button>
      </div>

      {voted && (
        <p className="mt-3 text-xs text-zinc-500">
          Thanks for confirming
          this report.
        </p>
      )}
    </article>
  );
}