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
  goldReward: number;
}

export interface PlayerProgress {
  player_id: string;
  level: number;
  xp: number;
  total_xp: number;
  gold: number;
  daily_mission_date: string;
  mission_progress: Record<string, number>;
  completed_daily_missions: string[];
  supporter: boolean;
  equipped_profile_frame: string;
  unlocked_profile_frames: string[];
  equipped_card_frame: string;
  unlocked_card_frames: string[];
  equipped_playmat: string;
  unlocked_playmats: string[];
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
    goldReward: 20,
  },
  {
    id: 'daily_pvp_match',
    title: 'Duelo Real',
    description: 'Jogue 1 partida PvP.',
    metric: 'play_pvp_match',
    target: 1,
    xpReward: 80,
    goldReward: 35,
  },
  {
    id: 'daily_win_match',
    title: 'Cristal Vitorioso',
    description: 'Vença 1 partida.',
    metric: 'win_match',
    target: 1,
    xpReward: 100,
    goldReward: 45,
  },
  {
    id: 'daily_play_units',
    title: 'Formar a Linha',
    description: 'Jogue 5 unidades.',
    metric: 'play_units',
    target: 5,
    xpReward: 80,
    goldReward: 30,
  },
  {
    id: 'daily_cast_spells',
    title: 'Canalizar Poder',
    description: 'Use 3 feitiços.',
    metric: 'cast_spells',
    target: 3,
    xpReward: 70,
    goldReward: 25,
  },
  {
    id: 'daily_equip_item',
    title: 'Preparar Arsenal',
    description: 'Equipe 1 item ou montaria.',
    metric: 'equip_items',
    target: 1,
    xpReward: 50,
    goldReward: 20,
  },
  {
    id: 'daily_play_terrain',
    title: 'Dominar o Campo',
    description: 'Jogue 1 terreno.',
    metric: 'play_terrains',
    target: 1,
    xpReward: 40,
    goldReward: 15,
  },
  {
    id: 'daily_end_turns',
    title: 'Ritmo de Batalha',
    description: 'Encerre 3 turnos.',
    metric: 'end_turns',
    target: 3,
    xpReward: 50,
    goldReward: 15,
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

export const CARD_FRAMES = [
  {
    id: 'default',
    name: 'Carta Inicial',
    description: 'Visual padrao das cartas.',
    price: 0,
    className: 'card-cosmetic-default',
  },
  {
    id: 'amber',
    name: 'Carta Ambar',
    description: 'Borda quente para suas cartas.',
    price: 300,
    className: 'card-cosmetic-amber',
  },
  {
    id: 'sapphire',
    name: 'Carta Safira',
    description: 'Borda azul cristalina.',
    price: 500,
    className: 'card-cosmetic-sapphire',
  },
  {
    id: 'ruby',
    name: 'Carta Rubi',
    description: 'Borda vermelha intensa.',
    price: 750,
    className: 'card-cosmetic-ruby',
  },
  {
    id: 'emerald',
    name: 'Carta Esmeralda',
    description: 'Borda verde arcana.',
    price: 750,
    className: 'card-cosmetic-emerald',
  },
];

export const PLAYMATS = [
  {
    id: 'default',
    name: 'Campo Inicial',
    description: 'O campo classico do jogo.',
    price: 0,
    className: 'playmat-default',
  },
  {
    id: 'arcane_forest',
    name: 'Floresta Arcana',
    description: 'Um campo com energia natural.',
    price: 900,
    className: 'playmat-arcane-forest',
  },
  {
    id: 'crystal_arena',
    name: 'Arena de Cristal',
    description: 'Um campo frio e luminoso.',
    price: 1100,
    className: 'playmat-crystal-arena',
  },
  {
    id: 'ember_ruins',
    name: 'Ruinas Rubi',
    description: 'Um campo marcado por brasas.',
    price: 1200,
    className: 'playmat-ember-ruins',
  },
];

export type ShopItemType = 'card_frame' | 'playmat';

export interface ShopItem {
  id: string;
  type: ShopItemType;
  name: string;
  description: string;
  price: number;
}

export const SHOP_ITEMS: ShopItem[] = [
  ...CARD_FRAMES.filter(item => item.price > 0).map(item => ({ ...item, type: 'card_frame' as const })),
  ...PLAYMATS.filter(item => item.price > 0).map(item => ({ ...item, type: 'playmat' as const })),
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

export function defaultPlayerProgress(playerId: string): PlayerProgress {
  return {
    player_id: playerId,
    level: 1,
    xp: 0,
    total_xp: 0,
    gold: 0,
    daily_mission_date: getTodayKey(),
    mission_progress: {},
    completed_daily_missions: [],
    supporter: false,
    equipped_profile_frame: 'default',
    unlocked_profile_frames: ['default'],
    equipped_card_frame: 'default',
    unlocked_card_frames: ['default'],
    equipped_playmat: 'default',
    unlocked_playmats: ['default'],
    updated_at: new Date().toISOString(),
  };
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
    gold: current?.gold ?? 0,
    supporter: current?.supporter ?? false,
    equipped_card_frame: current?.equipped_card_frame ?? 'default',
    unlocked_card_frames: current?.unlocked_card_frames ?? ['default'],
    equipped_playmat: current?.equipped_playmat ?? 'default',
    unlocked_playmats: current?.unlocked_playmats ?? ['default'],
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('player_progress')
    .upsert(payload, { onConflict: 'player_id' });

  return { error: error?.message ?? null };
}

export async function equipCardFrame(playerId: string, frameId: string) {
  const { data: current, error: fetchError } = await fetchPlayerProgress(playerId);
  if (fetchError) return { error: fetchError };

  const progress = current ?? defaultPlayerProgress(playerId);
  if (!(progress.unlocked_card_frames ?? ['default']).includes(frameId)) {
    return { error: 'Moldura de carta ainda nao comprada.' };
  }

  const { error } = await supabase
    .from('player_progress')
    .upsert({
      ...progress,
      equipped_card_frame: frameId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'player_id' });

  return { error: error?.message ?? null };
}

export async function equipPlaymat(playerId: string, playmatId: string) {
  const { data: current, error: fetchError } = await fetchPlayerProgress(playerId);
  if (fetchError) return { error: fetchError };

  const progress = current ?? defaultPlayerProgress(playerId);
  if (!(progress.unlocked_playmats ?? ['default']).includes(playmatId)) {
    return { error: 'Campo ainda nao comprado.' };
  }

  const { error } = await supabase
    .from('player_progress')
    .upsert({
      ...progress,
      equipped_playmat: playmatId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'player_id' });

  return { error: error?.message ?? null };
}

export async function purchaseShopItem(playerId: string, item: ShopItem) {
  const { data: current, error: fetchError } = await fetchPlayerProgress(playerId);
  if (fetchError) return { error: fetchError };

  const progress = current ?? defaultPlayerProgress(playerId);
  const gold = progress.gold ?? 0;
  if (gold < item.price) return { error: 'Gold insuficiente.' };

  const unlockedCardFrames = progress.unlocked_card_frames ?? ['default'];
  const unlockedPlaymats = progress.unlocked_playmats ?? ['default'];
  const alreadyOwned = item.type === 'card_frame'
    ? unlockedCardFrames.includes(item.id)
    : unlockedPlaymats.includes(item.id);

  if (alreadyOwned) return { error: 'Item ja comprado.' };

  const payload: PlayerProgress = {
    ...progress,
    gold: gold - item.price,
    unlocked_card_frames: item.type === 'card_frame'
      ? Array.from(new Set([...unlockedCardFrames, item.id]))
      : unlockedCardFrames,
    unlocked_playmats: item.type === 'playmat'
      ? Array.from(new Set([...unlockedPlaymats, item.id]))
      : unlockedPlaymats,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('player_progress')
    .upsert(payload, { onConflict: 'player_id' });

  return { error: error?.message ?? null, progress: payload };
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
  let goldGain = input.mode === 'pvp' ? 20 : 5;
  if (input.result === 'win') goldGain += input.mode === 'pvp' ? 20 : 5;
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
      goldGain += mission.goldReward;
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
      gold: (current?.gold ?? 0) + goldGain,
      daily_mission_date: today,
      mission_progress: nextProgress,
      completed_daily_missions: Array.from(completedSet),
      supporter: current?.supporter ?? false,
      equipped_profile_frame: current?.equipped_profile_frame ?? 'default',
      unlocked_profile_frames: unlockedFrames,
      equipped_card_frame: current?.equipped_card_frame ?? 'default',
      unlocked_card_frames: current?.unlocked_card_frames ?? ['default'],
      equipped_playmat: current?.equipped_playmat ?? 'default',
      unlocked_playmats: current?.unlocked_playmats ?? ['default'],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'player_id' });

  return { error: error?.message ?? null, xpGain, goldGain, completedMissions: Array.from(completedSet) };
}
