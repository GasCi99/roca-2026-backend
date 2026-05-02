import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Star, Mail, Activity, Users, ChevronDown, ChevronUp, Flame, Edit2, Check, X, Plus } from 'lucide-react';
import { Player, subscribeToPlayers, Match, subscribeToMatches, updatePlayer } from '@/services/db';
import { cn } from '@/lib/utils';
import { calculateAchievements, calculateStreaks, getInjuryStatus } from '@/lib/statsUtils';
import { usePassword } from '@/contexts/PasswordContext';
import { toast } from 'sonner';

const PlayerProfile = () => {
  const { id } = useParams();
  const [player, setPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTeammates, setShowTeammates] = useState(false);
  const { isAuthenticated } = usePassword();
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailValue, setEmailValue] = useState('');

  useEffect(() => {
    const unsubPlayers = subscribeToPlayers((allPlayers) => {
      setPlayers(allPlayers);
      const found = allPlayers.find(p => p.id === id);
      setPlayer(found || null);
      if (found) setEmailValue(found.email || '');
    });
    
    const unsubMatches = subscribeToMatches(setMatches);
    
    setLoading(false);
    
    return () => {
      unsubPlayers();
      unsubMatches();
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="text-gray-500 font-black uppercase tracking-widest text-xs">Cargando Perfil...</p>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="text-center py-20 space-y-6">
        <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto text-red-500">
          <Activity size={40} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tighter text-white">Jugador no encontrado</h2>
          <p className="text-gray-500">El perfil que buscas no existe o fue eliminado.</p>
        </div>
        <Link to="/jugadores" className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-widest text-xs hover:underline">
          <ArrowLeft size={14} /> Volver a la lista
        </Link>
      </div>
    );
  }

  const winRate = player.stats.pj > 0 ? Math.round((player.stats.pg / player.stats.pj) * 100) : 0;

  // Calculate teammate stats using player IDs
  const teammateStats = players
    .filter(p => p.id !== player.id)
    .map(teammate => {
      const playerNames = [player.name.toLowerCase(), ...(player.nicknames || []).map(n => n.toLowerCase())];
      const teammateNames = [teammate.name.toLowerCase(), ...(teammate.nicknames || []).map(n => n.toLowerCase())];

      const matchesTogether = matches.filter(m => {
        const teamClaro = (m.teamClaro || []).map(n => n.toLowerCase());
        const teamOscuro = (m.teamOscuro || []).map(n => n.toLowerCase());
        
        const playerInClaro = playerNames.some(name => teamClaro.includes(name));
        const teammateInClaro = teammateNames.some(name => teamClaro.includes(name));
        
        const playerInOscuro = playerNames.some(name => teamOscuro.includes(name));
        const teammateInOscuro = teammateNames.some(name => teamOscuro.includes(name));

        return (playerInClaro && teammateInClaro) || (playerInOscuro && teammateInOscuro);
      });

      const winsTogether = matchesTogether.filter(m => {
        const teamClaro = (m.teamClaro || []).map(n => n.toLowerCase());
        const teamOscuro = (m.teamOscuro || []).map(n => n.toLowerCase());
        
        const playerInClaro = playerNames.some(name => teamClaro.includes(name));
        const isClaroWin = m.result === 'claro' && playerInClaro;
        
        const playerInOscuro = playerNames.some(name => teamOscuro.includes(name));
        const isOscuroWin = m.result === 'oscuro' && playerInOscuro;
        
        return isClaroWin || isOscuroWin;
      }).length;

      return {
        id: teammate.id,
        name: teammate.name,
        photoUrl: teammate.photoUrl,
        pj: matchesTogether.length,
        winRate: matchesTogether.length > 0 ? Math.round((winsTogether / matchesTogether.length) * 100) : 0
      };
    })
    .filter(stat => stat.pj > 0)
    .sort((a, b) => b.pj - a.pj);

  const achievements = calculateAchievements(player, matches, players);
  const streaks = calculateStreaks(player, matches);

  const playerNames = [player.name.toLowerCase(), ...(player.nicknames || []).map(n => n.toLowerCase())];
  const claroGames = matches.filter(m => (m.teamClaro || []).some(n => playerNames.includes(n.toLowerCase()))).length;
  const oscuroGames = matches.filter(m => (m.teamOscuro || []).some(n => playerNames.includes(n.toLowerCase()))).length;
  
  // Teammates display order fix: Winrate before PJ
  const teammateStatsDisplay = teammateStats; 

  const getWinFireIntensity = (streak: number) => {
    if (streak >= 10) return 5;
    if (streak >= 5) return 4;
    if (streak >= 4) return 3;
    if (streak >= 3) return 2;
    if (streak >= 2) return 1;
    return 0;
  };

  const getGoalFireIntensity = (streak: number) => {
    if (streak >= 10) return 5;
    if (streak >= 5) return 4;
    if (streak >= 4) return 3;
    if (streak >= 3) return 2;
    if (streak >= 2) return 1;
    return 0;
  };

  const winIntensity = getWinFireIntensity(streaks.currentWinStreak);
  const goalIntensity = getGoalFireIntensity(streaks.currentGoalStreak);
  const injuryStatus = getInjuryStatus(player.injury);

  const getFireShadow = () => {
    if (winIntensity > 0) return 'fire-border-red';
    if (goalIntensity > 0) return 'fire-border-blue';
    return 'border-white/5 shadow-2xl';
  };

  const getFireClass = () => {
    if (winIntensity > 0) return 'animate-fire';
    if (goalIntensity > 0) return 'animate-fire-blue';
    return '';
  };

  const handleUpdateEmail = async () => {
    if (!player) return;
    try {
      await updatePlayer(player.id, player.name, player.photoUrl, emailValue);
      setIsEditingEmail(false);
      toast.success('Email actualizado correctamente');
    } catch (error) {
      console.error('Error updating email:', error);
      toast.error('Error al actualizar el email');
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <Link to="/jugadores" className="inline-flex items-center gap-2 text-gray-500 hover:text-white font-black uppercase tracking-widest text-[10px] transition-colors">
        <ArrowLeft size={14} /> Volver a Jugadores
      </Link>
      
      <div className={cn(
        "bg-surface rounded-3xl p-8 md:p-12 relative overflow-hidden group transition-all duration-500 border", 
        getFireShadow()
      )}>
        {/* Decorative background elements */}
        {winIntensity > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/20 rounded-full blur-[100px] -mr-32 -mt-32 animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-600/10 rounded-full blur-[100px] -ml-32 -mb-32 animate-pulse delay-700"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(239,68,68,0.05),transparent_70%)]"></div>
          </div>
        )}
        {goalIntensity > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] -mr-32 -mt-32 animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] -ml-32 -mb-32 animate-pulse delay-700"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.05),transparent_70%)]"></div>
          </div>
        )}
        {winIntensity === 0 && goalIntensity === 0 && (
          <>
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-primary/10 transition-colors duration-700"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary/5 rounded-full blur-3xl -ml-24 -mb-24 group-hover:bg-secondary/10 transition-colors duration-700"></div>
          </>
        )}

        <div className="relative flex flex-col md:flex-row gap-10 items-center md:items-start text-center md:text-left">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className={cn(
                "w-40 h-40 rounded-3xl overflow-hidden border-2 transition-all duration-500", 
                winIntensity > 0 ? "border-red-500 animate-fire" : 
                goalIntensity > 0 ? "border-blue-500 animate-fire-blue" : 
                "border-white/10 group-hover:border-primary/50"
              )}>
                <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700" referrerPolicy="no-referrer" />
              </div>
              <div className={cn(
                "absolute -bottom-4 -right-4 w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl border-4 border-surface z-10 transition-colors",
                winIntensity > 0 ? "bg-red-500 text-white" : 
                goalIntensity > 0 ? "bg-blue-500 text-white" : 
                "bg-primary text-background"
              )}>
                {winIntensity > 0 || goalIntensity > 0 ? <Flame size={20} className="animate-pulse" /> : <Trophy size={20} />}
              </div>
            </div>

            {/* Email Section */}
            <div className="flex flex-col items-center gap-2">
              {isEditingEmail ? (
                <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
                  <input
                    type="email"
                    value={emailValue}
                    onChange={(e) => setEmailValue(e.target.value)}
                    placeholder="jugador@ejemplo.com"
                    className="bg-transparent border-none focus:outline-none text-xs text-white w-40 text-center"
                    autoFocus
                  />
                  <button onClick={handleUpdateEmail} className="text-green-500 hover:scale-110 transition-transform">
                    <Check size={16} />
                  </button>
                  <button onClick={() => { setIsEditingEmail(false); setEmailValue(player.email || ''); }} className="text-red-500 hover:scale-110 transition-transform">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="group/email flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Mail size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Email</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white max-w-[200px] truncate">
                      {player.email || 'No registrado'}
                    </span>
                    {isAuthenticated && (
                      <button 
                        onClick={() => setIsEditingEmail(true)}
                        className="opacity-0 group-hover/email:opacity-100 text-primary hover:scale-110 transition-all font-bold"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-8">
            <div className="space-y-4">
              <div className="space-y-1">
                <h1 className="text-5xl font-black tracking-tighter text-white">{player.name}</h1>
                {injuryStatus && (
                  <div className="flex flex-col gap-1 text-red-500 bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20 w-fit mx-auto md:mx-0 mt-2 animate-pulse">
                    <div className="flex items-center gap-2">
                      <Plus size={16} strokeWidth={4} />
                      <span className="text-xs font-black uppercase tracking-widest">{player.injury?.description}</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Tiempo de recuperación: {injuryStatus}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-1 text-accent mt-2">
                  {player.stats.motm > 0 && (
                    <>
                      <Star size={16} fill="currentColor" />
                      <span className="ml-1 text-sm font-black uppercase tracking-widest text-accent">{player.stats.motm} MVP</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                  <Activity size={14} className="text-primary" />
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Puntos: <span className="text-white">{player.stats.points}</span></span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                  <Star size={14} className="text-accent" />
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Win Rate: <span className="text-white">{winRate}%</span></span>
                </div>
              </div>
            </div>
            
            {/* Rachas */}
            {(winIntensity > 0 || goalIntensity > 0) && (
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                {winIntensity > 0 && (
                  <div className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border", winIntensity === 5 ? "bg-red-500/20 border-red-500 text-red-500 animate-pulse" : "bg-red-500/10 border-red-500/30 text-red-400")}>
                    <Flame size={16} className={winIntensity === 5 ? "fill-current" : ""} />
                    <span className="text-xs font-black uppercase tracking-widest">Racha Victorias: {streaks.currentWinStreak}</span>
                  </div>
                )}
                {goalIntensity > 0 && (
                  <div className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border", goalIntensity === 5 ? "bg-blue-500/20 border-blue-500 text-blue-500 animate-pulse" : "bg-blue-500/10 border-blue-500/30 text-blue-400")}>
                    <Flame size={16} className={goalIntensity === 5 ? "fill-current" : ""} />
                    <span className="text-xs font-black uppercase tracking-widest">Racha Goles: {streaks.currentGoalStreak}</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-1 hover:bg-white/[0.08] transition-colors">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Partidos</p>
                <p className="text-3xl font-black text-white">{player.stats.pj}</p>
                <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-widest opacity-50">
                  <span className="text-white">{claroGames} Claro</span>
                  <span className="text-gray-500">/</span>
                  <span className="text-gray-400">{oscuroGames} Oscuro</span>
                </div>
              </div>
              <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-1 hover:bg-white/[0.08] transition-colors">
                <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Victorias</p>
                <p className="text-3xl font-black text-white">{player.stats.pg}</p>
              </div>
              <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-1 hover:bg-white/[0.08] transition-colors">
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Goles</p>
                <p className="text-3xl font-black text-white">{player.stats.goals}</p>
              </div>
              <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-1 hover:bg-white/[0.08] transition-colors">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Derrotas</p>
                <p className="text-3xl font-black text-white">{player.stats.pp}</p>
              </div>
            </div>

            <button 
              onClick={() => setShowTeammates(!showTeammates)}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all"
            >
              <Users size={16} />
              {showTeammates ? 'Ocultar Mejores Compañeros' : 'Ver Mejores Compañeros'}
              {showTeammates ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {showTeammates && (
          <div className="mt-12 pt-12 border-t border-white/5 animate-in slide-in-from-top duration-500">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-gray-500 mb-8 text-center md:text-left">Estadísticas con Compañeros</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teammateStats.length > 0 ? teammateStats.map((stat, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center gap-4 hover:border-primary/30 transition-colors">
                  <img src={stat.photoUrl} alt={stat.name} className="w-12 h-12 rounded-full object-cover border border-white/10" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">{stat.name}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest">{stat.winRate}% WR</span>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{stat.pj} PJ</span>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-gray-500 text-sm italic col-span-full text-center">No hay datos de compañeros aún.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Logros Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-px bg-white/10 flex-1"></div>
          <h2 className="text-sm font-black text-gray-500 uppercase tracking-[0.3em]">Logros</h2>
          <div className="h-px bg-white/10 flex-1"></div>
        </div>

        {['amateur', 'pro', 'leyenda', 'imposible'].map(level => {
          const levelAchievements = achievements.filter(a => a.level === level);
          if (levelAchievements.length === 0) return null;

          const getLevelColor = (l: string) => {
            switch(l) {
              case 'amateur': return 'text-amber-700 border-amber-700/30 bg-amber-700/10';
              case 'pro': return 'text-gray-300 border-gray-300/30 bg-gray-300/10';
              case 'leyenda': return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';
              case 'imposible': return 'text-purple-500 border-purple-500/30 bg-purple-500/10';
              default: return 'text-white border-white/10 bg-white/5';
            }
          };

          const getLevelTitle = (l: string) => {
            switch(l) {
              case 'amateur': return '🟤 NIVEL AMATEUR';
              case 'pro': return '🔵 NIVEL PRO';
              case 'leyenda': return '👑 NIVEL LEYENDA';
              case 'imposible': return '⚫ NIVEL IMPOSIBLE';
              default: return '';
            }
          };

          return (
            <div key={level} className="space-y-4">
              <h3 className={cn("text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg inline-block border", getLevelColor(level))}>
                {getLevelTitle(level)}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {levelAchievements.map(ach => (
                  <div key={ach.id} className={cn("p-4 rounded-xl border transition-all", ach.achieved ? getLevelColor(level) : "bg-surface border-white/5 opacity-50 grayscale")}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-sm">{ach.name}</h4>
                      {ach.achieved && <Trophy size={16} />}
                    </div>
                    <p className="text-xs opacity-80 mb-3">{ach.description}</p>
                    {ach.target && (
                      <div className="space-y-1.5 mt-2">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest opacity-70">
                          <span>Progreso</span>
                          <span>{ach.progress || 0} / {ach.target}</span>
                        </div>
                        <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-current h-1.5 rounded-full" style={{ width: `${Math.min(100, ((ach.progress || 0) / ach.target) * 100)}%` }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlayerProfile;

