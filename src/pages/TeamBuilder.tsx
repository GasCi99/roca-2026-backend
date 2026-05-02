import React, { useState, useEffect } from 'react';
import { Player, subscribeToPlayers } from '@/services/db';
import { toast } from 'sonner';
import { Users, Clipboard, ArrowLeft, RefreshCw, Shuffle, UserPlus, Trash2, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePassword } from '@/contexts/PasswordContext';
import { motion } from 'motion/react';

const TeamBuilder = () => {
  const { isAuthenticated } = usePassword();
  const [players, setPlayers] = useState<Player[]>([]);
  const [text, setText] = useState('');
  const [step, setStep] = useState(1); // 1: Input, 1.5: Resolve, 2: Teams
  
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [unresolvedNames, setUnresolvedNames] = useState<string[]>([]);
  const [playerMappings, setPlayerMappings] = useState<Record<string, string>>({});
  
  const [teamA, setTeamA] = useState<Player[]>([]);
  const [teamB, setTeamB] = useState<Player[]>([]);
  const [isModifiedManually, setIsModifiedManually] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToPlayers(setPlayers);
    return () => unsubscribe();
  }, []);

  const findSimilarPlayers = (input: string) => {
    if (!input.trim()) return [];
    return players
      .map(p => {
        const name = p.name.toLowerCase();
        const search = input.toLowerCase();
        let score = 0;
        if (name === search) score = 100;
        else if (name.startsWith(search)) score = 80;
        else if (name.includes(search)) score = 50;
        return { name: p.name, score };
      })
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  };

  const parseText = () => {
    if (!text.trim()) {
      toast.error('Pega la lista de jugadores primero');
      return;
    }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const selected: Player[] = [];
    const unresolved: string[] = [];

    lines.forEach(line => {
      // Remove numbers, dots, dashes, asterisks and spaces at the start
      let cleanName = line.replace(/^[\d\.\-\*\s]+/, '').trim();
      // Also remove common suffixes or prefixes like emojis if possible, but let's keep it simple
      if (!cleanName) return;

      // Try exact match first
      let player = players.find(p => 
        p.name.toLowerCase() === cleanName.toLowerCase() || 
        p.nicknames?.some(n => n.toLowerCase() === cleanName.toLowerCase())
      );
      
      // If no exact match, try lenient match
      if (!player) {
        player = players.find(p => 
          p.name.toLowerCase().includes(cleanName.toLowerCase()) || 
          cleanName.toLowerCase().includes(p.name.toLowerCase()) ||
          p.nicknames?.some(n => n.toLowerCase().includes(cleanName.toLowerCase()) || cleanName.toLowerCase().includes(n.toLowerCase()))
        );
      }

      if (player) {
        if (!selected.find(s => s.id === player.id)) {
          selected.push(player);
        }
      } else {
        unresolved.push(cleanName);
      }
    });

    if (unresolved.length > 0) {
      setUnresolvedNames(unresolved);
      setSelectedPlayers(selected);
      setStep(1.5);
    } else if (selected.length > 0) {
      setSelectedPlayers(selected);
      generateTeams(selected);
      setStep(2);
    } else {
      toast.error('No se detectaron jugadores válidos');
    }
  };

  const resolvePlayers = () => {
    const newSelected = [...selectedPlayers];
    const missing = unresolvedNames.filter(name => !playerMappings[name]);

    if (missing.length > 0) {
      toast.error('Asigna todos los nombres desconocidos');
      return;
    }

    unresolvedNames.forEach(name => {
      const resolvedName = playerMappings[name];
      const player = players.find(p => p.name === resolvedName);
      if (player && !newSelected.find(s => s.id === player.id)) {
        newSelected.push(player);
      }
    });

    setSelectedPlayers(newSelected);
    generateTeams(newSelected);
    setUnresolvedNames([]);
    setPlayerMappings({});
    setStep(2);
  };

  const getPlayerPower = (p: Player) => {
    if (!p.attributes) return 5;
    const { defense, midfield, attack, physical, goalkeeper } = p.attributes;
    // Physical (stamina) is included. Goalkeeper weight increased slightly as requested.
    return (defense + midfield + attack + physical + (goalkeeper * 0.5)) / 4.5;
  };

  const generateTeams = (playerList: Player[]) => {
    // 1. Quotas per team (for 7v7)
    const quotas = {
      Arquero: 1,
      Central: 1,
      Lateral: 2,
      Mediocampista: 2,
      Delantero: 1
    };

    // 2. Separate players by primary position
    const playersByPos: Record<string, Player[]> = {
      Arquero: [],
      Central: [],
      Lateral: [],
      Mediocampista: [],
      Delantero: []
    };

    playerList.forEach(p => {
      const pos = p.primaryPosition || 'Mediocampista';
      if (playersByPos[pos]) playersByPos[pos].push(p);
      else playersByPos['Mediocampista'].push(p);
    });

    // Sort each group by power
    Object.keys(playersByPos).forEach(pos => {
      playersByPos[pos].sort((a, b) => getPlayerPower(b) - getPlayerPower(a));
    });

    const a: Player[] = [];
    const b: Player[] = [];
    let scoreA = 0;
    let scoreB = 0;

    // Helper to add player to a team
    const addToTeam = (p: Player, team: 'A' | 'B') => {
      const power = getPlayerPower(p);
      if (team === 'A') {
        a.push(p);
        scoreA += power;
      } else {
        b.push(p);
        scoreB += power;
      }
    };

    // 3. Distribute Arqueros first (randomize who gets the best)
    const gks = playersByPos['Arquero'];
    if (gks.length >= 2) {
      const bestGkToA = Math.random() > 0.5;
      addToTeam(gks[0], bestGkToA ? 'A' : 'B');
      addToTeam(gks[1], bestGkToA ? 'B' : 'A');
      gks.splice(0, 2);
    } else if (gks.length === 1) {
      addToTeam(gks[0], Math.random() > 0.5 ? 'A' : 'B');
      gks.splice(0, 1);
    }

    // 4. Distribute other positions in order of importance/scarcity
    const posOrder = ['Central', 'Delantero', 'Lateral', 'Mediocampista'];
    
    posOrder.forEach(pos => {
      const group = playersByPos[pos];
      while (group.length >= 2) {
        // Pair them up and give the stronger one to the weaker team
        const p1 = group.shift()!;
        const p2 = group.shift()!;
        if (scoreA <= scoreB) {
          addToTeam(p1, 'A');
          addToTeam(p2, 'B');
        } else {
          addToTeam(p1, 'B');
          addToTeam(p2, 'A');
        }
      }
      if (group.length === 1) {
        addToTeam(group.shift()!, scoreA <= scoreB ? 'A' : 'B');
      }
    });

    // 5. Handle any remaining players (if any were added to Mediocampista by fallback)
    const remaining = Object.values(playersByPos).flat().sort((a, b) => getPlayerPower(b) - getPlayerPower(a));
    remaining.forEach(p => {
      addToTeam(p, scoreA <= scoreB ? 'A' : 'B');
    });

    setTeamA(a);
    setTeamB(b);
    setIsModifiedManually(false);
  };

  const copyTeams = () => {
    const text = `Claro:\n${teamA.map(p => p.name).join('\n')}\n\nOscuro:\n${teamB.map(p => p.name).join('\n')}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => toast.success('Equipos copiados al portapapeles'))
        .catch(err => {
          console.error('Error copying to clipboard:', err);
          toast.error('No se pudo copiar al portapapeles. Intenta manualmente.');
        });
    } else {
      toast.error('Tu navegador no soporta copiar al portapapeles automáticamente');
    }
  };

  const swapPlayers = (player: Player, from: 'A' | 'B') => {
    if (from === 'A') {
      setTeamA(prev => prev.filter(p => p.id !== player.id));
      setTeamB(prev => [...prev, player]);
    } else {
      setTeamB(prev => prev.filter(p => p.id !== player.id));
      setTeamA(prev => [...prev, player]);
    }
    setIsModifiedManually(true);
  };

  const calculateTeamStats = (team: Player[]) => {
    if (team.length === 0) return { avg: 0, defense: 0, midfield: 0, attack: 0, physical: 0, goalkeeper: 0 };
    
    const totals = team.reduce((acc, p) => {
      const attr = p.attributes || { defense: 5, midfield: 5, attack: 5, physical: 5, goalkeeper: 5 };
      return {
        defense: acc.defense + attr.defense,
        midfield: acc.midfield + attr.midfield,
        attack: acc.attack + attr.attack,
        physical: acc.physical + attr.physical,
        goalkeeper: acc.goalkeeper + attr.goalkeeper,
      };
    }, { defense: 0, midfield: 0, attack: 0, physical: 0, goalkeeper: 0 });

    return {
      avg: (totals.defense + totals.midfield + totals.attack) / (team.length * 3),
      defense: totals.defense / team.length,
      midfield: totals.midfield / team.length,
      attack: totals.attack / team.length,
      physical: totals.physical / team.length,
      goalkeeper: totals.goalkeeper / team.length,
    };
  };

  const statsA = calculateTeamStats(teamA);
  const statsB = calculateTeamStats(teamB);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter text-white flex items-center gap-3">
              Armador de Equipos
              <span className="bg-amber-500/10 text-amber-500 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-widest">Beta</span>
            </h1>
            <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Equilibrio perfecto para el ROCA</p>
          </div>
          <Users className="text-primary opacity-20" size={40} />
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-start gap-3">
          <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
          <div className="space-y-1">
            <p className="text-xs font-black text-amber-500 uppercase tracking-widest">Versión Beta en Desarrollo</p>
            <p className="text-[10px] text-amber-500/80 font-medium leading-relaxed">
              Esta sección se encuentra en proceso de mejora constante. El algoritmo de equilibrio y las funcionalidades pueden presentar cambios o errores temporales mientras trabajamos en su optimización.
            </p>
          </div>
        </div>
      </div>

      {step === 1 && (
        <div className="bg-surface border border-white/5 p-8 rounded-3xl space-y-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3 text-primary">
            <Clipboard size={20} />
            <h2 className="text-sm font-black uppercase tracking-widest">Pegar Lista de Jugadores</h2>
          </div>
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-64 bg-white/5 border border-white/10 rounded-2xl p-6 text-gray-300 focus:outline-none focus:border-primary/50 transition-colors font-mono text-sm"
            placeholder="1. Juan Pérez&#10;2. Pedro Gómez&#10;3. ..."
          ></textarea>
          
          <button 
            onClick={parseText}
            className="w-full bg-primary text-background py-4 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Shuffle size={20} /> Armar Equipos
          </button>
        </div>
      )}

      {step === 1.5 && (
        <div className="bg-surface border border-white/5 p-8 rounded-3xl space-y-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3 text-accent">
            <Users size={20} />
            <h2 className="text-sm font-black uppercase tracking-widest">Resolver Jugadores</h2>
          </div>
          
          <div className="space-y-4">
            {unresolvedNames.map((name, idx) => {
              const suggestions = findSimilarPlayers(name);
              const bestSuggestion = suggestions[0];
              const availablePlayers = players.filter(p => 
                !selectedPlayers.find(s => s.id === p.id) && 
                !Object.values(playerMappings).includes(p.name)
              );

              return (
                <div key={idx} className="flex flex-col gap-4 bg-white/5 p-6 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Nombre detectado</p>
                      <p className="text-white font-bold text-lg">{name}</p>
                    </div>
                    {bestSuggestion && !playerMappings[name] && (
                      <button 
                        onClick={() => setPlayerMappings(prev => ({ ...prev, [name]: bestSuggestion.name }))}
                        className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-primary/20 hover:bg-primary hover:text-background transition-all"
                      >
                        Confirmar: {bestSuggestion.name}
                      </button>
                    )}
                    {playerMappings[name] && (
                      <div className="flex items-center gap-2 text-green-500 bg-green-500/10 px-4 py-2 rounded-xl border border-green-500/20">
                        <CheckCircle2 size={14} />
                        <span className="text-xs font-black uppercase tracking-widest">{playerMappings[name]}</span>
                        <button 
                          onClick={() => setPlayerMappings(prev => {
                            const next = { ...prev };
                            delete next[name];
                            return next;
                          })}
                          className="ml-2 text-gray-500 hover:text-white"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {!playerMappings[name] && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">O seleccionar de la lista:</p>
                      <select 
                        className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50"
                        value={playerMappings[name] || ''}
                        onChange={(e) => setPlayerMappings(prev => ({ ...prev, [name]: e.target.value }))}
                      >
                        <option value="">Seleccionar jugador...</option>
                        {availablePlayers.map(p => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              onClick={() => setStep(1)}
              className="flex-1 bg-white/5 text-white py-4 rounded-2xl font-black uppercase tracking-widest border border-white/10"
            >
              Volver
            </button>
            <button 
              onClick={resolvePlayers}
              className="flex-1 bg-primary text-background py-4 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.2)]"
            >
              Confirmar y Armar
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="flex justify-between items-center">
            <button 
              onClick={() => setStep(1)}
              className="flex items-center gap-2 text-xs font-black text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
            >
              <ArrowLeft size={14} /> Nueva Lista
            </button>
            <button 
              onClick={() => generateTeams(selectedPlayers)}
              className="flex items-center gap-2 text-xs font-black text-primary uppercase tracking-widest hover:scale-105 transition-all"
            >
              <RefreshCw size={14} /> Re-Equilibrar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Team A */}
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white text-background px-6 py-4 rounded-2xl shadow-xl">
                <h2 className="font-black uppercase tracking-tighter text-xl">Equipo Claro</h2>
                <span className="text-xs font-black opacity-50">{teamA.length} Jugadores</span>
              </div>
              
              {isAuthenticated && (
                <div className="grid grid-cols-5 gap-1 px-2 py-2 bg-white/5 rounded-xl border border-white/5">
                  <div className="text-center"><p className="text-[8px] text-gray-500 uppercase font-black">DEF</p><p className="text-xs text-white font-bold">{statsA.defense.toFixed(1)}</p></div>
                  <div className="text-center"><p className="text-[8px] text-gray-500 uppercase font-black">MED</p><p className="text-xs text-white font-bold">{statsA.midfield.toFixed(1)}</p></div>
                  <div className="text-center"><p className="text-[8px] text-gray-500 uppercase font-black">DEL</p><p className="text-xs text-white font-bold">{statsA.attack.toFixed(1)}</p></div>
                  <div className="text-center"><p className="text-[8px] text-gray-500 uppercase font-black">FIS</p><p className="text-xs text-white font-bold">{statsA.physical.toFixed(1)}</p></div>
                  <div className="text-center"><p className="text-[8px] text-gray-500 uppercase font-black">ARQ</p><p className="text-xs text-white font-bold">{statsA.goalkeeper.toFixed(1)}</p></div>
                </div>
              )}

              <div className="space-y-2">
                {teamA.map(p => (
                  <div key={p.id} className="group flex items-center justify-between bg-surface border border-white/5 p-3 rounded-2xl hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-3">
                      <img src={p.photoUrl} alt={p.name} className="w-10 h-10 rounded-full object-cover border border-white/10" referrerPolicy="no-referrer" />
                      <div>
                        <p className="text-sm font-bold text-white">{p.name}</p>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{p.primaryPosition}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => swapPlayers(p, 'A')}
                      className="p-2 bg-white/5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                      title="Pasar al otro equipo"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Team B */}
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-gray-700 text-white px-6 py-4 rounded-2xl shadow-xl">
                <h2 className="font-black uppercase tracking-tighter text-xl">Equipo Oscuro</h2>
                <span className="text-xs font-black opacity-50">{teamB.length} Jugadores</span>
              </div>

              {isAuthenticated && (
                <div className="grid grid-cols-5 gap-1 px-2 py-2 bg-white/5 rounded-xl border border-white/5">
                  <div className="text-center"><p className="text-[8px] text-gray-500 uppercase font-black">DEF</p><p className="text-xs text-white font-bold">{statsB.defense.toFixed(1)}</p></div>
                  <div className="text-center"><p className="text-[8px] text-gray-500 uppercase font-black">MED</p><p className="text-xs text-white font-bold">{statsB.midfield.toFixed(1)}</p></div>
                  <div className="text-center"><p className="text-[8px] text-gray-500 uppercase font-black">DEL</p><p className="text-xs text-white font-bold">{statsB.attack.toFixed(1)}</p></div>
                  <div className="text-center"><p className="text-[8px] text-gray-500 uppercase font-black">FIS</p><p className="text-xs text-white font-bold">{statsB.physical.toFixed(1)}</p></div>
                  <div className="text-center"><p className="text-[8px] text-gray-500 uppercase font-black">ARQ</p><p className="text-xs text-white font-bold">{statsB.goalkeeper.toFixed(1)}</p></div>
                </div>
              )}

              <div className="space-y-2">
                {teamB.map(p => (
                  <div key={p.id} className="group flex items-center justify-between bg-surface border border-white/5 p-3 rounded-2xl hover:border-secondary/30 transition-all">
                    <button 
                      onClick={() => swapPlayers(p, 'B')}
                      className="p-2 bg-white/5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                      title="Pasar al otro equipo"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="text-sm font-bold text-white">{p.name}</p>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{p.primaryPosition}</p>
                      </div>
                      <img src={p.photoUrl} alt={p.name} className="w-10 h-10 rounded-full object-cover border border-white/10" referrerPolicy="no-referrer" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {isModifiedManually && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 text-amber-500 bg-amber-500/10 py-3 rounded-2xl border border-amber-500/20"
            >
              <AlertCircle size={16} />
              <p className="text-[10px] font-black uppercase tracking-widest">* Equipos modificados manualmente</p>
            </motion.div>
          )}

          <div className="flex gap-4 pt-4">
            <button 
              onClick={copyTeams}
              className="flex-1 bg-white/5 text-white py-4 rounded-2xl font-black uppercase tracking-widest border border-white/10 flex items-center justify-center gap-2"
            >
              <Copy size={18} /> Copiar Equipos
            </button>
          </div>

          <div className="bg-surface border border-white/5 p-6 rounded-3xl space-y-4">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Análisis de Paridad</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Diferencia de Poder</span>
                <span className={cn("text-xs font-black", Math.abs(statsA.avg - statsB.avg) < 0.5 ? "text-green-500" : "text-amber-500")}>
                  {(Math.abs(statsA.avg - statsB.avg) * 10).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden flex">
                <div className="bg-white h-full transition-all" style={{ width: `${(statsA.avg / (statsA.avg + statsB.avg)) * 100}%` }}></div>
                <div className="bg-gray-700 h-full transition-all" style={{ width: `${(statsB.avg / (statsA.avg + statsB.avg)) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ChevronRight = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
);

const ChevronLeft = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
);

export default TeamBuilder;
