import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Player, subscribeToPlayers } from '@/services/db';
import { getWeeklySeed, getWeeklyItem } from '@/lib/gameUtils';
import { toast } from 'sonner';
import { Check, Trophy, XCircle, Share2, CornerDownLeft, Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

type LetterState = 'correct' | 'present' | 'absent' | 'empty';

const WordleGame = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [targetName, setTargetName] = useState('');
  const [attempts, setAttempts] = useState<string[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState('');
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load players and pick target
  useEffect(() => {
    const unsubscribe = subscribeToPlayers((data) => {
      setPlayers(data);
      const seed = getWeeklySeed();
      
      // Filter players that have a reasonable name length (3-10 characters) and NO spaces
      const validPlayers = data.filter(p => 
        p.name.length >= 3 && 
        p.name.length <= 10 && 
        !p.name.includes(' ')
      );
      const target = getWeeklyItem(validPlayers, seed, 101); // Offset 101 for wordle
      
      if (target) {
        setTargetName(target.name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      } else {
        setError('No hay jugador para hoy.');
      }
      setLoading(false);
    });

    const timeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const nameLength = targetName.length;

  const onKey = useCallback((key: string) => {
    if (gameState !== 'playing') return;

    if (key === 'Enter') {
      if (currentAttempt.length !== nameLength) {
        toast.error(`El nombre debe tener ${nameLength} letras`);
        return;
      }
      
      const newAttempts = [...attempts, currentAttempt];
      setAttempts(newAttempts);
      setCurrentAttempt('');

      if (currentAttempt === targetName) {
        setGameState('won');
        toast.success(`¡Gol de ${targetName}! Adivinaste al jugador.`);
      } else if (newAttempts.length >= 6) {
        setGameState('lost');
        toast.error(`Fin del partido. El jugador oculto era ${targetName}.`);
      }
    } else if (key === 'Backspace') {
      setCurrentAttempt(prev => prev.slice(0, -1));
    } else if (/^[A-Z]$/i.test(key) && currentAttempt.length < nameLength) {
      setCurrentAttempt(prev => prev + key.toUpperCase());
    }
  }, [currentAttempt, nameLength, attempts, gameState, targetName]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => onKey(e.key);
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onKey]);

  const getFeedback = (guess: string) => {
    const result: LetterState[] = Array(nameLength).fill('absent');
    const targetArr = targetName.split('');
    const guessArr = guess.split('');
    
    // Track letters used to handle repetitions correctly
    const remainingTarget = [...targetArr];

    // First pass for correct positions (Green)
    guessArr.forEach((letter, i) => {
      if (letter === targetArr[i]) {
        result[i] = 'correct';
        remainingTarget[i] = '';
      }
    });

    // Second pass for present letters (Yellow)
    guessArr.forEach((letter, i) => {
      if (result[i] !== 'correct') {
        const index = remainingTarget.indexOf(letter);
        if (index !== -1) {
          result[i] = 'present';
          remainingTarget[index] = '';
        }
      }
    });

    return result;
  };

  const shareResult = () => {
    const emojis = attempts.map(guess => {
      return getFeedback(guess).map(state => {
        if (state === 'correct') return '🟩';
        if (state === 'present') return '🟨';
        return '⬛';
      }).join('');
    }).join('\n');
    
    const text = `Jugadorle ROCA 2026\n${attempts.length}/6\n\n${emojis}\n\nJugá en: ${window.location.href}`;
    navigator.clipboard.writeText(text)
      .then(() => toast.success('Resultado copiado al portapapeles'))
      .catch((err) => {
        console.error('Clipboard error:', err);
        toast.error('No se pudo copiar el resultado automatically. Intenta compartir manualmente.');
      });
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  if (error || !targetName) return <div className="flex items-center justify-center h-96 text-white font-bold p-8 text-center">{error || 'Faltan datos de jugadores'}</div>;

  const Keyboard = () => {
    const rows = [
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
      ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Backspace']
    ];

    const getKeyState = (key: string) => {
      let best: string = 'empty';
      attempts.forEach(guess => {
        const feedback = getFeedback(guess);
        guess.split('').forEach((letter, i) => {
          if (letter === key) {
            const state = feedback[i];
            if (state === 'correct') {
              best = 'correct';
            } else if (state === 'present' && best !== 'correct') {
              best = 'present';
            } else if (state === 'absent' && best === 'empty') {
              best = 'absent';
            }
          }
        });
      });
      return best as LetterState;
    };

    return (
      <div className="space-y-1 md:space-y-2 mt-4 md:mt-8 w-full max-w-md mx-auto px-0.5 md:px-2">
        {rows.map((row, i) => (
          <div key={i} className="flex justify-center gap-0.5 md:gap-1.5">
            {row.map(key => {
              const state = getKeyState(key);
              const isSpecial = key === 'Enter' || key === 'Backspace';
              return (
                <button
                  key={key}
                  onClick={() => onKey(key)}
                  className={cn(
                    "h-9 md:h-14 flex items-center justify-center rounded-md md:rounded-lg font-bold transition-all active:scale-95 text-[9px] md:text-sm",
                    isSpecial ? "px-0.5 md:px-4 min-w-[2rem] md:min-w-[3.5rem] flex-1" : "flex-1 max-w-[2.2rem] md:w-10",
                    state === 'correct' && "bg-green-500 text-white",
                    state === 'present' && "bg-amber-500 text-white",
                    state === 'absent' && "bg-gray-700 text-gray-400",
                    state === 'empty' && "bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  {key === 'Backspace' ? <Delete size={14} className="md:w-5 md:h-5" /> : key === 'Enter' ? <CornerDownLeft size={14} className="md:w-5 md:h-5" /> : key}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 flex flex-col items-center min-h-[600px]">
      <div className="text-center space-y-2 mb-8">
        <h2 className="text-3xl font-black text-white tracking-tighter">JUGADORLE</h2>
        <p className="text-gray-400 font-medium">Adiviná el nombre de {nameLength} letras</p>
      </div>

      <div className="space-y-2 flex flex-col items-center">
        {/* Past Attempts */}
        {attempts.map((guess, i) => (
          <div key={i} className="flex gap-2">
            {guess.split('').map((letter, j) => {
              const state = getFeedback(guess)[j];
              return (
                <motion.div
                  key={j}
                  initial={{ rotateY: 90 }}
                  animate={{ rotateY: 0 }}
                  transition={{ delay: j * 0.1 }}
                  className={cn(
                    "w-10 h-10 md:w-14 md:h-14 flex items-center justify-center rounded-lg md:rounded-xl font-black text-lg md:text-2xl border-2 transition-colors",
                    state === 'correct' ? "bg-green-500 border-green-600 text-white" :
                    state === 'present' ? "bg-amber-500 border-amber-600 text-white" :
                    "bg-gray-800 border-gray-700 text-gray-400"
                  )}
                >
                  {letter}
                </motion.div>
              );
            })}
          </div>
        ))}

        {/* Current Attempt */}
        {gameState === 'playing' && (
          <div className="flex gap-2">
            {Array(nameLength).fill('').map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-10 h-10 md:w-14 md:h-14 flex items-center justify-center rounded-lg md:rounded-xl font-black text-lg md:text-2xl border-2 transition-all",
                  currentAttempt[i] ? "border-white/40 text-white" : "border-white/10"
                )}
              >
                {currentAttempt[i]}
              </div>
            ))}
          </div>
        )}

        {/* Future Empty Rows */}
        {gameState === 'playing' && Array(Math.max(0, 5 - attempts.length)).fill('').map((_, i) => (
          <div key={`empty-${i}`} className="flex gap-2">
            {Array(nameLength).fill('').map((_, j) => (
              <div key={j} className="w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-xl border-2 border-white/5 opacity-50" />
            ))}
          </div>
        ))}
      </div>

      {gameState === 'playing' ? (
        <Keyboard />
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-12 bg-surface p-8 rounded-3xl border border-white/10 text-center space-y-6 max-w-sm w-full shadow-2xl"
        >
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4",
            gameState === 'won' ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
          )}>
            {gameState === 'won' ? <Trophy size={48} /> : <XCircle size={48} />}
          </div>
          
          <div>
            <h4 className="text-2xl font-black text-white">
              {gameState === 'won' ? '¡VICTORIA!' : 'FIN DEL PARTIDO'}
            </h4>
            <p className="text-gray-400 font-medium mt-1">
              {gameState === 'won' ? `Adivinaste en ${attempts.length} intentos.` : `El jugador era ${targetName}`}
            </p>
          </div>

          <button 
            onClick={shareResult}
            className="w-full flex items-center justify-center gap-2 bg-primary text-background py-4 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95"
          >
            <Share2 size={20} />
            Compartir Resultado
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default WordleGame;
