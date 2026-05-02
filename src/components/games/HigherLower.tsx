import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Player, subscribeToPlayers } from '@/services/db';
import { Trophy, Users, TrendingUp, TrendingDown, RefreshCw, Star, Target, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getWeeklySeed } from '@/lib/gameUtils';

const STAT_CONFIGS = [
  { key: 'pj', label: 'Partidos Jugados', icon: Users },
  { key: 'wins', label: 'Victorias', icon: Trophy },
  { key: 'goals', label: 'Goles Totales', icon: Star },
  { key: 'goalsClaro', label: 'Goles (Equipo Claro)', icon: Target },
  { key: 'goalsOscuro', label: 'Goles (Equipo Oscuro)', icon: Shield },
];

const HigherLower = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [leftPlayer, setLeftPlayer] = useState<Player | null>(null);
  const [rightPlayer, setRightPlayer] = useState<Player | null>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'playing' | 'gameOver'>('playing');
  const [highScore, setHighScore] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const [activeStat, setActiveStat] = useState(STAT_CONFIGS[0]);
  const [playerPool, setPlayerPool] = useState<Player[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToPlayers((data) => {
      setPlayers(data);
      // Initialize pool if empty
      if (playerPool.length === 0 && data.length > 0) {
        setPlayerPool([...data].sort(() => Math.random() - 0.5));
      }
    });

    const saved = localStorage.getItem('higherlower-highscore');
    if (saved) setHighScore(parseInt(saved));

    const seed = getWeeklySeed();
    const statIndex = seed % STAT_CONFIGS.length;
    setActiveStat(STAT_CONFIGS[statIndex]);

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (players.length >= 2 && !leftPlayer && !rightPlayer && playerPool.length > 0) {
      initGame();
    }
  }, [players, playerPool]);

  const getNextPlayerFromPool = (excludeId?: string): { player: Player, newPool: Player[] } => {
    let currentPool = [...playerPool];
    
    // Filter out the excluded ID immediately to ensure uniqueness
    if (excludeId) {
      currentPool = currentPool.filter(p => p.id !== excludeId);
    }

    if (currentPool.length === 0) {
      // Re-fill pool excluding the ID if provided
      currentPool = [...players]
        .filter(p => !excludeId || p.id !== excludeId)
        .sort(() => Math.random() - 0.5);
    }
    
    const player = currentPool[0];
    const newPool = currentPool.slice(1);
    
    return { player, newPool };
  };

  const [referenceSide, setReferenceSide] = useState<'left' | 'right'>('left');

  const initGame = () => {
    const { player: p1, newPool: poolAfterP1 } = getNextPlayerFromPool();
    const { player: p2, newPool: poolAfterP2 } = getNextPlayerFromPool(p1.id);
    
    setLeftPlayer(p1);
    setRightPlayer(p2);
    setPlayerPool(poolAfterP2);
    setScore(0);
    setGameState('playing');
    setRevealing(false);
    setReferenceSide('left');
  };

  const handleChoice = (choice: 'higher' | 'lower') => {
    if (revealing || gameState !== 'playing') return;

    setRevealing(true);

    const leftVal = (leftPlayer?.stats as any)?.[activeStat.key] || 0;
    const rightVal = (rightPlayer?.stats as any)?.[activeStat.key] || 0;

    // Determine correctness based on which side is the challenger
    const isCorrect = referenceSide === 'left' 
      ? (choice === 'higher' ? rightVal >= leftVal : rightVal <= leftVal)
      : (choice === 'higher' ? leftVal >= rightVal : leftVal <= rightVal);

    setTimeout(() => {
      if (isCorrect) {
        setScore(prev => prev + 1);
        
          setTimeout(() => {
          // The winner becomes the new reference, and the other side gets a new player
          if (referenceSide === 'left') {
            // Right was the challenger and won, now Right is the reference
            const { player: nextP, newPool: nextPool } = getNextPlayerFromPool(rightPlayer!.id);
            setLeftPlayer(nextP); // Replace left (the previous reference)
            setReferenceSide('right');
            setPlayerPool(nextPool);
          } else {
            // Left was the challenger and won, now Left is the reference
            const { player: nextP, newPool: nextPool } = getNextPlayerFromPool(leftPlayer!.id);
            setRightPlayer(nextP); // Replace right (the previous reference)
            setReferenceSide('left');
            setPlayerPool(nextPool);
          }
          setRevealing(false);
        }, 300); // Super fast transition: 300ms

      } else {
        setGameState('gameOver');
        if (score + 1 > highScore) {
          setHighScore(score);
          localStorage.setItem('higherlower-highscore', (score).toString());
        }
      }
    }, 400); // Initial reveal super fast: 400ms
  };

  const resetGame = () => {
    setLeftPlayer(null);
    setRightPlayer(null);
    initGame();
  };

  if (players.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <Users size={48} className="text-gray-600 animate-pulse" />
        <p className="text-white font-black uppercase tracking-tighter">Cargando jugadores...</p>
      </div>
    );
  }

  const leftVal = (leftPlayer?.stats as any)?.[activeStat.key] || 0;
  const rightVal = (rightPlayer?.stats as any)?.[activeStat.key] || 0;

  return (
    <div className="max-w-6xl mx-auto p-1 md:p-8 space-y-2 md:space-y-8 flex flex-col items-center min-h-[450px] md:min-h-[600px] justify-center">
      <div className="text-center space-y-1 mb-1 md:mb-4">
        <div className="flex items-center justify-center gap-1 md:gap-2 mb-0.5">
            <activeStat.icon size={8} className="md:w-4 md:h-4 text-primary" />
            <span className="text-[6px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest">{activeStat.label} esta semana</span>
        </div>
        <h2 className="text-lg md:text-4xl font-black text-white tracking-tighter uppercase italic">
          MÁS <span className="text-primary">O MENOS</span>
        </h2>
        
        <div className="flex items-center gap-1.5 md:gap-4 justify-center mt-1 md:mt-4">
          <div className="bg-white/5 border border-white/10 px-1.5 md:px-4 py-0.5 md:py-1 rounded-lg md:rounded-2xl flex items-center gap-1 min-w-[50px] md:min-w-[100px] md:flex-col">
             <span className="text-[6px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">Score</span>
             <span className="text-xs md:text-2xl font-black text-white leading-none">{score}</span>
          </div>
          <div className="bg-primary/10 border border-primary/20 px-1.5 md:px-4 py-0.5 md:py-1 rounded-lg md:rounded-2xl flex items-center gap-1 min-w-[50px] md:min-w-[100px] md:flex-col">
             <span className="text-[6px] md:text-[10px] font-black text-primary/60 uppercase tracking-widest leading-none">Record</span>
             <span className="text-xs md:text-2xl font-black text-primary leading-none">{highScore}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-2 gap-1.5 md:gap-4 w-full max-w-4xl relative items-stretch">
        {/* Left Player */}
        <div className={cn(
             "relative aspect-[2/3] md:aspect-[4/5] rounded-xl md:rounded-[3rem] overflow-hidden border md:border-4 transition-all duration-300 bg-surface",

             referenceSide === 'right' && !revealing ? "border-primary/40 shadow-[0_0_30px_rgba(16,185,129,0.2)]" : "border-white/10"
        )}>
          <AnimatePresence mode="popLayout">
            <motion.div
              key={leftPlayer?.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0"
            >
              <img 
                src={leftPlayer?.photoUrl || "https://picsum.photos/seed/left/400/500"} 
                alt={leftPlayer?.name}
                className={cn("w-full h-full object-cover", referenceSide === 'right' && !revealing ? "" : "grayscale-[0.3]")}
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent flex flex-col justify-end p-2 md:p-8 text-center">
                <p className="text-white text-[10px] md:text-2xl font-black uppercase italic tracking-tighter drop-shadow-lg mb-1 md:mb-2 leading-tight">{leftPlayer?.name}</p>
                <div className={cn(
                   "bg-white/10 backdrop-blur-md rounded-lg md:rounded-2xl py-1.5 md:py-4 border border-white/10 ring-1 ring-white/5",
                   referenceSide === 'right' && !revealing && "bg-black/60"
                )}>
                    <p className="hidden md:block text-[8px] md:text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">{activeStat.label}</p>
                    <p className="text-sm md:text-4xl font-black text-white leading-none">
                      {(referenceSide === 'right' && !revealing) ? '?' : leftVal}
                    </p>
                    
                    {referenceSide === 'right' && !revealing && gameState === 'playing' && (
                      <div className="flex flex-col md:flex-row gap-1 px-1 md:px-4 mt-1 md:mt-4">
                        <button onClick={() => handleChoice('higher')} className="flex-1 bg-primary text-background py-1.5 md:py-3 rounded-md md:rounded-xl font-black uppercase text-[8px] md:text-[10px] flex items-center justify-center gap-1 active:scale-95 transition-transform">MÁS</button>
                        <button onClick={() => handleChoice('lower')} className="flex-1 bg-red-500 text-white py-1.5 md:py-3 rounded-md md:rounded-xl font-black uppercase text-[8px] md:text-[10px] flex items-center justify-center gap-1 active:scale-95 transition-transform">MENOS</button>
                      </div>
                    )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right Player */}
        <div className={cn(
             "relative aspect-[2/3] md:aspect-[4/5] rounded-xl md:rounded-[3rem] overflow-hidden border md:border-4 transition-all duration-300 bg-surface",
             referenceSide === 'left' && !revealing ? "border-primary/40 shadow-[0_0_30px_rgba(16,185,129,0.2)]" : "border-white/10"
        )}>
          <AnimatePresence mode="popLayout">
            <motion.div
              key={rightPlayer?.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0"
            >
              <img 
                src={rightPlayer?.photoUrl || "https://picsum.photos/seed/right/400/500"} 
                alt={rightPlayer?.name}
                className={cn("w-full h-full object-cover", referenceSide === 'left' && !revealing ? "" : "grayscale-[0.3]")}
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-2 md:p-8 text-center">
                <p className="text-white text-[10px] md:text-2xl font-black uppercase italic tracking-tighter drop-shadow-lg mb-1 md:mb-4 leading-tight">{rightPlayer?.name}</p>
                
                <div className="space-y-1.5 md:space-y-3">
                  <div className={cn(
                    "bg-white/10 backdrop-blur-md rounded-lg md:rounded-2xl py-1.5 md:py-4 border border-white/10",
                    referenceSide === 'left' && !revealing && "bg-black/60"
                  )}>
                      <p className="hidden md:block text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{activeStat.label}</p>
                      <p className="text-sm md:text-4xl font-black text-white leading-none">
                          {(referenceSide === 'left' && !revealing) ? '?' : rightVal}
                      </p>
                      
                      {referenceSide === 'left' && !revealing && gameState === 'playing' && (
                        <div className="flex flex-col md:flex-row gap-1 px-1 md:px-4 mt-1 md:mt-4">
                          <button onClick={() => handleChoice('higher')} className="flex-1 bg-primary text-background py-1.5 md:py-3 rounded-md md:rounded-xl font-black uppercase text-[8px] md:text-[10px] flex items-center justify-center gap-1 active:scale-95 transition-transform">MÁS</button>
                          <button onClick={() => handleChoice('lower')} className="flex-1 bg-red-500 text-white py-1.5 md:py-3 rounded-md md:rounded-xl font-black uppercase text-[8px] md:text-[10px] flex items-center justify-center gap-1 active:scale-95 transition-transform">MENOS</button>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="h-24 flex items-center justify-center">
        <AnimatePresence>
            {gameState === 'gameOver' && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center space-y-4"
                >
                    <div className="bg-red-500 text-white px-8 py-3 rounded-2xl shadow-xl flex items-center gap-3">
                        <TrendingDown size={24} />
                        <p className="text-lg font-black uppercase italic tracking-tighter leading-none">¡FALLASTE!</p>
                    </div>
                    <button 
                        onClick={resetGame}
                        className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:text-primary transition-all"
                    >
                        <RefreshCw size={14} />
                        REINTENTAR
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
};


export default HigherLower;
