# Study Buddy Deployment Guide

## Prerequisites

- Node.js 18+ installed
- Supabase account
- Git repository (GitHub, GitLab, etc.)
- Deployment platform account (Vercel, Netlify, etc.)

## Local Development Setup

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd Study_Buddy-main
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 3. Database Setup
1. Create Supabase project
2. Run SQL from `database/schema.sql` in Supabase SQL editor
3. Verify tables are created

### 4. Start Development
```bash
npm run dev
```

## Production Deployment

### Option 1: Vercel (Recommended)

#### Quick Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/study-buddy)

#### Manual Deploy
1. **Build the project**
   ```bash
   npm run build
   ```

2. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

4. **Set Environment Variables**
   - Go to Vercel dashboard
   - Select your project
   - Go to Settings > Environment Variables
   - Add:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

### Option 2: Netlify

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Deploy via Netlify CLI**
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod --dir=dist
   ```

3. **Set Environment Variables**
   - Go to Netlify dashboard
   - Site settings > Environment variables
   - Add your Supabase credentials

### Option 3: GitHub Pages

1. **Install gh-pages**
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Update package.json**
   ```json
   {
     "homepage": "https://yourusername.github.io/study-buddy",
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     }
   }
   ```

3. **Update vite.config.ts**
   ```typescript
   export default defineConfig({
     plugins: [react()],
     base: '/study-buddy/'
   })
   ```

4. **Deploy**
   ```bash
   npm run deploy
   ```

## Environment Variables

### Required Variables
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Getting Supabase Credentials
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings > API
4. Copy:
   - Project URL → `VITE_SUPABASE_URL`
   - Anon public key → `VITE_SUPABASE_ANON_KEY`

## Database Configuration

### Supabase Setup Checklist
- [ ] Project created
- [ ] Database schema applied (`database/schema.sql`)
- [ ] Row Level Security enabled
- [ ] Authentication configured
- [ ] API keys copied

### Database Tables Verification
Ensure these tables exist:
- `users`
- `subjects`
- `study_plans`
- `study_sessions`
- `assignments`
- `notes`
- `study_streaks`
- `badges`

## Build Configuration

### Vite Configuration
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser'
  }
})
```

### TypeScript Configuration
Ensure `tsconfig.json` is properly configured for production builds.

## Performance Optimization

### Build Optimization
```bash
# Analyze bundle size
npm run build
npx vite-bundle-analyzer dist
```

### Recommended Optimizations
- Enable gzip compression
- Set up CDN for static assets
- Configure caching headers
- Optimize images
- Enable tree shaking

## Security Considerations

### Environment Security
- Never commit `.env` files
- Use different Supabase projects for dev/prod
- Rotate API keys regularly
- Enable RLS on all tables

### Supabase Security
- Configure authentication policies
- Set up proper RLS policies
- Enable email confirmation
- Configure password requirements

## Monitoring and Analytics

### Error Tracking
Consider integrating:
- Sentry for error tracking
- LogRocket for session replay
- Google Analytics for usage

### Performance Monitoring
- Vercel Analytics (if using Vercel)
- Web Vitals monitoring
- Supabase dashboard metrics

## Troubleshooting

### Common Deployment Issues

**Build Fails**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Environment Variables Not Working**
- Verify variable names (must start with `VITE_`)
- Check deployment platform settings
- Restart deployment after adding variables

**Database Connection Issues**
- Verify Supabase URL and key
- Check network connectivity
- Ensure RLS policies are correct

**Authentication Not Working**
- Verify Supabase auth configuration
- Check redirect URLs in Supabase dashboard
- Ensure proper error handling

### Debug Commands
```bash
# Check build output
npm run build && npm run preview

# Verify environment variables
echo $VITE_SUPABASE_URL

# Test database connection
# (Add to your app for debugging)
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
```

## Maintenance

### Regular Tasks
- Update dependencies monthly
- Monitor Supabase usage
- Review error logs
- Update documentation
- Backup database regularly

### Updates
```bash
# Update dependencies
npm update

# Check for security vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

## Support

### Getting Help
1. Check browser console for errors
2. Review Supabase logs
3. Verify environment variables
4. Check deployment platform logs
5. Review this documentation

### Resources
- [Vite Documentation](https://vitejs.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [React Documentation](https://react.dev/)
- [Vercel Documentation](https://vercel.com/docs)
- [Netlify Documentation](https://docs.netlify.com/)