create or replace function public.finish_pvp_match(
  p_room_id uuid,
  p_winner_id uuid,
  p_finish_reason text,
  p_hero_id text default null,
  p_opponent_hero_id text default null,
  p_turns integer default null,
  p_match_log text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_player1 uuid;
  v_player2 uuid;
  v_status text;
  v_match_uid text := 'pvp-' || p_room_id::text;
  v_loser_id uuid;
  v_player1_result text;
  v_player2_result text;
  v_player1_delta integer := 0;
  v_player2_delta integer := 0;
  v_player1_rating integer := 1000;
  v_player2_rating integer := 1000;
  v_player1_next_rating integer := 1000;
  v_player2_next_rating integer := 1000;
  v_player1_name text;
  v_player2_name text;
  v_existing_count integer;
begin
  if v_user is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if p_finish_reason not in ('normal', 'surrender', 'inactivity', 'disconnect') then
    raise exception 'Motivo de encerramento invalido';
  end if;

  select player1_id, player2_id, status
    into v_player1, v_player2, v_status
  from public.game_rooms
  where id = p_room_id
  for update;

  if v_player1 is null then
    raise exception 'Sala nao encontrada';
  end if;

  if v_player2 is null or v_player1 = v_player2 then
    raise exception 'Partida PvP invalida';
  end if;

  if v_user <> v_player1 and v_user <> v_player2 then
    raise exception 'Voce nao participa dessa partida';
  end if;

  if p_winner_id is not null and p_winner_id <> v_player1 and p_winner_id <> v_player2 then
    raise exception 'Vencedor invalido';
  end if;

  select count(*)
    into v_existing_count
  from public.player_match_results
  where match_uid = v_match_uid
    and mode = 'pvp';

  if v_existing_count > 0 then
    return jsonb_build_object('saved', false, 'reason', 'already_recorded');
  end if;

  if p_winner_id is null then
    v_player1_result := 'draw';
    v_player2_result := 'draw';
    v_player1_delta := 5;
    v_player2_delta := 5;
  else
    v_loser_id := case when p_winner_id = v_player1 then v_player2 else v_player1 end;

    if p_finish_reason = 'surrender' and v_user <> v_loser_id then
      raise exception 'Somente quem desistiu pode registrar desistencia';
    end if;

    if p_finish_reason in ('inactivity', 'disconnect') and v_user <> p_winner_id then
      raise exception 'Somente o vencedor pode registrar esse encerramento';
    end if;

    v_player1_result := case when p_winner_id = v_player1 then 'win' else 'loss' end;
    v_player2_result := case when p_winner_id = v_player2 then 'win' else 'loss' end;

    if p_finish_reason = 'normal' then
      v_player1_delta := case when v_player1_result = 'win' then 25 else -10 end;
      v_player2_delta := case when v_player2_result = 'win' then 25 else -10 end;
    else
      v_player1_delta := case when v_player1_result = 'win' then 0 else -15 end;
      v_player2_delta := case when v_player2_result = 'win' then 0 else -15 end;
    end if;
  end if;

  select username, rating
    into v_player1_name, v_player1_rating
  from public.profiles
  where id = v_player1
  for update;

  select username, rating
    into v_player2_name, v_player2_rating
  from public.profiles
  where id = v_player2
  for update;

  v_player1_rating := coalesce(v_player1_rating, 1000);
  v_player2_rating := coalesce(v_player2_rating, 1000);
  v_player1_next_rating := greatest(0, v_player1_rating + v_player1_delta);
  v_player2_next_rating := greatest(0, v_player2_rating + v_player2_delta);

  insert into public.player_match_results (
    match_uid,
    player_id,
    opponent_id,
    opponent_name,
    mode,
    result,
    finish_reason,
    hero_id,
    opponent_hero_id,
    turns,
    rating_delta,
    rating_after,
    match_log
  )
  values
    (
      v_match_uid,
      v_player1,
      v_player2,
      v_player2_name,
      'pvp',
      v_player1_result,
      p_finish_reason,
      case when v_user = v_player1 then p_hero_id else p_opponent_hero_id end,
      case when v_user = v_player1 then p_opponent_hero_id else p_hero_id end,
      p_turns,
      v_player1_delta,
      v_player1_next_rating,
      coalesce(p_match_log, '{}'::text[])
    ),
    (
      v_match_uid,
      v_player2,
      v_player1,
      v_player1_name,
      'pvp',
      v_player2_result,
      p_finish_reason,
      case when v_user = v_player2 then p_hero_id else p_opponent_hero_id end,
      case when v_user = v_player2 then p_opponent_hero_id else p_hero_id end,
      p_turns,
      v_player2_delta,
      v_player2_next_rating,
      coalesce(p_match_log, '{}'::text[])
    )
  on conflict (match_uid, player_id) do nothing;

  update public.profiles
  set wins = wins + case when v_player1_result = 'win' then 1 else 0 end,
      losses = losses + case when v_player1_result = 'loss' then 1 else 0 end,
      draws = draws + case when v_player1_result = 'draw' then 1 else 0 end,
      rating = v_player1_next_rating,
      updated_at = now()
  where id = v_player1;

  update public.profiles
  set wins = wins + case when v_player2_result = 'win' then 1 else 0 end,
      losses = losses + case when v_player2_result = 'loss' then 1 else 0 end,
      draws = draws + case when v_player2_result = 'draw' then 1 else 0 end,
      rating = v_player2_next_rating,
      updated_at = now()
  where id = v_player2;

  update public.game_rooms
  set status = 'finished',
      updated_at = now()
  where id = p_room_id;

  return jsonb_build_object('saved', true, 'reason', 'recorded');
end;
$$;

revoke all on function public.finish_pvp_match(uuid, uuid, text, text, text, integer, text[]) from public;
grant execute on function public.finish_pvp_match(uuid, uuid, text, text, text, integer, text[]) to authenticated;

revoke update on public.profiles from authenticated;
grant update (username, avatar_url, updated_at) on public.profiles to authenticated;
