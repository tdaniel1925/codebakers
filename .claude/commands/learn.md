# /LEARN - Educational Moments

**Purpose:** When AI catches a mistake, offer to explain WHY it's a problem - teaching, not just fixing.

## When /learn Triggers

The AI proactively offers `/learn` explanations when it catches:

### 1. Security Issues
- API keys in client code
- SQL injection vulnerabilities
- Missing input validation
- Hardcoded secrets

### 2. Anti-patterns
- N+1 queries
- Prop drilling instead of context
- Missing error boundaries
- Synchronous operations that should be async

### 3. Best Practice Violations
- No error handling
- Missing loading states
- Inconsistent naming conventions

## Learn Prompt Format

```
I caught something: [brief issue]

I fixed it, but want a quick explanation of why this matters? (/learn)
```

## Example Scenarios

### Scenario 1: API Key in Client Code
```
User: Add the OpenAI integration