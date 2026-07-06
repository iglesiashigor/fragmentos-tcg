import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { GameState } from '../types/game';

interface PvPGameState {
  gameState: GameState | null;
  roomId: string | null;
  playerNumber: number | null;
  opponentConnected: boolean;
  gameStarted: boolean;
  loading: boolean;
  error: string | null;
}

export function usePvPGame(roomId: string | null, userId: string | null) {
  const [state, setState] = useState<PvPGameState>({
    gameState: null,
    roomId: null,
    playerNumber: null,
    opponentConnected: false,
    gameStarted: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!roomId || !userId) return;

    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      try {
        // Fetch room data
        const { data: room, error: roomError } = await supabase
          .from('game_rooms')
          .select('*')
          .eq('id', roomId)
          .single();

        if (roomError || !room) {
          if (mounted) setState(s => ({ ...s, loading: false, error: 'Sala não encontrada.' }));
          return;
        }

        // Determine player number
        const isPlayer1 = room.player1_id === userId;
        const isPlayer2 = room.player2_id === userId;
        const playerNumber = isPlayer1 ? 0 : isPlayer2 ? 1 : null;

        if (playerNumber === null) {
          if (mounted) setState(s => ({ ...s, loading: false, error: 'Você não está nesta sala.' }));
          return;
        }

        const opponentConnected = !!room.player1_id && !!room.player2_id;
        const gameStarted = room.status === 'active';

        let gameState: GameState | null = null;
        if (room.game_state) {
          gameState = room.game_state as GameState;
        }

        if (mounted) {
          setState({
            gameState,
            roomId,
            playerNumber,
            opponentConnected,
            gameStarted,
            loading: false,
            error: null,
          });
        }

        // Subscribe to room changes
        channel = supabase
          .channel(`room-${roomId}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` },
            (payload) => {
              if (!mounted) return;
              const newRoom = payload.new as any;
              const oppConnected = !!newRoom.player1_id && !!newRoom.player2_id;
              const started = newRoom.status === 'active';
              setState(s => ({
                ...s,
                gameState: newRoom.game_state as GameState ?? s.gameState,
                opponentConnected: oppConnected,
                gameStarted: started,
              }));
            }
          )
          .subscribe();
      } catch (e) {
        if (mounted) setState(s => ({ ...s, loading: false, error: 'Erro ao conectar.' }));
      }
    };

    init();

    return () => {
      mounted = false;
      if (channel) channel.unsubscribe();
    };
  }, [roomId, userId]);

  const updateGameState = useCallback(async (newState: GameState) => {
    if (!roomId) return;
    await supabase
      .from('game_rooms')
      .update({ game_state: newState })
      .eq('id', roomId);
  }, [roomId]);

  return { ...state, updateGameState };
}
