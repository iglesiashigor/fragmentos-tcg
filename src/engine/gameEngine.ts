import {
  GameState,
  PlayerState,
  PlayerIndex,
  BattleCard,
  CardDefinition,
  Condition,
  ConditionName,
  CardEffect,
  AttachedItem,
  GamePhase,
  TurnPhase,
} from "../types/game";
import { getCardById } from "../data/cards";

let instanceCounter = 0;
function newInstanceId() {
  return `inst-${++instanceCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createBattleCard(def: CardDefinition): BattleCard {
  return {
    instanceId: newInstanceId(),
    cardId: def.id,
    name: def.name,
    type: def.type,
    manaCost: def.manaCost,
    baseAttack: def.attack ?? 0,
    baseDefense: def.defense ?? 0,
    baseHealth: def.health ?? 20,
    currentAttack: def.attack ?? 0,
    currentDefense: def.defense ?? 0,
    currentHealth: def.health ?? 20,
    maxHealth: def.health ?? 20,
    exhausted: false,
    summonedThisTurn: false,
    conditions: [],
    effects: def.effects,
    tier: def.tier,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildDeck(
  heroId: string,
  coreCards: { cardId: string; count: number }[],
  neutralCards: { cardId: string; count: number }[],
): CardDefinition[] {
  const cards: CardDefinition[] = [];
  for (const { cardId, count } of coreCards) {
    const def = getCardById(cardId);
    if (def) for (let i = 0; i < count; i++) cards.push(def);
  }
  for (const { cardId, count } of neutralCards) {
    const def = getCardById(cardId);
    if (def) for (let i = 0; i < count; i++) cards.push(def);
  }
  return shuffle(cards);
}

export function createInitialState(
  player0HeroId: string,
  player0Deck: CardDefinition[],
  player1HeroId: string,
  player1Deck: CardDefinition[],
  firstPlayer: PlayerIndex = 0,
): GameState {
  const hero0Def = getCardById(player0HeroId)!;
  const hero1Def = getCardById(player1HeroId)!;

  const p0Deck = shuffle([...player0Deck]);
  const p1Deck = shuffle([...player1Deck]);

  const p0Hand = p0Deck.splice(0, 5);
  const p1Hand = p1Deck.splice(0, 5);

  const player0: PlayerState = {
    id: 0,
    hero: createBattleCard(hero0Def),
    hand: p0Hand,
    deck: p0Deck,
    discard: [],
    units: [],
    terrain: null,
    mana: firstPlayer === 0 ? 2 : 1,
    maxMana: firstPlayer === 0 ? 2 : 1,
    manaBonusFromItems: 0,
    unitSlotBonus: 0,
  };

  const player1: PlayerState = {
    id: 1,
    hero: createBattleCard(hero1Def),
    hand: p1Hand,
    deck: p1Deck,
    discard: [],
    units: [],
    terrain: null,
    mana: firstPlayer === 1 ? 2 : 1,
    maxMana: firstPlayer === 1 ? 2 : 1,
    manaBonusFromItems: 0,
    unitSlotBonus: 0,
  };

  const firstName = firstPlayer === 0 ? "Jogador" : "IA";
  return {
    players: [player0, player1],
    currentPlayer: firstPlayer,
    turnNumber: 1,
    phase: "main",
    turnPhase: "main",
    winner: null,
    gameOver: false,
    log: [`Partida iniciada! ${firstName} começa.`],
    pendingEffect: null,
    firstPlayerCannotAttack: true,
    extraAttackPhase: false,
  };
}

export function getConditionModifiers(card: BattleCard): {
  atkMod: number;
  defMod: number;
} {
  let atkMod = 0,
    defMod = 0;
  for (const c of card.conditions) {
    if (c.name === "inspired") atkMod += 2;
    if (c.name === "fortified") defMod += 2;
    if (c.name === "weakened") atkMod -= 2;
    if (c.name === "defenseless") defMod -= 2;
  }
  return { atkMod, defMod };
}

export function getEffectiveAttack(card: BattleCard): number {
  const { atkMod } = getConditionModifiers(card);
  return Math.max(0, card.currentAttack + atkMod);
}

export function getEquipmentAttackBonus(card: BattleCard): number {
  if (!card.equipment || card.equipment.currentDurability <= 0) return 0;
  const eff = card.equipment.effects.find(
    (e) => e.type === "damage" && e.timing === "onAttack",
  );
  return eff?.value ?? 0;
}

export function getMountAttackBonus(card: BattleCard): number {
  if (!card.mount || card.mount.currentDurability <= 0) return 0;
  const eff = card.mount.effects.find(
    (e) => e.type === "damage" && e.timing === "onAttack",
  );
  return eff?.value ?? 0;
}

export function getAttackDamage(card: BattleCard): number {
  return (
    getEffectiveAttack(card) +
    getEquipmentAttackBonus(card) +
    getMountAttackBonus(card)
  );
}

export function getEffectiveDefense(card: BattleCard): number {
  const { defMod } = getConditionModifiers(card);
  return Math.max(0, card.currentDefense + defMod);
}

export function hasCondition(card: BattleCard, name: ConditionName): boolean {
  return card.conditions.some((c) => c.name === name);
}

export function applyCondition(
  card: BattleCard,
  name: ConditionName,
): BattleCard {
  if (hasCondition(card, "immune") && isNegativeCondition(name)) return card;
  if (hasCondition(card, name)) {
    return {
      ...card,
      conditions: card.conditions.map((c) =>
        c.name === name
          ? { ...c, turnsRemaining: getConditionDuration(name) }
          : c,
      ),
    };
  }
  return {
    ...card,
    conditions: [
      ...card.conditions,
      { name, turnsRemaining: getConditionDuration(name) },
    ],
  };
}

export function removeCondition(
  card: BattleCard,
  name: ConditionName,
): BattleCard {
  return {
    ...card,
    conditions: card.conditions.filter((c) => c.name !== name),
  };
}

export function removeAllNegativeConditions(card: BattleCard): BattleCard {
  return {
    ...card,
    conditions: card.conditions.filter((c) => !isNegativeCondition(c.name)),
  };
}

export function isNegativeCondition(name: ConditionName): boolean {
  return [
    "burned",
    "poisoned",
    "bleeding",
    "frozen",
    "paralyzed",
    "silenced",
    "weakened",
    "defenseless",
    "vulnerable",
  ].includes(name);
}

function getConditionDuration(name: ConditionName): number | "permanent" {
  if (["burned", "poisoned", "bleeding"].includes(name)) return "permanent";
  if (name === "protected") return "permanent";
  return 1;
}

export function canAttack(card: BattleCard, isFirstTurnP0: boolean): boolean {
  if (card.exhausted) return false;
  if (card.summonedThisTurn) return false;
  if (hasCondition(card, "frozen") || hasCondition(card, "paralyzed"))
    return false;
  if (isFirstTurnP0 && card.type === "hero") return false;
  return true;
}

export function getUnitSlots(player: PlayerState): number {
  return 3 + player.unitSlotBonus;
}

function getStartOfTurnManaBonus(player: PlayerState): number {
  const cards = [player.hero, ...player.units];
  return cards.reduce((total, card) => {
    const equipmentBonus =
      card.equipment?.effects
        .filter((e) => e.type === "increaseMana" && e.timing === "startOfTurn")
        .reduce((sum, e) => sum + (e.value ?? 0), 0) ?? 0;
    const mountBonus =
      card.mount?.effects
        .filter((e) => e.type === "increaseMana" && e.timing === "startOfTurn")
        .reduce((sum, e) => sum + (e.value ?? 0), 0) ?? 0;
    return total + equipmentBonus + mountBonus;
  }, 0);
}

export function drawCard(state: GameState, playerIdx: PlayerIndex): GameState {
  const player = state.players[playerIdx];
  if (player.deck.length === 0) {
    const newHero = {
      ...player.hero,
      currentHealth: player.hero.currentHealth - 2,
    };
    const newPlayers = [...state.players] as [PlayerState, PlayerState];
    newPlayers[playerIdx] = { ...player, hero: newHero };
    const log = [
      ...state.log,
      `${player.id === 0 ? "Jogador" : "IA"}: Sem cartas! Herói perde 2 de vida.`,
    ];
    const gs = { ...state, players: newPlayers, log };
    return checkGameOver(gs);
  }
  const [drawn, ...rest] = player.deck;
  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[playerIdx] = {
    ...player,
    hand: [...player.hand, drawn],
    deck: rest,
  };
  return { ...state, players: newPlayers };
}

export function applyDamageToCard(
  card: BattleCard,
  damage: number,
  ignoreDefense = false,
): { card: BattleCard; destroyed: boolean } {
  if (damage <= 0) return { card, destroyed: false };

  let actualDamage = damage;
  if (hasCondition(card, "vulnerable")) actualDamage += 1;
  if (hasCondition(card, "protected")) {
    actualDamage = Math.max(0, actualDamage - 2);
    card = removeCondition(card, "protected");
  }

  let def = ignoreDefense ? 0 : card.currentDefense;
  let hp = card.currentHealth;

  if (!ignoreDefense && def > 0) {
    if (actualDamage <= def) {
      actualDamage = 0;
    } else {
      actualDamage -= def;
    }
  }

  hp -= actualDamage;
  const newCard = { ...card, currentHealth: Math.max(0, hp) };
  return { card: newCard, destroyed: hp <= 0 };
}

export function checkGameOver(state: GameState): GameState {
  const p0Dead = state.players[0].hero.currentHealth <= 0;
  const p1Dead = state.players[1].hero.currentHealth <= 0;
  if (p0Dead && p1Dead)
    return {
      ...state,
      gameOver: true,
      winner: "draw",
      log: [...state.log, "Empate!"],
    };
  if (p0Dead)
    return {
      ...state,
      gameOver: true,
      winner: 1,
      log: [...state.log, "IA venceu!"],
    };
  if (p1Dead)
    return {
      ...state,
      gameOver: true,
      winner: 0,
      log: [...state.log, "Jogador venceu!"],
    };
  return state;
}

export function processStartOfTurnConditions(
  state: GameState,
  playerIdx: PlayerIndex,
): GameState {
  let s = state;
  const player = s.players[playerIdx];
  const cards = [player.hero, ...player.units];
  let newHero = player.hero;
  let newUnits = [...player.units];

  for (const card of cards) {
    const isHero = card.instanceId === player.hero.instanceId;
    let updated = { ...card };
    const toRemove: ConditionName[] = [];

    for (const cond of updated.conditions) {
      if (["burned", "poisoned", "bleeding"].includes(cond.name)) {
        const { card: damaged } = applyDamageToCard(updated, 1, true);
        updated = damaged;
        s = {
          ...s,
          log: [...s.log, `${updated.name} sofre 1 de dano por ${cond.name}.`],
        };
      }
      if (cond.name === "regenerating") {
        updated = {
          ...updated,
          currentHealth: Math.min(updated.maxHealth, updated.currentHealth + 1),
        };
        s = {
          ...s,
          log: [...s.log, `${updated.name} recupera 1 de vida (Regenerando).`],
        };
      }
    }

    updated = tickConditions(updated, playerIdx, s.currentPlayer);

    if (isHero) newHero = updated;
    else {
      const idx = newUnits.findIndex((u) => u.instanceId === card.instanceId);
      if (idx >= 0) newUnits[idx] = updated;
    }
  }

  const newPlayers = [...s.players] as [PlayerState, PlayerState];
  newPlayers[playerIdx] = { ...player, hero: newHero, units: newUnits };
  s = { ...s, players: newPlayers };

  s = cleanDeadUnits(s, playerIdx);
  s = checkGameOver(s);
  return s;
}

function tickConditions(
  card: BattleCard,
  cardOwner: PlayerIndex,
  currentPlayer: PlayerIndex,
): BattleCard {
  if (cardOwner !== currentPlayer) return card;
  const newConditions = card.conditions
    .map((c) => {
      if (c.turnsRemaining === "permanent") return c;
      if (typeof c.turnsRemaining === "number") {
        return { ...c, turnsRemaining: c.turnsRemaining - 1 };
      }
      return c;
    })
    .filter(
      (c) =>
        c.turnsRemaining === "permanent" ||
        (typeof c.turnsRemaining === "number" && c.turnsRemaining > 0),
    );
  return { ...card, conditions: newConditions };
}

export function cleanDeadUnits(
  state: GameState,
  playerIdx: PlayerIndex,
): GameState {
  const player = state.players[playerIdx];
  const alive = player.units.filter((u) => u.currentHealth > 0);
  const dead = player.units.filter((u) => u.currentHealth <= 0);
  if (dead.length === 0) return state;

  const discard = [...player.discard];
  for (const d of dead) {
    const def = getCardById(d.cardId);
    if (def) discard.push(def);
    if (d.equipment) {
      const eqDef = getCardById(d.equipment.cardId);
      if (eqDef) discard.push(eqDef);
    }
    if (d.mount) {
      const mDef = getCardById(d.mount.cardId);
      if (mDef) discard.push(mDef);
    }
  }

  const logs = dead.map((d) => `${d.name} foi derrotado!`);
  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[playerIdx] = { ...player, units: alive, discard };
  let s = { ...state, players: newPlayers, log: [...state.log, ...logs] };

  const owner = s.players[playerIdx];
  const deathDraw = owner.terrain?.effects.find(
    (e) => e.type === "drawOnAllyDeath" && e.value,
  );
  if (deathDraw) {
    for (let i = 0; i < dead.length * (deathDraw.value ?? 1); i++)
      s = drawCard(s, playerIdx);
    s = {
      ...s,
      log: [
        ...s.log,
        `${owner.terrain?.name}: comprou carta pela derrota de aliado.`,
      ],
    };
  }

  return s;
}

function revertTerrainStatBonuses(player: PlayerState): PlayerState {
  const hasAtkTerrain = player.terrain?.effects.some(
    (e) => e.type === "terrainStartOfTurn" && e.statType === "attack",
  );
  const hasDefTerrain = player.terrain?.effects.some(
    (e) => e.type === "terrainStartOfTurn" && e.statType === "defense",
  );
  return {
    ...player,
    units: player.units.map((u) => ({
      ...u,
      currentAttack: hasAtkTerrain ? u.currentAttack : u.baseAttack,
      currentDefense: hasDefTerrain ? u.currentDefense : u.baseDefense,
    })),
  };
}

export function processTerrainEffects(
  state: GameState,
  playerIdx: PlayerIndex,
): GameState {
  const player = state.players[playerIdx];
  if (!player.terrain) return state;

  let s = state;
  const terrain = player.terrain;

  for (const eff of terrain.effects) {
    if (eff.timing !== "startOfTurn") continue;

    if (eff.type === "terrainStartOfTurn") {
      if (eff.target === "allAllies" && eff.value) {
        let newHero = player.hero;
        let newUnits = [...player.units];
        const statType = eff.statType ?? "heal";

        if (statType === "heal") {
          const value = eff.value;
          newHero = {
            ...newHero,
            currentHealth: Math.min(
              newHero.maxHealth,
              newHero.currentHealth + value,
            ),
          };
          newUnits = newUnits.map((u) => ({
            ...u,
            currentHealth: Math.min(u.maxHealth, u.currentHealth + value),
          }));
          s = {
            ...s,
            log: [
              ...s.log,
              `${terrain.name}: Aliados recuperam ${value} de vida.`,
            ],
          };
        } else if (statType === "defense") {
          newUnits = newUnits.map((u) => ({
            ...u,
            currentDefense: u.baseDefense + eff.value!,
          }));
          s = {
            ...s,
            log: [
              ...s.log,
              `${terrain.name}: Aliados ganham +${eff.value} DEF.`,
            ],
          };
        } else if (statType === "attack") {
          newUnits = newUnits.map((u) => ({
            ...u,
            currentAttack: u.baseAttack + eff.value!,
          }));
          s = {
            ...s,
            log: [
              ...s.log,
              `${terrain.name}: Aliados ganham +${eff.value} ATK.`,
            ],
          };
        }
        const newPlayers = [...s.players] as [PlayerState, PlayerState];
        newPlayers[playerIdx] = { ...player, hero: newHero, units: newUnits };
        s = { ...s, players: newPlayers };
      }
    }

    if (eff.type === "applyConditionAllUnits" && eff.condition) {
      let newUnits = [...player.units];
      newUnits = newUnits.map((u) => applyCondition(u, eff.condition!));
      s = {
        ...s,
        log: [...s.log, `${terrain.name}: Aliados recebem ${eff.condition}.`],
      };
      const newPlayers = [...s.players] as [PlayerState, PlayerState];
      newPlayers[playerIdx] = { ...player, units: newUnits };
      s = { ...s, players: newPlayers };
    }

    if (eff.type === "drawCard" && eff.value) {
      for (let i = 0; i < eff.value; i++) s = drawCard(s, playerIdx);
      s = {
        ...s,
        log: [...s.log, `${terrain.name}: Compre ${eff.value} carta(s).`],
      };
    }

    if (eff.type === "reduceSpellCost") {
      const newPlayers = [...s.players] as [PlayerState, PlayerState];
      const p = s.players[playerIdx];
      newPlayers[playerIdx] = {
        ...p,
        hand: p.hand.map((c) =>
          c.type === "spell"
            ? { ...c, manaCost: Math.max(0, c.manaCost - (eff.value ?? 1)) }
            : c,
        ),
      };
      s = {
        ...s,
        players: newPlayers,
        log: [
          ...s.log,
          `${terrain.name}: Custo de feitiços reduzido em ${eff.value}.`,
        ],
      };
    }

    if (eff.type === "reduceUnitCost") {
      const newPlayers = [...s.players] as [PlayerState, PlayerState];
      const p = s.players[playerIdx];
      newPlayers[playerIdx] = {
        ...p,
        hand: p.hand.map((c) =>
          c.type === "unit"
            ? { ...c, manaCost: Math.max(0, c.manaCost - (eff.value ?? 1)) }
            : c,
        ),
      };
      s = {
        ...s,
        players: newPlayers,
        log: [
          ...s.log,
          `${terrain.name}: Custo de unidades reduzido em ${eff.value}.`,
        ],
      };
    }

    if (eff.type === "increaseUnitSlots") {
      const newPlayers = [...s.players] as [PlayerState, PlayerState];
      const p = s.players[playerIdx];
      newPlayers[playerIdx] = { ...p, unitSlotBonus: eff.value ?? 1 };
      s = { ...s, players: newPlayers };
    }
  }

  return s;
}

export function startTurn(state: GameState): GameState {
  const pi = state.currentPlayer;
  const player = state.players[pi];
  let s = state;

  // Untap all units and hero
  let newUnits = player.units.map((u) => ({
    ...u,
    exhausted: false,
    summonedThisTurn: false,
  }));
  let newHero = { ...player.hero, exhausted: false, summonedThisTurn: false };
  const newPlayers = [...s.players] as [PlayerState, PlayerState];
  newPlayers[pi] = { ...player, units: newUnits, hero: newHero };
  s = { ...s, players: newPlayers };

  // Gain mana
  const newMaxMana = Math.min(12, s.players[pi].maxMana + 1);
  const itemManaBonus = getStartOfTurnManaBonus(s.players[pi]);
  const newMana = newMaxMana + itemManaBonus;
  const mp2 = [...s.players] as [PlayerState, PlayerState];
  mp2[pi] = {
    ...s.players[pi],
    maxMana: newMaxMana,
    mana: newMana,
    manaBonusFromItems: itemManaBonus,
  };
  s = {
    ...s,
    players: mp2,
    log: [
      ...s.log,
      `--- Turno ${s.turnNumber} (${pi === 0 ? "Jogador" : "IA"}) ---`,
    ],
  };

  // Draw card
  s = drawCard(s, pi);

  // Process start of turn conditions (DOT etc.)
  s = processStartOfTurnConditions(s, pi);
  if (s.gameOver) return s;

  // Process terrain effects
  s = processTerrainEffects(s, pi);
  if (s.gameOver) return s;

  s = {
    ...s,
    phase: "main",
    turnPhase: "main",
    firstPlayerCannotAttack: false,
    extraAttackPhase: false,
  };
  return s;
}

export function spendMana(
  state: GameState,
  playerIdx: PlayerIndex,
  amount: number,
): GameState {
  const player = state.players[playerIdx];
  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[playerIdx] = { ...player, mana: player.mana - amount };
  return { ...state, players: newPlayers };
}

export function playUnit(
  state: GameState,
  playerIdx: PlayerIndex,
  cardDef: CardDefinition,
  manualRecoverFromDiscard = false,
): GameState {
  const player = state.players[playerIdx];
  if (player.mana < cardDef.manaCost) return state;
  if (player.units.length >= getUnitSlots(player)) return state;

  const unit = createBattleCard(cardDef);
  unit.summonedThisTurn = true;

  const newHand = player.hand.filter((_, i) => {
    if (player.hand.indexOf(cardDef) === i) {
      player.hand.splice(i, 1);
      return false;
    }
    return true;
  });
  // Re-filter properly
  let removed = false;
  const filteredHand = player.hand.filter((c) => {
    if (!removed && c.id === cardDef.id) {
      removed = true;
      return false;
    }
    return true;
  });

  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[playerIdx] = {
    ...player,
    hand: filteredHand,
    units: [...player.units, unit],
    mana: player.mana - cardDef.manaCost,
  };
  let s = {
    ...state,
    players: newPlayers,
    log: [...state.log, `${pi(playerIdx)} invoca ${cardDef.name}.`],
  };

  // Resolve on-summon effects
  s = resolveOnSummonEffects(s, playerIdx, unit, manualRecoverFromDiscard);
  return s;
}

function pi(idx: PlayerIndex) {
  return idx === 0 ? "Jogador" : "IA";
}

export function resolveOnSummonEffects(
  state: GameState,
  playerIdx: PlayerIndex,
  unit: BattleCard,
  manualRecoverFromDiscard = false,
): GameState {
  let s = state;
  const opponent = (1 - playerIdx) as PlayerIndex;

  for (const eff of unit.effects) {
    if (eff.timing !== "onSummon") continue;

    if (eff.type === "searchCard") {
      s = searchCardEffect(s, playerIdx, eff);
    } else if (eff.type === "applyCondition" && eff.condition) {
      if (eff.target === "ally") {
        s = {
          ...s,
          pendingEffect: {
            type: "selectAllyUnit",
            sourceCard: unit,
            effect: eff,
          },
        };
      } else if (eff.target === "hero") {
        const newP = s.players[playerIdx];
        const newHero = applyCondition(newP.hero, eff.condition);
        const newPlayers = [...s.players] as [PlayerState, PlayerState];
        newPlayers[playerIdx] = { ...newP, hero: newHero };
        s = {
          ...s,
          players: newPlayers,
          log: [...s.log, `Herói recebe ${eff.condition}.`],
        };
      }
    } else if (eff.type === "dealDamageToConditioned" && eff.condition) {
      const p = s.players[opponent];
      let newUnits = [...p.units];
      newUnits = newUnits.map((u) => {
        if (hasCondition(u, eff.condition!)) {
          const { card } = applyDamageToCard(u, eff.value ?? 2, true);
          return card;
        }
        return u;
      });
      const newPlayers = [...s.players] as [PlayerState, PlayerState];
      newPlayers[opponent] = { ...p, units: newUnits };
      s = { ...s, players: newPlayers };
      s = cleanDeadUnits(s, opponent);
    } else if (eff.type === "recoverFromDiscard") {
      if (playerIdx === 0 || manualRecoverFromDiscard) {
        s = {
          ...s,
          pendingEffect: {
            type: "selectTarget",
            sourceCard: unit,
            effect: eff,
          },
        };
      } else {
        s = aiRecoverFromDiscard(s, playerIdx, eff);
      }
    }
  }

  return s;
}

export function searchCardEffect(
  state: GameState,
  playerIdx: PlayerIndex,
  eff: CardEffect,
): GameState {
  const player = state.players[playerIdx];
  let found: CardDefinition | undefined;

  if (eff.cardName) {
    found = player.deck.find((c) => c.name === eff.cardName);
  } else if (eff.cardType) {
    found = player.deck.find((c) => c.type === eff.cardType);
  }

  if (!found) {
    return {
      ...state,
      log: [
        ...state.log,
        `Busca: ${eff.cardName || eff.cardType} não encontrado.`,
      ],
    };
  }

  const newDeck = player.deck.filter((c) => c !== found);
  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[playerIdx] = {
    ...player,
    deck: shuffle(newDeck),
    hand: [...player.hand, found!],
  };
  return {
    ...state,
    players: newPlayers,
    log: [...state.log, `Buscou ${found!.name} para a mão.`],
  };
}

function aiRecoverFromDiscard(
  state: GameState,
  playerIdx: PlayerIndex,
  eff: CardEffect,
): GameState {
  const player = state.players[playerIdx];
  const target = player.discard.find(
    (c) => !eff.cardType || c.type === eff.cardType,
  );
  if (!target) return state;
  const newDiscard = player.discard.filter((c) => c !== target);
  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[playerIdx] = {
    ...player,
    discard: newDiscard,
    deck: shuffle([...player.deck, target]),
  };
  let s = {
    ...state,
    players: newPlayers,
    log: [
      ...state.log,
      `${pi(playerIdx)} recupera ${target.name} do descarte.`,
    ],
  };
  s = processRecoverFromDiscardTriggers(s, playerIdx, target);
  return s;
}

export function playTerrain(
  state: GameState,
  playerIdx: PlayerIndex,
  cardDef: CardDefinition,
): GameState {
  const player = state.players[playerIdx];
  if (player.mana < cardDef.manaCost) return state;

  let removed = false;
  const filteredHand = player.hand.filter((c) => {
    if (!removed && c.id === cardDef.id) {
      removed = true;
      return false;
    }
    return true;
  });

  const terrain = createBattleCard(cardDef);
  const oldTerrain = player.terrain;
  const newDiscard = oldTerrain
    ? [...player.discard, getCardById(oldTerrain.cardId)!].filter(Boolean)
    : [...player.discard];

  const playerWithoutOldBonuses = revertTerrainStatBonuses({
    ...player,
    terrain: null,
  });

  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[playerIdx] = {
    ...playerWithoutOldBonuses,
    hand: filteredHand,
    terrain,
    discard: newDiscard,
    mana: player.mana - cardDef.manaCost,
    unitSlotBonus: cardDef.name === "Campo Grande" ? 1 : 0,
  };

  return {
    ...state,
    players: newPlayers,
    log: [...state.log, `${pi(playerIdx)} ativa terreno ${cardDef.name}.`],
  };
}

export function playSpell(
  state: GameState,
  playerIdx: PlayerIndex,
  cardDef: CardDefinition,
  targetId?: string,
): GameState {
  const player = state.players[playerIdx];
  if (player.mana < cardDef.manaCost) return state;

  let removed = false;
  const filteredHand = player.hand.filter((c) => {
    if (!removed && c.id === cardDef.id) {
      removed = true;
      return false;
    }
    return true;
  });

  const newDiscard = [...player.discard, cardDef];
  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[playerIdx] = {
    ...player,
    hand: filteredHand,
    discard: newDiscard,
    mana: player.mana - cardDef.manaCost,
  };
  let s = {
    ...state,
    players: newPlayers,
    log: [...state.log, `${pi(playerIdx)} usa feitiço ${cardDef.name}.`],
  };

  s = resolveSpellEffects(s, playerIdx, cardDef, targetId);
  return s;
}

export function resolveSpellEffects(
  state: GameState,
  playerIdx: PlayerIndex,
  cardDef: CardDefinition,
  targetId?: string,
): GameState {
  let s = state;
  const opponent = (1 - playerIdx) as PlayerIndex;

  for (const eff of cardDef.effects) {
    if (eff.timing !== "onPlay") continue;

    if (
      eff.type === "damage" ||
      (eff.type === "applyCondition" && eff.target === "anyUnit")
    ) {
      if (!targetId) {
        s = {
          ...s,
          pendingEffect: {
            type: "selectTarget",
            sourceCard: cardDef,
            effect: eff,
          },
        };
        return s;
      }
      if (eff.type === "damage")
        s = dealDamageToTarget(s, targetId, eff.value ?? 0, playerIdx);
      if (eff.type === "applyCondition" && eff.condition)
        s = applyConditionToTarget(s, targetId, eff.condition);
    }

    if (eff.type === "heal" && eff.target === "anyUnit") {
      if (!targetId) {
        s = {
          ...s,
          pendingEffect: {
            type: "selectTarget",
            sourceCard: cardDef,
            effect: eff,
          },
        };
        return s;
      }
      s = healTarget(s, targetId, eff.value ?? 0, playerIdx);
    }

    if (eff.type === "heal" && eff.target === "ally") {
      if (!targetId) {
        s = {
          ...s,
          pendingEffect: {
            type: "selectTarget",
            sourceCard: cardDef,
            effect: eff,
          },
        };
        return s;
      }
      s = healTarget(s, targetId, eff.value ?? 0, playerIdx);
    }

    if (eff.type === "damageAllUnits") {
      s = damageAllUnits(s, eff.value ?? 0, opponent);
    }

    if (eff.type === "healAllUnits") {
      s = healAllUnits(s, eff.value ?? 0, playerIdx);
    }

    if (eff.type === "applyConditionAllUnits" && eff.condition) {
      s = applyConditionAllUnits(
        s,
        eff.condition,
        eff.target === "allEnemies" ? opponent : playerIdx,
      );
    }

    if (eff.type === "removeAllNegativeConditions") {
      s = removeAllNegativeConditionsFromAll(s, playerIdx);
    }

    if (eff.type === "drawCard" && eff.value) {
      for (let i = 0; i < eff.value; i++) s = drawCard(s, playerIdx);
    }

    if (eff.type === "recoverFromDiscard") {
      s = {
        ...s,
        pendingEffect: {
          type: "selectTarget",
          sourceCard: cardDef,
          effect: eff,
        },
      };
      return s;
    }

    if (eff.type === "destroyTerrain") {
      const opp = s.players[opponent];
      if (opp.terrain) {
        const terrainDef = getCardById(opp.terrain.cardId);
        const newPlayers = [...s.players] as [PlayerState, PlayerState];
        const oppWithoutTerrain = {
          ...opp,
          terrain: null,
          discard: terrainDef ? [...opp.discard, terrainDef] : opp.discard,
          unitSlotBonus: 0,
        };
        newPlayers[opponent] = revertTerrainStatBonuses(oppWithoutTerrain);
        s = {
          ...s,
          players: newPlayers,
          log: [...s.log, `Terreno do oponente destruído!`],
        };
      }
    }

    if (eff.type === "attackAgain") {
      if (!targetId) {
        s = {
          ...s,
          pendingEffect: {
            type: "selectAllyUnit",
            sourceCard: cardDef,
            effect: eff,
          },
        };
        return s;
      }
    }

    if (eff.type === "allUnitsAttackTwice") {
      const newPlayers = [...s.players] as [PlayerState, PlayerState];
      const p = s.players[playerIdx];
      const newUnits = p.units.map((u) => ({ ...u, exhausted: false }));
      newPlayers[playerIdx] = {
        ...p,
        units: newUnits,
        hero: { ...p.hero, exhausted: false },
      };
      s = {
        ...s,
        players: newPlayers,
        extraAttackPhase: true,
        log: [...s.log, "Todas as unidades podem atacar novamente!"],
      };
    }

    if (eff.type === "bonusAttackPerDamageTaken" && eff.target === "ally") {
      if (!targetId) {
        s = {
          ...s,
          pendingEffect: {
            type: "selectAllyUnit",
            sourceCard: cardDef,
            effect: eff,
          },
        };
        return s;
      }
    }

    if (eff.type === "recoverEquipmentDurability" && eff.value) {
      const newPlayers = [...s.players] as [PlayerState, PlayerState];
      const p = s.players[playerIdx];
      let recovered = false;

      if (
        p.hero.equipment &&
        p.hero.equipment.currentDurability < p.hero.equipment.maxDurability
      ) {
        const newDur = Math.min(
          p.hero.equipment.maxDurability,
          p.hero.equipment.currentDurability + eff.value,
        );
        newPlayers[playerIdx] = {
          ...p,
          hero: {
            ...p.hero,
            equipment: { ...p.hero.equipment, currentDurability: newDur },
          },
        };
        recovered = true;
      } else {
        for (let i = 0; i < p.units.length; i++) {
          if (
            p.units[i].equipment &&
            p.units[i].equipment!.currentDurability <
              p.units[i].equipment!.maxDurability
          ) {
            const newDur = Math.min(
              p.units[i].equipment!.maxDurability,
              p.units[i].equipment!.currentDurability + eff.value,
            );
            const newUnits = [...p.units];
            newUnits[i] = {
              ...p.units[i],
              equipment: {
                ...p.units[i].equipment!,
                currentDurability: newDur,
              },
            };
            newPlayers[playerIdx] = { ...p, units: newUnits };
            recovered = true;
            break;
          }
        }
      }

      if (recovered) {
        s = {
          ...s,
          players: newPlayers,
          log: [...s.log, `Durabilidade do equipamento recuperada.`],
        };
      } else {
        s = {
          ...s,
          log: [...s.log, `Nenhum equipamento elegível para reparo.`],
        };
      }
    }

    if (eff.type === "removeCondition") {
      if (!targetId) {
        s = {
          ...s,
          pendingEffect: {
            type: "selectTarget",
            sourceCard: cardDef,
            effect: eff,
          },
        };
        return s;
      }
      const player = s.players[playerIdx];
      if (player.hero.instanceId === targetId) {
        const newHero = removeAllNegativeConditions(player.hero);
        const newPlayers = [...s.players] as [PlayerState, PlayerState];
        newPlayers[playerIdx] = { ...player, hero: newHero };
        s = {
          ...s,
          players: newPlayers,
          log: [...s.log, `Condições negativas removidas de ${newHero.name}.`],
        };
      } else {
        for (let i = 0; i < player.units.length; i++) {
          if (player.units[i].instanceId === targetId) {
            const newUnit = removeAllNegativeConditions(player.units[i]);
            const newUnits = [...player.units];
            newUnits[i] = newUnit;
            const newPlayers = [...s.players] as [PlayerState, PlayerState];
            newPlayers[playerIdx] = { ...player, units: newUnits };
            s = {
              ...s,
              players: newPlayers,
              log: [
                ...s.log,
                `Condições negativas removidas de ${newUnit.name}.`,
              ],
            };
            break;
          }
        }
      }
    }
  }

  return s;
}

function processOnDefendEquipment(
  state: GameState,
  targetId: string,
  defenderIdx: PlayerIndex,
): GameState {
  const player = state.players[defenderIdx];
  let s = state;

  const processCard = (card: BattleCard): BattleCard => {
    if (
      card.instanceId !== targetId ||
      !card.equipment ||
      card.equipment.currentDurability <= 0
    )
      return card;
    const eq = card.equipment;
    const onDefendEff = eq.effects.find((e) => e.timing === "onDefend");
    if (!onDefendEff) return card;

    let newCard = card;
    if (onDefendEff.type === "defenseBonus" && onDefendEff.value) {
      s = {
        ...s,
        log: [
          ...s.log,
          `${eq.name} concede +${onDefendEff.value} DEF a ${newCard.name}.`,
        ],
      };
    }

    const newDur = eq.currentDurability - 1;
    if (newDur <= 0) {
      const eqDef = getCardById(eq.cardId);
      s = { ...s, log: [...s.log, `${eq.name} destruído!`] };
      const newDiscard = eqDef ? [...player.discard, eqDef] : player.discard;
      const newPlayers = [...s.players] as [PlayerState, PlayerState];
      newPlayers[defenderIdx] = {
        ...newPlayers[defenderIdx],
        discard: newDiscard,
      };
      s = { ...s, players: newPlayers };
      const { equipment, ...cardWithoutEquipment } = newCard;
      return cardWithoutEquipment;
    }
    return { ...newCard, equipment: { ...eq, currentDurability: newDur } };
  };

  const newHero = processCard(player.hero);
  const newUnits = player.units.map(processCard);

  const newPlayers = [...s.players] as [PlayerState, PlayerState];
  newPlayers[defenderIdx] = {
    ...newPlayers[defenderIdx],
    hero: newHero,
    units: newUnits,
  };
  return { ...s, players: newPlayers };
}

function getDefenseBonus(card: BattleCard): number {
  if (!card.equipment || card.equipment.currentDurability <= 0) return 0;
  const eff = card.equipment.effects.find(
    (e) => e.type === "defenseBonus" && e.timing === "onDefend",
  );
  return eff?.value ?? 0;
}

export function dealDamageToTarget(
  state: GameState,
  targetId: string,
  damage: number,
  attackerPlayerIdx: PlayerIndex,
): GameState {
  let s = state;

  for (const pi2 of [0, 1] as PlayerIndex[]) {
    const p = s.players[pi2];
    if (p.hero.instanceId === targetId) {
      const reduction = getDefenseBonus(p.hero);
      const finalDamage = Math.max(0, damage - reduction);
      const { card, destroyed } = applyDamageToCard(p.hero, finalDamage);
      const newPlayers = [...s.players] as [PlayerState, PlayerState];
      newPlayers[pi2] = { ...p, hero: card };
      s = {
        ...s,
        players: newPlayers,
        log: [
          ...s.log,
          `${card.name} recebe ${finalDamage} de dano${reduction > 0 ? ` (reduzido por escudo: -${reduction})` : ""}. HP: ${card.currentHealth}`,
        ],
      };
      if (finalDamage > 0)
        s = processDamageDealtTriggers(s, attackerPlayerIdx, targetId);
      s = processOnDefendEquipment(s, targetId, pi2);
      s = checkGameOver(s);
      return s;
    }
    for (let i = 0; i < p.units.length; i++) {
      if (p.units[i].instanceId === targetId) {
        const reduction = getDefenseBonus(p.units[i]);
        const finalDamage = Math.max(0, damage - reduction);
        const { card, destroyed } = applyDamageToCard(p.units[i], finalDamage);
        const newUnits = [...p.units];
        newUnits[i] = card;
        const newPlayers = [...s.players] as [PlayerState, PlayerState];
        newPlayers[pi2] = { ...p, units: newUnits };
        s = {
          ...s,
          players: newPlayers,
          log: [
            ...s.log,
            `${card.name} recebe ${finalDamage} de dano${reduction > 0 ? ` (reduzido por escudo: -${reduction})` : ""}. HP: ${card.currentHealth}`,
          ],
        };
        if (finalDamage > 0)
          s = processDamageDealtTriggers(s, attackerPlayerIdx, targetId);
        s = processOnDefendEquipment(s, targetId, pi2);
        s = cleanDeadUnits(s, pi2);
        return s;
      }
    }
  }
  return s;
}

function processDamageDealtTriggers(
  state: GameState,
  attackerPlayerIdx: PlayerIndex,
  targetId: string,
): GameState {
  const terrain = state.players[attackerPlayerIdx].terrain;
  const poisonEffect = terrain?.effects.find(
    (e) => e.type === "poisonOnDamage" && e.condition,
  );
  if (!poisonEffect) return state;
  const s = applyConditionToTarget(state, targetId, poisonEffect.condition!);
  return {
    ...s,
    log: [...s.log, `${terrain?.name}: alvo recebe ${poisonEffect.condition}.`],
  };
}

function processRecoverFromDiscardTriggers(
  state: GameState,
  playerIdx: PlayerIndex,
  recoveredCard: CardDefinition,
): GameState {
  const player = state.players[playerIdx];
  const drawEffect = player.terrain?.effects.find(
    (e) => e.type === "drawOnRecoverUnit" && e.value,
  );
  if (!drawEffect || recoveredCard.type !== "unit") return state;
  let s = state;
  for (let i = 0; i < (drawEffect.value ?? 1); i++) s = drawCard(s, playerIdx);
  return {
    ...s,
    log: [
      ...s.log,
      `${player.terrain?.name}: comprou carta ao recuperar unidade.`,
    ],
  };
}

export function healTarget(
  state: GameState,
  targetId: string,
  amount: number,
  healerIdx: PlayerIndex,
): GameState {
  let s = state;
  for (const pi2 of [0, 1] as PlayerIndex[]) {
    const p = s.players[pi2];
    if (p.hero.instanceId === targetId) {
      const newHero = {
        ...p.hero,
        currentHealth: Math.min(
          p.hero.maxHealth,
          p.hero.currentHealth + amount,
        ),
      };
      const newPlayers = [...s.players] as [PlayerState, PlayerState];
      newPlayers[pi2] = { ...p, hero: newHero };
      return {
        ...s,
        players: newPlayers,
        log: [...s.log, `${newHero.name} recupera ${amount} de vida.`],
      };
    }
    for (let i = 0; i < p.units.length; i++) {
      if (p.units[i].instanceId === targetId) {
        const newCard = {
          ...p.units[i],
          currentHealth: Math.min(
            p.units[i].maxHealth,
            p.units[i].currentHealth + amount,
          ),
        };
        const newUnits = [...p.units];
        newUnits[i] = newCard;
        const newPlayers = [...s.players] as [PlayerState, PlayerState];
        newPlayers[pi2] = { ...p, units: newUnits };
        return {
          ...s,
          players: newPlayers,
          log: [...s.log, `${newCard.name} recupera ${amount} de vida.`],
        };
      }
    }
  }
  return s;
}

export function applyConditionToTarget(
  state: GameState,
  targetId: string,
  condition: ConditionName,
): GameState {
  let s = state;
  for (const pi2 of [0, 1] as PlayerIndex[]) {
    const p = s.players[pi2];
    if (p.hero.instanceId === targetId) {
      const newHero = applyCondition(p.hero, condition);
      const newPlayers = [...s.players] as [PlayerState, PlayerState];
      newPlayers[pi2] = { ...p, hero: newHero };
      return {
        ...s,
        players: newPlayers,
        log: [...s.log, `${newHero.name} recebe condição ${condition}.`],
      };
    }
    for (let i = 0; i < p.units.length; i++) {
      if (p.units[i].instanceId === targetId) {
        const newCard = applyCondition(p.units[i], condition);
        const newUnits = [...p.units];
        newUnits[i] = newCard;
        const newPlayers = [...s.players] as [PlayerState, PlayerState];
        newPlayers[pi2] = { ...p, units: newUnits };
        return {
          ...s,
          players: newPlayers,
          log: [...s.log, `${newCard.name} recebe condição ${condition}.`],
        };
      }
    }
  }
  return s;
}

export function damageAllUnits(
  state: GameState,
  damage: number,
  targetPlayerIdx: PlayerIndex,
): GameState {
  const p = state.players[targetPlayerIdx];
  let newUnits = p.units.map((u) => {
    const { card } = applyDamageToCard(u, damage);
    return card;
  });
  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[targetPlayerIdx] = { ...p, units: newUnits };
  let s = {
    ...state,
    players: newPlayers,
    log: [
      ...state.log,
      `Feitiço em área: ${damage} de dano a todas as unidades inimigas.`,
    ],
  };
  s = cleanDeadUnits(s, targetPlayerIdx);
  return s;
}

export function healAllUnits(
  state: GameState,
  amount: number,
  playerIdx: PlayerIndex,
): GameState {
  const p = state.players[playerIdx];
  const newUnits = p.units.map((u) => ({
    ...u,
    currentHealth: Math.min(u.maxHealth, u.currentHealth + amount),
  }));
  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[playerIdx] = { ...p, units: newUnits };
  return {
    ...state,
    players: newPlayers,
    log: [
      ...state.log,
      `Feitiço em área: ${amount} de cura a todas as unidades aliadas.`,
    ],
  };
}

export function applyConditionAllUnits(
  state: GameState,
  condition: ConditionName,
  playerIdx: PlayerIndex,
): GameState {
  const p = state.players[playerIdx];
  const newUnits = p.units.map((u) => applyCondition(u, condition));
  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[playerIdx] = { ...p, units: newUnits };
  return {
    ...state,
    players: newPlayers,
    log: [...state.log, `Condição ${condition} aplicada a todas as unidades.`],
  };
}

export function removeAllNegativeConditionsFromAll(
  state: GameState,
  playerIdx: PlayerIndex,
): GameState {
  const p = state.players[playerIdx];
  const newUnits = p.units.map((u) => removeAllNegativeConditions(u));
  const newHero = removeAllNegativeConditions(p.hero);
  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[playerIdx] = { ...p, units: newUnits, hero: newHero };
  return {
    ...state,
    players: newPlayers,
    log: [...state.log, `Condições negativas removidas de todos os aliados.`],
  };
}

export function attachEquipment(
  state: GameState,
  playerIdx: PlayerIndex,
  cardDef: CardDefinition,
  targetId: string,
): GameState {
  const player = state.players[playerIdx];
  if (player.mana < cardDef.manaCost) return state;
  if (cardDef.heroOnly && player.hero.instanceId !== targetId) {
    return {
      ...state,
      log: [...state.log, `${cardDef.name} só pode ser equipado no herói!`],
    };
  }

  // Check if target already has equipment
  const hasEquipment =
    player.hero.instanceId === targetId
      ? !!player.hero.equipment
      : player.units.some((u) => u.instanceId === targetId && u.equipment);

  if (hasEquipment) {
    return { ...state, log: [...state.log, `Alvo já possui um equipamento!`] };
  }

  let removed = false;
  const filteredHand = player.hand.filter((c) => {
    if (!removed && c.id === cardDef.id) {
      removed = true;
      return false;
    }
    return true;
  });

  const item: AttachedItem = {
    cardId: cardDef.id,
    name: cardDef.name,
    currentDurability: cardDef.durability ?? 0,
    maxDurability: cardDef.maxDurability ?? cardDef.durability ?? 0,
    effects: cardDef.effects,
  };

  let newHero = player.hero;
  let newUnits = [...player.units];
  let found = false;

  if (player.hero.instanceId === targetId) {
    newHero = { ...player.hero, equipment: item };
    found = true;
  } else {
    for (let i = 0; i < newUnits.length; i++) {
      if (newUnits[i].instanceId === targetId) {
        newUnits[i] = { ...newUnits[i], equipment: item };
        found = true;
        break;
      }
    }
  }

  if (!found) return state;

  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[playerIdx] = {
    ...player,
    hand: filteredHand,
    hero: newHero,
    units: newUnits,
    mana: player.mana - cardDef.manaCost,
  };
  return {
    ...state,
    players: newPlayers,
    log: [...state.log, `${pi(playerIdx)} equipa ${cardDef.name}.`],
  };
}

export function attachMount(
  state: GameState,
  playerIdx: PlayerIndex,
  cardDef: CardDefinition,
  targetId: string,
): GameState {
  const player = state.players[playerIdx];
  if (player.mana < cardDef.manaCost) return state;
  if (cardDef.heroOnly && player.hero.instanceId !== targetId) {
    return {
      ...state,
      log: [...state.log, `${cardDef.name} só pode ser equipado no herói!`],
    };
  }

  // Check if target already has a mount
  const hasMount =
    player.hero.instanceId === targetId
      ? !!player.hero.mount
      : player.units.some((u) => u.instanceId === targetId && u.mount);

  if (hasMount) {
    return { ...state, log: [...state.log, `Alvo já possui uma montaria!`] };
  }

  let removed = false;
  const filteredHand = player.hand.filter((c) => {
    if (!removed && c.id === cardDef.id) {
      removed = true;
      return false;
    }
    return true;
  });

  const item: AttachedItem = {
    cardId: cardDef.id,
    name: cardDef.name,
    currentDurability: cardDef.durability ?? 0,
    maxDurability: cardDef.maxDurability ?? cardDef.durability ?? 0,
    effects: cardDef.effects,
  };

  let newHero = player.hero;
  let newUnits = [...player.units];
  let found = false;

  if (player.hero.instanceId === targetId) {
    newHero = { ...player.hero, mount: item };
    found = true;
  } else {
    for (let i = 0; i < newUnits.length; i++) {
      if (newUnits[i].instanceId === targetId) {
        newUnits[i] = { ...newUnits[i], mount: item };
        found = true;
        break;
      }
    }
  }

  if (!found) return state;

  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[playerIdx] = {
    ...player,
    hand: filteredHand,
    hero: newHero,
    units: newUnits,
    mana: player.mana - cardDef.manaCost,
  };
  return {
    ...state,
    players: newPlayers,
    log: [...state.log, `${pi(playerIdx)} monta ${cardDef.name}.`],
  };
}

export function resolveAttack(
  state: GameState,
  attackerPlayerIdx: PlayerIndex,
  attackerIds: string[],
  targetId: string,
): GameState {
  const attackerPlayer = state.players[attackerPlayerIdx];
  const defenderPlayerIdx = (1 - attackerPlayerIdx) as PlayerIndex;
  const defenderPlayer = state.players[defenderPlayerIdx];

  let attackers: BattleCard[] = [];
  let allUnits = [...attackerPlayer.units];
  let attackerHero = attackerPlayer.hero;

  for (const aid of attackerIds) {
    if (attackerPlayer.hero.instanceId === aid) {
      attackers.push(attackerPlayer.hero);
    } else {
      const u = attackerPlayer.units.find((u) => u.instanceId === aid);
      if (u) attackers.push(u);
    }
  }

  if (attackers.length === 0) return state;

  // Calculate total damage
  let totalDamage = 0;
  for (const atk of attackers) {
    totalDamage += getAttackDamage(atk);
  }

  // Apply damage to target
  let s = state;
  s = dealDamageToTarget(s, targetId, totalDamage, attackerPlayerIdx);

  // Exhaust attackers, reduce equipment durability
  const newAttackerPlayer = s.players[attackerPlayerIdx];
  let newHeroAtkr = newAttackerPlayer.hero;
  let newUnitsAtkr = [...newAttackerPlayer.units];

  for (const aid of attackerIds) {
    if (newHeroAtkr.instanceId === aid) {
      newHeroAtkr = { ...newHeroAtkr, exhausted: true };
      if (newHeroAtkr.equipment) {
        const hasOnAttackEffect = newHeroAtkr.equipment.effects.some(
          (e) => e.timing === "onAttack",
        );
        if (hasOnAttackEffect && newHeroAtkr.equipment.currentDurability > 0) {
          const newDur = newHeroAtkr.equipment.currentDurability - 1;
          if (newDur <= 0) {
            const eqDef = getCardById(newHeroAtkr.equipment.cardId);
            newHeroAtkr = { ...newHeroAtkr, equipment: undefined };
            const newPlayers2 = [...s.players] as [PlayerState, PlayerState];
            newPlayers2[attackerPlayerIdx] = {
              ...newAttackerPlayer,
              hero: newHeroAtkr,
              discard: eqDef
                ? [...newAttackerPlayer.discard, eqDef]
                : newAttackerPlayer.discard,
            };
            s = { ...s, players: newPlayers2 };
          } else {
            newHeroAtkr = {
              ...newHeroAtkr,
              equipment: {
                ...newHeroAtkr.equipment,
                currentDurability: newDur,
              },
            };
          }
        }
      }
      if (newHeroAtkr.mount) {
        const mountEff = newHeroAtkr.mount.effects.find(
          (e) => e.timing === "onAttack",
        );
        if (mountEff) {
          if (mountEff.type === "applyCondition" && mountEff.condition) {
            s = applyConditionToTarget(
              s,
              mountEff.target === "self" ? aid : targetId,
              mountEff.condition,
            );
          }
          const newDur = newHeroAtkr.mount.currentDurability - 1;
          newHeroAtkr =
            newDur <= 0
              ? { ...newHeroAtkr, mount: undefined }
              : {
                  ...newHeroAtkr,
                  mount: { ...newHeroAtkr.mount, currentDurability: newDur },
                };
        }
      }
    } else {
      for (let i = 0; i < newUnitsAtkr.length; i++) {
        if (newUnitsAtkr[i].instanceId === aid) {
          newUnitsAtkr[i] = { ...newUnitsAtkr[i], exhausted: true };
          if (newUnitsAtkr[i].equipment) {
            const hasOnAttackEffect = newUnitsAtkr[i].equipment!.effects.some(
              (e) => e.timing === "onAttack",
            );
            if (
              hasOnAttackEffect &&
              newUnitsAtkr[i].equipment!.currentDurability > 0
            ) {
              const newDur = newUnitsAtkr[i].equipment!.currentDurability - 1;
              if (newDur <= 0) {
                const eqDef = getCardById(newUnitsAtkr[i].equipment!.cardId);
                newUnitsAtkr[i] = { ...newUnitsAtkr[i], equipment: undefined };
                const np = s.players[attackerPlayerIdx];
                const newPlayers2 = [...s.players] as [
                  PlayerState,
                  PlayerState,
                ];
                newPlayers2[attackerPlayerIdx] = {
                  ...np,
                  discard: eqDef ? [...np.discard, eqDef] : np.discard,
                };
                s = { ...s, players: newPlayers2 };
              } else {
                newUnitsAtkr[i] = {
                  ...newUnitsAtkr[i],
                  equipment: {
                    ...newUnitsAtkr[i].equipment!,
                    currentDurability: newDur,
                  },
                };
              }
            }
          }
          if (newUnitsAtkr[i].mount) {
            const mountEff = newUnitsAtkr[i].mount!.effects.find(
              (e) => e.timing === "onAttack",
            );
            if (mountEff) {
              if (mountEff.type === "applyCondition" && mountEff.condition) {
                s = applyConditionToTarget(
                  s,
                  mountEff.target === "self" ? aid : targetId,
                  mountEff.condition,
                );
              }
              const newDur = newUnitsAtkr[i].mount!.currentDurability - 1;
              newUnitsAtkr[i] =
                newDur <= 0
                  ? { ...newUnitsAtkr[i], mount: undefined }
                  : {
                      ...newUnitsAtkr[i],
                      mount: {
                        ...newUnitsAtkr[i].mount!,
                        currentDurability: newDur,
                      },
                    };
            }
          }
        }
      }
    }
  }

  const finalPlayers = [...s.players] as [PlayerState, PlayerState];
  finalPlayers[attackerPlayerIdx] = {
    ...s.players[attackerPlayerIdx],
    hero: newHeroAtkr,
    units: newUnitsAtkr,
  };
  s = { ...s, players: finalPlayers };

  // Restore defender DEF (it's a stat not temp reduction, so it's already base)
  return s;
}

export function canAttackTarget(
  state: GameState,
  attackerPlayerIdx: PlayerIndex,
  attacker: BattleCard,
  targetId: string,
): boolean {
  const defenderPlayerIdx = (1 - attackerPlayerIdx) as PlayerIndex;
  const defender = state.players[defenderPlayerIdx];
  const hasReadyUnits = defender.units.some((u) => !u.exhausted);

  const targetIsHero = defender.hero.instanceId === targetId;
  const targetIsUnit = defender.units.some((u) => u.instanceId === targetId);

  if (targetIsHero) {
    if (!hasReadyUnits) return true;
    if (hasCondition(attacker, "stealth")) return true;
    return false;
  }

  if (targetIsUnit) return true;
  return false;
}

export function endTurn(state: GameState): GameState {
  const currentPlayer = state.currentPlayer;
  const nextPlayer = (1 - currentPlayer) as PlayerIndex;
  const nextTurn = nextPlayer === 0 ? state.turnNumber + 1 : state.turnNumber;

  const s = {
    ...state,
    currentPlayer: nextPlayer,
    turnNumber: nextTurn,
    phase: "main" as GamePhase,
    firstPlayerCannotAttack: false,
    extraAttackPhase: false,
    log: [...state.log],
  };

  return startTurn(s);
}

export function activateAbility(
  state: GameState,
  playerIdx: PlayerIndex,
  unitInstanceId: string,
  manualRecoverFromDiscard = false,
): GameState {
  const player = state.players[playerIdx];
  const unitIdx = player.units.findIndex(
    (u) => u.instanceId === unitInstanceId,
  );
  if (unitIdx < 0) return state;
  const unit = player.units[unitIdx];
  if (unit.exhausted) return state;
  if (hasCondition(unit, "silenced"))
    return { ...state, log: [...state.log, `${unit.name} está silenciado!`] };

  const activatedEffects = unit.effects.filter((e) => e.timing === "activated");
  if (activatedEffects.length === 0) return state;

  const newUnits = [...player.units];
  newUnits[unitIdx] = { ...unit, exhausted: true };
  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[playerIdx] = { ...player, units: newUnits };
  let s = {
    ...state,
    players: newPlayers,
    log: [...state.log, `${unit.name} ativa habilidade.`],
  };

  for (const eff of activatedEffects) {
    if (eff.type === "recoverFromDiscard") {
      if (playerIdx === 0 || manualRecoverFromDiscard) {
        s = {
          ...s,
          pendingEffect: {
            type: "selectTarget",
            sourceCard: unit,
            effect: eff,
          },
        };
        return s;
      } else {
        s = aiRecoverFromDiscard(s, playerIdx, eff);
      }
    }

    if (eff.type === "heal" && eff.target === "ally") {
      if (playerIdx === 0) {
        s = {
          ...s,
          pendingEffect: {
            type: "selectAllyUnit",
            sourceCard: unit,
            effect: eff,
          },
        };
        return s;
      } else {
        const target = s.players[playerIdx].units.find(
          (u) => u.instanceId !== unitInstanceId,
        );
        if (target)
          s = healTarget(s, target.instanceId, eff.value ?? 0, playerIdx);
      }
    }

    if (eff.type === "attackAgain") {
      if (playerIdx === 0) {
        s = {
          ...s,
          pendingEffect: {
            type: "selectAllyUnit",
            sourceCard: unit,
            effect: eff,
          },
        };
        return s;
      }
    }

    if (eff.type === "attackBonus") {
      if (playerIdx === 0) {
        s = {
          ...s,
          pendingEffect: {
            type: "selectAllyUnit",
            sourceCard: unit,
            effect: eff,
          },
        };
        return s;
      } else {
        const target =
          s.players[playerIdx].units.find(
            (u) => u.instanceId !== unitInstanceId,
          ) ?? s.players[playerIdx].units[unitIdx];
        if (target) {
          const p = s.players[playerIdx];
          const newUnits = p.units.map((u) =>
            u.instanceId === target.instanceId
              ? { ...u, currentAttack: u.currentAttack + (eff.value ?? 0) }
              : u,
          );
          const newPlayers = [...s.players] as [PlayerState, PlayerState];
          newPlayers[playerIdx] = { ...p, units: newUnits };
          s = {
            ...s,
            players: newPlayers,
            log: [...s.log, `${target.name} recebe +${eff.value ?? 0} ATK.`],
          };
        }
      }
    }

    if (eff.type === "damage" && eff.target === "ally") {
      if (playerIdx === 0) {
        s = {
          ...s,
          pendingEffect: {
            type: "selectAllyUnit",
            sourceCard: unit,
            effect: eff,
          },
        };
        return s;
      }
    }
  }

  return s;
}

export function resolveRecoverFromDiscard(
  state: GameState,
  playerIdx: PlayerIndex,
  cardId: string,
  eff: CardEffect,
): GameState {
  const player = state.players[playerIdx];
  const cardDef = player.discard.find((c) => c.id === cardId);
  if (!cardDef)
    return {
      ...state,
      log: [...state.log, "Carta não encontrada no descarte."],
    };

  const newDiscard = player.discard.filter((c) => c !== cardDef);

  if (eff.type === "recoverFromDiscard") {
    const newPlayers = [...state.players] as [PlayerState, PlayerState];
    newPlayers[playerIdx] = {
      ...player,
      discard: newDiscard,
      deck: shuffle([...player.deck, cardDef]),
    };
    let s: GameState = {
      ...state,
      players: newPlayers,
      log: [...state.log, `${cardDef.name} recuperado do descarte.`],
      pendingEffect: null,
    };
    s = processRecoverFromDiscardTriggers(s, playerIdx, cardDef);
    return s;
  }

  return state;
}

export function getValidAttackTargets(
  state: GameState,
  attackerPlayerIdx: PlayerIndex,
  attacker: BattleCard,
): string[] {
  const defenderPlayerIdx = (1 - attackerPlayerIdx) as PlayerIndex;
  const defender = state.players[defenderPlayerIdx];
  const hasReadyUnits = defender.units.some((u) => !u.exhausted);
  const hasStealth = hasCondition(attacker, "stealth");

  if (!hasReadyUnits || hasStealth) {
    return [
      defender.hero.instanceId,
      ...defender.units.map((u) => u.instanceId),
    ];
  }

  return defender.units.map((u) => u.instanceId);
}
