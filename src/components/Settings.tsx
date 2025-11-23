import React, { useState } from 'react';
import { Save, Download, Upload, Trash2, Sun, Moon, Bell, Volume2 } from 'lucide-react';
import { UserPreferences, Subject } from '../types';
import { storage } from '../utils/storage';
import { useTheme } from '../hooks/useTheme';
import supabase from '../utils/supabase';
import UserProfile from './UserProfile';

interface SettingsProps {
  preferences: UserPreferences;
  onPreferencesUpdate: (preferences: UserPreferences) => void;
}

const Settings: React.FC<SettingsProps> = ({ preferences, onPreferencesUpdate }) => {
  const [localPreferences, setLocalPreferences] = useState<UserPreferences>(preferences);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [isBusy, setIsBusy] = useState(false);

  const handleSave = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      alert('Not authenticated');
      return;
    }

    await supabase
      .from('study_plans')
      .upsert(
        {
          user_id: userId,
          daily_hours: localPreferences.dailyStudyHours,
          study_method: localPreferences.studyMethod,
          focus_time: localPreferences.pomodoroSettings.focusTime,
          short_break: localPreferences.pomodoroSettings.shortBreak,
          long_break: localPreferences.pomodoroSettings.longBreak,
          sessions_until_long_break: localPreferences.pomodoroSettings.sessionsUntilLongBreak,
          theme: theme,
        },
        { onConflict: 'user_id' }
      );

    const { data: existing } = await supabase
      .from('subjects')
      .select('id')
      .eq('user_id', userId);

    const existingIds = new Set((existing || []).map((r: any) => r.id as string));
    const currentIds = new Set(localPreferences.subjects.map((s) => s.id));

    const toDelete = Array.from(existingIds).filter((id) => !currentIds.has(id));
    if (toDelete.length > 0) {
      await supabase.from('subjects').delete().in('id', toDelete).eq('user_id', userId);
    }

    const upsertRows = localPreferences.subjects.map((s) => {
      const row: any = {
        user_id: userId,
        name: s.name,
        color: s.color,
        priority: s.priority,
      };
      if (s.id && s.id.length >= 8 && existingIds.has(s.id)) row.id = s.id;
      return row;
    });
    await supabase.from('subjects').upsert(upsertRows, { onConflict: 'id' });

    const [{ data: subj }, { data: plan }] = await Promise.all([
      supabase.from('subjects').select('*').eq('user_id', userId).order('priority', { ascending: true }),
      supabase.from('study_plans').select('*').eq('user_id', userId).limit(1).maybeSingle(),
    ]);

    const syncedSubjects: Subject[] = (subj || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      color: row.color || '#60A5FA',
      priority: row.priority ?? 1,
    }));

    const updated: UserPreferences = {
      subjects: syncedSubjects,
      dailyStudyHours: plan?.daily_hours ?? localPreferences.dailyStudyHours,
      studyMethod: (plan?.study_method as 'pomodoro' | 'custom') ?? localPreferences.studyMethod,
      pomodoroSettings: {
        focusTime: plan?.focus_time ?? localPreferences.pomodoroSettings.focusTime,
        shortBreak: plan?.short_break ?? localPreferences.pomodoroSettings.shortBreak,
        longBreak: plan?.long_break ?? localPreferences.pomodoroSettings.longBreak,
        sessionsUntilLongBreak: plan?.sessions_until_long_break ?? localPreferences.pomodoroSettings.sessionsUntilLongBreak,
      },
      theme: theme,
    };

    storage.setUserPreferences(updated);
    onPreferencesUpdate(updated);
    alert('Settings saved');
  };

  const handleSubjectUpdate = (index: number, field: keyof Subject, value: string | number) => {
    const updatedSubjects = [...localPreferences.subjects];
    updatedSubjects[index] = { ...updatedSubjects[index], [field]: value } as Subject;
    setLocalPreferences({ ...localPreferences, subjects: updatedSubjects });
  };

  const addSubject = () => {
    const newSubject: Subject = {
      id: `temp-${Date.now()}`,
      name: 'New Subject',
      color: '#60A5FA',
      priority: localPreferences.subjects.length + 1,
    };
    setLocalPreferences({
      ...localPreferences,
      subjects: [...localPreferences.subjects, newSubject],
    });
  };

  const removeSubject = (index: number) => {
    const updatedSubjects = localPreferences.subjects.filter((_, i) => i !== index);
    setLocalPreferences({ ...localPreferences, subjects: updatedSubjects });
  };

  const exportCloudData = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return alert('Not authenticated');

    setIsBusy(true);
    try {
      const [subjects, studyPlan, assignments, sessions, rewards, notes] = await Promise.all([
        supabase.from('subjects').select('*').eq('user_id', userId),
        supabase.from('study_plans').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('plan_tasks').select('*').eq('user_id', userId),
        supabase.from('pomodoro_sessions').select('*').eq('user_id', userId),
        supabase.from('rewards').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('notes').select('*').eq('user_id', userId),
      ]);

      const payload = {
        subjects: subjects.data || [],
        studyPlan: studyPlan.data || null,
        assignments: assignments.data || [],
        sessions: sessions.data || [],
        rewards: rewards.data || null,
        notes: notes.data || [],
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `study-buddy-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsBusy(false);
    }
  };

  const importCloudData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return alert('Not authenticated');

    setIsBusy(true);
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      // Wipe existing user data
      await Promise.all([
        supabase.from('plan_tasks').delete().eq('user_id', userId),
        supabase.from('pomodoro_sessions').delete().eq('user_id', userId),
        supabase.from('notes').delete().eq('user_id', userId),
        supabase.from('subjects').delete().eq('user_id', userId),
        supabase.from('rewards').delete().eq('user_id', userId),
        supabase.from('study_plans').delete().eq('user_id', userId),
      ]);

      // Insert subjects first and map ids
      const subj = Array.isArray(data.subjects) ? data.subjects : [];
      let idMap = new Map<string, string>();
      if (subj.length > 0) {
        const rows = subj.map((s: any, idx: number) => ({
          user_id: userId,
          name: s.name,
          color: s.color || '#60A5FA',
          priority: s.priority ?? idx + 1,
        }));
        const { data: inserted } = await supabase.from('subjects').insert(rows).select();
        if (inserted) {
          for (let i = 0; i < subj.length; i++) {
            idMap.set(subj[i].id || String(i), inserted[i].id);
          }
        }
      }

      // study plan
      if (data.studyPlan) {
        const p = data.studyPlan;
        await supabase.from('study_plans').upsert({
          user_id: userId,
          daily_hours: p.daily_hours ?? 4,
          study_method: p.study_method ?? 'pomodoro',
          focus_time: p.focus_time ?? 25,
          short_break: p.short_break ?? 5,
          long_break: p.long_break ?? 15,
          sessions_until_long_break: p.sessions_until_long_break ?? 4,
          theme: p.theme ?? 'light',
        }, { onConflict: 'user_id' });
      }

      // assignments
      const assigns = Array.isArray(data.assignments) ? data.assignments : [];
      if (assigns.length > 0) {
        const rows = assigns.map((a: any) => ({
          user_id: userId,
          subject_id: idMap.get(a.subject_id) || idMap.get(a.subjectId) || null,
          title: a.title,
          deadline: a.deadline,
          priority: a.priority ?? 'medium',
          estimated_hours: a.estimated_hours ?? a.estimatedHours ?? 2,
          completed: !!(a.completed),
        }));
        await supabase.from('plan_tasks').insert(rows);
      }

      // sessions
      const sess = Array.isArray(data.sessions) ? data.sessions : [];
      if (sess.length > 0) {
        const rows = sess.map((s: any) => ({
          user_id: userId,
          subject_id: idMap.get(s.subject_id) || idMap.get(s.subjectId) || null,
          title: s.title,
          duration: s.duration ?? 25,
          completed: !!(s.completed),
          scheduled_date: s.scheduled_date ?? s.scheduledDate,
          start_time: s.start_time ?? s.startTime,
          end_time: s.end_time ?? s.endTime,
          type: s.type ?? 'study',
        }));
        await supabase.from('pomodoro_sessions').insert(rows);
      }

      // rewards
      if (data.rewards) {
        const r = data.rewards;
        await supabase.from('rewards').upsert({
          user_id: userId,
          current: r.current ?? 0,
          longest: r.longest ?? 0,
          last_study_date: r.last_study_date ?? r.lastStudyDate ?? null,
        }, { onConflict: 'user_id' });
      }

      // notes
      const nts = Array.isArray(data.notes) ? data.notes : [];
      if (nts.length > 0) {
        const rows = nts.map((n: any) => ({
          user_id: userId,
          title: n.title ?? '',
          content: n.content ?? '',
          pinned: !!(n.pinned),
          tags: Array.isArray(n.tags) ? n.tags : [],
        }));
        await supabase.from('notes').insert(rows);
      }

      alert('Import complete');
    } catch (e) {
      alert('Import failed. Please verify the file format.');
    } finally {
      setIsBusy(false);
      event.target.value = '';
    }
  };

  const resetAllData = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;

    setIsBusy(true);
    try {
      await Promise.all([
        supabase.from('plan_tasks').delete().eq('user_id', userId),
        supabase.from('pomodoro_sessions').delete().eq('user_id', userId),
        supabase.from('notes').delete().eq('user_id', userId),
        supabase.from('subjects').delete().eq('user_id', userId),
        supabase.from('rewards').delete().eq('user_id', userId),
        supabase.from('study_plans').delete().eq('user_id', userId),
      ]);

      localStorage.clear();
      window.location.reload();
    } finally {
      setIsBusy(false);
    }
  };

  const subjectColors = [
    '#60A5FA', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors md:ml-64">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Customize your study experience</p>
        </div>

        <div className="space-y-8">
          {/* User Profile */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">User Profile</h2>
            <UserProfile />
          </div>

          {/* Appearance */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Appearance</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Theme</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Choose your preferred theme</p>
                </div>
                <button onClick={toggleTheme} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-yellow-500" />}
                  {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                </button>
              </div>
            </div>
          </div>

          {/* Study Preferences */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Study Preferences</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Daily Study Hours: {localPreferences.dailyStudyHours}h</label>
                <input type="range" min="1" max="12" value={localPreferences.dailyStudyHours} onChange={(e) => setLocalPreferences({ ...localPreferences, dailyStudyHours: Number(e.target.value) })} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Study Method</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div onClick={() => setLocalPreferences({ ...localPreferences, studyMethod: 'pomodoro' })} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${localPreferences.studyMethod === 'pomodoro' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'}`}>
                    <h3 className="font-semibold text-gray-800 dark:text-white">Pomodoro Technique</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">25min focus + 5min breaks</p>
                  </div>
                  <div onClick={() => setLocalPreferences({ ...localPreferences, studyMethod: 'custom' })} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${localPreferences.studyMethod === 'custom' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'}`}>
                    <h3 className="font-semibold text-gray-800 dark:text-white">Custom Sessions</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Flexible study blocks</p>
                  </div>
                </div>
              </div>

              {localPreferences.studyMethod === 'pomodoro' && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Pomodoro Settings</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Focus Time (min)</label>
                      <input type="number" min="15" max="60" value={localPreferences.pomodoroSettings.focusTime} onChange={(e) => setLocalPreferences({ ...localPreferences, pomodoroSettings: { ...localPreferences.pomodoroSettings, focusTime: Number(e.target.value) } })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-600 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Short Break (min)</label>
                      <input type="number" min="3" max="15" value={localPreferences.pomodoroSettings.shortBreak} onChange={(e) => setLocalPreferences({ ...localPreferences, pomodoroSettings: { ...localPreferences.pomodoroSettings, shortBreak: Number(e.target.value) } })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-600 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Long Break (min)</label>
                      <input type="number" min="15" max="30" value={localPreferences.pomodoroSettings.longBreak} onChange={(e) => setLocalPreferences({ ...localPreferences, pomodoroSettings: { ...localPreferences.pomodoroSettings, longBreak: Number(e.target.value) } })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-600 dark:text-white" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Subjects */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Subjects</h2>
              <button onClick={addSubject} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">Add Subject</button>
            </div>
            <div className="space-y-4">
              {localPreferences.subjects.map((subject, index) => (
                <div key={subject.id} className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <input type="text" value={subject.name} onChange={(e) => handleSubjectUpdate(index, 'name', e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white" />
                  <div className="flex gap-2">
                    {subjectColors.map((color) => (
                      <button key={color} onClick={() => handleSubjectUpdate(index, 'color', color)} className={`w-8 h-8 rounded-full border-2 ${subject.color === color ? 'border-gray-900 dark:border-white' : 'border-gray-300'}`} style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <button onClick={() => removeSubject(index)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Data Management */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Data Management</h2>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={exportCloudData} disabled={isBusy} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-60">
                  <Download className="w-4 h-4" />
                  Export Data
                </button>
                <label className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer disabled:opacity-60">
                  <Upload className="w-4 h-4" />
                  Import Data
                  <input type="file" accept=".json" onChange={importCloudData} className="hidden" />
                </label>
                <button onClick={() => setShowResetConfirm(true)} disabled={isBusy} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-60">
                  <Trash2 className="w-4 h-4" />
                  Reset All Data
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Export a full backup of your cloud data. Import will replace your current cloud data with the file contents.</p>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button onClick={handleSave} disabled={isBusy} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 disabled:opacity-60">
              <Save className="w-5 h-5" />
              Save Changes
            </button>
          </div>
        </div>

        {/* Reset Confirmation Modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Reset All Data</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">This will delete all your cloud data (subjects, study plans, assignments, sessions, notes, rewards) and clear local cache. This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowResetConfirm(false)} className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                <button onClick={resetAllData} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Reset All Data</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;