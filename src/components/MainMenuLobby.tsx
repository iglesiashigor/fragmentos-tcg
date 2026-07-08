import React, { useEffect, useMemo, useState } from 'react';
import { DeckDefinition } from '../types/game';
import { DEFAULT_DECKS, deleteDeck, getSavedDecks } from '../data/defaultDecks';
import { getCardById } from '../data/cards';
import { useAuth } from '../lib/authContext';
import { fetchPlayerProgress, PlayerProgress } from '../lib/progression';
import {
  AlertTriangle, BookOpen, ChevronRight, Coins, Crown, Edit3, Gem, Globe,
  Layers, LogIn, LogOut, Plus, Shield, Sparkles, Star, Swords, Trash2,
  Trophy, User, Users, Zap,
} from 'lucide-react';

interface MainMenuLobbyProps {
  onStartGame: (playerDeck: DeckDefinition, aiDeck: DeckDefinition) => void;
  onStartPvp: () => void;
  onOpenDeckBuilder: (deck?: DeckDefinition) => void;
  onOpenCollection: () => void;
  onOpenProfile: () => void;
  onShowAuth: () => void;
  decks: DeckDefinition[];
  decksLoading: boolean;
  user: ReturnType<typeof useAuth>['user'];
  profile: ReturnType<typeof useAuth>['profile'];
  onDeleteDeck: (deckId: string) => Promise<void>;
  onRefreshDecks: () => void;
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
  const [selectedPlayerDeck, setSelectedPlayerDeck] = useState<string | null>(displayDecks[0]?.id ?? null);
  const [selectedAIDeck, setSelectedAIDeck] = useState<string | null>(displayDecks[1]?.id ?? displayDecks[0]?.id ?? null);
  const [gameMode, setGameMode] = useState<'ai' | 'pvp'>('ai');
  const [error, setError] = useState('');
  const [playerProgress, setPlayerProgress] = useState<PlayerProgress | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const selectedDeck = displayDecks.find(deck => deck.id === selectedPlayerDeck) ?? displayDecks[0];
  const selectedAiDeck = displayDecks.find(deck => deck.id === selectedAIDeck) ?? displayDecks[1] ?? displayDecks[0];
  const selectedHero = selectedDeck ? getCardById(selectedDeck.heroId) : null;
  const selectedAiHero = selectedAiDeck ? getCardById(selectedAiDeck.heroId) : null;
  const defaultDeckIds = useMemo(() => new Set(DEFAULT_DECKS.map(deck => deck.id)), []);
  const profileName = profile?.username ?? user?.email?.split('@')[0] ?? 'Jogador';
  const playedMatches = (profile?.wins ?? 0) + (profile?.losses ?? 0);
  const winRate = playedMatches > 0 ? Math.round(((profile?.wins ?? 0) / playedMatches) * 100) : 0;

  useEffect(() => {
    if (!selectedPlayerDeck && displayDecks[0]) setSelectedPlayerDeck(displayDecks[0].id);
    if (!selectedAIDeck && displayDecks[1]) setSelectedAIDeck(displayDecks[1].id);
    if (!selectedAIDeck && !displayDecks[1] && displayDecks[0]) setSelectedAIDeck(displayDecks[0].id);
  }, [displayDecks, selectedAIDeck, selectedPlayerDeck]);

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
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center shadow-lg shadow-amber-950/40">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-wide text-white leading-none">FRAGMENTOS</h1>
              <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300/80 mt-1">Trading Card Game</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
          <aside className="space-y-3">
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

            <div className="grid grid-cols-2 xl:grid-cols-1 gap-2">
              <button onClick={onOpenProfile} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-sm font-bold text-slate-300 hover:border-amber-500/50 hover:text-amber-200 transition-colors">
                <Trophy className="w-4 h-4" />
                Perfil
              </button>
              <button onClick={onOpenCollection} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-sm font-bold text-slate-300 hover:border-blue-500/50 hover:text-blue-200 transition-colors">
                <BookOpen className="w-4 h-4" />
                Colecao
              </button>
              <button onClick={onOpenProfile} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-sm font-bold text-slate-300 hover:border-emerald-500/50 hover:text-emerald-200 transition-colors">
                <Coins className="w-4 h-4" />
                Loja
              </button>
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

          <section className="rounded-2xl border border-slate-800/90 bg-slate-950/75 shadow-2xl shadow-black/30 overflow-hidden">
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
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">Seu baralho</p>
                      <h3 className="text-2xl font-black text-white mt-1">{selectedDeck?.name ?? 'Nenhum baralho'}</h3>
                      <p className="text-sm text-slate-400 mt-1">{selectedHero?.name ?? 'Heroi'} como lider</p>
                    </div>
                    <div className="w-14 h-14 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center shrink-0">
                      <Star className="w-7 h-7 text-amber-300" />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500 uppercase">Heroi</div>
                      <div className="text-sm font-bold text-white truncate">{selectedHero?.name ?? '-'}</div>
                    </div>
                    <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500 uppercase">Cartas</div>
                      <div className="text-sm font-bold text-white">{(selectedDeck?.coreCards.length ?? 0) + (selectedDeck?.neutralCards.length ?? 0)}</div>
                    </div>
                    <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500 uppercase">Modo</div>
                      <div className="text-sm font-bold text-white">{gameMode === 'ai' ? 'vs IA' : 'PvP'}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col justify-between gap-4">
                  {gameMode === 'ai' ? (
                    <>
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Oponente</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-red-300" />
                          <span className="text-sm font-bold text-white">Baralho da IA</span>
                        </div>
                        <div className="mt-3 rounded-xl border border-red-900/40 bg-red-950/20 p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-14 rounded-lg bg-gradient-to-br from-red-800 to-slate-950 border border-red-500/40 flex items-center justify-center shrink-0">
                              <Shield className="w-5 h-5 text-red-300" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-black text-white truncate">{selectedAiDeck?.name ?? 'IA'}</div>
                              <div className="text-xs text-slate-400 truncate">{selectedAiHero?.name ?? 'Heroi'}</div>
                              <div className="text-[11px] text-slate-500 mt-1">
                                {(selectedAiDeck?.coreCards.length ?? 0) + (selectedAiDeck?.neutralCards.length ?? 0)} cartas
                              </div>
                            </div>
                          </div>
                        </div>
                        <select
                          value={selectedAIDeck ?? ''}
                          onChange={event => setSelectedAIDeck(event.target.value)}
                          className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white outline-none focus:border-red-400"
                        >
                          {displayDecks.map(deck => {
                            const hero = getCardById(deck.heroId);
                            return (
                              <option key={deck.id} value={deck.id}>
                                {deck.name} - {hero?.name ?? 'Heroi'}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <button onClick={handleStartGame} disabled={decksLoading} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-wait text-slate-950 px-4 py-3 font-black transition-colors shadow-lg shadow-amber-950/30">
                        <Swords className="w-5 h-5" />
                        Jogar agora
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Online</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Globe className="w-4 h-4 text-amber-300" />
                          <span className="text-sm font-bold text-white">Buscar duelo</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Sala ou oponente disponivel</p>
                      </div>
                      <button onClick={onStartPvp} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-3 font-black transition-colors shadow-lg shadow-amber-950/30">
                        <Globe className="w-5 h-5" />
                        Buscar partida
                      </button>
                    </>
                  )}
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-700/60 bg-red-950/40 p-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Baralhos</h3>
                  <span className="text-xs text-slate-500">{displayDecks.length} disponiveis</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayDecks.map(deck => {
                    const hero = getCardById(deck.heroId);
                    const isSelected = selectedPlayerDeck === deck.id;
                    const isDefaultDeck = defaultDeckIds.has(deck.id);
                    return (
                      <div key={deck.id} className={`rounded-xl border p-3 transition-all ${isSelected ? 'border-amber-400/80 bg-amber-950/20 shadow-lg shadow-amber-950/20' : 'border-slate-800 bg-slate-900/50 hover:border-slate-600'}`}>
                        <button onClick={() => setSelectedPlayerDeck(deck.id)} className="w-full text-left flex items-center gap-3">
                          <div className="w-11 h-14 rounded-lg bg-gradient-to-br from-amber-800 to-slate-950 border border-amber-500/40 flex items-center justify-center shrink-0">
                            <Star className="w-5 h-5 text-amber-300" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-black text-white truncate">{deck.name}</p>
                              {isSelected && <span className="w-2 h-2 rounded-full bg-amber-300 shrink-0" />}
                            </div>
                            <p className="text-xs text-slate-400 truncate">{hero?.name ?? 'Heroi'}</p>
                            <p className="text-[11px] text-slate-500 mt-1">{deck.coreCards.length + deck.neutralCards.length} cartas</p>
                          </div>
                        </button>
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
