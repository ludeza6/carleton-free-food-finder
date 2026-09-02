import { createClient } from "@/lib/supabase/server";
import { FoodEvent } from "@/types/event";
import { Suspense } from "react";
import EventList from "@/components/events/EventList";
import ReportForm from "@/components/reports/ReportForm";
import ReportCard from "@/components/reports/ReportCard";
import { FoodReport } from "@/types/report";
import NotificationButton from "@/components/notifications/NotificationButton";
import FoodNotificationWatcher from "@/components/notifications/FoodNotificationWatcher";

async function FoodEvents() {
  const supabase = await createClient();

  const { data: events, error } = await supabase
    .from("food_events")
    .select(
      `
      id,
      title,
      description,
      start_time,
      end_time,
      building,
      room,
      latitude,
      longitude,
      food_type,
      is_free,
      registration_required,
      source_name,
      source_url,
      confidence
      `,
    )
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Failed to load food events:", error);

    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-8">
        <p className="font-medium text-red-300">
          Could not load official events.
        </p>

        <p className="mt-2 text-sm text-zinc-500">
          Try refreshing the page in a moment.
        </p>
      </div>
    );
  }

  const foodEvents = (events ?? []) as FoodEvent[];

  return <EventList events={foodEvents} />;
}

async function CommunityReports() {
  const supabase = await createClient();

  const { data: reports, error } = await supabase
    .from("food_reports")
    .select("*")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load community reports:", error);

    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
        <p className="text-sm text-red-300">
          Could not load community reports.
        </p>
      </div>
    );
  }

  const foodReports = (reports ?? []) as FoodReport[];

  if (foodReports.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-10 text-center">
        <p className="font-medium text-zinc-300">
          No active sightings right now
        </p>

        <p className="mt-2 text-sm text-zinc-500">
          Spot some free food? Be the first to report it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {foodReports.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
        />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <FoodNotificationWatcher />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-red-400" />

                <span className="text-xs font-medium text-red-300">
                  Live campus food radar
                </span>
              </div>

              <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-red-400">
                Carleton University
              </p>

              <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
                CF3
              </h1>

              <p className="mt-3 text-xl font-medium text-zinc-200">
                Carleton Free Food Finder
              </p>

              <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">
                Find free food on campus from official Carleton event feeds and
                real-time student reports.
              </p>
            </div>

            <div className="shrink-0">
              <NotificationButton />
            </div>
          </div>
        </header>

        <div className="mb-12 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-sm font-medium text-zinc-200">
              Official events
            </p>

            <p className="mt-1 text-xs leading-5 text-zinc-500">
              CF3 automatically checks Carleton event feeds for free-food
              opportunities.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-sm font-medium text-zinc-200">
              Community sightings
            </p>

            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Students can report food they find around campus in real time.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-sm font-medium text-zinc-200">
              Live confirmations
            </p>

            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Community votes help estimate whether food is still available.
            </p>
          </div>
        </div>

        <section>
          <div className="mb-5">
            <h2 className="text-2xl font-semibold">
              Official food opportunities
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              Automatically discovered from Carleton event sources.
            </p>
          </div>

          <Suspense
            fallback={
              <div className="space-y-4">
                {[1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-40 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/50"
                  />
                ))}
              </div>
            }
          >
            <FoodEvents />
          </Suspense>
        </section>

        <section className="mt-16">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">
              Community sightings
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              Student-submitted reports of food available right now.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <div>
              <Suspense
                fallback={
                  <div className="space-y-4">
                    {[1, 2].map((item) => (
                      <div
                        key={item}
                        className="h-48 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/50"
                      />
                    ))}
                  </div>
                }
              >
                <CommunityReports />
              </Suspense>
            </div>

            <div>
              <ReportForm />
            </div>
          </div>
        </section>

        <footer className="mt-20 border-t border-zinc-900 py-8">
          <div className="flex flex-col gap-3 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-zinc-500">
                CF3 · Carleton Free Food Finder
              </p>

              <p className="mt-1">
                Built for Carleton University students.
              </p>
            </div>

            <p>
              Next.js · Supabase · GitHub Actions
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}