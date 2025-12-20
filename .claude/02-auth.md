# AUTHENTICATION & SECURITY
# Module: 02-auth.md
# Load with: 00-core.md

---

# PART 4: AUTHENTICATION PATTERNS

## 🔐 SUPABASE AUTH (Recommended)

### Server-Side Client

```typescript
// lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handle cookies in Server Components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Handle cookies in Server Components
          }
        },
      },
    }
  );
}
```

### Browser Client

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### Admin Client (Service Role)

```typescript
// lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

// ⚠️ ONLY use server-side, NEVER expose to client
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
```

### Auth Middleware

```typescript
// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routes that require authentication
const protectedRoutes = ['/dashboard', '/settings', '/api/user'];

// Routes that should redirect to dashboard if already logged in
const authRoutes = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Check protected routes
  const isProtectedRoute = protectedRoutes.some(route => 
    path.startsWith(route)
  );
  
  if (isProtectedRoute && !user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect logged-in users away from auth pages
  const isAuthRoute = authRoutes.some(route => path.startsWith(route));
  
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
```

### Auth Helpers

```typescript
// lib/auth.ts
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function getUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Auth error:', error.message);
    return null;
  }
  
  return user;
}

export async function requireAuth() {
  const user = await getUser();
  
  if (!user) {
    redirect('/login');
  }
  
  return user;
}

export async function requireRole(allowedRoles: string[]) {
  const user = await requireAuth();
  
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  
  if (!profile || !allowedRoles.includes(profile.role)) {
    redirect('/unauthorized');
  }
  
  return { user, role: profile.role };
}
```

### Login Form Component

```typescript
// components/auth/login-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  redirectTo?: string;
}

export function LoginForm({ redirectTo = '/dashboard' }: LoginFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    
    try {
      const supabase = createClient();
      
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      
      if (error) {
        throw error;
      }
      
      toast.success('Welcome back!');
      router.push(redirectTo);
      router.refresh();
      
    } catch (error) {
      const message = error instanceof Error 
        ? error.message 
        : 'Failed to sign in';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const supabase = createClient();
    
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${redirectTo}`,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </Form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignIn}
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Google
      </Button>
    </div>
  );
}
```

### Auth Callback Route

```typescript
// app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

---


---

# PART 12: SECURITY & COMPLIANCE

## 🔒 SECURITY PATTERNS

### Input Sanitization

```typescript
// lib/security/sanitize.ts
import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML content
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

/**
 * Sanitize for plain text (strip all HTML)
 */
export function sanitizeText(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] });
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
```

### CSRF Protection

```typescript
// lib/security/csrf.ts
import { cookies } from 'next/headers';
import crypto from 'crypto';

const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_HEADER_KEY = 'x-csrf-token';

export async function generateCsrfToken(): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const cookieStore = await cookies();
  
  cookieStore.set(CSRF_TOKEN_KEY, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  });
  
  return token;
}

export async function validateCsrfToken(request: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const storedToken = cookieStore.get(CSRF_TOKEN_KEY)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_KEY);
  
  if (!storedToken || !headerToken) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(storedToken),
    Buffer.from(headerToken)
  );
}

// Middleware to validate CSRF on mutations
export async function csrfMiddleware(request: Request): Promise<boolean> {
  const method = request.method.toUpperCase();
  
  // Only validate on mutations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return validateCsrfToken(request);
  }
  
  return true;
}
```

### Security Headers

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com;
      style-src 'self' 'unsafe-inline';
      img-src 'self' blob: data: https:;
      font-src 'self';
      connect-src 'self' https://api.stripe.com https://*.supabase.co wss://*.supabase.co;
      frame-src 'self' https://js.stripe.com;
    `.replace(/\s+/g, ' ').trim(),
  },
];

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};
```

### Audit Logging

```typescript
// lib/security/audit.ts
import { db } from '@/db';
import { auditLogs } from '@/db/schema';

type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'resource.created'
  | 'resource.updated'
  | 'resource.deleted'
  | 'permission.granted'
  | 'permission.revoked'
  | 'settings.changed'
  | 'export.requested'
  | 'api.key.created'
  | 'api.key.revoked';

interface AuditLogParams {
  action: AuditAction;
  userId: string;
  organizationId?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  await db.insert(auditLogs).values({
    action: params.action,
    userId: params.userId,
    organizationId: params.organizationId,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    metadata: params.metadata,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

// Usage:
await createAuditLog({
  action: 'user.login',
  userId: user.id,
  ipAddress: req.ip,
  userAgent: req.headers.get('user-agent'),
  metadata: {
    method: 'password',
  },
});
```

### Secrets Management

```typescript
// lib/security/secrets.ts

/**
 * Mask sensitive data for logging
 */
export function maskSecret(secret: string, visibleChars: number = 4): string {
  if (secret.length <= visibleChars * 2) {
    return '*'.repeat(secret.length);
  }
  return (
    secret.substring(0, visibleChars) +
    '*'.repeat(secret.length - visibleChars * 2) +
    secret.substring(secret.length - visibleChars)
  );
}

/**
 * Validate environment variables at startup
 */
export function validateEnvVars(required: string[]): void {
  const missing = required.filter((key) => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

// Call at app startup
validateEnvVars([
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
]);
```

---


---

# PART 68: SECURITY HEADERS

## Next.js Security Headers

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com;
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https: blob:;
      font-src 'self';
      connect-src 'self' https://api.stripe.com https://*.supabase.co wss://*.supabase.co;
      frame-src 'self' https://js.stripe.com https://hooks.stripe.com;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim(),
  },
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

## CORS Configuration

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  
  const response = NextResponse.next();
  
  // Add CORS headers to all responses
  response.headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  
  return response;
}
```

---


---

# PART 69: TWO-FACTOR AUTHENTICATION (2FA)

## TOTP Implementation

```typescript
// lib/2fa.ts
import { authenticator } from 'otplib';
import qrcode from 'qrcode';

export const TwoFactorAuth = {
  // Generate secret for user
  generateSecret(): string {
    return authenticator.generateSecret();
  },
  
  // Generate QR code URL for authenticator apps
  async generateQRCode(email: string, secret: string): Promise<string> {
    const otpauthUrl = authenticator.keyuri(email, 'YourAppName', secret);
    return qrcode.toDataURL(otpauthUrl);
  },
  
  // Verify token from authenticator app
  verifyToken(token: string, secret: string): boolean {
    return authenticator.verify({ token, secret });
  },
  
  // Generate backup codes
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  },
};
```

## 2FA API Routes

```typescript
// app/api/2fa/setup/route.ts
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  
  // Generate new secret
  const secret = TwoFactorAuth.generateSecret();
  
  // Store secret (not enabled yet)
  await db
    .update(profiles)
    .set({ twoFactorSecret: secret })
    .where(eq(profiles.id, user.id));
  
  // Generate QR code
  const qrCode = await TwoFactorAuth.generateQRCode(user.email, secret);
  
  return NextResponse.json({ qrCode, secret });
}

// app/api/2fa/enable/route.ts
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const { token } = await req.json();
  
  // Get stored secret
  const profile = await getProfile(user.id);
  if (!profile.twoFactorSecret) {
    return NextResponse.json({ error: 'Setup required first' }, { status: 400 });
  }
  
  // Verify token
  if (!TwoFactorAuth.verifyToken(token, profile.twoFactorSecret)) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }
  
  // Generate backup codes
  const backupCodes = TwoFactorAuth.generateBackupCodes();
  const hashedCodes = await Promise.all(
    backupCodes.map(code => bcrypt.hash(code, 10))
  );
  
  // Enable 2FA
  await db
    .update(profiles)
    .set({
      twoFactorEnabled: true,
      twoFactorBackupCodes: hashedCodes,
    })
    .where(eq(profiles.id, user.id));
  
  return NextResponse.json({ backupCodes });
}

// app/api/2fa/verify/route.ts
export async function POST(req: NextRequest) {
  const { userId, token } = await req.json();
  
  const profile = await getProfile(userId);
  
  // Check TOTP token
  if (TwoFactorAuth.verifyToken(token, profile.twoFactorSecret)) {
    // Create session
    return NextResponse.json({ success: true });
  }
  
  // Check backup codes
  for (let i = 0; i < profile.twoFactorBackupCodes.length; i++) {
    if (await bcrypt.compare(token, profile.twoFactorBackupCodes[i])) {
      // Remove used backup code
      const newCodes = [...profile.twoFactorBackupCodes];
      newCodes.splice(i, 1);
      await db
        .update(profiles)
        .set({ twoFactorBackupCodes: newCodes })
        .where(eq(profiles.id, userId));
      
      return NextResponse.json({ success: true, usedBackupCode: true });
    }
  }
  
  return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
}
```

---


---

# PART 70: OAUTH (GOOGLE/GITHUB LOGIN)

## Supabase OAuth Setup

```typescript
// lib/supabase/auth.ts
import { createClient } from '@/lib/supabase/client';

export async function signInWithGoogle() {
  const supabase = createClient();
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  
  if (error) throw error;
  return data;
}

export async function signInWithGitHub() {
  const supabase = createClient();
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  
  if (error) throw error;
  return data;
}
```

## OAuth Callback Handler

```typescript
// app/auth/callback/route.ts
import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';
  
  if (code) {
    const supabase = await createServerClient();
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user) {
      // Check if profile exists, create if not
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.id, data.user.id),
      });
      
      if (!profile) {
        // Create profile for new OAuth user
        await db.insert(profiles).values({
          id: data.user.id,
          email: data.user.email!,
          fullName: data.user.user_metadata.full_name || data.user.user_metadata.name,
          avatarUrl: data.user.user_metadata.avatar_url,
        });
        
        // Create default team
        const [team] = await db.insert(teams).values({
          name: `${data.user.email}'s Team`,
          ownerId: data.user.id,
        }).returning();
        
        await db.insert(teamMembers).values({
          teamId: team.id,
          userId: data.user.id,
          role: 'owner',
        });
      }
      
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }
  
  // OAuth error
  return NextResponse.redirect(
    new URL('/login?error=oauth_failed', requestUrl.origin)
  );
}
```

## Social Login Buttons

```typescript
// components/auth/social-buttons.tsx
'use client';

import { Button } from '@/components/ui/button';
import { signInWithGoogle, signInWithGitHub } from '@/lib/supabase/auth';
import { FcGoogle } from 'react-icons/fc';
import { FaGithub } from 'react-icons/fa';

export function SocialLoginButtons() {
  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        className="w-full"
        onClick={() => signInWithGoogle()}
      >
        <FcGoogle className="mr-2 h-5 w-5" />
        Continue with Google
      </Button>
      
      <Button
        variant="outline"
        className="w-full"
        onClick={() => signInWithGitHub()}
      >
        <FaGithub className="mr-2 h-5 w-5" />
        Continue with GitHub
      </Button>
    </div>
  );
}
```

---


---

# PART 110: ADMIN IMPERSONATION

## 👤 SUPPORT IMPERSONATION

### Impersonation Start

```typescript
// src/app/api/admin/impersonate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, impersonationLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getServerSession, isAdmin, createImpersonationToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session || !(await isAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { targetUserId, reason } = await req.json();

  if (!targetUserId || !reason) {
    return NextResponse.json(
      { error: 'Target user ID and reason required' },
      { status: 400 }
    );
  }

  // Get target user
  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, targetUserId),
  });

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Don't allow impersonating other admins
  if (await isAdmin(targetUserId)) {
    return NextResponse.json(
      { error: 'Cannot impersonate admin users' },
      { status: 403 }
    );
  }

  // Log the impersonation
  await db.insert(impersonationLogs).values({
    adminId: session.user.id,
    targetUserId,
    reason,
    startedAt: new Date(),
  });

  // Create impersonation token
  const token = await createImpersonationToken({
    adminId: session.user.id,
    targetUserId,
    expiresIn: '1h',
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set('impersonation_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hour
  });

  return response;
}
```

### Impersonation Middleware

```typescript
// src/middleware/impersonation.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyImpersonationToken } from '@/lib/auth';

export async function impersonationMiddleware(req: NextRequest) {
  const impersonationToken = req.cookies.get('impersonation_token')?.value;

  if (impersonationToken) {
    try {
      const payload = await verifyImpersonationToken(impersonationToken);

      // Add impersonation context to headers
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-impersonated-user-id', payload.targetUserId);
      requestHeaders.set('x-impersonating-admin-id', payload.adminId);

      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    } catch {
      // Invalid token, clear it
      const response = NextResponse.next();
      response.cookies.delete('impersonation_token');
      return response;
    }
  }

  return NextResponse.next();
}
```

### Impersonation Banner Component

```typescript
// src/components/impersonation-banner.tsx
'use client';

import { useImpersonation } from '@/hooks/use-impersonation';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export function ImpersonationBanner() {
  const { isImpersonating, targetUser, stopImpersonation } = useImpersonation();

  if (!isImpersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black px-4 py-2">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <span>
            You are viewing as <strong>{targetUser?.email}</strong>
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={stopImpersonation}
          className="bg-white"
        >
          Stop Impersonating
        </Button>
      </div>
    </div>
  );
}
```

### Stop Impersonation

```typescript
// src/app/api/admin/stop-impersonation/route.ts
export async function POST(req: NextRequest) {
  const impersonationToken = req.cookies.get('impersonation_token')?.value;

  if (impersonationToken) {
    const payload = await verifyImpersonationToken(impersonationToken);

    // Log end of impersonation
    await db
      .update(impersonationLogs)
      .set({ endedAt: new Date() })
      .where(
        and(
          eq(impersonationLogs.adminId, payload.adminId),
          eq(impersonationLogs.targetUserId, payload.targetUserId),
          isNull(impersonationLogs.endedAt)
        )
      );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete('impersonation_token');
  return response;
}
```

---

