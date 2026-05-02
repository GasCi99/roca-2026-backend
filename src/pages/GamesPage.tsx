import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, Trophy, Users, Search, Target, HelpCircle, ChevronLeft, Info, Calendar, TrendingUp, Bird } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getWeeklySeed } from '@/lib/gameUtils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Game Components (Placeholders for now)
import WordleGame from '@/components/games/WordleGame';
import GuessMatch from '@/components/games/GuessMatch';
import BlurryPlayer from '@/components/games/BlurryPlayer';
import Coincidences from '@/components/games/Coincidences';
import GaloPenalty from '@/components/games/GaloPenalty';
import DigiBird from '@/components/games/DigiBird';
import HigherLower from '@/components/games/HigherLower';

const GamesPage = () => {
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const weeklySeed = getWeeklySeed();
  
  const nextRotation = new Date(weeklySeed + 7 * 24 * 60 * 60 * 1000);

  const games = [
    {
      id: 'higher-lower',
      title: 'Más o Menos',
      description: '¿Quién tiene más partidos jugados? Un duelo de estadísticas.',
      icon: TrendingUp,
      color: 'bg-orange-500',
      difficulty: 'Memoria'
    },
    {
      id: 'jugadorle',
      title: 'Jugadorle',
      description: 'Adivina el jugador secreto al estilo Wordle.',
      icon: Search,
      color: 'bg-green-500',
      difficulty: 'Media'
    },
    {
      id: 'adivina-partido',
      title: 'Adivina el Partido',
      description: 'Completa los jugadores que participaron en un partido histórico.',
      icon: Trophy,
      color: 'bg-blue-500',
      difficulty: 'Variable'
    },
    {
      id: 'foto-enigmatica',
      title: 'Foto Enigmática',
      description: 'Elegí el jugador antes de que la imagen se vuelva nítida.',
      icon: HelpCircle,
      color: 'bg-purple-500',
      difficulty: 'Difícil'
    },
    {
      id: 'coincidencias',
      title: 'Coincidencias',
      description: 'Encontrá a los jugadores que comparten un logro estadístico.',
      icon: Users,
      color: 'bg-amber-500',
      difficulty: 'Alta'
    },
    {
      id: 'penal-galo',
      title: 'Penal a Galo',
      description: '¿Podrás meterle un gol a Galo? Elegí dónde patear.',
      icon: Target,
      color: 'bg-red-500',
      difficulty: 'Suerte'
    },
    {
      id: 'digi-bird',
      title: 'Digi Bird',
      description: 'Esquivá los arcos con Digi en este desafío de reflejos.',
      icon: Bird,
      color: 'bg-indigo-500',
      difficulty: 'Habilidad'
    }
  ];

  const renderGame = () => {
    switch (activeGame) {
      case 'jugadorle': return <WordleGame />;
      case 'adivina-partido': return <GuessMatch />;
      case 'foto-enigmatica': return <BlurryPlayer />;
      case 'coincidencias': return <Coincidences />;
      case 'penal-galo': return <GaloPenalty />;
      case 'digi-bird': return <DigiBird />;
      case 'higher-lower': return <HigherLower />;
      default: return null;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <AnimatePresence mode="wait">
        {!activeGame ? (
          <motion.div 
            key="menu"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary mb-2">
                  <Gamepad2 size={14} className="animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Entretenimiento ROCA</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
                  CENTRO DE <span className="text-primary italic">JUEGOS</span>
                </h1>
                <p className="text-gray-400 max-w-md font-medium">
                  Desafíos semanales para demostrar cuánto sabés del equipo.
                </p>
              </div>

              <div className="bg-surface border border-white/5 p-4 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400">
                  <Calendar size={20} />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Próxima rotación</p>
                  <p className="text-sm font-bold text-white">
                    {format(nextRotation, "EEEE d 'de' MMMM", { locale: es })}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {games.map((game, index) => (
                <motion.button
                  key={game.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setActiveGame(game.id)}
                  className="group relative overflow-hidden bg-surface border border-white/5 rounded-3xl p-6 text-left transition-all hover:border-primary/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.05)]"
                >
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 transition-transform group-hover:scale-110 duration-500",
                    game.color
                  )}>
                    <game.icon size={28} />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black text-white tracking-tight">{game.title}</h3>
                      <span className="text-[10px] font-black px-2 py-1 bg-white/5 rounded-md text-gray-400 uppercase tracking-widest">
                        {game.difficulty}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 font-medium leading-relaxed">
                      {game.description}
                    </p>
                  </div>

                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                      <ChevronLeft size={16} className="rotate-180" />
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
            
            <div className="bg-primary/5 border border-primary/10 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                <Info size={32} />
              </div>
              <div className="space-y-1 text-center md:text-left">
                <h4 className="text-lg font-black text-white">¿Cómo funcionan los desafíos?</h4>
                <p className="text-gray-400 text-sm font-medium">
                  Cada miércoles al mediodía se eligen nuevos jugadores y partidos para todos los juegos de forma aleatoria, 
                  pero igual para todos los usuarios. ¡Comparte tus resultados!
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="game-container"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <button 
              onClick={() => setActiveGame(null)}
              className="group flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="font-bold text-sm tracking-wide">VOLVER AL MENU</span>
            </button>
            
            <div className="bg-surface border border-white/5 rounded-3xl min-h-[600px] relative">
              {renderGame()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GamesPage;
