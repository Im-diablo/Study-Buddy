import React, { useState, useEffect } from 'react';
import { UserPreferences, Subject } from './types';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import Timer from './components/Timer';
import Calendar from './components/Calendar';
import Progress from './components/Progress';
import Settings from './components/Settings';
import Navigation from './components/Navigation';
import Login from './components/Login';
import supabase from './utils/supabase';
import Notes from './components/Notes';
import { storage } from './utils/storage';

function App() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoadingPrefs, setIsLoadingPrefs] = useState<boolean>(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      setIsAuthenticated(!!session);
      if (session?.user?.id) {
        storage.setCurrentUserId(session.user.id);
        loadPreferences(session.user.id);
      } else {
        setPreferences(null);
        setIsLoadingPrefs(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      if (session?.user?.id) {
        storage.setCurrentUserId(session.user.id);
        loadPreferences(session.user.id);
      } else {
        setPreferences(null);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const loadPreferences = async (userId: string) => {
    setIsLoadingPrefs(true);
    try {
      const [{ data: subj }, { data: plan }] = await Promise.all([
        supabase.from('subjects').select('*').eq('user_id', userId).order('priority', { ascending: true }),
        supabase.from('study_plans').select('*').eq('user_id', userId).limit(1).maybeSingle(),
      ]);

      const subjects: Subject[] = (subj || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        color: row.color || '#60A5FA',
        priority: row.priority ?? 1,
      }));

      if (!plan || subjects.length === 0) {
        // Fallback to locally cached preferences (from onboarding or previous saves)
        const local = storage.getUserPreferences();
        setPreferences(local);
      } else {
        const prefs: UserPreferences = {
          subjects,
          dailyStudyHours: plan.daily_hours ?? 4,
          studyMethod: (plan.study_method as 'pomodoro' | 'custom') || 'pomodoro',
          pomodoroSettings: {
            focusTime: plan.focus_time ?? 25,
            shortBreak: plan.short_break ?? 5,
            longBreak: plan.long_break ?? 15,
            sessionsUntilLongBreak: plan.sessions_until_long_break ?? 4,
          },
          theme: (plan.theme as 'light' | 'dark') || 'light',
        };
        setPreferences(prefs);
        // Cache locally for fast boot
        storage.setUserPreferences(prefs);
      }
    } finally {
      setIsLoadingPrefs(false);
    }
  };

  const handleOnboardingComplete = async () => {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (userId) await loadPreferences(userId);
  };

  const handlePreferencesUpdate = async (newPreferences: UserPreferences) => {
    setPreferences(newPreferences);
  };

  if (!isAuthenticated) {
    return <Login onLoggedIn={() => setCurrentPage('dashboard')} />;
  }

  if (isLoadingPrefs) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors" />;
  }

  if (!preferences) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard preferences={preferences} onNavigate={setCurrentPage} />;
      case 'timer':
        return <Timer preferences={preferences} />;
      case 'calendar':
        return <Calendar preferences={preferences} onNavigate={setCurrentPage} />;
      case 'progress':
        return <Progress preferences={preferences} />;
      case 'notes':
        return <Notes />;
      case 'settings':
        return <Settings preferences={preferences} onPreferencesUpdate={handlePreferencesUpdate} />;
      default:
        return <Dashboard preferences={preferences} onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="md:ml-64 pb-16 md:pb-0">{renderCurrentPage()}</main>
    </div>
  );
}

export default App;