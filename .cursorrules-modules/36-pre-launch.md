# Pre-Launch Checklist

> Load this module when: Preparing for production deployment, before going live, final review

---

## Quick Launch Gate

Before any production deployment, verify ALL of these:

```
□ All tests pass (npm test)
□ Build succeeds (npm run build)
□ No TypeScript errors (npx tsc --noEmit)
□ Environment variables set in production
□ Database migrations applied
□ Error tracking configured (Sentry)
□ DNS/domain configured
```

---

## Security Checklist

### Authentication

- [ ] **Auth secret is production-grade** (32+ random bytes)
- [ ] **Password requirements enforced** (min length, complexity)
- [ ] **Rate limiting on auth endpoints** (login, register, forgot-password)
- [ ] **Account lockout after failed attempts** (5 attempts → 15 min lockout)
- [ ] **Session timeout configured** (24h default, shorter for sensitive apps)
- [ ] **Secure cookie settings** (httpOnly, secure, sameSite)

```typescript
// Verify cookie settings
cookies().set('session', token, {
  httpOnly: true,      // No JavaScript access
  secure: true,        // HTTPS only
  sameSite: 'lax',     // CSRF protection
  maxAge: 60 * 60 * 24 // 24 hours
});
```

### API Security

- [ ] **All routes require authentication** (except public ones)
- [ ] **Authorization checks on every action** (user can only access their data)
- [ ] **Input validation on all endpoints** (Zod schemas)
- [ ] **Rate limiting on all API routes** (100 req/min default)
- [ ] **CORS configured correctly** (only your domains)
- [ ] **No sensitive data in error messages**

```typescript
// WRONG - leaks info
throw new Error(`User ${email} not found in database`);

// RIGHT - generic message
throw new Error('Invalid credentials');
```

### Data Protection

- [ ] **No secrets in client bundle** (check with `grep -r "sk_" .next/`)
- [ ] **Database credentials not exposed**
- [ ] **API keys not in client-side code**
- [ ] **PII properly encrypted** (if storing sensitive data)
- [ ] **Backups configured** (database, file storage)

### Headers & HTTPS

- [ ] **HTTPS enforced** (redirect HTTP → HTTPS)
- [ ] **Security headers set**

```typescript
// next.config.js
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
];
```

---

## Database Checklist

### Schema & Migrations

- [ ] **All migrations applied to production**
- [ ] **No pending schema changes**
- [ ] **Indexes on frequently queried columns**
- [ ] **Foreign keys have indexes** (critical for JOIN performance)

```bash
# Check pending migrations
npx drizzle-kit check

# Apply migrations
npx drizzle-kit migrate
```

### Performance

- [ ] **Connection pooling configured** (for serverless)
- [ ] **Query timeouts set** (30s max)
- [ ] **Slow query logging enabled**
- [ ] **N+1 queries eliminated** (use joins or batch loading)

```typescript
// Connection pooler for Supabase
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true
```

### Backup & Recovery

- [ ] **Automated backups enabled** (daily minimum)
- [ ] **Point-in-time recovery available** (for paid tiers)
- [ ] **Backup restoration tested** (at least once)

---

## Error Handling Checklist

### User-Facing Errors

- [ ] **All errors caught and handled gracefully**
- [ ] **User-friendly error messages** (no stack traces)
- [ ] **Error boundaries in React** (prevent white screen)
- [ ] **Loading states for all async operations**
- [ ] **Retry mechanisms for transient failures**

```typescript
// Error boundary component
'use client';
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### Error Tracking

- [ ] **Sentry (or similar) configured**
- [ ] **Source maps uploaded for debugging**
- [ ] **Error alerts set up** (Slack/email)
- [ ] **Error grouping working** (not flooding with duplicates)

```typescript
// Sentry initialization
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions
});
```

---

## Performance Checklist

### Frontend

- [ ] **Lighthouse score > 90** (Performance, Accessibility)
- [ ] **Images optimized** (WebP, proper sizing)
- [ ] **Fonts preloaded** (critical fonts)
- [ ] **Code splitting working** (check bundle size)
- [ ] **No layout shift** (CLS < 0.1)

```bash
# Check bundle size
npx @next/bundle-analyzer
```

### Backend

- [ ] **Response times < 200ms** (for API routes)
- [ ] **Database queries < 100ms** (with indexes)
- [ ] **Caching configured** (Redis or in-memory)
- [ ] **CDN for static assets** (Vercel handles this)

### Monitoring

- [ ] **Uptime monitoring** (Vercel, Better Uptime, etc.)
- [ ] **Performance monitoring** (Vercel Analytics)
- [ ] **Error rate dashboards**
- [ ] **Alert thresholds set** (error rate > 1%, latency > 500ms)

---

## Third-Party Integrations

### Payments (Stripe)

- [ ] **Using live keys** (not test keys)
- [ ] **Webhook endpoint configured** (and verified)
- [ ] **Webhook secret set** (STRIPE_WEBHOOK_SECRET)
- [ ] **Test purchase completed** (small amount, refund after)
- [ ] **Error handling for failed payments**
- [ ] **Subscription lifecycle tested** (create, update, cancel)

```typescript
// Verify webhook signature
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET!
);
```

### Email (Resend/SendGrid)

- [ ] **Domain verified** (SPF, DKIM records)
- [ ] **From address configured**
- [ ] **Email templates tested** (check spam score)
- [ ] **Transactional emails working** (signup, reset password)

### OAuth Providers

- [ ] **Redirect URIs include production domain**
- [ ] **Client secrets are production values**
- [ ] **Callback URLs verified**

```
# Google OAuth - add these to authorized redirects:
https://yourdomain.com/api/auth/callback/google
https://yourdomain.com/auth/callback
```

---

## SEO & Metadata

### Essential Meta Tags

- [ ] **Title tag on all pages** (< 60 chars)
- [ ] **Meta description** (< 160 chars)
- [ ] **Open Graph tags** (og:title, og:description, og:image)
- [ ] **Twitter cards** (twitter:card, twitter:title)
- [ ] **Favicon** (multiple sizes)
- [ ] **Canonical URLs**

```typescript
// app/layout.tsx
export const metadata = {
  title: 'Your App',
  description: 'Your app description',
  openGraph: {
    title: 'Your App',
    description: 'Your app description',
    images: ['/og-image.png'],
  },
};
```

### Technical SEO

- [ ] **robots.txt configured**
- [ ] **sitemap.xml generated**
- [ ] **Structured data** (JSON-LD for relevant pages)
- [ ] **404 page customized**
- [ ] **No broken links** (run link checker)

```typescript
// app/robots.ts
export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://yourdomain.com/sitemap.xml',
  };
}
```

---

## Legal & Compliance

### Required Pages

- [ ] **Privacy Policy** (required if collecting any data)
- [ ] **Terms of Service** (especially for SaaS)
- [ ] **Cookie consent** (if using tracking cookies, required in EU)
- [ ] **Acceptable Use Policy** (for user-generated content)

### GDPR (if serving EU)

- [ ] **Cookie consent banner**
- [ ] **Data export functionality** (user can download their data)
- [ ] **Account deletion** (user can delete their account)
- [ ] **Data processing documented**

### Payments Compliance

- [ ] **Refund policy clearly stated**
- [ ] **Pricing clearly displayed** (no hidden fees)
- [ ] **Recurring billing disclosed** (if subscription)

---

## Accessibility Checklist

### Minimum Requirements

- [ ] **All images have alt text**
- [ ] **Forms have labels**
- [ ] **Color contrast sufficient** (4.5:1 ratio)
- [ ] **Keyboard navigation works** (tab through all interactive elements)
- [ ] **Focus indicators visible**
- [ ] **Skip to main content link**

### Testing

```bash
# Run accessibility audit
npx pa11y https://yourdomain.com

# Or use Lighthouse
# Chrome DevTools > Lighthouse > Accessibility
```

---

## Final Deployment Steps

### Pre-Deploy

```bash
# 1. Run all checks
npm run lint
npm run typecheck
npm test
npm run build

# 2. Check for security issues
npm audit

# 3. Verify environment
vercel env pull .env.local.verify
diff .env.example .env.local.verify
```

### Deploy

```bash
# Deploy to production
vercel --prod

# Or via Git
git push origin main  # if auto-deploy configured
```

### Post-Deploy Verification

- [ ] **Home page loads**
- [ ] **Login/signup works**
- [ ] **Core feature works** (your main use case)
- [ ] **Payment flow works** (if applicable)
- [ ] **Emails sending** (check with real email)
- [ ] **Error tracking receiving events** (trigger a test error)
- [ ] **Analytics tracking** (check dashboard)

```typescript
// Trigger test error for Sentry
throw new Error('Test error for monitoring');
```

---

## Rollback Plan

### If Something Goes Wrong

```bash
# 1. Check Vercel deployment history
vercel list

# 2. Rollback to previous deployment
vercel rollback [deployment-url]

# 3. Or revert in Git
git revert HEAD
git push origin main
```

### Keep These Ready

- Previous working deployment URL
- Database backup from before migration
- Rollback migration script (if applicable)
- Communication template for users (if extended outage)

---

## Launch Day Checklist

### Morning Of Launch

- [ ] All team members available
- [ ] Monitoring dashboards open
- [ ] Communication channels ready (Slack/Discord)
- [ ] Support email/chat monitored
- [ ] Social media ready for announcement

### First Hour After Launch

- [ ] Monitor error rates (should be < 0.1%)
- [ ] Check response times (should be < 200ms)
- [ ] Verify signups working
- [ ] Verify payments processing
- [ ] Check email deliverability

### First 24 Hours

- [ ] Review all errors in Sentry
- [ ] Check user feedback channels
- [ ] Monitor server resources
- [ ] Be ready to hotfix if needed
