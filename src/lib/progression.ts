import { MatchStats } from '../types/game';
import { MatchMode, MatchResult } from './ranking';
import { supabase } from './supabase';

export type MissionMetric =
  | 'play_ai_match'
  | 'play_pvp_match'
  | 'win_match'
  | 'play_units'
  | 'cast_spells'
  | 'equip_items'
  | 'play_terrains'
  | 'end_turns'
  | 'declare_attacks';

export interface MissionDefinition {
  id: string;
  title: string;
  description: string;
  metric: MissionMetric;
  target: number;
  xpReward: number;
}

export interface PlayerProgress {
  player_id: string;
  level: number;
  xp: number;
  total_xp: number;
  daily_mission_date: string;
  mission_progress: Record<string, number>;
  completed_daily_missions: string[];
  supporter: boolean;
  equipped_profile_frame: string;
  unlocked_profile_frames: string[];
  updated_at: string;
}

export interface MatchProgressInput {
  playerId: string;
  mode: MatchMode;
  result: MatchResult;
  stats?: MatchStats | null;
}

export const DAILY_MISSIONS: MissionDefinition[] = [
  {
    id: 'daily_ai_match',
    title: 'Treino Arcano',
    description: 'Jogue 1 partida contra a IA.',
    metric: 'play_ai_match',
    target: 1,
    xpReward: 50,
  },
  {
    id: 'daily_pvp_match',
    title: 'Duelo Real',
    description: 'Jogue 1 partida PvP.',
    metric: 'play_pvp_match',
    target: 1,
    xpReward: 80,
  },
  {
    id: 'daily_win_match',
    title: 'Cristal Vitorioso',
    description: 'Vença 1 partida.',
    metric: 'win_match',
    target: 1,
    xpReward: 100,
  },
  {
    id: 'daily_play_units',
    title: 'Formar a Linha',
    description: 'Jogue 5 unidades.',
    metric: 'play_units',
    target: 5,
    xpReward: 80,
  },
  {
    id: 'daily_cast_spells',
    title: 'Canalizar Poder',
    description: 'Use 3 feitiços.',
    metric: 'cast_spells',
    target: 3,
    xpReward: 70,
  },
  {
    id: 'daily_equip_item',
    title: 'Preparar Arsenal',
    description: 'Equipe 1 item ou montaria.',
    metric: 'equip_items',
    target: 1,
    xpReward: 50,
  },
  {
    id: 'daily_play_terrain',
    title: 'Dominar o Campo',
    description: 'Jogue 1 terreno.',
    metric: 'play_terrains',
    target: 1,
    xpReward: 40,
  },
  {
    id: 'daily_end_turns',
    title: 'Ritmo de Batalha',
    description: 'Encerre 3 turnos.',
    metric: 'end_turns',
    target: 3,
    xpReward: 50,
  },
];

export const PROFILE_FRAMES = [
  {
    id: 'default',
    name: 'Moldura Inicial',
    description: 'Liberada para todos os jogadores.',
    className: 'border-slate-600 bg-slate-950/70',
  },
  {
    id: 'amber',
    name: 'Moldura Ambar',
    description: 'Liberada ao alcançar nivel 3.',
    className: 'border-amber-400 bg-amber-950/30 shadow-amber-500/20',
  },
  {
    id: 'sapphire',
    name: 'Moldura Safira',
    description: 'Liberada ao alcançar nivel 6.',
    className: 'border-blue-400 bg-blue-950/30 shadow-blue-500/20',
  },
];

export function xpNeededForLevel(level: number) {
  return 100 + Math.max(0, level - 1) * 50;
}

export function calculateLevelFromXp(totalXp: number) {
  let level = 1;
  let remainingXp = Math.max(0, totalXp);

  while (remainingXp >= xpNeededForLevel(level)) {
    remainingXp -= xpNeededForLevel(level);
    level += 1;
  }

  return { level, xp: remainingXp, xpToNext: xpNeededForLevel(level) };
}

export function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function emptyMatchStats(): MatchStats {
  return {
    unitsPlayed: 0,
    spellsCast: 0,
    itemsEquipped: 0,
    terrainsPlayed: 0,
    turnsEnded: 0,
    attacksDeclared: 0,
  };
}

function getMetricGain(metric: MissionMetric, input: MatchProgressInput) {
  const stats = input.stats ?? emptyMatchStats();
  if (metric === 'play_ai_match') return input.mode === 'ai' ? 1 : 0;
  if (metric === 'play_pvp_match') return input.mode === 'pvp' ? 1 : 0;
  if (metric === 'win_match') return input.result === 'win' ? 1 : 0;
  if (metric === 'play_units') return stats.unitsPlayed;
  if (metric === 'cast_spells') return stats.spellsCast;
  if (metric === 'equip_items') return stats.itemsEquipped;
  if (metric === 'play_terrains') return stats.terrainsPlayed;
  if (metric === 'end_turns') return stats.turnsEnded;
  if (metric === 'declare_attacks') return stats.attacksDeclared;
  return 0;
}

function unlockedFramesForLevel(level: number) {
  const frames = ['default'];
  if (level >= 3) frames.push('amber');
  if (level >= 6) frames.push('sapphire');
  return frames;
}

export async function fetchPlayerProgress(playerId: string) {
  const { data, error } = await supabase
    .from('player_progress')
    .select('*')
    .eq('player_id', playerId)
    .maybeSingle();

  return { data: data as PlayerProgress | null, error: error?.message ?? null };
}

export async function equipProfileFrame(playerId: string, frameId: string) {
  const { data: current, error: fetchError } = await fetchPlayerProgress(playerId);
  if (fetchError) return { error: fetchError };

  const unlockedFrames = current?.unlocked_profile_frames ?? ['default'];
  if (!unlockedFrames.includes(frameId)) {
    return { error: 'Moldura ainda nao liberada.' };
  }

  const payload = {
    player_id: playerId,
    equipped_profile_frame: frameId,
    unlocked_profile_frames: unlockedFrames,
    supporter: current?.supporter ?? false,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('player_progress')
    .upsert(payload, { onConflict: 'player_id' });

  return { error: error?.message ?? null };
}

export async function saveMatchProgress(input: MatchProgressInput) {
  const today = getTodayKey();
  const { data: current, error: fetchError } = await fetchPlayerProgress(input.playerId);
  if (fetchError) return { error: fetchError };

  const sameDay = current?.daily_mission_date === today;
  const currentProgress = sameDay ? current?.mission_progress ?? {} : {};
  const currentCompleted = sameDay ? current?.completed_daily_missions ?? [] : [];
  const completedSet = new Set(currentCompleted);
  let xpGain = input.mode === 'pvp' ? 20 : 10;
  const nextProgress = { ...currentProgress };

  DAILY_MISSIONS.forEach(mission => {
    if (completedSet.has(mission.id)) return;
    const gain = getMetricGain(mission.metric, input);
    if (gain <= 0) return;

    const nextValue = Math.min(mission.target, (nextProgress[mission.id] ?? 0) + gain);
    nextProgress[mission.id] = nextValue;
    if (nextValue >= mission.target) {
      completedSet.add(mission.id);
      xpGain += mission.xpReward;
    }
  });

  const nextTotalXp = (current?.total_xp ?? 0) + xpGain;
  const levelInfo = calculateLevelFromXp(nextTotalXp);
  const unlockedFrames = Array.from(new Set([
    ...(current?.unlocked_profile_frames ?? ['default']),
    ...unlockedFramesForLevel(levelInfo.level),
  ]));

  const { error } = await supabase
    .from('player_progress')
    .upsert({
      player_id: input.playerId,
      level: levelInfo.level,
      xp: levelInfo.xp,
      total_xp: nextTotalXp,
      daily_mission_date: today,
      mission_progress: nextProgress,
      completed_daily_missions: Array.from(completedSet),
      supporter: current?.supporter ?? false,
      equipped_profile_frame: current?.equipped_profile_frame ?? 'default',
      unlocked_profile_frames: unlockedFrames,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'player_id' });

  return { error: error?.message ?? null, xpGain, completedMissions: Array.from(completedSet) };
}
