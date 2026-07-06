/*
# Fix matchmaking_queue deck_id column type

1. Problem
- deck_id is uuid NOT NULL, but frontend sends slug IDs (e.g., "deck-anao-guerreiro")
- Need to accept any deck identifier

2. Changes
- Drop foreign key constraint on deck_id
- Change deck_id to text type
- Allow NULL
*/

ALTER TABLE matchmaking_queue DROP CONSTRAINT IF EXISTS matchmaking_queue_deck_id_fkey;

ALTER TABLE matchmaking_queue ALTER COLUMN deck_id DROP NOT NULL;
ALTER TABLE matchmaking_queue ALTER COLUMN deck_id TYPE text USING deck_id::text;
