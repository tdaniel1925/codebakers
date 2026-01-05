# Data Fetching

> Copy-paste ready. Server and client data fetching patterns.

## Server Component Fetching

```typescript
// app/users/page.tsx
import { db, users } from '@/lib/db';

// This runs on the server - no loading state needed
export default async function UsersPage() {
  const allUsers = await db.select().from(users);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      <ul className="space-y-2">
        {allUsers.map((user) => (
          <li key={user.id} className="p-4 border rounded">
            {user.name} - {user.email}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Client Component with SWR

```typescript
// components/user-list.tsx
'use client';

import useSWR from 'swr';

interface User {
  id: string;
  name: string;
  email: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function UserList() {
  const { data, error, isLoading, mutate } = useSWR<{ users: User[] }>(
    '/api/users',
    fetcher
  );

  if (isLoading) {
    return <div className="animate-pulse">Loading users...</div>;
  }

  if (error) {
    return (
      <div className="text-red-600">
        Failed to load users.{' '}
        <button onClick={() => mutate()} className="underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {data?.users.map((user) => (
        <li key={user.id} className="p-4 border rounded">
          {user.name} - {user.email}
        </li>
      ))}
    </ul>
  );
}
```

## useFetch Hook

```typescript
// hooks/use-fetch.ts
'use client';

import { useState, useEffect } from 'react';

interface FetchState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

export function useFetch<T>(url: string): FetchState<T> & { refetch: () => void } {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    error: null,
    isLoading: true,
  });

  async function fetchData() {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setState({ data, error: null, isLoading: false });
    } catch (error) {
      setState({ data: null, error: error as Error, isLoading: false });
    }
  }

  useEffect(() => {
    fetchData();
  }, [url]);

  return { ...state, refetch: fetchData };
}

// Usage:
// const { data, error, isLoading, refetch } = useFetch<User[]>('/api/users');
```

## Server Actions

```typescript
// app/users/actions.ts
'use server';

import { db, users } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function createUser(formData: FormData) {
  const result = CreateUserSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
  });

  if (!result.success) {
    return { error: 'Invalid input' };
  }

  try {
    await db.insert(users).values(result.data);
    revalidatePath('/users');
    return { success: true };
  } catch (error) {
    return { error: 'Failed to create user' };
  }
}
```

```typescript
// app/users/create-form.tsx
'use client';

import { useFormStatus } from 'react-dom';
import { createUser } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
    >
      {pending ? 'Creating...' : 'Create User'}
    </button>
  );
}

export function CreateUserForm() {
  return (
    <form action={createUser} className="space-y-4">
      <input name="name" placeholder="Name" className="border p-2 rounded w-full" />
      <input name="email" type="email" placeholder="Email" className="border p-2 rounded w-full" />
      <SubmitButton />
    </form>
  );
}
```

## Parallel Data Fetching

```typescript
// app/dashboard/page.tsx
import { db, users, posts, analytics } from '@/lib/db';

export default async function DashboardPage() {
  // Fetch in parallel - much faster than sequential
  const [allUsers, allPosts, stats] = await Promise.all([
    db.select().from(users),
    db.select().from(posts).limit(10),
    db.select().from(analytics),
  ]);

  return (
    <div className="grid grid-cols-3 gap-6">
      <StatCard title="Users" value={allUsers.length} />
      <StatCard title="Posts" value={allPosts.length} />
      <StatCard title="Views" value={stats[0]?.views || 0} />
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="p-6 border rounded-lg">
      <h3 className="text-sm text-gray-500">{title}</h3>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
```

## Test

```typescript
// hooks/use-fetch.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useFetch } from './use-fetch';

describe('useFetch', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('fetches data successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ name: 'John' }),
    });

    const { result } = renderHook(() => useFetch('/api/user'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual({ name: 'John' });
    });
  });

  it('handles errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useFetch('/api/user'));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeNull();
    });
  });
});
```

## Usage
Prefer server components for data fetching. Use SWR or React Query for client-side with caching.
