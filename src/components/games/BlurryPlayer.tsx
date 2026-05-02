import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Player, subscribeToPlayers } from '@/services/db';
import { getWeeklySeed, getWeeklyItem } from '@/lib/gameUtils';
import { HelpCircle, Trophy, Eye, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PlayerSearch from './PlayerSearch';

const BlurryPlayer = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [targetPlayer, setTargetPlayer] = useState<Player | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [blurAmount, setBlurAmount] = useState(40);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorState, setErrorState] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToPlayers((data) => {
      setPlayers(data);
      if (data.length === 0) {
        setLoading(false);
        return;
      }

      const seed = getWeeklySeed();
      
      // Filter players with photos
      const validPlayers = data.filter(p => !!p.photoUrl && p.photoUrl.length > 10);
      
      if (validPlayers.length === 0) {
        setError('No hay jugadores con fotos registradas para este juego.');
        setLoading(false);
        return;
      }

      const target = getWeeklyItem(validPlayers, seed, 303);
      if (target) {
        setTargetPlayer(target);
        setError(null);
      } else {
        setError('No se pudo encontrar un jugador para hoy.');
      }
      setLoading(false);
    });

    const timeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const onSelectPlayer = (pName: string) => {
    if (!targetPlayer || gameState !== 'playing') return;

    const guess = pName.toLowerCase();
    const isCorrect = 
      targetPlayer.name.toLowerCase() === guess || 
      (targetPlayer.nicknames || []).some(n => n.toLowerCase() === guess);

    if (isCorrect) {
      setGameState('won');
      setBlurAmount(0);
      toast.success(`¡Bingo! Era ${targetPlayer.name}.`);
    } else {
      const newGuesses = [...guesses, pName];
      setGuesses(newGuesses);
      const nextBlur = Math.max(0, blurAmount - 7);
      setBlurAmount(nextBlur);
      
      setErrorState(true);
      setTimeout(() => setErrorState(false), 500);
      
      if (newGuesses.length >= 6) {
        setGameState('lost');
        setBlurAmount(0);
      }
    }
  };

  const revealMore = () => {
    if (gameState !== 'playing') return;
    const nextBlur = Math.max(0, blurAmount - 10);
    setBlurAmount(nextBlur);
    if (nextBlur === 0) setGameState('lost');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Cargando Jugador...</p>
      </div>
    );
  }

  if (error || !targetPlayer) {
    return (
      <div className="flex flex-col items-center justify-center h-96 p-8 text-center space-y-4">
        <HelpCircle size={48} className="text-gray-600" />
        <p className="text-white font-bold">{error || 'Error al cargar el jugador'}</p>
        <p className="text-gray-400 text-sm">Asegurate de que los jugadores tengan fotos en su perfil.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 flex flex-col items-center">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-white tracking-tighter uppercase">FOTO ENIGMÁTICA</h2>
        <p className="text-gray-400 font-medium">Adiviná el jugador. Cada error desblurea la imagen.</p>
      </div>

      <motion.div 
        animate={errorState ? { x: [-10, 10, -10, 10, 0] } : {}}
        className="relative w-full max-w-sm aspect-[4/5] rounded-[2rem] overflow-hidden border-4 border-white/5 shadow-2xl"
      >
        <img 
          src={targetPlayer.photoUrl} 
          alt="Enigma"
          className={cn(
            "w-full h-full object-cover transition-all duration-1000",
            errorState && "sepia brightness-50"
          )}
          style={{ filter: `blur(${blurAmount}px)` }}
        />
        
        {errorState && (
          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center animate-pulse">
            <XCircle size={100} className="text-red-500" />
          </div>
        )}

        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
          <Eye size={14} className="text-primary" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">
            {guesses.length} / 6 Errores
          </span>
        </div>
      </motion.div>

      {gameState === 'playing' ? (
        <div className="w-full max-w-md space-y-4">
          <PlayerSearch 
            players={players}
            onSelect={onSelectPlayer}
            placeholder="¿Quién es?"
          />

          <button 
            onClick={revealMore}
            disabled={blurAmount === 0}
            className="w-full py-4 text-gray-500 hover:text-white font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            <Eye size={16} />
            Aclarar imagen (Cuesta un intento)
          </button>

          <div className="flex flex-wrap justify-center gap-2">
            {guesses.map((g, i) => (
              <div key={i} className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] font-black text-red-500 uppercase">
                {g}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-surface border border-white/10 p-8 rounded-3xl text-center space-y-6 max-w-sm w-full shadow-2xl"
        >
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center mx-auto",
            gameState === 'won' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
          )}>
            {gameState === 'won' ? <Trophy size={48} /> : <XCircle size={48} />}
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
              {gameState === 'won' ? '¡ADIVINASTE!' : 'FIN DEL JUEGO'}
            </h3>
            <p className="text-gray-400 font-medium tracking-tight leading-tight">
              {gameState === 'won' ? 'Demostraste tener vista de halcón.' : 'No lograste identificar al jugador a tiempo.'}
            </p>
            <div className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/5">
               <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">El jugador era</p>
               <p className="text-lg font-black text-primary uppercase">{targetPlayer.name}</p>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-primary text-background py-4 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
          >
            Listo
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default BlurryPlayer;
