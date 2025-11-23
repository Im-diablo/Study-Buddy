# Study Buddy - Personal Study Management App

A comprehensive React-based study management application with user authentication, progress tracking, and productivity features.

## Features

- **User Authentication**: Secure login/signup with Supabase
- **Study Timer**: Pomodoro technique with customizable intervals
- **Subject Management**: Organize studies by subjects with priorities
- **Progress Tracking**: Visual progress charts and study streaks
- **Calendar Integration**: Schedule and track study sessions
- **Notes System**: Create and manage study notes
- **Dark/Light Theme**: Toggle between themes
- **Responsive Design**: Works on desktop and mobile

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Backend**: Supabase (Authentication + Database)
- **State Management**: React Hooks

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Study_Buddy-main
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Set up Supabase database (see Database Setup section)

5. Start the development server:
```bash
npm run dev
```

## Database Setup

### Required Tables

Execute these SQL commands in your Supabase SQL editor:

```sql
-- Enable Row Level Security
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subjects table
CREATE TABLE public.subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#60A5FA',
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Study plans table
CREATE TABLE public.study_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  daily_hours INTEGER DEFAULT 4,
  study_method TEXT DEFAULT 'pomodoro',
  focus_time INTEGER DEFAULT 25,
  short_break INTEGER DEFAULT 5,
  long_break INTEGER DEFAULT 15,
  sessions_until_long_break INTEGER DEFAULT 4,
  theme TEXT DEFAULT 'light',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Study sessions table
CREATE TABLE public.study_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration INTEGER NOT NULL, -- in minutes
  completed BOOLEAN DEFAULT FALSE,
  scheduled_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  session_type TEXT DEFAULT 'study', -- 'study', 'review', 'practice'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assignments table
CREATE TABLE public.assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  deadline DATE NOT NULL,
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  estimated_hours INTEGER DEFAULT 1,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notes table
CREATE TABLE public.notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  pinned BOOLEAN DEFAULT FALSE,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Study streaks table
CREATE TABLE public.study_streaks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_study_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Badges table
CREATE TABLE public.badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  earned BOOLEAN DEFAULT FALSE,
  earned_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row Level Security Policies

```sql
-- Users policies
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Subjects policies
CREATE POLICY "Users can manage own subjects" ON public.subjects
  FOR ALL USING (auth.uid() = user_id);

-- Study plans policies
CREATE POLICY "Users can manage own study plans" ON public.study_plans
  FOR ALL USING (auth.uid() = user_id);

-- Study sessions policies
CREATE POLICY "Users can manage own study sessions" ON public.study_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Assignments policies
CREATE POLICY "Users can manage own assignments" ON public.assignments
  FOR ALL USING (auth.uid() = user_id);

-- Notes policies
CREATE POLICY "Users can manage own notes" ON public.notes
  FOR ALL USING (auth.uid() = user_id);

-- Study streaks policies
CREATE POLICY "Users can manage own study streaks" ON public.study_streaks
  FOR ALL USING (auth.uid() = user_id);

-- Badges policies
CREATE POLICY "Users can manage own badges" ON public.badges
  FOR ALL USING (auth.uid() = user_id);
```

### Database Functions

```sql
-- Function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  
  -- Create default study plan
  INSERT INTO public.study_plans (user_id)
  VALUES (NEW.id);
  
  -- Create default study streak
  INSERT INTO public.study_streaks (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_study_plans_updated_at
  BEFORE UPDATE ON public.study_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_study_streaks_updated_at
  BEFORE UPDATE ON public.study_streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

## Project Structure

```
src/
├── components/          # React components
│   ├── Calendar.tsx     # Calendar view for study sessions
│   ├── Dashboard.tsx    # Main dashboard
│   ├── Login.tsx        # Authentication component
│   ├── Navigation.tsx   # Navigation sidebar
│   ├── Notes.tsx        # Notes management
│   ├── Onboarding.tsx   # Initial setup flow
│   ├── Progress.tsx     # Progress tracking
│   ├── Settings.tsx     # User preferences
│   └── Timer.tsx        # Pomodoro timer
├── hooks/               # Custom React hooks
│   └── useTheme.ts      # Theme management
├── types/               # TypeScript type definitions
│   └── index.ts         # All type definitions
├── utils/               # Utility functions
│   ├── quotes.ts        # Motivational quotes
│   ├── storage.ts       # Local storage helpers
│   └── supabase.ts      # Supabase client setup
├── App.tsx              # Main app component
├── index.css            # Global styles
└── main.tsx             # App entry point
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Environment Variables

Create a `.env` file with:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Usage

1. **Sign Up/Login**: Create an account or sign in
2. **Onboarding**: Set up your subjects and study preferences
3. **Dashboard**: View your study overview and quick actions
4. **Timer**: Use the Pomodoro timer for focused study sessions
5. **Calendar**: Schedule and track study sessions
6. **Progress**: Monitor your study statistics and streaks
7. **Notes**: Create and manage study notes
8. **Settings**: Customize your preferences and themes

## Features in Detail

### Authentication
- Email/password authentication via Supabase
- User profile management
- Session persistence
- Remember me functionality

### Study Management
- Subject-based organization
- Priority-based scheduling
- Pomodoro timer with customizable intervals
- Progress tracking and analytics

### Data Persistence
- Cloud storage via Supabase
- Local storage fallback
- Real-time synchronization
- Offline capability

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
1. Check the Issues tab
2. Review the documentation
3. Create a new issue with detailed information

## Roadmap

- [ ] Mobile app version
- [ ] Study group collaboration
- [ ] Advanced analytics
- [ ] Integration with external calendars
- [ ] AI-powered study recommendations