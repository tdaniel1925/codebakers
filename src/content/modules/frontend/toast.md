# Toast Notifications

> Copy-paste ready. Non-blocking notifications with auto-dismiss.

## Toast Context

```typescript
// contexts/toast-context.tsx
'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
```

## Toast Container

```typescript
// components/ui/toast-container.tsx
'use client';

import { useToast } from '@/contexts/toast-context';

const typeStyles = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  warning: 'bg-yellow-500',
  info: 'bg-blue-600',
};

const typeIcons = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-white shadow-lg min-w-[300px] animate-slide-in ${typeStyles[toast.type]}`}
          role="alert"
        >
          <span className="text-lg">{typeIcons[toast.type]}</span>
          <p className="flex-1">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-white/80 hover:text-white"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
```

## CSS Animation

```css
/* globals.css */
@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out;
}
```

## Layout Setup

```typescript
// app/layout.tsx
import { ToastProvider } from '@/contexts/toast-context';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
```

## Usage Example

```typescript
// components/user-form.tsx
'use client';

import { useToast } from '@/contexts/toast-context';

export function UserForm() {
  const { addToast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({ name: 'John' }),
      });

      if (!res.ok) {
        throw new Error('Failed to create user');
      }

      addToast('User created successfully!', 'success');
    } catch (error) {
      addToast('Failed to create user', 'error');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
        Create User
      </button>
    </form>
  );
}
```

## Helper Functions

```typescript
// lib/toast.ts
// For use outside of React components (e.g., in API utilities)

let toastHandler: ((message: string, type: 'success' | 'error' | 'warning' | 'info') => void) | null = null;

export function setToastHandler(handler: typeof toastHandler) {
  toastHandler = handler;
}

export function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  if (toastHandler) {
    toastHandler(message, type);
  }
}

// In your root component:
// useEffect(() => {
//   setToastHandler(addToast);
//   return () => setToastHandler(null);
// }, [addToast]);
```

## Promise Toast

```typescript
// hooks/use-promise-toast.ts
'use client';

import { useToast } from '@/contexts/toast-context';

export function usePromiseToast() {
  const { addToast } = useToast();

  async function promiseToast<T>(
    promise: Promise<T>,
    messages: {
      loading?: string;
      success: string;
      error: string;
    }
  ): Promise<T> {
    try {
      const result = await promise;
      addToast(messages.success, 'success');
      return result;
    } catch (error) {
      addToast(messages.error, 'error');
      throw error;
    }
  }

  return { promiseToast };
}

// Usage:
// const { promiseToast } = usePromiseToast();
// await promiseToast(createUser(data), {
//   success: 'User created!',
//   error: 'Failed to create user',
// });
```

## Test

```typescript
// contexts/toast-context.test.tsx
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './toast-context';

function TestComponent() {
  const { addToast } = useToast();
  return (
    <button onClick={() => addToast('Test message', 'success')}>
      Show Toast
    </button>
  );
}

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows toast when triggered', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await userEvent.click(screen.getByText('Show Toast'));

    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('auto-dismisses after 5 seconds', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await userEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Test message')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.queryByText('Test message')).not.toBeInTheDocument();
  });

  it('dismisses on click', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await userEvent.click(screen.getByText('Show Toast'));
    await userEvent.click(screen.getByLabelText('Dismiss'));

    expect(screen.queryByText('Test message')).not.toBeInTheDocument();
  });
});
```

## Usage
Wrap app with ToastProvider. Use addToast for feedback. Auto-dismisses in 5 seconds.
