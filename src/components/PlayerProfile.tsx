import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bot, Calendar, Crown, Gem, Medal, Shield, Sparkles, Trophy, Users } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import {
  fetchPlayerHistory,
  fetchRanking,
  getCrystalRank,
  PlayerMatchResult,
  RankingProfile,
  summarizeHistory,
} from '../lib/ranking';
import { getCardById } from '../data/cards';

interface PlayerProfileProps {
  onBack: () => void;
  onShowAuth: () => void;
}

type Tab = 'overview' | 'history' | 'ranking';

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function PlayerProfile({ onBack, onShowAuth }: PlayerProfileProps) {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [historyMode, setHistoryMode] = useState<'all' | 'pvp' | 'ai'>('all');
  const [history, setHistory] = useState<PlayerMatchResult[]>([]);
  const [ranking, setRanking] = useState<RankingProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const load = async () => {
      setLoading(true);
      const [historyResult, rankingResult] = await Promise.all([
        fetchPlayerHistory(user.id),
        fetchRanking(),
      ]);
      if (!mounted) return;
      setHistory(historyResult.data);
      setRanking(rankingResult.data);
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
            <div className="w-20 h-20 rounded-2xl bg-slate-950/70 border border-white/10 flex items-center justify-center shrink-0">
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
                {myPosition > 0 && (
                  <span className="px-3 py-1 rounded-full bg-slate-950/70 border border-white/10 text-sm text-amber-300">
                    #{myPosition} no ranking
                  </span>
                )}
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
                      {getCardById(match.hero_id ?? '')?.name ?? 'Heroi'} • {match.turns ?? '-'} turnos • {formatDate(match.created_at)}
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

function StatBox({ label, value, tone }: { label: string; value: number | string; tone: 'emerald' | 'rose' | 'blue' | 'slate' }) {
  const color = tone === 'emerald' ? 'text-emerald-300' : tone === 'rose' ? 'text-rose-300' : tone === 'blue' ? 'text-blue-300' : 'text-slate-300';
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-center">
      <div className={`text-2xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">{label}</div>
    </div>
  );
}
