import React, { useEffect, useRef } from 'react';
import { ScrollText, Sparkles } from 'lucide-react';

interface GameLogProps {
  log: string[];
}

export default function GameLog({ log }: GameLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  const visibleLog = log.slice(-80);

  return (
    <div className="bg-slate-950/70 border border-slate-700/70 rounded-xl flex flex-col flex-1 min-h-0 max-h-[calc(100vh-8rem)] overflow-hidden shadow-xl shadow-black/20">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-500/15 border border-amber-400/30 flex items-center justify-center">
            <ScrollText className="w-3.5 h-3.5 text-amber-300" />
          </div>
          <span className="text-slate-200 text-xs font-bold uppercase tracking-wide">Log da partida</span>
        </div>
        <span className="text-[10px] text-slate-500 font-semibold">{log.length}</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2 space-y-1">
        {visibleLog.length === 0 ? (
          <div className="h-full min-h-24 flex flex-col items-center justify-center text-center text-slate-600 gap-2">
            <Sparkles className="w-5 h-5" />
            <p className="text-xs">Acoes da partida aparecem aqui.</p>
          </div>
        ) : (
          visibleLog.map((entry, i) => {
            const isTurn = entry.startsWith('---');
            const isDanger = entry.includes('venceu') || entry.includes('derrotado') || entry.includes('dano');
            const isHeal = entry.includes('recupera') || entry.includes('cura');
            const isAction = entry.includes('invoca') || entry.includes('ativa') || entry.includes('equipa') || entry.includes('usa');

            return (
              <p
                key={`${entry}-${i}`}
                className={`rounded-md px-2 py-1 text-xs leading-relaxed ${
                  isTurn ? 'bg-amber-500/10 text-amber-300 font-bold mt-2 border border-amber-500/15' :
                  isDanger ? 'text-rose-300 bg-rose-950/20' :
                  isHeal ? 'text-emerald-300 bg-emerald-950/20' :
                  isAction ? 'text-sky-300 bg-sky-950/15' :
                  'text-slate-400'
                }`}
              >
                {entry}
              </p>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
