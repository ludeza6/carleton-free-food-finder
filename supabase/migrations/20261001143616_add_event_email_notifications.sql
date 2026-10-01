-- Ingestion deliberately omits notified_at from its upsert payload.
alter table public.food_events
  add column if not exists notified_at timestamptz;
