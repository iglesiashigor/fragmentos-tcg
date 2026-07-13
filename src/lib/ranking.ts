import { supabase } from './supabase';

export type MatchMode = 'ai' | 'pvp';
export type MatchResult = 'win' | 'loss' | 'draw';
export type FinishReason = 'normal' | 'surrender' | 'inactivity' | 'disconnect';

export interface PlayerMatchResult {
  id: string;
  match_uid: string;
  player_id: string;
  opponent_id: string | null;
  opponent_name: string | null;
  mode: MatchMode;
  result: MatchResult;
  finish_reason: FinishReason;
  hero_id: string | null;
  opponent_hero_id: string | null;
  turns: number | null;
  rating_delta: number;
  rating_after: number | null;
  match_log: string[];
  created_at: string;
}

export interface RankingProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
  draws: number;
  rating: number;
}

export interface PlayerSummary {
  pvpWins: number;
  pvpLosses: number;
  pvpDraws: number;
  aiWins: number;
  aiLosses: number;
  aiDraws: number;
  totalMatches: number;
}

export const CRYSTAL_RANKS = [
  { name: 'Quartzo', min: 0, color: 'text-slate-300', bg: 'from-slate-500/20 to-slate-800/20' },
  { name: 'Ambar', min: 1050, color: 'text-amber-300', bg: 'from-amber-500/20 to-yellow-800/20' },
  { name: 'Safira', min: 1150, color: 'text-blue-300', bg: 'from-blue-500/20 to-indigo-800/20' },
  { name: 'Esmeralda', min: 1300, color: 'text-emerald-300', bg: 'from-emerald-500/20 to-green-800/20' },
  { name: 'Rubi', min: 1500, color: 'text-rose-300', bg: 'from-rose-500/20 to-red-800/20' },
  { name: 'Ametista', min: 1750, color: 'text-purple-300', bg: 'from-purple-500/20 to-violet-800/20' },
  { name: 'Diamante', min: 2050, color: 'text-cyan-200', bg: 'from-cyan-400/20 to-blue-800/20' },
  { name: 'Fragmento Ancestral', min: 2400, color: 'text-fuchsia-200', bg: 'from-fuchsia-400/20 to-amber-700/20' },
];

export function getCrystalRank(rating: number) {
  return CRYSTAL_RANKS.reduce((current, rank) => rating >= rank.min ? rank : current, CRYSTAL_RANKS[0]);
}

export function getRatingDelta(mode: MatchMode, result: MatchResult, finishReason: FinishReason) {
  if (mode === 'ai') return 0;
  if (result === 'draw') return 5;
  const nonNormalFinish = finishReason === 'inactivity' || finishReason === 'surrender' || finishReason === 'disconnect';
  if (result === 'win') return nonNormalFinish ? 0 : 25;
  return nonNormalFinish ? -15 : -10;
}

export async function savePlayerMatchResult(input: {
  matchUid: string;
  playerId: string;
  opponentId?: string | null;
  opponentName?: string | null;
  mode: MatchMode;
  result: MatchResult;
  finishReason?: FinishReason;
  heroId?: string | null;
  opponentHeroId?: string | null;
  turns?: number | null;
  matchLog?: string[];
}) {
  const finishReason = input.finishReason ?? 'normal';
  const delta = getRatingDelta(input.mode, input.result, finishReason);

  const { data: profile } = await supabase
    .from('profiles')
    .select('wins, losses, draws, rating')
    .eq('id', input.playerId)
    .maybeSingle();

  const currentRating = profile?.rating ?? 0;
  const nextRating = Math.max(0, currentRating + delta);

  const { error: insertError } = await supabase
    .from('player_match_results')
    .upsert({
      match_uid: input.matchUid,
      player_id: input.playerId,
      opponent_id: input.opponentId ?? null,
      opponent_name: input.opponentName ?? null,
      mode: input.mode,
      result: input.result,
      finish_reason: finishReason,
      hero_id: input.heroId ?? null,
      opponent_hero_id: input.opponentHeroId ?? null,
      turns: input.turns ?? null,
      rating_delta: delta,
      rating_after: input.mode === 'pvp' ? nextRating : currentRating,
      match_log: sanitizeMatchLog(input.matchLog),
    }, { onConflict: 'match_uid,player_id' });

  if (insertError) return { error: insertError.message };

  const wins = (profile?.wins ?? 0) + (input.mode === 'pvp' && input.result === 'win' ? 1 : 0);
  const losses = (profile?.losses ?? 0) + (input.mode === 'pvp' && input.result === 'loss' ? 1 : 0);
  const draws = (profile?.draws ?? 0) + (input.mode === 'pvp' && input.result === 'draw' ? 1 : 0);

  if (input.mode === 'pvp') {
    await supabase
      .from('profiles')
      .update({ wins, losses, draws, rating: nextRating, updated_at: new Date().toISOString() })
      .eq('id', input.playerId);
  }

  return { error: null };
}

export async function saveSecurePvpMatchResult(input: {
  roomId: string;
  winnerId: string | null;
  finishReason: FinishReason;
  heroId?: string | null;
  opponentHeroId?: string | null;
  turns?: number | null;
  matchLog?: string[];
}) {
  const { data, error } = await supabase.rpc('finish_pvp_match', {
    p_room_id: input.roomId,
    p_winner_id: input.winnerId,
    p_finish_reason: input.finishReason,
    p_hero_id: input.heroId ?? null,
    p_opponent_hero_id: input.opponentHeroId ?? null,
    p_turns: input.turns ?? null,
    p_match_log: sanitizeMatchLog(input.matchLog),
  });

  return {
    data: data as { saved?: boolean; reason?: string } | null,
    error: error?.message ?? null,
  };
}

export async function fetchRanking(limit = 50) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, wins, losses, draws, rating')
    .order('rating', { ascending: false })
    .order('wins', { ascending: false })
    .limit(limit);

  return { data: (data ?? []) as RankingProfile[], error: error?.message ?? null };
}

export async function fetchPlayerHistory(playerId: string, mode?: MatchMode) {
  let query = supabase
    .from('player_match_results')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(mode ? 5 : 10);

  if (mode) query = query.eq('mode', mode);

  const { data, error } = await query;
  return { data: (data ?? []) as PlayerMatchResult[], error: error?.message ?? null };
}

function sanitizeMatchLog(log?: string[]): string[] {
  if (!log) return [];

  const sanitized: string[] = [];
  let totalLength = 0;
  for (const line of log.slice(-500)) {
    const cleanLine = String(line).trim().slice(0, 1000);
    if (!cleanLine) continue;
    if (totalLength + cleanLine.length > 90000) break;
    sanitized.push(cleanLine);
    totalLength += cleanLine.length;
  }
  return sanitized;
}

export function summarizeHistory(history: PlayerMatchResult[]): PlayerSummary {
  return history.reduce<PlayerSummary>((summary, match) => {
    const key = `${match.mode}${match.result === 'win' ? 'Wins' : match.result === 'loss' ? 'Losses' : 'Draws'}` as keyof PlayerSummary;
    summary[key] += 1;
    summary.totalMatches += 1;
    return summary;
  }, {
    pvpWins: 0,
    pvpLosses: 0,
    pvpDraws: 0,
    aiWins: 0,
    aiLosses: 0,
    aiDraws: 0,
    totalMatches: 0,
  });
}
