import React from 'react';
import { PlayerIndex } from '../types/game';
import { Trophy, RotateCcw, Home, Star } from 'lucide-react';

interface GameOverProps {
  winner: PlayerIndex | 'draw';
  onPlayAgain: () => void;
  onMainMenu: () => void;
}

export default function GameOver({ winner, onPlayAgain, onMainMenu }: GameOverProps) {
  const isPlayerWin = winner === 0;
  const isDraw = winner === 'draw';
  const resultTheme = isDraw
    ? {
        eyebrow: 'Partida encerrada',
        title: 'Empate!',
        subtitle: 'Os dois herois cairam no mesmo momento. Foi por pouco.',
        detail: 'A partida terminou sem vencedor.',
        glow: 'from-slate-500/20 via-gray-500/10 to-slate-950',
        border: 'border-slate-500/40',
        badge: 'bg-slate-700/80 border-slate-500/50',
        titleColor: 'text-slate-200',
        action: 'bg-slate-600 hover:bg-slate-500',
      }
    : isPlayerWin
    ? {
        eyebrow: 'Resultado da batalha',
        title: 'Vitoria!',
        subtitle: 'Voce dominou o campo e reduziu o heroi inimigo a 0 de vida.',
        detail: 'Seu plano venceu esta rodada.',
        glow: 'from-amber-500/25 via-emerald-500/10 to-slate-950',
        border: 'border-amber-400/50',
        badge: 'bg-amber-500/20 border-amber-300/60',
        titleColor: 'text-amber-300',
        action: 'bg-amber-600 hover:bg-amber-500',
      }
    : {
        eyebrow: 'Resultado da batalha',
        title: 'Derrota!',
        subtitle: 'O heroi inimigo sobreviveu. Ajuste o baralho e tente novamente.',
        detail: 'Uma revanche pode virar essa partida.',
        glow: 'from-rose-600/25 via-red-500/10 to-slate-950',
        border: 'border-rose-500/50',
        badge: 'bg-rose-500/20 border-rose-400/60',
        titleColor: 'text-rose-300',
        action: 'bg-rose-700 hover:bg-rose-600',
      };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className={`relative overflow-hidden bg-slate-950 border ${resultTheme.border} rounded-2xl text-center max-w-lg w-full shadow-2xl`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${resultTheme.glow}`} />
        <div className="absolute -top-16 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />

        <div className="relative px-7 py-8 sm:px-9">
          <div className={`w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center border ${resultTheme.badge} shadow-lg`}>
            <Trophy className={`w-10 h-10 ${isDraw ? 'text-slate-200' : isPlayerWin ? 'text-amber-200' : 'text-rose-200'}`} />
          </div>

          <div className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400 mb-3">
            <Star className="w-3.5 h-3.5" />
            {resultTheme.eyebrow}
            <Star className="w-3.5 h-3.5" />
          </div>

          <h2 className={`text-4xl sm:text-5xl font-black mb-3 ${resultTheme.titleColor}`}>
            {resultTheme.title}
          </h2>

          <p className="text-slate-200 text-base leading-relaxed max-w-sm mx-auto">
            {resultTheme.subtitle}
          </p>

          <div className="mt-6 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
            {resultTheme.detail}
          </div>

          <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={onPlayAgain}
              className={`py-3.5 px-4 ${resultTheme.action} text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg`}
            >
              <RotateCcw className="w-4 h-4" />
              Jogar novamente
            </button>
            <button
              onClick={onMainMenu}
              className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
