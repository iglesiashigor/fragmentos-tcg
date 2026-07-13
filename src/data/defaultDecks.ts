import { DeckDefinition } from '../types/game';

export const DEFAULT_DECKS: DeckDefinition[] = [
  {
    id: 'deck-elfo-arqueiro',
    name: 'Elfo Arqueiro - Padrão',
    heroId: 'elfo-arqueiro',
    coreCards: [
      { cardId: 'flecha-de-raio', count: 3 },
      { cardId: 'flecha-de-veneno', count: 3 },
      { cardId: 'flecha-de-gelo', count: 2 },
      { cardId: 'flecha-perfurante', count: 2 },
      { cardId: 'floresta-encantada', count: 2 },
      { cardId: 'arco-perfeito', count: 2 },
      { cardId: 'espirito-da-natureza', count: 3 },
      { cardId: 'invocador-da-natureza', count: 2 },
      { cardId: 'mestre-arqueiro', count: 1 },
    ],
    neutralCards: [
      { cardId: 'pocao-de-sorte', count: 2 },
      { cardId: 'refeicao', count: 2 },
      { cardId: 'reviver', count: 2 },
      { cardId: 'devastacao', count: 2 },
      { cardId: 'pocao-purificante', count: 2 },
    ],
  },
  {
    id: 'deck-anao-guerreiro',
    name: 'Anão Guerreiro - Padrão',
    heroId: 'anao-guerreiro',
    coreCards: [
      { cardId: 'desmoronamento', count: 2 },
      { cardId: 'furia', count: 3 },
      { cardId: 'forja-dos-anoes', count: 2 },
      { cardId: 'machado-duplo', count: 3 },
      { cardId: 'escudo-de-ferro', count: 2 },
      { cardId: 'sentinela-ana', count: 3 },
      { cardId: 'lider-de-batalhao', count: 3 },
      { cardId: 'ferreiro-anao', count: 2 },
    ],
    neutralCards: [
      { cardId: 'pocao-de-sorte', count: 2 },
      { cardId: 'refeicao', count: 2 },
      { cardId: 'reviver', count: 2 },
      { cardId: 'devastacao', count: 2 },
      { cardId: 'boneco-de-treino', count: 2 },
    ],
  },
  {
    id: 'deck-humano-mago',
    name: 'Humano Mago - Padrão',
    heroId: 'humano-mago',
    coreCards: [
      { cardId: 'misseis-magicos', count: 3 },
      { cardId: 'tempestade-de-raios', count: 2 },
      { cardId: 'surto-de-magia', count: 3 },
      { cardId: 'disparo-mistico', count: 2 },
      { cardId: 'tomo-arcano', count: 3 },
      { cardId: 'torre-arcana', count: 2 },
      { cardId: 'elemental', count: 3 },
      { cardId: 'arquimago', count: 2 },
    ],
    neutralCards: [
      { cardId: 'pocao-de-sorte', count: 2 },
      { cardId: 'refeicao', count: 2 },
      { cardId: 'devastacao', count: 2 },
      { cardId: 'pocao-purificante', count: 2 },
      { cardId: 'boneco-de-treino', count: 2 },
    ],
  },
  {
    id: 'deck-orque-barbaro',
    name: 'Orque Bárbaro - Padrão',
    heroId: 'orque-barbaro',
    coreCards: [
      { cardId: 'furia-sanguinaria', count: 2 },
      { cardId: 'frenesi-de-batalha', count: 3 },
      { cardId: 'campo-de-batalha', count: 2 },
      { cardId: 'machado-de-batalha', count: 3 },
      { cardId: 'assaltante-orque', count: 3 },
      { cardId: 'berserker-orque', count: 3 },
      { cardId: 'guerreiro-orque', count: 2 },
      { cardId: 'lider-orque', count: 2 },
    ],
    neutralCards: [
      { cardId: 'pocao-de-sorte', count: 2 },
      { cardId: 'refeicao', count: 2 },
      { cardId: 'reviver', count: 2 },
      { cardId: 'devastacao', count: 2 },
      { cardId: 'boneco-de-treino', count: 2 },
    ],
  },
  {
    id: 'deck-metadilho-ladino',
    name: 'Metadilho Ladino - Padrao',
    heroId: 'metadilho-ladino',
    coreCards: [
      { cardId: 'laminas-envenenadas', count: 2 },
      { cardId: 'botas-de-velocidade', count: 2 },
      { cardId: 'festival-de-verao', count: 2 },
      { cardId: 'laminas-gemias', count: 2 },
      { cardId: 'lamina-ancia', count: 2 },
      { cardId: 'gato-furtivo', count: 2 },
      { cardId: 'taverneiro-desastrado', count: 2 },
      { cardId: 'patrulheiro-corrupto', count: 2 },
      { cardId: 'mercador-sombrio', count: 2 },
      { cardId: 'mestre-de-guilda', count: 2 },
    ],
    neutralCards: [
      { cardId: 'pocao-de-sorte', count: 2 },
      { cardId: 'refeicao', count: 2 },
      { cardId: 'reviver', count: 2 },
      { cardId: 'devastacao', count: 2 },
      { cardId: 'pocao-purificante', count: 2 },
    ],
  },
  {
    id: 'deck-hibrido-samurai',
    name: 'Hibrido Samurai - Padrao',
    heroId: 'hibrido-samurai',
    coreCards: [
      { cardId: 'mil-petalas', count: 3 },
      { cardId: 'shakra', count: 2 },
      { cardId: 'espalhe', count: 3 },
      { cardId: 'boa-vista', count: 2 },
      { cardId: 'local-calmo', count: 2 },
      { cardId: 'katana-especial', count: 3 },
      { cardId: 'faixa-verde', count: 2 },
      { cardId: 'faixa-azul', count: 1 },
      { cardId: 'faixa-marrom', count: 2 },
    ],
    neutralCards: [
      { cardId: 'pocao-de-sorte', count: 2 },
      { cardId: 'refeicao', count: 2 },
      { cardId: 'reviver', count: 2 },
      { cardId: 'pequenos-reparos', count: 2 },
      { cardId: 'boneco-de-treino', count: 2 },
    ],
  },
];

export function saveDeck(deck: DeckDefinition): void {
  const saved = getSavedDecks();
  const idx = saved.findIndex(d => d.id === deck.id);
  if (idx >= 0) saved[idx] = deck;
  else saved.push(deck);
  localStorage.setItem('fragmentos-decks', JSON.stringify(saved));
}

export function getSavedDecks(): DeckDefinition[] {
  try {
    const raw = localStorage.getItem('fragmentos-decks');
    if (!raw) return [...DEFAULT_DECKS];
    const saved = JSON.parse(raw) as DeckDefinition[];
    const savedIds = new Set(saved.map(deck => deck.id));
    return [
      ...saved,
      ...DEFAULT_DECKS.filter(deck => !savedIds.has(deck.id)),
    ];
  } catch {
    return [...DEFAULT_DECKS];
  }
}

export function deleteDeck(deckId: string): void {
  const saved = getSavedDecks().filter(d => d.id !== deckId);
  localStorage.setItem('fragmentos-decks', JSON.stringify(saved));
}

export function validateDeck(deck: DeckDefinition): string[] {
  const errors: string[] = [];
  const coreTotal = deck.coreCards.reduce((s, c) => s + c.count, 0);
  const neutralTotal = deck.neutralCards.reduce((s, c) => s + c.count, 0);

  if (!deck.heroId) errors.push('Selecione um herói.');
  if (coreTotal !== 20) errors.push(`O baralho básico deve ter 20 cartas (atual: ${coreTotal}).`);
  if (neutralTotal !== 10) errors.push(`As cartas neutras devem ter 10 cartas (atual: ${neutralTotal}).`);

  for (const { cardId, count } of deck.coreCards) {
    if (count > 3) errors.push(`Máximo 3 cópias por carta básica (${cardId}).`);
  }

  const coreVariations = new Set(deck.coreCards.map(c => c.cardId)).size;
  if (coreVariations > 10) errors.push('Máximo de 10 variações no baralho básico.');

  for (const { cardId, count } of deck.neutralCards) {
    if (count > 2) errors.push(`Máximo 2 cópias por carta neutra (${cardId}).`);
  }

  return errors;
}
