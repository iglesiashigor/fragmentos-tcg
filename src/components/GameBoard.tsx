import React, { useState, useEffect, useRef } from 'react';
import {
  GameState, PlayerIndex, BattleCard, CardDefinition,
} from '../types/game';
import {
  playUnit, playTerrain, playSpell, attachEquipment, attachMount,
  resolveAttack, endTurn, getValidAttackTargets,
  canAttack, getUnitSlots, applyConditionToTarget,
  healTarget, resolveRecoverFromDiscard,
  activateAbility, getAttackDamage,
} from '../engine/gameEngine';
import { runAITurn } from '../engine/aiEngine';
import CardDisplay from './CardDisplay';
import CardInspector from './CardInspector';
import GameLog from './GameLog';
import {
  Sword, Star, ChevronRight,
  Trash2, Hand, Layers, Eye, Zap, Shield,
  Flag,
} from 'lucide-react';

interface GameBoardProps {
  initialState: GameState;
  onGameEnd: (winner: PlayerIndex | 'draw') => void;
  isPvP?: boolean;
  onStateChange?: (state: GameState) => void;
  myPlayerIndex?: PlayerIndex;
}

type SelectionMode =
  | 'none'
  | 'selectAttacker'
  | 'selectAttackTarget'
  | 'selectSpellTarget'
  | 'selectEquipTarget'
  | 'selectMountTarget'
  | 'selectAllyForEffect'
  | 'selectDiscardCard';

export default function GameBoard({ initialState, onGameEnd, isPvP, onStateChange, myPlayerIndex = 0 }: GameBoardProps) {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [, setSelectedCard] = useState<CardDefinition | BattleCard | null>(null);
  const [inspectedCard, setInspectedCard] = useState<CardDefinition | BattleCard | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('none');
  const [selectedAttackers, setSelectedAttackers] = useState<string[]>([]);
  const [pendingSpell, setPendingSpell] = useState<CardDefinition | null>(null);
  const [pendingEquip, setPendingEquip] = useState<CardDefinition | null>(null);
  const [pendingMount, setPendingMount] = useState<CardDefinition | null>(null);
  const [pendingEffectCard, setPendingEffectCard] = useState<{ card: CardDefinition | BattleCard; eff: any } | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [validTargets, setValidTargets] = useState<string[]>([]);
  const [gameMessage, setGameMessage] = useState('');
  const skipNextSync = useRef(false);

  // Sync from external state changes (PvP: opponent moves pushed from Supabase)
  useEffect(() => {
    if (isPvP) {
      setGameState(prev => {
        // Only update if the external state is newer (different turn or player)
        if (prev.turnNumber !== initialState.turnNumber || prev.currentPlayer !== initialState.currentPlayer || prev.phase !== initialState.phase) {
          skipNextSync.current = true;
          return initialState;
        }
        return prev;
      });
    }
  }, [initialState, isPvP]);

  const myIdx = myPlayerIndex;
  const oppIdx: PlayerIndex = myIdx === 0 ? 1 : 0;
  const player = gameState.players[myIdx];
  const ai = gameState.players[oppIdx];
  const isPlayerTurn = gameState.currentPlayer === myIdx;
  const isMainPhase = gameState.phase === 'main';
  const isAttackPhase = gameState.phase === 'attack';

  useEffect(() => {
    if (gameState.gameOver && gameState.winner !== null) {
      setTimeout(() => onGameEnd(gameState.winner!), 500);
    }
  }, [gameState.gameOver]);

  // AI turn only for single-player mode (opponent = AI)
  useEffect(() => {
    if (isPvP || gameState.currentPlayer !== oppIdx || gameState.gameOver) return;
    setAiThinking(true);
    const timer = setTimeout(() => {
      let s = gameState;
      s = runAITurn(s, (intermediate) => {
        setGameState({ ...intermediate });
      });
      setGameState(s);
      setAiThinking(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [gameState.currentPlayer, gameState.gameOver, isPvP]);

  // Sync state changes to PvP server
  useEffect(() => {
    if (isPvP && onStateChange) {
      if (skipNextSync.current) {
        skipNextSync.current = false;
        return;
      }
      onStateChange(gameState);
    }
  }, [gameState, isPvP, onStateChange]);

  const handleEndTurn = () => {
    if (!isPlayerTurn || gameState.gameOver) return;
    resetSelections();
    const s = endTurn(gameState);
    setGameState(s);
  };
  const myLabel = isPvP ? 'Você' : 'IA';

  const handleDeclareAttackPhase = () => {
    if (!isPlayerTurn || gameState.gameOver) return;
    setGameState(s => ({ ...s, phase: 'attack' }));
    setSelectionMode('selectAttacker');
    setSelectedAttackers([]);
    setValidTargets([]);
  };

  const resetSelections = () => {
    setSelectionMode('none');
    setSelectedAttackers([]);
    setValidTargets([]);
    setPendingSpell(null);
    setPendingEquip(null);
    setPendingMount(null);
    setPendingEffectCard(null);
    setSelectedCard(null);
    setGameMessage('');
  };

  const handleCardFromHand = (card: CardDefinition) => {
    if (!isPlayerTurn || gameState.gameOver) return;
    if (isAttackPhase) {
      setGameMessage('Não é possível jogar cartas na fase de ataque!');
      return;
    }

    if (card.type === 'unit') {
      if (player.mana < card.manaCost) { setGameMessage('Mana insuficiente!'); return; }
      if (player.units.length >= getUnitSlots(player)) { setGameMessage('Sem espaço para unidades!'); return; }
      const s = playUnit(gameState, myIdx, card);
      setGameState(s);
      handlePendingEffectFromState(s);
    } else if (card.type === 'terrain') {
      if (player.mana < card.manaCost) { setGameMessage('Mana insuficiente!'); return; }
      const s = playTerrain(gameState, myIdx, card);
      setGameState(s);
    } else if (card.type === 'spell') {
      if (player.mana < card.manaCost) { setGameMessage('Mana insuficiente!'); return; }
      const needsTarget = card.effects.some(e =>
        ['damage', 'heal', 'applyCondition', 'attackAgain', 'bonusAttackPerDamageTaken', 'removeCondition', 'attackBonus'].includes(e.type) &&
        (e.target === 'anyUnit' || e.target === 'ally' || e.target === 'enemy')
      );
      const needsDiscard = card.effects.some(e => e.type === 'recoverFromDiscard');
      if (needsDiscard) {
        const s = playSpell(gameState, myIdx, card);
        setGameState(s);
        handlePendingEffectFromState(s);
        return;
      }
      if (needsTarget) {
        const isDamageOrDebuff = card.effects.some(e => e.type === 'damage' || (e.type === 'applyCondition' && e.target === 'anyUnit'));
        const isAllyOnly = card.effects.some(e => e.target === 'ally');
        setPendingSpell(card);
        if (isDamageOrDebuff && !isAllyOnly) {
          // Can target any unit or hero
          setValidTargets([
            ai.hero.instanceId,
            ...ai.units.map(u => u.instanceId),
            ...player.units.map(u => u.instanceId),
            player.hero.instanceId,
          ]);
          setSelectionMode('selectSpellTarget');
        } else {
          // Ally-only targeting (heals, buffs, removeCondition)
          setValidTargets([player.hero.instanceId, ...player.units.map(u => u.instanceId)]);
          setSelectionMode('selectSpellTarget');
        }
        return;
      }
      const s = playSpell(gameState, myIdx, card);
      setGameState(s);
      handlePendingEffectFromState(s);
    } else if (card.type === 'equipment') {
      if (player.mana < card.manaCost) { setGameMessage('Mana insuficiente!'); return; }
      // Filter out units that already have equipment
      const validEquipTargets = [
        ...(player.hero.equipment ? [] : [player.hero.instanceId]),
        ...(card.heroOnly ? [] : player.units.filter(u => !u.equipment).map(u => u.instanceId))
      ];
      if (validEquipTargets.length === 0) {
        setGameMessage('Todas as unidades já possuem equipamento!');
        return;
      }
      setPendingEquip(card);
      setValidTargets(validEquipTargets);
      setSelectionMode('selectEquipTarget');
    } else if (card.type === 'mount') {
      if (player.mana < card.manaCost) { setGameMessage('Mana insuficiente!'); return; }
      // Filter out units that already have mounts
      const validMountTargets = [
        ...(player.hero.mount ? [] : [player.hero.instanceId]),
        ...(card.heroOnly ? [] : player.units.filter(u => !u.mount).map(u => u.instanceId))
      ];
      if (validMountTargets.length === 0) {
        setGameMessage('Todas as unidades já possuem montaria!');
        return;
      }
      setPendingMount(card);
      setValidTargets(validMountTargets);
      setSelectionMode('selectMountTarget');
    }
  };

  const handlePendingEffectFromState = (s: GameState) => {
    if (s.pendingEffect) {
      const pe = s.pendingEffect;
      if (pe.type === 'selectAllyUnit') {
        setValidTargets(s.players[myIdx].units.map(u => u.instanceId));
        setPendingEffectCard({ card: pe.sourceCard!, eff: pe.effect });
        setSelectionMode('selectAllyForEffect');
      } else if (pe.type === 'selectTarget' && pe.effect?.type === 'recoverFromDiscard') {
        setPendingEffectCard({ card: pe.sourceCard!, eff: pe.effect });
        setSelectionMode('selectDiscardCard');
      }
    }
  };

  const handleBattleCardClick = (card: BattleCard, owner: PlayerIndex) => {
    if (gameState.gameOver) return;

    if (selectionMode === 'selectSpellTarget' && validTargets.includes(card.instanceId)) {
      if (pendingSpell) {
        const s = playSpell(gameState, myIdx, pendingSpell, card.instanceId);
        setGameState(s);
        handlePendingEffectFromState(s);
        resetSelections();
      }
      return;
    }

    if (selectionMode === 'selectEquipTarget' && validTargets.includes(card.instanceId) && pendingEquip) {
      const s = attachEquipment(gameState, myIdx, pendingEquip, card.instanceId);
      setGameState(s);
      if (s.log[gameState.log.length]?.includes('já possui')) {
        setGameMessage('Alvo já possui equipamento!');
      }
      resetSelections();
      return;
    }

    if (selectionMode === 'selectMountTarget' && validTargets.includes(card.instanceId) && pendingMount) {
      const s = attachMount(gameState, myIdx, pendingMount, card.instanceId);
      setGameState(s);
      if (s.log[gameState.log.length]?.includes('já possui')) {
        setGameMessage('Alvo já possui montaria!');
      }
      resetSelections();
      return;
    }

    if (selectionMode === 'selectAllyForEffect' && validTargets.includes(card.instanceId) && pendingEffectCard) {
      const eff = pendingEffectCard.eff;
      let s: GameState = { ...gameState, pendingEffect: null };
      if (eff.type === 'applyCondition' && eff.condition) {
        s = applyConditionToTarget(s, card.instanceId, eff.condition);
      } else if (eff.type === 'heal') {
        s = healTarget(s, card.instanceId, eff.value ?? 0, myIdx);
      } else if (eff.type === 'attackBonus') {
        const newUnits = s.players[myIdx].units.map(u =>
          u.instanceId === card.instanceId ? { ...u, currentAttack: u.currentAttack + (eff.value ?? 0) } : u
        );
        const newPlayers = [...s.players] as typeof s.players;
        newPlayers[myIdx] = { ...s.players[myIdx], units: newUnits };
        s = { ...s, players: newPlayers };
      } else if (eff.type === 'attackAgain' || eff.type === 'bonusAttackPerDamageTaken') {
        const damage = eff.type === 'bonusAttackPerDamageTaken'
          ? card.maxHealth - card.currentHealth
          : 0;
        const newUnits = s.players[myIdx].units.map(u =>
          u.instanceId === card.instanceId ? { ...u, exhausted: false, currentAttack: u.currentAttack + damage } : u
        );
        const newPlayers = [...s.players] as typeof s.players;
        newPlayers[myIdx] = { ...s.players[myIdx], units: newUnits };
        s = { ...s, players: newPlayers };
      }
      setGameState(s);
      resetSelections();
      return;
    }

    if (selectionMode === 'selectAttacker' && owner === myIdx) {
      const canAtk = canAttack(card, gameState.firstPlayerCannotAttack && gameState.turnNumber === 1 && gameState.currentPlayer === myIdx);
      if (!canAtk) { setGameMessage(`${card.name} não pode atacar!`); return; }
      if (selectedAttackers.includes(card.instanceId)) {
        setSelectedAttackers(a => a.filter(id => id !== card.instanceId));
      } else {
        setSelectedAttackers(a => [...a, card.instanceId]);
      }
      return;
    }

    if (selectionMode === 'selectAttackTarget' && owner === oppIdx) {
      if (!validTargets.includes(card.instanceId)) { setGameMessage('Alvo inválido!'); return; }
      const s = resolveAttack(gameState, myIdx, selectedAttackers, card.instanceId);
      setGameState(s);

      // Check if any attackers remain
      const updatedPlayer = s.players[myIdx];
      const remainingAttackers = [updatedPlayer.hero, ...updatedPlayer.units].filter(
        u => !u.exhausted && !u.summonedThisTurn && !u.conditions.some(c => ['frozen', 'paralyzed'].includes(c.name))
      );

      if (remainingAttackers.length === 0 || s.gameOver) {
        // No more attackers or game over, end turn
        resetSelections();
        if (!s.gameOver) {
          setGameMessage('Sem atacantes disponíveis. Encerrando turno...');
          setTimeout(() => {
            const endState = endTurn(s);
            setGameState(endState);
            setGameMessage('');
          }, 800);
        }
      } else {
        // More attackers available, let player choose to continue or end
        setSelectedAttackers([]);
        setSelectionMode('selectAttacker');
        setValidTargets([]);
      }
      return;
    }
  };

  const handleHeroClick = (owner: PlayerIndex) => {
    if (gameState.gameOver) return;
    const hero = owner === myIdx ? player.hero : ai.hero;

    if (selectionMode === 'selectSpellTarget' && validTargets.includes(hero.instanceId)) {
      if (pendingSpell) {
        const s = playSpell(gameState, myIdx, pendingSpell, hero.instanceId);
        setGameState(s);
        handlePendingEffectFromState(s);
        resetSelections();
      }
      return;
    }

    if (selectionMode === 'selectEquipTarget' && validTargets.includes(hero.instanceId) && pendingEquip) {
      const s = attachEquipment(gameState, myIdx, pendingEquip, hero.instanceId);
      setGameState(s);
      resetSelections();
      return;
    }

    if (selectionMode === 'selectMountTarget' && validTargets.includes(hero.instanceId) && pendingMount) {
      const s = attachMount(gameState, myIdx, pendingMount, hero.instanceId);
      setGameState(s);
      resetSelections();
      return;
    }

    if (selectionMode === 'selectAllyForEffect' && owner === myIdx && validTargets.includes(hero.instanceId) && pendingEffectCard) {
      const eff = pendingEffectCard.eff;
      let s: GameState = { ...gameState, pendingEffect: null };
      if (eff.type === 'applyCondition' && eff.condition) {
        s = applyConditionToTarget(s, hero.instanceId, eff.condition);
      } else if (eff.type === 'heal') {
        s = healTarget(s, hero.instanceId, eff.value ?? 0, myIdx);
      } else if (eff.type === 'attackBonus') {
        const newPlayers = [...s.players] as typeof s.players;
        newPlayers[myIdx] = {
          ...s.players[myIdx],
          hero: { ...s.players[myIdx].hero, currentAttack: s.players[myIdx].hero.currentAttack + (eff.value ?? 0) }
        };
        s = { ...s, players: newPlayers };
      }
      setGameState(s);
      resetSelections();
      return;
    }

    if (selectionMode === 'selectAttacker' && owner === myIdx) {
      const canAtk = canAttack(hero, gameState.firstPlayerCannotAttack && gameState.turnNumber === 1);
      if (!canAtk) { setGameMessage('Herói não pode atacar!'); return; }
      if (selectedAttackers.includes(hero.instanceId)) {
        setSelectedAttackers(a => a.filter(id => id !== hero.instanceId));
      } else {
        setSelectedAttackers(a => [...a, hero.instanceId]);
      }
      return;
    }

    if (selectionMode === 'selectAttackTarget' && owner === oppIdx) {
      if (!validTargets.includes(hero.instanceId)) { setGameMessage('Não pode atacar o herói diretamente!'); return; }
      const s = resolveAttack(gameState, myIdx, selectedAttackers, hero.instanceId);
      setGameState(s);

      // Check if any attackers remain
      const updatedPlayer = s.players[myIdx];
      const remainingAttackers = [updatedPlayer.hero, ...updatedPlayer.units].filter(
        u => !u.exhausted && !u.summonedThisTurn && !u.conditions.some(c => ['frozen', 'paralyzed'].includes(c.name))
      );

      if (remainingAttackers.length === 0 || s.gameOver) {
        // No more attackers or game over, end turn
        resetSelections();
        if (!s.gameOver) {
          setGameMessage('Sem atacantes disponíveis. Encerrando turno...');
          setTimeout(() => {
            const endState = endTurn(s);
            setGameState(endState);
            setGameMessage('');
          }, 800);
        }
      } else {
        // More attackers available, let player choose to continue or end
        setSelectedAttackers([]);
        setSelectionMode('selectAttacker');
        setValidTargets([]);
      }
      return;
    }

    setInspectedCard(hero);
  };

  const handleDeclareAttack = () => {
    if (selectedAttackers.length === 0) { setGameMessage('Selecione atacantes primeiro!'); return; }
    const allAttackers = [player.hero, ...player.units].filter(u => selectedAttackers.includes(u.instanceId));
    const firstAttacker = allAttackers[0];
    const targets = getValidAttackTargets(gameState, myIdx, firstAttacker);
    setValidTargets(targets);
    setSelectionMode('selectAttackTarget');
    setGameMessage('Selecione o alvo do ataque.');
  };

  const handleActivateAbility = (unit: BattleCard) => {
    if (!isPlayerTurn || gameState.gameOver) return;
    const s = activateAbility(gameState, myIdx, unit.instanceId);
    setGameState(s);
    handlePendingEffectFromState(s);
  };

  const handleDiscardCardSelect = (card: CardDefinition) => {
    if (!pendingEffectCard) return;
    const eff = pendingEffectCard.eff;
    const s = resolveRecoverFromDiscard(gameState, myIdx, card.id, eff);
    setGameState(s);
    resetSelections();
  };

  const discardableCards = player.discard.filter(c =>
    !pendingEffectCard?.eff?.cardType || c.type === pendingEffectCard.eff.cardType
  );

  const oppLabel = isPvP ? 'Oponente' : 'IA';

  return (
    <div className="h-screen text-white flex flex-col relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center, #1e293b 0%, #0f172a 50%, #020617 100%)' }}>

      {/* Subtle texture overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Cpath d=%22M0 0h120v120H0z%22 fill=%22none%22/%3E%3Cpath d=%22M0 0l120 120M120 0L0 120%22 stroke=%22%23fff%22 stroke-width=%220.5%22/%3E%3C/svg%3E")' }} />

      {/* Discard selection overlay */}
      {selectionMode === 'selectDiscardCard' && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-white font-bold text-lg">Selecione uma carta do descarte</h2>
              <button onClick={resetSelections} className="text-slate-400 hover:text-white transition-colors">Cancelar</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {discardableCards.length === 0 ? (
                <p className="text-slate-500 text-center py-8">Nenhuma carta disponível no descarte.</p>
              ) : (
                <div className="flex flex-wrap gap-3 justify-center">
                  {discardableCards.map((card, i) => (
                    <CardDisplay key={i} card={card} size="md" isValidTarget onClick={() => handleDiscardCardSelect(card)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Card Inspector Modal */}
      {inspectedCard && <CardInspector card={inspectedCard} onClose={() => setInspectedCard(null)} />}

      {/* Top status bar */}
      <div className="relative z-10 flex items-center justify-between px-4 py-2 bg-slate-950/60 backdrop-blur-sm border-b border-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-md">
            <Star className="w-4 h-4 text-white" />
          </div>
          <span className="text-amber-400 font-bold tracking-wide text-xs">FRAGMENTOS</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 text-xs">Turno {gameState.turnNumber}</span>
          <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${
            isAttackPhase ? 'bg-red-950/60 text-red-300 border-red-700/50' : 'bg-blue-950/60 text-blue-300 border-blue-700/50'
          }`}>
            {isAttackPhase ? 'ATAQUE' : 'PRINCIPAL'}
          </span>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full font-semibold text-xs transition-all ${
          isPlayerTurn
            ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-600/40'
            : 'bg-rose-950/50 text-rose-300 border border-rose-600/40'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isPlayerTurn ? 'bg-emerald-400' : 'bg-rose-400'} animate-pulse`} />
          {isPlayerTurn ? 'Seu Turno' : isPvP ? 'Aguardando Oponente' : 'Turno da IA'}
          {aiThinking && <span className="ml-1 text-amber-300">• pensando...</span>}
        </div>
        <button
          onClick={() => { if (confirm('Deseja realmente desistir da partida?')) onGameEnd(oppIdx); }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-950/50 text-rose-300 border border-rose-700/40 hover:bg-rose-900/50 transition-colors"
        >
          <Flag className="w-3.5 h-3.5" /> Desistir
        </button>
      </div>

      {/* Main board area */}
      <div className="relative z-10 flex-1 flex gap-3 p-3 min-h-0">

        {/* Left sidebar: Log + info */}
        <div className="w-52 flex flex-col gap-2 shrink-0 h-full min-h-0">
          <GameLog log={gameState.log} />
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs">
              <Layers className="w-3 h-3 text-slate-500" />
              <span className="text-slate-500">Baralhos</span>
            </div>
            <div className="text-xs text-slate-400 flex justify-between">
              <span>{oppLabel}: <b className="text-slate-200">{ai.deck.length}</b></span>
              <span>Você: <b className="text-slate-200">{player.deck.length}</b></span>
            </div>
            <div className="flex items-center gap-1.5 text-xs pt-1 border-t border-slate-800">
              <Trash2 className="w-3 h-3 text-slate-500" />
              <span className="text-slate-500">Descartes</span>
            </div>
            <div className="text-xs text-slate-400 flex justify-between">
              <span>{oppLabel}: <b className="text-slate-200">{ai.discard.length}</b></span>
              <span>Você: <b className="text-slate-200">{player.discard.length}</b></span>
            </div>
          </div>
        </div>

        {/* Center: Battlefield */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">

          {/* Opponent zone */}
          <div className="flex-1 rounded-2xl border border-rose-900/20 bg-gradient-to-b from-rose-950/15 via-slate-900/30 to-slate-900/10 p-3 flex flex-col gap-2 min-h-0">
            {/* Opponent header */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-rose-950/60 border border-rose-700/40 flex items-center justify-center">
                <Sword className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <span className="text-rose-300 text-xs font-bold uppercase tracking-wider">{oppLabel}</span>
              <span className="text-slate-600 text-xs">Mão: {ai.hand.length}</span>
              <div className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-blue-950/40 rounded-full border border-blue-700/30">
                <Zap className="w-3 h-3 text-blue-400" />
                <span className="text-blue-300 text-xs font-bold">{ai.mana}/{ai.maxMana + ai.manaBonusFromItems}</span>
              </div>
            </div>

            {/* Opponent hand (face down) */}
            <div className="flex gap-1 h-8 items-center justify-center">
              {ai.hand.map((_, i) => (
                <div key={i} className="w-7 h-10 rounded bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600/40 shadow-md" />
              ))}
            </div>

            {/* Opponent battlefield row */}
            <div className="flex-1 flex gap-3 items-center justify-center min-h-0">
              {/* Opponent deck pile */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="relative w-12 h-16 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-slate-600/50 shadow-lg flex items-center justify-center">
                  <Layers className="w-4 h-4 text-slate-500" />
                  <span className="absolute -bottom-1 -right-1 bg-slate-800 text-slate-300 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border border-slate-600">
                    {ai.deck.length}
                  </span>
                </div>
                <span className="text-slate-600 text-[10px]">Deck</span>
              </div>

              {/* Opponent terrain */}
              <div className="shrink-0">
                {ai.terrain ? (
                  <CardDisplay card={ai.terrain} isBattleCard size="sm" onClick={() => setInspectedCard(ai.terrain!)} />
                ) : (
                  <div className="w-16 h-24 rounded-lg border border-dashed border-slate-700/50 flex items-center justify-center">
                    <span className="text-slate-700 text-[10px]">Terreno</span>
                  </div>
                )}
              </div>

              {/* Opponent units */}
              <div className="flex gap-2 flex-1 justify-center">
                {Array.from({ length: 3 + ai.unitSlotBonus }).map((_, i) => {
                  const unit = ai.units[i];
                  return unit ? (
                    <CardDisplay
                      key={i}
                      card={unit}
                      isBattleCard
                      size="sm"
                      isValidTarget={(selectionMode === 'selectAttackTarget' && validTargets.includes(unit.instanceId)) || (selectionMode === 'selectSpellTarget' && validTargets.includes(unit.instanceId))}
                      onClick={() => handleBattleCardClick(unit, oppIdx)}
                    />
                  ) : (
                    <div key={i} className="w-16 h-24 rounded-lg border border-dashed border-slate-800/40" />
                  );
                })}
              </div>

              {/* Opponent hero */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <CardDisplay
                  card={ai.hero}
                  isBattleCard
                  size="sm"
                  isValidTarget={(selectionMode === 'selectAttackTarget' && validTargets.includes(ai.hero.instanceId)) || (selectionMode === 'selectSpellTarget' && validTargets.includes(ai.hero.instanceId))}
                  onClick={() => handleHeroClick(oppIdx)}
                />
              </div>
            </div>
          </div>

          {/* Center divider with phase indicator */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
            {gameMessage ? (
              <div className="px-4 py-1 bg-amber-950/50 border border-amber-700/40 rounded-full text-amber-300 text-xs font-medium">
                {gameMessage}
              </div>
            ) : (
              <div className="px-3 py-0.5 bg-slate-800/50 border border-slate-700/40 rounded-full text-slate-500 text-[10px] uppercase tracking-widest">
                Campo de Batalha
              </div>
            )}
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
          </div>

          {/* Player zone */}
          <div className="flex-1 rounded-2xl border border-blue-900/20 bg-gradient-to-t from-blue-950/15 via-slate-900/30 to-slate-900/10 p-3 flex flex-col gap-2 min-h-0">
            {/* Player battlefield row */}
            <div className="flex-1 flex gap-3 items-center justify-center min-h-0">
              {/* Player hero */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <CardDisplay
                  card={player.hero}
                  isBattleCard
                  size="sm"
                  isSelected={selectedAttackers.includes(player.hero.instanceId)}
                  isValidTarget={(selectionMode === 'selectEquipTarget' && validTargets.includes(player.hero.instanceId)) || (selectionMode === 'selectMountTarget' && validTargets.includes(player.hero.instanceId)) || (selectionMode === 'selectAllyForEffect' && validTargets.includes(player.hero.instanceId))}
                  isExhausted={player.hero.exhausted}
                  onClick={() => handleHeroClick(myIdx)}
                />
              </div>

              {/* Player units */}
              <div className="flex gap-2 flex-1 justify-center">
                {Array.from({ length: 3 + player.unitSlotBonus }).map((_, i) => {
                  const unit = player.units[i];
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      {unit ? (
                        <>
                          <CardDisplay
                            card={unit}
                            isBattleCard
                            size="sm"
                            isSelected={selectedAttackers.includes(unit.instanceId)}
                            isValidTarget={(selectionMode === 'selectEquipTarget' && validTargets.includes(unit.instanceId)) || (selectionMode === 'selectMountTarget' && validTargets.includes(unit.instanceId)) || (selectionMode === 'selectAllyForEffect' && validTargets.includes(unit.instanceId)) || (selectionMode === 'selectSpellTarget' && validTargets.includes(unit.instanceId))}
                            isExhausted={unit.exhausted}
                            onClick={() => handleBattleCardClick(unit, myIdx)}
                          />
                          {unit.effects.some(e => e.timing === 'activated') && (
                            <button
                              onClick={() => handleActivateAbility(unit)}
                              disabled={unit.exhausted || !isPlayerTurn || isAttackPhase}
                              className="text-[10px] px-2 py-0.5 bg-amber-700 hover:bg-amber-600 disabled:bg-slate-800 disabled:cursor-not-allowed rounded transition-colors font-semibold"
                            >
                              Ativar
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="w-16 h-24 rounded-lg border border-dashed border-slate-800/40" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Player terrain */}
              <div className="shrink-0">
                {player.terrain ? (
                  <CardDisplay card={player.terrain} isBattleCard size="sm" onClick={() => setInspectedCard(player.terrain!)} />
                ) : (
                  <div className="w-16 h-24 rounded-lg border border-dashed border-slate-700/50 flex items-center justify-center">
                    <span className="text-slate-700 text-[10px]">Terreno</span>
                  </div>
                )}
              </div>

              {/* Player deck pile */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="relative w-12 h-16 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-slate-600/50 shadow-lg flex items-center justify-center">
                  <Layers className="w-4 h-4 text-slate-500" />
                  <span className="absolute -bottom-1 -right-1 bg-slate-800 text-slate-300 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border border-slate-600">
                    {player.deck.length}
                  </span>
                </div>
                <span className="text-slate-600 text-[10px]">Deck</span>
              </div>
            </div>

            {/* Player header */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-950/60 border border-blue-700/40 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="text-blue-300 text-xs font-bold uppercase tracking-wider">Você</span>
              {/* Mana crystals */}
              <div className="ml-auto flex items-center gap-1">
                {Array.from({ length: player.maxMana + player.manaBonusFromItems }).map((_, i) => (
                  <div key={i} className={`w-4 h-4 rounded-sm border transition-colors ${
                    i < player.mana ? 'bg-blue-500 border-blue-300 shadow-sm shadow-blue-500/50' : 'bg-slate-800 border-slate-700'
                  }`} />
                ))}
                <span className="text-slate-400 text-xs ml-1 font-semibold">{player.mana}/{player.maxMana + player.manaBonusFromItems}</span>
              </div>
            </div>
          </div>

          {/* Action bar */}
          {isPlayerTurn && !gameState.gameOver && (
            <div className="flex gap-2 justify-center flex-wrap items-center">
              {selectionMode === 'none' && isMainPhase && (
                <>
                  <button
                    onClick={handleDeclareAttackPhase}
                    className="px-5 py-2 bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white text-sm rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg shadow-rose-900/30"
                  >
                    <Sword className="w-4 h-4" /> Atacar
                  </button>
                  <button
                    onClick={handleEndTurn}
                    className="px-5 py-2 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white text-sm rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-900/30"
                  >
                    Encerrar Turno <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
              {selectionMode === 'selectAttacker' && (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg border border-slate-700">
                    <Sword className="w-4 h-4 text-rose-400" />
                    <span className="text-white text-sm font-semibold">
                      {selectedAttackers.length === 0 ? 'Selecione atacantes' : `${selectedAttackers.length} selecionado(s)`}
                    </span>
                    {selectedAttackers.length > 0 && (
                      <span className="text-rose-400 font-bold bg-rose-950/40 px-2 py-0.5 rounded text-xs">
                        {selectedAttackers.reduce((sum, id) => {
                          const u = [...player.units, player.hero].find(u => u.instanceId === id);
                          return sum + (u ? getAttackDamage(u) : 0);
                        }, 0)} ATK
                      </span>
                    )}
                  </div>
                  <button onClick={handleDeclareAttack} disabled={selectedAttackers.length === 0}
                    className="px-5 py-2 bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 disabled:from-slate-800 disabled:to-slate-800 text-white text-sm rounded-lg font-bold transition-all shadow-lg shadow-rose-900/30 disabled:shadow-none">
                    Declarar Ataque
                  </button>
                  <button onClick={() => { resetSelections(); setGameState(endTurn(gameState)); }}
                    className="px-4 py-2 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white text-sm rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-900/30">
                    Encerrar Turno
                  </button>
                </>
              )}
              {selectionMode === 'selectAttackTarget' && (
                <button onClick={() => { setSelectionMode('selectAttacker'); setValidTargets([]); }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg font-bold transition-colors">
                  Voltar
                </button>
              )}
              {(selectionMode === 'selectSpellTarget' || selectionMode === 'selectEquipTarget' || selectionMode === 'selectMountTarget' || selectionMode === 'selectAllyForEffect') && (
                <button onClick={resetSelections}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg font-bold transition-colors">
                  Cancelar
                </button>
              )}
              {isAttackPhase && selectionMode === 'none' && (
                <button onClick={handleEndTurn}
                  className="px-5 py-2 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white text-sm rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-900/30">
                  Encerrar Turno <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Selection instructions */}
          {isPlayerTurn && selectionMode !== 'none' && (
            <div className="text-center text-xs text-slate-400 bg-slate-900/60 rounded-lg px-3 py-1.5 border border-slate-800">
              {selectionMode === 'selectAttacker' && <span className="flex items-center justify-center gap-2"><Sword className="w-3 h-3 text-rose-400" />Clique nas suas unidades/herói para selecionar atacantes</span>}
              {selectionMode === 'selectAttackTarget' && <span className="flex items-center justify-center gap-2"><Eye className="w-3 h-3 text-emerald-400" />Clique no alvo do ataque (destacado em verde)</span>}
              {selectionMode === 'selectSpellTarget' && 'Clique no alvo do feitiço (destacado em verde)'}
              {selectionMode === 'selectEquipTarget' && 'Clique na unidade ou herói para equipar'}
              {selectionMode === 'selectMountTarget' && 'Clique na unidade ou herói para montar'}
              {selectionMode === 'selectAllyForEffect' && 'Clique em um aliado para aplicar o efeito'}
            </div>
          )}

          {/* Hand */}
          <div className="bg-slate-950/40 rounded-xl border border-slate-800/50 p-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <Hand className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Mão ({player.hand.length})</span>
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              {player.hand.map((card, i) => (
                <div key={i} className="relative">
                  <CardDisplay
                    card={card}
                    size="sm"
                    isValidTarget={isPlayerTurn && isMainPhase && !gameState.gameOver && player.mana >= card.manaCost}
                    onClick={() => handleCardFromHand(card)}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); setInspectedCard(card); }}
                    className="absolute bottom-0 right-0 w-5 h-5 bg-slate-800 rounded-tl flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <Eye className="w-3 h-3 text-slate-300" />
                  </button>
                </div>
              ))}
              {player.hand.length === 0 && <p className="text-slate-600 text-sm italic py-2">Sem cartas na mão</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
