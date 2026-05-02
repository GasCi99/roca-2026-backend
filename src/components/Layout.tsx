import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BarChart2, History, PlusCircle, Users, Shield, LogOut, X, AlertCircle, Shuffle, Gamepad2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePassword } from '@/contexts/PasswordContext';
import { toast } from 'sonner';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { isAuthenticated, login, logout } = usePassword();
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [password, setPassword] = useState('');

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) {
      setShowAdminLogin(false);
      setPassword('');
      toast.success('Modo administrador activado');
    } else {
      toast.error('Contraseña incorrecta');
    }
  };

  const navItems = [
    { name: 'Inicio', path: '/', icon: Home },
    { name: 'Estadísticas', path: '/estadisticas', icon: BarChart2 },
    { name: 'Historial', path: '/historial', icon: History },
    { name: 'Equipos', path: '/armar-equipos', icon: Shuffle },
    { name: 'Juegos', path: '/juegos', icon: Gamepad2 },
    ...(isAuthenticated ? [{ name: 'Cargar', path: '/cargar', icon: PlusCircle }] : []),
    { name: 'Jugadores', path: '/jugadores', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background text-gray-100 pb-20 md:pb-0 md:pt-16">
      {/* Top Navbar for Desktop */}
      <header className="hidden md:flex fixed top-0 w-full bg-surface/80 backdrop-blur-md border-b border-white/5 text-white shadow-lg z-50 h-16 items-center px-8">
        <Link to="/" className="flex items-center gap-3 font-black text-2xl tracking-tighter hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-background rotate-3 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
            ⚽
          </div>
          <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">ROCA 2026</span>
        </Link>
        <nav className="ml-auto flex gap-2 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300",
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon size={18} className={cn(isActive && "drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]")} />
                <span className="font-semibold text-sm">{item.name}</span>
              </Link>
            );
          })}
          
          <div className="h-6 w-[1px] bg-white/10 mx-2" />
          
          {isAuthenticated ? (
            <button 
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut size={18} />
              <span className="font-bold text-xs uppercase tracking-widest">Salir</span>
            </button>
          ) : (
            <button 
              onClick={() => setShowAdminLogin(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-primary hover:bg-primary/10 transition-all border border-primary/20"
            >
              <Shield size={18} />
              <span className="font-bold text-xs uppercase tracking-widest">Admin</span>
            </button>
          )}
        </nav>
      </header>

      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-surface border border-white/10 rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3 text-primary">
                <Shield size={24} />
                <h2 className="text-xl font-black tracking-tighter">Acceso Admin</h2>
              </div>
              <button onClick={() => setShowAdminLogin(false)} className="text-gray-500 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Contraseña Maestra</label>
                <input 
                  type="password" 
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-primary/50 transition-colors text-center font-bold text-xl"
                />
              </div>
              <button type="submit" className="w-full bg-primary text-background py-4 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all active:scale-95">
                Entrar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-700">
        {children}
      </main>

      {/* Bottom Navbar for Mobile */}
      <nav className="md:hidden fixed bottom-0 w-full bg-surface/90 backdrop-blur-xl border-t border-white/5 flex justify-around items-center h-20 z-50 pb-safe px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-all duration-300",
                isActive ? "text-primary" : "text-gray-500 hover:text-gray-300"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl transition-all duration-300",
                isActive && "bg-primary/10 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
              )}>
                <Icon size={22} className={cn(isActive && "drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]")} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">{item.name}</span>
            </Link>
          );
        })}
        
          {isAuthenticated ? (
            <button 
              onClick={logout}
              className="flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-all duration-300 text-red-400"
            >
              <div className="p-2 rounded-xl transition-all duration-300 bg-red-500/10">
                <LogOut size={22} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Salir</span>
            </button>
          ) : (
            <button 
              onClick={() => setShowAdminLogin(true)}
              className="flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-all duration-300 text-gray-500"
            >
              <div className="p-2 rounded-xl transition-all duration-300">
                <Shield size={22} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Admin</span>
            </button>
          )}
      </nav>
    </div>
  );
};

export default Layout;
