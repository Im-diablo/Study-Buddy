import { UserPreferences, StudySession, Assignment, StudyStreak, Badge, Note } from '../types';

const STORAGE_KEYS = {
  USER_PREFERENCES: 'study-buddy-preferences',
  STUDY_SESSIONS: 'study-buddy-sessions',
  ASSIGNMENTS: 'study-buddy-assignments',
  STUDY_STREAK: 'study-buddy-streak',
  BADGES: 'study-buddy-badges',
  ONBOARDING_COMPLETE: 'study-buddy-onboarding',
  AUTH: 'study-buddy-auth',
  CURRENT_USER_ID: 'study-buddy-current-user-id',
  NOTES: 'study-buddy-notes',
};

const getScopedKey = (baseKey: string): string => {
  const userId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
  return userId ? `${userId}:${baseKey}` : `guest:${baseKey}`;
};

export const storage = {
  // Current user scoping
  setCurrentUserId(userId: string): void {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, userId);
  },

  getCurrentUserId(): string | null {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
  },

  clearCurrentUserId(): void {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
  },

  // Preferences
  getUserPreferences(): UserPreferences | null {
    const data = localStorage.getItem(getScopedKey(STORAGE_KEYS.USER_PREFERENCES));
    return data ? JSON.parse(data) : null;
  },

  setUserPreferences(preferences: UserPreferences): void {
    localStorage.setItem(getScopedKey(STORAGE_KEYS.USER_PREFERENCES), JSON.stringify(preferences));
  },

  // Study sessions
  getStudySessions(): StudySession[] {
    const data = localStorage.getItem(getScopedKey(STORAGE_KEYS.STUDY_SESSIONS));
    return data ? JSON.parse(data) : [];
  },

  setStudySessions(sessions: StudySession[]): void {
    localStorage.setItem(getScopedKey(STORAGE_KEYS.STUDY_SESSIONS), JSON.stringify(sessions));
  },

  // Assignments
  getAssignments(): Assignment[] {
    const data = localStorage.getItem(getScopedKey(STORAGE_KEYS.ASSIGNMENTS));
    return data ? JSON.parse(data) : [];
  },

  setAssignments(assignments: Assignment[]): void {
    localStorage.setItem(getScopedKey(STORAGE_KEYS.ASSIGNMENTS), JSON.stringify(assignments));
  },

  // Streak
  getStudyStreak(): StudyStreak {
    const data = localStorage.getItem(getScopedKey(STORAGE_KEYS.STUDY_STREAK));
    return data ? JSON.parse(data) : { current: 0, longest: 0, lastStudyDate: '' };
  },

  setStudyStreak(streak: StudyStreak): void {
    localStorage.setItem(getScopedKey(STORAGE_KEYS.STUDY_STREAK), JSON.stringify(streak));
  },

  // Badges
  getBadges(): Badge[] {
    const data = localStorage.getItem(getScopedKey(STORAGE_KEYS.BADGES));
    return data ? JSON.parse(data) : [];
  },

  setBadges(badges: Badge[]): void {
    localStorage.setItem(getScopedKey(STORAGE_KEYS.BADGES), JSON.stringify(badges));
  },

  // Notes
  getNotes(): Note[] {
    const data = localStorage.getItem(getScopedKey(STORAGE_KEYS.NOTES));
    return data ? JSON.parse(data) : [];
  },

  setNotes(notes: Note[]): void {
    localStorage.setItem(getScopedKey(STORAGE_KEYS.NOTES), JSON.stringify(notes));
  },

  // Onboarding
  isOnboardingComplete(): boolean {
    return localStorage.getItem(getScopedKey(STORAGE_KEYS.ONBOARDING_COMPLETE)) === 'true';
  },

  setOnboardingComplete(): void {
    localStorage.setItem(getScopedKey(STORAGE_KEYS.ONBOARDING_COMPLETE), 'true');
  },

  // Simple auth helpers (demo only)
  setAuthUser(auth: { email: string; loggedInAt: string; rememberMe: boolean }): void {
    localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(auth));
  },

  getAuthUser(): { email: string; loggedInAt: string; rememberMe: boolean } | null {
    const data = localStorage.getItem(STORAGE_KEYS.AUTH);
    return data ? JSON.parse(data) : null;
  },

  clearAuthUser(): void {
    localStorage.removeItem(STORAGE_KEYS.AUTH);
  },
};