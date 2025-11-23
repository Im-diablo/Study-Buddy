import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock, CheckCircle, Circle, Sun, Moon } from 'lucide-react';
import { StudySession, UserPreferences, Assignment } from '../types';
import { useTheme } from '../hooks/useTheme';
import supabase from '../utils/supabase';

interface CalendarProps {
  preferences: UserPreferences;
  onNavigate: (page: string) => void;
}

const Calendar: React.FC<CalendarProps> = ({ preferences, onNavigate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showAddSession, setShowAddSession] = useState(false);
  const [newSession, setNewSession] = useState({
    subjectId: preferences.subjects[0]?.id || '',
    title: '',
    duration: 25,
    startTime: '09:00',
    type: 'study' as 'study' | 'review' | 'practice'
  });
  const { theme, toggleTheme } = useTheme();
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id || '';
      setUserId(uid);
      if (uid) {
        await Promise.all([loadSessions(uid), loadAssignments(uid)]);
      }
    });
  }, []);

  const loadSessions = async (uid: string) => {
    const { data, error } = await supabase
      .from('pomodoro_sessions')
      .select('*')
      .eq('user_id', uid);
    if (!error && data) {
      const mapped: StudySession[] = data.map((row: any) => ({
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
      setSessions(mapped);
    }
  };

  const loadAssignments = async (uid: string) => {
    const { data, error } = await supabase
      .from('plan_tasks')
      .select('*')
      .eq('user_id', uid);
    if (!error && data) {
      const mapped: Assignment[] = data.map((row: any) => ({
        id: row.id,
        subjectId: row.subject_id,
        title: row.title,
        deadline: row.deadline,
        priority: row.priority,
        estimatedHours: row.estimated_hours,
        completed: row.completed,
      }));
      setAssignments(mapped);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [] as (Date | null)[];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(new Date(year, month, day));
    return days;
  };

  const getSessionsForDate = (date: string) => sessions.filter(session => session.scheduledDate === date);
  const getAssignmentsForDate = (date: string) => assignments.filter(assignment => assignment.deadline === date);

  const addSession = async () => {
    if (!newSession.title.trim() || !userId) return;

    const { data, error } = await supabase
      .from('pomodoro_sessions')
      .insert({
        user_id: userId,
        subject_id: newSession.subjectId,
        title: newSession.title.trim(),
        duration: newSession.duration,
        completed: false,
        scheduled_date: selectedDate,
        start_time: newSession.startTime,
        end_time: calculateEndTime(newSession.startTime, newSession.duration),
        type: newSession.type,
      })
      .select()
      .single();

    if (!error && data) {
      const inserted: StudySession = {
        id: data.id,
        subjectId: data.subject_id,
        title: data.title,
        duration: data.duration,
        completed: data.completed,
        scheduledDate: data.scheduled_date,
        startTime: data.start_time,
        endTime: data.end_time,
        type: data.type,
      };
      setSessions(prev => [...prev, inserted]);
      setNewSession({
        subjectId: preferences.subjects[0]?.id || '',
        title: '',
        duration: 25,
        startTime: '09:00',
        type: 'study'
      });
      setShowAddSession(false);
    }
  };

  const calculateEndTime = (startTime: string, duration: number): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + duration;
    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
  };

  const toggleSessionComplete = async (sessionId: string) => {
    if (!userId) return;
    const current = sessions.find(s => s.id === sessionId);
    if (!current) return;

    const { data, error } = await supabase
      .from('pomodoro_sessions')
      .update({ completed: !current.completed })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (!error && data) {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, completed: data.completed } : s));
    }
  };

  const days = getDaysInMonth(currentDate);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const selectedDateSessions = getSessionsForDate(selectedDate);
  const selectedDateAssignments = getAssignmentsForDate(selectedDate);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Study Calendar</h1>
            <p className="text-gray-600 dark:text-gray-400">Plan and track your study sessions</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-yellow-500" />}
            </button>
            <button
              onClick={() => setShowAddSession(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
            >
              <Plus className="w-5 h-5" />
              Add Session
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigateMonth('prev')}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={() => navigateMonth('next')}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map(day => (
                  <div key={day} className="p-3 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, index) => {
                  if (!day) {
                    return <div key={index} className="p-3 h-24" />;
                  }

                  const dateString = day.toISOString().split('T')[0];
                  const daySessions = getSessionsForDate(dateString);
                  const dayAssignments = getAssignmentsForDate(dateString);
                  const isSelected = dateString === selectedDate;
                  const isToday = dateString === new Date().toISOString().split('T')[0];

                  return (
                    <div
                      key={day.getDate()}
                      onClick={() => setSelectedDate(dateString)}
                      className={`p-2 h-24 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : ''
                      } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      <div className={`text-sm font-medium mb-1 ${
                        isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                      }`}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-1">
                        {daySessions.slice(0, 2).map(session => {
                          const subject = preferences.subjects.find(s => s.id === session.subjectId);
                          return (
                            <div
                              key={session.id}
                              className="text-xs px-1 py-0.5 rounded text-white truncate"
                              style={{ backgroundColor: subject?.color }}
                            >
                              {session.title}
                            </div>
                          );
                        })}
                        {dayAssignments.slice(0, 1).map(assignment => (
                          <div
                            key={assignment.id}
                            className="text-xs px-1 py-0.5 rounded bg-red-500 text-white truncate"
                          >
                            Due: {assignment.title}
                          </div>
                        ))}
                        {(daySessions.length + dayAssignments.length) > 3 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            +{(daySessions.length + dayAssignments.length) - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Selected Date Details */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {new Date(selectedDate).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h3>

              {/* Sessions */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Study Sessions</h4>
                {selectedDateSessions.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDateSessions.map(session => {
                      const subject = preferences.subjects.find(s => s.id === session.subjectId);
                      return (
                        <div
                          key={session.id}
                          className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <button
                            onClick={() => toggleSessionComplete(session.id)}
                            className="flex-shrink-0"
                          >
                            {session.completed ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                              <Circle className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: subject?.color }}
                              />
                              <span className={`font-medium ${
                                session.completed ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'
                              }`}>
                                {session.title}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {session.startTime} - {session.endTime} • {session.duration}min
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No sessions scheduled</p>
                )}
              </div>

              {/* Assignments Due */}
              {selectedDateAssignments.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Assignments Due</h4>
                  <div className="space-y-2">
                    {selectedDateAssignments.map(assignment => {
                      const subject = preferences.subjects.find(s => s.id === assignment.subjectId);
                      return (
                        <div
                          key={assignment.id}
                          className="p-3 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: subject?.color }}
                            />
                            <span className="font-medium text-red-800 dark:text-red-200">
                              {assignment.title}
                            </span>
                          </div>
                          <div className="text-sm text-red-600 dark:text-red-400">
                            {subject?.name} • {assignment.priority} priority
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => onNavigate('timer')}
                  className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
                >
                  <Clock className="w-5 h-5" />
                  Start Study Session
                </button>
                <button
                  onClick={() => setShowAddSession(true)}
                  className="w-full flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Schedule Session
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Add Session Modal */}
        {showAddSession && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Study Session</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Subject
                  </label>
                  <select
                    value={newSession.subjectId}
                    onChange={(e) => setNewSession({ ...newSession, subjectId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    {preferences.subjects.map(subject => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Session Title
                  </label>
                  <input
                    type="text"
                    value={newSession.title}
                    onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                    placeholder="e.g., Chapter 5 Review"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={newSession.startTime}
                      onChange={(e) => setNewSession({ ...newSession, startTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Duration (min)
                    </label>
                    <select
                      value={newSession.duration}
                      onChange={(e) => setNewSession({ ...newSession, duration: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value={25}>25 min</option>
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>60 min</option>
                      <option value={90}>90 min</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Session Type
                  </label>
                  <select
                    value={newSession.type}
                    onChange={(e) => setNewSession({ ...newSession, type: e.target.value as 'study' | 'review' | 'practice' })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="study">Study</option>
                    <option value="review">Review</option>
                    <option value="practice">Practice</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddSession(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addSession}
                  disabled={!newSession.title.trim()}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Add Session
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Calendar;