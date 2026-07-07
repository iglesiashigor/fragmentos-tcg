/*
# Create player_match_results table

Stores one row per player per finished match. This keeps AI history separate
from PvP history and lets the frontend build profile stats and ranking screens.
*/

CREATE TABLE IF NOT EXISTS player_match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_uid text NOT NULL,
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opponent_name text,
  mode text NOT NULL CHECK (mode IN ('ai', 'pvp')),
  result text NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  finish_reason text NOT NULL DEFAULT 'normal' CHECK (finish_reason IN ('normal', 'surrender', 'inactivity')),
  hero_id text,
  opponent_hero_id text,
  turns integer,
  rating_delta integer NOT NULL DEFAULT 0,
  rating_after integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_uid, player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_match_results_player_id
  ON player_match_results(player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_match_results_mode
  ON player_match_results(mode);

ALTER TABLE player_match_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_player_match_results" ON player_match_results;
CREATE POLICY "select_own_player_match_results"
  ON player_match_results
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = player_id);

DROP POLICY IF EXISTS "insert_own_player_match_results" ON player_match_results;
CREATE POLICY "insert_own_player_match_results"
  ON player_match_results
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = player_id);

DROP POLICY IF EXISTS "update_own_player_match_results" ON player_match_results;
CREATE POLICY "update_own_player_match_results"
  ON player_match_results
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = player_id)
  WITH CHECK ((select auth.uid()) = player_id);

GRANT SELECT, INSERT, UPDATE ON player_match_results TO authenticated;
