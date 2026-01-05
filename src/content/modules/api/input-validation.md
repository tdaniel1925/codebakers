# Input Validation

> Copy-paste ready. Zod schema validation for API routes.

## Dependencies
```bash
npm install zod
```

## Code

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Define schema with helpful error messages
const CreateUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  role: z.enum(['user', 'admin']).optional().default('user'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate input
    const result = CreateUserSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: result.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    // result.data is fully typed and validated
    const { email, name, role } = result.data;

    // Your logic here...

    return NextResponse.json({ success: true, user: { email, name, role } });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Test

```typescript
// app/api/users/route.test.ts
import { describe, it, expect } from 'vitest';
import { POST } from './route';

describe('POST /api/users', () => {
  it('creates user with valid data', async () => {
    const req = new Request('http://test/api/users', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', name: 'Test User' }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('rejects invalid email', async () => {
    const req = new Request('http://test/api/users', {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid', name: 'Test' }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.issues[0].field).toBe('email');
  });
});
```

## Usage
Use this pattern for any API route that accepts user input. Always validate before processing.
