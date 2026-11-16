-- Run this entire file in Supabase SQL Editor.
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Sports Championship',
  team_a text not null default 'TEAM A',
  team_b text not null default 'TEAM B',
  score_a integer not null default 0 check (score_a >= 0),
  score_b integer not null default 0 check (score_b >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.winners (
  id uuid primary key default gen_random_uuid(),
  sport text not null unique,
  winner_name text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.tournaments(name) select 'Sports Championship'
where not exists (select 1 from public.tournaments);

insert into public.winners(sport) values
 ('Football'),('Cricket'),('Basketball'),('Badminton'),
 ('Athletics'),('Volleyball'),('Chess'),('Table Tennis')
on conflict (sport) do nothing;

-- Owner allowlist: only the Supabase user ID added here can edit.
create table if not exists public.arena_owners (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.is_arena_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.arena_owners where user_id = auth.uid());
$$;

revoke all on function public.is_arena_owner() from public;
grant execute on function public.is_arena_owner() to authenticated;

alter table public.tournaments enable row level security;
alter table public.winners enable row level security;
alter table public.arena_owners enable row level security;

create policy "Public can read tournaments" on public.tournaments
for select using (true);
create policy "Public can read winners" on public.winners
for select using (true);

create policy "Only arena owners update tournaments" on public.tournaments
for update to authenticated using (public.is_arena_owner()) with check (public.is_arena_owner());
create policy "Only arena owners update winners" on public.winners
for update to authenticated using (public.is_arena_owner()) with check (public.is_arena_owner());

alter publication supabase_realtime add table public.tournaments;
alter publication supabase_realtime add table public.winners;
