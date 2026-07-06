/*
# Fix game_rooms nullable constraints and foreign keys

1. Problem
- player2_id, player1_deck_id, player2_deck_id are NOT NULL
- When creating a room, player2 is not known yet (room is "waiting")
- Default deck IDs are slugs (e.g., "deck-anao-guerreiro") not UUIDs
- Foreign keys from deck_id to player_decks.id are UUID-based

2. Changes
- Drop foreign key constraints from deck_id columns
- player2_id: NOT NULL → NULLABLE
- player1_deck_id: NOT NULL → NULLABLE, change type to text
- player2_deck_id: NOT NULL → NULLABLE, change type to text
*/

ALTER TABLE game_rooms DROP CONSTRAINT IF EXISTS game_rooms_player1_deck_id_fkey;
ALTER TABLE game_rooms DROP CONSTRAINT IF EXISTS game_rooms_player2_deck_id_fkey;

ALTER TABLE game_rooms ALTER COLUMN player2_id DROP NOT NULL;
ALTER TABLE game_rooms ALTER COLUMN player1_deck_id DROP NOT NULL;
ALTER TABLE game_rooms ALTER COLUMN player2_deck_id DROP NOT NULL;

ALTER TABLE game_rooms ALTER COLUMN player1_deck_id TYPE text USING player1_deck_id::text;
ALTER TABLE game_rooms ALTER COLUMN player2_deck_id TYPE text USING player2_deck_id::text;
