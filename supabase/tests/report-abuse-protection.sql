-- Run against a disposable database after applying report-abuse-protection.sql.
-- All changes are rolled back. Requires service-role-equivalent privileges.
begin;
do $$
declare
  a text := repeat('a', 64);
  b text := repeat('b', 64);
  payload jsonb := '{"building":"Test Building","food_type":"Pizza","quantity":"some"}';
  n integer;
begin
  delete from public.report_rate_limits where ip_hash in (a, b);
  for n in 1..3 loop
    perform public.submit_community_report(a, payload);
  end loop;
  begin
    perform public.submit_community_report(a, payload);
    raise exception 'Fourth submission was allowed';
  exception when sqlstate 'P0429' then null;
  end;
  if (select count(*) from public.report_rate_limits where ip_hash = a) <> 3 then
    raise exception 'Rejected report counted toward quota';
  end if;
  perform public.submit_community_report(b, payload);
  if (select count(*) from public.report_rate_limits where ip_hash = b) <> 1 then
    raise exception 'Independent hash was blocked';
  end if;
  -- Move each batch outside the short window, keeping it within 24 hours.
  for n in 4..10 loop
    update public.report_rate_limits set created_at = clock_timestamp() - interval '1 hour'
      where ip_hash = a;
    perform public.submit_community_report(a, payload);
  end loop;
  update public.report_rate_limits set created_at = clock_timestamp() - interval '1 hour'
    where ip_hash = a;
  begin
    perform public.submit_community_report(a, payload);
    raise exception 'Eleventh submission was allowed';
  exception when sqlstate 'P0429' then null;
  end;
  if (select count(*) from public.report_rate_limits where ip_hash = a) <> 10 then
    raise exception 'Expected ten successful submissions';
  end if;
  update public.report_rate_limits set created_at = clock_timestamp() - interval '25 hours'
    where ip_hash = a;
  perform public.submit_community_report(a, payload);
  if (select count(*) from public.report_rate_limits where ip_hash = a) <> 1 then
    raise exception 'Expired quota did not reset';
  end if;
  -- Force a database insert error and verify no quota is consumed.
  begin
    perform public.submit_community_report(b, payload || '{"building":null}'::jsonb);
    raise exception 'Expected building NOT NULL violation';
  exception when not_null_violation then null;
  end;
  if (select count(*) from public.report_rate_limits where ip_hash = b) <> 1 then
    raise exception 'Failed insert consumed quota';
  end if;
  if has_function_privilege('anon', 'public.submit_community_report(text,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.submit_community_report(text,jsonb)', 'EXECUTE')
    or has_table_privilege('anon', 'public.food_reports', 'INSERT')
    or has_table_privilege('authenticated', 'public.food_reports', 'INSERT') then
    raise exception 'Public insert access remains';
  end if;
end;
$$;
rollback;
