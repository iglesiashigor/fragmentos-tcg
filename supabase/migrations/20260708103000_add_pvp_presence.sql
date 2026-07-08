/*
# Add PvP presence heartbeat

Tracks the last time each player was seen inside an active PvP room. The
client uses this to finish a match when one player closes the tab or loses
connection without pressing surrender.
*/

alter table public.game_rooms
add column if not exists player1_last_seen timestamptz,
add column if not exists player2_last_seen timestamptz;

create index if not exists idx_game_rooms_last_seen
on public.game_rooms (status, player1_last_seen, player2_last_seen);
