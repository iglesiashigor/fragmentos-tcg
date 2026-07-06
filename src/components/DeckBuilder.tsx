import React, { useState, useMemo } from 'react';
import { CardDefinition, DeckDefinition } from '../types/game';
import { ALL_CARDS, HEROES, CORE_CARDS, NEUTRAL_CARDS, getCardsByHero } from '../data/cards';
import { saveDeck, validateDeck } from '../data/defaultDecks';
import { getCardById } from '../data/cards';
import CardDisplay from './CardDisplay';
import CardInspector from './CardInspector';
import { Plus, Minus, Save, ArrowLeft, CheckCircle, AlertCircle, X, Star, Filter } from 'lucide-react';

interface DeckBuilderProps {
  initialDeck?: DeckDefinition;
  onSave: (deck: DeckDefinition) => Promise<{ error: string | null; id?: string }> | void;
  onBack: () => void;
}

const TYPE_FILTER_OPTIONS = ['Todos', 'Unidade', 'Feitiço', 'Terreno', 'Equipamento', 'Montaria'];

export default function DeckBuilder({ initialDeck, onSave, onBack }: DeckBuilderProps) {
  const [deckName, setDeckName] = useState(initialDeck?.name ?? 'Novo Baralho');
  const [heroId, setHeroId] = useState(initialDeck?.heroId ?? '');
  const [coreCards, setCoreCards] = useState<{ cardId: string; count: number }[]>(initialDeck?.coreCards ?? []);
  const [neutralCards, setNeutralCards] = useState<{ cardId: string; count: number }[]>(initialDeck?.neutralCards ?? []);
  const [inspectedCard, setInspectedCard] = useState<CardDefinition | null>(null);
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [tab, setTab] = useState<'core' | 'neutral'>('core');
  const [saveError, setSaveError] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const availableCoreCards = useMemo(() =>
    heroId ? getCardsByHero(heroId) : [],
    [heroId]
  );

  const filteredCoreCards = useMemo(() => {
    if (typeFilter === 'Todos') return availableCoreCards;
    const typeMap: Record<string, string> = {
      'Unidade': 'unit', 'Feitiço': 'spell', 'Terreno': 'terrain',
      'Equipamento': 'equipment', 'Montaria': 'mount',
    };
    return availableCoreCards.filter(c => c.type === typeMap[typeFilter]);
  }, [availableCoreCards, typeFilter]);

  const filteredNeutralCards = useMemo(() => {
    if (typeFilter === 'Todos') return NEUTRAL_CARDS;
    const typeMap: Record<string, string> = {
      'Unidade': 'unit', 'Feitiço': 'spell', 'Terreno': 'terrain',
      'Equipamento': 'equipment', 'Montaria': 'mount',
    };
    return NEUTRAL_CARDS.filter(c => c.type === typeMap[typeFilter]);
  }, [typeFilter]);

  const coreTotal = coreCards.reduce((s, c) => s + c.count, 0);
  const neutralTotal = neutralCards.reduce((s, c) => s + c.count, 0);

  const getCoreCount = (cardId: string) => coreCards.find(c => c.cardId === cardId)?.count ?? 0;
  const getNeutralCount = (cardId: string) => neutralCards.find(c => c.cardId === cardId)?.count ?? 0;

  const addCore = (cardId: string) => {
    if (coreTotal >= 20) return;
    const existing = coreCards.find(c => c.cardId === cardId);
    const count = existing?.count ?? 0;
    if (count >= 3) return;
    const variations = coreCards.filter(c => c.count > 0).length;
    if (!existing && variations >= 10) return;
    if (existing) setCoreCards(coreCards.map(c => c.cardId === cardId ? { ...c, count: c.count + 1 } : c));
    else setCoreCards([...coreCards, { cardId, count: 1 }]);
  };

  const removeCore = (cardId: string) => {
    const existing = coreCards.find(c => c.cardId === cardId);
    if (!existing || existing.count === 0) return;
    if (existing.count === 1) setCoreCards(coreCards.filter(c => c.cardId !== cardId));
    else setCoreCards(coreCards.map(c => c.cardId === cardId ? { ...c, count: c.count - 1 } : c));
  };

  const addNeutral = (cardId: string) => {
    if (neutralTotal >= 10) return;
    const existing = neutralCards.find(c => c.cardId === cardId);
    const count = existing?.count ?? 0;
    if (count >= 2) return;
    if (existing) setNeutralCards(neutralCards.map(c => c.cardId === cardId ? { ...c, count: c.count + 1 } : c));
    else setNeutralCards([...neutralCards, { cardId, count: 1 }]);
  };

  const removeNeutral = (cardId: string) => {
    const existing = neutralCards.find(c => c.cardId === cardId);
    if (!existing || existing.count === 0) return;
    if (existing.count === 1) setNeutralCards(neutralCards.filter(c => c.cardId !== cardId));
    else setNeutralCards(neutralCards.map(c => c.cardId === cardId ? { ...c, count: c.count - 1 } : c));
  };

  const handleSave = async () => {
    const deck: DeckDefinition = {
      id: initialDeck?.id ?? `deck-${Date.now()}`,
      name: deckName,
      heroId,
      coreCards: coreCards.filter(c => c.count > 0),
      neutralCards: neutralCards.filter(c => c.count > 0),
    };
    const errors = validateDeck(deck);
    if (errors.length > 0) { setSaveError(errors); return; }

    // Try cloud save via onSave prop (async) first
    let cloudError: string | null = null;
    if (typeof onSave === 'function') {
      const result = await onSave(deck);
      if (result && typeof result === 'object' && result.error) {
        cloudError = result.error;
      } else {
        setSaved(true);
        setSaveError([]);
        setTimeout(() => setSaved(false), 1000);
        return;
      }
    }

    // Fallback to localStorage
    saveDeck(deck);
    setSaved(true);
    setSaveError([]);
    if (cloudError) {
      setSaveError(['Salvo localmente. ' + cloudError]);
    }
    setTimeout(() => setSaved(false), 1000);
  };

  const progressColor = (val: number, max: number) => {
    if (val === max) return 'bg-green-500';
    if (val > max) return 'bg-red-500';
    return 'bg-blue-500';
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {inspectedCard && <CardInspector card={inspectedCard} onClose={() => setInspectedCard(null)} />}

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Star className="w-5 h-5 text-amber-400" />
          <input
            type="text"
            value={deckName}
            onChange={e => setDeckName(e.target.value)}
            className="bg-transparent text-white font-bold text-lg border-b border-transparent hover:border-gray-600 focus:border-amber-400 outline-none transition-colors w-64"
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className={coreTotal === 20 ? 'text-green-400' : 'text-gray-400'}>
              Base: {coreTotal}/20
            </span>
            {' · '}
            <span className={neutralTotal === 10 ? 'text-green-400' : 'text-gray-400'}>
              Neutras: {neutralTotal}/10
            </span>
          </div>
          <button
            onClick={handleSave}
            className={`px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors ${
              saved ? 'bg-green-600' : 'bg-amber-600 hover:bg-amber-500'
            }`}
          >
            {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Errors */}
      {saveError.length > 0 && (
        <div className="bg-red-900/40 border border-red-700 mx-4 mt-2 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 font-semibold text-sm">Erros de validação:</span>
          </div>
          {saveError.map((e, i) => <p key={i} className="text-red-300 text-xs ml-6">{e}</p>)}
        </div>
      )}

      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Left: Hero + Deck summary */}
        <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden">
          {/* Hero selection */}
          <div className="p-3 border-b border-gray-800">
            <h3 className="text-gray-400 text-xs uppercase font-semibold mb-2">Herói</h3>
            <div className="grid grid-cols-3 gap-1">
              {HEROES.map(hero => (
                <button
                  key={hero.id}
                  onClick={() => {
                    setHeroId(hero.id);
                    setCoreCards([]);
                  }}
                  className={`px-1 py-1.5 rounded text-xs font-medium text-center transition-colors leading-tight ${
                    heroId === hero.id ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {hero.name.split(' ').slice(-1)[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Hero card preview */}
          {heroId && (
            <div className="p-3 border-b border-gray-800 flex justify-center">
              <CardDisplay
                card={getCardById(heroId)!}
                size="lg"
                onClick={() => setInspectedCard(getCardById(heroId)!)}
              />
            </div>
          )}

          {/* Deck summary */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-400 text-xs font-semibold">Baralho Base</span>
                <span className="text-gray-500 text-xs">{coreTotal}/20</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2">
                <div className={`h-1.5 rounded-full transition-all ${progressColor(coreTotal, 20)}`} style={{ width: `${Math.min(100, (coreTotal / 20) * 100)}%` }} />
              </div>
              <div className="space-y-0.5">
                {coreCards.filter(c => c.count > 0).map(({ cardId, count }) => {
                  const def = getCardById(cardId);
                  if (!def) return null;
                  return (
                    <div key={cardId} className="flex items-center justify-between text-xs">
                      <span className="text-gray-300 truncate flex-1">{def.name}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => removeCore(cardId)} className="w-4 h-4 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center">
                          <Minus className="w-2.5 h-2.5 text-gray-300" />
                        </button>
                        <span className="text-amber-400 w-4 text-center font-bold">{count}</span>
                        <button onClick={() => addCore(cardId)} className="w-4 h-4 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center">
                          <Plus className="w-2.5 h-2.5 text-gray-300" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-400 text-xs font-semibold">Cartas Neutras</span>
                <span className="text-gray-500 text-xs">{neutralTotal}/10</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2">
                <div className={`h-1.5 rounded-full transition-all ${progressColor(neutralTotal, 10)}`} style={{ width: `${Math.min(100, (neutralTotal / 10) * 100)}%` }} />
              </div>
              <div className="space-y-0.5">
                {neutralCards.filter(c => c.count > 0).map(({ cardId, count }) => {
                  const def = getCardById(cardId);
                  if (!def) return null;
                  return (
                    <div key={cardId} className="flex items-center justify-between text-xs">
                      <span className="text-gray-300 truncate flex-1">{def.name}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => removeNeutral(cardId)} className="w-4 h-4 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center">
                          <Minus className="w-2.5 h-2.5 text-gray-300" />
                        </button>
                        <span className="text-amber-400 w-4 text-center font-bold">{count}</span>
                        <button onClick={() => addNeutral(cardId)} className="w-4 h-4 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center">
                          <Plus className="w-2.5 h-2.5 text-gray-300" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Card browser */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">
          {/* Tabs + filter */}
          <div className="border-b border-gray-800 px-4 py-2 flex items-center gap-4">
            <div className="flex gap-1">
              <button
                onClick={() => setTab('core')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${tab === 'core' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Cartas Base {heroId ? `(${availableCoreCards.length})` : ''}
              </button>
              <button
                onClick={() => setTab('neutral')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${tab === 'neutral' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Cartas Neutras ({NEUTRAL_CARDS.length})
              </button>
            </div>
            <div className="flex gap-1 ml-auto">
              {TYPE_FILTER_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setTypeFilter(opt)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${typeFilter === opt ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Cards grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'core' && !heroId && (
              <div className="text-center text-gray-500 py-16">
                <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Selecione um herói para ver as cartas disponíveis.</p>
              </div>
            )}

            {tab === 'core' && heroId && (
              <div className="flex flex-wrap gap-3">
                {filteredCoreCards.map(card => {
                  const count = getCoreCount(card.id);
                  return (
                    <div key={card.id} className="flex flex-col items-center gap-1">
                      <div className="relative">
                        <CardDisplay
                          card={card}
                          size="md"
                          onClick={() => setInspectedCard(card)}
                        />
                        {count > 0 && (
                          <div className="absolute top-0 right-0 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-bold">
                            {count}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => removeCore(card.id)}
                          disabled={count === 0}
                          className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-3 h-3 text-gray-300" />
                        </button>
                        <span className="text-xs text-gray-400 w-4 text-center">{count}/3</span>
                        <button
                          onClick={() => addCore(card.id)}
                          disabled={count >= 3 || coreTotal >= 20}
                          className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3 h-3 text-gray-300" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'neutral' && (
              <div className="flex flex-wrap gap-3">
                {filteredNeutralCards.map(card => {
                  const count = getNeutralCount(card.id);
                  return (
                    <div key={card.id} className="flex flex-col items-center gap-1">
                      <div className="relative">
                        <CardDisplay
                          card={card}
                          size="md"
                          onClick={() => setInspectedCard(card)}
                        />
                        {count > 0 && (
                          <div className="absolute top-0 right-0 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-bold">
                            {count}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => removeNeutral(card.id)}
                          disabled={count === 0}
                          className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-3 h-3 text-gray-300" />
                        </button>
                        <span className="text-xs text-gray-400 w-4 text-center">{count}/2</span>
                        <button
                          onClick={() => addNeutral(card.id)}
                          disabled={count >= 2 || neutralTotal >= 10}
                          className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3 h-3 text-gray-300" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
