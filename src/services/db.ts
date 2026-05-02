import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, Timestamp, increment, writeBatch, getDocFromServer } from 'firebase/firestore';
import { db, auth } from '@/firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, shouldThrow: boolean = true) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (shouldThrow) {
    throw new Error(JSON.stringify(errInfo));
  }
}

export interface PlayerAttributes {
  defense: number;
  midfield: number;
  attack: number;
  goalkeeper: number;
  physical: number;
}

export interface Player {
  id: string;
  name: string;
  photoUrl: string;
  email?: string;
  nicknames?: string[];
  primaryPosition?: 'Arquero' | 'Central' | 'Lateral' | 'Mediocampista' | 'Delantero';
  secondaryPosition?: 'Arquero' | 'Central' | 'Lateral' | 'Mediocampista' | 'Delantero' | 'Ninguna';
  attributes?: PlayerAttributes;
  injury?: {
    isInjured: boolean;
    description?: string;
    expectedRecoveryDate?: string; // ISO string
  };
  stats: {
    pj: number;
    pg: number;
    pp: number;
    pe: number;
    points: number;
    goals: number;
    motm: number;
  };
}

export interface Match {
  id: string;
  date: string;
  teamClaro: string[];
  teamOscuro: string[];
  claroScore: number;
  oscuroScore: number;
  result: 'claro' | 'oscuro' | 'draw';
  motm: string;
  goals: Record<string, number>;
  ownGoals?: Record<string, number>;
  votingClosed?: boolean;
}

export interface Vote {
  voterName: string;
  votedFor: string;
}

export interface DigiBirdScore {
  name: string;
  score: number;
  timestamp: Timestamp;
}

// Subscribe to players
export const subscribeToPlayers = (callback: (players: Player[]) => void) => {
  const path = 'players';
  const q = query(collection(db, path), orderBy('name'));
  return onSnapshot(q, (snapshot) => {
    try {
      const players: Player[] = [];
      snapshot.forEach((doc) => {
        players.push({ id: doc.id, ...doc.data() } as Player);
      });
      callback(players);
    } catch (err) {
      console.error('Error in subscribeToPlayers callback:', err);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path, false);
    callback([]);
  });
};

// Subscribe to matches
export const subscribeToMatches = (callback: (matches: Match[]) => void) => {
  const path = 'matches';
  const q = query(collection(db, path), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot) => {
    try {
      const matches: Match[] = [];
      snapshot.forEach((doc) => {
        matches.push({ id: doc.id, ...doc.data() } as Match);
      });
      callback(matches);
    } catch (err) {
      console.error('Error in subscribeToMatches callback:', err);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path, false);
    callback([]);
  });
};

// Revert stats for a match
const revertStats = async (batch: any, match: Match, players: Player[]) => {
  const getPlayerId = (name: string) => {
    const p = players.find(p => p.name.toLowerCase() === name.toLowerCase());
    return p ? p.id : null;
  };

  const updatePlayer = (playerName: string, isWin: boolean, isDraw: boolean, isLoss: boolean) => {
    const pid = getPlayerId(playerName);
    if (!pid) return;
    const playerRef = doc(db, 'players', pid);
    const playerGoals = match.goals[playerName] || 0;
    const isMotm = match.motm === playerName;
    
    batch.update(playerRef, {
      'stats.pj': increment(-1),
      'stats.pg': increment(isWin ? -1 : 0),
      'stats.pe': increment(isDraw ? -1 : 0),
      'stats.pp': increment(isLoss ? -1 : 0),
      'stats.points': increment(isWin ? -3 : isDraw ? -2 : -1),
      'stats.goals': increment(-playerGoals),
      'stats.motm': increment(isMotm ? -1 : 0)
    });
  };

  match.teamClaro.forEach(p => updatePlayer(p, match.result === 'claro', match.result === 'draw', match.result === 'oscuro'));
  match.teamOscuro.forEach(p => updatePlayer(p, match.result === 'oscuro', match.result === 'draw', match.result === 'claro'));
};

// Apply stats for a match
const applyStats = async (batch: any, matchData: Omit<Match, 'id'>, players: Player[]) => {
  const getPlayerId = (name: string) => {
    const p = players.find(p => p.name.toLowerCase() === name.toLowerCase());
    return p ? p.id : null;
  };

  const updatePlayer = (playerName: string, isWin: boolean, isDraw: boolean, isLoss: boolean) => {
    const pid = getPlayerId(playerName);
    if (!pid) return;
    const playerRef = doc(db, 'players', pid);
    const playerGoals = matchData.goals[playerName] || 0;
    const isMotm = matchData.motm === playerName;
    
    batch.update(playerRef, {
      'stats.pj': increment(1),
      'stats.pg': increment(isWin ? 1 : 0),
      'stats.pe': increment(isDraw ? 1 : 0),
      'stats.pp': increment(isLoss ? 1 : 0),
      'stats.points': increment(isWin ? 3 : isDraw ? 2 : 1),
      'stats.goals': increment(playerGoals),
      'stats.motm': increment(isMotm ? 1 : 0)
    });
  };

  matchData.teamClaro.forEach(p => updatePlayer(p, matchData.result === 'claro', matchData.result === 'draw', matchData.result === 'oscuro'));
  matchData.teamOscuro.forEach(p => updatePlayer(p, matchData.result === 'oscuro', matchData.result === 'draw', matchData.result === 'claro'));
};

export const deleteMatch = async (matchId: string, players?: Player[]) => {
  const path = `matches/${matchId}`;
  try {
    const batch = writeBatch(db);
    
    // If players are provided, try to revert stats
    if (players) {
      const matchDoc = await getDoc(doc(db, 'matches', matchId));
      const match = matchDoc.data() as Match;
      if (match) {
        await revertStats(batch, { ...match, id: matchId }, players);
      }
    }

    batch.delete(doc(db, 'matches', matchId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

// Add a new player
export const addPlayer = async (
  name: string, 
  photoUrl: string, 
  email?: string, 
  attributes?: PlayerAttributes, 
  injury?: Player['injury'],
  nicknames?: string[],
  primaryPosition?: Player['primaryPosition'],
  secondaryPosition?: Player['secondaryPosition']
) => {
  const path = 'players';
  try {
    const newPlayerRef = doc(collection(db, path));
    await setDoc(newPlayerRef, {
      name,
      photoUrl,
      email: email || '',
      nicknames: nicknames || [],
      primaryPosition: primaryPosition || 'Mediocampista',
      secondaryPosition: secondaryPosition || 'Ninguna',
      attributes: attributes || {
        defense: 0,
        midfield: 0,
        attack: 0,
        goalkeeper: 0,
        physical: 0
      },
      injury: injury || {
        isInjured: false,
        description: '',
        recoveryTime: ''
      },
      stats: {
        pj: 0,
        pg: 0,
        pp: 0,
        pe: 0,
        points: 0,
        goals: 0,
        motm: 0
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// Update a player
export const updatePlayer = async (
  playerId: string, 
  name: string, 
  photoUrl: string, 
  email?: string, 
  attributes?: PlayerAttributes, 
  injury?: Player['injury'], 
  nicknames?: string[],
  primaryPosition?: Player['primaryPosition'],
  secondaryPosition?: Player['secondaryPosition']
) => {
  const path = `players/${playerId}`;
  try {
    const playerRef = doc(db, 'players', playerId);
    
    // Get old player data to check for name change
    const playerSnap = await getDoc(playerRef);
    if (!playerSnap.exists()) throw new Error('Player not found');
    const oldData = playerSnap.data() as Player;
    const oldName = oldData.name;
    
    const batch = writeBatch(db);
    const updateData: any = {
      name,
      photoUrl
    };
    
    if (email !== undefined) updateData.email = email;
    if (nicknames !== undefined) updateData.nicknames = nicknames;
    if (primaryPosition !== undefined) updateData.primaryPosition = primaryPosition;
    if (secondaryPosition !== undefined) updateData.secondaryPosition = secondaryPosition;
    if (attributes !== undefined) updateData.attributes = attributes;
    if (injury !== undefined) updateData.injury = injury;
    
    batch.update(playerRef, updateData);

    // If name changed, update all instances in matches to maintain consistency
    if (oldName && oldName !== name) {
      const matchesSnap = await getDocs(collection(db, 'matches'));
      matchesSnap.forEach((matchDoc) => {
        const match = matchDoc.data() as Match;
        let changed = false;
        
        const teamClaro = match.teamClaro.map(n => {
          if (n === oldName) { changed = true; return name; }
          return n;
        });
        
        const teamOscuro = match.teamOscuro.map(n => {
          if (n === oldName) { changed = true; return name; }
          return n;
        });
        
        let motm = match.motm;
        if (motm === oldName) { 
          motm = name;
          changed = true;
        }
        
        const goals = { ...match.goals };
        if (goals[oldName] !== undefined) {
          goals[name] = goals[oldName];
          delete goals[oldName];
          changed = true;
        }

        const ownGoals = { ...(match.ownGoals || {}) };
        if (ownGoals[oldName] !== undefined) {
          ownGoals[name] = ownGoals[oldName];
          delete ownGoals[oldName];
          changed = true;
        }
        
        if (changed) {
          batch.update(matchDoc.ref, { teamClaro, teamOscuro, motm, goals, ownGoals });
        }
      });

      // Also update future votes if there's an active match
      // Note: We're not updating historical votes subcollections here as they are less critical for stats
      // but the main match record is now consistent.
    }
    
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

// Sync all player stats by recalculating from scratch based on match history
export const syncAllPlayerStats = async (players: Player[]) => {
  try {
    const matchesSnap = await getDocs(collection(db, 'matches'));
    const matches: Match[] = [];
    matchesSnap.forEach(doc => {
      matches.push({ id: doc.id, ...doc.data() } as Match);
    });

    const batch = writeBatch(db);
    
    // Calculate stats locally
    // Maps lowercase name (including nicknames) to a shared stats object
    const nameToStatsMap: Record<string, { pj: number, pg: number, pe: number, pp: number, points: number, goals: number, motm: number, id: string }> = {};
    const playerStats: Record<string, any> = {};

    players.forEach(p => {
      const statsObj = {
        pj: 0, pg: 0, pe: 0, pp: 0, points: 0, goals: 0, motm: 0, id: p.id
      };
      playerStats[p.id] = statsObj;
      
      // Map primary name
      nameToStatsMap[p.name.toLowerCase()] = statsObj;
      
      // Map nicknames
      if (p.nicknames) {
        p.nicknames.forEach(nick => {
          if (nick.trim()) {
            nameToStatsMap[nick.trim().toLowerCase()] = statsObj;
          }
        });
      }
    });
    
    matches.forEach(match => {
      const isDraw = match.result === 'draw';
      const winTeamNames = (match.result === 'claro' ? match.teamClaro : match.result === 'oscuro' ? match.teamOscuro : []).map(n => n.toLowerCase());
      const lossTeamNames = (match.result === 'claro' ? match.teamOscuro : match.result === 'oscuro' ? match.teamClaro : []).map(n => n.toLowerCase());
      
      const allPlayerNamesInMatch = [...(match.teamClaro || []), ...(match.teamOscuro || [])];
      
      // Track which unique players have already been processed for this match
      // to avoid double counting if multiple names (nicknames/old names) are in the match record
      const processedPlayerIdsInMatch = new Set<string>();

      allPlayerNamesInMatch.forEach(playerName => {
        const stats = nameToStatsMap[playerName.toLowerCase()];
        if (!stats || processedPlayerIdsInMatch.has(stats.id)) return;
        
        processedPlayerIdsInMatch.add(stats.id);
        
        stats.pj++;
        const isWin = winTeamNames.includes(playerName.toLowerCase());
        const isLoss = lossTeamNames.includes(playerName.toLowerCase());
        
        if (isWin) { 
          stats.pg++; 
          stats.points += 3; 
        } else if (isDraw) { 
          stats.pe++; 
          stats.points += 2; 
        } else { 
          stats.pp++; 
          stats.points += 1; 
        }
        
        // Sum goals from all names associated with this player in this match
        // In case the match record has both "Bocha" and "Fede" but they were meant to be the same.
        // Actually, the user says 9 vs 5, so if we only take the goals of the FIRST name found, 
        // it might solve the duplicate issue if Fede has 4 and Bocha has 4 in the same document.
        // However, if a player legitimateley played under two names (unlikely), we'd want to sum.
        // BUT the user specifically called it a bug that it counts 9 instead of 5.
        
        // Sum all goals from all names associated with this player ID in this match
        let matchGoalsForPlayer = 0;
        Object.entries(match.goals || {}).forEach(([gName, count]) => {
          const gStats = nameToStatsMap[gName.toLowerCase()];
          if (gStats && gStats.id === stats.id) {
            matchGoalsForPlayer += count;
          }
        });
        
        stats.goals += matchGoalsForPlayer;
        
        // MOTM check
        let isMotm = false;
        if (match.motm) {
          const mStats = nameToStatsMap[match.motm.toLowerCase()];
          if (mStats && mStats.id === stats.id) isMotm = true;
        }
        if (isMotm) stats.motm++;
      });
    });
    
    // Update the batch with calculated values
    Object.values(playerStats).forEach(s => {
      const playerRef = doc(db, 'players', s.id);
      batch.update(playerRef, { 
        stats: {
          pj: s.pj,
          pg: s.pg,
          pe: s.pe,
          pp: s.pp,
          points: s.points,
          goals: s.goals,
          motm: s.motm
        }
      });
    });
    
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'sync_stats');
  }
};

export const recalculateStatistics = async () => {
  try {
    const playersSnap = await getDocs(collection(db, 'players'));
    const players: Player[] = [];
    playersSnap.forEach(d => players.push({ id: d.id, ...d.data() } as Player));
    return await syncAllPlayerStats(players);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'players');
  }
};

// Save a match and update player stats
export const saveMatch = async (matchData: Omit<Match, 'id'>, players: Player[]) => {
  const path = 'matches';
  try {
    const batch = writeBatch(db);
    const newMatchRef = doc(collection(db, path));
    batch.set(newMatchRef, matchData);
    await applyStats(batch, matchData, players);
    await batch.commit();
    return newMatchRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Subscribe to potm
export const subscribeToPotm = (callback: (playerId: string | null) => void) => {
  const path = 'settings/potm';
  return onSnapshot(doc(db, 'settings', 'potm'), (docSnap) => {
    try {
      if (docSnap.exists()) {
        callback(docSnap.data().playerId);
      } else {
        callback(null);
      }
    } catch (err) {
      console.error('Error in subscribeToPotm callback:', err);
    }
  }, (error) => {
    console.warn("Aviso: No se pudo cargar el Mejor Jugador del Mes. Faltan permisos en Firebase.", error);
    callback(null);
  });
};

export const updatePotm = async (playerId: string) => {
  const path = 'settings/potm';
  try {
    await setDoc(doc(db, 'settings', 'potm'), { playerId });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Subscribe to pozo
export const subscribeToPozo = (callback: (data: { amount: number, updatedAt: string } | null) => void) => {
  const path = 'settings/pozo';
  return onSnapshot(doc(db, 'settings', 'pozo'), (docSnap) => {
    try {
      if (docSnap.exists()) {
        callback(docSnap.data() as { amount: number, updatedAt: string });
      } else {
        callback(null);
      }
    } catch (err) {
      console.error('Error in subscribeToPozo callback:', err);
    }
  }, (error) => {
    console.warn("Aviso: No se pudo cargar el pozo.", error);
    callback(null);
  });
};

export const updatePozo = async (amount: number) => {
  const path = 'settings/pozo';
  try {
    await setDoc(doc(db, 'settings', 'pozo'), { 
      amount, 
      updatedAt: new Date().toISOString() 
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Update a match and update player stats
export const updateMatch = async (matchId: string, matchData: Omit<Match, 'id'>, players: Player[]) => {
  const path = `matches/${matchId}`;
  try {
    const batch = writeBatch(db);
    
    // 1. Get old match to revert stats
    const matchDoc = await getDoc(doc(db, 'matches', matchId));
    const oldMatch = matchDoc.data() as Match;
    
    if (oldMatch) {
      await revertStats(batch, { ...oldMatch, id: matchId }, players);
    }

    // 2. Update match document
    batch.set(doc(db, 'matches', matchId), matchData);

    // 3. Apply new stats
    await applyStats(batch, matchData, players);

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

// Vote for MOTM
export const voteForMOTM = async (matchId: string, voterName: string, votedFor: string) => {
  // Use a sanitized ID: lowercase and no special characters
  const sanitizedId = voterName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const path = `matches/${matchId}/votes/${sanitizedId}`;
  
  console.log(`Intentando registrar voto - Match: ${matchId}, Voter: ${voterName}, ID: ${sanitizedId}`);
  
  try {
    await setDoc(doc(db, 'matches', matchId, 'votes', sanitizedId), {
      voterName,
      votedFor,
      timestamp: Timestamp.now()
    });
    console.log('Voto registrado exitosamente en Firestore');
  } catch (error) {
    console.error('Error detallado de Firestore al votar:', error);
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Subscribe to votes for a match
export const subscribeToVotes = (matchId: string, callback: (votes: Vote[]) => void) => {
  const path = `matches/${matchId}/votes`;
  const q = collection(db, 'matches', matchId, 'votes');
  return onSnapshot(q, (snapshot) => {
    try {
      const votes: Vote[] = [];
      snapshot.forEach((doc) => {
        votes.push(doc.data() as Vote);
      });
      callback(votes);
    } catch (err) {
      console.error('Error in subscribeToVotes callback:', err);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path, false);
  });
};

// Close voting and set MOTM
export const closeVotingAndSetMOTM = async (matchId: string, motmName: string, players: Player[]) => {
  const path = `matches/${matchId}`;
  try {
    const batch = writeBatch(db);
    const matchRef = doc(db, 'matches', matchId);
    const matchSnap = await getDoc(matchRef);
    
    if (!matchSnap.exists()) throw new Error('Match not found');
    
    const oldMatch = { ...matchSnap.data(), id: matchId } as Match;
    
    // 1. Revert stats with old match data
    await revertStats(batch, oldMatch, players);
    
    // 2. Prepare new match data
    const newMatchData = {
      ...oldMatch,
      motm: motmName,
      votingClosed: true,
      id: matchId
    };
    
    // 3. Update match document
    batch.set(matchRef, newMatchData);
    
    // 4. Apply stats for new match data
    await applyStats(batch, newMatchData, players);

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

// DigiBird Leaderboard functions
export const subscribeToDigiBirdLeaderboard = (callback: (scores: DigiBirdScore[]) => void) => {
  const path = 'digibird_leaderboard';
  const q = query(collection(db, path), orderBy('score', 'desc'));
  return onSnapshot(q, (snapshot) => {
    try {
      const scores: DigiBirdScore[] = [];
      snapshot.forEach((doc) => {
        scores.push(doc.data() as DigiBirdScore);
      });
      callback(scores.slice(0, 10)); // Top 10
    } catch (err) {
      console.error('Error in subscribeToDigiBirdLeaderboard callback:', err);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path, false);
    callback([]);
  });
};

export const saveDigiBirdScore = async (name: string, score: number) => {
  const path = 'digibird_leaderboard';
  try {
    // We use a unique ID for each attempt, or we could use user ID if we wanted one score per user.
    // The user didn't specify one per user, so we'll just add new scores.
    const newScoreRef = doc(collection(db, path));
    await setDoc(newScoreRef, {
      name,
      score,
      timestamp: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}
// testConnection().catch(() => {});
