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

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 text-center max-w-sm w-full mx-4 shadow-2xl">
        <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
          isDraw ? 'bg-gray-700' : isPlayerWin ? 'bg-amber-600' : 'bg-red-800'
        }`}>
          <Trophy className={`w-8 h-8 ${isDraw ? 'text-gray-300' : isPlayerWin ? 'text-white' : 'text-red-300'}`} />
        </div>

        <h2 className={`text-3xl font-black mb-2 ${
          isDraw ? 'text-gray-300' : isPlayerWin ? 'text-amber-400' : 'text-red-400'
        }`}>
          {isDraw ? 'Empate!' : isPlayerWin ? 'Vitória!' : 'Derrota!'}
        </h2>

        <p className="text-gray-400 text-sm mb-6">
          {isDraw
            ? 'Ambos os heróis foram derrotados simultaneamente.'
            : isPlayerWin
            ? 'Você reduziu o herói inimigo a 0 de vida!'
            : 'O herói inimigo sobreviveu. Tente novamente!'}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onPlayAgain}
            className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Jogar Novamente
          </button>
          <button
            onClick={onMainMenu}
            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}
