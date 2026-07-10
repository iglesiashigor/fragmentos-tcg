/*
# Store match logs and retain only recent history

Adds the final game log to each per-player match result. A trigger keeps the
five newest AI matches and the five newest PvP matches for every player.
*/

ALTER TABLE public.player_match_results
  ADD COLUMN IF NOT EXISTS match_log text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE public.player_match_results
  DROP CONSTRAINT IF EXISTS player_match_results_match_log_size;

ALTER TABLE public.player_match_results
  ADD CONSTRAINT player_match_results_match_log_size
  CHECK (
    cardinality(match_log) <= 500
    AND octet_length(array_to_string(match_log, '')) <= 100000
  );

DROP POLICY IF EXISTS "delete_own_player_match_results"
  ON public.player_match_results;

CREATE POLICY "delete_own_player_match_results"
  ON public.player_match_results
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = player_id);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.player_match_results
  TO authenticated;

CREATE OR REPLACE FUNCTION public.trim_player_match_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.player_match_results
  WHERE player_id = NEW.player_id
    AND mode = NEW.mode
    AND id NOT IN (
      SELECT id
      FROM public.player_match_results
      WHERE player_id = NEW.player_id
        AND mode = NEW.mode
      ORDER BY created_at DESC, id DESC
      LIMIT 5
    );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trim_player_match_results() FROM PUBLIC;

DROP TRIGGER IF EXISTS trim_player_match_results_after_write
  ON public.player_match_results;

CREATE TRIGGER trim_player_match_results_after_write
AFTER INSERT OR UPDATE OF mode, player_id, created_at
ON public.player_match_results
FOR EACH ROW
EXECUTE FUNCTION public.trim_player_match_results();

-- Apply retention immediately to records that already exist.
DELETE FROM public.player_match_results AS old_match
WHERE old_match.id IN (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY player_id, mode
        ORDER BY created_at DESC, id DESC
      ) AS position
    FROM public.player_match_results
  ) AS ranked
  WHERE ranked.position > 5
);
