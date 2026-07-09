import {
  GameState, PlayerIndex, BattleCard, CardDefinition, CardEffect, ConditionName,
} from '../types/game';
import {
  playUnit, playTerrain, playSpell, attachEquipment, attachMount,
  resolveAttack, endTurn, getValidAttackTargets, getEffectiveAttack,
  canAttack, getUnitSlots, hasCondition, applyConditionToTarget, healTarget,
  activateAbility,
} from './gameEngine';

const AI_PLAYER: PlayerIndex = 1;
const HUMAN_PLAYER: PlayerIndex = 0;
const NEGATIVE_CONDITIONS = new Set<ConditionName>([
  'burned', 'poisoned', 'bleeding', 'frozen', 'paralyzed',
  'silenced', 'weakened', 'defenseless', 'vulnerable',
]);

function getAllies(state: GameState): BattleCard[] {
  const player = state.players[AI_PLAYER];
  return [player.hero, ...player.units];
}

function missingHealth(card: BattleCard): number {
  return Math.max(0, card.maxHealth - card.currentHealth);
}

function combatValue(card: BattleCard): number {
  return getEffectiveAttack(card) * 2 + card.currentDefense + card.currentHealth;
}

function hasNegativeCondition(card: BattleCard): boolean {
  return card.conditions.some(condition => NEGATIVE_CONDITIONS.has(condition.name));
}

function effectValue(effect: CardEffect): number {
  return effect.value ?? 0;
}

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
  s = aiActivateUsefulAbilities(s);
  onStateChange(s);
  if (s.gameOver) return s;
  s = aiAttackPhase(s);
  onStateChange(s);
  if (s.gameOver) return s;
  s = aiFollowUpAttackPhase(s);
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

    // Establish a terrain before spending mana on the rest of the hand.
    if (!player.terrain) {
      const terrain = player.hand
        .filter(c => c.type === 'terrain' && c.manaCost <= mana)
        .sort((a, b) => scoreTerrain(b, s) - scoreTerrain(a, s))[0];
      if (terrain) {
        s = playTerrain(s, AI_PLAYER, terrain);
        changed = true;
        continue;
      }
    }

    const candidates = player.hand
      .filter(card => card.manaCost <= mana)
      .map(card => ({ card, score: scoreMainPhaseCard(s, card) }))
      .filter(candidate => candidate.score > 0)
      .sort((a, b) => b.score - a.score);

    for (const { card } of candidates) {
      const before = s;
      if (card.type === 'unit' && player.units.length < getUnitSlots(player)) {
        s = resolveAIPendingEffects(playUnit(s, AI_PLAYER, card));
      } else if (card.type === 'equipment') {
        const target = getBestItemTarget(s, card, 'equipment');
        if (target) s = attachEquipment(s, AI_PLAYER, card, target);
      } else if (card.type === 'mount') {
        const target = getBestItemTarget(s, card, 'mount');
        if (target) s = attachMount(s, AI_PLAYER, card, target);
      } else if (card.type === 'spell' && canUseSpell(s, card, false)) {
        s = resolveAIPendingEffects(playSpell(s, AI_PLAYER, card, getAISpellTarget(s, card)));
      }

      if (s !== before) {
        changed = true;
        break;
      }
    }
  }

  return s;
}

function getBestItemTarget(
  state: GameState,
  item: CardDefinition,
  slot: 'equipment' | 'mount',
): string | null {
  const player = state.players[AI_PLAYER];
  if (item.heroOnly) return player.hero[slot] ? null : player.hero.instanceId;

  const candidates = [player.hero, ...player.units]
    .filter(card => !card[slot])
    .sort((a, b) => scoreItemTarget(b, item) - scoreItemTarget(a, item));
  return candidates[0]?.instanceId ?? null;
}

function scoreTerrain(card: CardDefinition, state: GameState): number {
  const effect = card.effects[0];
  if (!effect) return card.manaCost;
  if (effect.type === 'increaseUnitSlots') {
    return state.players[AI_PLAYER].hand.filter(c => c.type === 'unit').length * 4 + 4;
  }
  if (effect.type === 'reduceSpellCost') {
    return state.players[AI_PLAYER].hand.filter(c => c.type === 'spell').length * 3 + 4;
  }
  if (effect.type === 'reduceUnitCost') {
    return state.players[AI_PLAYER].hand.filter(c => c.type === 'unit').length * 3 + 4;
  }
  return effectValue(effect) + 5;
}

function scoreItemTarget(card: BattleCard, item: CardDefinition): number {
  const attackBenefit = item.effects.some(e => e.timing === 'onAttack') ? getEffectiveAttack(card) * 2 : 0;
  const defenseBenefit = item.effects.some(e => e.timing === 'onDefend') ? card.currentHealth + card.currentDefense : 0;
  const utilityBenefit = item.effects.some(e => e.type === 'increaseMana') && card.type === 'hero' ? 20 : 0;
  return combatValue(card) + attackBenefit + defenseBenefit + utilityBenefit;
}

function scoreUnit(card: CardDefinition): number {
  const stats = (card.attack ?? 0) * 2 + (card.defense ?? 0) + (card.health ?? 0);
  const effects = card.effects.reduce((total, effect) => total + effectValue(effect) + 2, 0);
  return stats + effects - card.manaCost;
}

function scoreSpell(state: GameState, spell: CardDefinition, followUp: boolean): number {
  if (!canUseSpell(state, spell, followUp)) return -1;

  const opponent = state.players[HUMAN_PLAYER];
  const player = state.players[AI_PLAYER];
  let score = 3;
  for (const effect of spell.effects.filter(e => e.timing === 'onPlay')) {
    const value = effectValue(effect);
    if (effect.type === 'damage') {
      const target = getBestDamageTarget(state, value);
      score += value * 2 + (target && target.currentHealth + target.currentDefense <= value ? 12 : 0);
    } else if (effect.type === 'damageAllUnits') {
      score += opponent.units.length * value * 2;
      score += opponent.units.filter(unit => unit.currentHealth + unit.currentDefense <= value).length * 10;
    } else if (effect.type === 'heal') {
      score += Math.min(value, Math.max(...getAllies(state).map(missingHealth), 0)) * 2;
    } else if (effect.type === 'healAllUnits') {
      score += getAllies(state).reduce((total, ally) => total + Math.min(value, missingHealth(ally)), 0) * 2;
    } else if (effect.type === 'drawCard') {
      score += value * 7;
    } else if (effect.type === 'applyCondition' || effect.type === 'applyConditionAllUnits') {
      score += effect.target === 'allEnemies' ? opponent.units.length * 8 : 8;
    } else if (effect.type === 'recoverFromDiscard') {
      score += player.discard.filter(card => !effect.cardType || card.type === effect.cardType).length * 6;
    } else if (effect.type === 'destroyTerrain') {
      score += opponent.terrain ? 15 : 0;
    } else if (effect.type === 'attackAgain' || effect.type === 'allUnitsAttackTwice') {
      score += getAllies(state).filter(card => card.exhausted).reduce((total, card) => total + getEffectiveAttack(card), 0) * 3;
    } else if (effect.type === 'bonusAttackPerDamageTaken') {
      score += Math.max(...getAllies(state).map(missingHealth), 0) * 3;
    } else if (effect.type === 'removeCondition' || effect.type === 'removeAllNegativeConditions') {
      score += getAllies(state).filter(hasNegativeCondition).length * 8;
    } else if (effect.type === 'recoverEquipmentDurability') {
      score += getAllies(state).filter(card =>
        card.equipment && card.equipment.currentDurability < card.equipment.maxDurability
      ).length * 8;
    }
  }
  return score - spell.manaCost;
}

function scoreMainPhaseCard(state: GameState, card: CardDefinition): number {
  if (card.type === 'unit') {
    return state.players[AI_PLAYER].units.length < getUnitSlots(state.players[AI_PLAYER])
      ? scoreUnit(card)
      : -1;
  }
  if (card.type === 'equipment' || card.type === 'mount') {
    return getBestItemTarget(state, card, card.type) ? card.manaCost + 8 : -1;
  }
  if (card.type === 'spell') return scoreSpell(state, card, false);
  return -1;
}

function canUseSpell(state: GameState, spell: CardDefinition, followUp: boolean): boolean {
  const player = state.players[AI_PLAYER];
  const opponent = state.players[HUMAN_PLAYER];
  const effects = spell.effects.filter(effect => effect.timing === 'onPlay');
  if (effects.length === 0) return false;

  return effects.some(effect => {
    if (effect.type === 'damage') return Boolean(getBestDamageTarget(state, effectValue(effect)));
    if (effect.type === 'damageAllUnits' || effect.type === 'applyConditionAllUnits') return opponent.units.length > 0;
    if (effect.type === 'heal') return getAllies(state).some(ally => missingHealth(ally) > 0);
    if (effect.type === 'healAllUnits') return getAllies(state).some(ally => missingHealth(ally) > 0);
    if (effect.type === 'recoverFromDiscard') {
      return player.discard.some(card => !effect.cardType || card.type === effect.cardType);
    }
    if (effect.type === 'destroyTerrain') return Boolean(opponent.terrain);
    if (effect.type === 'recoverEquipmentDurability') {
      return getAllies(state).some(card =>
        card.equipment && card.equipment.currentDurability < card.equipment.maxDurability
      );
    }
    if (effect.type === 'removeCondition' || effect.type === 'removeAllNegativeConditions') {
      return getAllies(state).some(hasNegativeCondition);
    }
    if (effect.type === 'attackAgain' || effect.type === 'allUnitsAttackTwice') {
      return followUp && getAllies(state).some(card => card.exhausted && getEffectiveAttack(card) > 0);
    }
    if (effect.type === 'bonusAttackPerDamageTaken') {
      return getAllies(state).some(ally => missingHealth(ally) > 0);
    }
    if (effect.type === 'applyCondition') return opponent.units.length > 0 || Boolean(opponent.hero);
    return true;
  });
}

function getBestDamageTarget(state: GameState, damage: number): BattleCard | undefined {
  const opponent = state.players[HUMAN_PLAYER];
  const heroDurability = opponent.hero.currentHealth + opponent.hero.currentDefense;
  if (damage >= heroDurability) return opponent.hero;

  const units = [...opponent.units].sort((a, b) => {
    const aLethal = a.currentHealth + a.currentDefense <= damage ? 1 : 0;
    const bLethal = b.currentHealth + b.currentDefense <= damage ? 1 : 0;
    if (aLethal !== bLethal) return bLethal - aLethal;
    return combatValue(b) - combatValue(a);
  });
  return units[0] ?? opponent.hero;
}

function getAISpellTarget(state: GameState, spell: CardDefinition): string | undefined {
  const opponent = state.players[HUMAN_PLAYER];
  const player = state.players[AI_PLAYER];

  for (const eff of spell.effects) {
    if (eff.type === 'damage' && eff.target === 'anyUnit') {
      return getBestDamageTarget(state, effectValue(eff))?.instanceId;
    }
    if (eff.type === 'heal' && (eff.target === 'anyUnit' || eff.target === 'ally')) {
      return [...getAllies(state)]
        .filter(ally => missingHealth(ally) > 0)
        .sort((a, b) => missingHealth(b) - missingHealth(a))[0]?.instanceId;
    }
    if (eff.type === 'applyCondition') {
      if (eff.target === 'ally') {
        return [...getAllies(state)].sort((a, b) => combatValue(b) - combatValue(a))[0]?.instanceId;
      }
      const enemies = [opponent.hero, ...opponent.units]
        .filter(enemy => !eff.condition || !hasCondition(enemy, eff.condition))
        .sort((a, b) => combatValue(b) - combatValue(a));
      return enemies[0]?.instanceId ?? opponent.hero.instanceId;
    }
    if (eff.type === 'attackAgain') {
      return [player.hero, ...player.units]
        .filter(ally => ally.exhausted)
        .sort((a, b) => getEffectiveAttack(b) - getEffectiveAttack(a))[0]?.instanceId;
    }
    if (eff.type === 'bonusAttackPerDamageTaken') {
      return [...getAllies(state)]
        .filter(ally => missingHealth(ally) > 0)
        .sort((a, b) => missingHealth(b) - missingHealth(a))[0]?.instanceId;
    }
    if (eff.type === 'removeCondition') {
      return [...getAllies(state)]
        .filter(hasNegativeCondition)
        .sort((a, b) => combatValue(b) - combatValue(a))[0]?.instanceId;
    }
  }
  return undefined;
}

function resolveAIPendingEffects(state: GameState): GameState {
  let s = state;
  if (!s.pendingEffect) return s;

  const eff = s.pendingEffect;
  const player = s.players[AI_PLAYER];
  const effect = eff.effect;

  // Clear pending effect before processing
  s = { ...s, pendingEffect: null };

  if (!effect) return s;

  if (effect.type === 'applyCondition' && effect.condition) {
    const target = player.units
      .filter(u => u.instanceId !== (eff.sourceCard as BattleCard)?.instanceId)
      .sort((a, b) => combatValue(b) - combatValue(a))[0];
    if (target) {
      s = applyConditionToTarget(s, target.instanceId, effect.condition);
    }
  } else if (effect.type === 'recoverFromDiscard') {
    const target = player.discard
      .filter(c => !effect.cardType || c.type === effect.cardType)
      .sort((a, b) => scoreRecoveredCard(b) - scoreRecoveredCard(a))[0];
    if (target) {
      const newDiscard = player.discard.filter(c => c !== target);
      const newPlayers = [...s.players] as [typeof s.players[0], typeof s.players[1]];
      newPlayers[AI_PLAYER] = { ...s.players[AI_PLAYER], discard: newDiscard, deck: shuffle([...s.players[AI_PLAYER].deck, target]) };
      s = { ...s, players: newPlayers, log: [...s.log, `IA recupera ${target.name} do descarte.`] };
    }
  } else if (effect.type === 'attackAgain') {
    const target = getAllies(s)
      .filter(u => u.exhausted)
      .sort((a, b) => getEffectiveAttack(b) - getEffectiveAttack(a))[0];
    if (target) {
      const newPlayers = [...s.players] as [typeof s.players[0], typeof s.players[1]];
      const current = s.players[AI_PLAYER];
      newPlayers[AI_PLAYER] = target.instanceId === current.hero.instanceId
        ? { ...current, hero: { ...current.hero, exhausted: false } }
        : {
            ...current,
            units: current.units.map(u =>
              u.instanceId === target.instanceId ? { ...u, exhausted: false } : u
            ),
          };
      s = { ...s, players: newPlayers };
    }
  } else if (effect.type === 'heal') {
    const target = getAllies(s)
      .filter(ally => missingHealth(ally) > 0)
      .sort((a, b) => missingHealth(b) - missingHealth(a))[0];
    if (target) s = healTarget(s, target.instanceId, effect.value ?? 0, AI_PLAYER);
  } else if (effect.type === 'searchCard') {
    // Already handled in resolveOnSummonEffects
  }

  return s;
}

function scoreRecoveredCard(card: CardDefinition): number {
  if (card.type === 'unit') return scoreUnit(card);
  return card.manaCost + card.effects.length * 3;
}

function aiActivateUsefulAbilities(state: GameState): GameState {
  let s = state;
  const units = [...s.players[AI_PLAYER].units];

  for (const original of units) {
    const unit = s.players[AI_PLAYER].units.find(card => card.instanceId === original.instanceId);
    if (!unit || unit.exhausted || hasCondition(unit, 'silenced')) continue;

    const effects = unit.effects.filter(effect => effect.timing === 'activated');
    const useful = effects.some(effect => {
      if (effect.type === 'recoverFromDiscard') {
        return s.players[AI_PLAYER].discard.some(card => !effect.cardType || card.type === effect.cardType);
      }
      if (effect.type === 'heal') {
        return getAllies(s).some(ally => ally.instanceId !== unit.instanceId && missingHealth(ally) > 0);
      }
      if (effect.type === 'attackBonus') return s.players[AI_PLAYER].units.length > 1;
      return false;
    });

    if (useful) s = resolveAIPendingEffects(activateAbility(s, AI_PLAYER, unit.instanceId, true));
  }
  return s;
}

function aiFollowUpAttackPhase(state: GameState): GameState {
  let s = state;
  let usedFollowUp = false;

  while (!usedFollowUp && !s.gameOver) {
    const player = s.players[AI_PLAYER];
    const spell = player.hand
      .filter(card => card.type === 'spell' && card.manaCost <= player.mana)
      .map(card => ({ card, score: scoreSpell(s, card, true) }))
      .filter(({ card, score }) =>
        score > 0 && card.effects.some(effect =>
          effect.timing === 'onPlay' &&
          (effect.type === 'attackAgain' || effect.type === 'allUnitsAttackTwice')
        )
      )
      .sort((a, b) => b.score - a.score)[0]?.card;

    if (!spell) break;
    s = resolveAIPendingEffects(playSpell(s, AI_PLAYER, spell, getAISpellTarget(s, spell)));
    usedFollowUp = true;
  }

  return usedFollowUp ? aiAttackPhase(s) : s;
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

    const target = chooseAttackTarget(s, currentAttacker, validTargets);
    s = resolveAttack(s, AI_PLAYER, [currentAttacker.instanceId], target);
  }

  return s;
}

function chooseAttackTarget(
  state: GameState,
  attacker: BattleCard,
  validTargets: string[],
): string {
  const opponent = state.players[HUMAN_PLAYER];
  const damage = getEffectiveAttack(attacker);
  const heroIsValid = validTargets.includes(opponent.hero.instanceId);
  const heroDurability = opponent.hero.currentHealth + opponent.hero.currentDefense;

  if (heroIsValid && damage >= heroDurability) return opponent.hero.instanceId;

  const units = opponent.units
    .filter(unit => validTargets.includes(unit.instanceId))
    .map(unit => {
      const durability = unit.currentHealth + unit.currentDefense;
      const lethal = damage >= durability;
      const waste = lethal ? damage - durability : durability - damage;
      const score = (lethal ? 100 : 0) + combatValue(unit) - waste;
      return { unit, score };
    })
    .sort((a, b) => b.score - a.score);

  if (units[0]?.score >= 100) return units[0].unit.instanceId;
  if (heroIsValid) return opponent.hero.instanceId;
  return units[0]?.unit.instanceId ?? validTargets[0];
}
