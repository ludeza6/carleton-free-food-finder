"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type EventItem = {
  id: number;
  title: string;
  building: string;
  start_time: string;
  end_time: string | null;
};

type ReportItem = {
  id: number;
  food_type: string;
  building: string;
};

const POLL_INTERVAL = 60_000;

function getStoredIds(key: string): number[] {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return [];
    }

    const parsed = JSON.parse(value);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function FoodNotificationWatcher() {
  const initialized = useRef(false);
  const router = useRouter();

  const checkForFood = useCallback(async () => {
    try {
      const [eventsResponse, reportsResponse] =
        await Promise.all([
          fetch("/api/events", {
            cache: "no-store",
          }),
          fetch("/api/reports", {
            cache: "no-store",
          }),
        ]);

      if (!eventsResponse.ok || !reportsResponse.ok) {
        return;
      }

      const allEvents =
        (await eventsResponse.json()) as EventItem[];

      const now = Date.now();

const events = allEvents.filter((event) => {
  const start = new Date(
    event.start_time,
  ).getTime();

  const end = event.end_time
    ? new Date(event.end_time).getTime()
    : start + 2 * 60 * 60 * 1000;

  return end >= now;
});

      const reports =
        (await reportsResponse.json()) as ReportItem[];

      const currentEventIds = events.map(
        (event) => event.id,
      );

      const currentReportIds = reports.map(
        (report) => report.id,
      );

      const storedEventIds = getStoredIds(
  "cf3-known-event-ids",
);

const storedReportIds = getStoredIds(
  "cf3-known-report-ids",
);

      if (!initialized.current) {
  const hasStoredState =
    localStorage.getItem(
      "cf3-notifications-initialized",
    ) === "true";

  if (!hasStoredState) {
    localStorage.setItem(
      "cf3-known-event-ids",
      JSON.stringify(currentEventIds),
    );

    localStorage.setItem(
      "cf3-known-report-ids",
      JSON.stringify(currentReportIds),
    );

    localStorage.setItem(
      "cf3-notifications-initialized",
      "true",
    );

    initialized.current = true;
    return;
  }

  initialized.current = true;
}

      const newEvents = events.filter(
        (event) =>
          !storedEventIds.includes(event.id),
      );

      const newReports = reports.filter(
        (report) =>
          !storedReportIds.includes(report.id),
      );

      if (Notification.permission === "granted") {
        for (const event of newEvents) {
          new Notification(
            `Free food: ${event.title}`,
            {
              body: `Reported at ${event.building}`,
            },
          );
        }

        for (const report of newReports) {
          new Notification(
            `Community food report: ${report.food_type}`,
            {
              body: `Food reported at ${report.building}`,
            },
          );
        }
        
      }

      if (newEvents.length > 0 || newReports.length > 0) {
  router.refresh();
}

      localStorage.setItem(
        "cf3-known-event-ids",
        JSON.stringify(currentEventIds),
      );

      localStorage.setItem(
        "cf3-known-report-ids",
        JSON.stringify(currentReportIds),
      );
    } catch (error) {
      console.error(
        "Failed to check for food notifications",
        error,
      );
    }
  }, [router]);

  useEffect(() => {
  checkForFood();

  const interval = window.setInterval(
    checkForFood,
    POLL_INTERVAL,
  );

  return () => {
    window.clearInterval(interval);
  };
}, [checkForFood]);

  return null;
}