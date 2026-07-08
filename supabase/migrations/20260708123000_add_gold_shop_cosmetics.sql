alter table public.player_progress
  add column if not exists gold integer not null default 0,
  add column if not exists equipped_card_frame text not null default 'default',
  add column if not exists unlocked_card_frames text[] not null default array['default']::text[],
  add column if not exists equipped_playmat text not null default 'default',
  add column if not exists unlocked_playmats text[] not null default array['default']::text[];

update public.player_progress
set
  unlocked_profile_frames = case
    when unlocked_profile_frames is null or array_length(unlocked_profile_frames, 1) is null then array['default']::text[]
    else unlocked_profile_frames
  end,
  unlocked_card_frames = case
    when unlocked_card_frames is null or array_length(unlocked_card_frames, 1) is null then array['default']::text[]
    else unlocked_card_frames
  end,
  unlocked_playmats = case
    when unlocked_playmats is null or array_length(unlocked_playmats, 1) is null then array['default']::text[]
    else unlocked_playmats
  end,
  equipped_profile_frame = coalesce(equipped_profile_frame, 'default'),
  equipped_card_frame = coalesce(equipped_card_frame, 'default'),
  equipped_playmat = coalesce(equipped_playmat, 'default'),
  gold = coalesce(gold, 0);
