import React from 'react';
import { CardDefinition, BattleCard, AttachedItem, ConditionName } from '../types/game';
import { Shield, Sword, Heart, Zap, Star, Leaf, Flame, Snowflake, Wind, Eye, AlertCircle, Droplet, Sun, Moon, Sparkles } from 'lucide-react';
import { getEquipmentAttackBonus } from '../engine/gameEngine';

interface CardDisplayProps {
  card: CardDefinition | BattleCard;
  isBattleCard?: boolean;
  isSelected?: boolean;
  isValidTarget?: boolean;
  isPlayable?: boolean;
  isExhausted?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showBack?: boolean;
  cosmeticFrame?: string;
  playableTone?: string;
}

const CONDITION_CONFIG: Record<ConditionName, { color: string; icon: React.ReactNode }> = {
  burned: { color: 'bg-orange-500 border-orange-400', icon: <Flame className="w-3 h-3" /> },
  poisoned: { color: 'bg-green-600 border-green-400', icon: <Droplet className="w-3 h-3" /> },
  bleeding: { color: 'bg-red-600 border-red-400', icon: <Heart className="w-3 h-3" /> },
  frozen: { color: 'bg-blue-400 border-blue-300', icon: <Snowflake className="w-3 h-3" /> },
  paralyzed: { color: 'bg-yellow-500 border-yellow-400', icon: <Zap className="w-3 h-3" /> },
  silenced: { color: 'bg-gray-500 border-gray-400', icon: <Moon className="w-3 h-3" /> },
  weakened: { color: 'bg-red-400 border-red-300', icon: <Sword className="w-3 h-3" /> },
  defenseless: { color: 'bg-orange-400 border-orange-300', icon: <Shield className="w-3 h-3" /> },
  vulnerable: { color: 'bg-purple-500 border-purple-400', icon: <AlertCircle className="w-3 h-3" /> },
  inspired: { color: 'bg-amber-400 border-amber-300', icon: <Sparkles className="w-3 h-3" /> },
  fortified: { color: 'bg-cyan-500 border-cyan-400', icon: <Shield className="w-3 h-3" /> },
  regenerating: { color: 'bg-emerald-500 border-emerald-400', icon: <Heart className="w-3 h-3" /> },
  protected: { color: 'bg-blue-500 border-blue-400', icon: <Shield className="w-3 h-3" /> },
  immune: { color: 'bg-violet-500 border-violet-400', icon: <Star className="w-3 h-3" /> },
  stealth: { color: 'bg-gray-700 border-gray-500', icon: <Eye className="w-3 h-3" /> },
};

const TYPE_COLORS: Record<string, string> = {
  hero: 'from-amber-800 via-amber-700 to-amber-900 border-amber-500',
  unit: 'from-slate-800 via-slate-700 to-slate-900 border-slate-500',
  terrain: 'from-emerald-800 via-emerald-700 to-emerald-900 border-emerald-500',
  equipment: 'from-gray-700 via-gray-600 to-gray-800 border-gray-400',
  mount: 'from-teal-800 via-teal-700 to-teal-900 border-teal-500',
  spell: 'from-blue-800 via-blue-700 to-blue-900 border-blue-500',
  mana: 'from-purple-800 via-purple-700 to-purple-900 border-purple-500',
};

const TYPE_ART_COLORS: Record<string, string> = {
  hero: 'from-amber-400/20 to-yellow-600/20',
  unit: 'from-slate-400/20 to-slate-600/20',
  terrain: 'from-emerald-400/20 to-green-600/20',
  equipment: 'from-gray-300/20 to-gray-500/20',
  mount: 'from-teal-400/20 to-cyan-600/20',
  spell: 'from-blue-400/20 to-indigo-600/20',
  mana: 'from-purple-400/20 to-pink-600/20',
};

const TYPE_LABELS: Record<string, string> = {
  hero: 'Herói',
  unit: 'Unidade',
  terrain: 'Terreno',
  equipment: 'Equipamento',
  mount: 'Montaria',
  spell: 'Feitiço',
  mana: 'Mana',
};

const TIER_LABELS: Record<string, string> = {
  weak: 'Fraca',
  medium: 'Média',
  strong: 'Forte',
};

function isBattle(card: CardDefinition | BattleCard): card is BattleCard {
  return 'instanceId' in card;
}

export default function CardDisplay({ card, isBattleCard, isSelected, isValidTarget, isPlayable, isExhausted, onClick, size = 'md', showBack, cosmeticFrame, playableTone }: CardDisplayProps) {
  const [failedImages, setFailedImages] = React.useState<Record<string, boolean>>({});
  const bc = isBattle(card) ? card : null;
  const def = isBattle(card) ? null : card as CardDefinition;

  const cardId = bc?.cardId ?? def?.id;
  const type = card.type;
  const name = card.name;
  const manaCost = card.manaCost;
  const attack = bc ? bc.currentAttack : (def?.attack);
  const defense = bc ? bc.currentDefense : (def?.defense);
  const health = bc ? bc.currentHealth : (def?.health);
  const maxHealth = bc ? bc.maxHealth : (def?.health);
  const conditions = bc?.conditions ?? [];
  const exhausted = bc?.exhausted || isExhausted;
  const effects = card.effects;
  const tier = def?.tier ?? bc?.tier;

  // Equipment bonuses for display
  const eqAttackBonus = bc ? getEquipmentAttackBonus(bc) : 0;
  const eqDefenseBonus = bc?.equipment
    ? (bc.equipment.effects.find(e => e.type === 'defenseBonus' && e.timing === 'onDefend')?.value ?? 0)
    : 0;
  const hasActiveEquipment = bc?.equipment && bc.equipment.currentDurability > 0;
  const displayAttack = attack;

  const colorClass = TYPE_COLORS[type] || TYPE_COLORS.unit;
  const artGradient = TYPE_ART_COLORS[type] || TYPE_ART_COLORS.unit;
  const selected = isSelected ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-105 brightness-105' : '';
  const validTarget = isValidTarget ? 'card-targetable cursor-pointer brightness-105' : '';
  const playable = isPlayable ? 'card-playable cursor-pointer brightness-105' : '';
  const clickable = onClick ? 'cursor-pointer hover:scale-[1.03] card-glow' : '';
  const tierClass = tier === 'weak' ? 'tier-weak' : tier === 'medium' ? 'tier-medium' : tier === 'strong' ? 'tier-strong' : '';
  const heroClass = type === 'hero' ? 'hero-card' : '';
  const showsCombatStats = type === 'hero' || type === 'unit';
  const imageSrc = card.imageUrl ?? (cardId ? `/cards/${cardId}.png` : null);
  const showImage = !!imageSrc && !failedImages[imageSrc];

  const sizeClasses = {
    sm: 'card-size-sm text-xs',
    md: 'card-size-md text-sm',
    lg: 'card-size-lg text-sm',
  };
  const cosmeticClass = cosmeticFrame && cosmeticFrame !== 'default'
    ? `card-cosmetic-${cosmeticFrame} card-cosmetic-${cosmeticFrame}-${type}`
    : '';
  const playableToneClass = playableTone && playableTone !== 'default'
    ? `card-playable-tone-${playableTone}`
    : '';

  if (showBack) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-lg card-back flex items-center justify-center ${clickable} transition-all relative overflow-hidden shadow-lg shadow-black/30`}
        onClick={onClick}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-500/20 via-transparent to-black/30" />
        <div className="absolute inset-2 rounded-md border border-white/5" />
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-500 to-slate-800 flex items-center justify-center border border-slate-300/30 shadow-lg">
          <Star className="w-5 h-5 text-amber-300/80" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-lg tcg-card card-type-${type} bg-gradient-to-br ${colorClass} border-2 flex flex-col overflow-hidden transition-all duration-200 shadow-lg shadow-black/30 ${selected} ${validTarget} ${playable} ${playableToneClass} ${clickable} ${exhausted ? 'opacity-55 grayscale-[35%]' : ''} ${tierClass} ${heroClass} ${cosmeticClass} relative select-none`}
      onClick={onClick}
      title={card.name}
    >
      <div className="absolute inset-[3px] rounded-md border border-white/10 pointer-events-none z-[1]" />
      <div className="absolute inset-0 card-foil-texture pointer-events-none z-[1]" />

      {/* Mana cost - crystal design */}
      <div className="absolute top-1 left-1 w-6 h-6 z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-md transform rotate-45 border border-blue-300/50 shadow-lg">
          <div className="absolute inset-[2px] bg-gradient-to-br from-blue-500 to-blue-700 rounded-sm flex items-center justify-center transform -rotate-45">
            <span className="text-white font-bold text-xs drop-shadow-md">{manaCost}</span>
          </div>
        </div>
      </div>

      {/* Type icon with background */}
      <div className="absolute top-1 right-1 z-10 w-5 h-5 rounded bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/10">
        {type === 'hero' && <Star className="w-3 h-3 text-amber-400" />}
        {type === 'unit' && <Sword className="w-3 h-3 text-red-400" />}
        {type === 'terrain' && <Leaf className="w-3 h-3 text-green-400" />}
        {type === 'equipment' && <Shield className="w-3 h-3 text-gray-300" />}
        {type === 'mount' && <Wind className="w-3 h-3 text-teal-300" />}
        {type === 'spell' && <Zap className="w-3 h-3 text-blue-300" />}
      </div>

      {/* Art area with thematic gradient */}
      <div className="flex-1 flex items-center justify-center px-1 pt-6 pb-1 min-h-0 relative z-[2]">
        <div className={`w-full h-full rounded-md card-art-window bg-gradient-to-br ${artGradient} flex items-center justify-center relative overflow-hidden border border-white/10`}>
          {showImage && (
            <img
              src={imageSrc}
              alt={name}
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
              onError={() => {
                setFailedImages(current => ({
                  ...current,
                  [imageSrc]: true,
                }));
              }}
            />
          )}
          <div className={`absolute inset-0 bg-gradient-to-t ${showImage ? 'from-black/70 via-black/10 to-black/20' : 'from-black/40 to-transparent'}`} />
          <span className="text-center text-white font-semibold leading-tight px-1 relative z-10 drop-shadow-sm" style={{ fontSize: '0.65rem' }}>
            {name}
          </span>
        </div>
      </div>

      {/* Stats row with icons */}
      {showsCombatStats && (attack !== undefined || defense !== undefined || health !== undefined) && (
        <div className="flex justify-between items-center px-1 py-0.5 stat-bar relative z-[2]">
          {attack !== undefined && (
            <div className="flex items-center gap-0.5">
              <Sword className="w-2.5 h-2.5 text-red-400 shrink-0" />
              <span className="font-bold text-red-300" style={{ fontSize: '0.6rem' }}>
                {displayAttack}
                {hasActiveEquipment && eqAttackBonus > 0 && (
                  <span className="text-green-400" style={{ fontSize: '0.5rem' }}>+{eqAttackBonus}</span>
                )}
              </span>
            </div>
          )}
          {health !== undefined && health !== null && (
            <div className="flex items-center gap-0.5">
              <Heart className="w-2.5 h-2.5 text-green-400 shrink-0" />
              <span className="font-bold text-green-300" style={{ fontSize: '0.6rem' }}>{health}{maxHealth && maxHealth !== health ? `/${maxHealth}` : ''}</span>
            </div>
          )}
          {defense !== undefined && (
            <div className="flex items-center gap-0.5">
              <Shield className="w-2.5 h-2.5 text-blue-400 shrink-0" />
              <span className="font-bold text-blue-300" style={{ fontSize: '0.6rem' }}>
                {defense}
                {hasActiveEquipment && eqDefenseBonus > 0 && (
                  <span className="text-green-400" style={{ fontSize: '0.5rem' }}>+{eqDefenseBonus}</span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Type label */}
      <div className="card-type-band px-1 py-0.5 text-center border-t border-white/10 relative z-[2]">
        <span className="text-white/70 font-medium" style={{ fontSize: '0.5rem' }}>
          {TYPE_LABELS[type]}{tier ? ` ${TIER_LABELS[tier]}` : ''}
        </span>
      </div>

      {/* Conditions - now with icons */}
      {conditions.length > 0 && (
        <div className="absolute top-8 left-1 z-20 flex flex-col gap-0.5 pointer-events-none">
          {conditions.slice(0, 4).map((c, i) => {
            const config = CONDITION_CONFIG[c.name];
            return (
              <div
                key={`${c.name}-${i}`}
                className={`w-3.5 h-3.5 rounded-sm ${config.color} border flex items-center justify-center shadow-md`}
                title={c.name}
              >
                <span className="text-white/90 scale-[0.65]">{config.icon}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Equipment/Mount indicators - improved design */}
      {bc?.equipment && (
        <div className="absolute top-7 right-0.5 flex items-center gap-0.5">
          <div className="flex items-center gap-0.5 bg-slate-900/80 rounded px-0.5 border border-gray-500/40 shadow-md" title={`${bc.equipment.name} (${bc.equipment.currentDurability}/${bc.equipment.maxDurability})`}>
            <Shield className="w-2.5 h-2.5 text-gray-300" />
            <span className={`font-bold ${bc.equipment.currentDurability <= 1 ? 'text-red-400' : 'text-gray-200'}`} style={{ fontSize: '0.5rem' }}>
              {bc.equipment.currentDurability}
            </span>
          </div>
        </div>
      )}
      {bc?.mount && (
        <div className="absolute top-10 right-0.5 flex items-center gap-0.5">
          <div className="w-4 h-4 rounded-sm bg-gradient-to-br from-teal-500 to-teal-700 border border-teal-400/50 flex items-center justify-center shadow-md" title={bc.mount.name}>
            <Wind className="w-2.5 h-2.5 text-teal-200" />
          </div>
        </div>
      )}

      {/* Summoned this turn indicator */}
      {bc?.summonedThisTurn && (
        <div className="absolute inset-0 border-2 border-yellow-400/60 rounded-lg pointer-events-none" />
      )}

      {isSelected && (
        <div className="absolute inset-x-1 top-8 z-20 rounded bg-amber-300/95 text-center text-[9px] font-black uppercase tracking-wide text-amber-950 shadow-md pointer-events-none">
          Selecionado
        </div>
      )}

      {isPlayable && !isSelected && (
        <div className="absolute inset-x-2 bottom-5 z-20 h-1 rounded-full pointer-events-none card-playable-marker" />
      )}

      {/* Exhausted overlay */}
      {exhausted && (
        <div className="absolute inset-0 bg-black/20 rounded-lg pointer-events-none exhausted-overlay" />
      )}
    </div>
  );
}
