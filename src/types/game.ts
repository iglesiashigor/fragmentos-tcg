export type CardType = 'hero' | 'unit' | 'terrain' | 'equipment' | 'mount' | 'spell' | 'mana';
export type UnitTier = 'weak' | 'medium' | 'strong';
export type ConditionName =
  | 'burned' | 'poisoned' | 'bleeding'
  | 'frozen' | 'paralyzed'
  | 'silenced' | 'weakened' | 'defenseless' | 'vulnerable'
  | 'inspired' | 'fortified' | 'regenerating' | 'protected' | 'immune' | 'stealth';

export type EffectType =
  | 'damage' | 'heal' | 'applyCondition' | 'removeCondition' | 'removeAllNegativeConditions'
  | 'drawCard' | 'searchCard' | 'recoverFromDiscard' | 'dealDamageToConditioned'
  | 'attackAgain' | 'attackTwice' | 'allUnitsAttackTwice'
  | 'damageAllUnits' | 'healAllUnits' | 'applyConditionAllUnits' | 'removeConditionAllUnits'
  | 'increaseMana' | 'increaseUnitSlots' | 'reduceSpellCost' | 'reduceUnitCost'
  | 'terrainStartOfTurn' | 'destroyTerrain' | 'recoverEquipmentDurability'
  | 'bonusAttackPerDamageTaken' | 'defenseBonus' | 'attackBonus'
  | 'poisonOnDamage' | 'drawOnAllyDeath' | 'drawOnRecoverUnit';

export interface CardEffect {
  type: EffectType;
  value?: number;
  condition?: ConditionName;
  cardName?: string;
  cardType?: CardType;
  target?: 'self' | 'ally' | 'enemy' | 'allAllies' | 'allEnemies' | 'allUnits' | 'hero' | 'anyUnit';
  timing?: 'onPlay' | 'onSummon' | 'startOfTurn' | 'activated' | 'onDeath' | 'onAttack' | 'onDamageDealt' | 'onDefend';
  isArea?: boolean;
  statType?: 'attack' | 'defense' | 'heal';
}

export interface CardDefinition {
  id: string;
  name: string;
  type: CardType;
  manaCost: number;
  attack?: number;
  defense?: number;
  health?: number;
  tier?: UnitTier;
  effects: CardEffect[];
  flavorText?: string;
  durability?: number;
  maxDurability?: number;
  isNeutral?: boolean;
  heroOnly?: boolean;
  imageUrl?: string;
}

export interface Condition {
  name: ConditionName;
  turnsRemaining: number | 'permanent';
  stacks?: number;
}

export interface AttachedItem {
  cardId: string;
  name: string;
  currentDurability: number;
  maxDurability: number;
  effects: CardEffect[];
}

export interface BattleCard {
  instanceId: string;
  cardId: string;
  name: string;
  type: CardType;
  manaCost: number;
  baseAttack: number;
  baseDefense: number;
  baseHealth: number;
  currentAttack: number;
  currentDefense: number;
  currentHealth: number;
  maxHealth: number;
  exhausted: boolean;
  summonedThisTurn: boolean;
  conditions: Condition[];
  equipment?: AttachedItem;
  mount?: AttachedItem;
  effects: CardEffect[];
  tier?: UnitTier;
  imageUrl?: string;
}

export type GamePhase = 'main' | 'attack' | 'end';
export type TurnPhase = 'untap' | 'gainMana' | 'draw' | 'startEffects' | 'main' | 'attack' | 'end';
export type PlayerIndex = 0 | 1;

export interface PlayerState {
  id: PlayerIndex;
  hero: BattleCard;
  hand: CardDefinition[];
  deck: CardDefinition[];
  discard: CardDefinition[];
  units: BattleCard[];
  terrain: BattleCard | null;
  mana: number;
  maxMana: number;
  manaBonusFromItems: number;
  unitSlotBonus: number;
}

export interface MatchStats {
  unitsPlayed: number;
  spellsCast: number;
  itemsEquipped: number;
  terrainsPlayed: number;
  turnsEnded: number;
  attacksDeclared: number;
}

export interface GameState {
  players: [PlayerState, PlayerState];
  currentPlayer: PlayerIndex;
  turnNumber: number;
  phase: GamePhase;
  turnPhase: TurnPhase;
  winner: PlayerIndex | 'draw' | null;
  gameOver: boolean;
  log: string[];
  pendingEffect: PendingEffect | null;
  firstPlayerCannotAttack: boolean;
  extraAttackPhase: boolean;
  turnStartedAt?: number;
  inactivityFaults?: [number, number];
  stateVersion?: number;
  matchStats?: [MatchStats, MatchStats];
}

export interface PendingEffect {
  type: 'selectTarget' | 'selectAttacker' | 'selectDefender' | 'activateAbility' | 'searchCard' | 'selectAllyUnit' | 'selectEnemyUnit' | 'selectAnyUnit' | 'selectEquipTarget' | 'selectMountTarget';
  sourceCard?: CardDefinition | BattleCard;
  effect?: CardEffect;
  attackers?: BattleCard[];
  validTargets?: string[];
  callback?: (targetId: string) => void;
}

export interface DeckDefinition {
  id: string;
  name: string;
  heroId: string;
  coreCards: { cardId: string; count: number }[];
  neutralCards: { cardId: string; count: number }[];
}
