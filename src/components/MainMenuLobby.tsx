import React, { useEffect, useMemo, useState } from 'react';
import { DeckDefinition } from '../types/game';
import { DEFAULT_DECKS, deleteDeck, getSavedDecks } from '../data/defaultDecks';
import { getCardById } from '../data/cards';
import { useAuth } from '../lib/authContext';
import { fetchPlayerProgress, PlayerProgress } from '../lib/progression';
import type { ProfileTab } from './PlayerProfile';
import {
  AlertTriangle, BookOpen, Calendar, ChevronRight, Coins, Crown, Edit3, Gem, Globe,
  Layers, LogIn, LogOut, Plus, Shield, ShoppingBag, Sparkles, Star, Swords, Target,
  Trash2, Trophy, User, Users, Zap,
} from 'lucide-react';

interface MainMenuLobbyProps {
  onStartGame: (playerDeck: DeckDefinition, aiDeck: DeckDefinition) => void;
  onStartPvp: () => void;
  onOpenDeckBuilder: (deck?: DeckDefinition) => void;
  onOpenCollection: () => void;
  onOpenProfile: (tab?: ProfileTab) => void;
  onShowAuth: () => void;
  decks: DeckDefinition[];
  decksLoading: boolean;
  user: ReturnType<typeof useAuth>['user'];
  profile: ReturnType<typeof useAuth>['profile'];
  onDeleteDeck: (deckId: string) => Promise<void>;
  onRefreshDecks: () => void;
}

const LAST_AI_MATCH_DECKS_KEY = 'fragmentos-last-ai-match-decks';

function getLastAIMatchDecks(): { playerDeckId?: string; aiDeckId?: string } {
  try {
    return JSON.parse(localStorage.getItem(LAST_AI_MATCH_DECKS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveLastAIMatchDecks(playerDeckId: string, aiDeckId: string) {
  localStorage.setItem(LAST_AI_MATCH_DECKS_KEY, JSON.stringify({ playerDeckId, aiDeckId }));
}

export default function MainMenuLobby({
  onStartGame,
  onStartPvp,
  onOpenDeckBuilder,
  onOpenCollection,
  onOpenProfile,
  onShowAuth,
  decks,
  decksLoading,
  user,
  profile,
  onDeleteDeck,
  onRefreshDecks,
}: MainMenuLobbyProps) {
  const { signOut } = useAuth();
  const displayDecks = useMemo(() => decks.length > 0 ? decks : DEFAULT_DECKS, [decks]);
  const lastAIMatchDecks = useMemo(() => getLastAIMatchDecks(), []);
  const [selectedPlayerDeck, setSelectedPlayerDeck] = useState<string | null>(lastAIMatchDecks.playerDeckId ?? displayDecks[0]?.id ?? null);
  const [selectedAIDeck, setSelectedAIDeck] = useState<string | null>(lastAIMatchDecks.aiDeckId ?? displayDecks[1]?.id ?? displayDecks[0]?.id ?? null);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(lastAIMatchDecks.playerDeckId ?? displayDecks[0]?.id ?? null);
  const [gameMode, setGameMode] = useState<'ai' | 'pvp'>('ai');
  const [error, setError] = useState('');
  const [playerProgress, setPlayerProgress] = useState<PlayerProgress | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const defaultDeckIds = useMemo(() => new Set(DEFAULT_DECKS.map(deck => deck.id)), []);
  const profileName = profile?.username ?? user?.email?.split('@')[0] ?? 'Jogador';
  const playedMatches = (profile?.wins ?? 0) + (profile?.losses ?? 0);
  const winRate = playedMatches > 0 ? Math.round(((profile?.wins ?? 0) / playedMatches) * 100) : 0;
  const deckCardCount = (deck?: DeckDefinition | null) =>
    deck ? deck.coreCards.reduce((sum, card) => sum + card.count, 0) + deck.neutralCards.reduce((sum, card) => sum + card.count, 0) : 0;

  useEffect(() => {
    if (displayDecks.length === 0) {
      setSelectedPlayerDeck(null);
      setSelectedAIDeck(null);
      setActiveDeckId(null);
      return;
    }

    const deckIds = new Set(displayDecks.map(deck => deck.id));
    const fallbackPlayerDeck = displayDecks[0]?.id ?? null;
    const fallbackAIDeck = displayDecks[1]?.id ?? fallbackPlayerDeck;

    if (!selectedPlayerDeck || !deckIds.has(selectedPlayerDeck)) setSelectedPlayerDeck(fallbackPlayerDeck);
    if (!selectedAIDeck || !deckIds.has(selectedAIDeck)) setSelectedAIDeck(fallbackAIDeck);
    if (!activeDeckId || !deckIds.has(activeDeckId)) setActiveDeckId(selectedPlayerDeck && deckIds.has(selectedPlayerDeck) ? selectedPlayerDeck : fallbackPlayerDeck);
  }, [activeDeckId, displayDecks, selectedAIDeck, selectedPlayerDeck]);

  useEffect(() => {
    if (!user) {
      setPlayerProgress(null);
      return;
    }

    let mounted = true;
    void fetchPlayerProgress(user.id, user.email).then(result => {
      if (!mounted) return;
      setPlayerProgress(result.data);
    });

    return () => {
      mounted = false;
    };
  }, [user]);

  const performDelete = async (deckId: string) => {
    if (deckId.startsWith('deck-')) {
      deleteDeck(deckId);
      const newDecks = getSavedDecks();
      if (selectedPlayerDeck === deckId) setSelectedPlayerDeck(newDecks[0]?.id ?? null);
      if (selectedAIDeck === deckId) setSelectedAIDeck(newDecks[0]?.id ?? null);
    } else {
      await onDeleteDeck(deckId);
    }
    onRefreshDecks();
  };

  const handleDelete = (deckId: string, deckName?: string) => {
    setConfirmDialog({
      title: 'Deletar baralho',
      message: `Deseja realmente deletar ${deckName ? `"${deckName}"` : 'este baralho'}?`,
      onConfirm: () => {
        void performDelete(deckId);
      },
    });
  };

  const handleStartGame = () => {
    if (!selectedPlayerDeck || !selectedAIDeck) {
      setError('Selecione os baralhos para ambos os jogadores.');
      return;
    }

    const playerDeck = displayDecks.find(deck => deck.id === selectedPlayerDeck);
    const aiDeck = displayDecks.find(deck => deck.id === selectedAIDeck);
    if (!playerDeck || !aiDeck) {
      setError('Baralho invalido.');
      return;
    }

    setError('');
    saveLastAIMatchDecks(playerDeck.id, aiDeck.id);
    onStartGame(playerDeck, aiDeck);
  };

  return (
    <div className="min-h-screen game-bg text-white">
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-800/60 rounded-xl max-w-md w-full shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/40 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-300" />
              </div>
              <h2 className="text-white font-bold text-lg">{confirmDialog.title}</h2>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-slate-300 text-sm">{confirmDialog.message}</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg font-semibold transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const action = confirmDialog.onConfirm;
                    setConfirmDialog(null);
                    action();
                  }}
                  className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded-lg font-bold transition-colors"
                >
                  Deletar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center shadow-lg shadow-amber-950/40">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black tracking-wide text-white leading-none truncate">FRAGMENTOS</h1>
              <p className="hidden min-[360px]:block text-[9px] sm:text-[11px] uppercase tracking-[0.22em] sm:tracking-[0.28em] text-amber-300/80 mt-1 truncate">Trading Card Game</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2">
            {user ? (
              <>
                <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/40 flex items-center justify-center">
                    <User className="w-4 h-4 text-amber-300" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-white">{profileName}</div>
                    <div className="text-[11px] text-slate-400">{profile?.rating ?? 0} pts</div>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
                  <Trophy className="w-4 h-4 text-amber-300" />
                  {profile?.wins ?? 0}V / {profile?.losses ?? 0}D
                </div>
                <button onClick={() => signOut()} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400 hover:text-red-300 hover:border-red-800/60 transition-colors">
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </>
            ) : (
              <button onClick={onShowAuth} className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/15 px-4 py-2 text-sm font-bold text-amber-200 hover:bg-amber-500/25 transition-colors">
                <LogIn className="w-4 h-4" />
                Entrar
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 py-5 lg:py-7">
        <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-5">
          <aside className="order-2 space-y-3 xl:order-1">
            <button
              onClick={() => setGameMode('ai')}
              className={`w-full rounded-xl border p-4 text-left transition-all ${gameMode === 'ai' ? 'border-blue-500/70 bg-blue-950/30 shadow-lg shadow-blue-950/30' : 'border-slate-800 bg-slate-950/70 hover:border-slate-600'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/40 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <div className="font-black text-white">Contra IA</div>
                  <div className="text-xs text-slate-400">Treino rapido</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                if (!user) { onShowAuth(); return; }
                setGameMode('pvp');
              }}
              className={`w-full rounded-xl border p-4 text-left transition-all ${gameMode === 'pvp' ? 'border-amber-500/70 bg-amber-950/25 shadow-lg shadow-amber-950/30' : 'border-slate-800 bg-slate-950/70 hover:border-slate-600'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="font-black text-white">PvP Online</div>
                  <div className="text-xs text-slate-400">Duelo em tempo real</div>
                </div>
              </div>
            </button>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-900/70 p-2">
                  <Layers className="w-4 h-4 text-amber-300 mx-auto mb-1" />
                  <div className="text-lg font-black">{displayDecks.length}</div>
                  <div className="text-[10px] text-slate-500">Decks</div>
                </div>
                <div className="rounded-lg bg-slate-900/70 p-2">
                  <BookOpen className="w-4 h-4 text-blue-300 mx-auto mb-1" />
                  <div className="text-lg font-black">100+</div>
                  <div className="text-[10px] text-slate-500">Cartas</div>
                </div>
                <div className="rounded-lg bg-slate-900/70 p-2">
                  <Crown className="w-4 h-4 text-emerald-300 mx-auto mb-1" />
                  <div className="text-lg font-black">{winRate}%</div>
                  <div className="text-[10px] text-slate-500">Vit.</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Menu</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
              </div>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
                <button onClick={() => onOpenProfile('overview')} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3 text-sm font-bold text-slate-300 transition-colors hover:border-amber-500/50 hover:text-amber-200">
                  <Trophy className="w-4 h-4" />
                  Perfil
                </button>
                <button onClick={() => onOpenProfile('missions')} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3 text-sm font-bold text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-200">
                  <Target className="w-4 h-4" />
                  Missoes
                </button>
                <button onClick={() => onOpenProfile('shop')} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3 text-sm font-bold text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-200">
                  <ShoppingBag className="w-4 h-4" />
                  Loja
                </button>
                <button onClick={() => onOpenProfile('history')} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3 text-sm font-bold text-slate-300 transition-colors hover:border-blue-500/50 hover:text-blue-200">
                  <Calendar className="w-4 h-4" />
                  Historico
                </button>
                <button onClick={() => onOpenProfile('ranking')} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3 text-sm font-bold text-slate-300 transition-colors hover:border-amber-500/50 hover:text-amber-200">
                  <Crown className="w-4 h-4" />
                  Ranking
                </button>
                <button onClick={onOpenCollection} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3 text-sm font-bold text-slate-300 transition-colors hover:border-blue-500/50 hover:text-blue-200">
                  <BookOpen className="w-4 h-4" />
                  Colecao
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Gem className="w-5 h-5 text-amber-300" />
                <h3 className="font-black text-white">Progresso</h3>
              </div>
              {user ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-3">
                    <div className="flex justify-between text-xs text-slate-400 mb-2">
                      <span>Ranking</span>
                      <span>{profile?.rating ?? 0} pts</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-400" style={{ width: `${Math.min(100, Math.max(8, ((profile?.rating ?? 0) / 1500) * 100))}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-3">
                      <Coins className="w-4 h-4 text-amber-300 mb-1" />
                      <div className="text-lg font-black">{(playerProgress?.gold ?? 0).toLocaleString('pt-BR')}</div>
                      <div className="text-xs text-slate-500">Loja ativa</div>
                    </div>
                    <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-3">
                      <Trophy className="w-4 h-4 text-emerald-300 mb-1" />
                      <div className="text-lg font-black">{winRate}%</div>
                      <div className="text-xs text-slate-500">Vitorias</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 text-center">
                  <p className="text-sm text-slate-400 mb-3">Entre para salvar ranking, gold, missoes e cosmeticos.</p>
                  <button onClick={onShowAuth} className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 text-sm font-black transition-colors">
                    Entrar
                  </button>
                </div>
              )}
            </div>
          </aside>

          <section className="order-1 rounded-2xl border border-slate-800/90 bg-slate-950/75 shadow-2xl shadow-black/30 overflow-hidden xl:order-2">
            <div className="border-b border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950 px-5 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-amber-300/70">Lobby</p>
                  <h2 className="text-2xl font-black text-white mt-1">Preparar partida</h2>
                </div>
                <button onClick={() => { onOpenDeckBuilder(); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-sm font-bold text-white transition-colors">
                  <Plus className="w-4 h-4" />
                  Novo baralho
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {error && (
                <div className="rounded-xl border border-red-700/60 bg-red-950/40 p-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div>
                <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Baralhos</h3>
                    <span className="text-xs text-slate-500">{displayDecks.length} disponiveis</span>
                  </div>
                  {gameMode === 'ai' ? (
                    selectedPlayerDeck && selectedAIDeck && (
                      <button onClick={handleStartGame} disabled={decksLoading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 font-black text-slate-950 shadow-lg shadow-amber-950/30 transition-colors hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60 lg:w-auto">
                        <Swords className="w-5 h-5" />
                        Jogar agora
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )
                  ) : (
                    <button onClick={onStartPvp} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 font-black text-slate-950 shadow-lg shadow-amber-950/30 transition-colors hover:bg-amber-400 lg:w-auto">
                      <Globe className="w-5 h-5" />
                      Buscar partida
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayDecks.map(deck => {
                    const hero = getCardById(deck.heroId);
                    const isPlayerDeck = selectedPlayerDeck === deck.id;
                    const isAiDeck = selectedAIDeck === deck.id;
                    const isActive = activeDeckId === deck.id;
                    const isDefaultDeck = defaultDeckIds.has(deck.id);
                    const isSharedDeck = isPlayerDeck && isAiDeck;
                    const cardClass = isSharedDeck
                      ? 'border-transparent bg-slate-900/50 shadow-lg shadow-black/20'
                      : isPlayerDeck
                      ? 'border-blue-500/80 bg-blue-950/20 shadow-lg shadow-blue-950/20'
                      : isAiDeck
                      ? 'border-red-500/80 bg-red-950/20 shadow-lg shadow-red-950/20'
                      : isActive
                      ? 'border-amber-400/80 bg-amber-950/20 shadow-lg shadow-amber-950/20'
                      : 'border-slate-800 bg-slate-900/50 hover:border-slate-600';
                    const sharedBorderStyle = isSharedDeck
                      ? {
                          background:
                            'linear-gradient(rgb(15 23 42 / 0.78), rgb(15 23 42 / 0.78)) padding-box, linear-gradient(90deg, rgb(59 130 246) 0 50%, rgb(239 68 68) 50% 100%) border-box',
                        }
                      : undefined;
                    return (
                      <div key={deck.id} style={sharedBorderStyle} className={`rounded-xl border p-3 transition-all ${cardClass}`}>
                        <button onClick={() => setActiveDeckId(deck.id)} className="w-full text-left flex items-center gap-3">
                          <div className="w-11 h-14 rounded-lg bg-gradient-to-br from-amber-800 to-slate-950 border border-amber-500/40 flex items-center justify-center shrink-0">
                            <Star className="w-5 h-5 text-amber-300" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-black text-white truncate">{deck.name}</p>
                              {isActive && <span className="w-2 h-2 rounded-full bg-amber-300 shrink-0" />}
                            </div>
                            <p className="text-xs text-slate-400 truncate">{hero?.name ?? 'Heroi'}</p>
                            <p className="text-[11px] text-slate-500 mt-1">{deckCardCount(deck)} cartas</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {isPlayerDeck && (
                                <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-blue-200">
                                  Seu baralho
                                </span>
                              )}
                              {isAiDeck && (
                                <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-200">
                                  IA
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        {isActive && (
                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <button
                              onClick={() => {
                                setSelectedPlayerDeck(deck.id);
                                setError('');
                              }}
                              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition-colors ${
                                isPlayerDeck
                                  ? 'border border-blue-500/60 bg-blue-500/20 text-blue-100'
                                  : 'border border-blue-800/60 bg-blue-950/50 text-blue-200 hover:bg-blue-900/60'
                              }`}
                            >
                              <User className="h-3.5 w-3.5" />
                              Usar comigo
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAIDeck(deck.id);
                                setError('');
                              }}
                              disabled={gameMode !== 'ai'}
                              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                isAiDeck
                                  ? 'border border-red-500/60 bg-red-500/20 text-red-100'
                                  : 'border border-red-900/60 bg-red-950/50 text-red-200 hover:bg-red-900/60'
                              }`}
                            >
                              <Shield className="h-3.5 w-3.5" />
                              Usar na IA
                            </button>
                          </div>
                        )}
                        {isDefaultDeck ? (
                          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200">
                            Baralho padrao
                          </div>
                        ) : (
                          <div className="mt-3 flex gap-2">
                            <button onClick={() => onOpenDeckBuilder(deck)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-200 transition-colors">
                              <Edit3 className="w-3.5 h-3.5" />
                              Editar
                            </button>
                            <button onClick={() => handleDelete(deck.id, deck.name)} className="inline-flex items-center justify-center rounded-lg bg-red-950/50 hover:bg-red-900 border border-red-900/60 px-3 py-2 text-red-300 transition-colors" aria-label={`Deletar ${deck.name}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
