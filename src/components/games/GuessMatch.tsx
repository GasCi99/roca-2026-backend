import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Match, Player, subscribeToMatches, subscribeToPlayers } from '@/services/db';
import { getWeeklySeed, getWeeklyItem, getWeeklyRandom } from '@/lib/gameUtils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trophy, Users, Heart, CheckCircle2, XCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import PlayerSearch from './PlayerSearch';

interface PlayerCardProps {
  pName: string;
  photoUrl?: string;
  team: 'claro' | 'oscuro';
  isRevealed: boolean;
  isGuessed: boolean;
  gameState: 'loading' | 'selecting' | 'playing' | 'won' | 'lost';
}

const PlayerCard = ({ pName, photoUrl, team, isRevealed, isGuessed, gameState }: PlayerCardProps) => {
  const isShowing = isRevealed || isGuessed || gameState !== 'playing';
  
  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-2xl transition-all duration-500 border",
        isRevealed ? "bg-white/5 border-white/10 opacity-60" :
        isGuessed ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_15px_rgba(16,185,129,0.1)]" :
        gameState === 'lost' ? "bg-red-500/10 border-red-500/20 text-red-500" :
        team === 'claro' ? "bg-white/5 border-white/10" : "bg-gray-900 border-white/5"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black overflow-hidden border border-white/5",
        team === 'claro' ? "bg-white text-background" : "bg-gray-950 text-white"
      )}>
        {isShowing ? (
          photoUrl ? (
            <img src={photoUrl} alt={pName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : pName[0].toUpperCase()
        ) : '?'}
      </div>
      
      <div className="flex-1 min-w-0">
        {isShowing ? (
          <div className="text-[12px] font-black uppercase tracking-tight truncate">
            {pName}
          </div>
        ) : (
          <div className="h-2 w-16 bg-white/5 rounded-full" />
        )}
      </div>
      
      {isGuessed && <CheckCircle2 size={14} className="text-primary shrink-0" />}
    </div>
  );
};

const GuessMatch = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [targetMatch, setTargetMatch] = useState<Match | null>(null);
  const [revealedPlayers, setRevealedPlayers] = useState<string[]>([]);
  const [guessedPlayers, setGuessedPlayers] = useState<string[]>([]);
  const [lives, setLives] = useState(5);
  const [inputValue, setInputValue] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'hard'>('easy');
  const [gameState, setGameState] = useState<'loading' | 'selecting' | 'playing' | 'won' | 'lost'>('loading');

  useEffect(() => {
    const unsubMatches = subscribeToMatches((data) => {
      setMatches(data);
      if (data.length > 0) setGameState('selecting');
    });
    const unsubPlayers = subscribeToPlayers(setPlayers);
    const timeout = setTimeout(() => {
      setGameState(prev => prev === 'loading' ? 'selecting' : prev);
    }, 3000);
    return () => {
      unsubMatches();
      unsubPlayers();
      clearTimeout(timeout);
    };
  }, []);

  const startGame = (diff: 'easy' | 'hard') => {
    const seed = getWeeklySeed();
    // Filter matches that have teams, scores and are from April 4th 2026 onwards
    const validMatches = matches.filter(m => 
      m.teamClaro && m.teamClaro.length > 0 && 
      m.teamOscuro && m.teamOscuro.length > 0 &&
      m.date >= '2026-04-04'
    );
    
    if (validMatches.length === 0) {
      toast.error('No se encontraron partidos válidos en el historial.');
      console.log('Available matches:', matches);
      return;
    }

    const target = getWeeklyItem(validMatches, seed, 202);
    setTargetMatch(target);
    setDifficulty(diff);
    setLives(diff === 'easy' ? 7 : 4);
    setGameState('playing');
    setGuessedPlayers([]);
    
    const allMatchPlayers = [...target.teamClaro, ...target.teamOscuro];
    const initialRevealCount = diff === 'easy' ? Math.max(3, Math.floor(allMatchPlayers.length * 0.4)) : 2;
    
    // Pick initial revealed players using seed
    const initialRevealed: string[] = [];
    for (let i = 0; i < initialRevealCount; i++) {
       const p = getWeeklyItem(allMatchPlayers.filter(name => !initialRevealed.includes(name)), seed, i * 50);
       if (p) initialRevealed.push(p);
    }
    setRevealedPlayers(initialRevealed);
  };

  if (gameState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Cargando Historial...</p>
      </div>
    );
  }

  const onSelectPlayer = (pName: string) => {
    if (!targetMatch || gameState !== 'playing') return;

    const guess = pName.toLowerCase();
    const allMatchPlayers = [...targetMatch.teamClaro, ...targetMatch.teamOscuro];
    
    // Find if the selected player (from PlayerSearch which gives canonical name) is in the match
    const matchedPlayer = allMatchPlayers.find(p => p.toLowerCase() === guess);

    if (matchedPlayer) {
      if (revealedPlayers.includes(matchedPlayer) || guessedPlayers.includes(matchedPlayer)) {
        toast.info('Ya adivinaste a este jugador');
      } else {
        setGuessedPlayers(prev => [...prev, matchedPlayer]);
        toast.success(`¡Correcto! ${matchedPlayer} participó.`);
        
        // Check win
        if (guessedPlayers.length + revealedPlayers.length + 1 === allMatchPlayers.length) {
          setGameState('won');
        }
      }
    } else {
      const newLives = lives - 1;
      setLives(newLives);
      toast.error(`${pName} no participó en este partido`);
      if (newLives <= 0) {
        setGameState('lost');
      }
    }
  };

  if (gameState === 'selecting') {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full space-y-8">
        <div className="text-center space-y-2">
          <Trophy size={64} className="text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-black text-white">ADIVINA EL PARTIDO</h2>
          <p className="text-gray-400 max-w-sm mx-auto">
            Te damos el resultado y algunos jugadores. Debes completar el resto de la formación.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
          <button 
            onClick={() => startGame('easy')}
            className="p-6 bg-surface border border-primary/20 rounded-3xl hover:bg-primary/5 transition-all group"
          >
            <h4 className="font-black text-primary uppercase tracking-widest mb-1 group-hover:scale-105 transition-transform">Fácil</h4>
            <p className="text-xs text-gray-500">Más jugadores iniciales y 7 vidas.</p>
          </button>
          <button 
            onClick={() => startGame('hard')}
            className="p-6 bg-surface border border-red-500/20 rounded-3xl hover:bg-red-500/5 transition-all group"
          >
            <h4 className="font-black text-red-500 uppercase tracking-widest mb-1 group-hover:scale-105 transition-transform">Difícil</h4>
            <p className="text-xs text-gray-500">Solo 2 jugadores iniciales y 4 vidas.</p>
          </button>
        </div>
      </div>
    );
  }

  const allPlayersInTarget = targetMatch ? [...targetMatch.teamClaro, ...targetMatch.teamOscuro] : [];
  
  const getPlayerPhoto = (name: string) => {
    return players.find(p => p.name.toLowerCase() === name.toLowerCase())?.photoUrl;
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-white leading-none tracking-tighter uppercase italic">
            PARTIDO DEL {format(new Date(targetMatch!.date), 'd/MM/yyyy')}
          </h2>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-bold text-xs">
                <Users size={14} />
                <span>{guessedPlayers.length + revealedPlayers.length} / {allPlayersInTarget.length} JUGADORES</span>
             </div>
             <div className="flex gap-1.5 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                {Array(difficulty === 'easy' ? 7 : 4).fill('').map((_, i) => (
                    <Heart 
                    key={i} 
                    size={14} 
                    className={cn(
                        "transition-all duration-500",
                        i < lives ? "text-red-500 fill-red-500" : "text-gray-700"
                    )} 
                    />
                ))}
             </div>
          </div>
        </div>

        {gameState === 'playing' && (
           <div className="w-full md:w-[400px] z-[200] relative">
              <PlayerSearch 
                players={players}
                onSelect={onSelectPlayer}
                placeholder="Busca el jugador..."
              />
           </div>
        )}
      </div>

      <div className="bg-surface/50 rounded-[1.5rem] md:rounded-[2.5rem] p-4 md:p-10 border border-white/5 space-y-6 md:space-y-10 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-center gap-4 md:gap-16 text-center">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="w-10 h-10 md:w-24 md:h-24 rounded-2xl md:rounded-3xl bg-white flex items-center justify-center text-xl md:text-4xl shadow-2xl border-2 md:border-4 border-white/10 text-background">⚪</div>
            <div className="text-4xl md:text-8xl font-black text-white italic tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">{targetMatch?.claroScore}</div>
          </div>
          
          <div className="flex flex-col items-center">
             <div className="h-10 md:h-20 w-px bg-white/10 mb-2 md:mb-4" />
             <div className="text-[10px] md:text-lg font-black text-gray-700 italic tracking-[0.2em] md:tracking-[0.3em]">VS</div>
             <div className="h-10 md:h-20 w-px bg-white/10 mt-2 md:mb-4" />
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <div className="text-4xl md:text-8xl font-black text-white italic tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">{targetMatch?.oscuroScore}</div>
            <div className="w-10 h-10 md:w-24 md:h-24 rounded-2xl md:rounded-3xl bg-gray-900 border-2 md:border-4 border-black/50 flex items-center justify-center text-xl md:text-4xl shadow-2xl">⚫</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Team Claro */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">EQUIPO CLARO</span>
              <div className="h-px flex-1 bg-white/5" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
              {targetMatch?.teamClaro.map((pName, i) => (
                <PlayerCard 
                  key={`claro-${i}`} 
                  pName={pName} 
                  photoUrl={getPlayerPhoto(pName)}
                  team="claro"
                  isRevealed={revealedPlayers.includes(pName)}
                  isGuessed={guessedPlayers.includes(pName)}
                  gameState={gameState}
                />
              ))}
            </div>
          </div>

          {/* Team Oscuro */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">EQUIPO OSCURO</span>
              <div className="h-px flex-1 bg-white/5" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
              {targetMatch?.teamOscuro.map((pName, i) => (
                <PlayerCard 
                  key={`oscuro-${i}`} 
                  pName={pName} 
                  photoUrl={getPlayerPhoto(pName)}
                  team="oscuro"
                  isRevealed={revealedPlayers.includes(pName)}
                  isGuessed={guessedPlayers.includes(pName)}
                  gameState={gameState}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {gameState !== 'playing' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-surface border border-white/10 p-10 rounded-[3rem] text-center space-y-6 max-w-xl mx-auto shadow-2xl relative overflow-hidden"
        >
           <div className={cn(
            "absolute inset-x-0 top-0 h-2",
            gameState === 'won' ? "bg-green-500" : "bg-red-500"
          )} />

          <div className={cn(
            "w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl",
            gameState === 'won' ? "bg-green-500 text-black rotate-3" : "bg-red-500 text-white -rotate-3"
          )}>
            {gameState === 'won' ? <Trophy size={56} /> : <XCircle size={56} />}
          </div>
          
          <div className="space-y-2">
            <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">
              {gameState === 'won' ? '¡LEYENDA TOTAL!' : 'DERROTA'}
            </h3>
            <p className="text-white/40 font-bold max-w-xs mx-auto">
              {gameState === 'won' 
                ? 'Tu memoria es envidiable. Lograste identificar a todos los protagonistas.' 
                : 'Esta vez no pudo ser. Los recuerdos estaban un poco borrosos.'}
            </p>
          </div>

          <button 
            onClick={() => setGameState('selecting')}
            className="w-full h-16 bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-primary transition-all active:scale-95 shadow-xl"
          >
            NUEVA PARTIDA
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default GuessMatch;
