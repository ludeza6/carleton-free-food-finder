"use client";

import { useMemo, useState } from "react";
import EventCard from "@/components/events/EventCard";
import { FoodEvent } from "@/types/event";

type Filter = "NOW" | "TODAY" | "UPCOMING" | "ALL";

type EventListProps = {
  events: FoodEvent[];
};

const FILTERS: {
  value: Filter;
  label: string;
}[] = [
  { value: "NOW", label: "Now" },
  { value: "TODAY", label: "Today" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "ALL", label: "All" },
];

function isSameOttawaDay(dateString: string) {
  const eventDate = new Date(dateString);

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    formatter.format(eventDate) ===
    formatter.format(new Date())
  );
}

function isHappeningNow(event: FoodEvent) {
  const now = new Date();
  const start = new Date(event.start_time);
  const end = event.end_time
    ? new Date(event.end_time)
    : null;

  return now >= start && (!end || now <= end);
}

function isUpcoming(event: FoodEvent) {
  return new Date(event.start_time) > new Date();
}

export default function EventList({
  events,
}: EventListProps) {
  const [filter, setFilter] =
    useState<Filter>("NOW");

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      switch (filter) {
        case "NOW":
          return isHappeningNow(event);

        case "TODAY":
          return isSameOttawaDay(
            event.start_time,
          );

        case "UPCOMING":
          return isUpcoming(event);

        case "ALL":
          return true;
      }
    });
  }, [events, filter]);

  return (
    <div className="mt-7">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {FILTERS.map((option) => {
          const active =
            filter === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                setFilter(option.value)
              }
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-red-500 bg-red-500 text-white"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {filteredEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
          <p className="font-medium text-zinc-300">
            No food events found
          </p>

          <p className="mt-2 text-sm text-zinc-500">
            Try another filter or check
            back later.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
            />
          ))}
        </div>
      )}
    </div>
  );
}