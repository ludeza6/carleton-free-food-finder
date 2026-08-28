import { createClient } from "@/lib/supabase/server";
import { FoodEvent } from "@/types/event";
import { Suspense } from "react";
import EventList from "@/components/events/EventList";
import ReportForm from "@/components/reports/ReportForm";
import ReportCard from "@/components/reports/ReportCard";
import { FoodReport } from "@/types/report";

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
    return (
      <div>
        <p>Failed to load events.</p>
        <pre>{error.message}</pre>
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
    return <p>Failed to load community reports.</p>;
  }

  const foodReports = (reports ?? []) as FoodReport[];

  if (foodReports.length === 0) {
    return <p className="opacity-70">No active community reports.</p>;
  }

  return (
    <div className="space-y-4">
      {foodReports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">CF3</h1>
      <p className="mt-2">Carleton Free Food Finder</p>

      <Suspense fallback={<p className="mt-8">Loading food events...</p>}>
        <FoodEvents />
      </Suspense>

      <section className="mt-12">
  <h2 className="text-2xl font-bold">Community reports</h2>

  <div className="mt-6">
    <ReportForm />
  </div>

  <div className="mt-8">
    <Suspense fallback={<p>Loading reports...</p>}>
      <CommunityReports />
    </Suspense>
  </div>
</section>
    </main>
  );
}
