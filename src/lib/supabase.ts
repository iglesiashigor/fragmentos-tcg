import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type DbDeck = {
  id: string;
  user_id: string;
  name: string;
  hero_id: string;
  core_cards: { cardId: string; count: number }[];
  neutral_cards: { cardId: string; count: number }[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type DbProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
  draws: number;
  rating: number;
  created_at: string;
  updated_at: string;
};

export type DbGameRoom = {
  id: string;
  player1_id: string;
  player2_id: string | null;
  status: 'waiting' | 'active' | 'finished';
  player1_ready: boolean;
  player2_ready: boolean;
  player1_deck_id: string | null;
  player2_deck_id: string | null;
  game_state: any | null;
  log: any[];
  created_at: string;
  updated_at: string;
};

export function dbDeckToDeckDefinition(dbDeck: DbDeck) {
  return {
    id: dbDeck.id,
    name: dbDeck.name,
    heroId: dbDeck.hero_id,
    coreCards: dbDeck.core_cards ?? [],
    neutralCards: dbDeck.neutral_cards ?? [],
  };
}

export function deckDefinitionToDbDeck(deck: { id?: string; name: string; heroId: string; coreCards: { cardId: string; count: number }[]; neutralCards: { cardId: string; count: number }[] }) {
  return {
    name: deck.name,
    hero_id: deck.heroId,
    core_cards: deck.coreCards,
    neutral_cards: deck.neutralCards,
  };
}
