import React, { useState, useEffect, useRef } from 'react';
import { Player } from '@/services/db';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlayerSearchProps {
  players: Player[];
  onSelect: (playerName: string) => void;
  placeholder?: string;
  className?: string;
}

const PlayerSearch = ({ players, onSelect, placeholder, className }: PlayerSearchProps) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Player[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = players.filter(p => {
      const nameMatch = p.name.toLowerCase().includes(lowerQuery);
      const nicknameMatch = p.nicknames?.some(n => n.toLowerCase().includes(lowerQuery));
      return nameMatch || nicknameMatch;
    });

    // Move exact matches or starts-with to the top
    const sorted = [...filtered].sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
      const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return 0;
    }).slice(0, 5);

    setSuggestions(sorted);
    setIsOpen(sorted.length > 0);
  }, [query, players]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (playerName: string) => {
    onSelect(playerName);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isOpen && suggestions.length > 0) {
      e.preventDefault();
      handleSelect(suggestions[0].name);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Buscar jugador..."}
          className="w-full bg-surface border border-white/10 rounded-2xl px-12 py-5 text-white font-bold focus:border-primary/50 outline-none shadow-xl transition-all"
          onFocus={() => query.length >= 2 && suggestions.length > 0 && setIsOpen(true)}
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
      </div>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 bg-surface/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          {suggestions.map((player) => (
            <button
              key={player.id}
              onClick={() => handleSelect(player.name)}
              className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
            >
              {player.photoUrl ? (
                <img src={player.photoUrl} alt={player.name} className="w-10 h-10 rounded-full object-cover border border-white/10" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xs font-black">{player.name[0]}</div>
              )}
              <div>
                <p className="text-sm font-black text-white uppercase tracking-tight">{player.name}</p>
                {player.nicknames && player.nicknames.length > 0 && (
                  <p className="text-[10px] text-gray-500 font-bold uppercase truncate max-w-[150px]">
                    {player.nicknames.join(', ')}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlayerSearch;
