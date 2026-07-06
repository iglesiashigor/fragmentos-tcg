/*
# Fix matchmaking_queue RLS to use user_id column

The matchmaking_queue table has user_id (not host_id) as the owner column.
Update RLS policies to reference the correct column.
*/

ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_matchmaking" ON matchmaking_queue;
CREATE POLICY "select_matchmaking" ON matchmaking_queue FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_matchmaking" ON matchmaking_queue;
CREATE POLICY "insert_own_matchmaking" ON matchmaking_queue FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_matchmaking" ON matchmaking_queue;
CREATE POLICY "update_own_matchmaking" ON matchmaking_queue FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_matchmaking" ON matchmaking_queue;
CREATE POLICY "delete_own_matchmaking" ON matchmaking_queue FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
