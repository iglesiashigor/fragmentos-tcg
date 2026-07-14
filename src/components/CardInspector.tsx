import React from 'react';
import { CardDefinition, BattleCard, AttachedItem, CardEffect, CardType, ConditionName } from '../types/game';
import { Shield, Sword, Heart, Zap, Star, Leaf, X } from 'lucide-react';

interface CardInspectorProps {
  card: CardDefinition | BattleCard | null;
  onClose: () => void;
}

function isBattle(card: CardDefinition | BattleCard): card is BattleCard {
  return 'instanceId' in card;
}

const CONDITION_INFO: Record<ConditionName, { label: string; color: string; desc: string }> = {
  burned: { label: 'Queimado', color: 'text-orange-400', desc: '1 dano/turno (ignora DEF)' },
  poisoned: { label: 'Envenenado', color: 'text-green-400', desc: '1 dano/turno (ignora DEF)' },
  bleeding: { label: 'Sangrando', color: 'text-red-400', desc: '1 dano/turno (ignora DEF)' },
  frozen: { label: 'Congelado', color: 'text-blue-300', desc: 'Não pode atacar (1 turno)' },
  paralyzed: { label: 'Paralisado', color: 'text-yellow-400', desc: 'Não pode atacar (1 turno)' },
  silenced: { label: 'Silenciado', color: 'text-gray-400', desc: 'Não pode ativar efeito (1 turno)' },
  weakened: { label: 'Enfraquecido', color: 'text-red-300', desc: '-2 ATK (1 turno)' },
  defenseless: { label: 'Indefeso', color: 'text-orange-300', desc: '-2 DEF (1 turno)' },
  vulnerable: { label: 'Vulnerável', color: 'text-purple-400', desc: '+1 dano sofrido (1 turno)' },
  inspired: { label: 'Inspirado', color: 'text-amber-300', desc: '+2 ATK (1 turno)' },
  fortified: { label: 'Fortificado', color: 'text-cyan-300', desc: '+2 DEF (1 turno)' },
  regenerating: { label: 'Regenerando', color: 'text-emerald-300', desc: '+1 vida/turno (1 turno)' },
  protected: { label: 'Protegido', color: 'text-blue-300', desc: '-2 próximo dano' },
  immune: { label: 'Imune', color: 'text-violet-300', desc: 'Imune a condições negativas (1 turno)' },
  stealth: { label: 'Furtivo', color: 'text-gray-300', desc: 'Pode atacar herói direto (1 turno)' },
};

const TYPE_LABELS: Record<CardType, string> = {
  hero: 'Herói', unit: 'Unidade', terrain: 'Terreno',
  equipment: 'Equipamento', mount: 'Montaria', spell: 'Feitiço', mana: 'Mana',
};

const CARD_TYPE_EFFECT_LABELS: Record<CardType, string> = {
  hero: 'herói',
  unit: 'unidade',
  terrain: 'terreno',
  equipment: 'equipamento',
  mount: 'montaria',
  spell: 'feitiço',
  mana: 'mana',
};

const TIMING_LABELS: Record<NonNullable<CardEffect['timing']>, string> = {
  onPlay: 'Ao usar',
  onSummon: 'Ao invocar',
  activated: 'Ativado',
  startOfTurn: 'Início do turno',
  onAttack: 'Ao atacar',
  onDefend: 'Ao defender',
  onDeath: 'Ao morrer',
  onDamageDealt: 'Ao causar dano',
};

const TARGET_LABELS: Record<NonNullable<CardEffect['target']>, string> = {
  self: 'a si mesmo',
  ally: 'um aliado',
  enemy: 'um inimigo',
  allAllies: 'todos os aliados',
  allEnemies: 'todos os inimigos',
  allUnits: 'todas as unidades',
  hero: 'o herói',
  anyUnit: 'uma unidade ou herói',
};

function AttachedItemInfo({ item, label }: { item: AttachedItem; label: string }) {
  return (
    <div className="bg-gray-800 rounded p-2 mb-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs text-white font-medium">{item.name}</span>
      </div>
      <div className="flex gap-1 text-xs">
        <span className="text-amber-400">Durabilidade:</span>
        <span className="text-white">{item.currentDurability}/{item.maxDurability}</span>
      </div>
    </div>
  );
}

export default function CardInspector({ card, onClose }: CardInspectorProps) {
  if (!card) return null;

  const bc = isBattle(card) ? card : null;
  const isHero = card.type === 'hero';
  const showsCombatStats = card.type === 'hero' || card.type === 'unit';

  const attack = bc ? bc.currentAttack : (card as CardDefinition).attack;
  const defense = bc ? bc.currentDefense : (card as CardDefinition).defense;
  const health = bc ? bc.currentHealth : (card as CardDefinition).health;
  const maxHealth = bc ? bc.maxHealth : (card as CardDefinition).health;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-950 border border-slate-700 rounded-2xl w-96 max-w-full max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/40"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950">
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">{card.name}</h2>
            <div className="flex gap-2 mt-1">
              <span className="text-xs text-slate-400">{TYPE_LABELS[card.type]}</span>
              {bc?.tier && <span className="text-xs text-amber-400">{bc.tier === 'weak' ? 'Fraca' : bc.tier === 'medium' ? 'Média' : 'Forte'}</span>}
              {(card as CardDefinition).tier && !bc && <span className="text-xs text-amber-400">{(card as CardDefinition).tier === 'weak' ? 'Fraca' : (card as CardDefinition).tier === 'medium' ? 'Média' : 'Forte'}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Mana cost */}
          <div className="flex gap-4">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{card.manaCost}</span>
              </div>
              <span className="text-slate-400 text-xs">Mana</span>
            </div>
            {bc?.exhausted && <span className="text-yellow-400 text-xs">Exausto</span>}
            {bc?.summonedThisTurn && <span className="text-orange-400 text-xs">Invocado agora</span>}
          </div>

          {/* Stats */}
          {showsCombatStats && (attack !== undefined || defense !== undefined || health !== undefined) && (
            <div className="grid grid-cols-3 gap-2">
              {attack !== undefined && (
                <div className="bg-red-950/50 border border-red-700/30 rounded-lg p-2 text-center">
                  <Sword className="w-4 h-4 text-red-400 mx-auto mb-1" />
                  <div className="text-white font-bold text-lg">{attack}</div>
                  <div className="text-slate-400 text-xs">ATK</div>
                </div>
              )}
              {defense !== undefined && (
                <div className="bg-blue-950/50 border border-blue-700/30 rounded-lg p-2 text-center">
                  <Shield className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                  <div className="text-white font-bold text-lg">{defense}</div>
                  <div className="text-slate-400 text-xs">DEF</div>
                </div>
              )}
              {health !== undefined && (
                <div className="bg-green-950/50 border border-green-700/30 rounded-lg p-2 text-center">
                  <Heart className="w-4 h-4 text-green-400 mx-auto mb-1" />
                  <div className="text-white font-bold text-lg">{health}{maxHealth && health !== maxHealth ? `/${maxHealth}` : ''}</div>
                  <div className="text-slate-400 text-xs">VID</div>
                </div>
              )}
            </div>
          )}

          {/* Attached items */}
          {bc?.equipment && <AttachedItemInfo item={bc.equipment} label="Equipamento" />}
          {bc?.mount && <AttachedItemInfo item={bc.mount} label="Montaria" />}

          {/* Effects */}
          {card.effects.length > 0 && (
            <div>
              <h3 className="text-slate-400 text-xs uppercase tracking-wide mb-2">Efeitos</h3>
              <div className="space-y-1">
                {card.effects.map((eff, i) => (
                  <div key={i} className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 leading-relaxed">
                    {formatEffect(eff)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conditions */}
          {bc && bc.conditions.length > 0 && (
            <div>
              <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Condições</h3>
              <div className="space-y-1">
                {bc.conditions.map(cond => {
                  const info = CONDITION_INFO[cond.name];
                  return (
                    <div key={cond.name} className="flex items-center justify-between bg-gray-800 rounded p-2">
                      <div>
                        <span className={`text-xs font-medium ${info.color}`}>{info.label}</span>
                        <p className="text-gray-400 text-xs">{info.desc}</p>
                      </div>
                      <span className="text-gray-500 text-xs">
                        {cond.turnsRemaining === 'permanent' ? '∞' : `${cond.turnsRemaining}t`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Flavor text */}
          {(card as CardDefinition).flavorText && (
            <p className="text-gray-500 text-xs italic border-t border-gray-700 pt-3">
              {(card as CardDefinition).flavorText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatEffect(eff: CardEffect): string {
  const timing = eff.timing ? TIMING_LABELS[eff.timing] : '';
  const target = eff.target ? TARGET_LABELS[eff.target] : 'o alvo';
  const condition = eff.condition ? CONDITION_INFO[eff.condition].label : 'condição';
  const cardType = eff.cardType ? CARD_TYPE_EFFECT_LABELS[eff.cardType] : 'carta';
  const value = eff.value ?? 0;

  const desc = (() => {
    switch (eff.type) {
      case 'damage':
        return `Causa ${value} de dano a ${target}.`;
      case 'heal':
        return `Cura ${value} de vida de ${target}.`;
      case 'defenseBonus':
        return `Concede +${value} DEF ao defender.`;
      case 'applyCondition':
        return `Aplica ${condition} a ${target}.`;
      case 'removeCondition':
        return `Remove uma condição negativa de ${target}.`;
      case 'removeAllNegativeConditions':
        return 'Remove todas as condições negativas dos aliados.';
      case 'drawCard':
        return `Compre ${formatCount(eff.value ?? 1, 'carta')}.`;
      case 'searchCard':
        return eff.cardName
          ? `Busca ${eff.cardName} no baralho e coloca na mão.`
          : `Busca uma carta do tipo ${cardType} no baralho e coloca na mão.`;
      case 'recoverFromDiscard':
        return `Recupera uma carta do tipo ${cardType} do descarte.`;
      case 'dealDamageToConditioned':
        return `Causa ${eff.value ?? 2} de dano a inimigos com ${condition}.`;
      case 'attackAgain':
        return 'Permite que um aliado que já atacou ataque novamente neste turno.';
      case 'attackTwice':
        return 'Permite que um aliado ataque duas vezes neste turno.';
      case 'allUnitsAttackTwice':
        return 'Permite que suas unidades que já atacaram ataquem novamente neste turno.';
      case 'damageAllUnits':
        return `Causa ${value} de dano a todas as unidades inimigas.`;
      case 'healAllUnits':
        return `Cura ${value} de vida de todos os aliados.`;
      case 'applyConditionAllUnits':
        return `Aplica ${condition} a ${target}.`;
      case 'removeConditionAllUnits':
        return 'Remove condições das unidades escolhidas.';
      case 'increaseMana':
        return `Aumenta sua mana máxima em ${eff.value ?? 1} enquanto estiver equipado.`;
      case 'increaseUnitSlots':
        return `Aumenta o limite de unidades em campo em ${eff.value ?? 1}.`;
      case 'reduceSpellCost':
        return `Reduz em ${eff.value ?? 1} o custo dos feitiços na sua mão.`;
      case 'reduceUnitCost':
        return `Reduz em ${eff.value ?? 1} o custo das unidades na sua mão.`;
      case 'terrainStartOfTurn':
        if (eff.statType === 'attack') return `Concede +${value} ATK a todos os aliados.`;
        if (eff.statType === 'defense') return `Concede +${value} DEF a todos os aliados.`;
        return `Cura ${value} de vida de todos os aliados.`;
      case 'destroyTerrain':
        return 'Destrói o terreno do oponente.';
      case 'recoverEquipmentDurability':
        return `Recupera ${eff.value ?? 1} de durabilidade de um equipamento aliado.`;
      case 'bonusAttackPerDamageTaken':
        return 'Concede ATK igual ao dano que o aliado já sofreu.';
      case 'attackBonus':
        return `Concede +${eff.value ?? 0} ATK a um aliado.`;
      case 'poisonOnDamage':
        return `Quando um aliado causa dano, aplica ${condition} ao alvo.`;
      case 'drawOnAllyDeath':
        return `Quando um aliado morre, compre ${formatCount(eff.value ?? 1, 'carta')}.`;
      case 'drawOnRecoverUnit':
        return `Quando recuperar uma unidade do descarte, compre ${formatCount(eff.value ?? 1, 'carta')}.`;
      default:
        return eff.type;
    }
  })();

  return timing ? `[${timing}] ${desc}` : desc;
}

function formatCount(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}
