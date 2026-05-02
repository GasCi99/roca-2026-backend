import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Trophy, Star, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { Match, Player, subscribeToMatches, subscribeToPlayers, voteForMOTM, subscribeToVotes } from '@/services/db';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

const VotePage = () => {
  const { matchId } = useParams();
  const [searchParams] = useSearchParams();
  const voterNameParam = searchParams.get('voter');

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [votes, setVotes] = useState<{voterName: string, votedFor: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVoter, setSelectedVoter] = useState(voterNameParam || '');
  const [selectedMOTM, setSelectedMOTM] = useState('');
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    if (!matchId) return;

    const unsubMatches = subscribeToMatches((allMatches) => {
      const found = allMatches.find(m => m.id === matchId);
      setMatch(found || null);
      setLoading(false);
    });

    const unsubPlayers = subscribeToPlayers(setPlayers);
    const unsubVotes = subscribeToVotes(matchId, setVotes);

    return () => {
      unsubMatches();
      unsubPlayers();
      unsubVotes();
    };
  }, [matchId]);

  useEffect(() => {
    if (players.length > 0 && voterNameParam && !selectedVoter) {
      // Find case-insensitive match
      const p = players.find(player => player.name.toLowerCase() === voterNameParam.toLowerCase());
      if (p) setSelectedVoter(p.name);
    }
  }, [players, voterNameParam, selectedVoter]);

  useEffect(() => {
    if (selectedVoter && votes.some(v => v.voterName === selectedVoter)) {
      setHasVoted(true);
    } else {
      setHasVoted(false);
    }
  }, [selectedVoter, votes]);

  const handleVote = async () => {
    if (!matchId || !selectedVoter || !selectedMOTM) {
      toast.error('Por favor selecciona tu nombre y a quién votas');
      return;
    }

    try {
      await voteForMOTM(matchId, selectedVoter, selectedMOTM);
      setHasVoted(true);
      toast.success('¡Voto registrado correctamente!');
    } catch (error: any) {
      console.error('Error voting:', error);
      toast.error(`Error: ${error.message || 'No se pudo registrar el voto'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="text-gray-500 font-black uppercase tracking-widest text-xs">Cargando votación...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center py-20 space-y-6">
        <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto text-red-500">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-black tracking-tighter text-white">Partido no encontrado</h2>
      </div>
    );
  }

  if (match.votingClosed) {
    return (
      <div className="text-center py-20 space-y-6">
        <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto text-amber-500">
          <Trophy size={40} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tighter text-white">Votación Cerrada</h2>
          <p className="text-gray-500">La figura del partido ya fue elegida: <span className="text-primary font-bold">{match.motm}</span></p>
        </div>
      </div>
    );
  }

  const matchPlayers = [...match.teamClaro, ...match.teamOscuro].sort();

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-black tracking-tighter text-white uppercase">Votación MVP</h1>
        <p className="text-gray-500 font-medium">Partido del {new Date(match.date).toLocaleDateString('es-AR')}</p>
        
        <div className="grid grid-cols-3 items-center gap-4 mt-6 max-w-lg mx-auto">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-xl shadow-xl">⚪</div>
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Claro</span>
            <span className="text-2xl font-black text-white">{match.claroScore}</span>
          </div>
          <div className="text-xs font-black text-gray-700 uppercase tracking-widest">VS</div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-gray-700 rounded-2xl flex items-center justify-center text-xl shadow-xl">⚫</div>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Oscuro</span>
            <span className="text-2xl font-black text-white">{match.oscuroScore}</span>
          </div>
        </div>

        {/* Teams Overview */}
        <div className="grid grid-cols-2 gap-4 mt-8">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2">
            <h3 className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] text-center mb-2">Plantel Claro</h3>
            <div className="flex flex-wrap justify-center gap-1">
              {match.teamClaro.map(name => (
                <span key={name} className="text-[9px] font-bold text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">{name}</span>
              ))}
            </div>
          </div>
          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2">
            <h3 className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] text-center mb-2">Plantel Oscuro</h3>
            <div className="flex flex-wrap justify-center gap-1">
              {match.teamOscuro.map(name => (
                <span key={name} className="text-[9px] font-bold text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">{name}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-white/5 rounded-3xl p-8 space-y-8 shadow-2xl">
        {/* Paso 1: Quién vota */}
        <div className="space-y-4">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">1. ¿Quién sos?</label>
          <select 
            value={selectedVoter}
            onChange={(e) => setSelectedVoter(e.target.value)}
            disabled={!!voterNameParam}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 appearance-none cursor-pointer disabled:opacity-50"
          >
            <option value="" className="bg-surface">Selecciona tu nombre</option>
            {matchPlayers.map(name => (
              <option key={name} value={name} className="bg-surface">{name}</option>
            ))}
          </select>
        </div>

        {hasVoted ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-500/10 border border-green-500/20 rounded-2xl p-8 text-center space-y-4"
          >
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto text-background shadow-lg shadow-green-500/20">
              <Check size={32} strokeWidth={3} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">¡Gracias por votar!</h3>
              <p className="text-gray-400 text-sm">Tu voto ya fue registrado. Los resultados se verán pronto.</p>
            </div>
          </motion.div>
        ) : (
          <AnimatePresence>
            {selectedVoter && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-6 overflow-hidden"
              >
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">2. ¿Quién fue la figura?</label>
                  <div className="grid grid-cols-2 gap-3">
                    {matchPlayers
                      .filter(name => name !== selectedVoter)
                      .map(name => {
                        const p = players.find(player => player.name === name);
                        return (
                          <button
                            key={name}
                            onClick={() => setSelectedMOTM(name)}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                              selectedMOTM === name 
                                ? "bg-primary/20 border-primary text-white" 
                                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                            )}
                          >
                            <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
                              <img src={p?.photoUrl || 'https://picsum.photos/seed/player/100/100'} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs font-bold truncate">{name}</span>
                              {(match.goals?.[name] || 0) > 0 && (
                                <span className="text-[9px] font-black text-primary">⚽ {match.goals[name]} {match.goals[name] === 1 ? 'gol' : 'goles'}</span>
                              )}
                            </div>
                            {selectedMOTM === name && <Star size={14} className="ml-auto text-primary fill-current flex-shrink-0" />}
                          </button>
                        );
                      })}
                  </div>
                </div>

                <button
                  onClick={handleVote}
                  disabled={!selectedMOTM}
                  className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary text-background font-black uppercase tracking-widest py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  Confirmar Voto
                  <ArrowRight size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default VotePage;
