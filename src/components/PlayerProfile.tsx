import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Award, Bot, Calendar, CheckCircle2, Coins, Crown, Gem, Medal, Palette, Shield, ShoppingBag, Sparkles, Target, Trophy, Users } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import {
  fetchPlayerHistory,
  fetchRanking,
  getCrystalRank,
  PlayerMatchResult,
  RankingProfile,
  summarizeHistory,
} from '../lib/ranking';
import {
  calculateLevelFromXp,
  CARD_FRAMES,
  DAILY_MISSIONS,
  defaultPlayerProgress,
  equipCardFrame,
  equipPlaymat,
  equipProfileFrame,
  fetchPlayerProgress,
  getTodayKey,
  PLAYMATS,
  PlayerProgress,
  PROFILE_FRAMES,
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
}

type Tab = 'overview' | 'missions' | 'shop' | 'history' | 'ranking';

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

export default function PlayerProfile({ onBack, onShowAuth, onProgressChange }: PlayerProfileProps) {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [historyMode, setHistoryMode] = useState<'all' | 'pvp' | 'ai'>('all');
  const [history, setHistory] = useState<PlayerMatchResult[]>([]);
  const [ranking, setRanking] = useState<RankingProfile[]>([]);
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingFrame, setSavingFrame] = useState<string | null>(null);
  const [savingShop, setSavingShop] = useState<string | null>(null);
  const [frameMessage, setFrameMessage] = useState<string | null>(null);

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
        fetchRanking(),
        fetchPlayerProgress(user.id),
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
  const levelInfo = calculateLevelFromXp(progress?.total_xp ?? 0);
  const xpToNext = xpNeededForLevel(levelInfo.level);
  const xpPercent = Math.min(100, Math.round((levelInfo.xp / xpToNext) * 100));
  const today = getTodayKey();
  const missionProgress = progress?.daily_mission_date === today ? progress.mission_progress : {};
  const completedMissions = new Set(progress?.daily_mission_date === today ? progress.completed_daily_missions : []);
  const equippedFrame = PROFILE_FRAMES.find(frame => frame.id === progress?.equipped_profile_frame) ?? PROFILE_FRAMES[0];
  const unlockedProfileFrames = progress?.unlocked_profile_frames ?? ['default'];
  const unlockedCardFrames = progress?.unlocked_card_frames ?? ['default'];
  const unlockedPlaymats = progress?.unlocked_playmats ?? ['default'];
  const equippedCardFrame = progress?.equipped_card_frame ?? 'default';
  const equippedPlaymat = progress?.equipped_playmat ?? 'default';
  const gold = progress?.gold ?? 0;

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
    const result = await equipProfileFrame(user.id, frameId);
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
    const result = await purchaseShopItem(user.id, item);
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
    const result = await equipCardFrame(user.id, frameId);
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
    const result = await equipPlaymat(user.id, playmatId);
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

        <div className="flex gap-2 mb-5">
          {[
            ['overview', 'Resumo', Sparkles],
            ['missions', 'Missoes', Target],
            ['shop', 'Loja', ShoppingBag],
            ['history', 'Historico', Calendar],
            ['ranking', 'Ranking', Trophy],
          ].map(([id, label, Icon]) => (
            <button
              key={id as string}
              onClick={() => setTab(id as Tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-colors ${
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
                <div key={match.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
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
                </div>
              ))}
            </div>
          </Panel>
        ) : (
          <Panel title="Ranking PvP" icon={<Medal className="w-4 h-4 text-amber-300" />}>
            <div className="space-y-2">
              {ranking.map((item, index) => {
                const itemRank = getCrystalRank(item.rating);
                const total = item.wins + item.losses + item.draws;
                const rate = total > 0 ? Math.round((item.wins / total) * 100) : 0;
                return (
                  <div key={item.id} className={`flex items-center gap-3 rounded-xl border p-3 ${
                    item.id === user.id ? 'bg-amber-950/25 border-amber-500/40' : 'bg-slate-950/60 border-slate-800'
                  }`}>
                    <div className="w-8 text-center text-slate-400 font-black">#{index + 1}</div>
                    <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center">
                      <Gem className={`w-5 h-5 ${itemRank.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{item.username}</p>
                      <p className={`text-xs font-semibold ${itemRank.color}`}>{itemRank.name}</p>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <p className="text-white font-black">{item.rating} pts</p>
                      <p>{item.wins}V / {item.losses}D / {rate}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
      </div>
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
