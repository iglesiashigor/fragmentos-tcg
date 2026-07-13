ALTER TABLE public.player_progress
  ADD COLUMN IF NOT EXISTS achievement_progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS completed_achievements text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.player_progress
SET
  achievement_progress = COALESCE(achievement_progress, '{}'::jsonb),
  completed_achievements = COALESCE(completed_achievements, '{}'::text[]);
