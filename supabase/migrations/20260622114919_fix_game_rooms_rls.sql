/*
# Fix game_rooms RLS policies to use correct column names

The existing game_rooms table uses player1_id, player2_id, player1_ready, player2_ready, player1_deck_id, player2_deck_id.
The previous RLS policies referenced host_id and guest_id which don't exist. This fix updates the policies to use the correct column names.

1. Updated Policies
- SELECT: public (both players and spectators can see rooms)
- INSERT: only player1_id (the host) can create rooms
- UPDATE: both player1_id and player2_id can update
- DELETE: only player1_id (the host) can delete rooms
*/

ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_game_rooms" ON game_rooms;
CREATE POLICY "select_game_rooms" ON game_rooms FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_game_rooms" ON game_rooms;
CREATE POLICY "insert_game_rooms" ON game_rooms FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = player1_id);

DROP POLICY IF EXISTS "update_game_rooms" ON game_rooms;
CREATE POLICY "update_game_rooms" ON game_rooms FOR UPDATE
  TO authenticated USING (auth.uid() = player1_id OR auth.uid() = player2_id);

DROP POLICY IF EXISTS "delete_game_rooms" ON game_rooms;
CREATE POLICY "delete_game_rooms" ON game_rooms FOR DELETE
  TO authenticated USING (auth.uid() = player1_id);
