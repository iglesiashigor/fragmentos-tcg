import React, { useState } from 'react';
import { DeckDefinition } from '../types/game';
import { getSavedDecks, DEFAULT_DECKS, deleteDeck } from '../data/defaultDecks';
import { getCardById } from '../data/cards';
import { useAuth } from '../lib/auth';
import {
  Star, Play, Layers, BookOpen, Trash2, Plus, Sword, Shield, Heart,
  ChevronRight, LogIn, LogOut, User, Trophy, Zap, Users, Globe,
  AlertTriangle,
} from 'lucide-react';

interface MainMenuProps {
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

export default function MainMenu({
  onStartGame, onStartPvp, onOpenDeckBuilder, onOpenCollection,
  onOpenProfile, onShowAuth, decks, decksLoading, user, profile, onDeleteDeck, onRefreshDecks,
}: MainMenuProps) {
  const { signOut } = useAuth();
  const [selectedPlayerDeck, setSelectedPlayerDeck] = useState<string | null>(decks[0]?.id ?? null);
  const [selectedAIDeck, setSelectedAIDeck] = useState<string | null>(decks[1]?.id ?? decks[0]?.id ?? null);
  const [error, setError] = useState('');
  const [gameMode, setGameMode] = useState<'ai' | 'pvp'>('ai');
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const handleStartGame = () => {
    if (!selectedPlayerDeck || !selectedAIDeck) {
      setError('Selecione os baralhos para ambos os jogadores.');
      return;
    }
    const playerDeck = decks.find(d => d.id === selectedPlayerDeck);
    const aiDeck = decks.find(d => d.id === selectedAIDeck);
    if (!playerDeck || !aiDeck) { setError('Baralho inválido.'); return; }
    setError('');
    onStartGame(playerDeck, aiDeck);
  };

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

  const displayDecks = decks.length > 0 ? decks : DEFAULT_DECKS;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-800/60 rounded-xl max-w-md w-full shadow-2xl">
            <div className="p-4 border-b border-gray-800 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/40 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-300" />
              </div>
              <h2 className="text-white font-bold text-lg">{confirmDialog.title}</h2>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-gray-300 text-sm">{confirmDialog.message}</p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded-lg font-semibold transition-colors"
                >
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
      {/* Hero header */}
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 border-b border-gray-800 py-10 text-center relative">
        {/* User badge */}
        <div className="absolute top-4 right-4 flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-1.5">
                <User className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-white">{profile?.username ?? 'Jogador'}</span>
                {profile && (
                  <span className="text-xs text-gray-400">
                    {profile.wins}V / {profile.losses}D / {profile.rating}pts
                  </span>
                )}
              </div>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-400 transition-colors bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </button>
            </div>
          ) : (
            <button
              onClick={onShowAuth}
              className="flex items-center gap-2 bg-amber-600/20 border border-amber-600/40 hover:bg-amber-600/30 text-amber-300 text-sm rounded-lg px-4 py-1.5 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Entrar
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <Star className="w-6 h-6 text-amber-400" />
          </div>
        </div>
        <h1 className="text-5xl font-black tracking-tight text-white mb-1">
          FRAGMENTOS
        </h1>
        <p className="text-amber-400 font-semibold text-lg tracking-widest uppercase">Trading Card Game</p>
        <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
          Um mundo de estratégia alimentado por cristais místicos. Construa seu baralho, conquiste o campo de batalha.
        </p>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <Layers className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{displayDecks.length}</div>
            <div className="text-gray-400 text-sm">Baralhos</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <Sword className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">12</div>
            <div className="text-gray-400 text-sm">Heróis</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <BookOpen className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">100+</div>
            <div className="text-gray-400 text-sm">Cartas</div>
          </div>
        </div>

        {/* Game mode selector */}
        <div className="flex gap-2 mb-6 justify-center">
          <button
            onClick={() => setGameMode('ai')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all border ${
              gameMode === 'ai'
                ? 'bg-gray-800 border-gray-600 text-white'
                : 'bg-gray-900/50 border-gray-800 text-gray-500 hover:text-gray-300'
            }`}
          >
            <Zap className="w-4 h-4" />
            vs IA
          </button>
          <button
            onClick={() => {
              if (!user) { onShowAuth(); return; }
              setGameMode('pvp');
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all border ${
              gameMode === 'pvp'
                ? 'bg-amber-900/30 border-amber-600 text-amber-300'
                : 'bg-gray-900/50 border-gray-800 text-gray-500 hover:text-amber-300'
            }`}
          >
            <Users className="w-4 h-4" />
            vs Jogador
          </button>
        </div>

        {gameMode === 'ai' ? (
          <>
            {/* Deck selection */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Player deck */}
              <div>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-400" />
                  Seu Baralho
                </h3>
                <div className="space-y-2">
                  {displayDecks.map(deck => {
                    const hero = getCardById(deck.heroId);
                    const isSelected = selectedPlayerDeck === deck.id;
                    return (
                      <div
                        key={deck.id}
                        onClick={() => setSelectedPlayerDeck(deck.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-900/30 border-blue-500'
                            : 'bg-gray-900 border-gray-800 hover:border-gray-600'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-900/40 border border-amber-700/40 flex items-center justify-center flex-shrink-0">
                          <Star className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium truncate">{deck.name}</div>
                          <div className="text-gray-400 text-xs">{hero?.name ?? 'Herói'}</div>
                        </div>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI deck */}
              <div>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  Baralho da IA
                </h3>
                <div className="space-y-2">
                  {displayDecks.map(deck => {
                    const hero = getCardById(deck.heroId);
                    const isSelected = selectedAIDeck === deck.id;
                    return (
                      <div
                        key={deck.id}
                        onClick={() => setSelectedAIDeck(deck.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-red-900/30 border-red-500'
                            : 'bg-gray-900 border-gray-800 hover:border-gray-600'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-900/40 border border-red-700/40 flex items-center justify-center flex-shrink-0">
                          <Shield className="w-4 h-4 text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium truncate">{deck.name}</div>
                          <div className="text-gray-400 text-xs">{hero?.name ?? 'Herói'}</div>
                        </div>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4 text-red-300 text-sm text-center">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-center mb-8">
              <button
                onClick={handleStartGame}
                className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-lg rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-amber-900/30"
              >
                <Play className="w-5 h-5" />
                Iniciar Partida
              </button>
            </div>
          </>
        ) : (
          <div className="text-center mb-8">
            <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-6 mb-4">
              <Users className="w-8 h-8 text-amber-400 mx-auto mb-3" />
              <h3 className="text-amber-300 font-bold text-lg mb-1">Jogar Online</h3>
              <p className="text-gray-400 text-sm mb-4">Encontre um oponente e jogue em tempo real.</p>
              <button
                onClick={onStartPvp}
                className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-lg rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-amber-900/30 mx-auto"
              >
                <Globe className="w-5 h-5" />
                Buscar Partida
              </button>
            </div>
          </div>
        )}

        {/* Secondary actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={onOpenProfile}
            className="flex items-center justify-center gap-2 p-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-amber-600 rounded-xl text-gray-300 hover:text-amber-300 transition-all text-sm font-medium"
          >
            <Trophy className="w-4 h-4" />
            Perfil
          </button>
          <button
            onClick={() => { onOpenDeckBuilder(); }}
            className="flex items-center justify-center gap-2 p-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-xl text-gray-300 hover:text-white transition-all text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Novo Baralho
          </button>
          <button
            onClick={onOpenCollection}
            className="flex items-center justify-center gap-2 p-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-xl text-gray-300 hover:text-white transition-all text-sm font-medium"
          >
            <BookOpen className="w-4 h-4" />
            Coleção
          </button>
          <button
            onClick={() => {
              if (displayDecks.length > 0) {
                const last = displayDecks[displayDecks.length - 1];
                handleDelete(last.id, last.name);
              }
            }}
            className="flex items-center justify-center gap-2 p-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-red-700 rounded-xl text-gray-400 hover:text-red-400 transition-all text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" />
            Excluir Baralho
          </button>
        </div>

        {/* Deck management */}
        {displayDecks.length > 0 && (
          <div className="mt-6">
            <h3 className="text-gray-500 text-xs uppercase font-semibold mb-2">Gerenciar Baralhos</h3>
            <div className="space-y-1">
              {displayDecks.map(deck => (
                <div key={deck.id} className="flex items-center gap-2 text-xs text-gray-400 group">
                  <span className="flex-1 truncate">{deck.name}</span>
                  <button
                    onClick={() => onOpenDeckBuilder(deck)}
                    className="opacity-0 group-hover:opacity-100 px-2 py-0.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition-all"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(deck.id, deck.name)}
                    className="opacity-0 group-hover:opacity-100 px-2 py-0.5 bg-red-900 hover:bg-red-800 rounded text-red-300 transition-all"
                  >
                    Del
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
