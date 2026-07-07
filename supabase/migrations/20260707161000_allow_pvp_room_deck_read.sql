/*
# Allow PvP room participants to read each other's selected decks

When a PvP game starts, the host initializes the game state and needs to
load both selected decks. Decks are private by default, so this policy keeps
normal privacy but allows access when the current user is one of the two
players in a room that references that deck.
*/

alter table public.decks enable row level security;

drop policy if exists "select_decks" on public.decks;
create policy "select_decks"
on public.decks
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or is_public = true
  or exists (
    select 1
    from public.game_rooms gr
    where
      ((select auth.uid()) = gr.player1_id or (select auth.uid()) = gr.player2_id)
      and (
        gr.player1_deck_id = decks.id::text
        or gr.player2_deck_id = decks.id::text
      )
  )
);
