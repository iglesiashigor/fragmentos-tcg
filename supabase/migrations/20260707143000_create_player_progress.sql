create table if not exists public.player_progress (
  player_id uuid primary key references auth.users(id) on delete cascade,
  level integer not null default 1,
  xp integer not null default 0,
  total_xp integer not null default 0,
  daily_mission_date date not null default current_date,
  mission_progress jsonb not null default '{}'::jsonb,
  completed_daily_missions text[] not null default '{}'::text[],
  supporter boolean not null default false,
  equipped_profile_frame text not null default 'default',
  unlocked_profile_frames text[] not null default array['default']::text[],
  updated_at timestamptz not null default now()
);

alter table public.player_progress enable row level security;

drop policy if exists "select_own_player_progress" on public.player_progress;
create policy "select_own_player_progress"
on public.player_progress
for select
to authenticated
using ((select auth.uid()) = player_id);

drop policy if exists "insert_own_player_progress" on public.player_progress;
create policy "insert_own_player_progress"
on public.player_progress
for insert
to authenticated
with check ((select auth.uid()) = player_id);

drop policy if exists "update_own_player_progress" on public.player_progress;
create policy "update_own_player_progress"
on public.player_progress
for update
to authenticated
using ((select auth.uid()) = player_id)
with check ((select auth.uid()) = player_id);

grant select, insert, update on public.player_progress to authenticated;
