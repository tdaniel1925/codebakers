# CORE DEVELOPMENT STANDARDS
# Module: 00-core.md
# Always load this module first

---

## MANDATORY THINKING PROTOCOL

**BEFORE WRITING ANY CODE**, you MUST complete this mental checklist:

```
□ What is the user actually asking for?
□ What are ALL the components needed (UI, API, DB, types)?
□ What are the edge cases?
□ What error handling is required?
□ What loading/empty states are needed?
□ What tests will verify this works?
```

---

## ABSOLUTE PROHIBITIONS

```typescript
// ❌ BANNED - NON-FUNCTIONAL CODE
onClick={handleClick}        // where handleClick doesn't exist
onSubmit={handleSubmit}      // where handleSubmit doesn't exist

// ❌ BANNED - INCOMPLETE CODE
TODO:                        // No TODOs ever
FIXME:                       // No FIXMEs ever
throw new Error('Not implemented')

// ❌ BANNED - TYPE SAFETY VIOLATIONS
any                          // No 'any' types
@ts-ignore                   // No ignoring TypeScript
```

---

## EVERY BUTTON MUST HAVE

```typescript
<Button
  onClick={handleAction}
  disabled={isLoading || isDisabled}
  aria-label="Descriptive action"
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
```

---

## EVERY ASYNC OPERATION MUST HAVE

```typescript
const [data, setData] = useState<DataType | null>(null);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const fetchData = async () => {
  setIsLoading(true);
  setError(null);

  try {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error('Failed');
    const result = await response.json();
    setData(result.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed';
    setError(message);
    toast.error(message);
  } finally {
    setIsLoading(false);
  }
};
```

---

## ERROR HANDLING CLASSES

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}
```

---

# END OF CORE MODULE
