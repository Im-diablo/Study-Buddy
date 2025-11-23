import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Clock, Coffee, Target, Sun, Moon } from 'lucide-react';
import { UserPreferences, StudySession } from '../types';
import { storage } from '../utils/storage';
import { useTheme } from '../hooks/useTheme';
import supabase from '../utils/supabase';

interface TimerProps {
  preferences: UserPreferences;
}

// Utility helpers
const formatSeconds = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const getTodayIsoDate = (): string => new Date().toISOString().split('T')[0];

const toTimeString = (date: Date): string => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

type Phase = 'focus' | 'shortBreak' | 'longBreak';

type TimerPersistedState = {
  phase: Phase;
  isRunning: boolean;
  customMinutes: number;
  selectedSubjectId: string;
  sessionTitle: string;
  sessionType: 'study' | 'review' | 'practice';
  completedFocusCount: number;
  phaseDurationSeconds: number;
  remainingSeconds: number;
  phaseStartEpochMs: number | null;
  isPomodoro: boolean;
};

const Timer: React.FC<TimerProps> = ({ preferences }) => {
  const hasSubjects = preferences.subjects && preferences.subjects.length > 0;
  const defaultSubjectId = hasSubjects ? preferences.subjects[0].id : '';
  const { theme, toggleTheme } = useTheme();

  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);
  const stateKey = useMemo(() => (userId ? `${userId}:timer-state` : `guest:timer-state`), [userId]);

  // Session config
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(defaultSubjectId);
  const [sessionTitle, setSessionTitle] = useState<string>('Focus Session');
  const [sessionType, setSessionType] = useState<'study' | 'review' | 'practice'>('study');

  // Pomodoro state
  const isPomodoro = preferences.studyMethod === 'pomodoro';
  const focusMinutes = clamp(preferences.pomodoroSettings.focusTime || 25, 1, 180);
  const shortBreakMinutes = clamp(preferences.pomodoroSettings.shortBreak || 5, 1, 60);
  const longBreakMinutes = clamp(preferences.pomodoroSettings.longBreak || 15, 1, 120);
  const sessionsUntilLongBreak = clamp(preferences.pomodoroSettings.sessionsUntilLongBreak || 4, 1, 12);

  const [phase, setPhase] = useState<Phase>('focus');
  const [completedFocusCount, setCompletedFocusCount] = useState<number>(0);

  // Timer engine
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [customMinutes, setCustomMinutes] = useState<number>(25);

  const phaseDurationSeconds = useMemo(() => {
    if (!isPomodoro) return customMinutes * 60;
    if (phase === 'focus') return focusMinutes * 60;
    if (phase === 'shortBreak') return shortBreakMinutes * 60;
    return longBreakMinutes * 60;
  }, [isPomodoro, customMinutes, phase, focusMinutes, shortBreakMinutes, longBreakMinutes]);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(phaseDurationSeconds);

  // Track actual start time of a phase for logging / resume
  const focusStartTimeRef = useRef<Date | null>(null);
  const phaseStartEpochMsRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<number | null>(null);

  // Persist timer state helper
  const persistState = (override?: Partial<TimerPersistedState>) => {
    const state: TimerPersistedState = {
      phase,
      isRunning,
      customMinutes,
      selectedSubjectId,
      sessionTitle,
      sessionType,
      completedFocusCount,
      phaseDurationSeconds,
      remainingSeconds,
      phaseStartEpochMs: phaseStartEpochMsRef.current,
      isPomodoro,
      ...(override || {}),
    };
    try {
      localStorage.setItem(stateKey, JSON.stringify(state));
    } catch {}
  };

  // Recompute remaining based on real time passed
  const recomputeRemaining = () => {
    if (isRunning && phaseStartEpochMsRef.current) {
      const elapsedSec = Math.floor((Date.now() - phaseStartEpochMsRef.current) / 1000);
      const newRemaining = Math.max(0, phaseDurationSeconds - elapsedSec);
      setRemainingSeconds(newRemaining);
      if (newRemaining <= 0) {
        handlePhaseComplete();
      }
    }
  };

  // Restore persisted state on mount or when userId available
  useEffect(() => {
    try {
      const raw = localStorage.getItem(stateKey);
      if (!raw) return;
      const saved: TimerPersistedState = JSON.parse(raw);
      // Restore base fields
      setPhase(saved.phase);
      setIsRunning(saved.isRunning);
      setCustomMinutes(saved.customMinutes);
      setSelectedSubjectId(saved.selectedSubjectId || defaultSubjectId);
      setSessionTitle(saved.sessionTitle || 'Focus Session');
      setSessionType(saved.sessionType || 'study');
      setCompletedFocusCount(saved.completedFocusCount || 0);
      // Restore start epoch and recompute
      phaseStartEpochMsRef.current = saved.phaseStartEpochMs;
      // If restoring a running focus phase, backfill focusStartTimeRef for logging
      if (saved.isRunning && saved.phase === 'focus' && saved.phaseStartEpochMs) {
        focusStartTimeRef.current = new Date(saved.phaseStartEpochMs);
      }
      if (saved.isRunning && saved.phaseStartEpochMs) {
        const elapsed = Math.floor((Date.now() - saved.phaseStartEpochMs) / 1000);
        const dur = saved.phaseDurationSeconds || phaseDurationSeconds;
        const rem = Math.max(0, dur - elapsed);
        setRemainingSeconds(rem);
        if (rem <= 0) {
          handlePhaseComplete();
        }
      } else {
        setRemainingSeconds(saved.remainingSeconds ?? phaseDurationSeconds);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey]);

  // Reset remaining time when phase or configuration changes (and timer is not actively running)
  useEffect(() => {
    if (!isRunning) {
      setRemainingSeconds(phaseDurationSeconds);
      persistState({ phaseDurationSeconds, remainingSeconds: phaseDurationSeconds });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseDurationSeconds, isRunning]);

  // Interval management
  useEffect(() => {
    if (!isRunning) {
      if (tickIntervalRef.current !== null) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      persistState();
      return;
    }

    // Start focus startTime and phase epoch when entering running phase
    if (!phaseStartEpochMsRef.current) {
      // If resuming from a pause, align start so remaining matches
      const assumedStart = Date.now() - (phaseDurationSeconds - remainingSeconds) * 1000;
      phaseStartEpochMsRef.current = assumedStart;
      if (phase === 'focus' && !focusStartTimeRef.current) {
        focusStartTimeRef.current = new Date(assumedStart);
      }
    }

    tickIntervalRef.current = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        const elapsedSec = Math.floor((Date.now() - (phaseStartEpochMsRef.current || Date.now())) / 1000);
        const newRemaining = Math.max(0, phaseDurationSeconds - elapsedSec);
        if (newRemaining <= 0) {
          window.clearInterval(tickIntervalRef.current!);
          tickIntervalRef.current = null;
          handlePhaseComplete();
          persistState({ remainingSeconds: 0 });
          return 0;
        }
        persistState({ remainingSeconds: newRemaining });
        return newRemaining;
      });
    }, 1000);

    return () => {
      if (tickIntervalRef.current !== null) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, phase, phaseDurationSeconds]);

  // Recompute when tab becomes visible again
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        recomputeRemaining();
      }
    };
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, phaseDurationSeconds]);

  const handleStartPause = () => {
    setIsRunning((prev) => {
      const next = !prev;
      if (next) {
        // starting/resuming
        if (!phaseStartEpochMsRef.current) {
          const assumedStart = Date.now() - (phaseDurationSeconds - remainingSeconds) * 1000;
          phaseStartEpochMsRef.current = assumedStart;
          if (phase === 'focus' && !focusStartTimeRef.current) {
            focusStartTimeRef.current = new Date(assumedStart);
          }
        }
      }
      persistState({ isRunning: next });
      return next;
    });
  };

  const handleReset = () => {
    setIsRunning(false);
    setRemainingSeconds(phaseDurationSeconds);
    phaseStartEpochMsRef.current = null;
    if (phase === 'focus') {
      focusStartTimeRef.current = null;
    }
    persistState({ isRunning: false, remainingSeconds: phaseDurationSeconds, phaseStartEpochMs: null });
  };

  const logCompletedFocusSession = async (actualFocusMinutes: number) => {
    if (!hasSubjects) return;

    const endTime = new Date();
    let startTime: Date;

    if (focusStartTimeRef.current) {
      startTime = focusStartTimeRef.current;
    } else {
      startTime = new Date(endTime.getTime() - actualFocusMinutes * 60 * 1000);
    }

    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;

      // Insert completed session
      await supabase.from('pomodoro_sessions').insert({
        user_id: userId,
        subject_id: selectedSubjectId,
        title: sessionTitle.trim() || 'Focus Session',
        duration: actualFocusMinutes,
        completed: true,
        scheduled_date: getTodayIsoDate(),
        start_time: toTimeString(startTime),
        end_time: toTimeString(endTime),
        type: sessionType,
      });

      // Update streaks table if present (best-effort)
      const today = getTodayIsoDate();
      const { data: streakRows } = await supabase
        .from('rewards')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (streakRows) {
        const lastDate = streakRows.last_study_date as string | null;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yIso = yesterday.toISOString().split('T')[0];

        const newCurrent = lastDate === yIso ? (streakRows.current ?? 0) + 1 : 1;
        const newLongest = Math.max(streakRows.longest ?? 0, newCurrent);

        await supabase
          .from('rewards')
          .update({ current: newCurrent, longest: newLongest, last_study_date: today })
          .eq('user_id', userId);
      } else {
        await supabase
          .from('rewards')
          .insert({ user_id: userId, current: 1, longest: 1, last_study_date: today });
      }
    } catch (e) {
      // no-op
    }
  };

  const handlePhaseComplete = () => {
    const secondsUsed = phaseDurationSeconds;

    if (phase === 'focus') {
      const usedMinutes = Math.round(secondsUsed / 60);
      logCompletedFocusSession(usedMinutes);
      setCompletedFocusCount((c) => c + 1);
      focusStartTimeRef.current = null;

      // Transition to break
      const shouldLongBreak = (completedFocusCount + 1) % sessionsUntilLongBreak === 0;
      const nextPhase: Phase = shouldLongBreak ? 'longBreak' : 'shortBreak';
      setPhase(nextPhase);
      setIsRunning(false); // pause after transition; user can start the break manually
      phaseStartEpochMsRef.current = null;
      persistState({ phase: nextPhase, isRunning: false, phaseStartEpochMs: null, remainingSeconds: (shouldLongBreak ? longBreakMinutes : shortBreakMinutes) * 60 });
    } else {
      // Break finished -> go back to focus
      setPhase('focus');
      setIsRunning(false);
      phaseStartEpochMsRef.current = null;
      persistState({ phase: 'focus', isRunning: false, phaseStartEpochMs: null, remainingSeconds: focusMinutes * 60 });
    }
  };

  const subjectName = useMemo(() => {
    const subject = preferences.subjects.find((s) => s.id === selectedSubjectId);
    return subject?.name || 'Subject';
  }, [preferences.subjects, selectedSubjectId]);

  const currentMinutesPlanned = useMemo(() => Math.round(phaseDurationSeconds / 60), [phaseDurationSeconds]);
  const progressPercent = useMemo(() => {
    if (phaseDurationSeconds === 0) return 0;
    return Math.round(((phaseDurationSeconds - remainingSeconds) / phaseDurationSeconds) * 100);
  }, [phaseDurationSeconds, remainingSeconds]);

  // Persist on significant state changes
  useEffect(() => {
    persistState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isRunning, customMinutes, selectedSubjectId, sessionTitle, sessionType, completedFocusCount]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors md:ml-64">
      <div className="max-w-3xl mx_auto p-6">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Timer</h1>
            <p className="text-gray-600 dark:text-gray-400">Stay focused and track your sessions</p>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-yellow-500" />}
          </button>
        </div>

        {/* Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Subject</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                disabled={!hasSubjects}
              >
                {preferences.subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title</label>
              <input
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder={`e.g., ${subjectName} Practice`}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value as 'study' | 'review' | 'practice')}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="study">Study</option>
                <option value="review">Review</option>
                <option value="practice">Practice</option>
              </select>
            </div>
          </div>

          {/* Method specific settings */}
          {!isPomodoro && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Custom Minutes</label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(clamp(Number(e.target.value || 0), 5, 180))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          )}

          {isPomodoro && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Clock className="w-4 h-4" /> Focus: {focusMinutes}m
              </div>
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Coffee className="w-4 h-4" /> Short Break: {shortBreakMinutes}m
              </div>
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Coffee className="w-4 h-4" /> Long Break: {longBreakMinutes}m
              </div>
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Target className="w-4 h-4" /> Long Break Every {sessionsUntilLongBreak}
              </div>
            </div>
          )}
        </div>

        {/* Timer Display */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {isPomodoro ? (
                <span>
                  Phase: <span className="font-semibold text-gray-900 dark:text-white">{phase === 'focus' ? 'Focus' : phase === 'shortBreak' ? 'Short Break' : 'Long Break'}</span>
                  {phase === 'focus' && (
                    <span className="ml-2 text-gray-500">(#{completedFocusCount % sessionsUntilLongBreak + 1} of {sessionsUntilLongBreak})</span>
                  )}
                </span>
              ) : (
                <span>Custom Session</span>
              )}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Planned: {currentMinutesPlanned}m</div>
          </div>

          <div className="flex items-center justify-center">
            <div className="relative">
              <svg className="w-64 h-64 transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-200 dark:text-gray-700" />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={Math.PI * 2 * 45}
                  strokeDashoffset={(Math.PI * 2 * 45) * (1 - progressPercent / 100)}
                  className="text-blue-500 transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-5xl font-bold text-gray-900 dark:text-white">{formatSeconds(remainingSeconds)}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subjectName}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={handleStartPause}
              disabled={!hasSubjects}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold transition-colors ${
                isRunning ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'
              } ${!hasSubjects ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              {isRunning ? 'Pause' : 'Start'}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200"
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </button>
          </div>

          {!hasSubjects && (
            <p className="text-center text-sm text-red-600 dark:text-red-400 mt-4">
              Please add at least one subject in Settings to start a session.
            </p>
          )}
        </div>

        {/* Tips */}
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          Completed focus sessions are automatically saved to your Progress and count toward your streak.
        </div>
      </div>
    </div>
  );
};

export default Timer;