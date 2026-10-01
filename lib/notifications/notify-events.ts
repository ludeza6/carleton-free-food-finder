import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createEventEmailSender, isAlertEligible, type AlertEvent } from "./email";

// Only the official food_events table participates; community food_reports do not.
export async function notifyPendingEvents(supabase: SupabaseClient) {
  try {
    const send = createEventEmailSender();
    if (!send) return;

    // Snapshot before updates so changing notified_at cannot skip paginated rows.
    const pending: AlertEvent[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("food_events")
        .select("id,title,food_type,building,room,start_time,end_time,source_name,source_url,notified_at")
        .is("notified_at", null).eq("is_free", true)
        .gt("start_time", new Date().toISOString())
        .not("source_url", "is", null)
        .order("id").range(offset, offset + 499);
      if (error) throw new Error(`Pending event lookup failed (${error.code})`);
      pending.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }

    for (const event of pending) {
      try {
        // Refresh to observe another worker's completion and any event edits.
        const { data: current, error: lookupError } = await supabase.from("food_events")
          .select("id,title,food_type,building,room,start_time,end_time,source_name,source_url,notified_at")
          .eq("id", event.id).eq("is_free", true).maybeSingle();
        if (lookupError) throw new Error(`Event lookup failed (${lookupError.code})`);
        if (!current || !isAlertEligible(current)) continue;
        await send(current);
        const { data: updated, error } = await supabase.from("food_events")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", current.id).is("notified_at", null).select("id");
        if (error) throw new Error(`Email accepted, but notified_at update failed (${error.code})`);
        if (!updated?.length) console.info(`[email-alerts] Event ${event.id} already marked or removed`);
      } catch (error) {
        console.error(`[email-alerts] Event ${event.id}:`, error instanceof Error ? error.message : "Send failed");
      }
    }
  } catch (error) {
    console.error("[email-alerts] Notifications failed:", error instanceof Error ? error.message : "Unknown error");
  }
}
