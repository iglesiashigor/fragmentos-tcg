/*
# Fix game_rooms RLS to allow player2 to join

The problem: when player2 tries to update the room to join, the RLS policy
checks auth.uid() = player2_id, but player2_id is still NULL at that point.

Solution: Allow any authenticated user to UPDATE a room that is 'waiting'
and has no player2_id yet (player2_id IS NULL). After joining, player2_id
is set, and the normal policy (auth.uid() = player1_id OR player2_id) applies.

We also need to make sure the player2 update ONLY sets the player2 fields,
not anything else. The WITH CHECK clause ensures after update, the updater
is still player1_id or player2_id.
*/

ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "update_game_rooms" ON game_rooms;
CREATE POLICY "update_game_rooms" ON game_rooms FOR UPDATE
  TO authenticated USING (
    auth.uid() = player1_id 
    OR auth.uid() = player2_id 
    OR (status = 'waiting' AND player2_id IS NULL)
  )
  WITH CHECK (
    auth.uid() = player1_id 
    OR auth.uid() = player2_id
  );

-- Also need to ensure player2_id is NULLABLE (should already be done)
-- and player2_ready has a default false (already set)
