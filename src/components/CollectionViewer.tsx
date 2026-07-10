import React, { useState, useMemo } from 'react';
import { CardDefinition } from '../types/game';
import { ALL_CARDS } from '../data/cards';
import CardDisplay from './CardDisplay';
import CardInspector from './CardInspector';
import { ArrowLeft, Star, Search } from 'lucide-react';

interface CollectionViewerProps {
  onBack: () => void;
}

const TYPE_OPTIONS = [
  { label: 'Todos', value: '' },
  { label: 'Heróis', value: 'hero' },
  { label: 'Unidades', value: 'unit' },
  { label: 'Feitiços', value: 'spell' },
  { label: 'Terrenos', value: 'terrain' },
  { label: 'Equipamentos', value: 'equipment' },
  { label: 'Montarias', value: 'mount' },
  { label: 'Neutras', value: 'neutral' },
];

export default function CollectionViewer({ onBack }: CollectionViewerProps) {
  const [inspectedCard, setInspectedCard] = useState<CardDefinition | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  const cards = useMemo(() => {
    let result = ALL_CARDS.filter(c => c.type !== 'mana');

    if (typeFilter === 'neutral') {
      result = result.filter(c => c.isNeutral);
    } else if (typeFilter) {
      result = result.filter(c => c.type === typeFilter && !c.isNeutral);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.effects.some(e => JSON.stringify(e).toLowerCase().includes(q))
      );
    }

    return result;
  }, [typeFilter, search]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {inspectedCard && <CardInspector card={inspectedCard} onClose={() => setInspectedCard(null)} />}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-3 sm:px-4 py-3 flex items-center gap-3 sm:gap-4">
        <button onClick={onBack} aria-label="Voltar" className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Star className="hidden min-[360px]:block w-5 h-5 shrink-0 text-amber-400" />
        <h1 className="min-w-0 truncate text-white font-bold text-base sm:text-lg">Coleção de Cartas</h1>
        <span className="shrink-0 text-gray-500 text-xs sm:text-sm ml-auto">{cards.length} cartas</span>
      </header>

      {/* Filters */}
      <div className="sticky top-[57px] z-20 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-3 sm:px-4 py-2.5 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        {/* Search */}
        <div className="flex min-w-0 items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 sm:flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar carta..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-white text-sm outline-none flex-1 placeholder-gray-500"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === opt.value ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <div className="flex-1 p-3 sm:p-4">
        <div className="grid grid-cols-2 min-[360px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 gap-x-3 gap-y-4 justify-items-center">
          {cards.map(card => (
            <div key={card.id} className="min-w-0 flex flex-col items-center gap-1">
              <CardDisplay
                card={card}
                size="md"
                onClick={() => setInspectedCard(card)}
              />
              <span className="text-gray-500 text-xs text-center max-w-[7rem] truncate">{card.name}</span>
            </div>
          ))}
          {cards.length === 0 && (
            <div className="w-full text-center text-gray-600 py-16">
              Nenhuma carta encontrada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
