import React, { useEffect, useMemo, useState } from 'react';
import { CardDefinition, CardType, DeckDefinition } from '../types/game';
import { DEFAULT_DECKS, deleteDeck, getSavedDecks } from '../data/defaultDecks';
import { getCardById } from '../data/cards';
import { useAuth } from '../lib/authContext';
import { fetchPlayerProgress, PlayerProgress } from '../lib/progression';
import type { ProfileTab } from './PlayerProfile';
import {
  AlertTriangle, BookOpen, Calendar, ChevronRight, Coins, Crown, Edit3, Gem, Globe,
  Layers, LogIn, LogOut, Plus, Shield, ShoppingBag, Sparkles, Star, Swords, Target,
  Trash2, Trophy, User, Users, X, Zap,
} from 'lucide-react';

interface MainMenuLobbyProps {
  onStartGame: (playerDeck: DeckDefinition, aiDeck: DeckDefinition) => void;
  onStartPvp: (playerDeck: DeckDefinition) => void;
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
const LAST_PVP_DECK_KEY = 'fragmentos-last-pvp-deck';

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

function getLastPvpDeckId(): string | undefined {
  return localStorage.getItem(LAST_PVP_DECK_KEY) ?? undefined;
}

function saveLastPvpDeckId(deckId: string) {
  localStorage.setItem(LAST_PVP_DECK_KEY, deckId);
}

const CARD_TYPE_LABELS: Record<CardType, string> = {
  hero: 'Heroi',
  unit: 'Unidade',
  terrain: 'Terreno',
  equipment: 'Equipamento',
  mount: 'Montaria',
  spell: 'Feitico',
  mana: 'Mana',
};

const CARD_TYPE_TONES: Partial<Record<CardType, string>> = {
  unit: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
  spell: 'border-blue-500/25 bg-blue-500/10 text-blue-200',
  terrain: 'border-teal-500/25 bg-teal-500/10 text-teal-200',
  equipment: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  mount: 'border-purple-500/25 bg-purple-500/10 text-purple-200',
};

type DeckCardEntry = {
  cardId: string;
  count: number;
  group: 'Principais' | 'Neutras';
  definition?: CardDefinition;
};

function getDeckEntries(deck: DeckDefinition): DeckCardEntry[] {
  return [
    ...deck.coreCards.map(card => ({ ...card, group: 'Principais' as const, definition: getCardById(card.cardId) })),
    ...deck.neutralCards.map(card => ({ ...card, group: 'Neutras' as const, definition: getCardById(card.cardId) })),
  ];
}

function getDeckAnalysis(deck: DeckDefinition) {
  const entries = getDeckEntries(deck);
  const totalCards = entries.reduce((sum, entry) => sum + entry.count, 0);
  const manaCurve = [0, 1, 2, 3, 4, 5].map(cost => ({
    cost,
    label: cost === 5 ? '5+' : String(cost),
    count: entries.reduce((sum, entry) => {
      const manaCost = entry.definition?.manaCost ?? 0;
      const inBucket = cost === 5 ? manaCost >= 5 : manaCost === cost;
      return sum + (inBucket ? entry.count : 0);
    }, 0),
  }));
  const maxCurveCount = Math.max(1, ...manaCurve.map(item => item.count));
  const typeCounts = entries.reduce<Record<string, number>>((acc, entry) => {
    const type = entry.definition?.type ?? 'spell';
    acc[type] = (acc[type] ?? 0) + entry.count;
    return acc;
  }, {});
  const lowCostCards = manaCurve.filter(item => item.cost <= 2).reduce((sum, item) => sum + item.count, 0);
  const lateCostCards = manaCurve.find(item => item.cost === 5)?.count ?? 0;
  const averageMana = totalCards > 0
    ? entries.reduce((sum, entry) => sum + (entry.definition?.manaCost ?? 0) * entry.count, 0) / totalCards
    : 0;
  const effectTypes = new Set(entries.flatMap(entry => entry.definition?.effects.map(effect => effect.type) ?? []));
  const typeEntries = Object.entries(typeCounts)
    .map(([type, count]) => ({ type: type as CardType, count }))
    .sort((a, b) => b.count - a.count);
  const keyCards = entries
    .filter(entry => entry.definition)
    .slice()
    .sort((a, b) => {
      const aScore = (a.definition?.effects.length ?? 0) * 10 + (a.definition?.manaCost ?? 0) + a.count;
      const bScore = (b.definition?.effects.length ?? 0) * 10 + (b.definition?.manaCost ?? 0) + b.count;
      return bScore - aScore;
    })
    .slice(0, 4);

  const strengths: string[] = [];
  if (effectTypes.has('damage') || effectTypes.has('damageAllUnits')) strengths.push('Dano e controle de mesa');
  if (effectTypes.has('drawCard') || effectTypes.has('searchCard')) strengths.push('Busca e compra de cartas');
  if (effectTypes.has('recoverFromDiscard')) strengths.push('Valor no descarte');
  if (effectTypes.has('heal') || effectTypes.has('healAllUnits')) strengths.push('Sustentacao');
  if (effectTypes.has('attackAgain') || effectTypes.has('allUnitsAttackTwice')) strengths.push('Ataques extras');
  if ((typeCounts.equipment ?? 0) + (typeCounts.mount ?? 0) >= 4) strengths.push('Pressao com itens');
  if (strengths.length === 0) strengths.push('Plano direto e consistente');

  const care: string[] = [];
  if ((typeCounts.unit ?? 0) < 8) care.push('Poucas unidades no baralho');
  if (averageMana >= 3.4) care.push('Pode comecar mais lento');
  if (effectTypes.has('recoverFromDiscard')) care.push('Algumas cartas dependem do descarte');
  if ((typeCounts.equipment ?? 0) > 4) care.push('Evite comprar itens sem alvo livre');
  if (care.length === 0) care.push('Curva estavel para partidas longas');

  const plan = lowCostCards >= lateCostCards + 5
    ? 'Comeca cedo, ocupa a mesa e tenta manter pressao constante.'
    : lateCostCards >= lowCostCards
    ? 'Procura sobreviver ao inicio e ganhar valor no meio/fim da partida.'
    : 'Tem curva equilibrada e consegue alternar entre campo, recursos e combate.';

  return {
    averageMana,
    care,
    entries,
    keyCards,
    manaCurve,
    maxCurveCount,
    plan,
    strengths,
    totalCards,
    typeEntries,
  };
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
  const lastPvpDeckId = useMemo(() => getLastPvpDeckId(), []);
  const [selectedAiPlayerDeck, setSelectedAiPlayerDeck] = useState<string | null>(lastAIMatchDecks.playerDeckId ?? displayDecks[0]?.id ?? null);
  const [selectedAIDeck, setSelectedAIDeck] = useState<string | null>(lastAIMatchDecks.aiDeckId ?? displayDecks[1]?.id ?? displayDecks[0]?.id ?? null);
  const [selectedPvpDeck, setSelectedPvpDeck] = useState<string | null>(lastPvpDeckId ?? displayDecks[0]?.id ?? null);
  const [activeAIDeckId, setActiveAIDeckId] = useState<string | null>(lastAIMatchDecks.playerDeckId ?? displayDecks[0]?.id ?? null);
  const [activePvpDeckId, setActivePvpDeckId] = useState<string | null>(lastPvpDeckId ?? displayDecks[0]?.id ?? null);
  const [gameMode, setGameMode] = useState<'ai' | 'pvp'>('ai');
  const [error, setError] = useState('');
  const [playerProgress, setPlayerProgress] = useState<PlayerProgress | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [previewDeck, setPreviewDeck] = useState<DeckDefinition | null>(null);

  const defaultDeckIds = useMemo(() => new Set(DEFAULT_DECKS.map(deck => deck.id)), []);
  const profileName = profile?.username ?? user?.email?.split('@')[0] ?? 'Jogador';
  const playedMatches = (profile?.wins ?? 0) + (profile?.losses ?? 0);
  const winRate = playedMatches > 0 ? Math.round(((profile?.wins ?? 0) / playedMatches) * 100) : 0;
  const deckCardCount = (deck?: DeckDefinition | null) =>
    deck ? deck.coreCards.reduce((sum, card) => sum + card.count, 0) + deck.neutralCards.reduce((sum, card) => sum + card.count, 0) : 0;
  const currentPlayerDeckId = gameMode === 'ai' ? selectedAiPlayerDeck : selectedPvpDeck;
  const currentActiveDeckId = gameMode === 'ai' ? activeAIDeckId : activePvpDeckId;
  const selectedPlayerDeckForMode = displayDecks.find(deck => deck.id === currentPlayerDeckId) ?? null;
  const selectedAIDeckDefinition = displayDecks.find(deck => deck.id === selectedAIDeck) ?? null;
  const formatDeckCards = (deck: DeckDefinition) => [
    ...deck.coreCards.map(card => ({ ...card, group: 'Principais' })),
    ...deck.neutralCards.map(card => ({ ...card, group: 'Neutras' })),
  ];

  useEffect(() => {
    if (displayDecks.length === 0) {
      setSelectedAiPlayerDeck(null);
      setSelectedAIDeck(null);
      setSelectedPvpDeck(null);
      setActiveAIDeckId(null);
      setActivePvpDeckId(null);
      return;
    }

    const deckIds = new Set(displayDecks.map(deck => deck.id));
    const fallbackPlayerDeck = displayDecks[0]?.id ?? null;
    const fallbackAIDeck = displayDecks[1]?.id ?? fallbackPlayerDeck;

    if (!selectedAiPlayerDeck || !deckIds.has(selectedAiPlayerDeck)) setSelectedAiPlayerDeck(fallbackPlayerDeck);
    if (!selectedAIDeck || !deckIds.has(selectedAIDeck)) setSelectedAIDeck(fallbackAIDeck);
    if (!selectedPvpDeck || !deckIds.has(selectedPvpDeck)) setSelectedPvpDeck(fallbackPlayerDeck);
    if (!activeAIDeckId || !deckIds.has(activeAIDeckId)) {
      setActiveAIDeckId(selectedAiPlayerDeck && deckIds.has(selectedAiPlayerDeck) ? selectedAiPlayerDeck : fallbackPlayerDeck);
    }
    if (!activePvpDeckId || !deckIds.has(activePvpDeckId)) {
      setActivePvpDeckId(selectedPvpDeck && deckIds.has(selectedPvpDeck) ? selectedPvpDeck : fallbackPlayerDeck);
    }
  }, [activeAIDeckId, activePvpDeckId, displayDecks, selectedAIDeck, selectedAiPlayerDeck, selectedPvpDeck]);

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
      if (selectedAiPlayerDeck === deckId) setSelectedAiPlayerDeck(newDecks[0]?.id ?? null);
      if (selectedAIDeck === deckId) setSelectedAIDeck(newDecks[0]?.id ?? null);
      if (selectedPvpDeck === deckId) setSelectedPvpDeck(newDecks[0]?.id ?? null);
      if (activeAIDeckId === deckId) setActiveAIDeckId(newDecks[0]?.id ?? null);
      if (activePvpDeckId === deckId) setActivePvpDeckId(newDecks[0]?.id ?? null);
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
    if (!selectedAiPlayerDeck || !selectedAIDeck) {
      setError('Selecione os baralhos para ambos os jogadores.');
      return;
    }

    const playerDeck = displayDecks.find(deck => deck.id === selectedAiPlayerDeck);
    const aiDeck = displayDecks.find(deck => deck.id === selectedAIDeck);
    if (!playerDeck || !aiDeck) {
      setError('Baralho invalido.');
      return;
    }

    setError('');
    saveLastAIMatchDecks(playerDeck.id, aiDeck.id);
    onStartGame(playerDeck, aiDeck);
  };

  const handleStartPvp = () => {
    if (!user) { onShowAuth(); return; }
    if (!selectedPvpDeck) {
      setError('Selecione seu baralho para o PvP.');
      return;
    }

    const playerDeck = displayDecks.find(deck => deck.id === selectedPvpDeck);
    if (!playerDeck) {
      setError('Baralho invalido.');
      return;
    }

    setError('');
    saveLastPvpDeckId(playerDeck.id);
    onStartPvp(playerDeck);
  };

  const previewDeckAnalysis = previewDeck ? getDeckAnalysis(previewDeck) : null;

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

      {previewDeck && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deck-preview-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewDeck(null);
          }}
        >
          <div className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-amber-300" />
                  <h2 id="deck-preview-title" className="truncate text-lg font-black text-white">{previewDeck.name}</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {deckCardCount(previewDeck)} cartas no baralho
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDeck(null)}
                className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 transition-colors hover:border-slate-600 hover:text-white"
                aria-label="Fechar lista de cartas"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200/80">Heroi</p>
                    <p className="truncate text-sm font-black text-white">
                      {getCardById(previewDeck.heroId)?.name ?? previewDeck.heroId}
                    </p>
                  </div>
                  <Star className="h-5 w-5 shrink-0 text-amber-300" />
                </div>
              </div>

              {previewDeckAnalysis && (
                <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_1.15fr]">
                  <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Resumo</h3>
                        <p className="mt-1 text-sm text-slate-300">{previewDeckAnalysis.plan}</p>
                      </div>
                      <div className="rounded-lg border border-blue-500/25 bg-blue-500/10 px-3 py-2 text-center">
                        <p className="text-lg font-black text-blue-100">{previewDeckAnalysis.averageMana.toFixed(1)}</p>
                        <p className="text-[10px] font-black uppercase tracking-wide text-blue-300">Mana media</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {previewDeckAnalysis.typeEntries.map(({ type, count }) => (
                        <div key={type} className={`rounded-lg border px-3 py-2 ${CARD_TYPE_TONES[type] ?? 'border-slate-700 bg-slate-950 text-slate-300'}`}>
                          <p className="text-sm font-black">{count}</p>
                          <p className="text-[10px] font-black uppercase tracking-wide opacity-80">{CARD_TYPE_LABELS[type]}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Curva de mana</h3>
                      <span className="text-xs text-slate-500">{previewDeckAnalysis.totalCards} cartas</span>
                    </div>
                    <div className="grid grid-cols-6 items-end gap-2">
                      {previewDeckAnalysis.manaCurve.map(item => (
                        <div key={item.label} className="flex min-h-[7.5rem] flex-col items-center justify-end gap-2">
                          <div className="text-xs font-black text-slate-300">{item.count}</div>
                          <div className="flex h-20 w-full items-end rounded-lg border border-slate-800 bg-slate-950/70 p-1">
                            <div
                              className="w-full rounded-md bg-amber-400"
                              style={{ height: `${Math.max(8, (item.count / previewDeckAnalysis.maxCurveCount) * 100)}%` }}
                            />
                          </div>
                          <div className="text-[11px] font-black text-slate-500">{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-3">
                    <h3 className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Pontos fortes</h3>
                    <div className="flex flex-wrap gap-2">
                      {previewDeckAnalysis.strengths.map(strength => (
                        <span key={strength} className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-200">
                          {strength}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-3">
                    <h3 className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Cuidados</h3>
                    <div className="flex flex-wrap gap-2">
                      {previewDeckAnalysis.care.map(item => (
                        <span key={item} className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/55 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Cartas-chave</h3>
                      <span className="text-xs text-slate-500">Calculado por efeito, custo e copias</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {previewDeckAnalysis.keyCards.map(entry => (
                        <div key={`key-${entry.cardId}`} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <p className="text-sm font-black text-white">{entry.definition?.name ?? entry.cardId}</p>
                            <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-black text-amber-200">
                              x{entry.count}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {CARD_TYPE_LABELS[entry.definition?.type ?? 'spell']} • {entry.definition?.manaCost ?? '-'} mana
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {(['Principais', 'Neutras'] as const).map(group => {
                const cards = formatDeckCards(previewDeck).filter(card => card.group === group);
                if (cards.length === 0) return null;
                return (
                  <section key={group} className="mb-4 last:mb-0">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{group}</h3>
                      <span className="text-xs text-slate-500">
                        {cards.reduce((sum, card) => sum + card.count, 0)} cartas
                      </span>
                    </div>
                    <div className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
                      {cards.map(card => {
                        const definition = getCardById(card.cardId);
                        return (
                          <div key={`${group}-${card.cardId}`} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5">
                            <div className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-center text-sm font-black text-amber-200">
                              x{card.count}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-white">{definition?.name ?? card.cardId}</p>
                              <p className="text-xs text-slate-500">
                                {definition ? CARD_TYPE_LABELS[definition.type] : 'Carta'}
                              </p>
                            </div>
                            <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-1 text-[11px] font-black text-blue-200">
                              {definition?.manaCost ?? '-'} mana
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
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

              <div className={`grid gap-3 ${gameMode === 'ai' ? 'lg:grid-cols-2' : 'lg:grid-cols-[minmax(0,1fr)_20rem]'}`}>
                <div className="rounded-xl border border-blue-500/35 bg-blue-950/20 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-400/35 bg-blue-500/15">
                      <User className="h-4 w-4 text-blue-200" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-200">Seu baralho</p>
                      <p className="text-xs text-slate-500">{gameMode === 'ai' ? 'Selecionado para jogar contra IA' : 'Selecionado para buscar PvP'}</p>
                    </div>
                  </div>
                  {selectedPlayerDeckForMode ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-white">{selectedPlayerDeckForMode.name}</p>
                        <p className="text-sm text-blue-100">{getCardById(selectedPlayerDeckForMode.heroId)?.name ?? 'Heroi'} como lider</p>
                        <p className="mt-1 text-xs text-slate-500">{deckCardCount(selectedPlayerDeckForMode)} cartas</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewDeck(selectedPlayerDeckForMode)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs font-black text-blue-100 transition-colors hover:bg-blue-500/20"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        Ver cartas
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Escolha um baralho para continuar.</p>
                  )}
                </div>

                {gameMode === 'ai' ? (
                  <div className="rounded-xl border border-red-500/35 bg-red-950/20 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-400/35 bg-red-500/15">
                        <Shield className="h-4 w-4 text-red-200" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-200">Baralho da IA</p>
                        <p className="text-xs text-slate-500">Oponente selecionado</p>
                      </div>
                    </div>
                    {selectedAIDeckDefinition ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black text-white">{selectedAIDeckDefinition.name}</p>
                          <p className="text-sm text-red-100">{getCardById(selectedAIDeckDefinition.heroId)?.name ?? 'Heroi'} como lider</p>
                          <p className="mt-1 text-xs text-slate-500">{deckCardCount(selectedAIDeckDefinition)} cartas</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPreviewDeck(selectedAIDeckDefinition)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100 transition-colors hover:bg-red-500/20"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          Ver cartas
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">Escolha o baralho que a IA vai usar.</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-300/35 bg-amber-500/15">
                        <Globe className="h-4 w-4 text-amber-200" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">PvP Online</p>
                        <p className="text-xs text-slate-500">Busca ou entra em sala aberta</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-300">
                      Depois de escolher seu baralho, use Buscar partida para encontrar outro jogador.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Baralhos</h3>
                    <span className="text-xs text-slate-500">{displayDecks.length} disponiveis</span>
                  </div>
                  {gameMode === 'ai' ? (
                    selectedAiPlayerDeck && selectedAIDeck && (
                      <button onClick={handleStartGame} disabled={decksLoading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 font-black text-slate-950 shadow-lg shadow-amber-950/30 transition-colors hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60 lg:w-auto">
                        <Swords className="w-5 h-5" />
                        Jogar agora
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )
                  ) : (
                    selectedPvpDeck && (
                    <button onClick={handleStartPvp} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 font-black text-slate-950 shadow-lg shadow-amber-950/30 transition-colors hover:bg-amber-400 lg:w-auto">
                      <Globe className="w-5 h-5" />
                      Buscar partida
                    </button>
                    )
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayDecks.map(deck => {
                    const hero = getCardById(deck.heroId);
                    const isPlayerDeck = currentPlayerDeckId === deck.id;
                    const isAiDeck = gameMode === 'ai' && selectedAIDeck === deck.id;
                    const isActive = currentActiveDeckId === deck.id;
                    const isDefaultDeck = defaultDeckIds.has(deck.id);
                    const isSharedDeck = gameMode === 'ai' && isPlayerDeck && isAiDeck;
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
                        <button
                          onClick={() => {
                            if (gameMode === 'ai') {
                              setActiveAIDeckId(deck.id);
                            } else {
                              setActivePvpDeckId(deck.id);
                            }
                          }}
                          className="w-full text-left flex items-center gap-3"
                        >
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
                          <div className={`mt-3 grid grid-cols-1 gap-2 ${gameMode === 'ai' ? 'sm:grid-cols-2' : ''}`}>
                            <button
                              onClick={() => {
                                if (gameMode === 'ai') {
                                  setSelectedAiPlayerDeck(deck.id);
                                } else {
                                  setSelectedPvpDeck(deck.id);
                                }
                                setError('');
                              }}
                              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition-colors ${
                                isPlayerDeck
                                  ? 'border border-blue-500/60 bg-blue-500/20 text-blue-100'
                                  : 'border border-blue-800/60 bg-blue-950/50 text-blue-200 hover:bg-blue-900/60'
                              }`}
                            >
                              <User className="h-3.5 w-3.5" />
                              {gameMode === 'pvp' ? 'Usar no PvP' : 'Usar comigo'}
                            </button>
                            {gameMode === 'ai' && (
                              <button
                                onClick={() => {
                                  setSelectedAIDeck(deck.id);
                                  setError('');
                                }}
                                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition-colors ${
                                  isAiDeck
                                    ? 'border border-red-500/60 bg-red-500/20 text-red-100'
                                    : 'border border-red-900/60 bg-red-950/50 text-red-200 hover:bg-red-900/60'
                                }`}
                              >
                                <Shield className="h-3.5 w-3.5" />
                                Usar na IA
                              </button>
                            )}
                          </div>
                        )}
                        {isDefaultDeck ? (
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <button
                              type="button"
                              onClick={() => setPreviewDeck(deck)}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:border-blue-500/50 hover:text-blue-200"
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                              Ver cartas
                            </button>
                            <div className="flex flex-1 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200">
                              Baralho padrao
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 flex gap-2">
                            <button onClick={() => setPreviewDeck(deck)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:border-blue-500/50 hover:text-blue-200">
                              <BookOpen className="w-3.5 h-3.5" />
                              Ver
                            </button>
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
