import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Player, Match, subscribeToPlayers, subscribeToMatches } from '@/services/db';
import { getWeeklySeed, getWeeklyItem, getWeeklyRandom } from '@/lib/gameUtils';
import { Users, Info, ShieldAlert, CheckCircle2, XCircle, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Challenge {
  id: string;
  title: string;
  description: string;
  check: (player: Player, matches: Match[]) => boolean;
}

const Coincidences = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null);
  const [options, setOptions] = useState<Player[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const challenges: Challenge[] = [
    {
      id: 'hattrick',
      title: 'Goleadores Letales',
      description: 'Seleccioná a los jugadores que marcaron 3 o más goles en un mismo partido.',
      check: (p, ms) => {
        const pNames = [p.name.toLowerCase(), ...(p.nicknames || []).map(n => n.toLowerCase())];
        return ms.some(m => {
          const matchGoals = Object.entries(m.goals || {}).reduce((sum, [name, count]) => {
            if (pNames.includes(name.toLowerCase())) return sum + count;
            return sum;
          }, 0);
          return matchGoals >= 3;
        });
      }
    },
    {
      id: 'high_points',
      title: 'Élite de Puntos',
      description: 'Seleccioná a los jugadores que superan los 40 puntos totales.',
      check: (p) => p.stats.points > 40
    },
    {
      id: 'high_pj',
      title: 'Veteranos',
      description: 'Seleccioná a los jugadores que tienen 15 o más partidos jugados.',
      check: (p) => (p.stats.pj || 0) >= 15
    },
    {
      id: 'mvp',
      title: 'Figuras de la Cancha',
      description: 'Seleccioná a los jugadores que fueron elegidos MOTM (MVP) al menos una vez.',
      check: (p) => (p.stats as any).motm > 0 || !!p.stats.motm
    }
  ];

  useEffect(() => {
    const unsubPlayers = subscribeToPlayers(setPlayers);
    const unsubMatches = subscribeToMatches(setMatches);
    
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => {
      unsubPlayers();
      unsubMatches();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (players.length > 0 && matches.length > 0 && !currentChallenge) {
      const seed = getWeeklySeed();
      const challenge = getWeeklyItem(challenges, seed, 404);
      
      const truePlayers = players.filter(p => challenge.check(p, matches));
      const falsePlayers = players.filter(p => !challenge.check(p, matches));

      if (truePlayers.length < 2 || falsePlayers.length < 2) {
        // Try another challenge from the list if this one doesn't have enough data
        const fallbackChallenge = challenges.find(c => {
          const t = players.filter(p => c.check(p, matches));
          const f = players.filter(p => !c.check(p, matches));
          return t.length >= 2 && f.length >= 2;
        });

        if (!fallbackChallenge) {
          setError('No hay suficientes datos estadísticos para generar un desafío hoy.');
          setLoading(false);
          return;
        }
        
        // Use fallback
        const truePlayersF = players.filter(p => fallbackChallenge.check(p, matches));
        const falsePlayersF = players.filter(p => !fallbackChallenge.check(p, matches));
        setCurrentChallenge(fallbackChallenge);
        
        const shuffledTrueF = [...truePlayersF].sort(() => 0.5 - Math.random());
        const shuffledFalseF = [...falsePlayersF].sort(() => 0.5 - Math.random());
        const finalOptionsF = [...shuffledTrueF.slice(0, 4), ...shuffledFalseF.slice(0, 4)].sort(() => 0.5 - Math.random());
        setOptions(finalOptionsF);
        setError(null);
      } else {
        setCurrentChallenge(challenge);
        const shuffledTrue = [...truePlayers].sort(() => getWeeklyRandom(seed, 10) - 0.5);
        const shuffledFalse = [...falsePlayers].sort(() => getWeeklyRandom(seed, 20) - 0.5);
        const selectedTrue = shuffledTrue.slice(0, 4);
        const selectedFalse = shuffledFalse.slice(0, 4);
        const finalOptions = [...selectedTrue, ...selectedFalse].sort(() => getWeeklyRandom(seed, 30) - 0.5);
        setOptions(finalOptions);
        setError(null);
      }
      
      setLoading(false);
    } else if (players.length > 0 && matches.length > 0 && loading) {
       // All data available but logic didn't trigger? 
       // This handles cases where matches/players are empty initially
       setLoading(false);
    }
  }, [players, matches]);

  const handleSelect = (player: Player) => {
    if (gameState !== 'playing' || selectedIds.includes(player.id)) return;

    const isCorrect = currentChallenge?.check(player, matches);

    if (isCorrect) {
      const newSelected = [...selectedIds, player.id];
      setSelectedIds(newSelected);
      
      const remainingTrue = options.filter(p => currentChallenge?.check(p, matches) && !newSelected.includes(p.id));
      if (remainingTrue.length === 0) {
        setGameState('won');
        toast.success('¡Excelente reconocimiento estadístico!');
      } else {
        toast.success(`¡Correcto! ${player.name} cumple la condición.`);
      }
    } else {
      setGameState('lost');
      toast.error(`ERROR: ${player.name} no cumple la condición. Perdiste.`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-gray-500 font-black text-[10px] uppercase tracking-widest leading-none">Cruzando datos...</p>
      </div>
    );
  }

  if (error || !currentChallenge) {
    return (
      <div className="flex flex-col items-center justify-center h-96 p-8 text-center space-y-4">
        <Users size={48} className="text-gray-600" />
        <p className="text-white font-bold">{error || 'Faltan datos estadísticos'}</p>
        <p className="text-gray-400 text-sm">Se necesitan más partidos y jugadores registrados para habilitar este juego.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 mb-2">
          <ShieldAlert size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest">Sin Vidas - Elegí bien</span>
        </div>
        <h2 className="text-3xl font-black text-white tracking-tighter uppercase">{currentChallenge.title}</h2>
        <p className="text-gray-400 font-medium max-w-lg mx-auto leading-tight">
          {currentChallenge.description}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {options.map((player) => {
          const isSelected = selectedIds.includes(player.id);
          const isCorrect = currentChallenge.check(player, matches);
          
          return (
            <motion.button
              key={player.id}
              whileHover={gameState === 'playing' ? { scale: 1.02 } : {}}
              whileTap={gameState === 'playing' ? { scale: 0.98 } : {}}
              onClick={() => handleSelect(player)}
              disabled={gameState !== 'playing' || isSelected}
              className={cn(
                "relative flex flex-col items-center p-4 rounded-3xl border-2 transition-all duration-300",
                isSelected && "bg-primary/20 border-primary shadow-[0_0_20px_rgba(16,185,129,0.2)]",
                !isSelected && gameState === 'playing' && "bg-surface border-white/5 hover:border-white/10",
                !isSelected && gameState === 'lost' && isCorrect && "border-primary/50 bg-primary/5",
                !isSelected && gameState === 'lost' && !isCorrect && "opacity-30 border-white/5"
              )}
            >
              <div className="w-16 h-16 rounded-2xl overflow-hidden mb-3 border-2 border-white/10">
                {player.photoUrl ? (
                  <img src={player.photoUrl} className="w-full h-full object-cover" alt={player.name} />
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center text-gray-500">
                    <Users size={24} />
                  </div>
                )}
              </div>
              
              <div className="text-center">
                <p className="text-sm font-black text-white uppercase tracking-tighter mb-1 leading-none">{player.name}</p>
                {isSelected && <CheckCircle2 size={16} className="text-primary mx-auto mt-2" />}
              </div>

              {gameState === 'lost' && !isCorrect && !isSelected && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-3xl">
                   <XCircle size={24} className="text-red-500" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {gameState !== 'playing' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface border border-white/10 p-8 rounded-3xl text-center space-y-6 shadow-2xl"
        >
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center mx-auto",
            gameState === 'won' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
          )}>
            {gameState === 'won' ? <Trophy size={48} /> : <XCircle size={48} />}
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
              {gameState === 'won' ? '¡PERFECTO!' : 'FALLASTE'}
            </h3>
            <p className="text-gray-400 font-medium">
              {gameState === 'won' ? 'Conocés perfectamente las estadísticas del equipo.' : 'Un infiltrado te engañó.'}
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-primary text-background py-4 rounded-2xl font-black uppercase tracking-widest"
          >
            Volver a Intentar la Próxima Semana
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default Coincidences;
