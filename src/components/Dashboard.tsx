import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Target, TrendingUp, Award, Sun, Moon } from 'lucide-react';
import { StudySession, UserPreferences, StudyStreak } from '../types';
import { storage } from '../utils/storage';
import { getRandomQuote } from '../utils/quotes';
import { useTheme } from '../hooks/useTheme';
import supabase from '../utils/supabase';

interface DashboardProps {
  preferences: UserPreferences;
  onNavigate: (page: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ preferences, onNavigate }) => {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [streak, setStreak] = useState<StudyStreak>({ current: 0, longest: 0, lastStudyDate: '' });
  const [todayProgress, setTodayProgress] = useState(0);
  const [quote, setQuote] = useState('');
  const { theme, toggleTheme } = useTheme();
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const loadedSessions = storage.getStudySessions();
    const loadedStreak = storage.getStudyStreak();
    setSessions(loadedSessions);
    setStreak(loadedStreak);
    setQuote(getRandomQuote());

    // Calculate today's progress
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = loadedSessions.filter(s => s.scheduledDate === today);
    const completed = todaySessions.filter(s => s.completed).length;
    const total = todaySessions.length;
    setTodayProgress(total > 0 ? (completed / total) * 100 : 0);
  }, []);

  useEffect(() => {
    // Fetch current user and set name from metadata if available
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (user) {
        const fullName = (user.user_metadata as any)?.full_name as string | undefined;
        const display = fullName && fullName.trim().length > 0 ? fullName : (user.email ? user.email.split('@')[0] : '');
        setUserName(display);
      } else {
        setUserName('');
      }
    });
  }, []);

  const todaysSessions = sessions.filter(s => s.scheduledDate === new Date().toISOString().split('T')[0]);
  const upcomingSessions = todaysSessions.filter(s => !s.completed).slice(0, 3);

  const stats = [
    {
      label: "Today's Progress",
      value: `${Math.round(todayProgress)}%`,
      icon: Target,
      color: 'bg-blue-500',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      label: "Study Streak",
      value: `${streak.current} days`,
      icon: TrendingUp,
      color: 'bg-green-500',
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      label: "Total Sessions",
      value: sessions.length.toString(),
      icon: Clock,
      color: 'bg-purple-500',
      gradient: 'from-purple-500 to-indigo-500'
    },
    {
      label: "Best Streak",
      value: `${streak.longest} days`,
      icon: Award,
      color: 'bg-orange-500',
      gradient: 'from-orange-500 to-red-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {`Good ${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}${userName ? `, ${userName}` : ''}!`}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">Ready to conquer your goals today?</p>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-yellow-500" />}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Quote Card */}
        <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-8 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">"{quote}"</h2>
            <p className="text-indigo-100">Stay motivated and focused on your journey</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-2xl p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient}`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{stat.value}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Schedule */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Today's Schedule</h3>
              <button
                onClick={() => onNavigate('calendar')}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                View All
              </button>
            </div>

            {upcomingSessions.length > 0 ? (
              <div className="space-y-4">
                {upcomingSessions.map((session) => {
                  const subject = preferences.subjects.find(s => s.id === session.subjectId);
                  return (
                    <div
                      key={session.id}
                      className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-all duration-200"
                      style={{ borderLeftColor: subject?.color, borderLeftWidth: '4px' }}
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{session.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {subject?.name} • {session.startTime} - {session.endTime}
                        </p>
                      </div>
                      <button
                        onClick={() => onNavigate('timer')}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        Start
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">No upcoming sessions for today</p>
                <button
                  onClick={() => onNavigate('calendar')}
                  className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Schedule Study Time
                </button>
              </div>
            )}
          </div>

          {/* Progress Sidebar */}
          <div className="space-y-6">
            {/* Progress Ring */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Today's Progress</h3>
              <div className="relative flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-gray-200 dark:text-gray-700"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={351.86}
                    strokeDashoffset={351.86 - (351.86 * todayProgress) / 100}
                    className="text-blue-500 transition-all duration-1000"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Math.round(todayProgress)}%
                  </span>
                </div>
              </div>
              <p className="text-center text-gray-600 dark:text-gray-400 mt-4">
                {todaysSessions.filter(s => s.completed).length} of {todaysSessions.length} sessions completed
              </p>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => onNavigate('timer')}
                  className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
                >
                  <Clock className="w-5 h-5" />
                  Start Pomodoro
                </button>
                <button
                  onClick={() => onNavigate('calendar')}
                  className="w-full flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Calendar className="w-5 h-5" />
                  View Calendar
                </button>
                <button
                  onClick={() => onNavigate('progress')}
                  className="w-full flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <TrendingUp className="w-5 h-5" />
                  View Progress
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;