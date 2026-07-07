import {
  GameState, PlayerIndex, BattleCard, CardDefinition,
} from '../types/game';
import {
  playUnit, playTerrain, playSpell, attachEquipment, attachMount,
  resolveAttack, endTurn, getValidAttackTargets, getEffectiveAttack,
  canAttack, getUnitSlots, hasCondition, applyConditionToTarget, healTarget,
} from './gameEngine';
import { getCardById } from '../data/cards';

const AI_PLAYER: PlayerIndex = 1;
const HUMAN_PLAYER: PlayerIndex = 0;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function runAITurn(state: GameState, onStateChange: (s: GameState) => void): GameState {
  let s = state;
  s = aiMainPhase(s);
  onStateChange(s);
  if (s.gameOver) return s;
  s = aiAttackPhase(s);
  onStateChange(s);
  if (s.gameOver) return s;
  s = endTurn(s);
  return s;
}

function aiMainPhase(state: GameState): GameState {
  let s = state;
  let changed = true;

  while (changed && !s.gameOver) {
    changed = false;
    const player = s.players[AI_PLAYER];
    const mana = player.mana;

    // Play terrain if no terrain and affordable
    if (!player.terrain) {
      const terrain = player.hand.find(c => c.type === 'terrain' && c.manaCost <= mana);
      if (terrain) {
        s = playTerrain(s, AI_PLAYER, terrain);
        changed = true;
        continue;
      }
    }

    // Play units if slots available
    if (player.units.length < getUnitSlots(player)) {
      const unit = player.hand
        .filter(c => c.type === 'unit' && c.manaCost <= mana)
        .sort((a, b) => b.manaCost - a.manaCost)[0];
      if (unit) {
        s = playUnit(s, AI_PLAYER, unit);
        s = resolveAIPendingEffects(s);
        changed = true;
        continue;
      }
    }

    // Equip equipment
    const equipment = player.hand.find(c => c.type === 'equipment' && c.manaCost <= mana);
    if (equipment) {
      const target = getBestEquipTarget(s);
      if (target) {
        s = attachEquipment(s, AI_PLAYER, equipment, target);
        changed = true;
        continue;
      }
    }

    // Mount
    const mount = player.hand.find(c => c.type === 'mount' && c.manaCost <= mana);
    if (mount) {
      const target = getBestMountTarget(s);
      if (target) {
        s = attachMount(s, AI_PLAYER, mount, target);
        changed = true;
        continue;
      }
    }

    // Cast spells
    const spell = player.hand.find(c => c.type === 'spell' && c.manaCost <= mana);
    if (spell) {
      const target = getAISpellTarget(s, spell);
      const needsTarget = spell.effects.some(e =>
        ['damage', 'heal', 'applyCondition', 'attackAgain', 'bonusAttackPerDamageTaken', 'removeCondition', 'attackBonus'].includes(e.type) &&
        (e.target === 'anyUnit' || e.target === 'ally' || e.target === 'enemy')
      );
      if (needsTarget && !target) return s;
      s = playSpell(s, AI_PLAYER, spell, target);
      s = resolveAIPendingEffects(s);
      changed = true;
      continue;
    }
  }

  return s;
}

function getBestEquipTarget(state: GameState): string | null {
  const player = state.players[AI_PLAYER];
  if (player.units.length > 0) {
    const best = player.units
      .filter(u => !u.equipment)
      .sort((a, b) => b.currentAttack - a.currentAttack)[0];
    if (best) return best.instanceId;
  }
  if (!player.hero.equipment) return player.hero.instanceId;
  return null;
}

function getBestMountTarget(state: GameState): string | null {
  const player = state.players[AI_PLAYER];
  if (player.units.length > 0) {
    const best = player.units
      .filter(u => !u.mount)
      .sort((a, b) => b.currentAttack - a.currentAttack)[0];
    if (best) return best.instanceId;
  }
  if (!player.hero.mount) return player.hero.instanceId;
  return null;
}

function getAISpellTarget(state: GameState, spell: CardDefinition): string | undefined {
  const opponent = state.players[HUMAN_PLAYER];
  const player = state.players[AI_PLAYER];

  for (const eff of spell.effects) {
    if (eff.type === 'damage' && eff.target === 'anyUnit') {
      if (opponent.units.length === 0) return opponent.hero.instanceId;
      const weakest = [...opponent.units].sort((a, b) => a.currentHealth - b.currentHealth)[0];
      return weakest.instanceId;
    }
    if (eff.type === 'heal' && (eff.target === 'anyUnit' || eff.target === 'ally')) {
      const injured = player.units.find(u => u.currentHealth < u.maxHealth);
      if (injured) return injured.instanceId;
      return player.hero.instanceId;
    }
    if (eff.type === 'applyCondition' && eff.target === 'anyUnit') {
      if (opponent.units.length > 0) return opponent.units[0].instanceId;
      return opponent.hero.instanceId;
    }
    if (eff.type === 'attackAgain') {
      const exhausted = [player.hero, ...player.units].find(u => u.exhausted);
      if (exhausted) return exhausted.instanceId;
      return undefined;
    }
  }
  return undefined;
}

function resolveAIPendingEffects(state: GameState): GameState {
  let s = state;
  if (!s.pendingEffect) return s;

  const eff = s.pendingEffect;
  const player = s.players[AI_PLAYER];
  const opponent = s.players[HUMAN_PLAYER];
  const effect = eff.effect;

  // Clear pending effect before processing
  s = { ...s, pendingEffect: null };

  if (!effect) return s;

  if (effect.type === 'applyCondition' && effect.condition) {
    const target = player.units.find(u => !u.exhausted && u.instanceId !== (eff.sourceCard as BattleCard)?.instanceId);
    if (target) {
      s = applyConditionToTarget(s, target.instanceId, effect.condition);
    }
  } else if (effect.type === 'recoverFromDiscard') {
    const target = player.discard.find(c => !effect.cardType || c.type === effect.cardType);
    if (target) {
      const newDiscard = player.discard.filter(c => c !== target);
      const newPlayers = [...s.players] as [typeof s.players[0], typeof s.players[1]];
      newPlayers[AI_PLAYER] = { ...s.players[AI_PLAYER], discard: newDiscard, deck: shuffle([...s.players[AI_PLAYER].deck, target]) };
      s = { ...s, players: newPlayers, log: [...s.log, `IA recupera ${target.name} do descarte.`] };
    }
  } else if (effect.type === 'attackAgain') {
    // Unexhaust a unit so it can attack again
    const target = player.units.find(u => u.exhausted);
    if (target) {
      const newUnits = s.players[AI_PLAYER].units.map(u =>
        u.instanceId === target.instanceId ? { ...u, exhausted: false } : u
      );
      const newPlayers = [...s.players] as [typeof s.players[0], typeof s.players[1]];
      newPlayers[AI_PLAYER] = { ...s.players[AI_PLAYER], units: newUnits };
      s = { ...s, players: newPlayers };
    }
  } else if (effect.type === 'heal') {
    const target = player.units.find(u => u.currentHealth < u.maxHealth) || player.hero;
    s = healTarget(s, target.instanceId, effect.value ?? 0, AI_PLAYER);
  } else if (effect.type === 'searchCard') {
    // Already handled in resolveOnSummonEffects
  }

  return s;
}

function aiAttackPhase(state: GameState): GameState {
  let s = state;
  const player = s.players[AI_PLAYER];

  const isFirstTurnP0 = s.firstPlayerCannotAttack && s.turnNumber === 1 && s.currentPlayer === AI_PLAYER;

  const potentialAttackers = [
    ...(canAttack(player.hero, isFirstTurnP0) ? [player.hero] : []),
    ...player.units.filter(u => canAttack(u, isFirstTurnP0)),
  ];

  for (const attacker of potentialAttackers) {
    if (s.gameOver) break;
    const currentPlayer = s.players[AI_PLAYER];
    const currentAttacker = [currentPlayer.hero, ...currentPlayer.units].find(u => u.instanceId === attacker.instanceId);
    if (!currentAttacker || currentAttacker.exhausted) continue;

    const validTargets = getValidAttackTargets(s, AI_PLAYER, currentAttacker);
    if (validTargets.length === 0) continue;

    const opponent = s.players[HUMAN_PLAYER];
    let target = validTargets[0];

    // Prefer hero if accessible
    if (validTargets.includes(opponent.hero.instanceId)) {
      target = opponent.hero.instanceId;
    } else {
      // Attack weakest unit
      const enemyUnits = opponent.units.filter(u => validTargets.includes(u.instanceId));
      if (enemyUnits.length > 0) {
        target = enemyUnits.sort((a, b) => a.currentHealth - b.currentHealth)[0].instanceId;
      }
    }

    s = resolveAttack(s, AI_PLAYER, [currentAttacker.instanceId], target);
  }

  return s;
}
