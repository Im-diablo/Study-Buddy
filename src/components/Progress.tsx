import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, Clock, Target, Award, BookOpen, BarChart3, Sun, Moon } from 'lucide-react';
import { StudySession, UserPreferences, StudyStreak, Badge } from '../types';
import { useTheme } from '../hooks/useTheme';
import supabase from '../utils/supabase';

interface ProgressProps {
  preferences: UserPreferences;
}

const Progress: React.FC<ProgressProps> = ({ preferences }) => {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [streak, setStreak] = useState<StudyStreak>({ current: 0, longest: 0, lastStudyDate: '' });
  const [badges, setBadges] = useState<Badge[]>([]);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('week');
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id || '';
      if (!uid) return;

      const { data: sData } = await supabase
        .from('pomodoro_sessions')
        .select('*')
        .eq('user_id', uid);
      const mappedSessions: StudySession[] = (sData || []).map((row: any) => ({
        id: row.id,
        subjectId: row.subject_id,
        title: row.title,
        duration: row.duration,
        completed: row.completed,
        scheduledDate: row.scheduled_date,
        startTime: row.start_time,
        endTime: row.end_time,
        type: row.type,
      }));
      setSessions(mappedSessions);

      const { data: rData } = await supabase
        .from('rewards')
        .select('*')
        .eq('user_id', uid)
        .limit(1)
        .maybeSingle();
      if (rData) {
        setStreak({
          current: rData.current ?? 0,
          longest: rData.longest ?? 0,
          lastStudyDate: rData.last_study_date ?? '',
        });
      }

      // Initialize badges locally if needed
      let currentBadges: Badge[] = badges.length ? badges : initializeBadges();
      const updatedBadges = updateBadges(currentBadges, mappedSessions, streak);
      setBadges(updatedBadges);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeBadges = (): Badge[] => {
    return [
      { id: 'first-session', name: 'Getting Started', description: 'Complete your first study session', icon: '🎯', earned: false },
      { id: 'week-streak', name: 'Week Warrior', description: 'Study for 7 days in a row', icon: '🔥', earned: false },
      { id: 'early-bird', name: 'Early Bird', description: 'Start a session before 8 AM', icon: '🌅', earned: false },
      { id: 'marathon', name: 'Marathon Studier', description: 'Complete a 2-hour study session', icon: '🏃‍♂️', earned: false },
      { id: 'consistent', name: 'Consistency King', description: 'Study every day for a month', icon: '👑', earned: false },
      { id: 'century', name: 'Century Club', description: 'Complete 100 study sessions', icon: '💯', earned: false },
    ];
  };

  const updateBadges = (currentBadges: Badge[], sessions: StudySession[], streak: StudyStreak): Badge[] => {
    return currentBadges.map((badge) => {
      if (badge.earned) return badge;
      let shouldEarn = false;
      const completedSessions = sessions.filter((s) => s.completed);
      switch (badge.id) {
        case 'first-session':
          shouldEarn = completedSessions.length >= 1; break;
        case 'week-streak':
          shouldEarn = streak.current >= 7; break;
        case 'early-bird':
          shouldEarn = completedSessions.some((s) => parseInt(s.startTime.split(':')[0]) < 8); break;
        case 'marathon':
          shouldEarn = completedSessions.some((s) => s.duration >= 120); break;
        case 'consistent':
          shouldEarn = streak.current >= 30; break;
        case 'century':
          shouldEarn = completedSessions.length >= 100; break;
      }
      return shouldEarn ? { ...badge, earned: true, earnedDate: new Date().toISOString() } : badge;
    });
  };

  const getFilteredSessions = () => {
    const now = new Date();
    const startDate = new Date();
    switch (timeframe) {
      case 'week': startDate.setDate(now.getDate() - 7); break;
      case 'month': startDate.setMonth(now.getMonth() - 1); break;
      case 'year': startDate.setFullYear(now.getFullYear() - 1); break;
    }
    return sessions.filter((session) => new Date(session.scheduledDate) >= startDate && session.completed);
  };

  const getSubjectStats = () => {
    const filteredSessions = getFilteredSessions();
    const subjectStats = preferences.subjects.map((subject) => {
      const subjectSessions = filteredSessions.filter((s) => s.subjectId === subject.id);
      const totalTime = subjectSessions.reduce((sum, s) => sum + s.duration, 0);
      const sessionCount = subjectSessions.length;
      return { subject, totalTime, sessionCount, averageTime: sessionCount > 0 ? Math.round(totalTime / sessionCount) : 0 };
    });
    return subjectStats.sort((a, b) => b.totalTime - a.totalTime);
  };

  const getTotalStats = () => {
    const filteredSessions = getFilteredSessions();
    const totalTime = filteredSessions.reduce((sum, s) => sum + s.duration, 0);
    const totalSessions = filteredSessions.length;
    const averagePerDay = timeframe === 'week' ? totalTime / 7 : timeframe === 'month' ? totalTime / 30 : totalTime / 365;
    return { totalTime, totalSessions, averagePerDay: Math.round(averagePerDay), completionRate: sessions.length > 0 ? Math.round((filteredSessions.length / sessions.length) * 100) : 0 };
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const subjectStats = getSubjectStats();
  const totalStats = getTotalStats();
  const earnedBadges = badges.filter((b) => b.earned);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Progress & Analytics</h1>
            <p className="text-gray-600 dark:text-gray-400">Track your study journey and achievements</p>
          </div>
          <button onClick={toggleTheme} className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" aria-label="Toggle theme">
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-yellow-500" />}
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {formatTime(totalStats.totalTime)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Study Time</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {totalStats.totalSessions}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Sessions Completed</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <TrendingUp className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {streak.current}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Day Streak</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {formatTime(totalStats.averagePerDay)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Daily Average</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Subject Breakdown */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Subject Breakdown</h3>
            
            {subjectStats.length > 0 ? (
              <div className="space-y-4">
                {subjectStats.map((stat, index) => {
                  const maxTime = Math.max(...subjectStats.map(s => s.totalTime));
                  const percentage = maxTime > 0 ? (stat.totalTime / maxTime) * 100 : 0;
                  
                  return (
                    <div key={stat.subject.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: stat.subject.color }}
                          />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {stat.subject.name}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {formatTime(stat.totalTime)}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {stat.sessionCount} sessions
                          </div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-1000"
                          style={{ 
                            backgroundColor: stat.subject.color,
                            width: `${percentage}%`
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">No study data available for this period</p>
              </div>
            )}
          </div>

          {/* Achievements & Streak */}
          <div className="space-y-6">
            {/* Study Streak */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Study Streak</h3>
              <div className="text-center">
                <div className="text-4xl mb-2">🔥</div>
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-1">
                  {streak.current}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Current Streak
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-500">
                  Best: {streak.longest} days
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Achievements</h3>
              
              {earnedBadges.length > 0 ? (
                <div className="space-y-3 mb-4">
                  {earnedBadges.slice(0, 3).map(badge => (
                    <div key={badge.id} className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <div className="text-2xl">{badge.icon}</div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {badge.name}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {badge.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Award className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Complete study sessions to earn badges!
                  </p>
                </div>
              )}

              <div className="text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {earnedBadges.length} of {badges.length} badges earned
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                  <div
                    className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${(earnedBadges.length / badges.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Longest Session</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatTime(Math.max(...sessions.map(s => s.duration), 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Sessions</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {sessions.filter(s => s.completed).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Best Streak</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {streak.longest} days
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Progress;