import React from 'react';
import { CardDefinition, BattleCard, AttachedItem, ConditionName } from '../types/game';
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

const TYPE_LABELS: Record<string, string> = {
  hero: 'Herói', unit: 'Unidade', terrain: 'Terreno',
  equipment: 'Equipamento', mount: 'Montaria', spell: 'Feitiço', mana: 'Mana',
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

function formatEffect(eff: any): string {
  const timingMap: Record<string, string> = {
    onPlay: 'Ao usar',
    onSummon: 'Ao ser invocado',
    activated: 'Ativado (exausta)',
    startOfTurn: 'Início do turno',
    onAttack: 'Ao atacar',
    onDefend: 'Ao defender',
    onDeath: 'Ao morrer',
    onDamageDealt: 'Ao causar dano',
  };
  const timing = timingMap[eff.timing] || eff.timing || '';

  const effectDesc: Record<string, string> = {
    damage: `Causa ${eff.value ?? 0} de dano`,
    heal: `Cura ${eff.value ?? 0} de vida`,
    defenseBonus: `+${eff.value ?? 0} DEF ao receber ataque`,
    applyCondition: `Aplica condição: ${eff.condition}`,
    removeCondition: `Remove condição negativa`,
    removeAllNegativeConditions: `Remove todas as condições negativas dos aliados`,
    drawCard: `Compre ${eff.value ?? 1} carta(s)`,
    searchCard: `Busque ${eff.cardName || eff.cardType || 'uma carta'} do baralho`,
    recoverFromDiscard: `Recupere ${eff.cardType || 'uma carta'} do descarte`,
    dealDamageToConditioned: `Causa ${eff.value ?? 2} de dano a inimigos com ${eff.condition}`,
    attackAgain: `Uma unidade ataca novamente`,
    attackTwice: `Uma unidade ataca duas vezes`,
    allUnitsAttackTwice: `Unidades atacam duas vezes neste turno`,
    damageAllUnits: `Causa ${eff.value ?? 0} de dano a todas as unidades`,
    healAllUnits: `Cura ${eff.value ?? 0} de vida de todas as unidades aliadas`,
    applyConditionAllUnits: `Aplica ${eff.condition} a todas as unidades`,
    removeConditionAllUnits: `Remove condições das unidades`,
    increaseMana: `+${eff.value ?? 1} de mana`,
    increaseUnitSlots: `+${eff.value ?? 1} espaço de unidade`,
    reduceSpellCost: `Reduz custo de feitiços em ${eff.value ?? 1}`,
    reduceUnitCost: `Reduz custo de unidades em ${eff.value ?? 1}`,
    terrainStartOfTurn: (() => {
      const statType = eff.statType ?? 'heal';
      const v = eff.value ?? 0;
      if (statType === 'attack') return `+${v} ATK para todos os aliados`;
      if (statType === 'defense') return `+${v} DEF para todos os aliados`;
      return `Cura ${v} de vida de todos os aliados`;
    })(),
    destroyTerrain: `Destrói o terreno do oponente`,
    recoverEquipmentDurability: `Recupera ${eff.value ?? 1} de durabilidade de um equipamento`,
    bonusAttackPerDamageTaken: `+1 ATK para cada dano sofrido pela unidade`,
  };

  const desc = effectDesc[eff.type] || eff.type;
  return timing ? `[${timing}] ${desc}` : desc;
}
