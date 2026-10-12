-- Apply once in the Supabase SQL editor before deploying the updated route.
begin;
create table public.report_rate_limits (
  id bigint generated always as identity primary key,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
create index report_rate_limits_ip_created_idx on public.report_rate_limits (ip_hash, created_at);
create index report_rate_limits_created_idx on public.report_rate_limits (created_at);
alter table public.report_rate_limits enable row level security;
revoke all on public.report_rate_limits from public, anon, authenticated;
grant select, insert, delete on public.report_rate_limits to service_role;
grant usage, select on sequence public.report_rate_limits_id_seq to service_role;

-- Revocation also blocks permissive INSERT/ALL policies of any name.
-- SELECT policies and grants remain intact.
alter table public.food_reports enable row level security;
revoke insert on public.food_reports from public, anon, authenticated;
grant select, insert on public.food_reports to service_role;

create function public.submit_community_report(p_ip_hash text, p_report jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_short bigint;
  v_daily bigint;
  v_report public.food_reports%rowtype;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate limit key';
  end if;
  -- Serialize all submissions for this hash, across server instances.
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
  v_now := clock_timestamp();
  -- Keep successful-submission records only as long as the longest window.
  delete from public.report_rate_limits where created_at <= v_now - interval '24 hours';
  select count(*) filter (where created_at > v_now - interval '15 minutes'), count(*)
    into v_short, v_daily
    from public.report_rate_limits
    where ip_hash = p_ip_hash and created_at > v_now - interval '24 hours';
  if v_short >= 3 or v_daily >= 10 then
    raise exception using errcode = 'P0429', message = 'Report rate limit exceeded';
  end if;

  insert into public.food_reports (building, room, food_type, quantity, notes, status, expires_at)
  values (p_report->>'building', p_report->>'room', p_report->>'food_type',
    p_report->>'quantity', p_report->>'notes', 'active', v_now + interval '2 hours')
  returning * into v_report;
  insert into public.report_rate_limits (ip_hash, created_at) values (p_ip_hash, v_now);
  -- Both inserts roll back together on any error. Never return the hash.
  return to_jsonb(v_report);
end;
$$;
revoke all on function public.submit_community_report(text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_community_report(text, jsonb) to service_role;
commit;
