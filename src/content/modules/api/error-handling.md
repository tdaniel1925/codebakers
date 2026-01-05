# Error Handling

> Copy-paste ready. Consistent error responses across all API routes.

## Code

```typescript
// lib/api-errors.ts
import { NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  // Known API errors
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  // Zod validation errors
  if (error && typeof error === 'object' && 'issues' in error) {
    return NextResponse.json(
      { error: 'Validation failed', issues: (error as any).issues },
      { status: 400 }
    );
  }

  // Database errors (Drizzle/Postgres)
  if (error && typeof error === 'object' && 'code' in error) {
    const dbError = error as { code: string };
    if (dbError.code === '23505') {
      return NextResponse.json(
        { error: 'Resource already exists', code: 'DUPLICATE' },
        { status: 409 }
      );
    }
    if (dbError.code === '23503') {
      return NextResponse.json(
        { error: 'Referenced resource not found', code: 'FOREIGN_KEY' },
        { status: 400 }
      );
    }
  }

  // Unknown errors - don't leak details
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, handleApiError } from '@/lib/api-errors';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Throw custom errors
    if (!body.email) {
      throw new ApiError(400, 'Email is required', 'MISSING_EMAIL');
    }

    const user = await db.insert(users).values(body).returning();

    return NextResponse.json({ user: user[0] });
  } catch (error) {
    return handleApiError(error);
  }
}
```

## Test

```typescript
// lib/api-errors.test.ts
import { describe, it, expect } from 'vitest';
import { ApiError, handleApiError } from './api-errors';

describe('handleApiError', () => {
  it('handles ApiError correctly', async () => {
    const error = new ApiError(404, 'User not found', 'USER_NOT_FOUND');
    const res = handleApiError(error);

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('User not found');
    expect(data.code).toBe('USER_NOT_FOUND');
  });

  it('handles unknown errors safely', async () => {
    const res = handleApiError(new Error('Secret database error'));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Internal server error');
    expect(data).not.toHaveProperty('Secret');
  });
});
```

## Usage
Wrap all route handlers in try/catch and use handleApiError for consistent responses.
