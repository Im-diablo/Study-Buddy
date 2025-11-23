# Study Buddy Setup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Environment Variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Supabase credentials.

3. **Setup Database**
   - Go to [Supabase](https://supabase.com) and create a new project
   - Copy the SQL from `database/schema.sql`
   - Run it in your Supabase SQL editor
   - Get your project URL and anon key from Settings > API

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## Detailed Setup

### 1. Supabase Project Setup

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Wait for project to be ready
4. Go to Settings > API
5. Copy:
   - Project URL
   - Anon public key

### 2. Environment Configuration

Create `.env` file in project root:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Database Setup

1. Open Supabase dashboard
2. Go to SQL Editor
3. Copy contents of `database/schema.sql`
4. Run the SQL script
5. Verify tables are created in Table Editor

### 4. Test the Application

1. Start dev server: `npm run dev`
2. Open browser to `http://localhost:5173`
3. Try creating an account
4. Complete onboarding
5. Test features

## Troubleshooting

### Common Issues

**"Missing Supabase environment variables"**
- Check `.env` file exists
- Verify variable names match exactly
- Restart dev server after changes

**Authentication not working**
- Verify Supabase URL and key are correct
- Check database schema was applied
- Look for errors in browser console

**Database errors**
- Ensure all tables were created
- Check Row Level Security policies are enabled
- Verify triggers and functions were created

### Getting Help

1. Check browser console for errors
2. Check Supabase logs in dashboard
3. Verify environment variables
4. Review database schema

## Development

### Project Structure
```
src/
├── components/     # React components
├── hooks/         # Custom hooks
├── services/      # API services
├── types/         # TypeScript types
├── utils/         # Utility functions
└── App.tsx        # Main app
```

### Key Files
- `src/utils/supabase.ts` - Supabase client
- `src/services/userService.ts` - User operations
- `database/schema.sql` - Database schema
- `.env` - Environment variables

### Available Scripts
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run preview` - Preview build
- `npm run lint` - Run linter