import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Player, subscribeToPlayers, subscribeToDigiBirdLeaderboard, saveDigiBirdScore, DigiBirdScore } from '@/services/db';
import { Trophy, RefreshCw, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const GRAVITY = 0.6;
const JUMP_STRENGTH = -8;
const PIPE_SPEED = 3.5;
const PIPE_SPAWN_RATE = 1500; // ms
const PIPE_WIDTH = 60;
const PIPE_GAP = 160;
const BIRD_SIZE = 36;

interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
}

const DigiBird = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [digiPlayer, setDigiPlayer] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover'>('start');
  const [isGameRunning, setIsGameRunning] = useState(false); // New state to control physics
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<DigiBirdScore[]>([]);
  const [showNameInput, setShowNameInput] = useState(false);
  const [playerName, setPlayerName] = useState('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // Game state refs (to avoid stale closures in requestAnimationFrame)
  const birdY = useRef(250);
  const birdVelocity = useRef(0);
  const pipes = useRef<{ x: number, top: number, passed: boolean }[]>([]);
  const lastPipeTime = useRef(0);
  const lastGameOverTime = useRef(0);
  const scoreRef = useRef(0);

  useEffect(() => {
    const unsubPlayers = subscribeToPlayers((data) => {
      setPlayers(data);
      // Try to find Digi
      const found = data.find(p => 
        p.name.toLowerCase().includes('digi') || 
        p.nicknames?.some(n => n.toLowerCase().includes('digi'))
      );
      if (found) setDigiPlayer(found);
      else if (data.length > 0) setDigiPlayer(data[0]); // Fallback
    });

    const unsubLeaderboard = subscribeToDigiBirdLeaderboard(setLeaderboard);
    
    const savedHL = localStorage.getItem('digibird-highscore');
    if (savedHL) setHighScore(parseInt(savedHL));

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        jump();
      } else if (e.key === 'Enter' && showNameInput) {
        saveLeaderboard(playerName, score);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unsubPlayers();
      unsubLeaderboard();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState, showNameInput, isGameRunning]); // Added isGameRunning

  const resetGame = () => {
    birdY.current = 250;
    birdVelocity.current = 0;
    pipes.current = [];
    lastPipeTime.current = performance.now();
    scoreRef.current = 0;
    setScore(0);
    setGameState('playing');
    setIsGameRunning(false); // Start frozen
    setShowNameInput(false);
  };

  const jump = () => {
    if (showNameInput) return;
      if (gameState === 'playing') {
        if (!isGameRunning) setIsGameRunning(true);
        birdVelocity.current = JUMP_STRENGTH;
      } else if (gameState === 'start') {
        resetGame();
      } else if (gameState === 'gameover') {
        // Reduced delay to 1 second (1000ms)
        if (performance.now() - lastGameOverTime.current > 1000) {
          resetGame();
        }
      }
  };

  const saveLeaderboard = async (name: string, finalScore: number) => {
    const cleanedName = name.trim() || 'Invitado';
    try {
      await saveDigiBirdScore(cleanedName, finalScore);
      setShowNameInput(false);
      setPlayerName('');
    } catch (err) {
      console.error('Error saving score:', err);
    }
  };

  const checkLeaderboard = (finalScore: number) => {
    if (finalScore === 0) return;
    // Show input if it's potentially a top score
    if (leaderboard.length < 10 || finalScore > leaderboard[leaderboard.length - 1].score) {
      setShowNameInput(true);
    }
  };

  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (digiPlayer?.photoUrl) {
      const img = new Image();
      img.src = digiPlayer.photoUrl;
      img.referrerPolicy = 'no-referrer';
      img.onload = () => { imgRef.current = img; };
    }
  }, [digiPlayer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const update = (time: number) => {
      // In start state, we keep bird at initial Y
      if (gameState === 'start' || (gameState === 'playing' && !isGameRunning)) {
        birdY.current = 250;
        birdVelocity.current = 0;
        if (gameState === 'playing' && !isGameRunning) {
           // Maybe a subtle hovering animation while waiting
           birdY.current = 250 + Math.sin(time / 200) * 5;
        }
        render();
        requestRef.current = requestAnimationFrame(update);
        return;
      }

      if (gameState !== 'playing') {
        render();
        requestRef.current = requestAnimationFrame(update);
        return;
      }

      // Physics
      if (isGameRunning) {
        birdVelocity.current += GRAVITY;
        birdY.current += birdVelocity.current;
      }

      const currentScore = scoreRef.current;

      // Pipe generation
      if (time - lastPipeTime.current > PIPE_SPAWN_RATE / (1 + currentScore * 0.05)) {
        const minPipeHeight = 50;
        const maxPipeHeight = canvas.height - PIPE_GAP - minPipeHeight;
        const top = Math.random() * (maxPipeHeight - minPipeHeight) + minPipeHeight;
        pipes.current.push({ x: canvas.width, top, passed: false });
        lastPipeTime.current = time;
      }

      // Pipe movement & collision
      const speed = PIPE_SPEED + (currentScore * 0.1);
      pipes.current.forEach((pipe) => {
        pipe.x -= speed;

        // Collision check
        const birdX = 100;
        const birdRadius = BIRD_SIZE / 2 - 5;
        
        // Rect hitboxes for pipes
        if (
          birdX + birdRadius > pipe.x && 
          birdX - birdRadius < pipe.x + PIPE_WIDTH
        ) {
          if (birdY.current - birdRadius < pipe.top || birdY.current + birdRadius > pipe.top + PIPE_GAP) {
            setGameState('gameover');
            lastGameOverTime.current = performance.now();
            checkLeaderboard(currentScore);
          }
        }

        // Score update
        if (!pipe.passed && pipe.x + PIPE_WIDTH < birdX) {
          pipe.passed = true;
          scoreRef.current += 1;
          setScore(scoreRef.current);
        }
      });

      // Remove off-screen pipes
      pipes.current = pipes.current.filter(p => p.x + PIPE_WIDTH > 0);

      // Bound check
      if (birdY.current + BIRD_SIZE/2 > canvas.height || birdY.current - BIRD_SIZE/2 < 0) {
        setGameState('gameover');
        lastGameOverTime.current = performance.now();
        checkLeaderboard(score);
      }

      render();
      requestRef.current = requestAnimationFrame(update);
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background (Grass & Field)
      ctx.fillStyle = '#1a4a2a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Field lines
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2;
      for (let i = 0; i < canvas.width; i += 100) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }

      // Draw Pipes (Goalposts)
      pipes.current.forEach(pipe => {
        ctx.fillStyle = '#ffffff';
        // Top pipe
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
        // Bottom pipe
        ctx.fillRect(pipe.x, pipe.top + PIPE_GAP, PIPE_WIDTH, canvas.height - (pipe.top + PIPE_GAP));
        
        // Pipe edges/caps
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(pipe.x - 2, pipe.top - 10, PIPE_WIDTH + 4, 10);
        ctx.fillRect(pipe.x - 2, pipe.top + PIPE_GAP, PIPE_WIDTH + 4, 10);
      });

      // Draw Bird (Digi)
      const birdX = 100;
      ctx.save();
      ctx.translate(birdX, birdY.current);
      ctx.rotate(Math.min(Math.PI / 4, Math.max(-Math.PI / 4, birdVelocity.current * 0.1)));
      
      // Shadow
      ctx.beginPath();
      ctx.arc(2, 4, BIRD_SIZE / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();

      // Circle Clip for Image
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_SIZE / 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.clip();

      if (digiPlayer?.photoUrl && imgRef.current?.complete) {
        ctx.drawImage(imgRef.current, -BIRD_SIZE / 2, -BIRD_SIZE / 2, BIRD_SIZE, BIRD_SIZE);
      } else {
        ctx.fillStyle = '#10b981';
        ctx.fillRect(-BIRD_SIZE / 2, -BIRD_SIZE / 2, BIRD_SIZE, BIRD_SIZE);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('D', 0, 7);
      }
      ctx.restore();
    };

    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, isGameRunning, digiPlayer]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('digibird-highscore', score.toString());
    }
  }, [score, highScore]);

  return (
    <div className="flex flex-col items-center justify-center p-2 md:p-8 space-y-4 md:space-y-6 select-none" onClick={jump}>
      <div className="text-center space-y-1 mb-1 md:mb-2">
        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase italic">DIGI <span className="text-primary">BIRD</span></h2>
        <div className="flex items-center gap-2 md:gap-4 justify-center">
            <div className="bg-white/5 px-2 md:px-3 py-1 rounded-full border border-white/10">
                <p className="text-[8px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Score</p>
                <p className="text-lg md:text-xl font-black text-white leading-none">{score}</p>
            </div>
            <div className="bg-primary/10 px-2 md:px-3 py-1 rounded-full border border-primary/20">
                <p className="text-[8px] md:text-[10px] font-black text-primary/60 uppercase tracking-widest leading-none mb-1">Record</p>
                <p className="text-lg md:text-xl font-black text-primary leading-none">{highScore}</p>
            </div>
        </div>
      </div>

      <div className="relative rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden border-4 md:border-8 border-white/5 shadow-2xl bg-black aspect-[2/3] w-full max-w-[280px] md:max-w-[400px]">
        <canvas 
          ref= {canvasRef} 
          width={400} 
          height={600} 
          className="w-full h-full cursor-pointer touch-none"
        />

        <AnimatePresence>
          {(gameState === 'start' || (gameState === 'gameover' && !showNameInput)) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 md:p-8 space-y-4 md:space-y-6 overflow-y-auto"
            >
              {gameState === 'start' ? (
                <>
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/20 rounded-2xl md:rounded-3xl flex items-center justify-center animate-bounce">
                    <Play size={24} className="text-primary fill-primary md:w-8 md:h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl md:text-2xl font-black text-white uppercase italic">¿Listo para volar?</h3>
                    <p className="text-gray-400 text-[10px] md:text-xs font-medium">Click o ESPACIO para saltar.</p>
                  </div>
                </>
              ) : (
                <div className="space-y-3 md:space-y-4 w-full">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-red-500 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto shadow-xl">
                    <Trophy size={20} className="text-white md:w-6 md:h-6" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-white uppercase italic tracking-tighter">FIN DEL JUEGO</h3>
                  <div className="bg-white/5 p-3 md:p-4 rounded-xl md:rounded-2xl border border-white/5">
                     <p className="text-[8px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1 md:mb-2">Puntaje final</p>
                     <p className="text-2xl md:text-3xl font-black text-white leading-none">{score}</p>
                  </div>
                </div>
              )}

              {leaderboard.length > 0 && (
                <div className="w-full space-y-2 md:space-y-3 bg-white/5 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-white/10">
                  <p className="text-[8px] md:text-[10px] font-black text-primary uppercase tracking-widest">TOP 10 RECORDS GLOBALES</p>
                  <div className="space-y-1 md:space-y-2">
                    {leaderboard.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px] md:text-xs font-bold border-b border-white/5 pb-1 last:border-0 truncate">
                        <span className="text-white/40 mr-1 md:mr-2">#{i + 1}</span>
                        <span className="text-white flex-1 text-left truncate">{entry.name}</span>
                        <span className="text-primary ml-1 md:ml-2">{entry.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button 
                onClick={(e) => { e.stopPropagation(); jump(); }}
                className="w-full bg-primary text-background py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl text-xs md:text-sm"
              >
                {gameState === 'start' ? 'EMPEZAR' : 'DE NUEVO'}
              </button>
            </motion.div>
          )}

          {showNameInput && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-0 bg-primary/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-2xl">
                <Trophy size={40} className="text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-background uppercase italic tracking-tight">¡NUEVO RECORD!</h3>
                <p className="text-background/70 font-bold">Entraste al Top 5 con {score} puntos.</p>
              </div>
              
              <div className="w-full space-y-4">
                <input 
                  autoFocus
                  type="text"
                  placeholder="TU NOMBRE"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveLeaderboard(playerName, score);
                  }}
                  className="w-full bg-white/20 border-2 border-white/30 rounded-2xl px-6 py-4 text-white font-black uppercase tracking-widest placeholder:text-white/40 outline-none focus:bg-white/30 transition-all"
                />
                <button 
                  onClick={() => saveLeaderboard(playerName, score)}
                  className="w-full bg-background text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all"
                >
                  GUARDAR
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Level indicator */}
        {gameState === 'playing' && (
             <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 opacity-60 pointer-events-none">
                <p className="text-[10px] font-black text-white uppercase tracking-[0.4em]">DIFICULTAD x{(1 + score * 0.05).toFixed(1)}</p>
             </div>
        )}
      </div>

      <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">
        CLICK O ESPACIO PARA SALTAR
      </p>
    </div>
  );
};

export default DigiBird;
