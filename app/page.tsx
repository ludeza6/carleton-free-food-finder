import { createClient } from "@/lib/supabase/server";
import { FoodEvent } from "@/types/event";
import { Suspense } from "react";
import EventList from "@/components/events/EventList";

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

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">CF3</h1>
      <p className="mt-2">Carleton Free Food Finder</p>

      <Suspense fallback={<p className="mt-8">Loading food events...</p>}>
        <FoodEvents />
      </Suspense>
    </main>
  );
}
