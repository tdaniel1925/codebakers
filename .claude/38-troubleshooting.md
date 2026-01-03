# Troubleshooting Guide

> Load this module when: Debugging issues, errors occurring, something not working

---

## Quick Diagnosis

### Error Type Quick Reference

| Error Pattern | Likely Cause | Jump To |
|---------------|--------------|---------|
| `Cannot find module` | Missing dependency | [Dependencies](#dependency-issues) |
| `ECONNREFUSED` | Database not running | [Database](#database-issues) |
| `401 Unauthorized` | Auth issue | [Authentication](#authentication-issues) |
| `NEXT_PUBLIC_ undefined` | Env var issue | [Environment](#environment-variable-issues) |
| `Hydration failed` | SSR mismatch | [React](#react-hydration-issues) |
| `Type error` | TypeScript issue | [TypeScript](#typescript-issues) |
| White screen | Unhandled error | [React Errors](#react-errors) |

---

## Environment Variable Issues

### Problem: Variable is `undefined`

**Symptoms:**
```
Error: Missing required environment variable: DATABASE_URL
// or
TypeError: Cannot read property 'split' of undefined
```

**Diagnosis:**
```typescript
// Add temporarily to debug
console.log('ENV CHECK:', {
  DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'MISSING',
  AUTH_SECRET: process.env.AUTH_SECRET ? 'SET' : 'MISSING',
});
```

**Solutions:**

1. **Variable not in .env.local**
   ```bash
   # Check if file exists
   ls -la .env.local

   # Add missing variable
   echo "DATABASE_URL=your_value" >> .env.local
   ```

2. **NEXT_PUBLIC_ not rebuilding**
   ```bash
   # Restart dev server after adding NEXT_PUBLIC_ vars
   # Stop with Ctrl+C, then:
   npm run dev
   ```

3. **Variable not in production**
   ```bash
   # Check Vercel env vars
   vercel env ls

   # Add missing var
   vercel env add DATABASE_URL production
   ```

4. **Wrong .env file**
   ```bash
   # Next.js loads in this order:
   # 1. .env.$(NODE_ENV).local
   # 2. .env.local (not loaded in test)
   # 3. .env.$(NODE_ENV)
   # 4. .env

   # Make sure var is in correct file
   ```

### Problem: Variable has wrong value

**Diagnosis:**
```typescript
// Log actual value (mask secrets!)
console.log('API_URL:', process.env.NEXT_PUBLIC_API_URL);
console.log('DB_URL starts with:', process.env.DATABASE_URL?.slice(0, 20));
```

**Common causes:**
- Trailing whitespace in value
- Quotes included in value
- Wrong environment file loaded

```bash
# WRONG (quotes included in value)
API_KEY="sk_test_123"

# RIGHT
API_KEY=sk_test_123
```

---

## Database Issues

### Problem: Connection refused

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
// or
Error: Connection terminated unexpectedly
```

**Solutions:**

1. **Local database not running**
   ```bash
   # Start PostgreSQL (macOS)
   brew services start postgresql

   # Start with Docker
   docker start postgres

   # Check if running
   pg_isready -h localhost -p 5432
   ```

2. **Wrong connection string**
   ```bash
   # Format: postgresql://user:password@host:port/database
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/myapp
   ```

3. **Docker container not started**
   ```bash
   docker ps  # Check running containers
   docker-compose up -d  # Start containers
   ```

### Problem: Authentication failed

**Symptoms:**
```
Error: password authentication failed for user "postgres"
```

**Solutions:**
```bash
# Check credentials in connection string
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DB

# Reset password if needed
psql -U postgres -c "ALTER USER postgres PASSWORD 'newpassword';"
```

### Problem: Database doesn't exist

**Symptoms:**
```
Error: database "myapp" does not exist
```

**Solution:**
```bash
# Create the database
createdb myapp

# Or with psql
psql -U postgres -c "CREATE DATABASE myapp;"
```

### Problem: Migrations not applied

**Symptoms:**
```
Error: relation "users" does not exist
```

**Solution:**
```bash
# Generate migrations
npx drizzle-kit generate

# Push schema (development)
npx drizzle-kit push

# Apply migrations (production)
npx drizzle-kit migrate
```

### Problem: Connection pool exhausted

**Symptoms:**
```
Error: remaining connection slots are reserved
// or
Error: too many connections
```

**Solution:**
```bash
# Use connection pooler for serverless
# Supabase: Use port 6543 with pgbouncer=true
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true

# Or reduce pool size
DATABASE_URL=postgresql://...?pool_size=5
```

---

## Authentication Issues

### Problem: 401 Unauthorized on all requests

**Diagnosis:**
```typescript
// Check if session exists
const session = await auth();
console.log('Session:', session);
```

**Solutions:**

1. **AUTH_SECRET not set**
   ```bash
   # Generate secret
   openssl rand -base64 32

   # Add to .env.local
   AUTH_SECRET=your_generated_secret
   ```

2. **Cookies not being set**
   ```typescript
   // Check cookie settings
   // Must be secure: true in production (HTTPS)
   cookies().set('session', token, {
     httpOnly: true,
     secure: process.env.NODE_ENV === 'production',
     sameSite: 'lax',
   });
   ```

3. **Session expired**
   ```typescript
   // Check session expiry
   const session = await auth();
   if (session?.expires && new Date(session.expires) < new Date()) {
     // Session expired, redirect to login
   }
   ```

### Problem: OAuth redirect error

**Symptoms:**
```
Error: redirect_uri_mismatch
```

**Solution:**
1. Go to OAuth provider console (Google, GitHub, etc.)
2. Add your production URL to authorized redirect URIs:
   ```
   https://yourdomain.com/api/auth/callback/google
   https://yourdomain.com/api/auth/callback/github
   ```

### Problem: Session not persisting

**Symptoms:** User logged out on page refresh

**Solutions:**

1. **Cookie domain mismatch**
   ```typescript
   // For subdomains, set domain
   cookies().set('session', token, {
     domain: '.yourdomain.com',  // Note the leading dot
   });
   ```

2. **HTTPS required for secure cookies**
   ```typescript
   // In production, secure must be true
   secure: process.env.NODE_ENV === 'production',
   ```

---

## React Hydration Issues

### Problem: Hydration mismatch

**Symptoms:**
```
Error: Hydration failed because the initial UI does not match
// or
Warning: Text content did not match
```

**Common Causes & Fixes:**

1. **Date/time rendering**
   ```typescript
   // WRONG - different on server vs client
   <span>{new Date().toLocaleString()}</span>

   // RIGHT - render on client only
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);

   if (!mounted) return null;
   return <span>{new Date().toLocaleString()}</span>;
   ```

2. **Random values**
   ```typescript
   // WRONG
   <div key={Math.random()}>

   // RIGHT - use stable keys
   <div key={item.id}>
   ```

3. **Browser-only APIs**
   ```typescript
   // WRONG - window doesn't exist on server
   const width = window.innerWidth;

   // RIGHT - check for client
   const [width, setWidth] = useState(0);
   useEffect(() => {
     setWidth(window.innerWidth);
   }, []);
   ```

4. **Extension interference**
   ```typescript
   // Add suppressHydrationWarning for known issues
   <html suppressHydrationWarning>
   ```

---

## React Errors

### Problem: White screen (unhandled error)

**Diagnosis:**
1. Open browser DevTools (F12)
2. Check Console for errors
3. Check Network tab for failed requests

**Solution: Add error boundaries**

```typescript
// app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error:', error);
    // Log to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-bold">Something went wrong</h2>
      <button onClick={reset} className="mt-4 btn">
        Try again
      </button>
    </div>
  );
}
```

### Problem: Component not updating

**Diagnosis:**
```typescript
// Check if state is updating
useEffect(() => {
  console.log('State changed:', myState);
}, [myState]);
```

**Common causes:**

1. **Mutating state directly**
   ```typescript
   // WRONG
   items.push(newItem);
   setItems(items);

   // RIGHT
   setItems([...items, newItem]);
   ```

2. **Stale closure in useEffect**
   ```typescript
   // WRONG - missing dependency
   useEffect(() => {
     doSomething(value);
   }, []); // value should be in deps

   // RIGHT
   useEffect(() => {
     doSomething(value);
   }, [value]);
   ```

3. **Object reference not changing**
   ```typescript
   // WRONG - same reference
   setUser({ ...user, name: 'New' }); // works
   user.name = 'New';
   setUser(user); // doesn't trigger re-render

   // RIGHT - new reference
   setUser({ ...user, name: 'New' });
   ```

---

## TypeScript Issues

### Problem: Type errors after update

**Solution:**
```bash
# Clear TypeScript cache
rm -rf node_modules/.cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
npm install

# Restart TypeScript server in VS Code
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Problem: Module not found

**Symptoms:**
```
Cannot find module '@/lib/db' or its corresponding type declarations
```

**Solutions:**

1. **Path alias not configured**
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

2. **Module not installed**
   ```bash
   npm install missing-package
   ```

3. **Types package needed**
   ```bash
   npm install -D @types/package-name
   ```

### Problem: Implicit any errors

**Solution:**
```typescript
// Add explicit types
function processData(data: unknown): ProcessedData {
  // Type guard
  if (!isValidData(data)) {
    throw new Error('Invalid data');
  }
  return transform(data);
}
```

---

## Build Issues

### Problem: Build fails locally but works in CI

**Solutions:**
```bash
# Clean build
rm -rf .next
rm -rf node_modules/.cache
npm run build

# Check for case-sensitivity issues (macOS vs Linux)
# Linux is case-sensitive, macOS is not
# Button.tsx vs button.tsx
```

### Problem: Out of memory during build

**Solution:**
```bash
# Increase Node memory
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Or in package.json
"scripts": {
  "build": "NODE_OPTIONS='--max-old-space-size=4096' next build"
}
```

### Problem: Build succeeds but app crashes

**Diagnosis:**
```bash
# Check for runtime errors in production
vercel logs --follow

# Or run production build locally
npm run build && npm start
```

---

## Dependency Issues

### Problem: Package conflicts

**Symptoms:**
```
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solutions:**
```bash
# Try with legacy peer deps
npm install --legacy-peer-deps

# Or force
npm install --force

# Better: Update all deps
npm update
```

### Problem: Module not found after install

**Solutions:**
```bash
# Clear node_modules
rm -rf node_modules
rm package-lock.json
npm install

# If using pnpm
pnpm store prune
pnpm install
```

### Problem: Wrong version installed

**Solution:**
```bash
# Check installed version
npm ls package-name

# Install specific version
npm install package-name@1.2.3
```

---

## API Issues

### Problem: CORS errors

**Symptoms:**
```
Access to fetch at 'https://api.com' has been blocked by CORS policy
```

**Solutions:**

1. **For your own API (Next.js)**
   ```typescript
   // app/api/route.ts
   export async function OPTIONS() {
     return new Response(null, {
       status: 204,
       headers: {
         'Access-Control-Allow-Origin': '*',
         'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
         'Access-Control-Allow-Headers': 'Content-Type, Authorization',
       },
     });
   }
   ```

2. **For external APIs**
   ```typescript
   // Proxy through your API route
   // app/api/proxy/route.ts
   export async function GET() {
     const response = await fetch('https://external-api.com/data');
     return Response.json(await response.json());
   }
   ```

### Problem: Rate limited

**Symptoms:**
```
429 Too Many Requests
```

**Solutions:**
```typescript
// Add retry with exponential backoff
async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url);
    if (response.status !== 429) return response;

    const delay = Math.pow(2, i) * 1000;
    await new Promise(r => setTimeout(r, delay));
  }
  throw new Error('Rate limited');
}
```

---

## Deployment Issues

### Problem: Works locally, fails in production

**Checklist:**
- [ ] All env vars set in production?
- [ ] Using production database URL?
- [ ] OAuth redirect URLs include production domain?
- [ ] Webhook URLs updated?
- [ ] Any hardcoded localhost URLs?

### Problem: Vercel build fails

**Diagnosis:**
```bash
# Check build logs
vercel logs

# Try building locally
npm run build
```

**Common fixes:**
```bash
# Clear Vercel cache
vercel --prod --force

# Check Node version matches
# vercel.json or package.json engines
```

### Problem: 500 error in production only

**Diagnosis:**
```bash
# Check Vercel function logs
vercel logs --follow

# Add better error logging
try {
  // code
} catch (error) {
  console.error('Detailed error:', error);
  throw error;
}
```

---

## Performance Issues

### Problem: Slow page load

**Diagnosis:**
```bash
# Run Lighthouse
# Chrome DevTools → Lighthouse → Generate report

# Check bundle size
npx @next/bundle-analyzer
```

**Solutions:**
1. **Large bundle** → Use dynamic imports
2. **Slow API** → Add caching
3. **Large images** → Use next/image
4. **Too many requests** → Combine/batch

### Problem: Database queries slow

**Diagnosis:**
```typescript
// Log query timing
console.time('query');
const result = await db.select().from(users);
console.timeEnd('query');
```

**Solutions:**
1. Add indexes on queried columns
2. Use `select()` with specific columns
3. Add pagination
4. Use connection pooling

---

## Getting More Help

### Information to Gather

When asking for help, include:
1. Exact error message (full stack trace)
2. What you were doing when it occurred
3. What you've already tried
4. Relevant code snippets
5. Environment (Node version, OS, package versions)

### Useful Commands

```bash
# Node version
node --version

# Package versions
npm ls

# System info
npx envinfo --system --npmPackages --binaries

# Clear all caches
rm -rf node_modules .next .turbo
npm cache clean --force
npm install
```

### Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Vercel Status](https://www.vercel-status.com/)
- [Supabase Status](https://status.supabase.com/)
- [Stripe Status](https://status.stripe.com/)
