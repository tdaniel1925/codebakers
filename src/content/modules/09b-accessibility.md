# ACCESSIBILITY (A11Y) STANDARDS
# Module: 09b-accessibility.md
# Load with: 00-core.md
# Covers: WCAG compliance, keyboard navigation, screen readers, focus management

---

## MANDATORY: All UI Must Be Accessible

### 1. Semantic HTML

```typescript
// ALWAYS use semantic elements
<header>...</header>
<nav>...</nav>
<main>...</main>
<article>...</article>
<section>...</section>
<aside>...</aside>
<footer>...</footer>

// NOT
<div className="header">...</div>
<div className="nav">...</div>
```

### 2. Button vs Link

```typescript
// Buttons for ACTIONS
<button onClick={handleSubmit}>Submit</button>
<button onClick={handleDelete}>Delete</button>

// Links for NAVIGATION
<Link href="/dashboard">Dashboard</Link>
<a href="https://example.com">External Link</a>

// NEVER
<div onClick={handleSubmit}>Submit</div>  // ❌ Not accessible
<a onClick={handleAction}>Click me</a>    // ❌ Misuse of link
```

### 3. ARIA Labels

```typescript
// Icon-only buttons MUST have labels
<button
  onClick={handleClose}
  aria-label="Close dialog"
>
  <X className="h-4 w-4" />
</button>

// Form inputs MUST have labels
<label htmlFor="email">Email</label>
<input id="email" type="email" />

// Or use aria-label
<input
  type="search"
  aria-label="Search products"
  placeholder="Search..."
/>

// Loading states
<button disabled aria-busy="true">
  <Spinner aria-hidden="true" />
  <span>Loading...</span>
</button>
```

### 4. Keyboard Navigation

```typescript
// All interactive elements must be keyboard accessible
// Tab order should be logical

// Custom components need keyboard handlers
function CustomDropdown({ options, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        if (isOpen) {
          onSelect(options[focusedIndex]);
          setIsOpen(false);
        } else {
          setIsOpen(true);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(i => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* ... */}
    </div>
  );
}
```

### 5. Focus Management

```typescript
// Trap focus in modals
import { FocusTrap } from '@headlessui/react';

function Modal({ isOpen, onClose, children }) {
  const closeButtonRef = useRef(null);

  // Focus first element when modal opens
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <FocusTrap>
      <div role="dialog" aria-modal="true">
        <button ref={closeButtonRef} onClick={onClose}>
          Close
        </button>
        {children}
      </div>
    </FocusTrap>
  );
}

// Focus visible styling
<style>
  /* Show focus ring only for keyboard navigation */
  :focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  /* Hide for mouse users */
  :focus:not(:focus-visible) {
    outline: none;
  }
</style>
```

### 6. Color Contrast

```typescript
// ALWAYS ensure 4.5:1 contrast ratio for text
// Use tools: WebAIM Contrast Checker

// Good contrast
<p className="text-gray-900 bg-white">Readable</p>
<p className="text-white bg-gray-900">Readable</p>

// Bad contrast - NEVER
<p className="text-gray-400 bg-gray-200">Hard to read</p>

// For large text (18px+ or 14px+ bold): 3:1 ratio is acceptable
```

### 7. Screen Reader Text

```typescript
// Visually hidden but readable by screen readers
<span className="sr-only">
  Current page:
</span>

// In Tailwind, sr-only is:
// position: absolute;
// width: 1px;
// height: 1px;
// padding: 0;
// margin: -1px;
// overflow: hidden;
// clip: rect(0, 0, 0, 0);
// white-space: nowrap;
// border-width: 0;
```

---

## ACCESSIBLE FORM PATTERNS

```typescript
// Form with proper accessibility
function AccessibleForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form aria-label="Contact form">
      {/* Required field with error */}
      <div>
        <label htmlFor="name">
          Name <span aria-label="required">*</span>
        </label>
        <input
          id="name"
          type="text"
          required
          aria-required="true"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {errors.name && (
          <p id="name-error" role="alert" className="text-red-500 text-sm">
            {errors.name}
          </p>
        )}
      </div>

      {/* Field with hint text */}
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-sm text-muted-foreground">
          Must be at least 8 characters
        </p>
      </div>

      {/* Submit button with loading state */}
      <button
        type="submit"
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <Spinner aria-hidden="true" />
            <span className="sr-only">Submitting...</span>
          </>
        ) : (
          'Submit'
        )}
      </button>
    </form>
  );
}
```

---

## ACCESSIBLE TABLE PATTERNS

```typescript
function AccessibleTable({ data }) {
  return (
    <table aria-label="User data">
      <caption className="sr-only">
        List of users with their email and status
      </caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Email</th>
          <th scope="col">Status</th>
          <th scope="col">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            <td>{row.name}</td>
            <td>{row.email}</td>
            <td>
              <span aria-label={`Status: ${row.status}`}>
                {row.status}
              </span>
            </td>
            <td>
              <button aria-label={`Edit ${row.name}`}>
                Edit
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## ACCESSIBLE NAVIGATION

```typescript
// Skip link for keyboard users
function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:border focus:rounded"
    >
      Skip to main content
    </a>
  );
}

// In layout
<body>
  <SkipLink />
  <header>...</header>
  <main id="main-content" tabIndex={-1}>
    {children}
  </main>
</body>
```

---

## CHECKLIST

Before shipping any UI:

- [ ] All images have alt text
- [ ] All form inputs have labels
- [ ] All interactive elements are keyboard accessible
- [ ] Focus order is logical
- [ ] Focus is visible
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Icons have accessible names
- [ ] Modals trap focus
- [ ] Error messages are announced to screen readers
- [ ] Page has proper heading hierarchy (h1 -> h2 -> h3)

---
