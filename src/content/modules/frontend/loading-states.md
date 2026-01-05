# Loading States

> Copy-paste ready. Skeleton loaders and loading indicators.

## Skeleton Component

```typescript
// components/ui/skeleton.tsx
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200',
        className
      )}
    />
  );
}
```

## Card Skeleton

```typescript
// components/skeletons/card-skeleton.tsx
import { Skeleton } from '@/components/ui/skeleton';

export function CardSkeleton() {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-20 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
```

## Table Skeleton

```typescript
// components/skeletons/table-skeleton.tsx
import { Skeleton } from '@/components/ui/skeleton';

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-lg border">
      {/* Header */}
      <div className="flex gap-4 border-b p-4 bg-gray-50">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-4 border-b last:border-0">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
```

## Spinner Component

```typescript
// components/ui/spinner.tsx
import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <svg
      className={cn('animate-spin text-blue-600', sizes[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
```

## Loading Button

```typescript
// components/ui/loading-button.tsx
import { Spinner } from '@/components/ui/spinner';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: React.ReactNode;
}

export function LoadingButton({ loading, children, disabled, ...props }: LoadingButtonProps) {
  return (
    <button
      disabled={loading || disabled}
      className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      {...props}
    >
      {loading && <Spinner size="sm" className="text-white" />}
      {children}
    </button>
  );
}
```

## Page Loading

```typescript
// app/dashboard/loading.tsx
import { CardListSkeleton } from '@/components/skeletons/card-skeleton';

export default function DashboardLoading() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
      </div>
      <CardListSkeleton count={6} />
    </div>
  );
}
```

## Test

```typescript
// components/ui/skeleton.test.tsx
import { render, screen } from '@testing-library/react';
import { Skeleton } from './skeleton';
import { Spinner } from './spinner';

describe('Loading Components', () => {
  it('renders skeleton with custom class', () => {
    render(<Skeleton className="h-10 w-full" />);
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toHaveClass('h-10', 'w-full');
  });

  it('renders spinner with correct size', () => {
    render(<Spinner size="lg" />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toHaveClass('h-8', 'w-8');
  });
});
```

## Usage
Use Next.js `loading.tsx` files for route-level loading. Use skeletons that match your content layout.
