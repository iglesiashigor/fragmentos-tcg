import { useEffect, useState, useCallback } from 'react';
import { DeckDefinition, GameState, PlayerIndex } from './types/game';
import { createInitialState, buildDeck } from './engine/gameEngine';
import { getCardById } from './data/cards';
import { getSavedDecks } from './data/defaultDecks';
import { AuthProvider, useAuth } from './lib/authContext';
import { useDecks } from './hooks/useDecks';
import MainMenu from './components/MainMenuLobby';
import DeckBuilder from './components/DeckBuilder';
import CollectionViewer from './components/CollectionViewer';
import GameBoard, { BoardCosmetics } from './components/GameBoard';
import GameOver from './components/GameOver';
import CoinFlip from './components/CoinFlip';
import AuthModal from './components/AuthModal';
import MatchmakingScreen from './components/MatchmakingScreen';
import PvPGameBoard from './components/PvPGameBoard';
import PlayerProfile from './components/PlayerProfile';
import { savePlayerMatchResult } from './lib/ranking';
import { fetchPlayerProgress, PlayerProgress, saveMatchProgress } from './lib/progression';

type Screen = 'menu' | 'deckBuilder' | 'collection' | 'coinFlip' | 'game' | 'gameOver' | 'matchmaking' | 'pvpGame' | 'profile';

function AppContent() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [editingDeck, setEditingDeck] = useState<DeckDefinition | undefined>(undefined);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [winner, setWinner] = useState<PlayerIndex | 'draw' | null>(null);
  const [lastPlayerDeck, setLastPlayerDeck] = useState<DeckDefinition | null>(null);
  const [lastAIDeck, setLastAIDeck] = useState<DeckDefinition | null>(null);
  const [pendingDecks, setPendingDecks] = useState<{ player: DeckDefinition; ai: DeckDefinition } | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [gameMode, setGameMode] = useState<'ai' | 'pvp'>('ai');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [boardCosmetics, setBoardCosmetics] = useState<BoardCosmetics>({ cardFrame: 'default', playmat: 'default' });

  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const { decks, loading: decksLoading, saveDbDeck, deleteDbDeck, refreshDecks } = useDecks();

  const allDecks = user ? decks : getSavedDecks();

  useEffect(() => {
    if (!user) {
      setBoardCosmetics({ cardFrame: 'default', playmat: 'default' });
      return;
    }

    let mounted = true;
    void fetchPlayerProgress(user.id, user.email).then(result => {
      if (!mounted) return;
      setBoardCosmetics({
        cardFrame: result.data?.equipped_card_frame ?? 'default',
        playmat: result.data?.equipped_playmat ?? 'default',
      });
    });

    return () => {
      mounted = false;
    };
  }, [user]);

  const handleProgressChange = useCallback((progress: PlayerProgress) => {
    setBoardCosmetics({
      cardFrame: progress.equipped_card_frame ?? 'default',
      playmat: progress.equipped_playmat ?? 'default',
    });
  }, []);

  const handleStartGame = useCallback((playerDeck: DeckDefinition, aiDeck: DeckDefinition) => {
    setPendingDecks({ player: playerDeck, ai: aiDeck });
    setLastPlayerDeck(playerDeck);
    setLastAIDeck(aiDeck);
    setWinner(null);
    setGameMode('ai');
    setScreen('coinFlip');
  }, []);

  const handleStartPvp = useCallback(() => {
    setGameMode('pvp');
    setScreen('matchmaking');
  }, []);

  const handleStartPvpGame = useCallback((rid: string) => {
    setRoomId(rid);
    setScreen('pvpGame');
  }, []);

  const handleCoinFlipComplete = useCallback((firstPlayer: PlayerIndex) => {
    if (!pendingDecks) return;
    const playerDeck = pendingDecks.player;
    const aiDeck = pendingDecks.ai;
    const playerHeroId = playerDeck.heroId;
    const aiHeroId = aiDeck.heroId;

    const playerCards = buildDeck(playerHeroId, playerDeck.coreCards, playerDeck.neutralCards);
    const aiCards = buildDeck(aiHeroId, aiDeck.coreCards, aiDeck.neutralCards);

    const state = createInitialState(playerHeroId, playerCards, aiHeroId, aiCards, firstPlayer);
    setGameState(state);
    setPendingDecks(null);
    setScreen('game');
  }, [pendingDecks]);

  const handleGameEnd = useCallback((w: PlayerIndex | 'draw', finalState?: GameState) => {
    const stateToSave = finalState ?? gameState;
    if (user && stateToSave) {
      const result = w === 'draw' ? 'draw' : w === 0 ? 'win' : 'loss';
      void savePlayerMatchResult({
        matchUid: `ai-${user.id}-${Date.now()}`,
        playerId: user.id,
        opponentName: 'IA',
        mode: 'ai',
        result,
        heroId: stateToSave.players[0].hero.cardId,
        opponentHeroId: stateToSave.players[1].hero.cardId,
        turns: stateToSave.turnNumber,
      })
        .then(() => saveMatchProgress({
          playerId: user.id,
          mode: 'ai',
          result,
          stats: stateToSave.matchStats?.[0] ?? null,
        }))
        .then(() => refreshProfile());
    }
    setWinner(w);
    setScreen('gameOver');
  }, [gameState, refreshProfile, user]);

  const handlePlayAgain = useCallback(() => {
    if (lastPlayerDeck && lastAIDeck) {
      handleStartGame(lastPlayerDeck, lastAIDeck);
    } else {
      setScreen('menu');
    }
  }, [lastPlayerDeck, lastAIDeck, handleStartGame]);

  const handleOpenDeckBuilder = useCallback((deck?: DeckDefinition) => {
    setEditingDeck(deck);
    setScreen('deckBuilder');
  }, []);

  const handleSaveDeck = useCallback(async (deck: DeckDefinition) => {
    if (user) {
      const result = await saveDbDeck(deck);
      return result;
    }
    setShowAuth(true);
    return { error: 'Faça login para salvar baralhos na nuvem.' };
  }, [user, saveDbDeck]);

  const handleDeleteDeck = useCallback(async (deckId: string) => {
    if (user) {
      await deleteDbDeck(deckId);
    }
  }, [user, deleteDbDeck]);

  return (
    <>
      {authLoading ? (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">Carregando...</span>
          </div>
        </div>
      ) : (
        <>
          {screen === 'menu' && (
        <MainMenu
          onStartGame={handleStartGame}
          onStartPvp={handleStartPvp}
          onOpenDeckBuilder={handleOpenDeckBuilder}
          onOpenCollection={() => setScreen('collection')}
          onOpenProfile={() => setScreen('profile')}
          onShowAuth={() => setShowAuth(true)}
          decks={allDecks}
          decksLoading={decksLoading}
          user={user}
          profile={profile}
          onDeleteDeck={handleDeleteDeck}
          onRefreshDecks={refreshDecks}
        />
      )}
      {screen === 'deckBuilder' && (
        <DeckBuilder
          initialDeck={editingDeck}
          onSave={handleSaveDeck}
          onBack={() => { setScreen('menu'); setEditingDeck(undefined); }}
        />
      )}
      {screen === 'collection' && (
        <CollectionViewer onBack={() => setScreen('menu')} />
      )}
      {screen === 'profile' && (
        <PlayerProfile
          onBack={() => setScreen('menu')}
          onShowAuth={() => setShowAuth(true)}
          onProgressChange={handleProgressChange}
        />
      )}
      {screen === 'matchmaking' && (
        <MatchmakingScreen
          onBack={() => setScreen('menu')}
          onGameStart={handleStartPvpGame}
          user={user}
          decks={decks}
          onShowAuth={() => setShowAuth(true)}
        />
      )}
      {screen === 'coinFlip' && pendingDecks && (
        <CoinFlip
          playerHeroName={getCardById(pendingDecks.player.heroId)?.name ?? 'Jogador'}
          aiHeroName={getCardById(pendingDecks.ai.heroId)?.name ?? 'Inimigo'}
          onComplete={handleCoinFlipComplete}
        />
      )}
      {screen === 'game' && gameState && (
        <>
          <GameBoard
            initialState={gameState}
            onGameEnd={handleGameEnd}
            playerNames={[profile?.username ?? 'Você', 'IA']}
            cosmetics={boardCosmetics}
          />
          {winner !== null && (
            <GameOver
              winner={winner}
              onPlayAgain={handlePlayAgain}
              onMainMenu={() => setScreen('menu')}
            />
          )}
        </>
      )}
      {screen === 'gameOver' && winner !== null && (
        <GameOver
          winner={winner}
          onPlayAgain={handlePlayAgain}
          onMainMenu={() => setScreen('menu')}
        />
      )}
      {screen === 'pvpGame' && roomId && (
        <PvPGameBoard
          roomId={roomId}
          onBack={() => { setScreen('menu'); setRoomId(null); }}
          cosmetics={boardCosmetics}
        />
      )}
          <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
        </>
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
