/*
# Create decks table for persistent player decks

1. New Table
- `decks`: stores player-created decks in the cloud
  - `id` (uuid, PK)
  - `user_id` (uuid, FK to auth.users, default auth.uid())
  - `name` (text)
  - `hero_id` (text)
  - `core_cards` (jsonb) - array of {cardId, count}
  - `neutral_cards` (jsonb) - array of {cardId, count}
  - `is_public` (boolean)
  - `created_at`, `updated_at` (timestamps)

2. Security
- RLS enabled
- Owner-scoped CRUD (players can view own decks + public ones)
*/

CREATE TABLE IF NOT EXISTS decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  hero_id text NOT NULL,
  core_cards jsonb NOT NULL DEFAULT '[]',
  neutral_cards jsonb NOT NULL DEFAULT '[]',
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decks_user_id ON decks(user_id);

ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_decks" ON decks;
CREATE POLICY "select_decks" ON decks FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS "insert_own_decks" ON decks;
CREATE POLICY "insert_own_decks" ON decks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_decks" ON decks;
CREATE POLICY "update_own_decks" ON decks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_decks" ON decks;
CREATE POLICY "delete_own_decks" ON decks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_decks_updated_at ON decks;
CREATE TRIGGER update_decks_updated_at BEFORE UPDATE ON decks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
