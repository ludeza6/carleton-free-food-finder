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

function getEventStatus(
  startTime: string,
  endTime: string | null,
) {
  const now = new Date();
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : null;

  if (now < start) return "UPCOMING";

  if (!end || now <= end) {
    return "HAPPENING_NOW";
  }

  return "ENDED";
}

function statusLabel(status: string) {
  if (status === "HAPPENING_NOW") {
    return "Happening now";
  }

  if (status === "UPCOMING") {
    return "Upcoming";
  }

  return "Ended";
}

function statusClasses(status: string) {
  if (status === "HAPPENING_NOW") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "UPCOMING") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  }

  return "border-zinc-700 bg-zinc-800 text-zinc-400";
}

function truncateDescription(
  description: string,
  maxLength = 220,
) {
  if (description.length <= maxLength) {
    return description;
  }

  return `${description.slice(0, maxLength).trim()}…`;
}

export default function EventCard({
  event,
}: EventCardProps) {
  const status = getEventStatus(
    event.start_time,
    event.end_time,
  );

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-sm transition hover:border-zinc-700 hover:bg-zinc-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
                status,
              )}`}
            >
              {statusLabel(status)}
            </span>

            {event.food_type && (
              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300">
                {event.food_type}
              </span>
            )}

            {event.registration_required && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
                Registration required
              </span>
            )}
          </div>

          <h3 className="text-xl font-semibold leading-snug text-zinc-100">
            {event.title}
          </h3>

          <p className="mt-2 text-sm text-zinc-400">
            {event.building}
            {event.room &&
              ` · Room ${event.room}`}
          </p>
        </div>

        <div className="shrink-0 text-sm text-zinc-400 sm:text-right">
          <p>
            {formatOttawaTime(
              event.start_time,
            )}
          </p>

          {event.end_time && (
            <p className="mt-1 text-xs text-zinc-500">
              until{" "}
              {formatOttawaTime(
                event.end_time,
              )}
            </p>
          )}
        </div>
      </div>

      {event.description && (
        <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
          {truncateDescription(
            event.description,
          )}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
        {event.source_name ? (
          <p className="text-xs text-zinc-500">
            Source: {event.source_name}
          </p>
        ) : (
          <span />
        )}

        {event.source_url && (
          <a
            href={event.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-red-400 transition hover:text-red-300"
          >
            View source →
          </a>
        )}
      </div>
    </article>
  );
}