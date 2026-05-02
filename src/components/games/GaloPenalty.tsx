import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Player, subscribeToPlayers } from '@/services/db';
import { Trophy, RefreshCw, Zap, Footprints, Target, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const GaloPenalty = () => {
  const [galo, setGalo] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<'aiming' | 'shooting' | 'scored' | 'saved' | 'missed'>('aiming');
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [ballPos, setBallPos] = useState({ x: 50, y: 92 });
  const [gkPos, setGkPos] = useState({ x: 50, y: 32 });
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');

  useEffect(() => {
    const unsub = subscribeToPlayers(players => {
      const found = players.find(p => p.name.toLowerCase().includes('galo'));
      if (found) setGalo(found);
    });
    return () => unsub();
  }, []);

  const shoot = (targetX: number, targetY: number) => {
    if (gameState !== 'aiming') return;
    
    setGameState('shooting');
    setBallPos({ x: targetX, y: targetY });

    // GK Logic: Success chance based on difficulty
    // Centers have higher save chance, corners lower
    const distFromCenter = Math.abs(targetX - 50);
    const isCorner = distFromCenter > 20;
    
    let saveChance = difficulty === 'easy' ? 0.2 : difficulty === 'normal' ? 0.4 : 0.6;
    if (isCorner) saveChance -= 0.15;
    if (targetY < 25) saveChance -= 0.1; // Top corners harder

    const saveSuccess = Math.random() < saveChance;
    
    setTimeout(() => {
      if (saveSuccess) {
        setGkPos({ x: targetX, y: targetY });
        setTimeout(() => setGameState('saved'), 500);
      } else {
        const diveX = targetX > 50 ? Math.max(10, targetX - 30) : Math.min(90, targetX + 30);
        setGkPos({ x: diveX, y: 35 });
        setTimeout(() => {
          setGameState('scored');
          setScore(prev => prev + 1);
        }, 500);
      }
      setAttempts(prev => prev + 1);
    }, 400);
  };

  const resetBall = () => {
    setGameState('aiming');
    setBallPos({ x: 50, y: 92 });
    setGkPos({ x: 50, y: 32 });
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center select-none overflow-hidden h-[750px] relative bg-slate-950 rounded-3xl border border-white/5 shadow-2xl">
      {/* Stadium Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 w-full h-[40%] bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col items-center">
            <div className="w-full h-full opacity-10 grid grid-cols-12 gap-1 px-4 pt-4">
               {Array(24).fill(0).map((_, i) => <div key={i} className="h-8 bg-slate-800 rounded-sm" />)}
            </div>
            <div className="absolute top-4 left-10 flex gap-1">
                {[1,2].map(i => <div key={i} className="w-4 h-4 bg-white rounded-full blur-[4px] shadow-[0_0_20px_white]" />)}
            </div>
            <div className="absolute top-4 right-10 flex gap-1">
                {[1,2].map(i => <div key={i} className="w-4 h-4 bg-white rounded-full blur-[4px] shadow-[0_0_20px_white]" />)}
            </div>
        </div>
        <div className="absolute bottom-0 w-full h-[60%] bg-[#1a4a2a] perspective-[1000px]">
           <div className="absolute inset-0 flex flex-col">
              {Array(6).fill(0).map((_, i) => <div key={i} className={cn("flex-1", i % 2 === 0 ? "bg-black/5" : "bg-transparent")} />)}
           </div>
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90%] h-full border-x-4 border-white/5" />
           <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-4 h-4 bg-white/20 rounded-full" />
        </div>
      </div>

      <div className="absolute top-6 left-6 z-50 text-left">
          <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] leading-none mb-1">Goles vs Galo</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white italic tracking-tighter drop-shadow-xl">{score}</span>
            <span className="text-sm font-bold text-white/20">/ {attempts}</span>
          </div>
      </div>

      <div className="absolute top-6 right-6 z-50 flex gap-1.5 flex-wrap justify-end max-w-[200px]">
        {(['easy', 'normal', 'hard'] as const).map(d => (
          <button 
            key={d}
            onClick={() => { setDifficulty(d); setScore(0); setAttempts(0); resetBall(); }}
            className={cn(
              "px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all backdrop-blur-md",
              difficulty === d 
                ? "bg-primary border-primary text-background" 
                : "bg-surface/50 border-white/5 text-gray-400 hover:text-white"
            )}
          >
            {d === 'easy' ? 'Fácil' : d === 'normal' ? 'Normal' : 'Galo Prime'}
          </button>
        ))}
      </div>

      {/* Game Content */}
      <div className="w-full h-full relative z-10 flex flex-col items-center">
        {/* Goal Area */}
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[90%] md:w-[75%] h-[320px] md:h-[420px]">
           {/* Netting */}
           <div className="absolute inset-0 bg-white/5 border-2 border-white/20 rounded-t-lg overflow-hidden flex flex-col">
              <div className="w-full h-full opacity-10 grid grid-cols-[repeat(20,1fr)] grid-rows-[repeat(12,1fr)]">
                {Array(240).fill(0).map((_, i) => <div key={i} className="border-[0.2px] border-white" />)}
              </div>
           </div>
           {/* Posts */}
           <div className="absolute -inset-2 border-x-[10px] border-t-[10px] border-white rounded-t-lg shadow-[0_0_30px_rgba(255,255,255,0.1)]" />
           
           {/* SHOOTING TARGETS - 10 Circles (2 rows of 5) */}
           {gameState === 'aiming' && (
             <div className="absolute inset-0 flex flex-col justify-center items-center py-4 z-30">
                <div className="grid grid-cols-5 gap-2 md:gap-14 px-2 md:px-8">
                  {[20, 50].map((y, row) => [15, 32.5, 50, 67.5, 85].map((x, col) => (
                    <motion.button
                      key={`${row}-${col}`}
                      whileHover={{ scale: 1.3 }}
                      whileTap={{ scale: 0.7 }}
                      onClick={() => shoot(x, y)}
                      className="group relative flex items-center justify-center p-1 md:p-2"
                    >
                      <div className="w-8 h-8 md:w-16 md:h-16 rounded-full border-2 border-white/10 bg-white/5 hover:bg-primary/20 hover:border-primary flex items-center justify-center transition-all shadow-xl">
                        <Target className="text-white/30 group-hover:text-primary transition-all pointer-events-none" size={16} />
                      </div>
                    </motion.button>
                  )))}
                </div>
             </div>
           )}
        </div>

        {/* Goalkeeper (Galo) */}
        <motion.div 
          animate={{ 
            left: `${gkPos.x}%`, 
            top: `${gkPos.y}%`,
            rotate: gameState === 'saved' ? (gkPos.x > 50 ? 50 : -50) : 0,
            scale: gameState === 'saved' ? 1.2 : 1,
            y: gameState === 'saved' ? -20 : 0
          }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="absolute z-20 flex flex-col items-center -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        >
          <div className="relative">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-white/20 overflow-hidden shadow-2xl relative z-10 bg-slate-900 group-hover:border-primary/50 transition-colors">
              {galo?.photoUrl ? (
                <img src={galo.photoUrl} className="w-full h-full object-cover" alt="Galo" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-black text-2xl">G</div>
              )}
            </div>
            {/* Body, Arms and Legs */}
            <div className="absolute top-[45px] md:top-[50px] left-1/2 -translate-x-1/2 w-12 h-14 bg-blue-700/80 rounded-t-xl" />
            
            {/* Arms */}
            <motion.div 
              animate={{ rotate: gameState === 'saved' ? (gkPos.x > 50 ? -80 : 30) : 0 }}
              className="absolute top-[20px] left-[-20px] w-12 h-4 bg-blue-700/90 rounded-full origin-right" 
            />
            <motion.div 
              animate={{ rotate: gameState === 'saved' ? (gkPos.x > 50 ? -30 : 80) : 0 }}
              className="absolute top-[20px] right-[-20px] w-12 h-4 bg-blue-700/90 rounded-full origin-left" 
            />

            {/* Legs */}
            <motion.div 
              animate={{ rotate: gameState === 'saved' ? (gkPos.x > 50 ? 20 : -40) : 0 }}
              className="absolute top-[60px] md:top-[65px] left-[0px] w-4 h-10 bg-blue-800 rounded-full" 
            />
            <motion.div 
              animate={{ rotate: gameState === 'saved' ? (gkPos.x > 50 ? 40 : -20) : 0 }}
              className="absolute top-[60px] md:top-[65px] right-[0px] w-4 h-10 bg-blue-800 rounded-full" 
            />
          </div>
        </motion.div>

        {/* Ball */}
        <motion.div 
          animate={{ 
            left: `${ballPos.x}%`, 
            top: `${ballPos.y}%`, 
            scale: gameState === 'aiming' ? 1 : 0.45,
            rotate: gameState === 'shooting' ? 720 : 0
          }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-40"
        >
          <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-full flex items-center justify-center text-3xl border-4 border-gray-200 shadow-xl">
            ⚽
          </div>
        </motion.div>

        {/* Instructions */}
        {gameState === 'aiming' && (
          <div className="mt-auto mb-20 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
             <div className="flex gap-10 text-white/10">
                <Footprints size={48} className="rotate-12" />
                <Footprints size={48} className="-rotate-12" />
             </div>
             <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.5em] flex items-center gap-3">
               <Zap size={14} className="text-primary animate-pulse" />
               ELEGÍ DÓNDE PATEAR
               <Zap size={14} className="text-primary animate-pulse" />
             </p>
          </div>
        )}
      </div>

      {/* Result UI Overlays */}
      <AnimatePresence>
        {gameState !== 'aiming' && gameState !== 'shooting' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-xl p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-surface border border-white/10 p-8 rounded-[3rem] text-center space-y-6 shadow-2xl max-w-sm w-full"
            >
              <div className={cn(
                "w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-2xl border-4",
                gameState === 'scored' ? "bg-green-500 border-green-400 rotate-3" : "bg-red-500 border-red-400"
              )}>
                {gameState === 'scored' ? <Trophy size={40} className="text-black" /> : <XCircle size={40} className="text-white" />}
              </div>
              
              <div className="space-y-1">
                <h3 className="text-4xl font-black italic tracking-tighter uppercase leading-none text-white">
                  {gameState === 'scored' ? '¡GOLAZO!' : '¡LO TAPÓ!'}
                </h3>
                <p className="text-white/40 font-bold text-xs px-2 leading-relaxed">
                  {gameState === 'scored' 
                    ? 'Definición magistral. Galo no pudo hacer nada ante semejante disparo.' 
                    : 'Galo demuestra por qué es el número uno. Adivinó tu intención.'}
                </p>
              </div>

              <button 
                onClick={resetBall}
                className="w-full h-14 bg-white text-black rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl hover:bg-primary transition-colors"
              >
                <RefreshCw size={18} />
                PATEAR OTRA VEZ
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GaloPenalty;
