# FRONTEND PATTERNS
# Module: 04-frontend.md
# Load with: 00-core.md

---

# PART 7: FRONTEND PATTERNS

## 🎨 COMPONENT PATTERNS

### Data Fetching Component

```typescript
// components/features/user-list.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface User {
  id: string;
  name: string;
  email: string;
}

interface UserListProps {
  organizationId: string;
}

export function UserList({ organizationId }: UserListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/users`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch users');
      }

      const { data } = await response.json();
      setUsers(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div>
          <h3 className="font-medium">Failed to load users</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button variant="outline" onClick={fetchUsers}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  // Empty state
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <Users className="h-12 w-12 text-muted-foreground" />
        <div>
          <h3 className="font-medium">No users yet</h3>
          <p className="text-sm text-muted-foreground">
            Invite team members to get started.
          </p>
        </div>
        <Button>Invite User</Button>
      </div>
    );
  }

  // Success state with data
  return (
    <div className="divide-y divide-border rounded-lg border">
      {users.map((user) => (
        <div
          key={user.id}
          className="flex items-center justify-between p-4 hover:bg-muted/50"
        >
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </div>
      ))}
    </div>
  );
}
```

### Modal/Dialog Pattern

```typescript
// components/ui/confirm-dialog.tsx
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button, ButtonProps } from '@/components/ui/button';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ButtonProps['variant'];
  onConfirm: () => Promise<void> | void;
  children: React.ReactNode;
}

export function ConfirmDialog({
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'destructive',
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      setIsOpen(false);
    } catch (error) {
      // Error handling done in onConfirm
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {cancelText}
          </AlertDialogCancel>
          <Button
            variant={variant}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Usage:
// <ConfirmDialog
//   title="Delete User"
//   description="This action cannot be undone."
//   confirmText="Delete"
//   onConfirm={handleDelete}
// >
//   <Button variant="destructive">Delete</Button>
// </ConfirmDialog>
```

### Optimistic Update Pattern

```typescript
// hooks/use-optimistic-mutation.ts
'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface UseOptimisticMutationOptions<T, R> {
  mutationFn: (data: T) => Promise<R>;
  onMutate?: (data: T) => void;
  onSuccess?: (result: R, data: T) => void;
  onError?: (error: Error, data: T) => void;
  onSettled?: () => void;
  successMessage?: string;
  errorMessage?: string;
}

export function useOptimisticMutation<T, R = void>({
  mutationFn,
  onMutate,
  onSuccess,
  onError,
  onSettled,
  successMessage,
  errorMessage = 'Something went wrong',
}: UseOptimisticMutationOptions<T, R>) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (data: T) => {
      setIsLoading(true);
      setError(null);

      // Optimistic update
      onMutate?.(data);

      try {
        const result = await mutationFn(data);
        onSuccess?.(result, data);
        if (successMessage) {
          toast.success(successMessage);
        }
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(errorMessage);
        setError(error);
        onError?.(error, data);
        toast.error(error.message);
        throw error;
      } finally {
        setIsLoading(false);
        onSettled?.();
      }
    },
    [mutationFn, onMutate, onSuccess, onError, onSettled, successMessage, errorMessage]
  );

  return { mutate, isLoading, error };
}

// Usage example:
// const { mutate: deleteUser, isLoading } = useOptimisticMutation({
//   mutationFn: async (userId: string) => {
//     const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
//     if (!response.ok) throw new Error('Failed to delete user');
//   },
//   onMutate: (userId) => {
//     // Optimistically remove from UI
//     setUsers(prev => prev.filter(u => u.id !== userId));
//   },
//   onError: (error, userId) => {
//     // Revert on error
//     refetchUsers();
//   },
//   successMessage: 'User deleted successfully',
// });
```

### Infinite Scroll Pattern

```typescript
// hooks/use-infinite-scroll.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseInfiniteScrollOptions<T> {
  fetchFn: (page: number) => Promise<{ data: T[]; hasMore: boolean }>;
  initialPage?: number;
}

export function useInfiniteScroll<T>({
  fetchFn,
  initialPage = 1,
}: UseInfiniteScrollOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(initialPage);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchFn(page);
      setItems((prev) => [...prev, ...result.data]);
      setHasMore(result.hasMore);
      setPage((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, page, isLoading, hasMore]);

  const lastItemRef = useCallback(
    (node: HTMLElement | null) => {
      if (isLoading) return;

      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      });

      if (node) {
        observerRef.current.observe(node);
      }
    },
    [isLoading, hasMore, loadMore]
  );

  const reset = useCallback(() => {
    setItems([]);
    setPage(initialPage);
    setHasMore(true);
    setError(null);
  }, [initialPage]);

  // Initial load
  useEffect(() => {
    loadMore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    items,
    isLoading,
    hasMore,
    error,
    lastItemRef,
    reset,
    loadMore,
  };
}
```

### Error Boundary

```typescript
// components/error-boundary.tsx
'use client';

import { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught error:', error, errorInfo);
    // Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <div>
            <h3 className="font-medium">Something went wrong</h3>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---


---

# PART 45: FORM HANDLING

## React Hook Form + Zod Pattern

```typescript
// components/forms/profile-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  bio: z.string().max(500, 'Bio must be under 500 characters').optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  defaultValues?: Partial<ProfileFormData>;
  onSubmit: (data: ProfileFormData) => Promise<void>;
}

export function ProfileForm({ defaultValues, onSubmit }: ProfileFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });
  
  const handleFormSubmit = async (data: ProfileFormData) => {
    try {
      await onSubmit(data);
      toast.success('Profile updated');
      reset(data); // Reset form state with new values
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };
  
  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          {...register('name')}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          aria-invalid={!!errors.email}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <textarea
          id="bio"
          {...register('bio')}
          className="w-full min-h-[100px] px-3 py-2 border rounded-md"
          aria-invalid={!!errors.bio}
        />
        {errors.bio && (
          <p className="text-sm text-destructive">{errors.bio.message}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          type="url"
          placeholder="https://example.com"
          {...register('website')}
          aria-invalid={!!errors.website}
        />
        {errors.website && (
          <p className="text-sm text-destructive">{errors.website.message}</p>
        )}
      </div>
      
      <Button type="submit" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  );
}
```

## Multi-Step Form

```typescript
// components/forms/multi-step-form.tsx
'use client';

import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

// Step schemas
const step1Schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const step2Schema = z.object({
  name: z.string().min(2),
  company: z.string().optional(),
});

const step3Schema = z.object({
  plan: z.enum(['free', 'pro', 'enterprise']),
  billingInterval: z.enum(['monthly', 'yearly']),
});

const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema);

type FormData = z.infer<typeof fullSchema>;

const steps = [
  { title: 'Account', schema: step1Schema },
  { title: 'Profile', schema: step2Schema },
  { title: 'Plan', schema: step3Schema },
];

export function MultiStepForm({ onComplete }: { onComplete: (data: FormData) => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  
  const methods = useForm<FormData>({
    resolver: zodResolver(steps[currentStep].schema),
    mode: 'onChange',
  });
  
  const { handleSubmit, trigger } = methods;
  
  const nextStep = async () => {
    const isValid = await trigger();
    if (isValid && currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    }
  };
  
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  };
  
  const onSubmit = (data: FormData) => {
    onComplete(data);
  };
  
  const progress = ((currentStep + 1) / steps.length) * 100;
  
  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            {steps.map((step, i) => (
              <span 
                key={step.title}
                className={i <= currentStep ? 'text-primary' : 'text-muted-foreground'}
              >
                {step.title}
              </span>
            ))}
          </div>
          <Progress value={progress} />
        </div>
        
        {/* Step Content */}
        {currentStep === 0 && <Step1Fields />}
        {currentStep === 1 && <Step2Fields />}
        {currentStep === 2 && <Step3Fields />}
        
        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            Back
          </Button>
          
          {currentStep < steps.length - 1 ? (
            <Button type="button" onClick={nextStep}>
              Next
            </Button>
          ) : (
            <Button type="submit">
              Complete
            </Button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
```

---


---

# PART 46: LOADING STATES & SKELETONS

## Skeleton Components

```typescript
// components/ui/skeleton.tsx
import { cn } from '@/lib/utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

// Usage patterns
export function CardSkeleton() {
  return (
    <div className="rounded-lg border p-6 space-y-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <tr>
      <td className="p-4"><Skeleton className="h-4 w-24" /></td>
      <td className="p-4"><Skeleton className="h-4 w-32" /></td>
      <td className="p-4"><Skeleton className="h-4 w-20" /></td>
      <td className="p-4"><Skeleton className="h-4 w-16" /></td>
    </tr>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      
      {/* Chart */}
      <div className="rounded-lg border p-6">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-[300px] w-full" />
      </div>
      
      {/* Table */}
      <div className="rounded-lg border">
        <div className="p-4 border-b">
          <Skeleton className="h-4 w-24" />
        </div>
        <table className="w-full">
          <tbody>
            {[...Array(5)].map((_, i) => (
              <TableRowSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

## Optimistic Updates

```typescript
// hooks/use-optimistic-mutation.ts
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

interface UseOptimisticMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  queryKey: string[];
  optimisticUpdate: (old: TData[], variables: TVariables) => TData[];
  onError?: (error: Error) => void;
}

export function useOptimisticMutation<TData, TVariables>({
  mutationFn,
  queryKey,
  optimisticUpdate,
  onError,
}: UseOptimisticMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot previous value
      const previousData = queryClient.getQueryData<TData[]>(queryKey);
      
      // Optimistically update
      if (previousData) {
        queryClient.setQueryData(queryKey, optimisticUpdate(previousData, variables));
      }
      
      return { previousData };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      onError?.(error as Error);
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// Usage
const { mutate: addTodo } = useOptimisticMutation({
  mutationFn: (newTodo) => api.createTodo(newTodo),
  queryKey: ['todos'],
  optimisticUpdate: (old, newTodo) => [...old, { ...newTodo, id: 'temp' }],
  onError: () => toast.error('Failed to add todo'),
});
```

---


---

# PART 53: INTERNATIONALIZATION (i18n)

## Setup with next-intl

```bash
npm install next-intl
```

```typescript
// i18n.ts
import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'es', 'fr', 'de', 'ja'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
}));
```

## Message Files

```json
// messages/en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "loading": "Loading...",
    "error": "Something went wrong"
  },
  "auth": {
    "login": "Log in",
    "logout": "Log out",
    "signup": "Sign up",
    "forgotPassword": "Forgot password?",
    "email": "Email",
    "password": "Password"
  },
  "dashboard": {
    "title": "Dashboard",
    "welcome": "Welcome back, {name}!",
    "stats": {
      "users": "{count, plural, =0 {No users} =1 {1 user} other {# users}}",
      "revenue": "Revenue: {amount, number, currency}"
    }
  }
}
```

```json
// messages/es.json
{
  "common": {
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "loading": "Cargando...",
    "error": "Algo salió mal"
  },
  "auth": {
    "login": "Iniciar sesión",
    "logout": "Cerrar sesión",
    "signup": "Registrarse",
    "forgotPassword": "¿Olvidaste tu contraseña?",
    "email": "Correo electrónico",
    "password": "Contraseña"
  }
}
```

## Usage in Components

```typescript
// components/dashboard.tsx
'use client';

import { useTranslations } from 'next-intl';

export function Dashboard({ user, stats }) {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('welcome', { name: user.name })}</p>
      
      <div>
        {t('stats.users', { count: stats.userCount })}
      </div>
      
      <button>{tCommon('save')}</button>
    </div>
  );
}
```

## Language Switcher

```typescript
// components/language-switcher.tsx
'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  
  const switchLocale = (newLocale: string) => {
    // Remove current locale from path and add new one
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };
  
  return (
    <select 
      value={locale} 
      onChange={(e) => switchLocale(e.target.value)}
      className="border rounded px-2 py-1"
    >
      {languages.map(lang => (
        <option key={lang.code} value={lang.code}>
          {lang.flag} {lang.name}
        </option>
      ))}
    </select>
  );
}
```

## Date/Number Formatting

```typescript
// Always use formatters for locale-aware display
import { useFormatter } from 'next-intl';

function PriceDisplay({ amount, currency = 'USD' }) {
  const format = useFormatter();
  
  return (
    <span>
      {format.number(amount, { style: 'currency', currency })}
    </span>
  );
}

function DateDisplay({ date }) {
  const format = useFormatter();
  
  return (
    <time dateTime={date.toISOString()}>
      {format.dateTime(date, { dateStyle: 'long' })}
    </time>
  );
}
```

---


---

# PART 54: STATE MANAGEMENT (ZUSTAND)

## Store Pattern

```typescript
// stores/app-store.ts
import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
}

interface AppState {
  // State
  user: User | null;
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  notifications: Notification[];
  
  // Actions
  setUser: (user: User | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        user: null,
        theme: 'system',
        sidebarOpen: true,
        notifications: [],
        
        // Actions
        setUser: (user) => set({ user }),
        
        setTheme: (theme) => set({ theme }),
        
        toggleSidebar: () => set((state) => ({ 
          sidebarOpen: !state.sidebarOpen 
        })),
        
        addNotification: (notification) => set((state) => ({
          notifications: [...state.notifications, notification],
        })),
        
        removeNotification: (id) => set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),
        
        clearNotifications: () => set({ notifications: [] }),
      }),
      {
        name: 'app-storage', // localStorage key
        partialize: (state) => ({ 
          theme: state.theme,
          sidebarOpen: state.sidebarOpen,
        }), // Only persist these
      }
    )
  )
);
```

## Slice Pattern (For Large Stores)

```typescript
// stores/slices/auth-slice.ts
import { StateCreator } from 'zustand';

export interface AuthSlice {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  user: null,
  isLoading: false,
  
  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const user = await authApi.login(email, password);
      set({ user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  
  logout: () => {
    authApi.logout();
    set({ user: null });
  },
});

// stores/slices/ui-slice.ts
export interface UISlice {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
}

export const createUISlice: StateCreator<UISlice> = (set) => ({
  theme: 'light',
  sidebarOpen: true,
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
});

// stores/index.ts - Combine slices
import { create } from 'zustand';
import { AuthSlice, createAuthSlice } from './slices/auth-slice';
import { UISlice, createUISlice } from './slices/ui-slice';

type StoreState = AuthSlice & UISlice;

export const useStore = create<StoreState>()((...args) => ({
  ...createAuthSlice(...args),
  ...createUISlice(...args),
}));
```

## Usage Patterns

```typescript
// Select specific state (prevents unnecessary re-renders)
function UserName() {
  const name = useAppStore((state) => state.user?.name);
  return <span>{name}</span>;
}

// Select multiple values
function Header() {
  const { user, theme, toggleSidebar } = useAppStore((state) => ({
    user: state.user,
    theme: state.theme,
    toggleSidebar: state.toggleSidebar,
  }));
  
  return (
    <header>
      <button onClick={toggleSidebar}>Menu</button>
      <span>{user?.name}</span>
    </header>
  );
}

// Outside React (in API calls, etc.)
const currentUser = useAppStore.getState().user;
useAppStore.setState({ theme: 'dark' });
```

---


---

# PART 71: USER ONBOARDING

## Onboarding Flow

```typescript
// db/schema.ts
export const onboardingProgress = pgTable('onboarding_progress', {
  userId: uuid('user_id').primaryKey().references(() => profiles.id),
  completedSteps: text('completed_steps').array().default([]),
  currentStep: text('current_step').default('welcome'),
  skippedAt: timestamp('skipped_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

```typescript
// lib/onboarding.ts
export const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome!',
    description: 'Let\'s get you set up',
  },
  {
    id: 'profile',
    title: 'Complete your profile',
    description: 'Add your name and photo',
  },
  {
    id: 'team',
    title: 'Set up your team',
    description: 'Name your workspace',
  },
  {
    id: 'invite',
    title: 'Invite teammates',
    description: 'Collaborate with others',
    optional: true,
  },
  {
    id: 'first-project',
    title: 'Create your first project',
    description: 'Get started with a project',
  },
] as const;

export type OnboardingStep = typeof ONBOARDING_STEPS[number]['id'];
```

## Onboarding Component

```typescript
// components/onboarding/onboarding-modal.tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ONBOARDING_STEPS } from '@/lib/onboarding';

// Step components
import { WelcomeStep } from './steps/welcome';
import { ProfileStep } from './steps/profile';
import { TeamStep } from './steps/team';
import { InviteStep } from './steps/invite';
import { FirstProjectStep } from './steps/first-project';

const stepComponents = {
  welcome: WelcomeStep,
  profile: ProfileStep,
  team: TeamStep,
  invite: InviteStep,
  'first-project': FirstProjectStep,
};

export function OnboardingModal({ 
  initialStep,
  completedSteps,
}: { 
  initialStep: string;
  completedSteps: string[];
}) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [completed, setCompleted] = useState<Set<string>>(new Set(completedSteps));
  
  const currentIndex = ONBOARDING_STEPS.findIndex(s => s.id === currentStep);
  const progress = (completed.size / ONBOARDING_STEPS.length) * 100;
  
  const handleNext = async () => {
    // Mark current step as completed
    setCompleted(prev => new Set([...prev, currentStep]));
    
    // Save to server
    await fetch('/api/onboarding/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completedStep: currentStep }),
    });
    
    // Move to next step
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(ONBOARDING_STEPS[currentIndex + 1].id);
    } else {
      // Onboarding complete
      await fetch('/api/onboarding/complete', { method: 'POST' });
      window.location.href = '/dashboard';
    }
  };
  
  const handleSkip = async () => {
    const step = ONBOARDING_STEPS[currentIndex];
    if (step.optional) {
      handleNext();
    }
  };
  
  const StepComponent = stepComponents[currentStep as keyof typeof stepComponents];
  
  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-lg">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Step {currentIndex + 1} of {ONBOARDING_STEPS.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} />
        </div>
        
        {/* Step content */}
        <div className="py-6">
          <StepComponent onComplete={handleNext} />
        </div>
        
        {/* Actions */}
        <div className="flex justify-between">
          {ONBOARDING_STEPS[currentIndex].optional ? (
            <Button variant="ghost" onClick={handleSkip}>
              Skip for now
            </Button>
          ) : (
            <div />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---


---

# PART 72: EMPTY STATES & ERROR PAGES

## Empty State Component

```typescript
// components/ui/empty-state.tsx
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
      {action && (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  );
}

// Usage
<EmptyState
  icon={FolderOpen}
  title="No projects yet"
  description="Create your first project to get started."
  action={{
    label: 'Create Project',
    onClick: () => setShowCreateModal(true),
  }}
/>
```

## Error Pages

```typescript
// app/not-found.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <FileQuestion className="h-16 w-16 text-muted-foreground mb-4" />
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-xl text-muted-foreground mb-8">
        Page not found
      </p>
      <p className="text-muted-foreground mb-8 max-w-md text-center">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/">Go Home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/support">Contact Support</Link>
        </Button>
      </div>
    </div>
  );
}
```

```typescript
// app/error.tsx
'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
      <h1 className="text-4xl font-bold mb-2">Something went wrong</h1>
      <p className="text-muted-foreground mb-8 max-w-md text-center">
        We've been notified and are working on it. Please try again.
      </p>
      {error.digest && (
        <p className="text-sm text-muted-foreground mb-4">
          Error ID: {error.digest}
        </p>
      )}
      <div className="flex gap-4">
        <Button onClick={reset}>Try Again</Button>
        <Button variant="outline" asChild>
          <a href="/">Go Home</a>
        </Button>
      </div>
    </div>
  );
}
```

```typescript
// app/global-error.tsx (for root layout errors)
'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '100vh',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            Something went wrong
          </h1>
          <button 
            onClick={reset}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
```

---

**This is the Ultimate AI Building Robot.**

**72 Parts. Complete SaaS Coverage. Production-Ready Patterns.**

**Tell Claude what you want. It builds it, tests it, fixes it.**

---

# END OF CLAUDE.md ENTERPRISE EDITION v12.0

## Complete Coverage

| Category | Parts | Topics |
|----------|-------|--------|
| Core Standards | 1-3 | Standards, Testing, Audits |
| Auth & Database | 4-5 | Auth, Database Patterns |
| API & Frontend | 6-7 | API Design, React/Next.js |
| Integrations | 8-11 | Stripe, VAPI, Email, SMS |
| Security | 12-18 | Security, Compliance |
| Deployment | 19-22 | CI/CD, Hosting |
| Generators | 23-25 | Scaffolding, Templates |
| Self-Healing | 26-27 | Error Recovery |
| Advanced | 28-32 | Caching, Queues |
| Git & Performance | 33-34 | Git, Optimization |
| Accessibility & SEO | 35-36 | a11y, Meta Tags |
| Analytics & Monitoring | 37-38 | PostHog, Sentry |
| File & Email | 39-40 | Uploads, Resend |
| Jobs & Realtime | 41-42 | Inngest, WebSockets |
| Search & Pagination | 43-44 | Full-text, Cursors |
| Forms & Loading | 45-46 | React Hook Form, Skeletons |
| Notifications & Teams | 47-48 | In-app, Multi-tenant |
| Audit & Features | 49-50 | Logging, Flags |
| Export & Rate Limit | 51-52 | CSV, Throttling |
| **i18n & State** | 53-54 | Translations, Zustand |
| **API & Migrations** | 55-56 | Versioning, Schema |
| **Webhooks & Docs** | 57-58 | Outgoing, OpenAPI |
| **Health & Resilience** | 59-61 | Checks, Retry |
| **Idempotency & Deletes** | 62-63 | Duplicates, Soft Delete |
| **Money & Dates** | 64-65 | Currency, Timezones |
| **Testing & CI/CD** | 66-67 | Vitest, GitHub Actions |
| **Security & 2FA** | 68-69 | Headers, TOTP |
| **OAuth & Onboarding** | 70-71 | Social Login, Flows |
| **UI Polish** | 72 | Empty States, Errors |

---

**72 Parts. Everything You Need. Ship Faster.**

---


---

# PART 107: PWA / OFFLINE PATTERNS

## 📴 PROGRESSIVE WEB APP & OFFLINE SUPPORT

### Service Worker Setup

```typescript
// public/sw.js
const CACHE_NAME = 'app-v1';
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // API calls - network only, queue if offline
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Queue for later if POST/PUT/DELETE
        if (request.method !== 'GET') {
          return queueRequest(request);
        }
        return new Response(JSON.stringify({ offline: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // Static assets - cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
    }).catch(() => caches.match('/offline'))
  );
});
```

### Offline Queue

```typescript
// src/lib/offline-queue.ts
import { openDB, DBSchema } from 'idb';

interface OfflineDB extends DBSchema {
  queue: {
    key: string;
    value: {
      id: string;
      url: string;
      method: string;
      body: string;
      timestamp: number;
    };
  };
}

const dbPromise = openDB<OfflineDB>('offline-queue', 1, {
  upgrade(db) {
    db.createObjectStore('queue', { keyPath: 'id' });
  },
});

export async function queueRequest(request: Request) {
  const db = await dbPromise;
  const id = crypto.randomUUID();

  await db.put('queue', {
    id,
    url: request.url,
    method: request.method,
    body: await request.text(),
    timestamp: Date.now(),
  });

  return new Response(JSON.stringify({ queued: true, id }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function processQueue() {
  const db = await dbPromise;
  const items = await db.getAll('queue');

  for (const item of items) {
    try {
      await fetch(item.url, {
        method: item.method,
        body: item.body,
        headers: { 'Content-Type': 'application/json' },
      });
      await db.delete('queue', item.id);
    } catch {
      // Still offline, keep in queue
      break;
    }
  }
}

// Process queue when back online
window.addEventListener('online', processQueue);
```

### Online/Offline Hook

```typescript
// src/hooks/use-online-status.ts
import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// Usage in components
export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg">
      You're offline. Changes will sync when connected.
    </div>
  );
}
```

### PWA Manifest

```json
// public/manifest.json
{
  "name": "My App",
  "short_name": "App",
  "description": "My awesome app",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

