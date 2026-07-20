import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PlayerIndex } from '../types/game';
import { Swords, Shield, Sparkles } from 'lucide-react';

interface CoinFlipProps {
  playerHeroName: string;
  aiHeroName: string;
  onComplete: (firstPlayer: PlayerIndex) => void;
  playerLabel?: string;
  opponentLabel?: string;
  predeterminedResult?: PlayerIndex;
  autoStart?: boolean;
  autoContinue?: boolean;
  spinDuration?: number;
  variant?: 'screen' | 'modal';
}

export default function CoinFlip({
  playerHeroName,
  aiHeroName,
  onComplete,
  playerLabel = 'Voce',
  opponentLabel = 'Inimigo',
  predeterminedResult,
  autoStart = false,
  autoContinue = false,
  spinDuration = 1200,
  variant = 'screen',
}: CoinFlipProps) {
  const [phase, setPhase] = useState<'intro' | 'spinning' | 'result'>('intro');
  const [result, setResult] = useState<PlayerIndex>(0);
  const [progress, setProgress] = useState(0);
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startSpin = useCallback(() => {
    if (phase !== 'intro') return;
    setPhase('spinning');
    let duration = 0;
    spinIntervalRef.current = setInterval(() => {
      duration += 50;
      setProgress(Math.min((duration / spinDuration) * 100, 100));
      if (duration >= spinDuration) {
        if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
        const winner = predeterminedResult ?? (Math.random() < 0.5 ? 0 : 1);
        setResult(winner);
        setPhase('result');
      }
    }, 50);
  }, [phase, predeterminedResult, spinDuration]);

  const handleContinue = () => {
    onComplete(result);
  };

  useEffect(() => {
    if (autoStart) startSpin();
  }, [autoStart, startSpin]);

  useEffect(() => {
    if (phase !== 'result' || !autoContinue) return;
    completeTimeoutRef.current = setTimeout(() => onComplete(result), 550);
    return () => {
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
    };
  }, [autoContinue, onComplete, phase, result]);

  useEffect(() => () => {
    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
  }, []);

  const containerClass = variant === 'modal'
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm'
    : 'min-h-screen flex items-center justify-center game-bg p-4';

  return (
    <div className={containerClass}>
      <div className={`${variant === 'modal' ? 'rounded-2xl border border-amber-500/30 bg-slate-950/95 p-6 shadow-2xl shadow-black/60' : ''} max-w-md w-full`}>
        {/* Intro */}
        {phase === 'intro' && (
          <div className="text-center animate-fade-in">
            <div className="mb-8">
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 mb-4">
                <Swords className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Sorteio Inicial</h2>
              <p className="text-gray-400 text-sm">Quem começa a partida?</p>
            </div>

            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center mb-2 mx-auto shadow-lg">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <p className="text-xs text-blue-300 font-medium">{playerHeroName}</p>
                <p className="text-xs text-gray-500">{playerLabel}</p>
              </div>
              <div className="text-2xl font-bold text-gray-600">VS</div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center mb-2 mx-auto shadow-lg">
                  <Swords className="w-8 h-8 text-white" />
                </div>
                <p className="text-xs text-red-300 font-medium">{aiHeroName}</p>
                <p className="text-xs text-gray-500">{opponentLabel}</p>
              </div>
            </div>

            <button
              onClick={startSpin}
              className="px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-lg shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all hover:scale-105 active:scale-95"
            >
              Sortear!
            </button>
          </div>
        )}

        {/* Spinning */}
        {phase === 'spinning' && (
          <div className="text-center">
            <div className="relative w-32 h-32 mx-auto mb-8">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-4 border-amber-500/30 animate-spin" style={{ animationDuration: '2s' }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-amber-500 rounded-full" />
              </div>
              {/* Inner ring */}
              <div className="absolute inset-4 rounded-full border-4 border-amber-400/50 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-amber-400 rounded-full" />
              </div>
              {/* Center */}
              <div className="absolute inset-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg">
                <Sparkles className="w-8 h-8 text-white animate-pulse" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Sorteando...</h3>
            <div className="w-48 h-2 bg-gray-800 rounded-full mx-auto overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-100 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Result */}
        {phase === 'result' && (
          <div className="text-center animate-fade-in">
            <div className="mb-6">
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center shadow-lg shadow-green-500/20 mb-4 animate-bounce">
                <Swords className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Resultado!</h2>
            </div>

            <div className="bg-gray-800/80 rounded-xl p-6 mb-8 border border-gray-700">
              <p className="text-gray-400 text-sm mb-2">O primeiro a jogar é:</p>
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  result === 0
                    ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                    : 'bg-gradient-to-br from-red-500 to-red-700'
                }`}>
                  {result === 0 ? <Shield className="w-6 h-6 text-white" /> : <Swords className="w-6 h-6 text-white" />}
                </div>
                <p className="text-xl font-bold text-white">
                  {result === 0 ? playerHeroName : aiHeroName}
                </p>
              </div>
              <p className="text-sm text-gray-500">
                {result === 0 ? `${playerLabel} começa com 2 de mana!` : `${opponentLabel} começa com 2 de mana!`}
              </p>
            </div>

            {autoContinue ? (
              <p className="text-sm font-semibold text-emerald-300">Iniciando partida...</p>
            ) : (
              <button
                onClick={handleContinue}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg shadow-lg shadow-green-500/20 hover:shadow-amber-500/40 transition-all hover:scale-105 active:scale-95"
              >
                Iniciar Partida!
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
