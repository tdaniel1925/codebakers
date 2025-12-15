# CODEBAKERS SMART ROUTER
# Version: 15.2
# This file auto-loads the right patterns based on your request

---

## CRITICAL: READ THIS BEFORE EVERY RESPONSE

You have access to modular pattern files in `.claude/` folder.

**DO NOT answer coding questions from memory alone.**

BEFORE writing ANY code:
1. Read this router
2. Detect what the user is asking for
3. Load the relevant module files
4. THEN respond using those patterns

---

## STEP 1: ALWAYS LOAD CORE

For EVERY coding task, first read:
```
.claude/00-core.md
```
This contains required standards, error handling, and quality checks.

---

## STEP 2: DETECT & LOAD RELEVANT MODULES

Scan the user's request for these keywords and load matching modules:

### Frontend & Forms
**Keywords:** form, input, validation, submit, field, button, modal, dialog, component, React, useState, onClick, UI, interface, page, layout, loading, skeleton, empty state
**Load:** `.claude/04-frontend.md`

### Database
**Keywords:** database, query, schema, table, migration, Drizzle, SQL, select, insert, update, delete, join, index
**Load:** `.claude/01-database.md`

### Authentication & Security
**Keywords:** login, logout, signup, auth, session, password, OAuth, token, permission, role, security
**Load:** `.claude/02-auth.md`

### API Development
**Keywords:** API, endpoint, route, REST, POST, GET, PUT, DELETE, request, response, webhook
**Load:** `.claude/03-api.md`

### Payments & Billing
**Keywords:** Stripe, payment, checkout, subscription, billing, invoice
**Load:** `.claude/05-payments.md`

---

## STEP 3: APPLY PATTERNS

After loading modules:

1. **Follow the patterns exactly** - Don't improvise when a pattern exists
2. **Include all required elements** - Loading states, error handling, types
3. **Use the specified libraries** - Zod, React Hook Form, etc.

---

# NOW: Read the user's request, detect keywords, load modules, write code, respond.
