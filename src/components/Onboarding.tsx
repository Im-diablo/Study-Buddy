import React, { useState } from 'react';
import { ChevronRight, Plus, X, Calendar, Clock, Target, Sun, Moon } from 'lucide-react';
import { Subject, UserPreferences, Assignment } from '../types';
import { storage } from '../utils/storage';
import supabase from '../utils/supabase';
import { useTheme } from '../hooks/useTheme';

interface OnboardingProps {
  onComplete: () => void;
}

const subjectColors = [
  '#60A5FA', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
];

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [dailyStudyHours, setDailyStudyHours] = useState(4);
  const [studyMethod, setStudyMethod] = useState<'pomodoro' | 'custom'>('pomodoro');
  const [newSubject, setNewSubject] = useState('');
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    subjectId: '',
    deadline: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    estimatedHours: 2
  });
  const { theme, toggleTheme } = useTheme();

  const addSubject = () => {
    if (newSubject.trim()) {
      const subject: Subject = {
        id: `temp-${Date.now()}`,
        name: newSubject.trim(),
        color: subjectColors[subjects.length % subjectColors.length],
        priority: subjects.length + 1
      };
      setSubjects([...subjects, subject]);
      setNewSubject('');
    }
  };

  const removeSubject = (id: string) => {
    setSubjects(subjects.filter(s => s.id !== id));
  };

  const addAssignment = () => {
    if (newAssignment.title.trim() && newAssignment.subjectId) {
      const assignment: Assignment = {
        id: Date.now().toString(),
        ...newAssignment,
        title: newAssignment.title.trim(),
        completed: false
      };
      setAssignments([...assignments, assignment]);
      setNewAssignment({
        title: '',
        subjectId: '',
        deadline: '',
        priority: 'medium',
        estimatedHours: 2
      });
    }
  };

  const completeOnboarding = async () => {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id || '';
    if (userId) {
      storage.setCurrentUserId(userId);
    }

    // 1) Persist subjects to Supabase and map temp IDs to real UUIDs
    let idMap = new Map<string, string>();
    if (userId && subjects.length > 0) {
      const rows = subjects.map(s => ({ user_id: userId, name: s.name, color: s.color, priority: s.priority }));
      const { data: inserted } = await supabase.from('subjects').insert(rows).select();
      if (inserted && inserted.length === subjects.length) {
        // Build map by order
        for (let i = 0; i < subjects.length; i++) {
          idMap.set(subjects[i].id, inserted[i].id);
        }
      }
    }

    // 2) Persist study plan (preferences) to Supabase
    if (userId) {
      await supabase
        .from('study_plans')
        .upsert({
          user_id: userId,
          daily_hours: dailyStudyHours,
          study_method: studyMethod,
          focus_time: 25,
          short_break: 5,
          long_break: 15,
          sessions_until_long_break: 4,
          theme: 'light',
        }, { onConflict: 'user_id' });
    }

    // 3) Insert assignments into plan_tasks using mapped subject IDs
    if (userId && assignments.length > 0) {
      const rows = assignments.map(a => ({
        user_id: userId,
        subject_id: idMap.get(a.subjectId) || a.subjectId,
        title: a.title,
        deadline: a.deadline,
        priority: a.priority,
        estimated_hours: a.estimatedHours,
        completed: a.completed,
      }));
      await supabase.from('plan_tasks').insert(rows);
    }

    // 4) Also keep minimal local preferences to avoid flashes before reload
    const mappedSubjects: Subject[] = subjects.map((s) => ({
      ...s,
      id: idMap.get(s.id) || s.id,
    }));

    const preferences: UserPreferences = {
      subjects: mappedSubjects,
      dailyStudyHours,
      studyMethod,
      pomodoroSettings: {
        focusTime: 25,
        shortBreak: 5,
        longBreak: 15,
        sessionsUntilLongBreak: 4
      },
      theme: 'light'
    };
    storage.setUserPreferences(preferences);

    onComplete();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-white/70 dark:bg-gray-800/70 text-gray-700 dark:text-gray-200 shadow hover:bg-white dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-yellow-500" />}
        </button>
      </div>
      <div className="max-w-2xl w-full">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 transform transition-all duration-300">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
              <span>Step {step} of 4</span>
              <span>{Math.round((step / 4) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>

          {step === 1 && (
            <div className="text-center">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-4">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Welcome to Study Buddy
                </h1>
                <p className="text-gray-600 dark:text-gray-300 text-lg">
                  Let's create your personalized study plan in just a few steps
                </p>
              </div>
              
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
                  What subjects are you studying?
                </h2>
                
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="Add a subject (e.g., Mathematics, History)"
                    className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    onKeyPress={(e) => e.key === 'Enter' && addSubject()}
                  />
                  <button
                    onClick={addSubject}
                    className="px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {subjects.map((subject) => (
                    <div
                      key={subject.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700"
                      style={{ borderLeftColor: subject.color, borderLeftWidth: '4px' }}
                    >
                      <span className="font-medium text-gray-800 dark:text-white">{subject.name}</span>
                      <button
                        onClick={() => removeSubject(subject.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {subjects.length > 0 && (
                  <button
                    onClick={() => setStep(2)}
                    className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 transform hover:scale-105"
                  >
                    Continue
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl mb-4">
                  <Calendar className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Add Your Assignments & Deadlines
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Help us prioritize your study time effectively
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={newAssignment.title}
                    onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                    placeholder="Assignment title"
                    className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                  <select
                    value={newAssignment.subjectId}
                    onChange={(e) => setNewAssignment({ ...newAssignment, subjectId: e.target.value })}
                    className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <input
                    type="date"
                    value={newAssignment.deadline}
                    onChange={(e) => setNewAssignment({ ...newAssignment, deadline: e.target.value })}
                    className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                  <select
                    value={newAssignment.priority}
                    onChange={(e) => setNewAssignment({ ...newAssignment, priority: e.target.value as 'low' | 'medium' | 'high' })}
                    className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  <select
                    value={newAssignment.estimatedHours}
                    onChange={(e) => setNewAssignment({ ...newAssignment, estimatedHours: Number(e.target.value) })}
                    className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value={1}>1 hour</option>
                    <option value={2}>2 hours</option>
                    <option value={4}>4 hours</option>
                    <option value={8}>8 hours</option>
                    <option value={16}>16 hours</option>
                  </select>
                </div>

                <button
                  onClick={addAssignment}
                  disabled={!newAssignment.title || !newAssignment.subjectId}
                  className="w-full px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Add Assignment
                </button>
              </div>

              {assignments.length > 0 && (
                <div className="space-y-3 mb-6">
                  {assignments.map((assignment) => {
                    const subject = subjects.find(s => s.id === assignment.subjectId);
                    return (
                      <div key={assignment.id} className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl dark:bg-gray-700">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-gray-800 dark:text-white">{assignment.title}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {subject?.name} • Due: {new Date(assignment.deadline).toLocaleDateString()} • {assignment.estimatedHours}h
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            assignment.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            assignment.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }`}>
                            {assignment.priority}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-200"
                >
                  Continue
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl mb-4">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Study Preferences
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Let's customize your study approach
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    How many hours can you study per day?
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min="1"
                      max="12"
                      value={dailyStudyHours}
                      onChange={(e) => setDailyStudyHours(Number(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <span className="text-2xl font-bold text-purple-600 dark:text-purple-400 min-w-[3rem]">
                      {dailyStudyHours}h
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Preferred study method
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div
                      onClick={() => setStudyMethod('pomodoro')}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        studyMethod === 'pomodoro'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                      }`}
                    >
                      <h3 className="font-semibold text-gray-800 dark:text-white">Pomodoro Technique</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        25min focus + 5min breaks
                      </p>
                    </div>
                    <div
                      onClick={() => setStudyMethod('custom')}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        studyMethod === 'custom'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                      }`}
                    >
                      <h3 className="font-semibold text-gray-800 dark:text-white">Custom Sessions</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        Flexible study blocks
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-indigo-600 transition-all duration-200"
                >
                  Continue
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-3xl mb-6">
                  <Target className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  You're All Set!
                </h2>
                <p className="text-gray-600 dark:text-gray-300 text-lg mb-6">
                  Your personalized study plan is ready. Let's start achieving your goals!
                </p>
                
                <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-6 mb-8">
                  <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Your Study Setup:</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="text-left">
                      <p className="text-gray-600 dark:text-gray-400">Subjects: <span className="font-medium text-gray-800 dark:text-white">{subjects.length}</span></p>
                      <p className="text-gray-600 dark:text-gray-400">Assignments: <span className="font-medium text-gray-800 dark:text-white">{assignments.length}</span></p>
                    </div>
                    <div className="text-left">
                      <p className="text-gray-600 dark:text-gray-400">Daily Hours: <span className="font-medium text-gray-800 dark:text-white">{dailyStudyHours}h</span></p>
                      <p className="text-gray-600 dark:text-gray-400">Method: <span className="font-medium text-gray-800 dark:text-white">{studyMethod === 'pomodoro' ? 'Pomodoro' : 'Custom'}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-3 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={completeOnboarding}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-lg rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-200 transform hover:scale-105"
                >
                  Start Studying!
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;