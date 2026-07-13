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

export interface FirstWinBonusDefinition {
  id: string;
  title: string;
  description: string;
  mode: MatchMode;
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
  {
    id: 'daily_declare_attacks',
    title: 'Pressao Constante',
    description: 'Declare 4 ataques.',
    metric: 'declare_attacks',
    target: 4,
    xpReward: 60,
    goldReward: 20,
  },
];

export const DAILY_FIRST_WIN_BONUSES: FirstWinBonusDefinition[] = [
  {
    id: 'daily_first_ai_win_bonus',
    title: 'Primeira vitoria contra IA',
    description: 'Venca sua primeira partida contra a IA hoje.',
    mode: 'ai',
    xpReward: 80,
    goldReward: 35,
  },
  {
    id: 'daily_first_pvp_win_bonus',
    title: 'Primeira vitoria PvP',
    description: 'Venca sua primeira partida PvP hoje.',
    mode: 'pvp',
    xpReward: 140,
    goldReward: 75,
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
    name: 'Cor Inicial',
    description: 'Visual padrao das cartas.',
    price: 0,
    className: 'card-cosmetic-default',
  },
  {
    id: 'amber',
    name: 'Cor Ambar',
    description: 'Pinta suas cartas com tons de ambar.',
    price: 300,
    className: 'card-cosmetic-amber',
  },
  {
    id: 'sapphire',
    name: 'Cor Safira',
    description: 'Pinta suas cartas com tons de safira.',
    price: 500,
    className: 'card-cosmetic-sapphire',
  },
  {
    id: 'ruby',
    name: 'Cor Rubi',
    description: 'Pinta suas cartas com tons de rubi.',
    price: 750,
    className: 'card-cosmetic-ruby',
  },
  {
    id: 'emerald',
    name: 'Cor Esmeralda',
    description: 'Pinta suas cartas com tons de esmeralda.',
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

export type ShopItemType = 'card_frame' | 'playmat' | 'name_change';

export interface ShopItem {
  id: string;
  type: ShopItemType;
  name: string;
  description: string;
  price: number;
}

export const NAME_CHANGE_ITEM: ShopItem = {
  id: 'name_change',
  type: 'name_change',
  name: 'Alterar nome',
  description: 'Troque o nome exibido no perfil, lobby e ranking.',
  price: 500,
};

export const SHOP_ITEMS: ShopItem[] = [
  ...CARD_FRAMES.filter(item => item.price > 0).map(item => ({ ...item, type: 'card_frame' as const })),
  ...PLAYMATS.filter(item => item.price > 0).map(item => ({ ...item, type: 'playmat' as const })),
  NAME_CHANGE_ITEM,
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

export function isLocalTestAccount(email?: string | null) {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';
  return isLocalHost && email?.trim().toLowerCase() === 'teste@teste.com.br';
}

export function localTestPlayerProgress(playerId: string): PlayerProgress {
  return {
    player_id: playerId,
    level: 50,
    xp: 0,
    total_xp: 20000,
    gold: 999999,
    daily_mission_date: getTodayKey(),
    mission_progress: Object.fromEntries(DAILY_MISSIONS.map(mission => [mission.id, mission.target])),
    completed_daily_missions: [
      ...DAILY_MISSIONS.map(mission => mission.id),
      ...DAILY_FIRST_WIN_BONUSES.map(bonus => bonus.id),
    ],
    supporter: true,
    equipped_profile_frame: 'sapphire',
    unlocked_profile_frames: PROFILE_FRAMES.map(frame => frame.id),
    equipped_card_frame: 'default',
    unlocked_card_frames: CARD_FRAMES.map(frame => frame.id),
    equipped_playmat: 'default',
    unlocked_playmats: PLAYMATS.map(playmat => playmat.id),
    updated_at: new Date().toISOString(),
  };
}

export async function fetchPlayerProgress(playerId: string, email?: string | null) {
  if (isLocalTestAccount(email)) {
    return { data: localTestPlayerProgress(playerId), error: null };
  }

  const { data, error } = await supabase
    .from('player_progress')
    .select('*')
    .eq('player_id', playerId)
    .maybeSingle();

  return { data: data as PlayerProgress | null, error: error?.message ?? null };
}

export async function equipProfileFrame(playerId: string, frameId: string, email?: string | null) {
  if (isLocalTestAccount(email)) {
    return {
      error: null,
      progress: {
        ...localTestPlayerProgress(playerId),
        equipped_profile_frame: frameId,
        updated_at: new Date().toISOString(),
      },
    };
  }

  const { data: current, error: fetchError } = await fetchPlayerProgress(playerId, email);
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

export async function equipCardFrame(playerId: string, frameId: string, email?: string | null) {
  if (isLocalTestAccount(email)) {
    return {
      error: null,
      progress: {
        ...localTestPlayerProgress(playerId),
        equipped_card_frame: frameId,
        updated_at: new Date().toISOString(),
      },
    };
  }

  const { data: current, error: fetchError } = await fetchPlayerProgress(playerId, email);
  if (fetchError) return { error: fetchError };

  const progress = current ?? defaultPlayerProgress(playerId);
  if (!(progress.unlocked_card_frames ?? ['default']).includes(frameId)) {
    return { error: 'Cor de carta ainda nao comprada.' };
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

export async function equipPlaymat(playerId: string, playmatId: string, email?: string | null) {
  if (isLocalTestAccount(email)) {
    return {
      error: null,
      progress: {
        ...localTestPlayerProgress(playerId),
        equipped_playmat: playmatId,
        updated_at: new Date().toISOString(),
      },
    };
  }

  const { data: current, error: fetchError } = await fetchPlayerProgress(playerId, email);
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

export async function purchaseShopItem(playerId: string, item: ShopItem, email?: string | null) {
  if (isLocalTestAccount(email)) {
    return {
      error: null,
      progress: {
        ...localTestPlayerProgress(playerId),
        updated_at: new Date().toISOString(),
      },
    };
  }

  const { data: current, error: fetchError } = await fetchPlayerProgress(playerId, email);
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

export async function purchaseNameChange(playerId: string, newUsername: string, email?: string | null) {
  const username = newUsername.trim();
  if (username.length < 3) return { error: 'Use pelo menos 3 caracteres.' };
  if (username.length > 18) return { error: 'Use no maximo 18 caracteres.' };

  if (isLocalTestAccount(email)) {
    return {
      error: null,
      progress: {
        ...localTestPlayerProgress(playerId),
        updated_at: new Date().toISOString(),
      },
    };
  }

  const { data: current, error: fetchError } = await fetchPlayerProgress(playerId, email);
  if (fetchError) return { error: fetchError };

  const progress = current ?? defaultPlayerProgress(playerId);
  const gold = progress.gold ?? 0;
  if (gold < NAME_CHANGE_ITEM.price) return { error: 'Gold insuficiente.' };

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      username,
      updated_at: new Date().toISOString(),
    })
    .eq('id', playerId);

  if (profileError) {
    if (profileError.code === '23505') return { error: 'Esse nome ja esta em uso.' };
    return { error: profileError.message };
  }

  const payload: PlayerProgress = {
    ...progress,
    gold: gold - NAME_CHANGE_ITEM.price,
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

  DAILY_FIRST_WIN_BONUSES.forEach(bonus => {
    if (completedSet.has(bonus.id)) return;
    if (input.result !== 'win' || input.mode !== bonus.mode) return;

    completedSet.add(bonus.id);
    xpGain += bonus.xpReward;
    goldGain += bonus.goldReward;
  });

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
