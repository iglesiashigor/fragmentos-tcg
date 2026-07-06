/*
# Create match_history table for game records

1. New Table
- `match_history`: stores finished game records
  - `id` (uuid, PK)
  - `player1_id` (uuid, FK to auth.users)
  - `player2_id` (uuid, FK to auth.users)
  - `winner_id` (uuid, FK to auth.users, nullable)
  - `result` (text: 'win', 'loss', 'draw')
  - `player1_deck_id` (uuid, FK to decks, nullable)
  - `player2_deck_id` (uuid, FK to decks, nullable)
  - `turns` (integer, nullable)
  - `created_at` (timestamp)

2. Security
- RLS enabled
- Players involved can view their own matches
*/

CREATE TABLE IF NOT EXISTS match_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player2_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  result text NOT NULL DEFAULT 'draw',
  player1_deck_id uuid REFERENCES decks(id) ON DELETE SET NULL,
  player2_deck_id uuid REFERENCES decks(id) ON DELETE SET NULL,
  turns integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_history_player1 ON match_history(player1_id);
CREATE INDEX IF NOT EXISTS idx_match_history_player2 ON match_history(player2_id);

ALTER TABLE match_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_match_history" ON match_history;
CREATE POLICY "select_match_history" ON match_history FOR SELECT
  TO authenticated USING (auth.uid() = player1_id OR auth.uid() = player2_id);

DROP POLICY IF EXISTS "insert_match_history" ON match_history;
CREATE POLICY "insert_match_history" ON match_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);
