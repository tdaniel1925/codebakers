# CORE EXPERTS
# Module: 21-experts-core.md
# Load with: 00-core.md

---

## 🏗️ EXPERT: BACKEND ARCHITECT

### Role
Designs scalable server-side systems, APIs, and data architectures. Focuses on performance, reliability, and maintainability.

### Perspective Questions
When reviewing backend code, ask:
1. Is this horizontally scalable?
2. What happens under 10x load?
3. Are there single points of failure?
4. Is the data model optimized for query patterns?
5. Are transactions properly bounded?

### Backend Architecture Checklist

```markdown
## Backend Architecture Review

### API Design
- [ ] RESTful conventions followed (or GraphQL schema well-defined)
- [ ] Consistent error response format
- [ ] Proper HTTP status codes
- [ ] Pagination for list endpoints
- [ ] Rate limiting implemented
- [ ] API versioning strategy defined

### Data Layer
- [ ] Database indexes cover common queries
- [ ] N+1 queries eliminated
- [ ] Connection pooling configured
- [ ] Read replicas for heavy read workloads
- [ ] Soft deletes for recoverable data
- [ ] Audit trail for sensitive operations

### Scalability
- [ ] Stateless application servers
- [ ] Session storage externalized (Redis)
- [ ] File uploads to object storage (S3)
- [ ] Background jobs for long operations
- [ ] Caching strategy defined
- [ ] Database sharding plan (if needed)

### Reliability
- [ ] Circuit breakers for external services
- [ ] Retry logic with exponential backoff
- [ ] Graceful degradation paths
- [ ] Health check endpoints
- [ ] Structured logging
- [ ] Distributed tracing

### Security
- [ ] Input validation at API boundary
- [ ] SQL injection prevention (parameterized queries)
- [ ] Authentication on all protected routes
- [ ] Authorization checks per resource
- [ ] Secrets in environment variables
- [ ] CORS properly configured
```

### Code Review Standards

```typescript
// GOOD: Idempotent operation with proper error handling
async function processPayment(orderId: string): Promise<PaymentResult> {
  // Check if already processed (idempotency)
  const existing = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .limit(1);

  if (existing.length > 0) {
    return { status: 'already_processed', paymentId: existing[0].id };
  }

  // Use transaction for consistency
  return await db.transaction(async (tx) => {
    const order = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .for('update') // Lock row
      .limit(1);

    if (!order.length) {
      throw new NotFoundError('Order not found');
    }

    // Process with external service
    const result = await stripe.charges.create({
      amount: order[0].totalCents,
      idempotencyKey: orderId, // Stripe idempotency
    });

    // Record payment
    const [payment] = await tx
      .insert(payments)
      .values({
        orderId,
        stripeChargeId: result.id,
        amountCents: order[0].totalCents,
      })
      .returning();

    // Update order status
    await tx
      .update(orders)
      .set({ status: 'paid' })
      .where(eq(orders.id, orderId));

    return { status: 'success', paymentId: payment.id };
  });
}

// BAD: Non-idempotent, no transaction, race conditions possible
async function processPaymentBad(orderId: string) {
  const order = await db.select().from(orders).where(eq(orders.id, orderId));
  const result = await stripe.charges.create({ amount: order[0].totalCents });
  await db.insert(payments).values({ orderId, chargeId: result.id });
  await db.update(orders).set({ status: 'paid' }).where(eq(orders.id, orderId));
}
```

---

## 🎨 EXPERT: FRONTEND ARCHITECT

### Role
Designs component architectures, state management, and user experiences. Focuses on performance, accessibility, and developer experience.

### Perspective Questions
When reviewing frontend code, ask:
1. Is this component reusable?
2. Does it handle loading/error/empty states?
3. Is the state managed at the right level?
4. Is it accessible (keyboard, screen reader)?
5. What's the bundle size impact?

### Frontend Architecture Checklist

```markdown
## Frontend Architecture Review

### Component Design
- [ ] Single responsibility per component
- [ ] Props interface well-defined
- [ ] Default props where sensible
- [ ] Compound components for complex UI
- [ ] Controlled vs uncontrolled decision clear
- [ ] Memoization where beneficial

### State Management
- [ ] Local state for UI-only concerns
- [ ] Server state with React Query/SWR
- [ ] Global state minimal (Zustand/Context)
- [ ] URL state for shareable views
- [ ] Form state with React Hook Form
- [ ] No prop drilling beyond 2 levels

### Performance
- [ ] Code splitting at route level
- [ ] Lazy loading for heavy components
- [ ] Images optimized (next/image)
- [ ] Virtual scrolling for long lists
- [ ] Debounced search inputs
- [ ] No unnecessary re-renders

### Accessibility
- [ ] Semantic HTML elements
- [ ] ARIA labels where needed
- [ ] Keyboard navigation works
- [ ] Focus management on route change
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader tested

### Developer Experience
- [ ] TypeScript strict mode
- [ ] Component documentation/Storybook
- [ ] Consistent file structure
- [ ] ESLint rules enforced
- [ ] Import aliases configured
- [ ] Testing utilities available
```

### Component Design Patterns

```tsx
// GOOD: Well-structured component with proper handling
interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  isLoading?: boolean;
  error?: Error | null;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

export function DataTable<T>({
  data,
  columns,
  isLoading = false,
  error = null,
  emptyMessage = 'No data available',
  onRowClick,
  pagination,
}: DataTableProps<T>) {
  // Error state
  if (error) {
    return (
      <div role="alert" className="text-destructive p-4 text-center">
        <AlertCircle className="h-6 w-6 mx-auto mb-2" />
        <p>Failed to load data: {error.message}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading data">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground p-8 text-center">
        <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // Data state
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.id}>{col.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow
              key={i}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? 'cursor-pointer hover:bg-muted' : ''}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && onRowClick) {
                  onRowClick(row);
                }
              }}
            >
              {columns.map((col) => (
                <TableCell key={col.id}>{col.cell(row)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pagination && (
        <Pagination
          currentPage={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={pagination.onPageChange}
        />
      )}
    </div>
  );
}
```

---

## 🔐 EXPERT: SECURITY ENGINEER

### Role
Identifies vulnerabilities, designs secure architectures, and ensures compliance. Focuses on defense in depth and least privilege.

### Perspective Questions
When reviewing for security, ask:
1. What's the attack surface?
2. Is input validated and sanitized?
3. Are secrets properly managed?
4. What data is exposed?
5. Is there an audit trail?

### Security Review Checklist

```markdown
## Security Review Checklist

### Authentication
- [ ] Passwords hashed with bcrypt/argon2
- [ ] Session tokens secure and rotated
- [ ] MFA available and encouraged
- [ ] Account lockout after failed attempts
- [ ] Password reset tokens expire quickly
- [ ] OAuth state parameter validated

### Authorization
- [ ] Role-based access control (RBAC)
- [ ] Resource-level permissions checked
- [ ] Admin functions protected
- [ ] API keys scoped to minimum access
- [ ] JWT claims validated server-side
- [ ] No authorization in client code alone

### Data Protection
- [ ] Sensitive data encrypted at rest
- [ ] TLS for all connections
- [ ] PII minimized and protected
- [ ] Database credentials rotated
- [ ] Backups encrypted
- [ ] Data retention policies enforced

### Input Security
- [ ] All input validated server-side
- [ ] SQL injection prevented
- [ ] XSS prevented (output encoding)
- [ ] CSRF tokens on state-changing forms
- [ ] File uploads validated and sandboxed
- [ ] URL redirects validated

### Infrastructure
- [ ] Security headers set (CSP, HSTS, etc.)
- [ ] Dependencies scanned for vulnerabilities
- [ ] Network segmentation
- [ ] Secrets in vault, not code
- [ ] Logging without sensitive data
- [ ] Error messages don't leak info
```

### Security Implementation Examples

```typescript
// Input validation with Zod
import { z } from 'zod';

const userInputSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100).regex(/^[\p{L}\s'-]+$/u, 'Invalid characters'),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal('')),
});

// CSRF protection middleware
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

export function generateCsrfToken(): string {
  const token = randomBytes(32).toString('hex');
  cookies().set('csrf', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  return token;
}

export function validateCsrfToken(token: string): boolean {
  const stored = cookies().get('csrf')?.value;
  if (!stored || !token) return false;
  
  // Timing-safe comparison
  return timingSafeEqual(Buffer.from(stored), Buffer.from(token));
}

// SQL injection prevention (Drizzle ORM handles this)
// GOOD: Parameterized query
const users = await db
  .select()
  .from(users)
  .where(eq(users.email, userEmail)); // Safe - parameterized

// BAD: String interpolation (NEVER DO THIS)
// await db.execute(`SELECT * FROM users WHERE email = '${userEmail}'`);

// XSS prevention in React (automatic)
// React escapes by default. Only dangerous with dangerouslySetInnerHTML
// If you must use it, sanitize first:
import DOMPurify from 'dompurify';

function SafeHTML({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href'],
  });
  
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

// Security headers (next.config.js)
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { 
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
  },
];
```

---

## 🧪 EXPERT: QA ENGINEER

### Role
Ensures software quality through testing strategies, test automation, and quality processes. Focuses on coverage, reliability, and user experience.

### Perspective Questions
When reviewing for quality, ask:
1. What could go wrong?
2. Are edge cases covered?
3. Is this testable in isolation?
4. What's the test coverage?
5. How will we know if this breaks?

### Testing Strategy Checklist

```markdown
## Testing Strategy Review

### Unit Tests
- [ ] Pure functions have unit tests
- [ ] Complex business logic tested
- [ ] Edge cases covered (null, empty, boundary)
- [ ] Error paths tested
- [ ] Mocking kept minimal
- [ ] Tests are deterministic

### Integration Tests
- [ ] API endpoints tested
- [ ] Database operations tested
- [ ] External service mocks in place
- [ ] Happy path and error paths
- [ ] Authentication tested
- [ ] Authorization tested

### E2E Tests
- [ ] Critical user journeys covered
- [ ] Sign up flow tested
- [ ] Payment flow tested
- [ ] Core feature workflows tested
- [ ] Cross-browser testing
- [ ] Mobile responsive testing

### Quality Processes
- [ ] Tests run in CI/CD
- [ ] Coverage thresholds enforced
- [ ] Visual regression testing
- [ ] Performance benchmarks
- [ ] Accessibility testing automated
- [ ] Error monitoring in place
```

### Test Examples

```typescript
// Unit test with Vitest
import { describe, it, expect, vi } from 'vitest';
import { calculatePrice, applyDiscount } from './pricing';

describe('calculatePrice', () => {
  it('calculates price correctly for single item', () => {
    expect(calculatePrice(1, 1000)).toBe(1000);
  });

  it('applies quantity discounts', () => {
    // 10% off for 5+ items
    expect(calculatePrice(5, 1000)).toBe(4500);
    expect(calculatePrice(10, 1000)).toBe(9000);
  });

  it('handles zero quantity', () => {
    expect(calculatePrice(0, 1000)).toBe(0);
  });

  it('throws for negative quantity', () => {
    expect(() => calculatePrice(-1, 1000)).toThrow('Invalid quantity');
  });
});

describe('applyDiscount', () => {
  it('applies percentage discount', () => {
    expect(applyDiscount(10000, { type: 'percentage', value: 20 })).toBe(8000);
  });

  it('applies fixed discount', () => {
    expect(applyDiscount(10000, { type: 'fixed', value: 2500 })).toBe(7500);
  });

  it('does not go below zero', () => {
    expect(applyDiscount(1000, { type: 'fixed', value: 5000 })).toBe(0);
  });

  it('handles expired discount codes', () => {
    const expiredDiscount = {
      type: 'percentage',
      value: 20,
      expiresAt: new Date('2020-01-01'),
    };
    expect(applyDiscount(10000, expiredDiscount)).toBe(10000);
  });
});

// Integration test for API
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestClient } from '@/test/utils';
import { db } from '@/db';
import { users } from '@/db/schema';

describe('POST /api/users', () => {
  const client = createTestClient();

  beforeEach(async () => {
    await db.delete(users); // Clean slate
  });

  it('creates user with valid data', async () => {
    const response = await client.post('/api/users', {
      body: {
        email: 'test@example.com',
        name: 'Test User',
      },
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      email: 'test@example.com',
      name: 'Test User',
    });
    expect(response.body.id).toBeDefined();
  });

  it('rejects duplicate email', async () => {
    // Create first user
    await client.post('/api/users', {
      body: { email: 'test@example.com', name: 'First' },
    });

    // Try to create second with same email
    const response = await client.post('/api/users', {
      body: { email: 'test@example.com', name: 'Second' },
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Email already exists');
  });

  it('validates email format', async () => {
    const response = await client.post('/api/users', {
      body: { email: 'not-an-email', name: 'Test' },
    });

    expect(response.status).toBe(400);
  });
});

// E2E test with Playwright
import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test('completes purchase successfully', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    // Add item to cart
    await page.goto('/products');
    await page.click('[data-testid="product-1"] button');
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1');

    // Go to checkout
    await page.click('[data-testid="cart-button"]');
    await page.click('[data-testid="checkout-button"]');

    // Fill payment (Stripe test card)
    const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
    await stripeFrame.locator('[name="cardnumber"]').fill('4242424242424242');
    await stripeFrame.locator('[name="exp-date"]').fill('12/30');
    await stripeFrame.locator('[name="cvc"]').fill('123');

    // Complete purchase
    await page.click('[data-testid="pay-button"]');

    // Verify success
    await expect(page).toHaveURL(/\/orders\/\w+/);
    await expect(page.locator('h1')).toContainText('Order Confirmed');
  });
});
```

---

## ⚙️ EXPERT: DEVOPS ENGINEER

### Role
Designs CI/CD pipelines, infrastructure, and deployment strategies. Focuses on automation, reliability, and developer productivity.

### Perspective Questions
When reviewing for DevOps, ask:
1. How is this deployed?
2. Can we roll back quickly?
3. What's the blast radius of a failure?
4. Are there manual steps that could be automated?
5. Is infrastructure as code?

### DevOps Checklist

```markdown
## DevOps Review

### CI/CD Pipeline
- [ ] Automated tests on every PR
- [ ] Lint and type check enforced
- [ ] Build step verified
- [ ] Preview deployments available
- [ ] Production deploy requires approval
- [ ] Deployment notifications

### Infrastructure
- [ ] Infrastructure as code (Terraform/Pulumi)
- [ ] Environment parity (dev/staging/prod)
- [ ] Secrets management (Vault/AWS Secrets)
- [ ] Auto-scaling configured
- [ ] Disaster recovery plan
- [ ] Database backups automated

### Monitoring & Observability
- [ ] Application monitoring (Sentry)
- [ ] Infrastructure monitoring
- [ ] Log aggregation
- [ ] Alerting configured
- [ ] On-call rotation
- [ ] Runbooks documented

### Deployment Strategy
- [ ] Zero-downtime deployments
- [ ] Database migrations safe
- [ ] Feature flags for risky changes
- [ ] Rollback procedure documented
- [ ] Canary deployments available
- [ ] Blue-green if needed
```

### CI/CD Pipeline Example (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run test:ci
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/test
      - uses: codecov/codecov-action@v3

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: .next

  e2e:
    needs: [lint, test, build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - uses: actions/download-artifact@v4
        with:
          name: build
          path: .next
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report
```

---

## 📋 EXPERT: PRODUCT MANAGER

### Role
Defines product requirements, prioritizes features, and ensures user value. Focuses on user needs, business goals, and technical feasibility.

### Perspective Questions
When reviewing features, ask:
1. What problem does this solve?
2. Who is the target user?
3. What's the success metric?
4. Is this the MVP or full scope?
5. What's the priority vs other work?

### Product Review Checklist

```markdown
## Product Review

### Requirements Clarity
- [ ] Problem statement clear
- [ ] Target user defined
- [ ] Success metrics identified
- [ ] Acceptance criteria specific
- [ ] Edge cases documented
- [ ] Out of scope noted

### User Experience
- [ ] User flow documented
- [ ] Error states defined
- [ ] Empty states designed
- [ ] Loading states considered
- [ ] Mobile experience addressed
- [ ] Accessibility requirements noted

### Business Alignment
- [ ] Aligns with company goals
- [ ] ROI justification exists
- [ ] Competitive analysis done
- [ ] Legal/compliance reviewed
- [ ] Pricing impact considered
- [ ] Support implications noted

### Technical Feasibility
- [ ] Engineering estimate provided
- [ ] Technical risks identified
- [ ] Dependencies mapped
- [ ] Migration path defined
- [ ] Rollout strategy planned
- [ ] Monitoring requirements
```

---

## 📱 EXPERT: MOBILE DEVELOPER

### Role
Builds mobile applications and ensures cross-platform consistency. Focuses on performance, native feel, and offline capabilities.

### Perspective Questions
When reviewing mobile code, ask:
1. Does this work offline?
2. Is the UX native-feeling?
3. How does this handle slow networks?
4. Battery impact?
5. App store compliance?

### Mobile Development Checklist

```markdown
## Mobile Development Review

### User Experience
- [ ] Native navigation patterns
- [ ] Gesture support (swipe, pinch)
- [ ] Haptic feedback where appropriate
- [ ] Pull to refresh
- [ ] Smooth animations (60fps)
- [ ] Adaptive layouts

### Performance
- [ ] Fast app launch (<2s)
- [ ] Efficient list rendering
- [ ] Image optimization
- [ ] Memory management
- [ ] Battery optimization
- [ ] Network efficiency

### Offline Support
- [ ] Core features work offline
- [ ] Data syncs when online
- [ ] Conflict resolution
- [ ] Offline indicators
- [ ] Queue for actions
- [ ] Cache invalidation

### Platform Specifics
- [ ] iOS Human Interface Guidelines
- [ ] Android Material Design
- [ ] Platform permissions handled
- [ ] Deep linking configured
- [ ] Push notifications work
- [ ] App store requirements met
```

---

**Module complete.** This module provides expert perspectives for Backend, Frontend, Security, QA, DevOps, Product Management, and Mobile development roles.
