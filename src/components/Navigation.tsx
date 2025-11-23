import React, { useEffect, useState } from 'react';
import { Home, Calendar, Clock, TrendingUp, Settings, User, LogOut, Sun, Moon, StickyNote } from 'lucide-react';
import supabase from '../utils/supabase';
import { storage } from '../utils/storage';
import { useTheme } from '../hooks/useTheme';

interface NavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onNavigate }) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      setIsLoggedIn(!!session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'timer', label: 'Timer', icon: Clock },
    { id: 'progress', label: 'Progress', icon: TrendingUp },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    storage.clearCurrentUserId();
    onNavigate('login');
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col p-6 z-40">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Study Buddy</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Your personal study companion</p>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-yellow-500" />}
          </button>
        </div>
        
        <div className="space-y-2 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon as any;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {isLoggedIn ? (
          <button
            onClick={handleLogout}
            className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        ) : (
          <button
            onClick={() => onNavigate('login')}
            className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <User className="w-5 h-5" />
            Login
          </button>
        )}
      </nav>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 z-40">
        <div className="flex justify-around items-center">
          <button
            onClick={toggleTheme}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-yellow-500" />}
            <span className="text-xs font-medium">Theme</span>
          </button>

          {navItems.map((item) => {
            const Icon = item.icon as any;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'text-blue-500'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}

          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-xs font-medium">Logout</span>
            </button>
          ) : (
            <button
              onClick={() => onNavigate('login')}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400"
            >
              <User className="w-5 h-5" />
              <span className="text-xs font-medium">Login</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
};

export default Navigation;