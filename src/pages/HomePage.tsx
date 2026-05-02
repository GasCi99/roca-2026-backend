import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Users, Star, Activity, Clock, Calendar, ArrowRight, User, TrendingUp, PiggyBank, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Player, Match, subscribeToPlayers, subscribeToMatches, subscribeToPotm, updatePotm, subscribeToPozo, updatePozo } from '@/services/db';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePassword } from '@/contexts/PasswordContext';
import { calculateStreaks } from '@/lib/statsUtils';
import { toast } from 'sonner';

const Pozo = () => {
  const [pozoData, setPozoData] = useState<{ amount: number, updatedAt: string } | null | undefined>(undefined);
  const [currentAmount, setCurrentAmount] = useState<number>(0);
  const [displayAmount, setDisplayAmount] = useState<number>(0);
  const { isAuthenticated } = usePassword();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const unsub = subscribeToPozo(setPozoData);
    return () => unsub();
  }, []);

  useEffect(() => {
    const calculateCurrent = () => {
      if (pozoData === undefined) return; // Wait for data to load

      let baseAmount = 97778;
      let updated = new Date('2024-01-01T00:00:00Z'); // Fallback date

      if (pozoData !== null) {
        baseAmount = pozoData.amount;
        updated = new Date(pozoData.updatedAt);
      }

      const now = new Date();
      
      // Calculate Wednesdays 00:30 passed
      let wednesdaysPassed = 0;
      let current = new Date(updated);
      
      if (current.getHours() > 0 || (current.getHours() === 0 && current.getMinutes() >= 30)) {
        current.setDate(current.getDate() + 1);
      }
      current.setHours(0, 30, 0, 0);

      while (current <= now) {
        if (current.getDay() === 3) {
          wednesdaysPassed++;
        }
        current.setDate(current.getDate() + 1);
      }

      const amountWithAdditions = baseAmount + (wednesdaysPassed * 10000);
      
      // 21% annual growth calculated once per day
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const updatedStart = new Date(updated.getFullYear(), updated.getMonth(), updated.getDate());
      const daysPassed = Math.max(0, (todayStart.getTime() - updatedStart.getTime()) / (1000 * 60 * 60 * 24));
      const yearsPassed = daysPassed / 365.25;
      const growthMultiplier = Math.pow(1.21, yearsPassed);
      
      setCurrentAmount(Math.floor(amountWithAdditions * growthMultiplier));
    };

    calculateCurrent();
    // No setInterval so the number stays static during the day
  }, [pozoData]);

  useEffect(() => {
    if (currentAmount === 0) return;
    let start = 0;
    const end = currentAmount;
    const duration = 2000;
    let startTime: number | null = null;
    let animationFrameId: number;
    
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayAmount(Math.floor(easeProgress * end));
      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      }
    };
    animationFrameId = window.requestAnimationFrame(step);
    
    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [currentAmount]);

  const handleSave = async () => {
    const val = parseFloat(editValue);
    if (!isNaN(val)) {
      try {
        await updatePozo(val);
        setIsEditing(false);
      } catch (err) {
        console.error("Error updating pozo:", err);
      }
    }
  };

  return (
    <div className="bg-surface border border-white/5 rounded-2xl p-8 relative overflow-hidden group shadow-2xl text-center mt-6">
      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
        <PiggyBank size={100} className="text-pink-400" />
      </div>
      <div className="relative space-y-6">
        <div className="flex items-center justify-center gap-3 text-pink-400">
          <PiggyBank size={24} className="animate-bounce" />
          <h3 className="text-sm font-black uppercase tracking-[0.2em]">Pozo Actual Acumulado</h3>
        </div>
        
        {isEditing && isAuthenticated ? (
          <div className="flex items-center justify-center gap-2">
            <input 
              type="number" 
              value={editValue} 
              onChange={e => setEditValue(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none w-32 text-center"
            />
            <button onClick={handleSave} className="bg-pink-500 text-white px-4 py-2 rounded-lg font-bold">Guardar</button>
            <button onClick={() => setIsEditing(false)} className="bg-gray-600 text-white px-4 py-2 rounded-lg font-bold">Cancelar</button>
          </div>
        ) : (
          <div 
            className="text-5xl md:text-7xl font-black tracking-tighter bg-gradient-to-b from-pink-300 to-pink-600 bg-clip-text text-transparent cursor-pointer"
            onClick={() => {
              if (isAuthenticated) {
                setEditValue(currentAmount.toFixed(0));
                setIsEditing(true);
              }
            }}
            title={isAuthenticated ? "Click para editar" : ""}
          >
            ${displayAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
          </div>
        )}

        <div className="pt-4 border-t border-white/5">
          <p className="text-gray-400 text-sm font-medium">Contribuciones:</p>
          <p className="text-white font-black tracking-widest text-lg bg-white/5 inline-block px-4 py-2 rounded-lg mt-2 border border-white/10">POZO.ROCA.FUGA</p>
        </div>
      </div>
    </div>
  );
};

const Countdown = () => {
  const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number, seconds: number } | null>(null);
  const [isMatchInProgress, setIsMatchInProgress] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      
      // Check if it's Tuesday between 23:00 and 00:00
      if (now.getDay() === 2 && now.getHours() === 23) {
        if (!isMatchInProgress) {
          setIsMatchInProgress(true);
          toast.info("¡Partido en curso!", {
            description: "El partido de los martes está sucediendo ahora.",
            duration: 5000,
          });
        }
        setTimeLeft(null);
        return;
      }

      setIsMatchInProgress(false);
      
      // Target: Next Tuesday at 23:00 ART (UTC-3) -> Wednesday 02:00 UTC
      let target = new Date();
      target.setHours(23, 0, 0, 0);
      
      // Find next Tuesday (2)
      const day = target.getDay();
      const daysUntilTuesday = (2 - day + 7) % 7;
      
      target.setDate(target.getDate() + daysUntilTuesday);
      
      // If it's already past 23:00 on Tuesday, move to next week
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 7);
      }

      const difference = target.getTime() - now.getTime();
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      }
    };

    const timer = setInterval(calculateTimeLeft, 1000);
    calculateTimeLeft();
    return () => clearInterval(timer);
  }, [isMatchInProgress]);

  if (isMatchInProgress) {
    return (
      <div className="bg-primary/10 border border-primary/30 rounded-2xl p-8 animate-pulse flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-primary">
          <Activity size={24} className="animate-bounce" />
          <span className="text-2xl font-black uppercase tracking-[0.2em]">¡Partido en curso!</span>
        </div>
        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">El partido se está jugando ahora</p>
      </div>
    );
  }

  if (!timeLeft) return null;

  return (
    <div className="grid grid-cols-4 gap-2 md:gap-4 w-full max-w-md mx-auto">
      {[
        { label: 'Días', value: timeLeft.days },
        { label: 'Horas', value: timeLeft.hours },
        { label: 'Min', value: timeLeft.minutes },
        { label: 'Seg', value: timeLeft.seconds },
      ].map((item) => (
        <div key={item.label} className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center backdrop-blur-sm">
          <span className="text-2xl md:text-4xl font-black text-primary tabular-nums">{item.value.toString().padStart(2, '0')}</span>
          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

const HomePage = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [potmId, setPotmId] = useState<string | null>(null);
  const { isAuthenticated } = usePassword();

  useEffect(() => {
    const unsubPlayers = subscribeToPlayers(setPlayers);
    const unsubMatches = subscribeToMatches(setMatches);
    const unsubPotm = subscribeToPotm(setPotmId);
    return () => {
      unsubPlayers();
      unsubMatches();
      unsubPotm();
    };
  }, []);

  const lastMatch = matches.length > 0 ? matches[0] : null;
  
  // Calculate stats for the previous month
  const lastMonth = subMonths(new Date(), 1);
  const startOfLastMonth = startOfMonth(lastMonth);
  const endOfLastMonth = endOfMonth(lastMonth);
  
  const lastMonthMatches = matches.filter(m => {
    const matchDate = new Date(m.date);
    return isWithinInterval(matchDate, { start: startOfLastMonth, end: endOfLastMonth });
  });

  // Goleador of last month
  const goalCounts: Record<string, number> = {};
  lastMonthMatches.forEach(m => {
    Object.entries(m.goals || {}).forEach(([playerName, count]) => {
      goalCounts[playerName] = (goalCounts[playerName] || 0) + (count as number);
    });
  });
  
  const topScorerName = Object.entries(goalCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topScorerOfLastMonth = players.find(p => p.name === topScorerName);
  
  const potmPlayer = players.find(p => p.id === potmId);
  // Calculate Streaks
  const playerStreaks = players.map(p => ({
    player: p,
    streaks: calculateStreaks(p, matches)
  }));

  const winStreakPlayers = playerStreaks
    .filter(ps => ps.streaks.currentWinStreak >= 2)
    .sort((a, b) => b.streaks.currentWinStreak - a.streaks.currentWinStreak);

  const goalStreakPlayers = playerStreaks
    .filter(ps => ps.streaks.currentGoalStreak >= 2)
    .sort((a, b) => b.streaks.currentGoalStreak - a.streaks.currentGoalStreak);

  return (
    <div className="space-y-10 pb-10">
      {/* Hero Section: Last Match */}
      <section className="relative group">
        <Link to="/historial" className="block">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-secondary/50 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative bg-surface border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-4">
              <div className="bg-primary/20 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-primary/30">
                Último Resultado
              </div>
            </div>
            
            <div className="p-8 md:p-12 flex flex-col items-center">
              {lastMatch ? (
                <div className="w-full space-y-8">
                  <div className="flex flex-col items-center">
                    <Calendar size={16} className="text-gray-500 mb-2" />
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                      {format(new Date(lastMatch.date.split('T')[0] + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-1 md:gap-12 max-w-5xl mx-auto w-full">
                    {/* Team Claro */}
                    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                      <div className={cn(
                        "w-12 h-12 md:w-24 md:h-24 rounded-xl md:rounded-2xl flex items-center justify-center text-2xl md:text-5xl shadow-xl transition-transform hover:scale-110",
                        lastMatch.result === 'claro' ? "bg-white text-background" : "bg-white/10 text-white/50"
                      )}>
                        ⚪
                      </div>
                      <span className={cn(
                        "hidden md:block font-black text-sm md:text-2xl tracking-tighter leading-none mb-1",
                        lastMatch.result === 'claro' ? "text-white" : "text-gray-500"
                      )}>CLARO</span>
                      <div className="flex flex-col items-center gap-0 w-full mt-1">
                        {lastMatch.teamClaro.map(p => (
                          <div key={p} className="flex items-center gap-1 leading-tight">
                            <span className="text-[7px] md:text-xs font-bold text-gray-400 uppercase whitespace-nowrap overflow-hidden text-ellipsis max-w-[70px] md:max-w-none">{p}</span>
                            {(lastMatch.goals?.[p] || 0) > 0 && (
                              <span className="text-[7px] md:text-xs text-primary font-black">
                                ({lastMatch.goals![p]})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="flex flex-col items-center gap-0.5 md:gap-2 shrink-0">
                      <div className="text-3xl md:text-8xl font-black tracking-tighter bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent px-0.5 md:px-4 leading-none">
                        {lastMatch.claroScore} - {lastMatch.oscuroScore}
                      </div>
                      <div className="bg-white/5 px-1.5 md:px-4 py-0.5 md:py-1 rounded-full border border-white/10 text-[6px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {lastMatch.result === 'draw' ? 'Empate' : 'Final'}
                      </div>
                    </div>

                    {/* Team Oscuro */}
                    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                      <div className={cn(
                        "w-12 h-12 md:w-24 md:h-24 rounded-xl md:rounded-2xl flex items-center justify-center text-2xl md:text-5xl shadow-xl transition-transform hover:scale-110",
                        lastMatch.result === 'oscuro' ? "bg-gray-700 text-white" : "bg-white/10 text-white/50"
                      )}>
                        ⚫
                      </div>
                      <span className={cn(
                        "hidden md:block font-black text-sm md:text-2xl tracking-tighter leading-none mb-1",
                        lastMatch.result === 'oscuro' ? "text-white" : "text-gray-500"
                      )}>OSCURO</span>
                      <div className="flex flex-col items-center gap-0 w-full mt-1">
                        {lastMatch.teamOscuro.map(p => (
                          <div key={p} className="flex items-center gap-1 leading-tight">
                            <span className="text-[7px] md:text-xs font-bold text-gray-400 uppercase whitespace-nowrap overflow-hidden text-ellipsis max-w-[70px] md:max-w-none">{p}</span>
                            {(lastMatch.goals?.[p] || 0) > 0 && (
                              <span className="text-[7px] md:text-xs text-primary font-black">
                                ({lastMatch.goals![p]})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {lastMatch.motm && (
                    <div className="flex flex-col items-center pt-4 border-t border-white/5">
                      <div className="flex items-center gap-2 text-accent mb-2">
                        <Star size={16} fill="currentColor" />
                        <span className="text-xs font-black uppercase tracking-widest">Figura del Partido</span>
                      </div>
                      <p className="text-xl font-bold text-white">{lastMatch.motm}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                    <Activity size={32} className="text-gray-600" />
                  </div>
                  <p className="text-gray-500 font-medium">No hay partidos registrados aún.</p>
                </div>
              )}
            </div>
          </div>
        </Link>
      </section>

      {/* Countdown Section */}
      <section className="text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-primary">Próximo Partido</h2>
          <p className="text-gray-500 text-xs">Martes 23:00 hs Argentina</p>
        </div>
        <Countdown />
      </section>

      {/* Rachas Section */}
      {(winStreakPlayers.length > 0 || goalStreakPlayers.length > 0) && (
        <section className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <Flame size={20} className="text-red-500 animate-pulse" />
            <h2 className="text-sm font-black uppercase tracking-[0.3em] text-white">Rachas Activas</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {winStreakPlayers.slice(0, 2).map((ps) => (
              <Link 
                key={ps.player.id} 
                to={`/jugador/${ps.player.id}`}
                className="bg-surface border rounded-2xl p-6 relative overflow-hidden group transition-all fire-border-red"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Flame size={60} className="text-red-500" />
                </div>
                <div className="relative flex items-center gap-4">
                  <div className="relative">
                    <img 
                      src={ps.player.photoUrl} 
                      alt={ps.player.name} 
                      className="relative w-16 h-16 rounded-full object-cover border-2 border-red-500/50 animate-fire" 
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-black text-white tracking-tight">{ps.player.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                        {ps.streaks.currentWinStreak} Victorias
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {goalStreakPlayers.slice(0, 2).map((ps) => (
              <Link 
                key={ps.player.id} 
                to={`/jugador/${ps.player.id}`}
                className="bg-surface border rounded-2xl p-6 relative overflow-hidden group transition-all fire-border-blue"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Flame size={60} className="text-blue-500" />
                </div>
                <div className="relative flex items-center gap-4">
                  <div className="relative">
                    <img 
                      src={ps.player.photoUrl} 
                      alt={ps.player.name} 
                      className="relative w-16 h-16 rounded-full object-cover border-2 border-blue-500/50 animate-fire-blue" 
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-black text-white tracking-tight">{ps.player.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                        {ps.streaks.currentGoalStreak} Goleador
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Stats Grid */}
      <section className="max-w-xl mx-auto w-full space-y-6">
        {/* Mejor Jugador del Mes Pasado */}
        <div className="bg-surface border border-white/5 rounded-2xl p-8 relative overflow-hidden group shadow-2xl">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Star size={100} className="text-yellow-400" />
          </div>
          <div className="relative space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-yellow-400">
                <Star size={24} />
                <h3 className="text-sm font-black uppercase tracking-[0.2em]">Mejor Jugador del Mes Pasado</h3>
              </div>
              {isAuthenticated && (
                <select 
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                  value={potmId || ''}
                  onChange={async (e) => {
                    try {
                      await updatePotm(e.target.value);
                    } catch (err) {
                      console.error("Error updating POTM:", err);
                    }
                  }}
                >
                  <option value="">Seleccionar...</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>
            
            {potmPlayer ? (
              <Link to={`/jugador/${potmPlayer.id}`} className="flex items-center gap-6 hover:bg-white/5 p-4 -mx-4 rounded-xl transition-colors">
                <div className="relative">
                  <div className="absolute -inset-2 bg-yellow-400 rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                  <img src={potmPlayer.photoUrl} alt={potmPlayer.name} className="relative w-24 h-24 rounded-full object-cover border-4 border-yellow-400/30 shadow-2xl" />
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-black text-white tracking-tighter">{potmPlayer.name}</p>
                  <p className="text-sm text-gray-500 font-black uppercase tracking-widest">MVP del Mes</p>
                </div>
              </Link>
            ) : (
              <div className="py-4 text-center">
                <p className="text-gray-500 text-sm italic">Aún no seleccionado</p>
              </div>
            )}
          </div>
        </div>

        {/* Goleador of Last Month */}
        <div className="bg-surface border border-white/5 rounded-2xl p-8 relative overflow-hidden group shadow-2xl">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={100} className="text-accent" />
          </div>
          <div className="relative space-y-6">
            <div className="flex items-center gap-3 text-accent">
              <Trophy size={24} />
              <h3 className="text-sm font-black uppercase tracking-[0.2em]">Goleador del Mes Pasado</h3>
            </div>
            
            {topScorerOfLastMonth ? (
              <Link to={`/jugador/${topScorerOfLastMonth.id}`} className="flex items-center gap-6 hover:bg-white/5 p-4 -mx-4 rounded-xl transition-colors">
                <div className="relative">
                  <div className="absolute -inset-2 bg-accent rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                  <img src={topScorerOfLastMonth.photoUrl} alt={topScorerOfLastMonth.name} className="relative w-24 h-24 rounded-full object-cover border-4 border-accent/30 shadow-2xl" />
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-black text-white tracking-tighter">{topScorerOfLastMonth.name}</p>
                  <p className="text-sm text-gray-500 font-black uppercase tracking-widest">{goalCounts[topScorerOfLastMonth.name]} Goles Marcados</p>
                </div>
              </Link>
            ) : (
              <div className="py-4 text-center">
                <p className="text-gray-500 text-sm italic">Sin datos del mes anterior</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Pozo Section */}
      <section className="max-w-xl mx-auto w-full">
        <Pozo />
      </section>
    </div>
  );
};

export default HomePage;
