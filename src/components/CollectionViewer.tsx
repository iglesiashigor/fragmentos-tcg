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
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-4">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Star className="w-5 h-5 text-amber-400" />
        <h1 className="text-white font-bold text-lg">Coleção de Cartas</h1>
        <span className="text-gray-500 text-sm ml-auto">{cards.length} cartas</span>
      </div>

      {/* Filters */}
      <div className="bg-gray-900/50 border-b border-gray-800 px-4 py-2 flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5 flex-1 min-w-40 max-w-xs">
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
        <div className="flex gap-1 flex-wrap">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === opt.value ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-wrap gap-3">
          {cards.map(card => (
            <div key={card.id} className="flex flex-col items-center gap-1">
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
