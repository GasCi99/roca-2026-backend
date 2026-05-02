import { Match, Player } from '@/services/db';
import { differenceInDays, differenceInWeeks, differenceInMonths, parseISO, isAfter } from 'date-fns';

export const getInjuryStatus = (injury?: Player['injury']) => {
  if (!injury || !injury.isInjured || !injury.expectedRecoveryDate) return null;
  
  const now = new Date();
  const recoveryDate = parseISO(injury.expectedRecoveryDate);
  
  if (!isAfter(recoveryDate, now)) return null;

  const days = differenceInDays(recoveryDate, now);
  const weeks = differenceInWeeks(recoveryDate, now);
  const months = differenceInMonths(recoveryDate, now);

  if (months >= 1) {
    return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  }
  if (weeks >= 1) {
    return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  }
  return `${days + 1} ${days === 0 ? 'día' : 'días'}`;
};

export function calculateStreaks(player: Player, matches: Match[]) {
  const playerName = player.name;
  const nicknames = (player.nicknames || []).map(n => n.toLowerCase());
  const allNames = [playerName.toLowerCase(), ...nicknames];

  const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  let currentWinStreak = 0;
  let currentGoalStreak = 0;
  let maxWinStreak = 0;
  let maxGoalStreak = 0;
  
  for (const match of sortedMatches) {
    const teamClaro = (match.teamClaro || []).map(n => n.toLowerCase());
    const teamOscuro = (match.teamOscuro || []).map(n => n.toLowerCase());
    
    const inClaro = allNames.some(name => teamClaro.includes(name));
    const inOscuro = allNames.some(name => teamOscuro.includes(name));
    const played = inClaro || inOscuro;
    
    if (!played) {
      currentWinStreak = 0;
      currentGoalStreak = 0;
      continue;
    }
    
    const claroWon = (match.claroScore ?? 0) > (match.oscuroScore ?? 0);
    const oscuroWon = (match.oscuroScore ?? 0) > (match.claroScore ?? 0);
    const won = (inClaro && claroWon) || (inOscuro && oscuroWon);
    
    if (won) {
      currentWinStreak++;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else {
      currentWinStreak = 0;
    }
    
    const goalsList = match.goals || {};
    // Sum goals from any of the player's names (primary or nicknames)
    let goalsInMatch = 0;
    allNames.forEach(name => {
      // Find the key in goals that matches (ignoring case)
      Object.entries(goalsList).forEach(([gName, count]) => {
        if (gName.toLowerCase() === name) {
          goalsInMatch += count;
        }
      });
    });

    if (goalsInMatch > 0) {
      currentGoalStreak++;
      if (currentGoalStreak > maxGoalStreak) maxGoalStreak = currentGoalStreak;
    } else {
      currentGoalStreak = 0;
    }
  }
  
  return { currentWinStreak, currentGoalStreak, maxWinStreak, maxGoalStreak };
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  level: 'amateur' | 'pro' | 'leyenda' | 'imposible';
  achieved: boolean;
  progress?: number;
  target?: number;
}

export function calculateAchievements(player: Player, matches: Match[], allPlayers: Player[]): Achievement[] {
  const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  let maxWinStreak = 0;
  let currentWinStreak = 0;
  
  let maxGoalsInMatch = 0;
  
  // Maps teammate ID to win count
  let winsWithPartner: Record<string, number> = {};
  
  let winsWithDigi = 0;

  // Map of lowercase name/nickname to player ID
  const nameToIdMap: Record<string, string> = {};
  allPlayers.forEach(p => {
    nameToIdMap[p.name.toLowerCase()] = p.id;
    if (p.nicknames) {
      p.nicknames.forEach(n => {
        if (n.trim()) nameToIdMap[n.trim().toLowerCase()] = p.id;
      } );
    }
  });

  const playerNameLowercase = player.name.toLowerCase();
  const nicknames = (player.nicknames || []).map(n => n.toLowerCase());
  const playerNames = [playerNameLowercase, ...nicknames];

  const playedWeeks = new Set<string>();
  sortedMatches.forEach(match => {
    const teamClaro = (match.teamClaro || []).map(n => n.toLowerCase());
    const teamOscuro = (match.teamOscuro || []).map(n => n.toLowerCase());
    const playerInClaro = playerNames.some(name => teamClaro.includes(name));
    const playerInOscuro = playerNames.some(name => teamOscuro.includes(name));
    const played = playerInClaro || playerInOscuro;
                   
    if (played) {
      const d = new Date(match.date);
      d.setHours(0,0,0,0);
      d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1)); // Monday
      playedWeeks.add(d.toISOString());
    }
  });
  
  const sortedWeeks = Array.from(playedWeeks).sort();
  let maxWeeks = 0;
  let currWeeks = 0;
  let lastTime = 0;
  for (const w of sortedWeeks) {
    const t = new Date(w).getTime();
    if (lastTime === 0) {
      currWeeks = 1;
    } else {
      const diffDays = Math.round((t - lastTime) / (1000 * 60 * 60 * 24));
      if (diffDays === 7) {
        currWeeks++;
      } else {
        currWeeks = 1;
      }
    }
    if (currWeeks > maxWeeks) maxWeeks = currWeeks;
    lastTime = t;
  }

  // Other stats
  for (const match of sortedMatches) {
    const teamClaro = (match.teamClaro || []).map(n => n.toLowerCase());
    const teamOscuro = (match.teamOscuro || []).map(n => n.toLowerCase());
    
    const inClaro = playerNames.some(name => teamClaro.includes(name));
    const inOscuro = playerNames.some(name => teamOscuro.includes(name));
    const played = inClaro || inOscuro;
    
    if (!played) {
      currentWinStreak = 0;
      continue;
    }
    
    const claroWon = (match.claroScore ?? 0) > (match.oscuroScore ?? 0);
    const oscuroWon = (match.oscuroScore ?? 0) > (match.claroScore ?? 0);
    const won = (inClaro && claroWon) || (inOscuro && oscuroWon);
    
    if (won) {
      currentWinStreak++;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
      
      // Partners
      const teammates = inClaro ? teamClaro : teamOscuro;
      const processedTeammateIds = new Set<string>();

      for (const tm of teammates) {
        const tmId = nameToIdMap[tm.toLowerCase()];
        if (tmId && tmId !== player.id && !processedTeammateIds.has(tmId)) {
          winsWithPartner[tmId] = (winsWithPartner[tmId] || 0) + 1;
          processedTeammateIds.add(tmId);

          // Digi check
          const tmObj = allPlayers.find(p => p.id === tmId);
          if (tmObj && tmObj.name.toLowerCase().includes('digi')) {
            winsWithDigi++;
          }
        }
      }
    } else {
      currentWinStreak = 0;
    }
    
    const goalsList = match.goals || {};
    let matchGoals = 0;
    playerNames.forEach(name => {
      Object.entries(goalsList).forEach(([gName, count]) => {
        if (gName.toLowerCase() === name) {
          matchGoals += count;
        }
      });
    });
    if (matchGoals > maxGoalsInMatch) maxGoalsInMatch = matchGoals;
  }
  
  const maxPartnerWins = Math.max(0, ...Object.values(winsWithPartner));

  return [
    // AMATEUR
    { id: 'a1', name: 'Constante', description: 'Jugar 3 semanas seguidas', level: 'amateur', achieved: maxWeeks >= 3, progress: Math.min(maxWeeks, 3), target: 3 },
    { id: 'a2', name: 'En racha', description: 'Ganar 2 partidos seguidos', level: 'amateur', achieved: maxWinStreak >= 2, progress: Math.min(maxWinStreak, 2), target: 2 },
    { id: 'a3', name: 'Doblete', description: 'Meter 2 goles en un partido', level: 'amateur', achieved: maxGoalsInMatch >= 2, progress: Math.min(maxGoalsInMatch, 2), target: 2 },
    { id: 'a4', name: 'Figura debut', description: 'Primer MVP', level: 'amateur', achieved: player.stats.motm >= 1, progress: Math.min(player.stats.motm, 1), target: 1 },
    { id: 'a5', name: 'Jugador activo', description: 'Jugar 15 partidos', level: 'amateur', achieved: player.stats.pj >= 15, progress: Math.min(player.stats.pj, 15), target: 15 },
    
    // PRO
    { id: 'p1', name: 'Veterano', description: '25 partidos jugados', level: 'pro', achieved: player.stats.pj >= 25, progress: Math.min(player.stats.pj, 25), target: 25 },
    { id: 'p2', name: 'Hat-trick', description: '3 goles en un partido', level: 'pro', achieved: maxGoalsInMatch >= 3, progress: Math.min(maxGoalsInMatch, 3), target: 3 },
    { id: 'p3', name: 'Figura recurrente', description: 'MVP 3 veces', level: 'pro', achieved: player.stats.motm >= 3, progress: Math.min(player.stats.motm, 3), target: 3 },
    { id: 'p4', name: 'Socio clave', description: 'Ganar 8 partidos con el mismo jugador', level: 'pro', achieved: maxPartnerWins >= 8, progress: Math.min(maxPartnerWins, 8), target: 8 },
    { id: 'p5', name: 'Racha firme', description: '3 victorias seguidas', level: 'pro', achieved: maxWinStreak >= 3, progress: Math.min(maxWinStreak, 3), target: 3 },
    { id: 'p6', name: 'Goleador', description: '20 goles totales', level: 'pro', achieved: player.stats.goals >= 20, progress: Math.min(player.stats.goals, 20), target: 20 },
    
    // LEYENDA
    { id: 'l1', name: 'Histórico', description: '45 partidos jugados', level: 'leyenda', achieved: player.stats.pj >= 45, progress: Math.min(player.stats.pj, 45), target: 45 },
    { id: 'l2', name: 'Máquina de goles', description: '50 goles totales', level: 'leyenda', achieved: player.stats.goals >= 50, progress: Math.min(player.stats.goals, 50), target: 50 },
    { id: 'l3', name: 'Ídolo', description: 'MVP 5 veces', level: 'leyenda', achieved: player.stats.motm >= 5, progress: Math.min(player.stats.motm, 5), target: 5 },
    { id: 'l4', name: 'Dúo histórico', description: 'Ganar 20 partidos con el mismo jugador', level: 'leyenda', achieved: maxPartnerWins >= 20, progress: Math.min(maxPartnerWins, 20), target: 20 },
    { id: 'l5', name: 'Inquebrantable', description: 'Jugar 20 semanas seguidas', level: 'leyenda', achieved: maxWeeks >= 20, progress: Math.min(maxWeeks, 20), target: 20 },
    { id: 'l6', name: 'Imparable', description: '5 victorias seguidas', level: 'leyenda', achieved: maxWinStreak >= 5, progress: Math.min(maxWinStreak, 5), target: 5 },
    { id: 'l7', name: 'Goleador de fuego', description: '5 goles en un partido', level: 'leyenda', achieved: maxGoalsInMatch >= 5, progress: Math.min(maxGoalsInMatch, 5), target: 5 },
    
    // IMPOSIBLE
    { id: 'i1', name: 'Carreador', description: 'Ganar 10 partidos con Digi en el equipo', level: 'imposible', achieved: winsWithDigi >= 10, progress: Math.min(winsWithDigi, 10), target: 10 },
  ];
}
