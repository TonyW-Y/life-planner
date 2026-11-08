-- Cozy Planner — everything fits in Supabase's free tier.
-- One generic table holds every synced record as JSON, private to its owner (RLS).

create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  tbl text not null,
  id text not null,
  data jsonb not null,
  server_ts timestamptz not null default now(),
  primary key (user_id, tbl, id)
);
create index if not exists records_pull_idx on public.records (user_id, server_ts);

alter table public.records enable row level security;
drop policy if exists "own records" on public.records;
create policy "own records" on public.records
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Merge two versions of a record field-by-field using the per-field timestamps (_fts)
-- so an edit on the phone and a different edit on the laptop both survive.
create or replace function public.merge_record(old jsonb, new jsonb) returns jsonb
language plpgsql immutable as $$
declare
  k text;
  ofts jsonb := coalesce(old->'_fts', '{}'::jsonb);
  nfts jsonb := coalesce(new->'_fts', '{}'::jsonb);
  res jsonb := old;
  rfts jsonb := coalesce(old->'_fts', '{}'::jsonb);
  lt bigint;
  rt bigint;
begin
  for k in select jsonb_object_keys(old || new) loop
    if k in ('_fts', 'updatedAt', 'id') then continue; end if;
    lt := coalesce((ofts->>k)::bigint, (old->>'updatedAt')::bigint, 0);
    rt := coalesce((nfts->>k)::bigint, (new->>'updatedAt')::bigint, 0);
    if rt > lt then
      if new ? k then res := jsonb_set(res, array[k], new->k, true); else res := res - k; end if;
      rfts := jsonb_set(rfts, array[k], to_jsonb(rt), true);
    end if;
  end loop;
  res := jsonb_set(res, '{_fts}', rfts, true);
  res := jsonb_set(res, '{updatedAt}', to_jsonb(greatest(coalesce((old->>'updatedAt')::bigint, 0), coalesce((new->>'updatedAt')::bigint, 0))), true);
  return res;
end $$;

-- Upsert a batch of records, merging with what's already there.
create or replace function public.push_records(rows jsonb) returns void
language sql security invoker as $$
  insert into public.records (user_id, tbl, id, data)
  select auth.uid(), r->>'tbl', r->>'id', r->'data' from jsonb_array_elements(rows) r
  on conflict (user_id, tbl, id) do update
    set data = public.merge_record(public.records.data, excluded.data),
        server_ts = now();
$$;

-- How much of the free 500 MB database is used (for the meter in Settings).
create or replace function public.db_usage() returns bigint
language sql security definer set search_path = public as $$
  select pg_database_size(current_database());
$$;
grant execute on function public.db_usage() to authenticated;

-- Live updates to other devices.
do $$ begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null; end $$;

-- Web push subscriptions (one per device).
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subscription jsonb not null,
  tz text not null default 'UTC',
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own subs" on public.push_subscriptions;
create policy "own subs" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Remember which reminders were already sent so nobody gets double-pinged.
create table if not exists public.sent_reminders (
  key text primary key,
  sent_at timestamptz not null default now()
);
alter table public.sent_reminders enable row level security; -- service role only
