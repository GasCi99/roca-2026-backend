import React, { useState, useEffect } from 'react';
import { usePassword } from '@/contexts/PasswordContext';
import { toast } from 'sonner';
import { Player, subscribeToPlayers, saveMatch, Match, subscribeToMatches, updateMatch } from '@/services/db';
import { Shield, Clipboard, CheckCircle2, Trophy, Star, ArrowLeft, Users, Save, AlertTriangle, Trash2, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

const LoadMatch = () => {
  const { isAuthenticated, login } = usePassword();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editId = searchParams.get('edit');
  
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const [text, setText] = useState('');
  const [step, setStep] = useState(1); // 1: Paste text, 2: Confirm & Details
  
  const [teamClaro, setTeamClaro] = useState<string[]>([]);
  const [teamOscuro, setTeamOscuro] = useState<string[]>([]);
  
  const [result, setResult] = useState<'claro' | 'oscuro' | 'draw' | null>(null);
  const [motm, setMotm] = useState<string>('');
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [ownGoals, setOwnGoals] = useState<Record<string, number>>({});
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [savedMatchId, setSavedMatchId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToPlayers(setPlayers);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (editId) {
      const unsub = subscribeToMatches((matches) => {
        const match = matches.find(m => m.id === editId);
        if (match) {
          setTeamClaro(match.teamClaro);
          setTeamOscuro(match.teamOscuro);
          setClaroScore(match.claroScore || 0);
          setOscuroScore(match.oscuroScore || 0);
          setResult(match.result);
          setMotm(match.motm || '');
          setGoals(match.goals || {});
          setOwnGoals(match.ownGoals || {});
          setMatchDate(match.date.split('T')[0]);
          setIsManualScore(true);
          setStep(2);
        }
      });
      return () => unsub();
    }
  }, [editId]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) {
      setError('');
    } else {
      setError('Contraseña incorrecta');
    }
  };

  const [claroInput, setClaroInput] = useState('');
  const [oscuroInput, setOscuroInput] = useState('');
  const [suggestions, setSuggestions] = useState<{name: string, score: number}[]>([]);

  const findSimilarPlayers = (input: string) => {
    if (!input.trim()) return [];
    return players
      .map(p => {
        // Simple similarity: check if input is substring or vice versa
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

  const addPlayerToTeam = (team: 'claro' | 'oscuro', playerName: string) => {
    const player = players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
    if (!player) {
      const similar = findSimilarPlayers(playerName);
      if (similar.length > 0) {
        toast.error(`Jugador "${playerName}" no existe. ¿Quisiste poner ${similar[0].name}?`);
      } else {
        toast.error(`Jugador "${playerName}" no existe.`);
      }
      return;
    }

    if (teamClaro.includes(player.name) || teamOscuro.includes(player.name)) {
      toast.error('El jugador ya está en un equipo');
      return;
    }

    if (team === 'claro') setTeamClaro(prev => [...prev, player.name]);
    else setTeamOscuro(prev => [...prev, player.name]);
  };

  const [unresolvedPlayers, setUnresolvedPlayers] = useState<{tempName: string, team: 'claro' | 'oscuro'}[]>([]);
  const [playerMappings, setPlayerMappings] = useState<Record<string, string>>({});

  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [claroScore, setClaroScore] = useState(0);
  const [oscuroScore, setOscuroScore] = useState(0);
  const [isManualScore, setIsManualScore] = useState(false);

  useEffect(() => {
    if (!isManualScore) {
      const cGoals = teamClaro.reduce((sum, p) => sum + (goals[p] || 0), 0);
      const oGoals = teamOscuro.reduce((sum, p) => sum + (goals[p] || 0), 0);
      
      const cOwnGoals = teamClaro.reduce((sum, p) => sum + (ownGoals[p] || 0), 0);
      const oOwnGoals = teamOscuro.reduce((sum, p) => sum + (ownGoals[p] || 0), 0);
      
      // Points for Claro: Claro goals + Oscuro own goals
      setClaroScore(cGoals + oOwnGoals);
      // Points for Oscuro: Oscuro goals + Claro own goals
      setOscuroScore(oGoals + cOwnGoals);
    }
  }, [goals, ownGoals, teamClaro, teamOscuro, isManualScore]);

  useEffect(() => {
    if (claroScore > oscuroScore) setResult('claro');
    else if (oscuroScore > claroScore) setResult('oscuro');
    else if (claroScore === oscuroScore) setResult('draw');
    else setResult(null);
  }, [claroScore, oscuroScore]);

  const parseText = () => {
    if (!text.trim()) {
      toast.error('Pega el texto del partido primero');
      return;
    }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    let currentTeam: 'claro' | 'oscuro' | null = null;
    const claro: string[] = [];
    const oscuro: string[] = [];
    const unresolved: {tempName: string, team: 'claro' | 'oscuro'}[] = [];
    const parsedGoals: Record<string, number> = {};
    const parsedOwnGoals: Record<string, number> = {};

    for (const line of lines) {
      const upperLine = line.toUpperCase();
      if (upperLine.includes('CLARO')) {
        currentTeam = 'claro';
        continue;
      } else if (upperLine.includes('OSCURO')) {
        currentTeam = 'oscuro';
        continue;
      }

      // Match "Name 2" or "Name -1" or "Name"
      const match = line.match(/^(.+?)\s+([\-]?\d+)$/);
      let cleanName = (match ? match[1] : line).replace(/^[\d\.\-\*\s]+/, '').trim();
      const goalCount = match ? parseInt(match[2], 10) : 0;
      
      if (!cleanName) continue;

      // Try exact match first
      let player = players.find(p => 
        p.name.toLowerCase() === cleanName.toLowerCase() || 
        p.nicknames?.some(n => n.toLowerCase() === cleanName.toLowerCase())
      );
      
      // Lenient match
      if (!player) {
        player = players.find(p => 
          p.name.toLowerCase().includes(cleanName.toLowerCase()) || 
          cleanName.toLowerCase().includes(p.name.toLowerCase()) ||
          p.nicknames?.some(n => n.toLowerCase().includes(cleanName.toLowerCase()) || cleanName.toLowerCase().includes(n.toLowerCase()))
        );
      }

      if (player) {
        if (currentTeam === 'claro') {
          if (!claro.includes(player.name)) claro.push(player.name);
          if (goalCount > 0) parsedGoals[player.name] = (parsedGoals[player.name] || 0) + goalCount;
          if (goalCount <= -1) parsedOwnGoals[player.name] = (parsedOwnGoals[player.name] || 0) + Math.abs(goalCount);
        } else if (currentTeam === 'oscuro') {
          if (!oscuro.includes(player.name)) oscuro.push(player.name);
          if (goalCount > 0) parsedGoals[player.name] = (parsedGoals[player.name] || 0) + goalCount;
          if (goalCount <= -1) parsedOwnGoals[player.name] = (parsedOwnGoals[player.name] || 0) + Math.abs(goalCount);
        }
      } else if (currentTeam) {
        unresolved.push({ tempName: cleanName, team: currentTeam });
        if (goalCount > 0) upGoals[cleanName] = (upGoals[cleanName] || 0) + goalCount;
        if (goalCount <= -1) upOwnGoals[cleanName] = (upOwnGoals[cleanName] || 0) + Math.abs(goalCount);
      }
    }

    if (unresolved.length > 0) {
      setUnresolvedPlayers(unresolved);
      setTeamClaro(claro);
      setTeamOscuro(oscuro);
      setGoals(parsedGoals);
      setOwnGoals(parsedOwnGoals);
      setStep(1.5);
      return;
    }

    if (claro.length === 0 && oscuro.length === 0) {
      toast.error('No se detectaron equipos válidos.');
      return;
    }

    setTeamClaro(claro);
    setTeamOscuro(oscuro);
    setGoals(parsedGoals);
    setOwnGoals(parsedOwnGoals);
    setStep(2);
  };

  const [upGoals] = useState<Record<string, number>>({});
  const [upOwnGoals] = useState<Record<string, number>>({});

  const resolvePlayers = () => {
    const newClaro = [...teamClaro];
    const newOscuro = [...teamOscuro];
    const newGoals = { ...goals };
    const newOwnGoals = { ...ownGoals };
    const missingResolutions = unresolvedPlayers.filter(up => !playerMappings[up.tempName]);

    if (missingResolutions.length > 0) {
      toast.error('Por favor, asigna todos los jugadores desconocidos');
      return;
    }

    unresolvedPlayers.forEach(up => {
      const resolvedName = playerMappings[up.tempName];
      if (up.team === 'claro') newClaro.push(resolvedName);
      else newOscuro.push(resolvedName);
      
      if (upGoals[up.tempName]) {
        newGoals[resolvedName] = (newGoals[resolvedName] || 0) + upGoals[up.tempName];
      }
      if (upOwnGoals[up.tempName]) {
        newOwnGoals[resolvedName] = (newOwnGoals[resolvedName] || 0) + upOwnGoals[up.tempName];
      }
    });

    setTeamClaro(newClaro);
    setTeamOscuro(newOscuro);
    setGoals(newGoals);
    setOwnGoals(newOwnGoals);
    setUnresolvedPlayers([]);
    setPlayerMappings({});
    setStep(2);
  };

  const removePlayer = (team: 'claro' | 'oscuro', name: string) => {
    if (team === 'claro') setTeamClaro(prev => prev.filter(p => p !== name));
    else setTeamOscuro(prev => prev.filter(p => p !== name));
  };

  const handleGoalChange = (player: string, change: number) => {
    setGoals(prev => {
      const current = prev[player] || 0;
      const next = Math.max(0, current + change);
      const newGoals = { ...prev };
      if (next === 0) {
        delete newGoals[player];
      } else {
        newGoals[player] = next;
      }
      return newGoals;
    });
  };

  const handleOwnGoalChange = (player: string, change: number) => {
    setOwnGoals(prev => {
      const current = prev[player] || 0;
      const next = Math.max(0, current + change);
      const newOwnGoals = { ...prev };
      if (next === 0) {
        delete newOwnGoals[player];
      } else {
        newOwnGoals[player] = next;
      }
      return newOwnGoals;
    });
  };

  const handleSendEmails = async () => {
    if (!savedMatchId || isSendingEmails) return;
    
    setIsSendingEmails(true);
    const toastId = toast.loading('Enviando correos electrónicos...');
    const rawApiUrl = (import.meta as any).env.VITE_MAIL_API_URL || 'https://roca-mails-v2.onrender.com/api/send-match-emails';
    let apiUrl = rawApiUrl.trim();
    
    if (!apiUrl.includes('/api/send-match-emails')) {
      apiUrl = apiUrl.replace(/\/$/, '') + '/api/send-match-emails';
    }
    
    let timeoutId: string | number | NodeJS.Timeout | undefined;

    try {
      const playersInMatch = [...teamClaro, ...teamOscuro].map(name => {
        const nameLower = name.toLowerCase();
        const p = players.find(player => 
          player.name.toLowerCase() === nameLower || 
          (player.nicknames || []).some(nick => nick.toLowerCase() === nameLower)
        );
        return { name, email: p?.email || '' };
      }).filter(p => !!p.email);

      if (playersInMatch.length === 0) {
        toast.error('No hay jugadores con email registrado.', { id: toastId });
        setIsSendingEmails(false);
        return;
      }
      
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: savedMatchId,
          players: playersInMatch,
          date: new Date(matchDate).toLocaleDateString('es-AR'),
          host: window.location.origin
        }),
        signal: controller.signal
      });

      if (timeoutId) clearTimeout(timeoutId);

      const result = await response.json();
      
      if (response.ok) {
        toast.success(`Correos enviados: ${result.sent} éxito / ${result.failed} error.`, { id: toastId });
      } else {
        toast.error(`Servidor: ${result.error || 'Respuesta inválida'}`, { id: toastId });
      }
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      console.error('Email error details:', error);
      
      let msg = error.message || 'Error desconocido';
      if (error.name === 'AbortError') {
        msg = 'El servidor no respondió a tiempo (posible arranque en frío). Reintentá.';
      } else if (msg.includes('Failed to fetch')) {
        msg = 'Error de conexión. Verificá la URL del servidor de mail.';
      }
      
      toast.error(`Error: ${msg}`, { id: toastId, duration: 6000 });
    } finally {
      setIsSendingEmails(false);
    }
  };

  const handleSaveMatch = async () => {
    if (!result) {
      toast.error('Selecciona el resultado del partido');
      return;
    }
    
    setIsSaving(true);
    try {
      const matchData = {
        teamClaro,
        teamOscuro,
        claroScore,
        oscuroScore,
        result,
        motm,
        goals,
        ownGoals,
        date: new Date(matchDate).toISOString()
      };

      if (editId) {
        await updateMatch(editId, matchData, players);
        toast.success('Partido actualizado con éxito');
        navigate('/historial');
      } else {
        const matchId = await saveMatch(matchData, players);
        if (matchId) setSavedMatchId(matchId);
        toast.success('Partido guardado con éxito');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar el partido. Verifica tu conexión.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-10 space-y-8">
        <div className="bg-surface border border-white/5 p-10 rounded-3xl text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
            <Shield size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tighter text-white">Acceso Restringido</h1>
            <p className="text-gray-500 text-sm">Ingresa la contraseña maestra para cargar resultados</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-primary/50 transition-colors text-center font-bold"
            />
            {error && <p className="text-red-500 text-xs font-bold uppercase tracking-widest">{error}</p>}
            <button type="submit" className="w-full bg-primary text-background py-4 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all active:scale-95">
              Desbloquear
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-10">
      <div className="space-y-1">
        <h1 className="text-3xl font-black tracking-tighter text-white">Cargar Partido</h1>
        <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">
          {step === 1.5 ? 'Resolviendo Jugadores' : `Paso ${Math.floor(step)} de 2`}
        </p>
      </div>

      {step === 1 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-surface border border-white/5 p-8 rounded-3xl space-y-6 shadow-2xl">
            <div className="flex items-center gap-3 text-primary">
              <Clipboard size={20} />
              <h2 className="text-sm font-black uppercase tracking-widest">Opción 1: Pegar Texto de WhatsApp</h2>
            </div>
            <textarea 
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-48 bg-white/5 border border-white/10 rounded-2xl p-6 text-gray-300 focus:outline-none focus:border-primary/50 transition-colors font-mono text-sm"
              placeholder="CLARO&#10;Jugador1 2&#10;Jugador2&#10;...&#10;&#10;OSCURO&#10;Jugador1 1&#10;Jugador2 3&#10;..."
            ></textarea>
            
            <button 
              onClick={parseText}
              className="w-full bg-primary text-background py-4 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all active:scale-95"
            >
              Procesar Texto
            </button>
          </div>

          <div className="bg-surface border border-white/5 p-8 rounded-3xl space-y-8 shadow-2xl">
            <div className="flex items-center gap-3 text-secondary">
              <Users size={20} />
              <h2 className="text-sm font-black uppercase tracking-widest">Opción 2: Selección Manual</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Manual Claro */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Equipo Claro</h3>
                <div className="flex gap-2">
                  <select 
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none"
                    onChange={(e) => {
                      if (e.target.value) {
                        addPlayerToTeam('claro', e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">Agregar jugador...</option>
                    {players.filter(p => !teamClaro.includes(p.name) && !teamOscuro.includes(p.name)).map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {teamClaro.map(p => (
                    <span key={p} className="bg-white/10 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 border border-white/10">
                      {p} <button onClick={() => removePlayer('claro', p)} className="text-red-500 hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Manual Oscuro */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Equipo Oscuro</h3>
                <div className="flex gap-2">
                  <select 
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none"
                    onChange={(e) => {
                      if (e.target.value) {
                        addPlayerToTeam('oscuro', e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">Agregar jugador...</option>
                    {players.filter(p => !teamClaro.includes(p.name) && !teamOscuro.includes(p.name)).map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {teamOscuro.map(p => (
                    <span key={p} className="bg-gray-700 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 border border-white/10">
                      {p} <button onClick={() => removePlayer('oscuro', p)} className="text-red-500 hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                if (teamClaro.length > 0 && teamOscuro.length > 0) setStep(2);
                else toast.error('Agrega al menos un jugador por equipo');
              }}
              className="w-full bg-secondary text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(59,130,246,0.2)] transition-all active:scale-95"
            >
              Continuar con Selección Manual
            </button>
          </div>
        </div>
      )}

      {step === 1.5 && (
        <div className="bg-surface border border-white/5 p-8 rounded-3xl space-y-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3 text-accent">
            <Users size={20} />
            <h2 className="text-sm font-black uppercase tracking-widest">¿Quién es este jugador?</h2>
          </div>
          <p className="text-gray-500 text-xs">Se detectaron nombres que no coinciden con la base de datos. Por favor, asígnalos manualmente.</p>
          
          <div className="space-y-4">
            {unresolvedPlayers.map((up, idx) => {
              const suggestions = findSimilarPlayers(up.tempName);
              const bestSuggestion = suggestions[0];
              const availablePlayers = players.filter(p => 
                !teamClaro.includes(p.name) && 
                !teamOscuro.includes(p.name) &&
                !Object.values(playerMappings).includes(p.name)
              );

              return (
                <div key={idx} className="flex flex-col gap-4 bg-white/5 p-6 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Nombre detectado</p>
                      <p className="text-white font-bold text-lg">
                        {up.tempName} 
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full ml-2", up.team === 'claro' ? "bg-white text-background" : "bg-gray-700 text-white")}>
                          {up.team.toUpperCase()}
                        </span>
                      </p>
                    </div>
                    {bestSuggestion && !playerMappings[up.tempName] && (
                      <button 
                        onClick={() => setPlayerMappings(prev => ({ ...prev, [up.tempName]: bestSuggestion.name }))}
                        className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-primary/20 hover:bg-primary hover:text-background transition-all"
                      >
                        Confirmar: {bestSuggestion.name}
                      </button>
                    )}
                    {playerMappings[up.tempName] && (
                      <div className="flex items-center gap-2 text-green-500 bg-green-500/10 px-4 py-2 rounded-xl border border-green-500/20">
                        <CheckCircle2 size={14} />
                        <span className="text-xs font-black uppercase tracking-widest">{playerMappings[up.tempName]}</span>
                        <button 
                          onClick={() => setPlayerMappings(prev => {
                            const next = { ...prev };
                            delete next[up.tempName];
                            return next;
                          })}
                          className="ml-2 text-gray-500 hover:text-white"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {!playerMappings[up.tempName] && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">O seleccionar de la lista:</p>
                      <select 
                        className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50"
                        value={playerMappings[up.tempName] || ''}
                        onChange={(e) => setPlayerMappings(prev => ({ ...prev, [up.tempName]: e.target.value }))}
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
              onClick={() => {
                setStep(1);
                setUnresolvedPlayers([]);
                setPlayerMappings({});
              }}
              className="flex-1 bg-white/5 text-white py-4 rounded-2xl font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={resolvePlayers}
              className="flex-1 bg-primary text-background py-4 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all active:scale-95"
            >
              Confirmar Asignaciones
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="bg-surface border border-white/5 p-8 rounded-3xl space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div className="flex items-center gap-3 text-primary">
                <Users size={20} />
                <h2 className="text-sm font-black uppercase tracking-widest">Detalles del Partido</h2>
              </div>
              <button 
                onClick={() => setStep(1)}
                className="flex items-center gap-2 text-xs font-black text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
              >
                <ArrowLeft size={14} /> Volver
              </button>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Fecha del Partido</label>
              <input 
                type="date" 
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-primary/50 transition-colors font-bold"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Equipo Claro */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div> CLARO ({teamClaro.length})
                </h3>
                <div className="space-y-2">
                  {teamClaro.map((playerName, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                      <select 
                        className="bg-transparent border-none text-sm font-bold text-white focus:outline-none w-32 appearance-none cursor-pointer"
                        value={playerName}
                        onChange={(e) => {
                          const newTeam = [...teamClaro];
                          newTeam[idx] = e.target.value;
                          setTeamClaro(newTeam);
                          // Transfer goals to the new name if needed
                          if (goals[playerName]) {
                            const newGoals = { ...goals };
                            newGoals[e.target.value] = newGoals[playerName];
                            delete newGoals[playerName];
                            setGoals(newGoals);
                          }
                        }}
                      >
                        <option value={playerName} className="bg-surface">{playerName}</option>
                        {players
                          .filter(p => !teamClaro.includes(p.name) && !teamOscuro.includes(p.name))
                          .map(p => (
                            <option key={p.id} value={p.name} className="bg-surface">{p.name}</option>
                          ))
                        }
                      </select>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center">
                          <span className="text-[7px] font-black uppercase text-gray-500 mb-1">Goles</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleGoalChange(playerName, -1)} className="w-6 h-6 flex items-center justify-center bg-white/5 rounded-lg text-gray-400 hover:bg-white/10 text-xs">-</button>
                            <span className="w-4 text-center font-black text-primary text-sm">{goals[playerName] || 0}</span>
                            <button onClick={() => handleGoalChange(playerName, 1)} className="w-6 h-6 flex items-center justify-center bg-white/5 rounded-lg text-primary hover:bg-white/10 text-xs">+</button>
                          </div>
                        </div>
                        <div className="flex flex-col items-center ml-2">
                          <span className="text-[7px] font-black uppercase text-red-500/50 mb-1">AG</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleOwnGoalChange(playerName, -1)} className="w-6 h-6 flex items-center justify-center bg-red-500/5 rounded-lg text-red-500/30 hover:bg-red-500/10 text-xs">-</button>
                            <span className="w-4 text-center font-black text-red-500/80 text-sm">{ownGoals[playerName] || 0}</span>
                            <button onClick={() => handleOwnGoalChange(playerName, 1)} className="w-6 h-6 flex items-center justify-center bg-red-500/5 rounded-lg text-red-500/80 hover:bg-red-500/10 text-xs">+</button>
                          </div>
                        </div>
                        <button onClick={() => removePlayer('claro', playerName)} className="ml-2 text-red-500/50 hover:text-red-500 transition-colors">×</button>
                      </div>
                    </div>
                  ))}
                </div>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none mt-4 hover:border-primary/50 transition-colors"
                  onChange={(e) => {
                    if (e.target.value) {
                      addPlayerToTeam('claro', e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="" className="bg-surface">Agregar jugador a CLARO...</option>
                  {players.filter(p => !teamClaro.includes(p.name) && !teamOscuro.includes(p.name)).map(p => (
                    <option key={p.id} value={p.name} className="bg-surface">{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Equipo Oscuro */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-700 rounded-full"></div> OSCURO ({teamOscuro.length})
                </h3>
                <div className="space-y-2">
                  {teamOscuro.map((playerName, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                      <select 
                        className="bg-transparent border-none text-sm font-bold text-white focus:outline-none w-32 appearance-none cursor-pointer"
                        value={playerName}
                        onChange={(e) => {
                          const newTeam = [...teamOscuro];
                          newTeam[idx] = e.target.value;
                          setTeamOscuro(newTeam);
                          // Transfer goals to the new name if needed
                          if (goals[playerName]) {
                            const newGoals = { ...goals };
                            newGoals[e.target.value] = newGoals[playerName];
                            delete newGoals[playerName];
                            setGoals(newGoals);
                          }
                        }}
                      >
                        <option value={playerName} className="bg-surface">{playerName}</option>
                        {players
                          .filter(p => !teamClaro.includes(p.name) && !teamOscuro.includes(p.name))
                          .map(p => (
                            <option key={p.id} value={p.name} className="bg-surface">{p.name}</option>
                          ))
                        }
                      </select>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center">
                          <span className="text-[7px] font-black uppercase text-gray-500 mb-1">Goles</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleGoalChange(playerName, -1)} className="w-6 h-6 flex items-center justify-center bg-white/5 rounded-lg text-gray-400 hover:bg-white/10 text-xs">-</button>
                            <span className="w-4 text-center font-black text-secondary text-sm">{goals[playerName] || 0}</span>
                            <button onClick={() => handleGoalChange(playerName, 1)} className="w-6 h-6 flex items-center justify-center bg-white/5 rounded-lg text-secondary hover:bg-white/10 text-xs">+</button>
                          </div>
                        </div>
                        <div className="flex flex-col items-center ml-2">
                          <span className="text-[7px] font-black uppercase text-red-500/50 mb-1">AG</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleOwnGoalChange(playerName, -1)} className="w-6 h-6 flex items-center justify-center bg-red-500/5 rounded-lg text-red-500/30 hover:bg-red-500/10 text-xs">-</button>
                            <span className="w-4 text-center font-black text-red-500/80 text-sm">{ownGoals[playerName] || 0}</span>
                            <button onClick={() => handleOwnGoalChange(playerName, 1)} className="w-6 h-6 flex items-center justify-center bg-red-500/5 rounded-lg text-red-500/80 hover:bg-red-500/10 text-xs">+</button>
                          </div>
                        </div>
                        <button onClick={() => removePlayer('oscuro', playerName)} className="ml-2 text-red-500/50 hover:text-red-500 transition-colors">×</button>
                      </div>
                    </div>
                  ))}
                </div>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none mt-4 hover:border-secondary/50 transition-colors"
                  onChange={(e) => {
                    if (e.target.value) {
                      addPlayerToTeam('oscuro', e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="" className="bg-surface">Agregar jugador a OSCURO...</option>
                  {players.filter(p => !teamClaro.includes(p.name) && !teamOscuro.includes(p.name)).map(p => (
                    <option key={p.id} value={p.name} className="bg-surface">{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-white/5 p-8 rounded-3xl space-y-8 shadow-2xl">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-primary">
                  <Trophy size={20} />
                  <h2 className="text-sm font-black uppercase tracking-widest">Resultado Final</h2>
                </div>
                <button 
                  onClick={() => setIsManualScore(!isManualScore)}
                  className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-colors", 
                    isManualScore ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/10 text-gray-500")}
                >
                  {isManualScore ? 'Manual' : 'Auto'}
                </button>
              </div>

              <div className="flex items-center justify-center gap-8">
                <div className="text-center space-y-2">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Claro</p>
                  <input 
                    type="number" 
                    value={claroScore}
                    onChange={(e) => {
                      setIsManualScore(true);
                      setClaroScore(parseInt(e.target.value, 10) || 0);
                    }}
                    className="w-20 bg-white/5 border border-white/10 rounded-2xl py-4 text-center text-3xl font-black text-white focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div className="text-4xl font-black text-gray-700 mt-6">-</div>
                <div className="text-center space-y-2">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Oscuro</p>
                  <input 
                    type="number" 
                    value={oscuroScore}
                    onChange={(e) => {
                      setIsManualScore(true);
                      setOscuroScore(parseInt(e.target.value, 10) || 0);
                    }}
                    className="w-20 bg-white/5 border border-white/10 rounded-2xl py-4 text-center text-3xl font-black text-white focus:outline-none focus:border-secondary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: 'claro', label: 'Ganó Claro', color: 'bg-white text-background' },
                  { id: 'draw', label: 'Empate', color: 'bg-white/10 text-white' },
                  { id: 'oscuro', label: 'Ganó Oscuro', color: 'bg-gray-700 text-white' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setResult(opt.id as any)}
                    className={cn(
                      "p-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all border-2",
                      result === opt.id ? "border-primary bg-primary/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]" : "border-transparent opacity-50 grayscale"
                    )}
                  >
                    <div className={cn("w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center text-lg", opt.color)}>
                      {opt.id === 'claro' ? '⚪' : opt.id === 'oscuro' ? '⚫' : '🤝'}
                    </div>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 text-accent">
                <Star size={20} fill="currentColor" />
                <h2 className="text-sm font-black uppercase tracking-widest">Figura del Partido</h2>
              </div>
              <select 
                value={motm}
                onChange={(e) => setMotm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-accent/50 transition-colors font-bold appearance-none"
              >
                <option value="" className="bg-surface">Seleccionar jugador...</option>
                <optgroup label="Claro" className="bg-surface">
                  {teamClaro.map(pName => {
                    const p = players.find(player => player.name === pName);
                    return <option key={pName} value={pName}>{pName} ({p?.stats.motm || 0} MVP)</option>;
                  })}
                </optgroup>
                <optgroup label="Oscuro" className="bg-surface">
                  {teamOscuro.map(pName => {
                    const p = players.find(player => player.name === pName);
                    return <option key={pName} value={pName}>{pName} ({p?.stats.motm || 0} MVP)</option>;
                  })}
                </optgroup>
              </select>
            </div>

            <button 
              onClick={handleSaveMatch}
              disabled={isSaving || !!savedMatchId}
              className="w-full bg-primary text-background py-4 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving && <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />}
              {isSaving ? 'Guardando...' : savedMatchId ? 'Partido Guardado' : <><CheckCircle2 size={20} /> Guardar Partido</>}
            </button>

            {savedMatchId && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-primary/10 border border-primary/20 rounded-3xl p-8 space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-primary">
                    <Clipboard size={20} />
                    <h2 className="text-sm font-black uppercase tracking-widest">Links de Votación</h2>
                  </div>
                  <button
                    onClick={handleSendEmails}
                    disabled={isSendingEmails}
                    className="flex items-center gap-2 bg-primary text-background px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    <Mail size={14} />
                    {isSendingEmails ? 'Enviando...' : 'Enviar por Email'}
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {[...teamClaro, ...teamOscuro].map(name => {
                    const p = players.find(player => player.name === name);
                    
                    return (
                      <div key={name} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10">
                            <img src={p?.photoUrl} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <span className="text-xs font-bold text-white">{name}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              const voteUrl = `${window.location.origin}/votar/${savedMatchId}?voter=${encodeURIComponent(name)}`;
                              if (navigator.clipboard && navigator.clipboard.writeText) {
                                navigator.clipboard.writeText(voteUrl)
                                  .then(() => toast.success(`Link de ${name} copiado`))
                                  .catch(err => {
                                    console.error('Error copying to clipboard:', err);
                                    toast.error('No se pudo copiar el link');
                                  });
                              } else {
                                toast.error('Tu navegador no soporta copiar al portapapeles automáticamente');
                              }
                            }}
                            className="flex items-center gap-2 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 px-4 py-2 rounded-xl transition-all"
                            title="Copiar Link de Votación"
                          >
                            <Clipboard size={14} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Copiar Link</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadMatch;

