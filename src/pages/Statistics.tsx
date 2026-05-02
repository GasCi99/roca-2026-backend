import React, { useState, useEffect } from 'react';
import { Player, Match, subscribeToPlayers, subscribeToMatches, recalculateStatistics } from '@/services/db';
import { Link } from 'react-router-dom';
import { Trophy, ArrowUp, ArrowDown, Info, Activity, TrendingUp, Star, Flame, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { calculateStreaks, getInjuryStatus } from '@/lib/statsUtils';

const Statistics = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Player['stats'] | 'winRate', direction: 'asc' | 'desc' }>({
    key: 'points',
    direction: 'desc'
  });

  const handleRecalculate = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const toastId = toast.loading('Recalculando estadísticas...');
    try {
      await recalculateStatistics();
      toast.success('Estadísticas actualizadas correctamente', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Error al recalcular estadísticas. Probablemente falta de permisos.', { id: toastId });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const unsubPlayers = subscribeToPlayers(setPlayers);
    const unsubMatches = subscribeToMatches(setMatches);
    return () => {
      unsubPlayers();
      unsubMatches();
    };
  }, []);

  const matchesCount = matches.length;

  const sortedPlayers = [...players].map(p => ({
    ...p,
    winRate: p.stats.pj > 0 ? (p.stats.pg / p.stats.pj) * 100 : 0
  })).sort((a, b) => {
    const aValue = (a.stats as any)[sortConfig.key] ?? (a as any)[sortConfig.key];
    const bValue = (b.stats as any)[sortConfig.key] ?? (b as any)[sortConfig.key];
    
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const requestSort = (key: any) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  const leaders = {
    pj: [...players].sort((a, b) => b.stats.pj - a.stats.pj)[0],
    points: [...players].sort((a, b) => b.stats.points - a.stats.points)[0],
    goals: [...players].sort((a, b) => b.stats.goals - a.stats.goals)[0],
    winRate: [...players]
      .filter(p => p.stats.pj > (matchesCount * 0.6))
      .sort((a, b) => {
        const aRate = a.stats.pj > 0 ? a.stats.pg / a.stats.pj : 0;
        const bRate = b.stats.pj > 0 ? b.stats.pg / b.stats.pj : 0;
        return bRate - aRate;
      })[0]
  };

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

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-end mb-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tighter text-white">Estadísticas</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Ranking General de Jugadores</p>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl border border-white/5 transition-all text-sm font-bold disabled:opacity-50 mb-1"
        >
          <RefreshCw size={16} className={cn(isRefreshing && "animate-spin")} />
          {isRefreshing ? 'Recalculando...' : 'Recalcular'}
        </button>
      </div>

      {/* Leaders Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Más Partidos', player: leaders.pj, value: leaders.pj?.stats.pj, icon: <Activity size={20} />, color: 'text-blue-500', bg: 'from-blue-500/20' },
          { label: 'Más Puntos', player: leaders.points, value: leaders.points?.stats.points, icon: <Trophy size={20} />, color: 'text-primary', bg: 'from-primary/20' },
          { label: 'Más Goles', player: leaders.goals, value: leaders.goals?.stats.goals, icon: <TrendingUp size={20} />, color: 'text-secondary', bg: 'from-secondary/20' },
          { label: 'Mejor Win Rate', player: leaders.winRate, value: leaders.winRate ? `${Math.round((leaders.winRate.stats.pg / leaders.winRate.stats.pj) * 100)}%` : '-', icon: <Star size={20} />, color: 'text-accent', bg: 'from-accent/20' },
        ].map((item, i) => (
          <Link 
            key={i} 
            to={item.player ? `/jugador/${item.player.id}` : '#'}
            className="bg-surface border border-white/5 rounded-3xl p-8 space-y-6 relative overflow-hidden group transition-all hover:border-white/10 hover:translate-y-[-4px] flex flex-col items-center text-center"
          >
            <div className={cn("absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity", item.color)}>
              {item.icon}
            </div>
            <div className={cn("absolute -bottom-10 -right-10 w-48 h-48 bg-gradient-to-br rounded-full blur-3xl opacity-20", item.bg)} />
            
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">{item.label}</p>
            {item.player ? (
              <div className="space-y-6 pt-2 w-full">
                <div className="relative mx-auto w-32 h-32 md:w-40 md:h-40">
                  <div className={cn("absolute -inset-4 bg-gradient-to-br rounded-full blur-xl opacity-30", item.bg)} />
                  <img src={item.player.photoUrl} alt={item.player.name} className="relative w-full h-full rounded-full object-cover border-4 border-white/10 shadow-2xl" referrerPolicy="no-referrer" />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-black text-white tracking-tight">{item.player.name}</p>
                  <p className={cn("text-3xl font-black drop-shadow-sm", item.color)}>{item.value}</p>
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center">
                <p className="text-xs text-gray-600 italic">Sin datos</p>
              </div>
            )}
          </Link>
        ))}
      </div>

      <div className="bg-surface/30 border border-white/5 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-gray-600">
          <Info size={12} />
          <p className="text-[8px] font-black uppercase tracking-widest italic opacity-60">
            * Win Rate requiere +60% de partidos jugados
          </p>
        </div>
        <div className="flex items-center gap-4 text-[8px] font-black uppercase tracking-widest opacity-40">
          <div className="flex items-center gap-1">
            <span className="text-primary">3 Pts</span>
            <span>Win</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-secondary">2 Pts</span>
            <span>Draw</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400">1 Pt</span>
            <span>Loss</span>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-white/5">
                <th className="px-6 py-4">Jugador</th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('pj')}>
                  <div className="flex items-center gap-1">PJ <SortIcon column="pj" /></div>
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('pg')}>
                  <div className="flex items-center gap-1">PG <SortIcon column="pg" /></div>
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('pe')}>
                  <div className="flex items-center gap-1">PE <SortIcon column="pe" /></div>
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('pp')}>
                  <div className="flex items-center gap-1">PP <SortIcon column="pp" /></div>
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('goals')}>
                  <div className="flex items-center gap-1">Goles <SortIcon column="goals" /></div>
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('winRate')}>
                  <div className="flex items-center gap-1">% Win <SortIcon column="winRate" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors text-primary" onClick={() => requestSort('points')}>
                  <div className="flex items-center gap-1">Pts <SortIcon column="points" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedPlayers.map((player, index) => {
                const streaks = calculateStreaks(player, matches);
                const winIntensity = getWinFireIntensity(streaks.currentWinStreak);
                const goalIntensity = getGoalFireIntensity(streaks.currentGoalStreak);
                const injuryStatus = getInjuryStatus(player.injury);
                
                return (
                  <tr key={player.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <Link to={`/jugador/${player.id}`} className="flex items-center gap-3">
                        <div className="relative">
                          <img 
                            src={player.photoUrl} 
                            alt={player.name} 
                            className={cn(
                              "w-10 h-10 rounded-full object-cover border transition-colors", 
                              winIntensity > 0 ? "fire-border-red" : goalIntensity > 0 ? "fire-border-blue" : "border-white/10 group-hover:border-primary/50"
                            )} 
                            referrerPolicy="no-referrer" 
                          />
                          {injuryStatus && (
                            <div className="absolute -top-1 -left-1 bg-red-600 text-white w-4 h-4 rounded-full flex items-center justify-center border border-background shadow-lg z-10 animate-pulse">
                              <Plus size={10} strokeWidth={4} />
                            </div>
                          )}
                          {index < 3 && (
                            <div className={cn(
                              "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border border-background",
                              index === 0 ? "bg-yellow-500 text-background" : 
                              index === 1 ? "bg-gray-300 text-background" : 
                              "bg-amber-600 text-background"
                            )}>
                              {index + 1}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-white group-hover:text-primary transition-colors flex items-center gap-2">
                            {player.name}
                            <div className="flex items-center gap-1">
                              {winIntensity > 0 && <Flame size={14} className={cn("text-red-500", winIntensity > 0 && "fill-current animate-fire")} />}
                              {goalIntensity > 0 && <Flame size={14} className={cn("text-blue-500", goalIntensity > 0 && "fill-current animate-fire-blue")} />}
                            </div>
                          </span>
                          {injuryStatus && (
                            <span className="text-[8px] font-black text-red-500/80 uppercase tracking-tighter leading-none">
                              {player.injury?.description} • {injuryStatus}
                            </span>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-400">{player.stats.pj}</td>
                    <td className="px-4 py-4 text-sm font-medium text-green-500/80">{player.stats.pg}</td>
                    <td className="px-4 py-4 text-sm font-medium text-blue-500/80">{player.stats.pe}</td>
                    <td className="px-4 py-4 text-sm font-medium text-red-500/80">{player.stats.pp}</td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-300">{player.stats.goals}</td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-400">{Math.round(player.winRate)}%</td>
                    <td className="px-6 py-4 text-lg font-black text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">{player.stats.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-surface border border-white/5 rounded-2xl p-8 space-y-8 shadow-2xl">
        <div className="flex items-center gap-3 text-primary">
          <Trophy size={20} />
          <h2 className="text-sm font-black uppercase tracking-widest text-white">Historial de Equipos</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Victorias</p>
                <h3 className="text-4xl font-black text-white">Claro vs Oscuro</h3>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Partidos</p>
                <p className="text-2xl font-black text-primary">{matches.length}</p>
              </div>
            </div>

            <div className="relative h-12 bg-white/5 rounded-2xl overflow-hidden flex border border-white/10">
              <div 
                className="h-full bg-white transition-all duration-1000 flex items-center justify-center text-background font-black text-xs"
                style={{ width: `${matches.length > 0 ? (matches.filter(m => m.result === 'claro').length / matches.length) * 100 : 50}%` }}
              >
                {matches.filter(m => m.result === 'claro').length}
              </div>
              <div 
                className="h-full bg-white/10 transition-all duration-1000 flex items-center justify-center text-gray-400 font-black text-xs"
                style={{ width: `${matches.length > 0 ? (matches.filter(m => m.result === 'draw').length / matches.length) * 100 : 0}%` }}
              >
                {matches.filter(m => m.result === 'draw').length}
              </div>
              <div 
                className="h-full bg-gray-700 transition-all duration-1000 flex items-center justify-center text-white font-black text-xs"
                style={{ width: `${matches.length > 0 ? (matches.filter(m => m.result === 'oscuro').length / matches.length) * 100 : 50}%` }}
              >
                {matches.filter(m => m.result === 'oscuro').length}
              </div>
            </div>

            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
              <div className="flex items-center gap-2 text-white">
                <div className="w-2 h-2 bg-white rounded-full"></div> Claro
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <div className="w-2 h-2 bg-white/20 rounded-full"></div> Empates
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-2 h-2 bg-gray-700 rounded-full"></div> Oscuro
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 text-center space-y-2">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Dominio Claro</p>
              <p className="text-3xl font-black text-white">
                {matches.length > 0 ? Math.round((matches.filter(m => m.result === 'claro').length / matches.length) * 100) : 0}%
              </p>
            </div>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 text-center space-y-2">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Dominio Oscuro</p>
              <p className="text-3xl font-black text-gray-400">
                {matches.length > 0 ? Math.round((matches.filter(m => m.result === 'oscuro').length / matches.length) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;

