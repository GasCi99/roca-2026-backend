import React, { useState, useEffect, useRef } from 'react';
import { Player, subscribeToPlayers, addPlayer, updatePlayer, Match, subscribeToMatches, PlayerAttributes, syncAllPlayerStats } from '@/services/db';
import { usePassword } from '@/contexts/PasswordContext';
import { toast } from 'sonner';
import { Plus, Camera, Upload, Shield, X, Search, Edit2, Flame, Activity, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { calculateStreaks, getInjuryStatus } from '@/lib/statsUtils';
import { differenceInDays, differenceInWeeks, differenceInMonths, parseISO, isAfter } from 'date-fns';

const PlayersPage = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhoto, setNewPhoto] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newNicknames, setNewNicknames] = useState('');
  const [primaryPosition, setPrimaryPosition] = useState<Player['primaryPosition']>('Mediocampista');
  const [secondaryPosition, setSecondaryPosition] = useState<Player['secondaryPosition']>('Ninguna');
  const [attributes, setAttributes] = useState<PlayerAttributes>({
    defense: 0,
    midfield: 0,
    attack: 0,
    goalkeeper: 0,
    physical: 0
  });
  const [injury, setInjury] = useState({
    isInjured: false,
    description: '',
    expectedRecoveryDate: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { isAuthenticated } = usePassword();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribePlayers = subscribeToPlayers(setPlayers);
    const unsubscribeMatches = subscribeToMatches(setMatches);
    return () => {
      unsubscribePlayers();
      unsubscribeMatches();
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { // 500KB limit for base64 storage
        toast.error('La imagen es muy pesada. Máximo 500KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    if (!editingPlayer && players.some(p => p.name.toLowerCase() === newName.trim().toLowerCase())) {
      toast.error('Ya existe un jugador con ese nombre');
      return;
    }

    setIsSubmitting(true);
    try {
      const photoUrl = newPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${newName}`;
      if (editingPlayer) {
        await updatePlayer(
          editingPlayer.id, 
          newName.trim(), 
          photoUrl, 
          newEmail.trim(), 
          attributes, 
          injury, 
          newNicknames.split(',').map(n => n.trim()).filter(n => n),
          primaryPosition,
          secondaryPosition
        );
        toast.success('Jugador actualizado correctamente');
        setEditingPlayer(null);
        setIsAdding(false);
      } else {
        await addPlayer(
          newName.trim(), 
          photoUrl, 
          newEmail.trim(), 
          attributes, 
          injury, 
          newNicknames.split(',').map(n => n.trim()).filter(n => n),
          primaryPosition,
          secondaryPosition
        );
        toast.success('Jugador agregado correctamente');
      }
      setNewName('');
      setNewPhoto('');
      setNewEmail('');
      setNewNicknames('');
      setPrimaryPosition('Mediocampista');
      setSecondaryPosition('Ninguna');
      setAttributes({
        defense: 0,
        midfield: 0,
        attack: 0,
        goalkeeper: 0,
        physical: 0
      });
      setInjury({
        isInjured: false,
        description: '',
        expectedRecoveryDate: ''
      });
    } catch (err) {
      console.error(err);
      toast.error(editingPlayer ? 'Error al actualizar jugador.' : 'Error al agregar jugador.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncStats = async () => {
    setIsSyncing(true);
    const toastId = toast.loading('Recalculando estadísticas...');
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

  const handleEditClick = (e: React.MouseEvent, player: Player) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingPlayer(player);
    setNewName(player.name);
    setNewPhoto(player.photoUrl);
    setNewEmail(player.email || '');
    setNewNicknames(player.nicknames?.join(', ') || '');
    setPrimaryPosition(player.primaryPosition || 'Mediocampista');
    setSecondaryPosition(player.secondaryPosition || 'Ninguna');
    setAttributes(player.attributes || {
      defense: 0,
      midfield: 0,
      attack: 0,
      goalkeeper: 0,
      physical: 0
    });
    setInjury({
      isInjured: player.injury?.isInjured || false,
      description: player.injury?.description || '',
      expectedRecoveryDate: player.injury?.expectedRecoveryDate || ''
    });
    setIsAdding(true);
  };

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const playersWithPhoto = filteredPlayers.filter(p => !p.photoUrl.includes('api.dicebear.com'));
  const playersWithoutPhoto = filteredPlayers.filter(p => p.photoUrl.includes('api.dicebear.com'));

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

  const renderPlayerCard = (player: Player, isRandom: boolean) => {
    const streaks = calculateStreaks(player, matches);
    const winIntensity = getWinFireIntensity(streaks.currentWinStreak);
    const goalIntensity = getGoalFireIntensity(streaks.currentGoalStreak);

    const getFireShadow = () => {
      if (winIntensity > 0) return 'fire-border-red';
      if (goalIntensity > 0) return 'fire-border-blue';
      return 'border-white/5';
    };

    const getFireClass = () => {
      if (winIntensity > 0) return 'animate-fire';
      if (goalIntensity > 0) return 'animate-fire-blue';
      return '';
    };

    const injuryStatus = getInjuryStatus(player.injury);

    return (
      <Link 
        key={player.id} 
        to={`/jugador/${player.id}`}
        className={cn("group relative bg-surface rounded-2xl p-4 flex flex-col items-center text-center space-y-4 hover:border-primary/30 transition-all duration-500 hover:-translate-y-1 border", getFireShadow())}
      >
        {isAuthenticated && (
          <div className="absolute top-2 right-2 flex gap-2 z-10">
            <button
              onClick={(e) => handleEditClick(e, player)}
              className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Edit2 size={16} />
            </button>
          </div>
        )}
        <div className="relative">
          <img 
            src={player.photoUrl} 
            alt={player.name} 
            className={cn(
              "relative w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-2 transition-all duration-500", 
              isRandom ? "grayscale border-white/5 group-hover:border-gray-500/30" : "border-white/5 group-hover:border-primary/30",
              getFireClass()
            )} 
            referrerPolicy="no-referrer"
          />
          {(winIntensity > 0 || goalIntensity > 0) && (
            <div className={cn(
              "absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-surface z-10",
              winIntensity > 0 ? "bg-red-500 text-white" : "bg-blue-500 text-white"
            )}>
              <Flame size={12} className="animate-pulse" />
            </div>
          )}
        </div>
        {injuryStatus && (
          <div className="absolute top-0 left-0 bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center border-2 border-surface shadow-lg z-10 animate-pulse">
            <Plus size={18} strokeWidth={4} />
          </div>
        )}
        <div className="space-y-1">
          <h3 className={cn("font-bold transition-colors", isRandom ? "text-gray-400 group-hover:text-white" : "text-white group-hover:text-primary")}>{player.name}</h3>
          {injuryStatus && (
            <div className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-tight">
              {player.injury?.description}
              <div className="opacity-70">Tiempo de recuperación: {injuryStatus}</div>
            </div>
          )}
          <div className="flex items-center justify-center gap-2">
            <span className={cn("text-[10px] font-black uppercase tracking-widest", isRandom ? "text-gray-600" : "text-gray-500")}>{player.stats.pj} PJ</span>
            <span className={cn("w-1 h-1 rounded-full", isRandom ? "bg-gray-800" : "bg-gray-700")}></span>
            <span className={cn("text-[10px] font-black uppercase tracking-widest", isRandom ? "text-gray-500" : "text-primary")}>{player.stats.points} PTS</span>
          </div>
          <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
            {player.primaryPosition} {player.secondaryPosition !== 'Ninguna' && `/ ${player.secondaryPosition}`}
          </div>
          {isAuthenticated && player.email && (
            <div className="text-[10px] font-bold text-gray-500 lowercase tracking-tight mt-1 truncate max-w-[150px]">
              {player.email}
            </div>
          )}
          {isAuthenticated && player.attributes && (
            <div className="grid grid-cols-5 gap-1 mt-2 w-full px-2">
              {[
                { key: 'goalkeeper', label: 'ARQ' },
                { key: 'defense', label: 'DEF' },
                { key: 'midfield', label: 'MED' },
                { key: 'attack', label: 'DEL' },
                { key: 'physical', label: 'FIS' }
              ].map((attr) => (
                <div key={attr.key} className="flex flex-col items-center">
                  <span className="text-[8px] text-gray-500 uppercase font-black">{attr.label}</span>
                  <span className="text-[10px] text-white font-bold">{(player.attributes as any)[attr.key]}</span>
                </div>
              ))}
            </div>
          )}
          {(winIntensity > 0 || goalIntensity > 0) && (
            <div className="flex justify-center gap-2 mt-2">
              {winIntensity > 0 && <Flame size={14} className={cn("text-red-500", winIntensity === 5 && "fill-current animate-pulse")} />}
              {goalIntensity > 0 && <Flame size={14} className={cn("text-blue-500", goalIntensity === 5 && "fill-current animate-pulse")} />}
            </div>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tighter text-white">Jugadores</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Plantel ROCA 2026</p>
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <button 
              onClick={handleSyncStats}
              disabled={isSyncing}
              title="Recalcular estadísticas"
              className="bg-white/5 text-gray-400 p-3 rounded-xl hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <RefreshCw size={24} className={cn(isSyncing && "animate-spin")} />
            </button>
          )}
          {!isAdding && isAuthenticated && (
          <button 
            onClick={() => {
              setEditingPlayer(null);
              setNewName('');
              setNewPhoto('');
              setNewEmail('');
              setIsAdding(true);
            }}
            className="bg-primary text-background p-3 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:scale-110 transition-transform"
          >
            <Plus size={24} />
          </button>
        )}
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search size={20} className="text-gray-500" />
        </div>
        <input
          type="text"
          placeholder="Buscar jugador..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-surface border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      {isAdding && isAuthenticated && (
        <div className="bg-surface border border-primary/20 p-8 rounded-2xl shadow-[0_0_40px_rgba(16,185,129,0.05)] animate-in slide-in-from-top duration-500">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">{editingPlayer ? 'Editar Jugador' : 'Nuevo Jugador'}</h2>
            <button onClick={() => {
              setIsAdding(false);
              setEditingPlayer(null);
            }} className="text-gray-500 hover:text-white">
              <X size={24} />
            </button>
          </div>
          
          <form onSubmit={handleAddPlayer} className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div 
                className="relative w-32 h-32 bg-white/5 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {newPhoto ? (
                  <img src={newPhoto} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center space-y-2">
                    <Camera size={24} className="mx-auto text-gray-500 group-hover:text-primary transition-colors" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Subir Foto</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Upload size={20} className="text-white" />
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Formatos: JPG, PNG (Máx 500KB)</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Nombre Completo</label>
              <input 
                type="text" 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-primary/50 transition-colors text-lg font-bold"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Email (Para notificaciones)</label>
              <input 
                type="email" 
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="jugador@ejemplo.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-primary/50 transition-colors text-lg font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Apodos (Separados por coma)</label>
              <input 
                type="text" 
                value={newNicknames}
                onChange={(e) => setNewNicknames(e.target.value)}
                placeholder="Ej: Bocha, Fede, El 10"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-primary/50 transition-colors text-lg font-bold"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Posición Principal</label>
                <select 
                  value={primaryPosition}
                  onChange={(e) => setPrimaryPosition(e.target.value as any)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-primary/50 transition-colors font-bold"
                >
                  <option value="Arquero" className="bg-surface">Arquero</option>
                  <option value="Central" className="bg-surface">Central</option>
                  <option value="Lateral" className="bg-surface">Lateral</option>
                  <option value="Mediocampista" className="bg-surface">Mediocampista</option>
                  <option value="Delantero" className="bg-surface">Delantero</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Posición Secundaria</label>
                <select 
                  value={secondaryPosition}
                  onChange={(e) => setSecondaryPosition(e.target.value as any)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-primary/50 transition-colors font-bold"
                >
                  <option value="Ninguna" className="bg-surface">Ninguna</option>
                  <option value="Arquero" className="bg-surface">Arquero</option>
                  <option value="Central" className="bg-surface">Central</option>
                  <option value="Lateral" className="bg-surface">Lateral</option>
                  <option value="Mediocampista" className="bg-surface">Mediocampista</option>
                  <option value="Delantero" className="bg-surface">Delantero</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { key: 'goalkeeper', label: 'Arquero' },
                { key: 'defense', label: 'Defensa' },
                { key: 'midfield', label: 'Medio' },
                { key: 'attack', label: 'Ataque' },
                { key: 'physical', label: 'Físico' }
              ].map((attr) => (
                <div key={attr.key} className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">{attr.label}</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="10"
                    value={(attributes as any)[attr.key]}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : (parseInt(e.target.value) || 0);
                      setAttributes(prev => ({ ...prev, [attr.key]: val }));
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary/50 text-center font-bold"
                  />
                </div>
              ))}
            </div>

            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", injury.isInjured ? "bg-red-500 animate-pulse" : "bg-green-500")}></div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Estado de Lesión</label>
                </div>
                <button 
                  type="button"
                  onClick={() => setInjury(prev => ({ ...prev, isInjured: !prev.isInjured }))}
                  className={cn(
                    "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                    injury.isInjured ? "bg-red-500 text-white" : "bg-white/10 text-gray-500"
                  )}
                >
                  {injury.isInjured ? 'Lesionado' : 'Sano'}
                </button>
              </div>

              {injury.isInjured && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Descripción de la Lesión</label>
                    <input 
                      type="text" 
                      value={injury.description}
                      onChange={(e) => setInjury(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Ej: Desgarro, Esguince..."
                      className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Fecha Estimada de Alta</label>
                    <input 
                      type="date" 
                      value={injury.expectedRecoveryDate}
                      onChange={(e) => setInjury(prev => ({ ...prev, expectedRecoveryDate: e.target.value }))}
                      className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500/50"
                    />
                  </div>
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-primary text-background py-4 rounded-xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.2)] disabled:opacity-70 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isSubmitting && <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />}
              {isSubmitting ? 'Guardando...' : (editingPlayer ? 'Guardar Cambios' : 'Crear Jugador')}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {playersWithPhoto.map(player => renderPlayerCard(player, false))}
      </div>

      {playersWithoutPhoto.length > 0 && (
        <div className="pt-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-px bg-white/10 flex-1"></div>
            <h2 className="text-sm font-black text-gray-500 uppercase tracking-[0.3em]">Randoms</h2>
            <div className="h-px bg-white/10 flex-1"></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 opacity-70">
            {playersWithoutPhoto.map(player => renderPlayerCard(player, true))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayersPage;

