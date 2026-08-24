import { FoodEvent } from "@/types/event";

type EventCardProps = {
  event: FoodEvent;
};

function formatOttawaTime(dateString: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function getEventStatus(startTime: string, endTime: string | null) {
  const now = new Date();
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : null;

  if (now < start) return "UPCOMING";

  if (!end || now <= end) return "HAPPENING_NOW";

  return "ENDED";
}

export default function EventCard({ event }: EventCardProps) {
  const status = getEventStatus(event.start_time, event.end_time);

  return (
    <article className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{event.title}</h2>

          <p className="mt-1">
            {event.building}
            {event.room && ` · Room ${event.room}`}
          </p>
        </div>

        <span className="text-sm font-semibold">{status}</span>
      </div>

      <p className="mt-3">
        {formatOttawaTime(event.start_time)}
        {event.end_time && ` → ${formatOttawaTime(event.end_time)}`}
      </p>

      {event.food_type && (
        <p className="mt-3">
          <strong>Food:</strong> {event.food_type}
        </p>
      )}

      {event.description && <p className="mt-3 text-sm">{event.description}</p>}

      {event.registration_required && (
        <p className="mt-3 text-sm font-medium">Registration required</p>
      )}

      {event.source_name && (
        <p className="mt-3 text-xs opacity-70">Source: {event.source_name}</p>
      )}
    </article>
  );
}
