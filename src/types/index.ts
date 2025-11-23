export interface Subject {
  id: string;
  name: string;
  color: string;
  priority: number;
}

export interface StudySession {
  id: string;
  subjectId: string;
  title: string;
  duration: number; // in minutes
  completed: boolean;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  type: 'study' | 'review' | 'practice';
}

export interface UserPreferences {
  subjects: Subject[];
  dailyStudyHours: number;
  studyMethod: 'pomodoro' | 'custom';
  pomodoroSettings: {
    focusTime: number;
    shortBreak: number;
    longBreak: number;
    sessionsUntilLongBreak: number;
  };
  theme: 'light' | 'dark';
}

export interface Assignment {
  id: string;
  subjectId: string;
  title: string;
  deadline: string;
  priority: 'low' | 'medium' | 'high';
  estimatedHours: number;
  completed: boolean;
}

export interface StudyStreak {
  current: number;
  longest: number;
  lastStudyDate: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedDate?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  tags?: string[];
}