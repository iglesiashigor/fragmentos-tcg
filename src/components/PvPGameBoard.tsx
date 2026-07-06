import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { GameState, PlayerIndex, DeckDefinition } from '../types/game';
import { createInitialState, buildDeck, endTurn } from '../engine/gameEngine';
import { useAuth } from '../lib/authContext';
import { ArrowLeft, Radio, Loader2, Trophy, Home } from 'lucide-react';
import GameBoard from './GameBoard';
import { getSavedDecks } from '../data/defaultDecks';

interface PvPGameBoardProps {
  roomId: string;
  onBack: () => void;
}

interface DeckRow {
  id: string;
  name: string;
  hero_id: string;
  core_cards: { cardId: string; count: number }[];
  neutral_cards: { cardId: string; count: number }[];
}

function rowToDeck(row: DeckRow): DeckDefinition {
  return {
    id: row.id,
    name: row.name,
    heroId: row.hero_id,
    coreCards: row.core_cards ?? [],
    neutralCards: row.neutral_cards ?? [],
  };
}

async function fetchDeck(deckId: string): Promise<DeckDefinition | null> {
  const local = getSavedDecks().find(deck => deck.id === deckId);
  if (local) return local;

  const { data, error } = await supabase
    .from('decks')
    .select('id, name, hero_id, core_cards, neutral_cards')
    .eq('id', deckId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToDeck(data as DeckRow);
}

export default function PvPGameBoard({ roomId, onBack }: PvPGameBoardProps) {
  const { user } = useAuth();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerNumber, setPlayerNumber] = useState<number | null>(null);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [winner, setWinner] = useState<PlayerIndex | 'draw' | null>(null);
  const [playerNames, setPlayerNames] = useState<[string, string]>(['Jogador 1', 'Jogador 2']);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const processingTimeoutRef = useRef<string | null>(null);
  const latestGameStateRef = useRef<GameState | null>(null);

  useEffect(() => {
    latestGameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (!roomId || !user) return;

    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const applyGameState = (state: GameState) => {
      const normalizedState: GameState = {
        ...state,
        turnStartedAt: state.turnStartedAt ?? Date.now(),
        inactivityFaults: state.inactivityFaults ?? [0, 0],
        stateVersion: state.stateVersion ?? 0,
      };
      setGameState(currentState => {
        if ((currentState?.stateVersion ?? 0) > (normalizedState.stateVersion ?? 0)) {
          return currentState;
        }
        return normalizedState;
      });
      if (normalizedState.gameOver && normalizedState.winner !== null) setWinner(normalizedState.winner);
    };

    const loadPlayerNames = async (room: any) => {
      if (!(room.player1_id && room.player2_id)) return;

      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', [room.player1_id, room.player2_id]);

      const p1 = data?.find(profile => profile.id === room.player1_id)?.username ?? 'Jogador 1';
      const p2 = data?.find(profile => profile.id === room.player2_id)?.username ?? 'Jogador 2';
      if (mounted) setPlayerNames([p1, p2]);
    };

    const initializeGameIfHost = async (room: any) => {
      if (room.game_state) return;
      if (!(room.player1_id && room.player2_id && room.player1_deck_id && room.player2_deck_id)) return;
      if (room.player1_id !== user.id) return;

      const p1Deck = await fetchDeck(room.player1_deck_id);
      const p2Deck = await fetchDeck(room.player2_deck_id);

      if (!p1Deck || !p2Deck) {
        if (mounted) {
          setError('Baralhos nao encontrados.');
          setLoading(false);
        }
        return;
      }

      const first: PlayerIndex = Math.random() < 0.5 ? 0 : 1;
      const p1Cards = buildDeck(p1Deck.heroId, p1Deck.coreCards, p1Deck.neutralCards);
      const p2Cards = buildDeck(p2Deck.heroId, p2Deck.coreCards, p2Deck.neutralCards);
      const initialGameState: GameState = {
        ...createInitialState(p1Deck.heroId, p1Cards, p2Deck.heroId, p2Cards, first),
        turnStartedAt: Date.now(),
        inactivityFaults: [0, 0],
        stateVersion: 1,
      };

      await supabase
        .from('game_rooms')
        .update({ game_state: initialGameState, status: 'active' })
        .eq('id', roomId);

      if (mounted) {
        applyGameState(initialGameState);
        setLoading(false);
      }
    };

    const handleRoom = async (room: any) => {
      if (!mounted) return;

      const myNumber = room.player1_id === user.id ? 0 : room.player2_id === user.id ? 1 : null;
      if (myNumber === null) {
        setError('Voce nao esta nesta sala.');
        setLoading(false);
        return;
      }

      setPlayerNumber(myNumber);
      setOpponentConnected(!!room.player1_id && !!room.player2_id);
      void loadPlayerNames(room);

      if (room.game_state) {
        applyGameState(room.game_state as GameState);
      } else {
        await initializeGameIfHost(room);
      }

      setLoading(false);
    };

    const fetchRoom = async () => {
      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError || !room) {
        if (mounted) {
          setError('Sala nao encontrada.');
          setLoading(false);
        }
        return;
      }

      await handleRoom(room);
    };

    const init = async () => {
      await fetchRoom();

      channel = supabase
        .channel(`room-${roomId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` },
          payload => {
            void handleRoom(payload.new);
          }
        )
        .subscribe();

      pollInterval = setInterval(fetchRoom, 1500);
    };

    init();

    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (channel) channel.unsubscribe();
    };
  }, [roomId, user]);

  const handleGameEnd = useCallback((result: PlayerIndex | 'draw') => {
    setWinner(result);
  }, []);

  const handleStateChange = useCallback(async (newState: GameState) => {
    if (!roomId) return;
    const previousState = latestGameStateRef.current;
    const turnChanged = previousState && (
      previousState.currentPlayer !== newState.currentPlayer ||
      previousState.turnNumber !== newState.turnNumber
    );

    const stateToSave: GameState = {
      ...newState,
      turnStartedAt: turnChanged ? Date.now() : (newState.turnStartedAt ?? previousState?.turnStartedAt ?? Date.now()),
      inactivityFaults: newState.inactivityFaults ?? previousState?.inactivityFaults ?? [0, 0],
      stateVersion: Math.max(previousState?.stateVersion ?? 0, newState.stateVersion ?? 0) + 1,
    };

    latestGameStateRef.current = stateToSave;
    setGameState(stateToSave);

    const { error: updateError } = await supabase
      .from('game_rooms')
      .update({ game_state: stateToSave })
      .eq('id', roomId);

    if (updateError) {
      setError('Nao foi possivel salvar a jogada. Tente novamente.');
    }
  }, [roomId]);

  useEffect(() => {
    if (!gameState) return;
    const startedAt = gameState.turnStartedAt ?? Date.now();
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
    setSecondsRemaining(Math.max(0, 60 - elapsedSeconds));
    processingTimeoutRef.current = null;
  }, [gameState?.currentPlayer, gameState?.turnStartedAt, gameState?.stateVersion]);

  useEffect(() => {
    if (!gameState || playerNumber === null || gameState.gameOver) return;

    const interval = setInterval(() => {
      const startedAt = gameState.turnStartedAt ?? Date.now();
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, 60 - elapsedSeconds);
      setSecondsRemaining(remaining);

      if (remaining > 0 || gameState.currentPlayer === playerNumber) return;

      const timeoutKey = `${gameState.currentPlayer}-${gameState.turnStartedAt ?? 0}-${gameState.stateVersion ?? 0}`;
      if (processingTimeoutRef.current === timeoutKey) return;
      processingTimeoutRef.current = timeoutKey;

      const faultedPlayer = gameState.currentPlayer;
      const faults: [number, number] = [...(gameState.inactivityFaults ?? [0, 0])] as [number, number];
      faults[faultedPlayer] += 1;

      let nextState: GameState = {
        ...gameState,
        inactivityFaults: faults,
        stateVersion: (gameState.stateVersion ?? 0) + 1,
        log: [...gameState.log, `${playerNames[faultedPlayer]} recebeu falta por inatividade (${faults[faultedPlayer]}/2).`],
      };

      if (faults[faultedPlayer] >= 2) {
        const winnerIdx = (1 - faultedPlayer) as PlayerIndex;
        nextState = {
          ...nextState,
          gameOver: true,
          winner: winnerIdx,
          log: [...nextState.log, `${playerNames[winnerIdx]} venceu por inatividade do oponente.`],
        };
      } else {
        nextState = {
          ...endTurn(nextState),
          turnStartedAt: Date.now(),
          inactivityFaults: faults,
          stateVersion: (nextState.stateVersion ?? 0) + 1,
        };
      }

      void (async () => {
        const { error: updateError } = await supabase
          .from('game_rooms')
          .update({ game_state: nextState })
          .eq('id', roomId);

        if (updateError) {
          processingTimeoutRef.current = null;
          return;
        }

        setGameState(currentState => {
          if ((currentState?.stateVersion ?? 0) > (nextState.stateVersion ?? 0)) return currentState;
          return nextState;
        });

        if (nextState.gameOver && nextState.winner !== null) setWinner(nextState.winner);
      })();
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, playerNumber, playerNames, roomId]);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-4" />
        <p className="text-gray-400">Conectando...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-red-800 rounded-xl p-8 max-w-md text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={onBack} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white">
          <ArrowLeft className="w-4 h-4 inline mr-2" />Voltar
        </button>
      </div>
    </div>
  );

  if (!gameState || !opponentConnected) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto mb-4">
          <Radio className="w-8 h-8 text-amber-400 animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {opponentConnected ? 'Iniciando...' : 'Aguardando oponente...'}
        </h2>
        <button onClick={onBack} className="mt-4 text-gray-500 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Voltar
        </button>
      </div>
    </div>
  );

  if (winner !== null) {
    const won = winner !== 'draw' && winner === playerNumber;

    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${won ? 'bg-green-500/20 border border-green-500/40' : 'bg-red-500/20 border border-red-500/40'}`}>
            <Trophy className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">
            {winner === 'draw' ? 'Empate!' : won ? 'Vitoria!' : 'Derrota!'}
          </h2>
          <div className="flex gap-3 justify-center">
            <button onClick={onBack} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white flex items-center gap-2">
              <Home className="w-4 h-4" />Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GameBoard
      key="pvp-game"
      initialState={gameState}
      onGameEnd={handleGameEnd}
      isPvP={true}
      onStateChange={handleStateChange}
      myPlayerIndex={playerNumber === 1 ? 1 : 0}
      playerNames={playerNames}
      pvpTimer={{
        secondsRemaining,
        faults: gameState.inactivityFaults ?? [0, 0],
      }}
    />
  );
}
