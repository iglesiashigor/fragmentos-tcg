/*
# Stabilize PvP rooms

Adds updated_at tracking and useful indexes so the client can ignore stale
waiting rooms and keep active rooms fresh while players exchange moves.
*/

alter table public.game_rooms
add column if not exists updated_at timestamptz not null default now();

create or replace function public.update_game_rooms_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_game_rooms_updated_at on public.game_rooms;
create trigger update_game_rooms_updated_at
before update on public.game_rooms
for each row
execute function public.update_game_rooms_updated_at();

create index if not exists idx_game_rooms_waiting_open
on public.game_rooms (status, created_at)
where player2_id is null;

create index if not exists idx_game_rooms_players_status
on public.game_rooms (player1_id, player2_id, status);
