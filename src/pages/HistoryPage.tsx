import React, { useState, useEffect } from 'react';
import { Match, subscribeToMatches, deleteMatch, subscribeToPlayers, Player, subscribeToVotes, closeVotingAndSetMOTM, Vote, syncAllPlayerStats, updateMatch } from '@/services/db';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Trash2, Calendar, Trophy, Star, Edit2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { usePassword } from '@/contexts/PasswordContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const HistoryPage = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [currentVotes, setCurrentVotes] = useState<Vote[]>([]);
  const [showTiePicker, setShowTiePicker] = useState<string[]>([]);
  const { isAuthenticated } = usePassword();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClosingVoting, setIsClosingVoting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ matchId: string, step: 1 | 2 } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribeMatches = subscribeToMatches(setMatches);
    const unsubscribePlayers = subscribeToPlayers(setPlayers);
    return () => {
      unsubscribeMatches();
      unsubscribePlayers();
    };
  }, []);

  useEffect(() => {
    if (selectedMatch) {
      const unsubscribe = subscribeToVotes(selectedMatch.id, setCurrentVotes);
      return () => unsubscribe();
    } else {
      setCurrentVotes([]);
      setShowTiePicker([]);
    }
  }, [selectedMatch]);

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    
    if (showDeleteConfirm.step === 1) {
      setShowDeleteConfirm({ ...showDeleteConfirm, step: 2 });
      return;
    }

    setIsDeleting(true);
    try {
      await deleteMatch(showDeleteConfirm.matchId, players);
      toast.success('Partido eliminado y estadísticas revertidas');
      setSelectedMatch(null);
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar el partido');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (matchId: string) => {
    navigate(`/cargar?edit=${matchId}`);
  };

  const executeCloseVoting = async (winnerName: string) => {
    if (!selectedMatch) return;
    
    setIsClosingVoting(true);
    try {
      await closeVotingAndSetMOTM(selectedMatch.id, winnerName, players);
      toast.success(`Votación cerrada. Ganador: ${winnerName}`);
      setSelectedMatch(prev => prev ? { ...prev, votingClosed: true, motm: winnerName } : null);
      setShowTiePicker([]);
    } catch (error) {
      console.error('Error closing voting:', error);
      toast.error('Error al cerrar la votación');
    } finally {
      setIsClosingVoting(false);
    }
  };

  const handleCloseVoting = async () => {
    if (!selectedMatch) return;
    
    // Calculate winner
    const voteCounts: Record<string, number> = {};
    currentVotes.forEach(v => {
      voteCounts[v.votedFor] = (voteCounts[v.votedFor] || 0) + 1;
    });

    const entries = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
    
    if (entries.length === 0) {
      toast.error('No hay votos registrados');
      return;
    }

    const maxVotes = entries[0][1];
    const winners = entries.filter(e => e[1] === maxVotes).map(e => e[0]);

    if (winners.length > 1) {
      // It's a tie
      setShowTiePicker(winners);
      toast.info('Hay un empate. Selecciona quién fue la figura.');
      return;
    }

    executeCloseVoting(winners[0]).catch(err => {
      console.error('Failed to close voting automatically:', err);
    });
  };

  const handleSyncStats = async () => {
    setIsSyncing(true);
    const toastId = toast.loading('Sincronizando estadísticas...');
    try {
      await syncAllPlayerStats(players);
      toast.success('Estadísticas sincronizadas correctamente', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Error al sincronizar estadísticas', { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tighter text-white">Historial</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Registro de Partidos Jugados</p>
        </div>
        {isAuthenticated && (
          <button 
            onClick={handleSyncStats}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={cn(isSyncing && "animate-spin")} />
            {isSyncing ? 'Sincronizando...' : 'Recalcular Stats'}
          </button>
        )}
      </div>
      
      <div className="space-y-4">
        {matches.length === 0 ? (
          <div className="bg-surface border border-white/5 p-12 rounded-2xl text-center text-gray-500">
            No hay partidos registrados
          </div>
        ) : (
          matches.map(match => (
            <div 
              key={match.id} 
              onClick={() => setSelectedMatch(match)}
              className="group relative bg-surface border border-white/5 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer hover:border-primary/30 transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex flex-col items-center justify-center border border-white/10 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                  <span className="text-xs font-black text-primary">{format(new Date(match.date.split('T')[0] + 'T12:00:00'), "MMM", { locale: es }).toUpperCase()}</span>
                  <span className="text-lg font-black text-white">{format(new Date(match.date.split('T')[0] + 'T12:00:00'), "d")}</span>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    {format(new Date(match.date.split('T')[0] + 'T12:00:00'), "EEEE", { locale: es })}
                  </p>
                  <p className="text-sm font-bold text-gray-300">{format(new Date(match.date.split('T')[0] + 'T12:00:00'), "yyyy")}</p>
                </div>
              </div>
              
              <div className="flex-1 flex justify-center items-center gap-6">
                <div className={cn(
                  "flex-1 text-right font-black text-lg tracking-tighter",
                  match.result === 'claro' ? "text-white" : "text-gray-600"
                )}>
                  CLARO
                </div>
                <div className="bg-white/5 px-6 py-2 rounded-xl border border-white/10 font-black text-2xl min-w-[100px] text-center shadow-inner group-hover:border-primary/30 transition-colors">
                  {match.claroScore ?? (match.result === 'claro' ? 3 : match.result === 'oscuro' ? 1 : 2)} - {match.oscuroScore ?? (match.result === 'oscuro' ? 3 : match.result === 'claro' ? 1 : 2)}
                </div>
                <div className={cn(
                  "flex-1 text-left font-black text-lg tracking-tighter",
                  match.result === 'oscuro' ? "text-white" : "text-gray-600"
                )}>
                  OSCURO
                </div>
              </div>
              
              <div className="flex items-center gap-3 md:w-48 justify-end">
                {match.motm && (
                  <div className="flex items-center gap-2 bg-accent/10 text-accent px-3 py-1.5 rounded-lg border border-accent/20">
                    <Star size={14} fill="currentColor" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{match.motm}</span>
                  </div>
                )}
                {isAuthenticated && (
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(match.id);
                      }}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm({ matchId: match.id, step: 1 });
                      }}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Match Details Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-surface border border-white/10 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
            <div className="sticky top-0 bg-surface/80 backdrop-blur-md border-b border-white/5 p-6 flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Calendar size={20} />
                </div>
                <h2 className="text-xl font-black tracking-tighter">Detalles del Partido</h2>
              </div>
              <div className="flex items-center gap-2">
                {isAuthenticated && (
                  <>
                    <button 
                      onClick={() => handleEdit(selectedMatch.id)}
                      className="p-3 text-primary hover:bg-primary/10 rounded-xl transition-colors"
                      title="Editar partido"
                    >
                      <Edit2 size={20} />
                    </button>
                    <button 
                      onClick={() => setShowDeleteConfirm({ matchId: selectedMatch.id, step: 1 })}
                      disabled={isDeleting}
                      className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl disabled:opacity-50 transition-colors"
                      title="Eliminar partido"
                    >
                      <Trash2 size={20} />
                    </button>
                  </>
                )}
                <button 
                  onClick={() => setSelectedMatch(null)}
                  className="p-3 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-8 space-y-10">
              <div className="text-center space-y-6">
                <p className="text-xs font-black text-gray-500 uppercase tracking-[0.3em]">{format(new Date(selectedMatch.date.split('T')[0] + 'T12:00:00'), "EEEE d 'de' MMMM, yyyy", { locale: es })}</p>
                
                <div className="flex justify-between items-center max-w-md mx-auto w-full">
                  <div className="flex flex-col items-center gap-3">
                    <div className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-xl",
                      selectedMatch.result === 'claro' ? "bg-white text-background" : "bg-white/5 text-gray-600"
                    )}>
                      ⚪
                    </div>
                    <span className="font-black text-sm tracking-widest uppercase">Claro</span>
                  </div>

                  <div className="text-6xl font-black tracking-tighter bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
                    {selectedMatch.claroScore ?? (selectedMatch.result === 'claro' ? 3 : selectedMatch.result === 'oscuro' ? 1 : 2)} - {selectedMatch.oscuroScore ?? (selectedMatch.result === 'oscuro' ? 3 : selectedMatch.result === 'claro' ? 1 : 2)}
                  </div>

                  <div className="flex flex-col items-center gap-3">
                    <div className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-xl",
                      selectedMatch.result === 'oscuro' ? "bg-gray-700 text-white" : "bg-white/5 text-gray-600"
                    )}>
                      ⚫
                    </div>
                    <span className="font-black text-sm tracking-widest uppercase">Oscuro</span>
                  </div>
                </div>
              </div>

              {selectedMatch.motm && (
                <div className="bg-accent/5 border border-accent/20 p-6 rounded-2xl text-center relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Star size={60} className="text-accent" />
                  </div>
                  <div className="relative space-y-1">
                    <p className="text-[10px] font-black text-accent uppercase tracking-[0.3em]">Figura del Partido</p>
                    <p className="text-2xl font-black text-white">{selectedMatch.motm}</p>
                  </div>
                </div>
              )}

              {isAuthenticated && (
                <div className="bg-primary/5 border border-primary/20 p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-primary">
                      <Star size={18} />
                      <h3 className="text-sm font-black uppercase tracking-widest">
                        {selectedMatch.votingClosed ? 'Votos Recibidos' : 'Votación en Curso'}
                      </h3>
                    </div>
                    <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {currentVotes.length} Votos
                    </span>
                  </div>

                  {currentVotes.length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(currentVotes.reduce((acc, v) => {
                        acc[v.votedFor] = (acc[v.votedFor] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>))
                      .sort((a, b) => b[1] - a[1])
                      .map(([name, count]) => (
                        <div key={name} className="flex items-center justify-between bg-white/5 p-2 rounded-lg">
                          <span className="text-xs font-bold">{name}</span>
                          <span className="text-xs font-black text-primary">{count}</span>
                        </div>
                      ))}
                      
                      {showTiePicker.length > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl space-y-3 mt-4">
                          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest text-center">Desempate Requerido</p>
                          <div className="flex flex-col gap-2">
                            {showTiePicker.map(name => (
                              <button
                                key={name}
                                onClick={() => {
                                  executeCloseVoting(name).catch(err => {
                                    console.error('Manual voting close failed:', err);
                                  });
                                }}
                                disabled={isClosingVoting}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-background py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                              >
                                {isClosingVoting ? 'Asignando...' : `Elegir a ${name}`}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {!selectedMatch.votingClosed && showTiePicker.length === 0 && (
                        <button 
                          onClick={handleCloseVoting}
                          disabled={isClosingVoting}
                          className="w-full bg-primary text-background py-3 rounded-xl font-black uppercase tracking-widest text-xs mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isClosingVoting ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={16} />
                          )} 
                          {isClosingVoting ? 'Procesando...' : 'Cerrar Votación y Asignar MVP'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 text-gray-500 gap-2">
                      <AlertCircle size={24} className="opacity-20" />
                      <p className="text-xs font-bold">
                        {selectedMatch.votingClosed ? 'No hubo votos registrados' : 'Esperando los primeros votos...'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Equipo Claro</h3>
                  </div>
                  <ul className="space-y-2">
                    {selectedMatch.teamClaro.map((player, idx) => (
                      <li key={idx} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="font-bold text-sm">{player}</span>
                        <div className="flex gap-2">
                          {(selectedMatch.goals?.[player] || 0) > 0 && (
                            <div className="flex items-center gap-1 bg-primary/20 text-primary px-2 py-1 rounded-lg border border-primary/30">
                              <span className="text-[10px] font-black">⚽ {selectedMatch.goals[player]}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            {(selectedMatch.ownGoals?.[player] || 0) > 0 && (
                              <div className="flex items-center gap-1 bg-red-500/20 text-red-500 px-2 py-1 rounded-lg border border-red-500/30">
                                <span className="text-[10px] font-black">AG {selectedMatch.ownGoals[player]}</span>
                              </div>
                            )}
                            {isAuthenticated && (
                              <button 
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const newOwnGoals = { ...selectedMatch.ownGoals || {} };
                                  newOwnGoals[player] = (newOwnGoals[player] || 0) + 1;
                                  
                                  const newMatch = { ...selectedMatch, ownGoals: newOwnGoals };
                                  // Calculate new scores
                                  const cGoals = newMatch.teamClaro.reduce((sum, p) => sum + (newMatch.goals[p] || 0), 0);
                                  const oGoals = newMatch.teamOscuro.reduce((sum, p) => sum + (newMatch.goals[p] || 0), 0);
                                  const cOwnGoals = newMatch.teamClaro.reduce((sum, p) => sum + (newMatch.ownGoals[p] || 0), 0);
                                  const oOwnGoals = newMatch.teamOscuro.reduce((sum, p) => sum + (newMatch.ownGoals[p] || 0), 0);
                                  
                                  newMatch.claroScore = cGoals + oOwnGoals;
                                  newMatch.oscuroScore = oGoals + cOwnGoals;
                                  
                                  if (newMatch.claroScore > newMatch.oscuroScore) newMatch.result = 'claro';
                                  else if (newMatch.oscuroScore > newMatch.claroScore) newMatch.result = 'oscuro';
                                  else newMatch.result = 'draw';
                                  
                                  try {
                                    const { id, ...data } = newMatch;
                                    await updateMatch(id, data, players);
                                    setSelectedMatch(newMatch);
                                    toast.success('Gol en contra añadido');
                                  } catch (err) {
                                    toast.error('Error al actualizar');
                                  }
                                }}
                                className="w-5 h-5 flex items-center justify-center bg-red-500/10 text-red-500 rounded-md hover:bg-red-500/20 text-[10px] border border-red-500/10"
                                title="Añadir Gol en Contra"
                              >
                                +
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="w-2 h-2 bg-gray-700 rounded-full"></div>
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Equipo Oscuro</h3>
                  </div>
                  <ul className="space-y-2">
                    {selectedMatch.teamOscuro.map((player, idx) => (
                      <li key={idx} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="font-bold text-sm">{player}</span>
                        <div className="flex gap-2">
                          {(selectedMatch.goals?.[player] || 0) > 0 && (
                            <div className="flex items-center gap-1 bg-secondary/20 text-secondary px-2 py-1 rounded-lg border border-secondary/30">
                              <span className="text-[10px] font-black">⚽ {selectedMatch.goals[player]}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            {(selectedMatch.ownGoals?.[player] || 0) > 0 && (
                              <div className="flex items-center gap-1 bg-red-500/20 text-red-500 px-2 py-1 rounded-lg border border-red-500/30">
                                <span className="text-[10px] font-black">AG {selectedMatch.ownGoals[player]}</span>
                              </div>
                            )}
                            {isAuthenticated && (
                              <button 
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const newOwnGoals = { ...selectedMatch.ownGoals || {} };
                                  newOwnGoals[player] = (newOwnGoals[player] || 0) + 1;
                                  
                                  const newMatch = { ...selectedMatch, ownGoals: newOwnGoals };
                                  // Calculate new scores
                                  const cGoals = newMatch.teamClaro.reduce((sum, p) => sum + (newMatch.goals[p] || 0), 0);
                                  const oGoals = newMatch.teamOscuro.reduce((sum, p) => sum + (newMatch.goals[p] || 0), 0);
                                  const cOwnGoals = newMatch.teamClaro.reduce((sum, p) => sum + (newMatch.ownGoals[p] || 0), 0);
                                  const oOwnGoals = newMatch.teamOscuro.reduce((sum, p) => sum + (newMatch.ownGoals[p] || 0), 0);
                                  
                                  newMatch.claroScore = cGoals + oOwnGoals;
                                  newMatch.oscuroScore = oGoals + cOwnGoals;
                                  
                                  if (newMatch.claroScore > newMatch.oscuroScore) newMatch.result = 'claro';
                                  else if (newMatch.oscuroScore > newMatch.claroScore) newMatch.result = 'oscuro';
                                  else newMatch.result = 'draw';
                                  
                                  try {
                                    const { id, ...data } = newMatch;
                                    await updateMatch(id, data, players);
                                    setSelectedMatch(newMatch);
                                    toast.success('Gol en contra añadido');
                                  } catch (err) {
                                    toast.error('Error al actualizar');
                                  }
                                }}
                                className="w-5 h-5 flex items-center justify-center bg-red-500/10 text-red-500 rounded-md hover:bg-red-500/20 text-[10px] border border-red-500/10"
                                title="Añadir Gol en Contra"
                              >
                                +
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-xl flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-surface border border-red-500/20 rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
              <Trash2 size={32} />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-white">
                {showDeleteConfirm.step === 1 ? '¿Eliminar partido?' : '¡ÚLTIMA ADVERTENCIA!'}
              </h3>
              <p className="text-gray-500 text-sm">
                {showDeleteConfirm.step === 1 
                  ? 'Las estadísticas de los jugadores se revertirán automáticamente. Esta acción no se puede deshacer.' 
                  : '¿ESTÁS REALMENTE SEGURO? Se borrarán todos los datos de este partido permanentemente.'}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className={cn(
                  "w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95",
                  showDeleteConfirm.step === 1 ? "bg-red-500 text-white" : "bg-red-600 text-white shadow-[0_0_30px_rgba(220,38,38,0.3)]"
                )}
              >
                {isDeleting ? 'Eliminando...' : showDeleteConfirm.step === 1 ? 'Sí, continuar' : 'SÍ, ELIMINAR AHORA'}
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                disabled={isDeleting}
                className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;

