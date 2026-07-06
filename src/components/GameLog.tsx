import React, { useEffect, useRef } from 'react';
import { ScrollText } from 'lucide-react';

interface GameLogProps {
  log: string[];
}

export default function GameLog({ log }: GameLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg flex flex-col flex-1 min-h-0 max-h-[calc(100vh-8rem)] overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 px-3 py-2 border-b border-gray-700">
        <ScrollText className="w-4 h-4 text-amber-400" />
        <span className="text-gray-300 text-xs font-semibold uppercase tracking-wide">Log da Partida</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-0.5">
        {log.map((entry, i) => (
          <p key={i} className={`text-xs leading-relaxed ${
            entry.startsWith('---') ? 'text-amber-400 font-semibold mt-2' :
            entry.includes('venceu') || entry.includes('derrotado') ? 'text-red-400' :
            entry.includes('recupera') || entry.includes('cura') ? 'text-green-400' :
            entry.includes('invoca') || entry.includes('ativa') ? 'text-blue-300' :
            'text-gray-400'
          }`}>
            {entry}
          </p>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
