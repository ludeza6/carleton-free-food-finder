"use client";

import { useState } from "react";
import EventCard from "@/components/events/EventCard";
import { FoodEvent } from "@/types/event";

type Filter = "NOW" | "TODAY" | "UPCOMING" | "ALL";

type EventListProps = {
  events: FoodEvent[];
};

function isSameOttawaDay(dateString: string) {
  const eventDate = new Date(dateString);

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(eventDate) === formatter.format(new Date());
}

function isHappeningNow(event: FoodEvent) {
  const now = new Date();
  const start = new Date(event.start_time);
  const end = event.end_time ? new Date(event.end_time) : null;

  return now >= start && (!end || now <= end);
}

function isUpcoming(event: FoodEvent) {
  return new Date(event.start_time) > new Date();
}

export default function EventList({ events }: EventListProps) {
  const [filter, setFilter] = useState<Filter>("NOW");

  const filteredEvents = events.filter((event) => {
    switch (filter) {
      case "NOW":
        return isHappeningNow(event);

      case "TODAY":
        return isSameOttawaDay(event.start_time);

      case "UPCOMING":
        return isUpcoming(event);

      case "ALL":
        return true;
    }
  });

  return (
    <section className="mt-8">
      <div className="mb-6 flex flex-wrap gap-2">
        {(["NOW", "TODAY", "UPCOMING", "ALL"] as Filter[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            className={`rounded-md border px-4 py-2 text-sm font-medium ${
              filter === option
                ? "bg-white text-black"
                : "bg-transparent text-white"
            }`}
          >
            {option === "NOW" && "Now"}
            {option === "TODAY" && "Today"}
            {option === "UPCOMING" && "Upcoming"}
            {option === "ALL" && "All"}
          </button>
        ))}
      </div>

      {filteredEvents.length === 0 ? (
        <p className="opacity-70">No food events found.</p>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </section>
  );
}
