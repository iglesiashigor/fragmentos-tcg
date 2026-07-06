import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { DeckDefinition } from '../types/game';
import { useAuth } from '../lib/authContext';
import { getSavedDecks } from '../data/defaultDecks';

interface DeckRow {
  id: string;
  user_id: string;
  name: string;
  hero_id: string;
  core_cards: { cardId: string; count: number }[];
  neutral_cards: { cardId: string; count: number }[];
  created_at: string;
  updated_at: string;
}

function rowToDeckDefinition(row: DeckRow): DeckDefinition {
  return {
    id: row.id,
    name: row.name,
    heroId: row.hero_id,
    coreCards: row.core_cards ?? [],
    neutralCards: row.neutral_cards ?? [],
  };
}

function mergeDecks(localDecks: DeckDefinition[], cloudDecks: DeckDefinition[]): DeckDefinition[] {
  const seen = new Set<string>();
  const result: DeckDefinition[] = [];

  for (const deck of cloudDecks) {
    if (!seen.has(deck.id)) {
      seen.add(deck.id);
      result.push(deck);
    }
  }

  for (const deck of localDecks) {
    if (!seen.has(deck.id)) {
      seen.add(deck.id);
      result.push(deck);
    }
  }

  return result;
}

export function useDecks() {
  const { user } = useAuth();
  const [decks, setDecks] = useState<DeckDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDecks = useCallback(async () => {
    const localDecks = getSavedDecks();

    if (!user) {
      setDecks(localDecks);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('decks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      setDecks(localDecks);
    } else if (data) {
      const cloudDecks = (data as DeckRow[]).map(rowToDeckDefinition);
      setDecks(mergeDecks(localDecks, cloudDecks));
      setError(null);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  const saveDbDeck = async (deck: DeckDefinition): Promise<{ error: string | null; id?: string }> => {
    if (!user) return { error: 'Nao autenticado' };

    const isDefaultDeck = deck.id.startsWith('deck-');
    const record = {
      user_id: user.id,
      name: deck.name,
      hero_id: deck.heroId,
      core_cards: deck.coreCards,
      neutral_cards: deck.neutralCards,
    };

    const query = isDefaultDeck
      ? supabase.from('decks').insert(record)
      : supabase.from('decks').update(record).eq('id', deck.id).eq('user_id', user.id);

    const { data, error } = await query.select('id').single();

    if (error) return { error: error.message };

    await loadDecks();
    return { error: null, id: data?.id };
  };

  const deleteDbDeck = async (deckId: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Nao autenticado' };

    const { error } = await supabase
      .from('decks')
      .delete()
      .eq('id', deckId)
      .eq('user_id', user.id);

    if (error) return { error: error.message };

    await loadDecks();
    return { error: null };
  };

  return { decks, loading, error, saveDbDeck, deleteDbDeck, refreshDecks: loadDecks };
}
