import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { GameState, PlayerIndex, DeckDefinition } from '../types/game';
import { createInitialState, buildDeck, endTurn } from '../engine/gameEngine';
import { useAuth } from '../lib/auth';
import { ArrowLeft, Radio, Loader2, Trophy, Home, Star } from 'lucide-react';
import GameBoard, { BoardCosmetics } from './GameBoard';
import CoinFlip from './CoinFlip';
import { getSavedDecks } from '../data/defaultDecks';
import { saveSecurePvpMatchResult, MatchResult } from '../lib/ranking';
import { saveMatchProgress } from '../lib/progression';

interface PvPGameBoardProps {
  roomId: string;
  onBack: () => void;
  cosmetics?: BoardCosmetics;
}

interface DeckRow {
  id: string;
  name: string;
  hero_id: string;
  core_cards: { cardId: string; count: number }[];
  neutral_cards: { cardId: string; count: number }[];
}

interface RoomPresence {
  status: string;
  player1_last_seen: string | null;
  player2_last_seen: string | null;
}

interface GameRoomRow {
  id: string;
  player1_id: string | null;
  player2_id: string | null;
  player1_deck_id: string | null;
  player2_deck_id: string | null;
  player1_last_seen: string | null;
  player2_last_seen: string | null;
  status: 'waiting' | 'active' | 'finished';
  game_state: GameState | null;
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

function formatPvpLogLine(line: string, playerNames: [string, string]) {
  return line
    .replace(/^Jogador\b/, playerNames[0])
    .replace(/^IA\b/, playerNames[1])
    .replace(/Jogador venceu!/g, `${playerNames[0]} venceu!`)
    .replace(/IA venceu!/g, `${playerNames[1]} venceu!`)
    .replace(/Partida iniciada! Jogador começa\./g, `Partida iniciada! ${playerNames[0]} começa.`)
    .replace(/Partida iniciada! IA começa\./g, `Partida iniciada! ${playerNames[1]} começa.`)
    .replace(/--- Turno (\d+) \(Jogador\) ---/g, `--- Turno $1 (${playerNames[0]}) ---`)
    .replace(/--- Turno (\d+) \(IA\) ---/g, `--- Turno $1 (${playerNames[1]}) ---`);
}

function formatPvpLog(state: GameState, playerNames: [string, string]): GameState {
  return {
    ...state,
    log: state.log.map(line => formatPvpLogLine(line, playerNames)),
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

export default function PvPGameBoard({ roomId, onBack, cosmetics }: PvPGameBoardProps) {
  const { user, refreshProfile } = useAuth();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerNumber, setPlayerNumber] = useState<number | null>(null);
  const [playerIds, setPlayerIds] = useState<[string, string] | null>(null);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [winner, setWinner] = useState<PlayerIndex | 'draw' | null>(null);
  const [playerNames, setPlayerNames] = useState<[string, string]>(['Jogador 1', 'Jogador 2']);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [roomPresence, setRoomPresence] = useState<RoomPresence | null>(null);
  const [savingMove, setSavingMove] = useState(false);
  const [opponentAbsentSeconds, setOpponentAbsentSeconds] = useState<number | null>(null);
  const [coinFlipComplete, setCoinFlipComplete] = useState(false);
  const disconnectProcessedRef = useRef(false);
  const processingTimeoutRef = useRef<string | null>(null);
  const savedMatchRef = useRef<string | null>(null);
  const latestGameStateRef = useRef<GameState | null>(null);
  const playerNamesRef = useRef<[string, string]>(['Jogador 1', 'Jogador 2']);

  useEffect(() => {
    latestGameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    playerNamesRef.current = playerNames;
    setGameState(currentState => currentState ? formatPvpLog(currentState, playerNames) : currentState);
  }, [playerNames]);

  useEffect(() => {
    if (!roomId || !user) return;

    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const applyGameState = (state: GameState) => {
      const namedState = formatPvpLog(state, playerNamesRef.current);
      const normalizedState: GameState = {
        ...namedState,
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

    const loadPlayerNames = async (room: GameRoomRow) => {
      if (!(room.player1_id && room.player2_id)) return;

      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', [room.player1_id, room.player2_id]);

      const p1 = data?.find(profile => profile.id === room.player1_id)?.username ?? 'Jogador 1';
      const p2 = data?.find(profile => profile.id === room.player2_id)?.username ?? 'Jogador 2';
      if (mounted) {
        playerNamesRef.current = [p1, p2];
        setPlayerNames([p1, p2]);
      }
    };

    const initializeGameIfHost = async (room: GameRoomRow) => {
      if (room.game_state) return;
      if (room.status !== 'active') return;
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
      const namedInitialState = formatPvpLog(initialGameState, playerNamesRef.current);

      const { data: updatedRoom } = await supabase
        .from('game_rooms')
        .update({ game_state: namedInitialState, status: 'active' })
        .eq('id', roomId)
        .eq('status', 'active')
        .is('game_state', null)
        .select('game_state')
        .maybeSingle();

      if (mounted) {
        applyGameState((updatedRoom?.game_state as GameState | null) ?? namedInitialState);
        setLoading(false);
      }
    };

    const handleRoom = async (room: GameRoomRow) => {
      if (!mounted) return;

      const myNumber = room.player1_id === user.id ? 0 : room.player2_id === user.id ? 1 : null;
      if (myNumber === null) {
        setError('Voce nao esta nesta sala.');
        setLoading(false);
        return;
      }

      setPlayerNumber(myNumber);
      setRoomPresence({
        status: room.status,
        player1_last_seen: room.player1_last_seen ?? null,
        player2_last_seen: room.player2_last_seen ?? null,
      });
      if (room.player1_id && room.player2_id) {
        setPlayerIds([room.player1_id, room.player2_id]);
      }
      setOpponentConnected(!!room.player1_id && !!room.player2_id);
      await loadPlayerNames(room);

      if (room.game_state) {
        applyGameState(room.game_state as GameState);
      } else if (room.status === 'active') {
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
      channel = supabase
        .channel(`room-${roomId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` },
          payload => {
            void handleRoom(payload.new as GameRoomRow);
          }
        )
        .subscribe();

      await fetchRoom();
      pollInterval = setInterval(fetchRoom, 3000);
    };

    init();

    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [roomId, user]);

  const handleGameEnd = useCallback((result: PlayerIndex | 'draw') => {
    setWinner(result);
  }, []);

  useEffect(() => {
    if (!roomId || playerNumber === null || gameState?.gameOver) return;

    const lastSeenColumn = playerNumber === 0 ? 'player1_last_seen' : 'player2_last_seen';
    const sendHeartbeat = async () => {
      await supabase
        .from('game_rooms')
        .update({ [lastSeenColumn]: new Date().toISOString() })
        .eq('id', roomId)
        .eq('status', 'active');
    };

    void sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 10000);
    return () => clearInterval(interval);
  }, [gameState?.gameOver, playerNumber, roomId]);

  useEffect(() => {
    if (!roomId || !gameState || gameState.gameOver || playerNumber === null || !roomPresence) return;
    if (roomPresence.status !== 'active') return;

    const opponentIndex = (1 - playerNumber) as PlayerIndex;
    const opponentSeen = opponentIndex === 0 ? roomPresence.player1_last_seen : roomPresence.player2_last_seen;
    if (!opponentSeen) return;

    const checkDisconnect = setInterval(() => {
      if (disconnectProcessedRef.current) return;
      const secondsSinceSeen = Math.floor((Date.now() - new Date(opponentSeen).getTime()) / 1000);
      if (secondsSinceSeen < 90) return;

      disconnectProcessedRef.current = true;
      const winnerIndex = playerNumber as PlayerIndex;
      const nextState: GameState = formatPvpLog({
        ...gameState,
        gameOver: true,
        winner: winnerIndex,
        pendingEffect: null,
        stateVersion: (gameState.stateVersion ?? 0) + 1,
        log: [
          ...gameState.log,
          `${playerNames[opponentIndex]} perdeu a conexao com a partida.`,
          `${playerNames[playerNumber]} venceu por desconexao do oponente.`,
        ],
      }, playerNamesRef.current);

      void (async () => {
        await supabase
          .from('game_rooms')
          .update({ game_state: nextState, status: 'finished' })
          .eq('id', roomId)
          .eq('status', 'active');

        setGameState(nextState);
        setWinner(winnerIndex);
      })();
    }, 5000);

    return () => clearInterval(checkDisconnect);
  }, [gameState, playerNames, playerNumber, roomId, roomPresence]);

  useEffect(() => {
    if (!user || !gameState?.gameOver || gameState.winner === null || playerNumber === null || !playerIds) return;
    const matchUid = `pvp-${roomId}`;
    if (savedMatchRef.current === matchUid) return;
    savedMatchRef.current = matchUid;

    const result: MatchResult = gameState.winner === 'draw'
      ? 'draw'
      : gameState.winner === playerNumber
      ? 'win'
      : 'loss';
    const opponentIndex = (1 - playerNumber) as PlayerIndex;
    const normalizedLog = gameState.log.join(' ').toLowerCase();
    const finishReason = normalizedLog.includes('desconex')
      ? 'disconnect'
      : normalizedLog.includes('inatividade')
      ? 'inactivity'
      : normalizedLog.includes('desist')
      ? 'surrender'
      : 'normal';

    void saveSecurePvpMatchResult({
      roomId,
      winnerId: gameState.winner === 'draw' ? null : playerIds[gameState.winner],
      finishReason,
      heroId: gameState.players[playerNumber].hero.cardId,
      opponentHeroId: gameState.players[opponentIndex].hero.cardId,
      turns: gameState.turnNumber,
      matchLog: gameState.log.map(line => formatPvpLogLine(line, playerNames)),
    })
      .then(({ error: secureError }) => {
        if (secureError) {
          setError(`Nao foi possivel registrar o resultado oficial: ${secureError}`);
          return null;
        }

        return saveMatchProgress({
        playerId: user.id,
        mode: 'pvp',
        result,
        stats: gameState.matchStats?.[playerNumber] ?? null,
        });
      })
      .then(() => refreshProfile());

    void supabase
      .from('game_rooms')
      .update({ status: 'finished', game_state: gameState })
      .eq('id', roomId)
      .eq('status', 'active');
  }, [gameState, playerIds, playerNames, playerNumber, refreshProfile, roomId, user]);

  const handleStateChange = useCallback(async (newState: GameState) => {
    if (!roomId) return;
    setSavingMove(true);
    const previousState = latestGameStateRef.current;
    const turnChanged = previousState && (
      previousState.currentPlayer !== newState.currentPlayer ||
      previousState.turnNumber !== newState.turnNumber
    );

    const stateToSave: GameState = formatPvpLog({
      ...newState,
      turnStartedAt: turnChanged ? Date.now() : (newState.turnStartedAt ?? previousState?.turnStartedAt ?? Date.now()),
      inactivityFaults: newState.inactivityFaults ?? previousState?.inactivityFaults ?? [0, 0],
      stateVersion: Math.max(previousState?.stateVersion ?? 0, newState.stateVersion ?? 0) + 1,
    }, playerNamesRef.current);

    latestGameStateRef.current = stateToSave;
    setGameState(stateToSave);

    const saveState = async () => supabase
      .from('game_rooms')
      .update({ game_state: stateToSave, status: stateToSave.gameOver ? 'finished' : 'active' })
      .eq('id', roomId)
      .eq('status', 'active')
      .select('id')
      .maybeSingle();

    let { error: updateError } = await saveState();
    if (updateError) {
      await new Promise(resolve => setTimeout(resolve, 800));
      ({ error: updateError } = await saveState());
    }

    if (updateError) {
      setError('Nao foi possivel salvar a jogada. Verifique a conexao e tente novamente.');
    }
    setSavingMove(false);
  }, [roomId]);

  const hasGameState = gameState !== null;
  const currentTurnPlayer = gameState?.currentPlayer;
  const currentTurnStartedAt = gameState?.turnStartedAt;
  const currentStateVersion = gameState?.stateVersion;

  useEffect(() => {
    if (!hasGameState) return;
    const startedAt = currentTurnStartedAt ?? Date.now();
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
    setSecondsRemaining(Math.max(0, 60 - elapsedSeconds));
    processingTimeoutRef.current = null;
  }, [hasGameState, currentTurnPlayer, currentTurnStartedAt, currentStateVersion]);

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
      nextState = formatPvpLog(nextState, playerNamesRef.current);

      void (async () => {
        const { error: updateError } = await supabase
          .from('game_rooms')
          .update({ game_state: nextState, status: nextState.gameOver ? 'finished' : 'active' })
          .eq('id', roomId)
          .eq('status', 'active');

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

  useEffect(() => {
    if (playerNumber === null || !roomPresence) {
      setOpponentAbsentSeconds(null);
      return;
    }

    const opponentIndex = (1 - playerNumber) as PlayerIndex;
    const opponentSeen = opponentIndex === 0 ? roomPresence.player1_last_seen : roomPresence.player2_last_seen;
    if (!opponentSeen) {
      setOpponentAbsentSeconds(null);
      return;
    }

    const updateAbsence = () => {
      setOpponentAbsentSeconds(Math.max(0, Math.floor((Date.now() - new Date(opponentSeen).getTime()) / 1000)));
    };

    updateAbsence();
    const interval = setInterval(updateAbsence, 1000);
    return () => clearInterval(interval);
  }, [playerNumber, roomPresence]);

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

  if (!coinFlipComplete && !gameState.gameOver) {
    return (
      <CoinFlip
        playerHeroName={playerNames[0]}
        aiHeroName={playerNames[1]}
        playerLabel="Jogador 1"
        opponentLabel="Jogador 2"
        predeterminedResult={gameState.currentPlayer}
        autoStart
        autoContinue
        spinDuration={900}
        onComplete={() => setCoinFlipComplete(true)}
      />
    );
  }

  if (winner !== null) {
    const won = winner !== 'draw' && winner === playerNumber;
    const resultTheme = winner === 'draw'
      ? {
          title: 'Empate!',
          subtitle: 'A partida terminou sem vencedor.',
          detail: 'Os dois jogadores chegaram ao fim juntos.',
          glow: 'from-slate-500/20 via-gray-500/10 to-slate-950',
          border: 'border-slate-500/40',
          badge: 'bg-slate-700/80 border-slate-500/50',
          titleColor: 'text-slate-200',
        }
      : won
      ? {
          title: 'Vitoria!',
          subtitle: `Voce venceu ${playerNames[1 - playerNumber]}.`,
          detail: 'A partida online foi concluida com sucesso.',
          glow: 'from-emerald-500/25 via-amber-500/10 to-slate-950',
          border: 'border-emerald-400/50',
          badge: 'bg-emerald-500/20 border-emerald-300/60',
          titleColor: 'text-emerald-300',
        }
      : {
          title: 'Derrota!',
          subtitle: `${playerNames[winner]} venceu a partida.`,
          detail: 'Volte ao menu para preparar a proxima batalha.',
          glow: 'from-rose-600/25 via-red-500/10 to-slate-950',
          border: 'border-rose-500/50',
          badge: 'bg-rose-500/20 border-rose-400/60',
          titleColor: 'text-rose-300',
        };

    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className={`relative overflow-hidden bg-slate-950 border ${resultTheme.border} rounded-2xl max-w-lg w-full text-center shadow-2xl`}>
          <div className={`absolute inset-0 bg-gradient-to-br ${resultTheme.glow}`} />
          <div className="absolute -top-16 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />

          <div className="relative px-7 py-8 sm:px-9">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 border ${resultTheme.badge} shadow-lg`}>
              <Trophy className={`w-10 h-10 ${winner === 'draw' ? 'text-slate-200' : won ? 'text-emerald-200' : 'text-rose-200'}`} />
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400 mb-3">
              <Star className="w-3.5 h-3.5" />
              PvP finalizado
              <Star className="w-3.5 h-3.5" />
            </div>

            <h2 className={`text-4xl sm:text-5xl font-black mb-3 ${resultTheme.titleColor}`}>
              {resultTheme.title}
            </h2>

            <p className="text-slate-200 text-base leading-relaxed max-w-sm mx-auto">
              {resultTheme.subtitle}
            </p>

            <div className="mt-6 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
              {resultTheme.detail}
            </div>

            <button
              onClick={onBack}
              className="mt-7 w-full sm:w-auto px-6 py-3.5 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors mx-auto"
            >
              <Home className="w-4 h-4" />
              Voltar ao menu
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
      pvpConnection={{
        saving: savingMove,
        opponentAbsentSeconds,
        connected: opponentAbsentSeconds === null || opponentAbsentSeconds < 25,
      }}
      cosmetics={cosmetics}
    />
  );
}
