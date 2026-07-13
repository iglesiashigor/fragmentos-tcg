import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Award, Bot, Calendar, CheckCircle2, ChevronRight, Coins, Crown, Gem, Medal, Palette, Pencil, ScrollText, Shield, ShoppingBag, Sparkles, Target, Trophy, Users, X } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import {
  CRYSTAL_RANKS,
  fetchPlayerHistory,
  fetchRanking,
  getCrystalRank,
  PlayerMatchResult,
  RankingProfile,
  summarizeHistory,
} from '../lib/ranking';
import {
  ACHIEVEMENTS,
  calculateLevelFromXp,
  CARD_FRAMES,
  DAILY_FIRST_WIN_BONUSES,
  DAILY_MISSIONS,
  defaultPlayerProgress,
  equipCardFrame,
  equipPlaymat,
  equipProfileFrame,
  fetchPlayerProgress,
  getTodayKey,
  LEVEL_REWARDS,
  NAME_CHANGE_ITEM,
  PLAYMATS,
  PlayerProgress,
  PROFILE_FRAMES,
  purchaseNameChange,
  purchaseShopItem,
  SHOP_ITEMS,
  ShopItem,
  xpNeededForLevel,
} from '../lib/progression';
import { getCardById } from '../data/cards';

interface PlayerProfileProps {
  onBack: () => void;
  onShowAuth: () => void;
  onProgressChange?: (progress: PlayerProgress) => void;
  initialTab?: ProfileTab;
}

export type ProfileTab = 'overview' | 'missions' | 'achievements' | 'shop' | 'history' | 'ranking';

function resultLabel(result: PlayerMatchResult['result']) {
  if (result === 'win') return 'Vitoria';
  if (result === 'loss') return 'Derrota';
  return 'Empate';
}

function resultClass(result: PlayerMatchResult['result']) {
  if (result === 'win') return 'text-emerald-300 bg-emerald-950/40 border-emerald-600/30';
  if (result === 'loss') return 'text-rose-300 bg-rose-950/40 border-rose-600/30';
  return 'text-slate-300 bg-slate-800/70 border-slate-600/30';
}

function finishReasonLabel(reason: PlayerMatchResult['finish_reason']) {
  if (reason === 'surrender') return 'desistencia';
  if (reason === 'inactivity') return 'inatividade';
  if (reason === 'disconnect') return 'desconexao';
  return 'normal';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function PlayerProfile({ onBack, onShowAuth, onProgressChange, initialTab = 'overview' }: PlayerProfileProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [historyMode, setHistoryMode] = useState<'all' | 'pvp' | 'ai'>('all');
  const [history, setHistory] = useState<PlayerMatchResult[]>([]);
  const [ranking, setRanking] = useState<RankingProfile[]>([]);
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingFrame, setSavingFrame] = useState<string | null>(null);
  const [savingShop, setSavingShop] = useState<string | null>(null);
  const [frameMessage, setFrameMessage] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<PlayerMatchResult | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const load = async () => {
      setLoading(true);
      const [historyResult, rankingResult, progressResult] = await Promise.all([
        fetchPlayerHistory(user.id),
        fetchRanking(500),
        fetchPlayerProgress(user.id, user.email),
      ]);
      if (!mounted) return;
      setHistory(historyResult.data);
      setRanking(rankingResult.data);
      setProgress(progressResult.data);
      setLoading(false);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [user]);

  const summary = useMemo(() => summarizeHistory(history), [history]);
  const rating = profile?.rating ?? 0;
  const rank = getCrystalRank(rating);
  const filteredHistory = history.filter(match => historyMode === 'all' || match.mode === historyMode);
  const pvpTotal = summary.pvpWins + summary.pvpLosses + summary.pvpDraws;
  const winRate = pvpTotal > 0 ? Math.round((summary.pvpWins / pvpTotal) * 100) : 0;
  const myPosition = user ? ranking.findIndex(item => item.id === user.id) + 1 : 0;
  const rankingByRank = useMemo(() => {
    return [...CRYSTAL_RANKS]
      .reverse()
      .map(rankInfo => ({
        rank: rankInfo,
        players: ranking
          .filter(item => getCrystalRank(item.rating).name === rankInfo.name)
          .slice(0, 5),
      }))
      .filter(group => group.players.length > 0);
  }, [ranking]);
  const levelInfo = calculateLevelFromXp(progress?.total_xp ?? 0);
  const xpToNext = xpNeededForLevel(levelInfo.level);
  const xpPercent = Math.min(100, Math.round((levelInfo.xp / xpToNext) * 100));
  const today = getTodayKey();
  const missionProgress = progress?.daily_mission_date === today ? progress.mission_progress : {};
  const completedMissions = new Set(progress?.daily_mission_date === today ? progress.completed_daily_missions : []);
  const achievementProgress = progress?.achievement_progress ?? {};
  const completedAchievements = new Set(progress?.completed_achievements ?? []);
  const equippedFrame = PROFILE_FRAMES.find(frame => frame.id === progress?.equipped_profile_frame) ?? PROFILE_FRAMES[0];
  const unlockedProfileFrames = progress?.unlocked_profile_frames ?? ['default'];
  const unlockedCardFrames = progress?.unlocked_card_frames ?? ['default'];
  const unlockedPlaymats = progress?.unlocked_playmats ?? ['default'];
  const equippedCardFrame = progress?.equipped_card_frame ?? 'default';
  const equippedPlaymat = progress?.equipped_playmat ?? 'default';
  const gold = progress?.gold ?? 0;
  const visibleLevelRewards = LEVEL_REWARDS.filter(reward => reward.level >= levelInfo.level).slice(0, 5);
  const levelRewardsToShow = visibleLevelRewards.length > 0 ? visibleLevelRewards : LEVEL_REWARDS.slice(-5);

  const updateProgress = (nextProgress: PlayerProgress) => {
    setProgress(nextProgress);
    onProgressChange?.(nextProgress);
  };

  const handleEquipFrame = async (frameId: string) => {
    if (!user || savingFrame) return;
    if (!unlockedProfileFrames.includes(frameId)) {
      setFrameMessage('Essa moldura ainda nao foi liberada.');
      return;
    }

    setSavingFrame(frameId);
    setFrameMessage(null);
    const result = await equipProfileFrame(user.id, frameId, user.email);
    if (result.error) {
      setFrameMessage(result.error);
    } else {
      setProgress(current => ({
        ...(current ?? defaultPlayerProgress(user.id)),
        equipped_profile_frame: frameId,
        unlocked_profile_frames: current?.unlocked_profile_frames ?? ['default'],
        updated_at: new Date().toISOString(),
      }));
      setFrameMessage('Moldura equipada.');
    }
    setSavingFrame(null);
  };

  const handlePurchase = async (item: ShopItem) => {
    if (!user || savingShop) return;
    setSavingShop(item.id);
    setFrameMessage(null);
    const result = await purchaseShopItem(user.id, item, user.email);
    if (result.error || !result.progress) {
      setFrameMessage(result.error ?? 'Nao foi possivel comprar o item.');
    } else {
      updateProgress(result.progress);
      setFrameMessage('Item comprado.');
    }
    setSavingShop(null);
  };

  const handleEquipCardFrame = async (frameId: string) => {
    if (!user || savingShop) return;
    setSavingShop(frameId);
    setFrameMessage(null);
    const result = await equipCardFrame(user.id, frameId, user.email);
    if (result.error) {
      setFrameMessage(result.error);
    } else {
      updateProgress({
        ...(progress ?? defaultPlayerProgress(user.id)),
        equipped_card_frame: frameId,
        updated_at: new Date().toISOString(),
      });
      setFrameMessage('Cor de carta equipada.');
    }
    setSavingShop(null);
  };

  const handleEquipPlaymat = async (playmatId: string) => {
    if (!user || savingShop) return;
    setSavingShop(playmatId);
    setFrameMessage(null);
    const result = await equipPlaymat(user.id, playmatId, user.email);
    if (result.error) {
      setFrameMessage(result.error);
    } else {
      updateProgress({
        ...(progress ?? defaultPlayerProgress(user.id)),
        equipped_playmat: playmatId,
        updated_at: new Date().toISOString(),
      });
      setFrameMessage('Campo equipado.');
    }
    setSavingShop(null);
  };

  const handleOpenNameChange = () => {
    setNewUsername(profile?.username ?? '');
    setFrameMessage(null);
    setShowNameModal(true);
  };

  const handleNameChange = async () => {
    if (!user || savingShop) return;
    const nextName = newUsername.trim();
    if (nextName === profile?.username) {
      setFrameMessage('Escolha um nome diferente do atual.');
      return;
    }

    setSavingShop(NAME_CHANGE_ITEM.id);
    setFrameMessage(null);
    const result = await purchaseNameChange(user.id, nextName, user.email);
    if (result.error || !result.progress) {
      setFrameMessage(result.error ?? 'Nao foi possivel alterar o nome.');
    } else {
      updateProgress(result.progress);
      await refreshProfile();
      setFrameMessage('Nome alterado com sucesso.');
      setShowNameModal(false);
    }
    setSavingShop(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center">
          <Gem className="w-10 h-10 text-amber-300 mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-2">Perfil do jogador</h1>
          <p className="text-slate-400 text-sm mb-5">Entre na sua conta para ver historico, ranking e elo.</p>
          <div className="flex gap-2">
            <button onClick={onBack} className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold">
              Voltar
            </button>
            <button onClick={onShowAuth} className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl text-sm font-bold">
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800 bg-slate-950/80 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-semibold transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Menu
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Crown className="w-4 h-4 text-amber-300" />
            Perfil e Ranking
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className={`rounded-2xl border border-slate-700 bg-gradient-to-br ${rank.bg} p-5 mb-5 shadow-2xl shadow-black/20`}>
          <div className="flex flex-col md:flex-row md:items-center gap-5">
            <div className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center shrink-0 shadow-lg ${equippedFrame.className}`}>
              <Gem className={`w-10 h-10 ${rank.color}`} />
            </div>
            <div className="flex-1">
              <p className="text-slate-400 text-xs uppercase tracking-[0.24em] font-bold">Jogador</p>
              <h1 className="text-3xl font-black text-white">{profile?.username ?? 'Jogador'}</h1>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className={`px-3 py-1 rounded-full bg-slate-950/70 border border-white/10 text-sm font-bold ${rank.color}`}>
                  {rank.name}
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-950/70 border border-white/10 text-sm text-slate-300">
                  {rating} pontos
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-950/70 border border-white/10 text-sm text-blue-200">
                  Nivel {levelInfo.level}
                </span>
                <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-300/30 text-sm text-amber-200 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" />
                  {gold} gold
                </span>
                {progress?.supporter && (
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-300/30 text-sm text-amber-200">
                    Apoiador
                  </span>
                )}
                {myPosition > 0 && (
                  <span className="px-3 py-1 rounded-full bg-slate-950/70 border border-white/10 text-sm text-amber-300">
                    #{myPosition} no ranking
                  </span>
                )}
              </div>
              <div className="mt-4 max-w-md">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>XP do nivel</span>
                  <span>{levelInfo.xp}/{xpToNext}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-950/80 border border-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-amber-400" style={{ width: `${xpPercent}%` }} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 min-w-[17rem]">
              <StatBox label="Vitorias PvP" value={summary.pvpWins} tone="emerald" />
              <StatBox label="Derrotas PvP" value={summary.pvpLosses} tone="rose" />
              <StatBox label="Winrate" value={`${winRate}%`} tone="blue" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
          {[
            ['overview', 'Resumo', Sparkles],
            ['missions', 'Missoes', Target],
            ['achievements', 'Conquistas', Award],
            ['shop', 'Loja', ShoppingBag],
            ['history', 'Historico', Calendar],
            ['ranking', 'Ranking', Trophy],
          ].map(([id, label, Icon]) => (
            <button
              key={id as string}
              onClick={() => setTab(id as ProfileTab)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-colors ${
                tab === id
                  ? 'bg-amber-600/20 border-amber-400/40 text-amber-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label as string}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
            Carregando perfil...
          </div>
        ) : tab === 'overview' ? (
          <div className="grid md:grid-cols-2 gap-4">
            <Panel title="PvP" icon={<Users className="w-4 h-4 text-amber-300" />}>
              <div className="grid grid-cols-3 gap-2">
                <StatBox label="Vitorias" value={summary.pvpWins} tone="emerald" />
                <StatBox label="Derrotas" value={summary.pvpLosses} tone="rose" />
                <StatBox label="Empates" value={summary.pvpDraws} tone="slate" />
              </div>
            </Panel>
            <Panel title="Contra IA" icon={<Bot className="w-4 h-4 text-blue-300" />}>
              <div className="grid grid-cols-3 gap-2">
                <StatBox label="Vitorias" value={summary.aiWins} tone="emerald" />
                <StatBox label="Derrotas" value={summary.aiLosses} tone="rose" />
                <StatBox label="Empates" value={summary.aiDraws} tone="slate" />
              </div>
            </Panel>
            <Panel title="Recompensas de nivel" icon={<Crown className="w-4 h-4 text-amber-300" />}>
              <div className="space-y-2">
                {levelRewardsToShow.map(reward => {
                  const unlocked = levelInfo.level >= reward.level;
                  const cardFrame = CARD_FRAMES.find(frame => frame.id === reward.cardFrameId);
                  const profileFrame = PROFILE_FRAMES.find(frame => frame.id === reward.profileFrameId);
                  const playmat = PLAYMATS.find(item => item.id === reward.playmatId);
                  const rewardParts = [
                    reward.goldReward ? `${reward.goldReward} gold` : null,
                    profileFrame ? profileFrame.name : null,
                    cardFrame ? cardFrame.name : null,
                    playmat ? playmat.name : null,
                  ].filter(Boolean);

                  return (
                    <div key={`${reward.level}-${reward.title}`} className={`rounded-xl border p-3 ${unlocked ? 'border-emerald-500/30 bg-emerald-950/15' : 'border-slate-800 bg-slate-950/60'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-black ${unlocked ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200' : 'border-amber-400/30 bg-amber-500/10 text-amber-200'}`}>
                          {reward.level}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-black text-white">{reward.title}</h3>
                            <span className={`shrink-0 text-[10px] font-black uppercase tracking-wide ${unlocked ? 'text-emerald-300' : 'text-slate-500'}`}>
                              {unlocked ? 'Liberado' : `Nivel ${reward.level}`}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">{reward.description}</p>
                          <p className="mt-2 text-xs font-bold text-amber-200">{rewardParts.join(' + ')}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
            <Panel title="Cosmeticos" icon={<Award className="w-4 h-4 text-amber-300" />}>
              <div className="grid sm:grid-cols-3 gap-2">
                {PROFILE_FRAMES.map(frame => {
                  const unlocked = unlockedProfileFrames.includes(frame.id);
                  const equipped = equippedFrame.id === frame.id;
                  return (
                    <button
                      key={frame.id}
                      onClick={() => handleEquipFrame(frame.id)}
                      disabled={!unlocked || savingFrame !== null}
                      className={`text-left rounded-xl border p-3 transition-all ${
                        equipped
                          ? 'border-amber-400/70 bg-amber-950/25 shadow-lg shadow-amber-900/20'
                          : unlocked
                          ? 'border-slate-700 bg-slate-950/70 hover:border-slate-500 hover:bg-slate-900'
                          : 'border-slate-800 bg-slate-950/30 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl border-2 mb-3 ${frame.className}`} />
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-white">{frame.name}</p>
                        <span className={`text-[10px] font-black uppercase ${
                          equipped ? 'text-amber-200' : unlocked ? 'text-emerald-300' : 'text-slate-500'
                        }`}>
                          {equipped ? 'Em uso' : unlocked ? 'Usar' : 'Bloqueada'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{frame.description}</p>
                    </button>
                  );
                })}
              </div>
              {frameMessage && (
                <p className="mt-3 text-xs text-slate-400">{frameMessage}</p>
              )}
            </Panel>
          </div>
        ) : tab === 'missions' ? (
          <Panel title="Missoes diarias" icon={<Target className="w-4 h-4 text-amber-300" />}>
            <div className="mb-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">Bonus diario</h3>
                  <p className="text-xs text-slate-500">A primeira vitoria do dia rende uma recompensa extra.</p>
                </div>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200">
                  Reseta todo dia
                </span>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {DAILY_FIRST_WIN_BONUSES.map(bonus => {
                  const done = completedMissions.has(bonus.id);
                  return (
                    <div key={bonus.id} className={`rounded-xl border p-4 ${done ? 'border-emerald-500/35 bg-emerald-950/20' : 'border-amber-500/25 bg-amber-950/10'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${done ? 'bg-emerald-500/20 border-emerald-400/40' : 'bg-amber-500/15 border-amber-400/30'}`}>
                          {done ? <CheckCircle2 className="w-5 h-5 text-emerald-300" /> : <Trophy className="w-5 h-5 text-amber-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="font-black text-white text-sm">{bonus.title}</h3>
                            <span className="text-xs font-bold text-blue-200">+{bonus.xpReward} XP / +{bonus.goldReward} gold</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">{bonus.description}</p>
                          <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                              {bonus.mode === 'pvp' ? 'PvP Online' : 'Contra IA'}
                            </span>
                            <span className={`text-xs font-black ${done ? 'text-emerald-300' : 'text-amber-200'}`}>
                              {done ? 'Recebido' : 'Disponivel'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mb-3">
              <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">Objetivos do dia</h3>
              <p className="text-xs text-slate-500">Complete jogando partidas contra IA ou PvP.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {DAILY_MISSIONS.map(mission => {
                const current = Math.min(mission.target, missionProgress[mission.id] ?? 0);
                const done = completedMissions.has(mission.id);
                const percent = Math.min(100, Math.round((current / mission.target) * 100));
                return (
                  <div key={mission.id} className={`rounded-xl border p-4 ${done ? 'border-emerald-500/35 bg-emerald-950/20' : 'border-slate-800 bg-slate-950/60'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${done ? 'bg-emerald-500/20 border-emerald-400/40' : 'bg-slate-900 border-slate-700'}`}>
                        {done ? <CheckCircle2 className="w-5 h-5 text-emerald-300" /> : <Target className="w-5 h-5 text-amber-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-black text-white text-sm">{mission.title}</h3>
                          <span className="text-xs font-bold text-blue-200">+{mission.xpReward} XP / +{mission.goldReward} gold</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{mission.description}</p>
                        <div className="mt-3">
                          <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                            <span>Progresso</span>
                            <span>{current}/{mission.target}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                            <div className={`h-full ${done ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        ) : tab === 'achievements' ? (
          <Panel title="Conquistas permanentes" icon={<Award className="w-4 h-4 text-amber-300" />}>
            <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-black text-white">Objetivos de longo prazo</h3>
                  <p className="mt-1 text-xs text-slate-500">Essas conquistas nao resetam e rendem gold e XP quando completas.</p>
                </div>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200">
                  {completedAchievements.size}/{ACHIEVEMENTS.length} completas
                </span>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {ACHIEVEMENTS.map(achievement => {
                const current = Math.min(achievement.target, achievementProgress[achievement.id] ?? 0);
                const done = completedAchievements.has(achievement.id);
                const percent = Math.min(100, Math.round((current / achievement.target) * 100));
                return (
                  <div key={achievement.id} className={`rounded-xl border p-4 ${done ? 'border-emerald-500/35 bg-emerald-950/20' : 'border-slate-800 bg-slate-950/60'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${done ? 'bg-emerald-500/20 border-emerald-400/40' : 'bg-slate-900 border-slate-700'}`}>
                        {done ? <CheckCircle2 className="w-5 h-5 text-emerald-300" /> : <Award className="w-5 h-5 text-amber-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-black text-white text-sm">{achievement.title}</h3>
                            <p className="text-xs text-slate-400 mt-1">{achievement.description}</p>
                          </div>
                          <span className="shrink-0 text-xs font-bold text-blue-200">+{achievement.xpReward} XP / +{achievement.goldReward} gold</span>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                            <span>{done ? 'Completa' : 'Progresso'}</span>
                            <span>{current}/{achievement.target}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                            <div className={`h-full ${done ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        ) : tab === 'shop' ? (
          <div className="grid lg:grid-cols-[1fr_1fr] gap-4">
            <Panel title="Cores de carta" icon={<Palette className="w-4 h-4 text-amber-300" />}>
              <div className="grid sm:grid-cols-2 gap-3">
                {CARD_FRAMES.map(frame => {
                  const owned = unlockedCardFrames.includes(frame.id);
                  const equipped = equippedCardFrame === frame.id;
                  const shopItem = SHOP_ITEMS.find(item => item.type === 'card_frame' && item.id === frame.id);
                  return (
                    <ShopCard
                      key={frame.id}
                      name={frame.name}
                      description={frame.description}
                      price={frame.price}
                      owned={owned}
                      equipped={equipped}
                      canBuy={gold >= frame.price}
                      disabled={savingShop !== null}
                      onBuy={shopItem ? () => handlePurchase(shopItem) : undefined}
                      onEquip={() => handleEquipCardFrame(frame.id)}
                    >
                      <div className={`w-16 h-24 rounded-lg bg-gradient-to-br from-slate-800 to-slate-950 border-2 border-slate-500 ${frame.className}`} />
                    </ShopCard>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Campos de batalha" icon={<Sparkles className="w-4 h-4 text-blue-300" />}>
              <div className="grid sm:grid-cols-2 gap-3">
                {PLAYMATS.map(playmat => {
                  const owned = unlockedPlaymats.includes(playmat.id);
                  const equipped = equippedPlaymat === playmat.id;
                  const shopItem = SHOP_ITEMS.find(item => item.type === 'playmat' && item.id === playmat.id);
                  return (
                    <ShopCard
                      key={playmat.id}
                      name={playmat.name}
                      description={playmat.description}
                      price={playmat.price}
                      owned={owned}
                      equipped={equipped}
                      canBuy={gold >= playmat.price}
                      disabled={savingShop !== null}
                      onBuy={shopItem ? () => handlePurchase(shopItem) : undefined}
                      onEquip={() => handleEquipPlaymat(playmat.id)}
                    >
                      <div className={`w-full h-20 rounded-lg border border-white/10 ${playmat.className}`} />
                    </ShopCard>
                  );
                })}
              </div>
              {frameMessage && (
                <p className="mt-3 text-xs text-slate-400">{frameMessage}</p>
              )}
            </Panel>

            <div className="lg:col-span-2">
              <Panel title="Servicos" icon={<Pencil className="w-4 h-4 text-amber-300" />}>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-500/15">
                        <Pencil className="h-5 w-5 text-amber-200" />
                      </div>
                      <div>
                        <h3 className="font-black text-white">{NAME_CHANGE_ITEM.name}</h3>
                        <p className="mt-1 text-sm text-slate-400">{NAME_CHANGE_ITEM.description}</p>
                        <p className="mt-2 flex items-center gap-1.5 text-xs font-black text-amber-200">
                          <Coins className="h-3.5 w-3.5" />
                          {NAME_CHANGE_ITEM.price} gold
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenNameChange}
                      disabled={savingShop !== null || gold < NAME_CHANGE_ITEM.price}
                      className={`rounded-xl border px-4 py-3 text-sm font-black transition-colors ${
                        gold >= NAME_CHANGE_ITEM.price
                          ? 'border-emerald-400/35 bg-emerald-600/20 text-emerald-100 hover:bg-emerald-600/30'
                          : 'cursor-not-allowed border-slate-800 bg-slate-900 text-slate-500'
                      }`}
                    >
                      {gold >= NAME_CHANGE_ITEM.price ? 'Comprar troca' : 'Gold insuficiente'}
                    </button>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        ) : tab === 'history' ? (
          <Panel title="Historico de partidas" icon={<Calendar className="w-4 h-4 text-blue-300" />}>
            <div className="flex gap-2 mb-4">
              {[
                ['all', 'Todas'],
                ['pvp', 'PvP'],
                ['ai', 'IA'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setHistoryMode(id as typeof historyMode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                    historyMode === id ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {filteredHistory.length === 0 ? (
                <p className="text-slate-500 text-sm py-6 text-center">Nenhuma partida registrada ainda.</p>
              ) : filteredHistory.map(match => (
                <button
                  key={match.id}
                  type="button"
                  onClick={() => setSelectedMatch(match)}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-left transition-colors hover:border-slate-600 hover:bg-slate-900/80"
                >
                  <div className={`px-2.5 py-1 rounded-lg border text-xs font-black ${resultClass(match.result)}`}>
                    {resultLabel(match.result)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {match.mode === 'pvp' ? `PvP contra ${match.opponent_name ?? 'Jogador'}` : 'Partida contra IA'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {getCardById(match.hero_id ?? '')?.name ?? 'Heroi'} • {match.turns ?? '-'} turnos • {finishReasonLabel(match.finish_reason)} • {formatDate(match.created_at)}
                    </p>
                  </div>
                  {match.mode === 'pvp' && (
                    <span className={`text-xs font-bold ${match.rating_delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {match.rating_delta >= 0 ? '+' : ''}{match.rating_delta}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                </button>
              ))}
            </div>
          </Panel>
        ) : (
          <Panel title="Ranking PvP" icon={<Medal className="w-4 h-4 text-amber-300" />}>
            <div className="space-y-4">
              {rankingByRank.length === 0 ? (
                <p className="text-slate-500 text-sm py-6 text-center">Nenhum jogador ranqueado ainda.</p>
              ) : rankingByRank.map(group => (
                <section key={group.rank.name} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900">
                        <Gem className={`h-5 w-5 ${group.rank.color}`} />
                      </div>
                      <div>
                        <h3 className={`text-sm font-black ${group.rank.color}`}>{group.rank.name}</h3>
                        <p className="text-[11px] text-slate-500">Top 5 do elo</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-400">
                      {group.rank.min}+ pts
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.players.map((item, index) => {
                      const total = item.wins + item.losses + item.draws;
                      const rate = total > 0 ? Math.round((item.wins / total) * 100) : 0;
                      return (
                        <div key={item.id} className={`flex items-center gap-3 rounded-xl border p-3 ${
                          item.id === user.id ? 'bg-amber-950/25 border-amber-500/40' : 'bg-slate-950/60 border-slate-800'
                        }`}>
                          <div className="w-8 text-center text-slate-400 font-black">#{index + 1}</div>
                          <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center">
                            <Gem className={`w-5 h-5 ${group.rank.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{item.username}</p>
                            <p className="text-xs text-slate-500">{item.wins}V / {item.losses}D / {rate}%</p>
                          </div>
                          <div className="text-right text-xs text-slate-400">
                            <p className="text-white font-black">{item.rating} pts</p>
                            <p>{total} partidas</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </Panel>
        )}
      </div>
      {selectedMatch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-log-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedMatch(null);
            }
          }}
        >
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-amber-300" />
                  <h2 id="match-log-title" className="font-black text-white">Log da partida</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedMatch.mode === 'pvp'
                    ? `Contra ${selectedMatch.opponent_name ?? 'Jogador'}`
                    : 'Contra IA'} - {formatDate(selectedMatch.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMatch(null)}
                className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 transition-colors hover:border-slate-600 hover:text-white"
                aria-label="Fechar log"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {selectedMatch.match_log?.length ? (
                <ol className="space-y-2">
                  {selectedMatch.match_log.map((line, index) => (
                    <li key={`${index}-${line}`} className="flex gap-3 text-sm leading-relaxed">
                      <span className="w-7 shrink-0 select-none text-right text-xs text-slate-700">{index + 1}</span>
                      <span className="text-slate-300">{line}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-10 text-center text-sm text-slate-500">
                  Esta partida foi salva antes do historico de logs ser ativado.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      {showNameModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="name-change-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowNameModal(false);
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-amber-300" />
                  <h2 id="name-change-title" className="font-black text-white">Alterar nome</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Custo: {NAME_CHANGE_ITEM.price} gold
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNameModal(false)}
                className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 transition-colors hover:border-slate-600 hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Novo nome
              </label>
              <input
                value={newUsername}
                onChange={(event) => setNewUsername(event.target.value)}
                maxLength={18}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white outline-none transition-colors placeholder:text-slate-600 focus:border-amber-400/60"
                placeholder="Digite o novo nome"
                autoFocus
              />
              <p className="mt-2 text-xs text-slate-500">Use entre 3 e 18 caracteres.</p>
              {frameMessage && (
                <p className="mt-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">{frameMessage}</p>
              )}
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNameModal(false)}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleNameChange}
                  disabled={savingShop === NAME_CHANGE_ITEM.id}
                  className="flex-1 rounded-xl border border-amber-300/35 bg-amber-500 px-4 py-3 text-sm font-black text-slate-950 transition-colors hover:bg-amber-400 disabled:cursor-wait disabled:opacity-70"
                >
                  {savingShop === NAME_CHANGE_ITEM.id ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl shadow-black/20">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-white font-black">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ShopCard({
  name,
  description,
  price,
  owned,
  equipped,
  canBuy,
  disabled,
  onBuy,
  onEquip,
  children,
}: {
  name: string;
  description: string;
  price: number;
  owned: boolean;
  equipped: boolean;
  canBuy: boolean;
  disabled: boolean;
  onBuy?: () => void;
  onEquip: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-3 bg-slate-950/60 ${equipped ? 'border-amber-400/60' : 'border-slate-800'}`}>
      <div className="mb-3 flex justify-center">{children}</div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-white">{name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
        <span className="shrink-0 text-xs font-black text-amber-200 flex items-center gap-1">
          <Coins className="w-3 h-3" />
          {price}
        </span>
      </div>
      <button
        onClick={owned ? onEquip : onBuy}
        disabled={disabled || (!owned && (!onBuy || !canBuy))}
        className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-black border transition-colors ${
          equipped
            ? 'bg-amber-500/20 border-amber-300/40 text-amber-100'
            : owned
            ? 'bg-blue-600/20 border-blue-400/35 text-blue-100 hover:bg-blue-600/30'
            : canBuy
            ? 'bg-emerald-600/20 border-emerald-400/35 text-emerald-100 hover:bg-emerald-600/30'
            : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        {equipped ? 'Em uso' : owned ? 'Equipar' : canBuy ? 'Comprar' : 'Gold insuficiente'}
      </button>
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number | string; tone: 'emerald' | 'rose' | 'blue' | 'slate' }) {
  const color = tone === 'emerald' ? 'text-emerald-300' : tone === 'rose' ? 'text-rose-300' : tone === 'blue' ? 'text-blue-300' : 'text-slate-300';
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-center">
      <div className={`text-2xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">{label}</div>
    </div>
  );
}
