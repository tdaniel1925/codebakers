# CORE DEVELOPMENT STANDARDS
# Module: 00-core.md
# Always load this module first

---

# PART 1: CORE DEVELOPMENT STANDARDS

## 🚦 DECISION: What Type of Task?

### If working on a NEW PROJECT:
→ Follow all standards from Part 1 onwards

### If asked to REVIEW/FIX an EXISTING PROJECT:
→ First complete **PART 3: CODE AUDIT PROTOCOL**
→ Then apply fixes following all standards

### If asked to ADD A FEATURE to an existing project:
1. Quick audit of related code (Part 3, Steps 1-2)
2. Follow all standards for new code
3. Fix any issues found in related code while adding feature
4. Run automated tests (Part 2)

---

## 🧠 MANDATORY THINKING PROTOCOL

**BEFORE WRITING ANY CODE**, you MUST complete this mental checklist silently:

```
□ What is the user actually asking for?
□ What are ALL the components needed (UI, API, DB, types)?
□ What are the edge cases?
□ What error handling is required?
□ What loading/empty states are needed?
□ How does this integrate with existing code?
□ What security implications exist?
□ What tests will verify this works?
□ What could break in production?
```

**NEVER skip this step. NEVER.**

If a task is complex, break it down:
```
1. First, I'll create the database schema
2. Then, I'll build the API endpoint
3. Then, I'll create the UI component
4. Then, I'll add error handling
5. Then, I'll write and run tests
6. Finally, I'll report results
```

---

## 🚫 ABSOLUTE PROHIBITIONS

These will NEVER appear in your code under ANY circumstances:

```typescript
// ❌ BANNED FOREVER - NON-FUNCTIONAL CODE
onClick={handleClick}        // where handleClick doesn't exist
onSubmit={handleSubmit}      // where handleSubmit doesn't exist
onChange={handleChange}      // where handleChange doesn't exist
href="/some-page"            // where the page doesn't exist

// ❌ BANNED FOREVER - INCOMPLETE CODE
TODO:                        // No TODOs ever
FIXME:                       // No FIXMEs ever
// ...                       // No placeholder comments
/* implement later */        // No deferred implementation
throw new Error('Not implemented')  // No unimplemented functions

// ❌ BANNED FOREVER - DEBUG CODE
console.log('test')          // No debug logs in final code
console.log(data)            // No data dumps
debugger;                    // No debugger statements

// ❌ BANNED FOREVER - TYPE SAFETY VIOLATIONS
any                          // No 'any' types without justification
@ts-ignore                   // No ignoring TypeScript
@ts-expect-error             // No expecting errors
as any                       // No casting to any
!.                           // No non-null assertions without checks

// ❌ BANNED FOREVER - SECURITY VIOLATIONS
eval()                       // No eval ever
innerHTML =                  // No direct innerHTML (use sanitization)
dangerouslySetInnerHTML      // Without DOMPurify sanitization
document.write()             // No document.write
```

---

## ✅ MANDATORY PATTERNS

### Every Button MUST Have:

```typescript
// ✅ CORRECT - Fully functional button
<Button 
  onClick={handleAction}
  disabled={isLoading || isDisabled}
  aria-label="Descriptive action name"
  aria-busy={isLoading}
>
  {isLoading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Processing...
    </>
  ) : (
    'Action Name'
  )}
</Button>

// The handler MUST exist and be complete:
const handleAction = async () => {
  setIsLoading(true);
  try {
    await performAction();
    toast.success('Action completed successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Action failed';
    toast.error(message);
  } finally {
    setIsLoading(false);
  }
};
```

### Every Form MUST Have:

```typescript
// ✅ CORRECT - Fully functional form
'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
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

const formSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type FormData = z.infer<typeof formSchema>;

export function ContactForm({ onSuccess }: { onSuccess?: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      name: '',
      message: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send message');
      }

      toast.success('Message sent successfully!');
      form.reset();
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Your name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea placeholder="Your message..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            'Send Message'
          )}
        </Button>
      </form>
    </Form>
  );
}
```

### Every Async Operation MUST Have:

```typescript
// ✅ CORRECT - Complete async handling
const [data, setData] = useState<DataType | null>(null);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const fetchData = async () => {
  setIsLoading(true);
  setError(null);
  
  try {
    const response = await fetch('/api/data');
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    setData(result.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch data';
    setError(message);
    toast.error(message);
  } finally {
    setIsLoading(false);
  }
};
```

### Every List MUST Have:

```typescript
// ✅ CORRECT - Complete list with all states
interface ItemListProps {
  items: Item[];
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  onItemClick?: (item: Item) => void;
}

export function ItemList({ items, isLoading, error, onRetry, onItemClick }: ItemListProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">{error}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Try Again
          </Button>
        )}
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Package className="h-12 w-12 text-muted-foreground" />
        <div>
          <h3 className="font-medium">No items found</h3>
          <p className="text-sm text-muted-foreground">
            Get started by creating your first item.
          </p>
        </div>
      </div>
    );
  }

  // Success state with data
  return (
    <ul className="divide-y divide-border" role="list">
      {items.map((item) => (
        <li 
          key={item.id}
          onClick={() => onItemClick?.(item)}
          className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
          role="listitem"
        >
          <span>{item.name}</span>
        </li>
      ))}
    </ul>
  );
}
```

---

## 📁 PROJECT STRUCTURE

```
project-root/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/              # Routes requiring authentication
│   │   │   ├── dashboard/
│   │   │   ├── settings/
│   │   │   └── layout.tsx       # Auth check wrapper
│   │   ├── (public)/            # Public routes
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   └── layout.tsx
│   │   ├── (marketing)/         # Marketing pages
│   │   │   ├── page.tsx         # Homepage
│   │   │   ├── pricing/
│   │   │   └── about/
│   │   ├── api/                 # API routes
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── webhooks/
│   │   │   └── health/
│   │   ├── layout.tsx           # Root layout
│   │   ├── loading.tsx          # Global loading
│   │   ├── error.tsx            # Global error
│   │   └── not-found.tsx        # 404 page
│   │
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── forms/               # Form components
│   │   ├── layouts/             # Layout components
│   │   └── [feature]/           # Feature-specific components
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts        # Browser client
│   │   │   ├── server.ts        # Server client
│   │   │   ├── admin.ts         # Service role client
│   │   │   └── middleware.ts    # Auth middleware
│   │   ├── utils.ts             # Utility functions
│   │   ├── validations.ts       # Zod schemas
│   │   ├── constants.ts         # App constants
│   │   └── errors.ts            # Error classes
│   │
│   ├── db/
│   │   ├── schema.ts            # Drizzle schema
│   │   ├── index.ts             # DB client
│   │   └── migrations/          # SQL migrations
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── use-user.ts
│   │   ├── use-debounce.ts
│   │   └── use-media-query.ts
│   │
│   ├── types/                   # TypeScript types
│   │   ├── database.ts
│   │   ├── api.ts
│   │   └── index.ts
│   │
│   ├── services/                # Business logic
│   │   ├── user-service.ts
│   │   ├── email-service.ts
│   │   └── payment-service.ts
│   │
│   └── styles/
│       └── globals.css
│
├── tests/                       # Playwright tests
│   ├── e2e/                     # End-to-end tests
│   ├── fixtures/                # Test fixtures
│   └── utils/                   # Test utilities
│
├── public/                      # Static assets
├── drizzle.config.ts           # Drizzle config
├── playwright.config.ts        # Playwright config
├── tailwind.config.ts          # Tailwind config
├── tsconfig.json               # TypeScript config
├── package.json
├── .env.example
└── CLAUDE.md                   # This file
```

---

## 🔧 TYPESCRIPT STANDARDS

### Type Definitions

```typescript
// ✅ CORRECT - Proper type definitions
// types/database.ts

// Use type for object shapes
export type User = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

// Use enum for fixed sets of values
export enum UserRole {
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

// Use interface for extendable contracts
export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

// Extend interfaces when needed
export interface AuditableEntity extends Timestamps {
  createdBy: string;
  updatedBy: string;
}

// Use generics for reusable types
export type ApiResponse<T> = {
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
};

export type ApiError = {
  error: string;
  code: string;
  details?: Record<string, string[]>;
};

// Use discriminated unions for state
export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };
```

### Function Typing

```typescript
// ✅ CORRECT - Properly typed functions

// Always specify return types for public functions
export async function getUserById(id: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
}

// Use function overloads when needed
export function formatDate(date: Date): string;
export function formatDate(date: Date, format: 'short'): string;
export function formatDate(date: Date, format: 'long'): string;
export function formatDate(date: Date, format?: 'short' | 'long'): string {
  if (format === 'short') {
    return date.toLocaleDateString();
  }
  if (format === 'long') {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  return date.toISOString();
}

// Use type predicates for type guards
export function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value &&
    typeof (value as User).id === 'string' &&
    typeof (value as User).email === 'string'
  );
}
```

---

# PART 2: MANDATORY TESTING PROTOCOL

## 🧪 AUTO-TESTING REQUIREMENT

**After building ANY feature, you MUST automatically test it.**

This is NOT optional. This is NOT a suggestion. You MUST test before saying "done."

---

## 🚀 TESTING SETUP

### First-Time Setup (Run Automatically When User Says "Set Up Testing")

```bash
# When user says "set up testing" or "enable testing", run this:

# Step 1: Check if Playwright exists
if ! grep -q "@playwright/test" package.json 2>/dev/null; then
  echo "📦 Installing Playwright..."
  npm install -D @playwright/test
  
  echo "🌐 Installing Chromium browser..."
  npx playwright install chromium
  
  echo "✅ Playwright installed!"
else
  echo "✅ Playwright already installed!"
fi

# Step 2: Create config if it doesn't exist
if [ ! -f "playwright.config.ts" ]; then
  echo "⚙️ Creating Playwright config..."
  cat > playwright.config.ts << 'PLAYWRIGHT_CONFIG'
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
PLAYWRIGHT_CONFIG
  echo "✅ Config created!"
fi

# Step 3: Create tests directory structure
mkdir -p tests/e2e tests/fixtures tests/utils

# Step 4: Create test utilities
cat > tests/utils/helpers.ts << 'TEST_HELPERS'
import { Page, expect } from '@playwright/test';

// Wait for page to be fully loaded
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
}

// Fill form field with label
export async function fillField(page: Page, label: string, value: string) {
  await page.getByLabel(label).fill(value);
}

// Click button by text
export async function clickButton(page: Page, text: string) {
  await page.getByRole('button', { name: text }).click();
}

// Check for toast message
export async function expectToast(page: Page, message: string) {
  await expect(page.getByText(message)).toBeVisible({ timeout: 5000 });
}

// Check for error message
export async function expectError(page: Page, message: string) {
  await expect(page.getByText(message)).toBeVisible();
}

// Login helper
export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await fillField(page, 'Email', email);
  await fillField(page, 'Password', password);
  await clickButton(page, 'Sign In');
  await page.waitForURL('/dashboard');
}
TEST_HELPERS

# Step 5: Create example test
cat > tests/e2e/example.spec.ts << 'EXAMPLE_TEST'
import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/./); // Has some title
  });
});
EXAMPLE_TEST

# Step 6: Add test scripts to package.json
npm pkg set scripts.test="playwright test"
npm pkg set scripts.test:ui="playwright test --ui"
npm pkg set scripts.test:headed="playwright test --headed"
npm pkg set scripts.test:debug="playwright test --debug"

echo ""
echo "🎉 Testing setup complete!"
echo ""
echo "From now on, I will automatically:"
echo "  1. Write tests for features I build"
echo "  2. Run the tests"
echo "  3. Report what works and what doesn't"
echo "  4. Fix any failures and retest"
echo ""
echo "You can also run tests manually:"
echo "  npm test           - Run all tests"
echo "  npm run test:ui    - Open test UI"
echo "  npm run test:debug - Debug tests"
```

---

## 🤖 AUTO-TEST DECISION LOGIC

### When To Test (ALWAYS)

```
ALWAYS TEST:
├── Forms (submission, validation, errors)
├── Buttons that trigger actions
├── Authentication flows
├── Payment flows
├── CRUD operations
├── API endpoints
├── File uploads
├── User flows (multi-step)
├── Protected routes
└── Data mutations

QUICK TEST:
├── Navigation links
├── Modal open/close
├── Dropdown functionality
├── Tab switching
├── Search/filter
└── Pagination

SKIP TESTING:
├── Static text content
├── Pure styling changes
├── CSS/color changes
├── Import reorganization
├── Comment changes
├── Variable renaming
└── Type-only changes
```

### Test Depth By Feature Type

```
🔴 CRITICAL (Maximum Testing):
   - Payments/Billing → Full flow + edge cases + failure modes
   - Authentication → All paths + security + session handling
   - Data deletion → Soft delete, hard delete, cascades
   
🟡 STANDARD (Normal Testing):
   - Forms → Submit, validation, error display
   - CRUD → Create, read, update, delete
   - Lists → Load, empty, error, pagination
   
🟢 LIGHT (Basic Testing):
   - Navigation → Links work, routes exist
   - UI interactions → Opens, closes, toggles
```

---

## 📝 TEST TEMPLATE LIBRARY

### Form Test Template

```typescript
// tests/e2e/forms/[form-name].spec.ts
import { test, expect } from '@playwright/test';
import { fillField, clickButton, expectToast, expectError } from '../utils/helpers';

test.describe('[Form Name] Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/path-to-form');
  });

  test('renders all form fields', async ({ page }) => {
    await expect(page.getByLabel('Field 1')).toBeVisible();
    await expect(page.getByLabel('Field 2')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
  });

  test('shows validation errors for empty submission', async ({ page }) => {
    await clickButton(page, 'Submit');
    await expectError(page, 'Field 1 is required');
  });

  test('shows validation error for invalid email', async ({ page }) => {
    await fillField(page, 'Email', 'not-an-email');
    await clickButton(page, 'Submit');
    await expectError(page, 'Please enter a valid email');
  });

  test('submits successfully with valid data', async ({ page }) => {
    await fillField(page, 'Name', 'Test User');
    await fillField(page, 'Email', 'test@example.com');
    await fillField(page, 'Message', 'This is a test message');
    await clickButton(page, 'Submit');
    await expectToast(page, 'Message sent successfully');
  });

  test('shows loading state during submission', async ({ page }) => {
    await fillField(page, 'Name', 'Test User');
    await fillField(page, 'Email', 'test@example.com');
    await fillField(page, 'Message', 'This is a test message');
    
    // Click and immediately check for loading
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText('Sending...')).toBeVisible();
  });

  test('handles server error gracefully', async ({ page }) => {
    // Mock API failure
    await page.route('/api/contact', route => 
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) })
    );
    
    await fillField(page, 'Name', 'Test User');
    await fillField(page, 'Email', 'test@example.com');
    await fillField(page, 'Message', 'This is a test message');
    await clickButton(page, 'Submit');
    await expectToast(page, 'Server error');
  });
});
```

### Authentication Test Template

```typescript
// tests/e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test';
import { fillField, clickButton, expectToast } from '../utils/helpers';

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders login form', async ({ page }) => {
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await fillField(page, 'Email', 'wrong@example.com');
    await fillField(page, 'Password', 'wrongpassword');
    await clickButton(page, 'Sign In');
    await expectToast(page, 'Invalid email or password');
  });

  test('redirects to dashboard on successful login', async ({ page }) => {
    await fillField(page, 'Email', 'test@example.com');
    await fillField(page, 'Password', 'correctpassword');
    await clickButton(page, 'Sign In');
    await page.waitForURL('/dashboard');
    await expect(page.url()).toContain('/dashboard');
  });

  test('shows loading state during login', async ({ page }) => {
    await fillField(page, 'Email', 'test@example.com');
    await fillField(page, 'Password', 'correctpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Signing in...')).toBeVisible();
  });

  test('password field hides input', async ({ page }) => {
    const passwordField = page.getByLabel('Password');
    await expect(passwordField).toHaveAttribute('type', 'password');
  });

  test('has link to forgot password', async ({ page }) => {
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
  });

  test('has link to sign up', async ({ page }) => {
    await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
  });
});
```

### CRUD Test Template

```typescript
// tests/e2e/[resource]/crud.spec.ts
import { test, expect } from '@playwright/test';
import { login, fillField, clickButton, expectToast } from '../utils/helpers';

test.describe('[Resource] CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'test@example.com', 'password');
    await page.goto('/[resource]');
  });

  test('displays list of [resources]', async ({ page }) => {
    await expect(page.getByRole('list')).toBeVisible();
  });

  test('shows empty state when no [resources]', async ({ page }) => {
    // Mock empty response
    await page.route('/api/[resource]', route => 
      route.fulfill({ status: 200, body: JSON.stringify({ data: [] }) })
    );
    await page.reload();
    await expect(page.getByText('No [resources] found')).toBeVisible();
  });

  test('creates new [resource]', async ({ page }) => {
    await clickButton(page, 'Create [Resource]');
    await fillField(page, 'Name', 'Test Resource');
    await clickButton(page, 'Save');
    await expectToast(page, '[Resource] created successfully');
    await expect(page.getByText('Test Resource')).toBeVisible();
  });

  test('edits existing [resource]', async ({ page }) => {
    await page.getByText('Existing Resource').click();
    await clickButton(page, 'Edit');
    await fillField(page, 'Name', 'Updated Resource');
    await clickButton(page, 'Save');
    await expectToast(page, '[Resource] updated successfully');
    await expect(page.getByText('Updated Resource')).toBeVisible();
  });

  test('deletes [resource] with confirmation', async ({ page }) => {
    await page.getByText('Resource to Delete').click();
    await clickButton(page, 'Delete');
    
    // Confirm deletion dialog
    await expect(page.getByText('Are you sure?')).toBeVisible();
    await clickButton(page, 'Confirm Delete');
    
    await expectToast(page, '[Resource] deleted successfully');
    await expect(page.getByText('Resource to Delete')).not.toBeVisible();
  });

  test('shows error when creation fails', async ({ page }) => {
    await page.route('/api/[resource]', route => 
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Creation failed' }) })
    );
    
    await clickButton(page, 'Create [Resource]');
    await fillField(page, 'Name', 'Test Resource');
    await clickButton(page, 'Save');
    await expectToast(page, 'Creation failed');
  });
});
```

### API Endpoint Test Template

```typescript
// tests/e2e/api/[endpoint].spec.ts
import { test, expect } from '@playwright/test';

test.describe('API: /api/[endpoint]', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  test('GET returns data for authenticated user', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/[endpoint]`, {
      headers: {
        'Authorization': 'Bearer test-token',
      },
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('data');
  });

  test('GET returns 401 for unauthenticated request', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/[endpoint]`);
    expect(response.status()).toBe(401);
  });

  test('POST creates resource with valid data', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/[endpoint]`, {
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      data: {
        name: 'Test Resource',
      },
    });
    
    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.data).toHaveProperty('id');
    expect(data.data.name).toBe('Test Resource');
  });

  test('POST returns 400 for invalid data', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/[endpoint]`, {
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      data: {
        // Missing required fields
      },
    });
    
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('DELETE removes resource', async ({ request }) => {
    const response = await request.delete(`${baseURL}/api/[endpoint]/test-id`, {
      headers: {
        'Authorization': 'Bearer test-token',
      },
    });
    
    expect(response.status()).toBe(200);
  });

  test('DELETE returns 404 for non-existent resource', async ({ request }) => {
    const response = await request.delete(`${baseURL}/api/[endpoint]/non-existent`, {
      headers: {
        'Authorization': 'Bearer test-token',
      },
    });
    
    expect(response.status()).toBe(404);
  });
});
```

---

## 📊 TEST REPORTING FORMAT

### After Running Tests, ALWAYS Report Like This:

```markdown
## 🧪 Testing Report: [Feature Name]

**What I Built:**
[Brief 1-2 sentence description]

**Tests Run:**
- Total: X tests
- Passed: X ✅
- Failed: X ❌
- Skipped: X ⏭️

**What Works:**
- ✅ [Specific functionality that passed]
- ✅ [Specific functionality that passed]
- ✅ [Specific functionality that passed]

**What Doesn't Work:**
- ❌ [Specific failure] - [Brief reason]
- ❌ [Specific failure] - [Brief reason]

**Screenshots/Evidence:**
[If failures, describe what was seen]

---

**Want me to fix these issues and test again? (yes/no)**
```

### Example Report:

```markdown
## 🧪 Testing Report: Contact Form

**What I Built:**
Contact form with name, email, message fields, validation, and API submission.

**Tests Run:**
- Total: 8 tests
- Passed: 6 ✅
- Failed: 2 ❌
- Skipped: 0 ⏭️

**What Works:**
- ✅ Form renders all fields correctly
- ✅ Validation shows error for empty fields
- ✅ Validation shows error for invalid email format
- ✅ Loading spinner displays during submission
- ✅ Form clears after successful submission
- ✅ Success toast appears after submission

**What Doesn't Work:**
- ❌ Server error handling - Toast shows "undefined" instead of error message
- ❌ Submit button stays disabled after error - Should re-enable

---

**Want me to fix these issues and test again?**
```

---

## 🔄 FIX AND RETEST LOOP

When user says "yes" to fixing:

1. **Identify Root Cause**
   ```
   Analyzing failure: "Server error handling"
   Root cause: Error response not being parsed correctly
   ```

2. **Show The Fix**
   ```typescript
   // Before (broken):
   } catch (error) {
     toast.error(error.message);
   }
   
   // After (fixed):
   } catch (error) {
     const message = error instanceof Error ? error.message : 'Something went wrong';
     toast.error(message);
   }
   ```

3. **Run Tests Again**
   ```
   Running tests...
   ```

4. **Report New Results**
   ```markdown
   ## 🧪 Testing Report: Contact Form (Attempt 2)
   
   **Tests Run:**
   - Total: 8 tests
   - Passed: 8 ✅
   - Failed: 0 ❌
   
   **All Issues Fixed:**
   - ✅ Server error now displays proper message
   - ✅ Submit button re-enables after error
   
   **✅ Feature Complete - All Tests Passing!**
   ```

---

## 🎯 TESTING COMMANDS (Natural Language)

Respond to these user commands:

| User Says | Claude Does |
|-----------|-------------|
| "Set up testing" | Runs setup script |
| "Test this" | Tests the current feature |
| "Test the [feature]" | Tests specific feature |
| "Test everything" | Runs full test suite |
| "Run all tests" | Runs full test suite |
| "Did I break anything?" | Runs full test suite |
| "Is this ready to ship?" | Full test + code audit |
| "Retest" | Runs previous tests again |
| "Yes" / "Fix it" | Fixes failures and retests |

---

# PART 3: CODE AUDIT PROTOCOL

## 🔍 WHEN REVIEWING AN EXISTING CODEBASE

When asked to review, audit, or fix an existing project, follow this systematic protocol:

### Step 1: Project Discovery (ALWAYS DO FIRST)

```bash
# Run these commands to understand the project
cat package.json                    # Dependencies and scripts
cat tsconfig.json                   # TypeScript config  
cat .env.example                    # Required environment variables
ls -la src/                         # Project structure
find . -name "*.md" -type f         # Find documentation
cat README.md                       # Project documentation
```

**Document what you find:**
- Framework (Next.js version, React version)
- Database (Supabase, Prisma, Drizzle, etc.)
- Auth method (Supabase Auth, NextAuth, Clerk, etc.)
- API style (API routes, Server Actions, tRPC)
- UI library (shadcn, MUI, Chakra, etc.)
- Testing setup (Vitest, Jest, Playwright, etc.)

### Step 2: Systematic Code Review Checklist

**Run through EVERY item. Do not skip any.**

#### A. Critical Security Issues (FIX IMMEDIATELY - 🔴)

```
□ API keys/secrets exposed in client-side code
□ Missing authentication on protected routes
□ Missing authorization checks (user accessing other user's data)  
□ SQL injection vulnerabilities (raw queries without parameterization)
□ XSS vulnerabilities (dangerouslySetInnerHTML without sanitization)
□ CSRF vulnerabilities (missing token verification)
□ Missing webhook signature verification
□ Sensitive data in localStorage/sessionStorage
□ Missing rate limiting on public endpoints
□ Hardcoded credentials in codebase
□ JWT secrets in client-side code
□ Insecure password handling (plain text, weak hashing)
□ Missing HTTPS enforcement
□ Exposed stack traces in production errors
□ Missing Content Security Policy headers
```

#### B. Database Issues (🟠)

```
□ Missing RLS policies on Supabase tables
□ N+1 query problems (queries in loops)
□ Missing indexes on frequently queried columns
□ No error handling on database operations
□ Missing transactions for multi-step operations
□ Orphaned records (missing cascade deletes)
□ Missing created_at/updated_at columns
□ No soft delete implementation where needed
□ Missing foreign key constraints
□ Improper UUID generation
□ Missing database connection pooling
□ No query timeout configuration
□ Missing database backups configuration
```

#### C. API/Backend Issues (🟠)

```
□ Endpoints without error handling
□ Missing input validation (no Zod/Yup schemas)
□ Inconsistent error response format
□ Missing authentication middleware
□ No rate limiting
□ Unhandled promise rejections
□ Missing try-catch blocks
□ Console.log statements (should use proper logging)
□ Hardcoded URLs (should be environment variables)
□ Missing CORS configuration
□ No request timeout handling
□ Missing pagination on list endpoints
□ No idempotency keys for mutations
□ Missing request ID for tracing
```

#### D. Frontend Issues (🟡)

```
□ Buttons without onClick handlers
□ Forms without onSubmit handlers
□ Missing loading states during async operations
□ Missing error states and error boundaries
□ Missing empty states for lists
□ No form validation feedback
□ Uncontrolled inputs that should be controlled
□ Missing key props on mapped elements
□ Memory leaks (missing useEffect cleanup)
□ Missing accessibility (aria labels, semantic HTML)
□ Broken responsive design
□ Missing optimistic updates where appropriate
□ No skeleton loaders for content
□ Missing confirmation dialogs for destructive actions
□ Infinite scroll without virtualization (performance)
```

#### E. TypeScript Issues (🟡)

```
□ 'any' types that should be properly typed
□ Missing return types on functions
□ Non-null assertions (!) without validation
□ Type assertions (as) hiding real issues
□ Missing interface/type definitions
□ Inconsistent naming (PascalCase for types)
□ @ts-ignore comments hiding errors
□ Using 'object' instead of proper type
□ Missing generic constraints
□ Improper optional chaining usage
```

#### F. Code Quality Issues (🟢)

```
□ Duplicate code that should be abstracted
□ Functions over 50 lines (should be split)
□ Files over 300 lines (should be split)
□ Deeply nested conditionals (> 3 levels)
□ Magic numbers/strings (should be constants)
□ Dead code (unused functions/variables)
□ TODO/FIXME comments with unimplemented features
□ Inconsistent naming conventions
□ Missing comments on complex logic
□ Circular dependencies
□ Improper error messages (not user-friendly)
□ Missing JSDoc for public functions
```

#### G. Integration Issues (🟠)

```
□ Missing error handling for external API calls
□ No retry logic for transient failures
□ Missing timeout configuration
□ Hardcoded API URLs
□ Missing webhook handlers
□ No idempotency handling for webhooks
□ Missing rate limit handling (429 responses)
□ Token refresh not implemented
□ Expired token errors not handled
□ Missing circuit breaker pattern
□ No fallback for third-party service failures
```

### Step 3: Create Fix Report

Before making ANY changes, create a report:

```markdown
## 🔍 Code Audit Report: [Project Name]

### Project Stack
- Framework: [e.g., Next.js 14]
- Database: [e.g., Supabase + Drizzle]
- Auth: [e.g., Supabase Auth]
- UI: [e.g., shadcn/ui]

### 🔴 Critical Issues (Fix Immediately)
1. [Issue] - [File:Line] - [Impact]
2. ...

### 🟠 High Priority Issues  
1. [Issue] - [File:Line] - [Impact]
2. ...

### 🟡 Medium Priority Issues
1. [Issue] - [File:Line] - [Impact]
2. ...

### 🟢 Low Priority / Improvements
1. [Issue] - [File:Line] - [Impact]
2. ...

### Recommended Fix Order
1. Security issues first
2. Data integrity issues
3. Breaking bugs
4. UX issues  
5. Code quality

### Estimated Fix Time
- Critical: [X hours]
- High Priority: [X hours]
- All Issues: [X hours]
```

### Step 4: Fix Protocol

**For each fix:**
1. Explain what's wrong and why
2. Show the problematic code
3. Show the fixed code
4. Explain what was changed

**Fix in this order:**
1. Security vulnerabilities
2. Data loss/corruption risks
3. Crashes and breaking errors
4. Functional bugs
5. UX issues
6. Performance issues
7. Code quality improvements

---


---

# PART 13: ERROR HANDLING & DEBUGGING

## 🐛 ERROR TAXONOMY

### Error Classes

```typescript
// lib/errors.ts

/**
 * Base application error
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Permission denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  public readonly details: Record<string, string[]>;

  constructor(
    message: string = 'Validation failed',
    details: Record<string, string[]> = {}
  ) {
    super(message, 'VALIDATION_ERROR', 400);
    this.details = details;
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 'CONFLICT', 409);
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super('Too many requests', 'RATE_LIMITED', 429);
    this.retryAfter = retryAfter;
  }
}

/**
 * External service error (502)
 */
export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(service: string, message?: string) {
    super(
      message || `External service error: ${service}`,
      'EXTERNAL_SERVICE_ERROR',
      502
    );
    this.service = service;
  }
}
```

### Error Handler

```typescript
// lib/errors/handler.ts
import { NextResponse } from 'next/server';
import { AppError, ValidationError, RateLimitError } from './errors';

export function handleApiError(error: unknown): NextResponse {
  // Log the error
  console.error('API Error:', error);

  // Handle known errors
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof RateLimitError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      {
        status: error.statusCode,
        headers: {
          'Retry-After': error.retryAfter.toString(),
        },
      }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    );
  }

  // Handle unknown errors
  const message =
    process.env.NODE_ENV === 'development'
      ? error instanceof Error
        ? error.message
        : 'Unknown error'
      : 'Internal server error';

  return NextResponse.json(
    {
      error: message,
      code: 'INTERNAL_ERROR',
    },
    { status: 500 }
  );
}

// Usage in API routes:
export async function POST(req: NextRequest) {
  try {
    // ... handler logic
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Debugging Playbooks

```typescript
// DEBUGGING PLAYBOOKS
// Copy these to troubleshoot common issues

/**
 * PLAYBOOK: Webhook Not Firing
 * 
 * 1. Check webhook URL is publicly accessible
 *    curl -X POST https://your-app.com/api/webhooks/stripe -d '{}'
 * 
 * 2. Verify webhook secret is correct
 *    - Dashboard shows the correct secret
 *    - Environment variable matches
 * 
 * 3. Check webhook signature verification
 *    - Are you using raw body (not parsed JSON)?
 *    - Is the signature header name correct?
 * 
 * 4. Check response status
 *    - Webhooks expect 200 response
 *    - Any 4xx/5xx will trigger retries
 * 
 * 5. Check logs
 *    - Vercel: vercel logs --follow
 *    - Railway: railway logs
 */

/**
 * PLAYBOOK: Token Expired / Auth Failing
 * 
 * 1. Check token storage
 *    - Is token being stored correctly?
 *    - Is token being sent in Authorization header?
 * 
 * 2. Check token refresh logic
 *    - Is refresh token valid?
 *    - Is refresh endpoint working?
 * 
 * 3. Check Supabase session
 *    - supabase.auth.getSession()
 *    - supabase.auth.refreshSession()
 * 
 * 4. Clear cookies and retry
 *    - Browser dev tools > Application > Cookies > Clear
 * 
 * 5. Check middleware
 *    - Is middleware running on all routes?
 *    - Is middleware refreshing session?
 */

/**
 * PLAYBOOK: Database Connection Failed
 * 
 * 1. Check connection string
 *    - DATABASE_URL format is correct
 *    - Password doesn't have special chars (URL encode them)
 * 
 * 2. Check network access
 *    - Is IP whitelisted in Supabase?
 *    - Vercel/Railway IP ranges allowed?
 * 
 * 3. Check connection pooling
 *    - Using ?pgbouncer=true for serverless?
 *    - Connection limit not exceeded?
 * 
 * 4. Test connection
 *    psql $DATABASE_URL -c "SELECT 1"
 */

/**
 * PLAYBOOK: Hydration Mismatch
 * 
 * 1. Check for browser-only code
 *    - window/document usage without checks
 *    - Date/time rendering differences
 * 
 * 2. Check for random values
 *    - Math.random() on server vs client
 *    - UUID generation
 * 
 * 3. Check conditional rendering
 *    - Content differs based on auth state
 *    - useEffect not waiting for mount
 * 
 * 4. Fix pattern:
 *    const [mounted, setMounted] = useState(false);
 *    useEffect(() => setMounted(true), []);
 *    if (!mounted) return null;
 */
```

---


---

# PART 22: FINAL CHECKLIST

## ✅ PRE-COMMIT CHECKLIST

Before committing any code, verify:

```
□ All TypeScript errors resolved (npm run type-check)
□ All ESLint warnings addressed (npm run lint)
□ All tests passing (npm test)
□ No console.log statements
□ No TODO/FIXME comments
□ No hardcoded secrets or URLs
□ All new environment variables documented
□ Loading states implemented
□ Error states implemented
□ Empty states implemented
□ Mobile responsive verified
□ Accessibility basics covered (aria labels, semantic HTML)
```

## ✅ PRE-DEPLOY CHECKLIST

Before deploying to production:

```
□ All environment variables set in hosting platform
□ Database migrations applied
□ Webhook endpoints configured and tested
□ Error tracking (Sentry) configured
□ Analytics (PostHog) configured
□ SSL certificate valid
□ CORS properly configured
□ Rate limiting enabled
□ Security headers configured
□ Health check endpoint working
□ Backup strategy in place
□ Monitoring alerts configured
```

---

# 📊 DOCUMENT STATISTICS

- **Total Sections**: 22
- **Integrations Covered**: 25+
- **Code Examples**: 100+
- **Patterns Documented**: 50+
- **Last Updated**: December 2024
- **Version**: 10.0 Enterprise

---

# 🔄 VERSION HISTORY

- v1.0: Initial boilerplate standards
- v2.0: Added thinking protocol, prohibitions
- v3.0: Added API integrations
- v4.0: Added code audit protocol (70+ items)
- v5.0: Added Retell, GoHighLevel, Stripe, OpenAI
- v6.0: Added Resend, Inngest, testing
- v7.0: Added real-time, performance, deployment
- v8.0: Added multi-tenant SaaS patterns
- v9.0: Added Cal.com, Calendly, PDF generation
- v10.0: **Enterprise Edition** - Added:
  - Mandatory auto-testing with Playwright
  - Test-report-fix loop
  - Complete integration library (20+ services)
  - Security & compliance patterns
  - Caching & rate limiting
  - CI/CD pipelines
  - Error taxonomy & debugging playbooks
  - Email templates
  - Analytics & monitoring
  - Git workflow standards

---

**END OF CLAUDE.md ENTERPRISE EDITION**

---


---

# PART 104: CODE QUALITY RULES

## 🛡️ SELF-REVIEW BEFORE OUTPUT

Before outputting ANY code, verify these rules. Catch your own mistakes.

---

## Security Checks

```markdown
Before ANY code output, verify:

1. NO HARDCODED SECRETS
   ❌ const API_KEY = 'sk_live_abc123';
   ✅ const API_KEY = process.env.STRIPE_SECRET_KEY;

2. NO SQL INJECTION
   ❌ db.query(`SELECT * FROM users WHERE id = ${userId}`);
   ✅ db.select().from(users).where(eq(users.id, userId));

3. AUTH CHECK BEFORE DATA ACCESS
   ❌ const post = await getPost(postId); // Anyone can access
   ✅ const post = await getPost(postId, userId); // Verify ownership

4. SANITIZE USER INPUT
   ❌ <div dangerouslySetInnerHTML={{ __html: userComment }} />
   ✅ <div>{sanitizeHtml(userComment)}</div>

5. VALIDATE ON SERVER (never trust client)
   ❌ if (req.body.isAdmin) grantAccess();
   ✅ if (await checkIsAdmin(session.userId)) grantAccess();
```

---

## Error Handling Checks

```markdown
Before ANY code output, verify:

1. ALL ASYNC HAS TRY/CATCH
   ❌ const data = await fetchData();
   ✅ try { const data = await fetchData(); } catch (e) { ... }

2. ERRORS HAVE USER-FRIENDLY MESSAGES
   ❌ toast.error(error.message); // "Cannot read property 'x' of undefined"
   ✅ toast.error('Failed to save. Please try again.');

3. ERRORS ARE LOGGED WITH CONTEXT
   ❌ console.log(error);
   ✅ console.error('[CreateUser]', { userId, error: error.message });

4. API ERRORS DON'T EXPOSE INTERNALS
   ❌ return NextResponse.json({ error: error.stack }, { status: 500 });
   ✅ return NextResponse.json({ error: 'Internal error' }, { status: 500 });

5. FORM ERRORS SHOW FIELD-LEVEL FEEDBACK
   ❌ alert('Invalid input');
   ✅ setError('email', { message: 'Invalid email format' });
```

---

## TypeScript Checks

```markdown
Before ANY code output, verify:

1. NO 'any' TYPE
   ❌ function process(data: any) { ... }
   ✅ function process(data: UserInput) { ... }

2. NO TYPE ASSERTIONS WITHOUT VALIDATION
   ❌ const user = data as User;
   ✅ const user = userSchema.parse(data);

3. RETURN TYPES ARE EXPLICIT
   ❌ function getUser(id: string) { ... }
   ✅ function getUser(id: string): Promise<User | null> { ... }

4. NULL/UNDEFINED ARE HANDLED
   ❌ return user.name.toUpperCase();
   ✅ return user?.name?.toUpperCase() ?? 'Unknown';

5. ENUMS USE CONST OBJECTS
   ❌ enum Status { Active, Inactive }
   ✅ const Status = { Active: 'active', Inactive: 'inactive' } as const;
```

---

## Code Cleanliness Checks

```markdown
Before ANY code output, verify:

1. NO CONSOLE.LOGS IN PRODUCTION CODE
   ❌ console.log('user:', user);
   ✅ // Remove or use proper logger

2. NO COMMENTED-OUT CODE
   ❌ // const oldImplementation = ...
   ✅ Delete it. Git has history.

3. NO MAGIC NUMBERS
   ❌ if (items.length > 50) { ... }
   ✅ const MAX_ITEMS_PER_PAGE = 50;
       if (items.length > MAX_ITEMS_PER_PAGE) { ... }

4. NO DUPLICATE CODE
   ❌ Same 10 lines in 3 files
   ✅ Extract to shared utility

5. FUNCTIONS DO ONE THING
   ❌ function createUserAndSendEmailAndLogAnalytics() { ... }
   ✅ function createUser() { ... }
       function sendWelcomeEmail() { ... }
       function trackSignup() { ... }
```

---

## Edge Case Checks

```markdown
For EVERY feature, consider:

1. WHAT IF NETWORK FAILS?
   - Show error message
   - Allow retry
   - Don't lose user's input

2. WHAT IF USER DOUBLE-CLICKS?
   - Disable button while loading
   - Use idempotency keys for payments
   - Debounce rapid actions

3. WHAT IF DATA IS EMPTY?
   - Show empty state, not broken UI
   - Provide action to add first item

4. WHAT IF DATA IS HUGE?
   - Paginate
   - Virtualize
   - Show loading states

5. WHAT IF USER IS OFFLINE?
   - Detect offline state
   - Queue actions for retry
   - Show offline indicator

6. WHAT IF SESSION EXPIRES MID-ACTION?
   - Detect 401
   - Redirect to login
   - Preserve intended destination
```

---

## Pre-Output Checklist

```markdown
## Security
- [ ] No hardcoded secrets
- [ ] No SQL injection possible
- [ ] Auth checked before data access
- [ ] User input sanitized
- [ ] Server-side validation exists

## Errors
- [ ] All async has try/catch
- [ ] User-friendly error messages
- [ ] Errors logged with context
- [ ] API errors don't expose internals

## TypeScript
- [ ] No 'any' types
- [ ] Return types explicit
- [ ] Null/undefined handled
- [ ] Proper type validation

## Clean Code
- [ ] No console.logs
- [ ] No commented code
- [ ] No magic numbers
- [ ] No duplicate code
- [ ] Functions do one thing

## Edge Cases
- [ ] Network failure handled
- [ ] Double-click prevented
- [ ] Empty state exists
- [ ] Large data paginated
- [ ] Offline state considered
```

---


---

# PART 108: STRUCTURED LOGGING

## 📊 PRODUCTION-GRADE LOGGING

### Logger Setup

```typescript
// src/lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  userId?: string;
  teamId?: string;
  action?: string;
  duration?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private context: LogContext = {};

  child(context: LogContext): Logger {
    const child = new Logger();
    child.context = { ...this.context, ...context };
    return child;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // In production, send to logging service
    if (process.env.NODE_ENV === 'production') {
      this.sendToLoggingService(entry);
    }

    // Console output (structured in production, pretty in dev)
    const output = process.env.NODE_ENV === 'production'
      ? JSON.stringify(entry)
      : this.formatPretty(entry);

    switch (level) {
      case 'debug': console.debug(output); break;
      case 'info': console.info(output); break;
      case 'warn': console.warn(output); break;
      case 'error': console.error(output); break;
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log('error', message, context, error);
  }

  private formatPretty(entry: LogEntry): string {
    const color = {
      debug: '\x1b[36m',
      info: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
    }[entry.level];
    return `${color}[${entry.level.toUpperCase()}]\x1b[0m ${entry.message} ${JSON.stringify(entry.context)}`;
  }

  private async sendToLoggingService(entry: LogEntry) {
    // Send to Datadog, Logtail, etc.
    await fetch(process.env.LOG_ENDPOINT!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => {}); // Don't fail on logging errors
  }
}

export const logger = new Logger();
```

### Request Logging Middleware

```typescript
// src/middleware/request-logger.ts
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function requestLogger(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  const requestLogger = logger.child({
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
    userAgent: request.headers.get('user-agent') || undefined,
  });

  requestLogger.info('Request started');

  try {
    const response = await handler();

    requestLogger.info('Request completed', {
      status: response.status,
      duration: Date.now() - startTime,
    });

    // Add request ID to response headers
    response.headers.set('x-request-id', requestId);
    return response;
  } catch (error) {
    requestLogger.error('Request failed', error as Error, {
      duration: Date.now() - startTime,
    });
    throw error;
  }
}
```

### Usage Pattern

```typescript
// In API routes
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const log = logger.child({ action: 'createUser' });

  try {
    const body = await req.json();
    log.info('Creating user', { email: body.email });

    const user = await createUser(body);
    log.info('User created', { userId: user.id });

    return NextResponse.json(user);
  } catch (error) {
    log.error('Failed to create user', error as Error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

---

