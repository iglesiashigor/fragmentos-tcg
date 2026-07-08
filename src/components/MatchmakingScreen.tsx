import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { DeckDefinition } from '../types/game';
import { useAuth } from '../lib/authContext';
import { useDecks } from '../hooks/useDecks';
import {
  ArrowLeft, Plus, Clock, Users, Sword, Shield, LogIn, Trash2,
  Globe, Radio, X, CheckCircle, Loader2
} from 'lucide-react';

interface GameRoom {
  id: string;
  player1_id: string;
  player1_ready: boolean;
  player2_id: string | null;
  player2_ready: boolean;
  status: string;
  player1_deck_id: string | null;
  player2_deck_id: string | null;
  created_at: string;
  updated_at?: string;
  player1_last_seen?: string | null;
  player2_last_seen?: string | null;
  host_username?: string;
}

interface MatchmakingScreenProps {
  onBack: () => void;
  onGameStart: (roomId: string) => void;
  user: ReturnType<typeof useAuth>['user'];
  decks: DeckDefinition[];
  onShowAuth: () => void;
}

export default function MatchmakingScreen({ onBack, onGameStart, user, decks, onShowAuth }: MatchmakingScreenProps) {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<string>('');
  const [myRoom, setMyRoom] = useState<string | null>(null);
  const [roomDetail, setRoomDetail] = useState<GameRoom | null>(null);
  const [error, setError] = useState('');
  const [inQueue, setInQueue] = useState(false);
  const { signOut } = useAuth();
  const { decks: dbDecks } = useDecks();
  const allDecks = user ? dbDecks : decks;
  const staleWaitingCutoff = () => new Date(Date.now() - 10 * 60 * 1000).toISOString();

  useEffect(() => {
    if (allDecks.length > 0 && !selectedDeck) {
      setSelectedDeck(allDecks[0].id);
    }
  }, [allDecks, selectedDeck]);

  const fetchRooms = useCallback(async () => {
    if (user) {
      await supabase
        .from('game_rooms')
        .delete()
        .eq('status', 'waiting')
        .is('player2_id', null)
        .eq('player1_id', user.id)
        .lt('created_at', staleWaitingCutoff());
    }

    const { data, error } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('status', 'waiting')
      .is('player2_id', null)
      .gte('created_at', staleWaitingCutoff())
      .order('created_at', { ascending: false });
    if (!error && data) {
      setRooms(data);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 10000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  useEffect(() => {
    if (!myRoom) return;
    const checkRoom = async () => {
      const { data } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', myRoom)
        .maybeSingle();
      if (data) {
        const room = data as GameRoom;
        setRoomDetail(room);
        if (room.status === 'active') {
          onGameStart(room.id);
        }
      }
    };
    const sub = supabase
      .channel(`room-${myRoom}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_rooms', filter: `id=eq.${myRoom}` },
        (payload) => {
          const room = payload.new as GameRoom;
          setRoomDetail(room);
          if (room.status === 'active') {
            onGameStart(room.id);
          }
        }
      )
      .subscribe();
    void checkRoom();
    const interval = setInterval(checkRoom, 3000);
    return () => {
      clearInterval(interval);
      void supabase.removeChannel(sub);
    };
  }, [myRoom, onGameStart]);

  const createRoom = async () => {
    if (!user) { onShowAuth(); return; }
    if (!selectedDeck) { setError('Selecione um baralho.'); return; }
    setCreating(true);
    setError('');

    const { data: existingRoom } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('player1_id', user.id)
      .eq('status', 'waiting')
      .is('player2_id', null)
      .gte('created_at', staleWaitingCutoff())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRoom) {
      setMyRoom(existingRoom.id);
      setRoomDetail(existingRoom as GameRoom);
      setCreating(false);
      return;
    }

    const { data, error } = await supabase
      .from('game_rooms')
      .insert({
        player1_id: user.id,
        player1_deck_id: selectedDeck,
        player2_id: null,
        player2_deck_id: null,
        player1_ready: true,
        status: 'waiting',
        player1_last_seen: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) {
      setError(error.message);
    } else if (data) {
      setMyRoom(data.id);
      setRoomDetail(data);
      fetchRooms();
    }
    setCreating(false);
  };

  const joinRoom = async (roomId: string, startImmediately = true) => {
    if (!user) { onShowAuth(); return; }
    if (!selectedDeck) { setError('Selecione um baralho.'); return; }
    setError('');
    const { data, error } = await supabase
      .from('game_rooms')
      .update({
        player2_id: user.id,
        player2_deck_id: selectedDeck,
        player2_ready: true,
        status: 'active',
        player2_last_seen: new Date().toISOString(),
      })
      .eq('id', roomId)
      .eq('status', 'waiting')
      .is('player2_id', null)
      .neq('player1_id', user.id)
      .gte('created_at', staleWaitingCutoff())
      .select('id')
      .maybeSingle();
    if (error) {
      setError(error.message);
      return false;
    }
    if (!data) {
      setError('Essa sala ja foi preenchida. Tente buscar novamente.');
      fetchRooms();
      return false;
    }

    setMyRoom(roomId);
    if (startImmediately) onGameStart(roomId);
    fetchRooms();
    return true;
  };

  const deleteRoom = async (roomId: string) => {
    const { error } = await supabase
      .from('game_rooms')
      .delete()
      .eq('id', roomId);
    if (!error) {
      setMyRoom(null);
      setRoomDetail(null);
      fetchRooms();
    }
  };

  const handleBack = async () => {
    if (roomDetail?.status === 'waiting') {
      await deleteRoom(roomDetail.id);
    }
    onBack();
  };

  const joinQueue = async () => {
    if (!user) { onShowAuth(); return; }
    if (!selectedDeck) { setError('Selecione um baralho.'); return; }
    setError('');
    setInQueue(true);

    const { data: waitingRoom, error: roomError } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('status', 'waiting')
      .is('player2_id', null)
      .neq('player1_id', user.id)
      .gte('created_at', staleWaitingCutoff())
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (roomError) {
      setError(roomError.message);
      setInQueue(false);
      return;
    }

    if (waitingRoom) {
      const joined = await joinRoom(waitingRoom.id);
      setInQueue(false);
      if (!joined) void fetchRooms();
      return;
    }

    const { data: createdRoom, error: createError } = await supabase
      .from('game_rooms')
      .insert({
        player1_id: user.id,
        player1_deck_id: selectedDeck,
        player2_id: null,
        player2_deck_id: null,
        player1_ready: true,
        status: 'waiting',
        player1_last_seen: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (createError) {
      setError(createError.message);
    } else if (createdRoom) {
      setMyRoom(createdRoom.id);
      setRoomDetail(createdRoom);
      void fetchRooms();
    }

    setInQueue(false);
  };

  const cancelQueue = async () => {
    if (myRoom) {
      await deleteRoom(myRoom);
    }
    setInQueue(false);
  };

  if (roomDetail) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto mb-4">
            <Radio className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {roomDetail.status === 'waiting' ? 'Aguardando Oponente...' : 'Partida Iniciada!'}
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            {roomDetail.status === 'waiting'
              ? 'Sala criada. Aguardando alguém entrar.'
              : 'Ambos os jogadores estão prontos!'
            }
          </p>
          <div className="bg-gray-800 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm flex items-center gap-2">
                <Sword className="w-4 h-4 text-amber-400" /> Host
              </span>
              <span className="text-white text-sm">{roomDetail.player1_ready ? 'Pronto' : 'Esperando'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" /> Convidado
              </span>
              <span className="text-white text-sm">
                {roomDetail.player2_id ? (roomDetail.player2_ready ? 'Pronto' : 'Entrou') : 'Aguardando...'}
              </span>
            </div>
          </div>
          {roomDetail.status === 'waiting' && (
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => deleteRoom(roomDetail.id)}
                className="px-5 py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          )}
          <button
            onClick={handleBack}
            className="mt-4 text-gray-500 hover:text-white text-sm transition-colors flex items-center gap-1 mx-auto"
          >
            <ArrowLeft className="w-3 h-3" />
            Voltar ao Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <button onClick={handleBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-amber-400" />
          <span className="text-white font-semibold text-sm">Online</span>
        </div>
        {user && (
          <button onClick={() => signOut()} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
            Sair
          </button>
        )}
      </div>

      <div className="max-w-3xl mx-auto w-full px-4 py-6">
        {/* Deck selection */}
        <div className="mb-6">
          <h3 className="text-gray-400 text-xs uppercase font-semibold mb-2 flex items-center gap-2">
            <Sword className="w-3 h-3" />
            Selecione seu Baralho
          </h3>
          <div className="flex gap-2 flex-wrap">
            {allDecks.map(deck => (
              <button
                key={deck.id}
                onClick={() => setSelectedDeck(deck.id)}
                className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                  selectedDeck === deck.id
                    ? 'bg-amber-900/30 border-amber-500 text-amber-300'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600'
                }`}
              >
                {deck.name}
              </button>
            ))}
            {allDecks.length === 0 && (
              <p className="text-gray-500 text-sm">Nenhum baralho. Crie um primeiro no menu principal.</p>
            )}
          </div>
        </div>

        {/* Matchmaking buttons */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
            <Radio className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <h3 className="text-white font-bold mb-1">Matchmaking Automático</h3>
            <p className="text-gray-400 text-xs mb-4">Encontramos um oponente para você.</p>
            {inQueue ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-center gap-2 text-amber-300 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Buscando oponente...
                </div>
                <button
                  onClick={cancelQueue}
                  className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={joinQueue}
                disabled={!selectedDeck}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-800 text-white rounded-lg text-sm font-semibold transition-colors w-full"
              >
                Buscar Partida
              </button>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
            <Users className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <h3 className="text-white font-bold mb-1">Criar Sala</h3>
            <p className="text-gray-400 text-xs mb-4">Crie uma sala e aguarde alguém entrar.</p>
            <button
              onClick={createRoom}
              disabled={creating || !selectedDeck}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white rounded-lg text-sm font-semibold transition-colors w-full flex items-center justify-center gap-2"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Criar Sala
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {/* Rooms list */}
        <div>
          <h3 className="text-gray-400 text-xs uppercase font-semibold mb-3 flex items-center gap-2">
            <Users className="w-3 h-3" />
            Salas Disponíveis ({rooms.length})
          </h3>
          {loading ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Carregando...
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-sm">
              Nenhuma sala aberta. Crie uma ou use o matchmaking automático.
            </div>
          ) : (
            <div className="space-y-2">
              {rooms.map(room => (
                <div
                  key={room.id}
                  className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3 hover:border-gray-600 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-amber-900/30 border border-amber-700/30 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">Sala de {room.host_username ?? 'Jogador'}</div>
                    <div className="text-gray-500 text-xs flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(room.created_at).toLocaleTimeString()}
                      </span>
                      <span className={room.player1_ready ? 'text-green-400' : 'text-gray-500'}>
                        {room.player1_ready ? 'Host pronto' : 'Host esperando'}
                      </span>
                    </div>
                  </div>
                  {room.player1_id === user?.id ? (
                    <button
                      onClick={() => deleteRoom(room.id)}
                      className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Fechar
                    </button>
                  ) : (
                    <button
                      onClick={() => joinRoom(room.id)}
                      className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded-lg transition-colors flex items-center gap-1"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Entrar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
