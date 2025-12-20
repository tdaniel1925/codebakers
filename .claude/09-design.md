# DESIGN & UI PATTERNS
# Module: 09-design.md
# Load with: 00-core.md

---

# PART 35: ACCESSIBILITY (A11Y) STANDARDS

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


---

# PART 36: SEO OPTIMIZATION

## Metadata Pattern

```typescript
// app/layout.tsx - Global metadata
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://yourdomain.com'),
  title: {
    default: 'Your App Name',
    template: '%s | Your App Name',
  },
  description: 'Your app description for search engines',
  keywords: ['keyword1', 'keyword2', 'keyword3'],
  authors: [{ name: 'Your Name' }],
  creator: 'Your Company',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://yourdomain.com',
    siteName: 'Your App Name',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Your App Name',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@yourhandle',
  },
  robots: {
    index: true,
    follow: true,
  },
};
```

```typescript
// app/blog/[slug]/page.tsx - Dynamic metadata
import type { Metadata } from 'next';

type Props = {
  params: { slug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug);
  
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author.name],
      images: [{ url: post.coverImage }],
    },
  };
}
```

## Sitemap Generation

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://yourdomain.com';
  
  // Static pages
  const staticPages = [
    { url: baseUrl, lastModified: new Date(), priority: 1.0 },
    { url: `${baseUrl}/pricing`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: new Date(), priority: 0.5 },
  ];
  
  // Dynamic pages (e.g., blog posts)
  const posts = await getAllPosts();
  const postPages = posts.map(post => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    priority: 0.6,
  }));
  
  return [...staticPages, ...postPages];
}
```

## Robots.txt

```typescript
// app/robots.ts
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/dashboard/'],
      },
    ],
    sitemap: 'https://yourdomain.com/sitemap.xml',
  };
}
```

## Structured Data (JSON-LD)

```typescript
// components/structured-data.tsx
export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Your Company',
    url: 'https://yourdomain.com',
    logo: 'https://yourdomain.com/logo.png',
    sameAs: [
      'https://twitter.com/yourhandle',
      'https://linkedin.com/company/yourcompany',
    ],
  };
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function ArticleSchema({ post }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: post.author.name,
    },
  };
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

---


---

# PART 73: DESIGN SYSTEM FOUNDATIONS

## Spacing Scale (Use Consistently)

```typescript
// tailwind.config.ts - Spacing should be consistent
// Use multiples of 4px (Tailwind default)

// Spacing scale:
// 1 = 4px   (tiny gaps)
// 2 = 8px   (tight spacing)
// 3 = 12px  (compact)
// 4 = 16px  (default/comfortable)
// 6 = 24px  (relaxed)
// 8 = 32px  (spacious sections)
// 12 = 48px (section gaps)
// 16 = 64px (large sections)
// 24 = 96px (hero spacing)

// RULES:
// - Inside components: 2-4 (8-16px)
// - Between components: 4-6 (16-24px)
// - Between sections: 12-16 (48-64px)
// - Page padding: 4-8 (16-32px mobile/desktop)
```

## Typography Scale

```typescript
// Use a consistent type scale
// Base: 16px (1rem)

const typography = {
  // Display (heroes, big statements)
  'display-2xl': ['4.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],  // 72px
  'display-xl': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }], // 60px
  'display-lg': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],    // 48px
  
  // Headings
  'heading-xl': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }], // 36px
  'heading-lg': ['1.875rem', { lineHeight: '1.3' }],  // 30px
  'heading-md': ['1.5rem', { lineHeight: '1.4' }],    // 24px
  'heading-sm': ['1.25rem', { lineHeight: '1.4' }],   // 20px
  
  // Body
  'body-lg': ['1.125rem', { lineHeight: '1.6' }],     // 18px
  'body-md': ['1rem', { lineHeight: '1.6' }],         // 16px (default)
  'body-sm': ['0.875rem', { lineHeight: '1.5' }],     // 14px
  
  // Small/Labels
  'label-md': ['0.875rem', { lineHeight: '1.4', letterSpacing: '0.01em' }],
  'label-sm': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.01em' }],    // 12px
};

// RULES:
// - Page titles: heading-xl or heading-lg
// - Section headings: heading-md or heading-sm
// - Body text: body-md (16px)
// - Secondary text: body-sm (14px) + text-muted-foreground
// - Labels/captions: label-sm (12px)
// - NEVER go below 12px for readability
```

## Color System

```typescript
// Use semantic color names, not raw values
// This allows easy theming and dark mode

// tailwind.config.ts
const colors = {
  // Backgrounds
  background: 'hsl(var(--background))',        // Main bg
  foreground: 'hsl(var(--foreground))',        // Main text
  
  // Cards & surfaces
  card: 'hsl(var(--card))',
  'card-foreground': 'hsl(var(--card-foreground))',
  
  // Muted (secondary backgrounds, disabled states)
  muted: 'hsl(var(--muted))',
  'muted-foreground': 'hsl(var(--muted-foreground))',
  
  // Primary (main actions, links)
  primary: 'hsl(var(--primary))',
  'primary-foreground': 'hsl(var(--primary-foreground))',
  
  // Secondary (secondary actions)
  secondary: 'hsl(var(--secondary))',
  'secondary-foreground': 'hsl(var(--secondary-foreground))',
  
  // Accent (highlights, hover states)
  accent: 'hsl(var(--accent))',
  'accent-foreground': 'hsl(var(--accent-foreground))',
  
  // Semantic colors
  destructive: 'hsl(var(--destructive))',      // Errors, delete
  success: 'hsl(var(--success))',              // Success states
  warning: 'hsl(var(--warning))',              // Warnings
  info: 'hsl(var(--info))',                    // Info messages
  
  // Border
  border: 'hsl(var(--border))',
  input: 'hsl(var(--input))',
  ring: 'hsl(var(--ring))',                    // Focus rings
};

// RULES:
// - Primary: Main CTAs, links, active states
// - Secondary: Less important actions
// - Muted: Backgrounds, disabled, secondary text
// - Destructive: Delete, errors only
// - NEVER use red for non-error states
// - ALWAYS ensure 4.5:1 contrast ratio
```

## Border Radius Scale

```typescript
// Consistent roundedness
const borderRadius = {
  'none': '0',
  'sm': '0.25rem',    // 4px - subtle
  'md': '0.375rem',   // 6px - default for inputs/buttons
  'lg': '0.5rem',     // 8px - cards
  'xl': '0.75rem',    // 12px - larger cards
  '2xl': '1rem',      // 16px - modals, large surfaces
  '3xl': '1.5rem',    // 24px - pills, very rounded
  'full': '9999px',   // circles, pills
};

// RULES:
// - Buttons: rounded-md (6px)
// - Inputs: rounded-md (6px) - match buttons
// - Cards: rounded-lg or rounded-xl
// - Modals: rounded-xl or rounded-2xl
// - Avatars: rounded-full
// - Tags/badges: rounded-md or rounded-full
// - Be consistent within a component family
```

## Shadow Scale

```typescript
// Shadows create depth - use sparingly
const shadows = {
  'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  'md': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
};

// RULES:
// - Cards at rest: shadow-sm or no shadow (use border instead)
// - Cards on hover: shadow-md
// - Dropdowns/popovers: shadow-lg
// - Modals: shadow-xl or shadow-2xl
// - LESS IS MORE - don't overuse shadows
// - In dark mode, reduce shadow opacity
```

---

# PART 74: COMPONENT DESIGN PATTERNS

## Card Pattern

```typescript
// A well-designed card has:
// 1. Clear visual boundary (border or shadow)
// 2. Consistent internal padding
// 3. Visual hierarchy (title > content > actions)
// 4. Hover state if interactive

// Basic Card
<div className="rounded-xl border bg-card p-6">
  <h3 className="text-lg font-semibold mb-2">Card Title</h3>
  <p className="text-muted-foreground mb-4">
    Card description goes here with secondary text color.
  </p>
  <Button>Action</Button>
</div>

// Interactive Card (clickable)
<div className="rounded-xl border bg-card p-6 
                transition-all duration-200
                hover:border-primary/50 hover:shadow-md
                cursor-pointer">
  {/* ... */}
</div>

// Card with Header
<div className="rounded-xl border bg-card overflow-hidden">
  <div className="px-6 py-4 border-b bg-muted/30">
    <h3 className="font-semibold">Card Header</h3>
  </div>
  <div className="p-6">
    {/* Content */}
  </div>
</div>

// Card with Footer
<div className="rounded-xl border bg-card overflow-hidden">
  <div className="p-6">
    {/* Content */}
  </div>
  <div className="px-6 py-4 border-t bg-muted/30 flex justify-end gap-2">
    <Button variant="outline">Cancel</Button>
    <Button>Save</Button>
  </div>
</div>
```

## Button Hierarchy

```typescript
// Buttons should have clear visual hierarchy

// Primary - Main action (one per section max)
<Button>Save Changes</Button>

// Secondary - Alternative actions
<Button variant="secondary">Save as Draft</Button>

// Outline - Less emphasis
<Button variant="outline">Cancel</Button>

// Ghost - Minimal emphasis
<Button variant="ghost">Learn More</Button>

// Destructive - Dangerous actions
<Button variant="destructive">Delete</Button>

// RULES:
// - ONE primary button per section/modal
// - Primary on the RIGHT (for Western readers)
// - Cancel/secondary on the LEFT
// - Destructive actions need confirmation
// - Consistent sizing (don't mix sm/md/lg randomly)

// Button Groups
<div className="flex gap-2">
  <Button variant="outline">Cancel</Button>
  <Button>Save</Button>  {/* Primary on right */}
</div>

// Icon Buttons
<Button size="icon" variant="ghost">
  <Settings className="h-4 w-4" />
  <span className="sr-only">Settings</span> {/* Accessibility! */}
</Button>
```

## Form Design

```typescript
// Forms should be scannable and easy to complete

// Basic Form Field
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input 
    id="email" 
    type="email" 
    placeholder="you@example.com"
  />
  <p className="text-sm text-muted-foreground">
    We'll never share your email.
  </p>
</div>

// Form Field with Error
<div className="space-y-2">
  <Label htmlFor="password">Password</Label>
  <Input 
    id="password" 
    type="password"
    className="border-destructive focus-visible:ring-destructive"
    aria-invalid="true"
  />
  <p className="text-sm text-destructive">
    Password must be at least 8 characters.
  </p>
</div>

// Form Layout
<form className="space-y-6">
  {/* Group related fields */}
  <div className="space-y-4">
    <h3 className="text-lg font-medium">Personal Info</h3>
    
    {/* Side by side on desktop */}
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="firstName">First Name</Label>
        <Input id="firstName" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lastName">Last Name</Label>
        <Input id="lastName" />
      </div>
    </div>
    
    {/* Full width */}
    <div className="space-y-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" />
    </div>
  </div>
  
  {/* Form Actions */}
  <div className="flex justify-end gap-2 pt-4 border-t">
    <Button type="button" variant="outline">Cancel</Button>
    <Button type="submit">Save</Button>
  </div>
</form>

// RULES:
// - Labels above inputs (not inline except for checkboxes)
// - Group related fields
// - Show validation errors immediately (not on submit)
// - Required fields: use asterisk or say "optional" on optional
// - Placeholder is NOT a label replacement
// - Max 60-70 character width for text inputs
```

## Modal/Dialog Design

```typescript
// Modals should be focused and not overwhelming

<Dialog>
  <DialogContent className="sm:max-w-md">
    {/* Header */}
    <DialogHeader>
      <DialogTitle>Edit Profile</DialogTitle>
      <DialogDescription>
        Make changes to your profile here. Click save when done.
      </DialogDescription>
    </DialogHeader>
    
    {/* Content - scrollable if needed */}
    <div className="py-4 space-y-4">
      {/* Form fields */}
    </div>
    
    {/* Footer - sticky */}
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button onClick={onSave}>Save Changes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// RULES:
// - Max width: sm (for simple), md (for forms), lg (for complex)
// - Always have a clear title
// - Always have a way to close (X button + Escape key)
// - Primary action on the right
// - Don't nest modals
// - Trap focus inside modal
// - Close on backdrop click (unless destructive action)
```

## Table Design

```typescript
// Tables should be scannable

<div className="rounded-lg border overflow-hidden">
  <Table>
    <TableHeader>
      <TableRow className="bg-muted/50">
        <TableHead className="w-[200px]">Name</TableHead>
        <TableHead>Email</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {users.map((user) => (
        <TableRow 
          key={user.id}
          className="hover:bg-muted/50 transition-colors"
        >
          <TableCell className="font-medium">{user.name}</TableCell>
          <TableCell className="text-muted-foreground">{user.email}</TableCell>
          <TableCell>
            <Badge variant={user.active ? 'default' : 'secondary'}>
              {user.active ? 'Active' : 'Inactive'}
            </Badge>
          </TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="sm">Edit</Button>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>

// RULES:
// - Header row slightly different (bg-muted/50)
// - Hover state on rows
// - Align numbers/actions to the right
// - Most important column first (usually name)
// - Use badges for status
// - Keep actions minimal (or use dropdown for many)
// - Add sorting indicators to sortable columns
// - Zebra striping optional (hover state often enough)
```

---

# PART 75: LAYOUT PATTERNS

## Page Layout Structure

```typescript
// Standard page layout with sidebar

// Root layout
<div className="flex h-screen">
  {/* Sidebar - fixed */}
  <aside className="w-64 border-r bg-card flex-shrink-0 hidden md:flex flex-col">
    <div className="p-6 border-b">
      {/* Logo */}
    </div>
    <nav className="flex-1 p-4 overflow-y-auto">
      {/* Navigation */}
    </nav>
    <div className="p-4 border-t">
      {/* User menu */}
    </div>
  </aside>
  
  {/* Main content */}
  <div className="flex-1 flex flex-col overflow-hidden">
    {/* Top header */}
    <header className="h-16 border-b bg-card flex items-center px-6">
      {/* Mobile menu button */}
      {/* Page title or breadcrumbs */}
      {/* Header actions */}
    </header>
    
    {/* Scrollable content area */}
    <main className="flex-1 overflow-y-auto p-6">
      {/* Page content */}
    </main>
  </div>
</div>
```

## Page Content Structure

```typescript
// Standard page content layout

<div className="space-y-8">
  {/* Page header */}
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Page Title</h1>
      <p className="text-muted-foreground">
        Brief description of this page.
      </p>
    </div>
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      Add New
    </Button>
  </div>
  
  {/* Filters/Search (if needed) */}
  <div className="flex items-center gap-4">
    <Input placeholder="Search..." className="max-w-sm" />
    <Select>
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      {/* ... */}
    </Select>
  </div>
  
  {/* Main content */}
  <div>
    {/* Cards, tables, etc. */}
  </div>
</div>
```

## Container & Max Width

```typescript
// Content shouldn't span full width on large screens

// Marketing pages - centered content
<div className="container mx-auto px-4">
  {/* Max-width container (usually 1280px) */}
</div>

// Prose content (blog, docs) - narrower
<div className="container mx-auto px-4 max-w-3xl">
  {/* ~768px max for readability */}
</div>

// Dashboard - full width with padding
<div className="p-6">
  {/* Uses full width */}
</div>

// RULES:
// - Marketing pages: container (centered)
// - Text-heavy content: max-w-3xl or max-w-4xl
// - Dashboards: Can use full width
// - Always have horizontal padding (px-4 minimum)
// - Side padding increases on larger screens
```

## Grid Patterns

```typescript
// Responsive grids that adapt

// Stats cards - 4 columns on desktop
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <StatsCard />
  <StatsCard />
  <StatsCard />
  <StatsCard />
</div>

// Feature cards - 3 columns on desktop
<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
  <FeatureCard />
  <FeatureCard />
  <FeatureCard />
</div>

// Two-column layout (sidebar + content)
<div className="grid gap-8 lg:grid-cols-[300px_1fr]">
  <aside>{/* Sidebar content */}</aside>
  <main>{/* Main content */}</main>
</div>

// Two-column layout (equal)
<div className="grid gap-8 md:grid-cols-2">
  <div>{/* Left */}</div>
  <div>{/* Right */}</div>
</div>

// RULES:
// - Mobile first: single column default
// - sm (640px): 2 columns usually safe
// - lg (1024px): 3-4 columns
// - Use gap-4 for tight, gap-6 for normal, gap-8 for spacious
```

---

# PART 76: RESPONSIVE DESIGN

## Breakpoint Strategy

```typescript
// Tailwind breakpoints (mobile-first)
// sm: 640px   - Large phones, small tablets
// md: 768px   - Tablets
// lg: 1024px  - Laptops
// xl: 1280px  - Desktops
// 2xl: 1536px - Large desktops

// MOBILE FIRST: Default styles are for mobile
// Then override for larger screens

// Example
<div className="
  flex flex-col           // Mobile: stack vertically
  md:flex-row             // Tablet+: row
  gap-4                   // Consistent gap
  p-4 md:p-6 lg:p-8       // Increasing padding
">
```

## Common Responsive Patterns

```typescript
// Navigation
<nav className="
  fixed bottom-0 left-0 right-0   // Mobile: bottom nav
  md:static md:top-0               // Desktop: top nav
">

// Sidebar
<aside className="
  fixed inset-y-0 left-0 z-50     // Mobile: overlay
  w-64 transform -translate-x-full // Hidden by default
  transition-transform
  md:translate-x-0 md:static       // Desktop: always visible
">

// Grid to stack
<div className="
  grid gap-6
  grid-cols-1              // Mobile: single column
  md:grid-cols-2           // Tablet: 2 columns
  lg:grid-cols-3           // Desktop: 3 columns
">

// Text sizing
<h1 className="
  text-2xl                 // Mobile: smaller
  md:text-3xl              // Tablet: medium
  lg:text-4xl              // Desktop: larger
">

// Show/hide elements
<div className="hidden md:block">
  {/* Desktop only */}
</div>
<div className="md:hidden">
  {/* Mobile only */}
</div>

// Spacing
<section className="
  py-12                    // Mobile: less space
  md:py-16                 // Tablet: more
  lg:py-24                 // Desktop: most
">
```

## Touch-Friendly Design

```typescript
// RULES for mobile/touch:
// - Minimum tap target: 44x44px
// - Spacing between tap targets: 8px minimum
// - No hover-only interactions
// - Larger text on mobile (16px minimum)

// Touch-friendly button
<Button className="
  h-10 px-4               // Desktop
  md:h-11                 // Slightly larger on tablet
  touch-manipulation      // Prevent double-tap zoom
">

// Touch-friendly list items
<div className="
  py-3 px-4               // Comfortable tap area
  min-h-[44px]            // Minimum touch target
  flex items-center
">

// Touch-friendly form inputs
<Input className="
  h-11                    // Taller on mobile
  text-base               // 16px prevents zoom on iOS
"/>
```

---

# PART 77: MICRO-INTERACTIONS & ANIMATIONS

## Transition Defaults

```typescript
// ALWAYS add transitions to interactive elements

// Default transition for most things
className="transition-colors duration-200"

// For transforms (scale, position)
className="transition-transform duration-200"

// For multiple properties
className="transition-all duration-200"

// Slower for emphasis
className="transition-all duration-300"

// RULES:
// - 150-200ms for quick feedback (hover, focus)
// - 200-300ms for state changes
// - 300-500ms for reveals/modals
// - NEVER go over 500ms (feels sluggish)
```

## Hover States

```typescript
// Cards
<div className="
  transition-all duration-200
  hover:shadow-md           // Lift effect
  hover:border-primary/50   // Highlight border
">

// Buttons
<button className="
  transition-colors duration-200
  hover:bg-primary/90       // Slight darken
">

// Links
<a className="
  transition-colors duration-200
  hover:text-primary        // Color change
  hover:underline           // Or underline
">

// Icons
<button className="
  transition-all duration-200
  hover:scale-110           // Slight grow
  hover:text-primary
">

// Table rows
<tr className="
  transition-colors duration-200
  hover:bg-muted/50
">
```

## Focus States

```typescript
// ALWAYS visible focus states for accessibility

// Default focus ring (use Tailwind's default)
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

// For inputs
<Input className="
  focus-visible:ring-2 
  focus-visible:ring-primary 
  focus-visible:border-primary
"/>

// RULES:
// - Use focus-visible (not focus) to avoid mouse click rings
// - Ring should be visible against background
// - Don't remove focus states, restyle them
```

## Loading States

```typescript
// Spinner
<div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />

// Pulse (for skeletons)
<div className="animate-pulse bg-muted rounded h-4 w-full" />

// Button loading
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Loading...
</Button>

// Skeleton card
<div className="rounded-xl border p-6 space-y-4">
  <div className="animate-pulse space-y-3">
    <div className="h-4 bg-muted rounded w-1/3" />
    <div className="h-8 bg-muted rounded w-full" />
    <div className="h-4 bg-muted rounded w-2/3" />
  </div>
</div>
```

## Enter/Exit Animations

```typescript
// Fade in
<div className="
  animate-in fade-in
  duration-200
">

// Slide in from bottom (for modals, toasts)
<div className="
  animate-in slide-in-from-bottom-4 fade-in
  duration-300
">

// Slide in from right (for slide-overs)
<div className="
  animate-in slide-in-from-right fade-in
  duration-300
">

// Scale in (for dropdowns, popovers)
<div className="
  animate-in zoom-in-95 fade-in
  duration-200
">

// Using Framer Motion for complex animations
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2 }}
    >
      {/* Content */}
    </motion.div>
  )}
</AnimatePresence>
```

## Meaningful Motion

```typescript
// RULES:
// 1. Motion should provide feedback, not decoration
// 2. Keep it subtle - users shouldn't notice it, just feel it
// 3. Respect reduced motion preferences

// Check for reduced motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// In CSS/Tailwind
<div className="
  motion-safe:animate-bounce  // Only animate if motion is OK
  motion-reduce:animate-none  // Disable if user prefers
">

// Good motion:
// ✓ Button press feedback
// ✓ Modal enter/exit
// ✓ Loading spinners
// ✓ State change transitions
// ✓ Hover feedback

// Bad motion:
// ✗ Gratuitous bouncing
// ✗ Auto-playing animations
// ✗ Slow, dramatic reveals
// ✗ Animations that block interaction
```

---

# PART 78: VISUAL HIERARCHY

## Establishing Hierarchy

```typescript
// Visual hierarchy guides the eye through content
// Use SIZE, WEIGHT, COLOR, SPACING to create levels

// Level 1: Page title (largest, boldest)
<h1 className="text-3xl font-bold tracking-tight">
  Dashboard
</h1>

// Level 2: Section headers
<h2 className="text-xl font-semibold">
  Recent Activity
</h2>

// Level 3: Card titles
<h3 className="text-lg font-medium">
  Project Name
</h3>

// Level 4: Body text
<p className="text-base text-foreground">
  Main content goes here.
</p>

// Level 5: Secondary text
<p className="text-sm text-muted-foreground">
  Less important info.
</p>

// Level 6: Labels, captions
<span className="text-xs text-muted-foreground uppercase tracking-wide">
  Category
</span>
```

## Creating Focus Points

```typescript
// Use contrast to draw attention

// Primary CTA stands out
<div className="flex gap-4">
  <Button variant="outline">Secondary</Button>
  <Button>Primary Action</Button>  {/* Stands out */}
</div>

// Important stats highlighted
<div className="grid grid-cols-4 gap-4">
  <Card className="border-primary bg-primary/5">  {/* Highlighted */}
    <div className="text-3xl font-bold text-primary">$12,450</div>
    <div className="text-sm text-muted-foreground">Revenue</div>
  </Card>
  <Card>
    <div className="text-3xl font-bold">156</div>
    <div className="text-sm text-muted-foreground">Users</div>
  </Card>
  {/* ... */}
</div>

// Important message
<Alert className="border-primary bg-primary/10">
  <AlertTitle>Important Update</AlertTitle>
  <AlertDescription>This stands out from normal content.</AlertDescription>
</Alert>
```

## Grouping & Separation

```typescript
// Related items should be visually grouped
// Unrelated items should be visually separated

// Grouping with proximity (less space between related items)
<div className="space-y-8">
  {/* Group 1 */}
  <div className="space-y-4">
    <h2 className="text-xl font-semibold">Account Settings</h2>
    <div className="space-y-2">  {/* Tighter spacing for related fields */}
      <FormField label="Name" />
      <FormField label="Email" />
    </div>
  </div>
  
  {/* Group 2 - separated by larger gap */}
  <div className="space-y-4">
    <h2 className="text-xl font-semibold">Preferences</h2>
    <div className="space-y-2">
      <FormField label="Language" />
      <FormField label="Timezone" />
    </div>
  </div>
</div>

// Grouping with borders
<div className="divide-y">
  <div className="py-4">Item 1</div>
  <div className="py-4">Item 2</div>
  <div className="py-4">Item 3</div>
</div>

// Grouping with backgrounds
<div className="bg-muted/30 rounded-lg p-4 space-y-2">
  {/* Grouped content */}
</div>
```

---

# PART 79: DASHBOARD DESIGN

## Stats Cards

```typescript
// Stats cards should be scannable at a glance

<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  {/* Revenue Card */}
  <Card className="p-6">
    <div className="flex items-center justify-between mb-4">
      <span className="text-sm font-medium text-muted-foreground">
        Revenue
      </span>
      <DollarSign className="h-4 w-4 text-muted-foreground" />
    </div>
    <div className="space-y-1">
      <div className="text-2xl font-bold">$45,231</div>
      <div className="flex items-center text-sm">
        <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
        <span className="text-green-500 font-medium">+12.5%</span>
        <span className="text-muted-foreground ml-1">from last month</span>
      </div>
    </div>
  </Card>
  
  {/* More cards... */}
</div>

// RULES:
// - Label at top (what is this metric?)
// - Big number in the middle (the value)
// - Context at bottom (change, comparison)
// - Icon for quick recognition
// - Consistent card heights
```

## Charts

```typescript
// Charts should be clear and not overwhelming

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

<Card className="p-6">
  <div className="mb-4">
    <h3 className="text-lg font-semibold">Revenue Over Time</h3>
    <p className="text-sm text-muted-foreground">Monthly revenue for 2024</p>
  </div>
  
  <div className="h-[300px]">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <XAxis 
          dataKey="month" 
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip 
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <Line 
          type="monotone"
          dataKey="revenue"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
</Card>

// RULES:
// - Clear title describing what the chart shows
// - Appropriate chart type (line for trends, bar for comparisons)
// - Minimal gridlines (or none)
// - Clear axis labels
// - Consistent colors (use design system colors)
// - Tooltips for detail
// - Responsive (ResponsiveContainer)
```

## Data Tables in Dashboard

```typescript
// Dashboard tables should surface key info

<Card>
  <div className="p-6 border-b">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold">Recent Orders</h3>
        <p className="text-sm text-muted-foreground">Latest transactions</p>
      </div>
      <Button variant="outline" size="sm">View All</Button>
    </div>
  </div>
  
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Order</TableHead>
        <TableHead>Customer</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="text-right">Amount</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {orders.slice(0, 5).map((order) => (
        <TableRow key={order.id}>
          <TableCell className="font-medium">#{order.id}</TableCell>
          <TableCell>{order.customer}</TableCell>
          <TableCell>
            <Badge variant={getStatusVariant(order.status)}>
              {order.status}
            </Badge>
          </TableCell>
          <TableCell className="text-right font-medium">
            ${order.amount}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</Card>

// RULES:
// - Show only 5-10 most recent/important items
// - "View All" link to full list
// - Most important columns visible
// - Status uses badges
// - Amounts right-aligned
```

## Dashboard Layout

```typescript
// Dashboard should tell a story at a glance

<div className="space-y-8">
  {/* Row 1: Key Metrics */}
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <StatsCard title="Revenue" value="$45,231" change="+12.5%" />
    <StatsCard title="Users" value="2,345" change="+5.2%" />
    <StatsCard title="Orders" value="456" change="+8.1%" />
    <StatsCard title="Conversion" value="3.2%" change="-0.5%" negative />
  </div>
  
  {/* Row 2: Charts */}
  <div className="grid gap-4 lg:grid-cols-7">
    {/* Main chart - wider */}
    <Card className="lg:col-span-4">
      <RevenueChart />
    </Card>
    
    {/* Secondary chart */}
    <Card className="lg:col-span-3">
      <TrafficChart />
    </Card>
  </div>
  
  {/* Row 3: Tables/Lists */}
  <div className="grid gap-4 lg:grid-cols-2">
    <RecentOrdersTable />
    <TopCustomersTable />
  </div>
</div>
```

---

# PART 80: LANDING PAGE PATTERNS

## Hero Section

```typescript
// Hero is the first thing visitors see - make it count

<section className="py-20 md:py-32">
  <div className="container mx-auto px-4">
    <div className="max-w-3xl mx-auto text-center">
      {/* Badge/Label (optional) */}
      <div className="inline-flex items-center rounded-full border px-4 py-1.5 mb-6">
        <span className="text-sm font-medium">
          ✨ Now with AI features
        </span>
      </div>
      
      {/* Main Headline */}
      <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
        Build Better Apps,{' '}
        <span className="text-primary">10x Faster</span>
      </h1>
      
      {/* Subheadline */}
      <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
        The development platform that makes your AI code like a senior developer. 
        Stop fixing bugs. Start shipping features.
      </p>
      
      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button size="lg" className="text-lg px-8">
          Get Started Free
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        <Button size="lg" variant="outline" className="text-lg px-8">
          Watch Demo
        </Button>
      </div>
      
      {/* Social Proof */}
      <p className="mt-8 text-sm text-muted-foreground">
        Trusted by 10,000+ developers • No credit card required
      </p>
    </div>
  </div>
</section>

// RULES:
// - One clear headline (what do you do?)
// - One supporting line (why should I care?)
// - One primary CTA
// - Optional secondary CTA
// - Social proof if available
```

## Features Section

```typescript
<section className="py-20 bg-muted/30">
  <div className="container mx-auto px-4">
    {/* Section header */}
    <div className="text-center mb-16">
      <h2 className="text-3xl md:text-4xl font-bold mb-4">
        Everything You Need to Ship
      </h2>
      <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
        All the tools and patterns to build production-ready apps.
      </p>
    </div>
    
    {/* Features grid */}
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
      {features.map((feature) => (
        <Card key={feature.title} className="p-6">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
            <feature.icon className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
          <p className="text-muted-foreground">{feature.description}</p>
        </Card>
      ))}
    </div>
  </div>
</section>

// RULES:
// - Clear section heading
// - 3-6 features (not overwhelming)
// - Icon + title + description
// - Consistent card heights
// - Benefits, not just features
```

## Pricing Section

```typescript
<section className="py-20">
  <div className="container mx-auto px-4">
    <div className="text-center mb-16">
      <h2 className="text-3xl md:text-4xl font-bold mb-4">
        Simple, Transparent Pricing
      </h2>
      <p className="text-xl text-muted-foreground">
        Start free. Upgrade when you need more.
      </p>
    </div>
    
    <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
      {/* Free Tier */}
      <Card className="p-8">
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Free</h3>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">$0</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            For individuals getting started
          </p>
        </div>
        <ul className="space-y-3 mb-8">
          {freeFeatures.map((f) => (
            <li key={f} className="flex items-center text-sm">
              <Check className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>
        <Button variant="outline" className="w-full">
          Get Started
        </Button>
      </Card>
      
      {/* Pro Tier - Highlighted */}
      <Card className="p-8 border-primary shadow-lg relative">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge>Most Popular</Badge>
        </div>
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Pro</h3>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">$49</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            For professionals and small teams
          </p>
        </div>
        <ul className="space-y-3 mb-8">
          {proFeatures.map((f) => (
            <li key={f} className="flex items-center text-sm">
              <Check className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>
        <Button className="w-full">
          Get Started
        </Button>
      </Card>
      
      {/* Enterprise */}
      <Card className="p-8">
        {/* Similar structure */}
      </Card>
    </div>
  </div>
</section>

// RULES:
// - Highlight recommended plan
// - Price prominent
// - Feature list with checkmarks
// - Clear CTA on each card
// - Keep it to 3-4 tiers max
```

## CTA Section

```typescript
<section className="py-20 bg-primary text-primary-foreground">
  <div className="container mx-auto px-4">
    <div className="max-w-3xl mx-auto text-center">
      <h2 className="text-3xl md:text-4xl font-bold mb-4">
        Ready to Build Something Great?
      </h2>
      <p className="text-xl opacity-90 mb-8">
        Join thousands of developers shipping faster with CodeBakers.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button size="lg" variant="secondary" className="text-lg px-8">
          Start Free Trial
        </Button>
        <Button size="lg" variant="outline" className="text-lg px-8 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
          Talk to Sales
        </Button>
      </div>
    </div>
  </div>
</section>

// RULES:
// - Different background to stand out
// - Strong action-oriented headline
// - Clear CTA
// - Near the bottom but not at the very end
```

## Footer

```typescript
<footer className="border-t py-12 bg-card">
  <div className="container mx-auto px-4">
    <div className="grid gap-8 md:grid-cols-4">
      {/* Brand */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Logo className="h-8 w-8" />
          <span className="font-bold text-xl">CodeBakers</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Making AI code like senior developers.
        </p>
      </div>
      
      {/* Links */}
      <div>
        <h4 className="font-semibold mb-4">Product</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li><Link href="/features">Features</Link></li>
          <li><Link href="/pricing">Pricing</Link></li>
          <li><Link href="/docs">Documentation</Link></li>
        </ul>
      </div>
      
      <div>
        <h4 className="font-semibold mb-4">Company</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li><Link href="/about">About</Link></li>
          <li><Link href="/blog">Blog</Link></li>
          <li><Link href="/careers">Careers</Link></li>
        </ul>
      </div>
      
      <div>
        <h4 className="font-semibold mb-4">Legal</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li><Link href="/privacy">Privacy</Link></li>
          <li><Link href="/terms">Terms</Link></li>
        </ul>
      </div>
    </div>
    
    {/* Bottom */}
    <div className="mt-12 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4">
      <p className="text-sm text-muted-foreground">
        © 2024 CodeBakers. All rights reserved.
      </p>
      <div className="flex gap-4">
        <Link href="#" className="text-muted-foreground hover:text-foreground">
          <Twitter className="h-5 w-5" />
        </Link>
        <Link href="#" className="text-muted-foreground hover:text-foreground">
          <Github className="h-5 w-5" />
        </Link>
      </div>
    </div>
  </div>
</footer>
```

---

**This is the Ultimate AI Building Robot.**

**80 Parts. Complete SaaS + Design Coverage. Production-Ready Patterns.**

**Tell Claude what you want. It builds it beautifully.**

---

# END OF CLAUDE.md ENTERPRISE EDITION v13.0

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
| i18n & State | 53-54 | Translations, Zustand |
| API & Migrations | 55-56 | Versioning, Schema |
| Webhooks & Docs | 57-58 | Outgoing, OpenAPI |
| Health & Resilience | 59-61 | Checks, Retry |
| Idempotency & Deletes | 62-63 | Duplicates, Soft Delete |
| Money & Dates | 64-65 | Currency, Timezones |
| Testing & CI/CD | 66-67 | Vitest, GitHub Actions |
| Security & Auth | 68-70 | Headers, 2FA, OAuth |
| Onboarding & UI | 71-72 | Flows, Empty States |
| **Design Foundations** | 73 | Spacing, Typography, Colors |
| **Component Patterns** | 74 | Cards, Buttons, Forms |
| **Layout Patterns** | 75 | Page Structure, Grids |
| **Responsive Design** | 76 | Mobile-first, Breakpoints |
| **Micro-interactions** | 77 | Animations, Transitions |
| **Visual Hierarchy** | 78 | Focus, Grouping |
| **Dashboard Design** | 79 | Stats, Charts, Tables |
| **Landing Pages** | 80 | Hero, Features, Pricing |

---

**80 Parts. 20,000+ Lines. Ship Beautiful Products.**

---

# PART 81: INTERPRETING DESIGN FILES

## When User Uploads a Design Image

When a user uploads a screenshot, mockup, or design file, follow this process:

### Step 1: Analyze the Design

```
Before writing ANY code, analyze and describe:

1. LAYOUT
   - Overall structure (sidebar? header? grid?)
   - Number of columns
   - Major sections
   - Content hierarchy

2. COLORS
   - Primary color (buttons, links, accents)
   - Background colors (main, cards, sections)
   - Text colors (headings, body, muted)
   - Any gradients or special effects

3. TYPOGRAPHY
   - Heading sizes (estimate: xl, 2xl, 3xl?)
   - Body text size
   - Font weight variations
   - Any special fonts visible

4. SPACING
   - Padding inside cards/sections
   - Gaps between elements
   - Overall density (tight, normal, spacious)

5. COMPONENTS
   - Buttons (style, rounded, size)
   - Cards (borders, shadows, radius)
   - Forms (input style)
   - Navigation (style, position)
   - Any unique/custom components

6. INTERACTIVE STATES (infer if not shown)
   - What happens on hover?
   - Active/selected states
   - Focus states needed
```

### Step 2: Ask Clarifying Questions (If Needed)

```
If the design is unclear or incomplete, ASK before building:

"I can see the design. Before I build it, a few questions:

1. Colors: The primary blue looks like #3B82F6 - is that correct,
   or do you have specific brand colors?

2. The mobile layout isn't shown - should I:
   - Stack the sidebar below the header?
   - Use a hamburger menu?
   - Something else?

3. I see a data table - should rows be:
   - Clickable (navigate to detail)?
   - Have hover states?
   - Include actions dropdown?

4. Should this support dark mode?

Or I can make sensible defaults for all of these - just let me know!"
```

### Step 3: Describe What You'll Build

```
Before coding, confirm the plan:

"Here's what I'll build from your design:

LAYOUT:
- Fixed sidebar (256px) on left
- Header with search + user menu
- Main content area with cards

COMPONENTS:
- Stats cards (4 across on desktop, 2 on tablet, 1 on mobile)
- Line chart for revenue
- Recent orders table
- Activity feed sidebar

COLORS (extracted from design):
- Primary: #3B82F6 (blue)
- Background: #F9FAFB
- Cards: #FFFFFF
- Text: #111827 (headings), #6B7280 (body)

ADDITIONS (best practices):
- Responsive breakpoints
- Hover/focus states
- Loading skeletons
- Accessibility attributes

Sound good? I'll start building."
```

## Reading Design Intent

### Identify Component Types

```typescript
// When you see this in a design → Build this component

// Rounded rectangle with shadow + content
→ Card component

// Horizontal bar at top with logo + nav + user
→ Header/Navbar component

// Vertical bar on side with icons/links
→ Sidebar component

// Pill with colored background + text
→ Badge component

// Rectangle with border + text input
→ Input component

// Filled rectangle with text
→ Button component

// Table with rows and columns
→ Table component (not a grid of divs!)

// Circular image
→ Avatar component

// Small popup near element
→ Tooltip or Popover

// Overlay with centered content
→ Modal/Dialog

// Sliding panel from side
→ Sheet/Drawer
```

### Identify Layout Patterns

```typescript
// When you see this layout → Use this code

// Items in a row with equal spacing
→ flex gap-4

// Items in a row, spread apart
→ flex justify-between

// Items in a row, some pushed right
→ flex with ml-auto on right items

// Grid of cards (2, 3, or 4 across)
→ grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3

// Sidebar + main content
→ grid grid-cols-[256px_1fr] or flex with fixed-width aside

// Stacked sections with space
→ space-y-8 or flex flex-col gap-8

// Centered content with max width
→ container mx-auto max-w-4xl

// Full-bleed section
→ Remove container, use full width with px-4
```

### Identify Spacing from Visuals

```typescript
// Estimate spacing from the design:

// Looks very tight (barely any gap)
→ gap-1 or gap-2 (4-8px)

// Normal/comfortable spacing
→ gap-4 (16px)

// Spacious/breathing room
→ gap-6 or gap-8 (24-32px)

// Section separations
→ space-y-12 or py-16 (48-64px)

// Large hero spacing
→ py-24 or py-32 (96-128px)

// Card padding (normal)
→ p-6 (24px)

// Card padding (compact)
→ p-4 (16px)

// Card padding (spacious)
→ p-8 (32px)
```

---

# PART 82: DESIGN TOKEN EXTRACTION

## Extracting Colors from Design Images

When building from a design, extract and organize colors:

```typescript
// Step 1: Identify colors from the image
// Look at: backgrounds, text, buttons, accents, borders

// Step 2: Create a color palette in CSS variables
// globals.css

:root {
  /* Extracted from design */
  --background: 249 250 251;      /* #F9FAFB - main bg */
  --foreground: 17 24 39;         /* #111827 - main text */
  
  --card: 255 255 255;            /* #FFFFFF - card bg */
  --card-foreground: 17 24 39;    /* #111827 - card text */
  
  --primary: 59 130 246;          /* #3B82F6 - buttons, links */
  --primary-foreground: 255 255 255;
  
  --secondary: 243 244 246;       /* #F3F4F6 - secondary buttons */
  --secondary-foreground: 55 65 81;
  
  --muted: 243 244 246;           /* #F3F4F6 - muted backgrounds */
  --muted-foreground: 107 114 128; /* #6B7280 - muted text */
  
  --accent: 239 246 255;          /* #EFF6FF - highlights */
  --accent-foreground: 29 78 216;
  
  --destructive: 239 68 68;       /* #EF4444 - errors, delete */
  --destructive-foreground: 255 255 255;
  
  --border: 229 231 235;          /* #E5E7EB */
  --input: 229 231 235;
  --ring: 59 130 246;             /* Focus ring = primary */
  
  --radius: 0.5rem;               /* Border radius from design */
}

/* Dark mode (if applicable) */
.dark {
  --background: 17 24 39;
  --foreground: 249 250 251;
  /* ... extract dark versions ... */
}
```

## Extracting Typography

```typescript
// Analyze text in the design and map to scale

// From design observation:
// - Large page titles: ~30-36px, bold
// - Section headers: ~20-24px, semibold  
// - Card titles: ~18px, medium
// - Body text: ~14-16px, regular
// - Small labels: ~12px, medium

// Map to Tailwind classes:
const typography = {
  pageTitle: 'text-3xl font-bold tracking-tight',      // 30px
  sectionHeader: 'text-xl font-semibold',              // 20px
  cardTitle: 'text-lg font-medium',                    // 18px
  body: 'text-base',                                   // 16px
  bodySmall: 'text-sm text-muted-foreground',          // 14px
  label: 'text-xs font-medium uppercase tracking-wide', // 12px
};

// If design uses a specific font:
// 1. Check if it's a Google Font
// 2. Add to layout.tsx:
import { Inter, Space_Grotesk } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const spaceGrotesk = Space_Grotesk({ 
  subsets: ['latin'], 
  variable: '--font-heading' 
});

// 3. Use in tailwind.config.ts:
fontFamily: {
  sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
  heading: ['var(--font-heading)', ...defaultTheme.fontFamily.sans],
}
```

## Extracting Spacing System

```typescript
// Analyze spacing in the design

// Measure (or estimate) common spacings:
// - Gap between inline items: ~8px (gap-2)
// - Gap between stacked items: ~16px (gap-4 or space-y-4)
// - Card padding: ~24px (p-6)
// - Section padding: ~64px (py-16)
// - Container padding: ~16-24px (px-4 md:px-6)

// Create consistent spacing usage:
const spacing = {
  // Inside components
  inputPadding: 'px-3 py-2',           // Form inputs
  buttonPadding: 'px-4 py-2',          // Buttons
  cardPadding: 'p-6',                  // Cards
  
  // Between elements
  tightGap: 'gap-2',                   // 8px - related items
  normalGap: 'gap-4',                  // 16px - default
  looseGap: 'gap-6',                   // 24px - distinct items
  
  // Sections
  sectionPadding: 'py-16 md:py-24',    // Vertical section spacing
  containerPadding: 'px-4 md:px-6',    // Horizontal page padding
  
  // Stacked content
  stackTight: 'space-y-2',             // Form fields
  stackNormal: 'space-y-4',            // Card content
  stackLoose: 'space-y-8',             // Page sections
};
```

## Extracting Component Styles

```typescript
// Analyze component styling in design

// BUTTONS - Look at:
// - Border radius (rounded-md, rounded-lg, rounded-full?)
// - Padding (compact, normal, large?)
// - Font weight (medium, semibold?)
// - Any shadows?

const buttonStyles = {
  // From design: rounded corners, medium padding, semibold text
  base: 'rounded-lg px-4 py-2 font-semibold transition-colors',
  primary: 'bg-primary text-white hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border border-input bg-transparent hover:bg-accent',
};

// CARDS - Look at:
// - Border (visible or shadow-only?)
// - Border radius
// - Shadow (none, subtle, prominent?)
// - Background color

const cardStyles = {
  // From design: subtle border, rounded, no shadow
  base: 'rounded-xl border bg-card',
  
  // OR if design shows shadows:
  base: 'rounded-xl bg-card shadow-sm',
  
  // OR if design shows both:
  base: 'rounded-xl border bg-card shadow-sm',
};

// INPUTS - Look at:
// - Border style
// - Border radius (should match buttons)
// - Height (should align with buttons)

const inputStyles = {
  base: 'rounded-lg border border-input px-3 py-2 text-sm',
  focus: 'focus:outline-none focus:ring-2 focus:ring-ring',
};
```

---

# PART 83: FIGMA-TO-CODE WORKFLOW

## When User Shares Figma File/Export

### Understanding Figma Exports

```
Users might share:
1. Screenshot of Figma design
2. Exported PNG/JPG from Figma
3. Figma link (you can't access, but they can describe)
4. Copy-pasted CSS from Figma
5. Exported SVG icons
6. Design specs (colors, fonts, spacing)

For each, here's how to handle:
```

### Handling Figma Screenshots

```typescript
// When user uploads Figma screenshot:

// 1. Note the frame name (usually visible at top)
"I can see this is the 'Dashboard - Desktop' frame."

// 2. Identify the viewport/breakpoint
"This appears to be a desktop design (looks like ~1440px wide)."

// 3. Note any Figma-specific elements to ignore
"I'll ignore the Figma UI elements and focus on the actual design."

// 4. Ask about other frames
"Do you have mobile/tablet versions of this design? 
 If not, I'll create responsive versions based on this."
```

### Handling Figma CSS Export

```typescript
// Figma exports CSS like this:
/*
  width: 343px;
  height: 48px;
  background: #3B82F6;
  border-radius: 12px;
  font-family: 'Inter';
  font-style: normal;
  font-weight: 600;
  font-size: 16px;
  line-height: 24px;
  color: #FFFFFF;
*/

// Convert to Tailwind:
// DON'T use exact pixel values - map to scale

// Figma says → Tailwind equivalent
// width: 343px → w-full (responsive, not fixed)
// height: 48px → h-12 (48px in Tailwind)
// background: #3B82F6 → bg-primary (use CSS variable)
// border-radius: 12px → rounded-xl (12px)
// font-weight: 600 → font-semibold
// font-size: 16px → text-base
// line-height: 24px → leading-6 (or default with text-base)
// color: #FFFFFF → text-primary-foreground

// Result:
<button className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-semibold">
  Button Text
</button>
```

### Figma Auto Layout → Flexbox/Grid

```typescript
// Figma Auto Layout translates to:

// Horizontal auto layout, gap 16
→ flex gap-4

// Vertical auto layout, gap 12
→ flex flex-col gap-3

// Auto layout with "Space between"
→ flex justify-between

// Auto layout with centered alignment
→ flex items-center

// Auto layout with "Fill container" on children
→ flex with flex-1 on children

// Auto layout with "Hug contents"
→ flex (default, no flex-1)

// Auto layout with wrap
→ flex flex-wrap gap-4

// Frame with grid layout
→ grid grid-cols-3 gap-4
```

### Handling Figma Components

```typescript
// When design has repeated elements (Figma components):

// 1. Identify the component
"I see this card design is used multiple times - 
 I'll create a reusable Card component."

// 2. Identify variants
"The button has 3 variants in the design:
 - Primary (filled blue)
 - Secondary (gray)
 - Outline (border only)
 I'll create these as Button variants."

// 3. Identify props from variants
"The card has these variations:
 - With/without image
 - Different badge colors
 I'll make these configurable props."

// Create the component:
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning';
}

export function FeatureCard({ 
  icon, 
  title, 
  description, 
  badge,
  badgeVariant = 'default'
}: FeatureCardProps) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
      {badge && (
        <Badge variant={badgeVariant} className="mt-4">
          {badge}
        </Badge>
      )}
    </div>
  );
}
```

## Figma Design Specs → Code

### Converting Figma Measurements

```typescript
// Figma uses exact pixels - convert to Tailwind scale

// SPACING (padding, margin, gap)
// Figma → Tailwind
// 4px   → 1
// 8px   → 2
// 12px  → 3
// 16px  → 4
// 20px  → 5
// 24px  → 6
// 32px  → 8
// 40px  → 10
// 48px  → 12
// 64px  → 16
// 80px  → 20
// 96px  → 24

// FONT SIZE
// 12px → text-xs
// 14px → text-sm
// 16px → text-base
// 18px → text-lg
// 20px → text-xl
// 24px → text-2xl
// 30px → text-3xl
// 36px → text-4xl
// 48px → text-5xl
// 60px → text-6xl

// FONT WEIGHT
// 400 → font-normal
// 500 → font-medium
// 600 → font-semibold
// 700 → font-bold

// BORDER RADIUS
// 4px  → rounded-sm
// 6px  → rounded-md
// 8px  → rounded-lg
// 12px → rounded-xl
// 16px → rounded-2xl
// 24px → rounded-3xl
// 9999px → rounded-full

// WIDTH/HEIGHT (convert fixed to responsive when possible)
// Fixed 1200px container → container mx-auto (max-w-7xl)
// Fixed 300px sidebar → w-64 or w-72
// Fixed 48px height → h-12
// "Fill" in Figma → w-full or flex-1
```

---

# PART 84: ASSET HANDLING

## Handling Images from Design

### When User Provides Images

```typescript
// User might provide:
// 1. Hero images
// 2. Product photos
// 3. Team member photos
// 4. Background images
// 5. Illustrations

// ALWAYS use Next.js Image component:
import Image from 'next/image';

// For provided images, ask:
"I'll need the actual image files. Can you:
1. Upload them directly, OR
2. Put them in /public/images/, OR
3. Provide URLs if they're hosted somewhere

For best results, provide:
- 2x resolution for retina displays
- WebP format if possible (or I'll optimize)
- Alt text descriptions for accessibility"

// Using images properly:
<Image
  src="/images/hero.jpg"
  alt="Dashboard preview showing analytics"
  width={1200}
  height={630}
  priority // For above-fold images
  className="rounded-xl"
/>

// For user-provided/dynamic images:
<Image
  src={user.avatar || '/images/default-avatar.png'}
  alt={user.name}
  width={48}
  height={48}
  className="rounded-full"
/>

// For background images:
<div 
  className="relative bg-cover bg-center"
  style={{ backgroundImage: `url(${backgroundUrl})` }}
>
  {/* Overlay for text readability */}
  <div className="absolute inset-0 bg-black/50" />
  <div className="relative z-10">
    {/* Content */}
  </div>
</div>
```

### Handling Icons from Design

```typescript
// OPTION 1: Lucide Icons (Recommended)
// If design uses common icons, map to Lucide:
import { 
  Home, Settings, User, Mail, Phone, 
  ChevronRight, Plus, Search, X,
  Check, AlertCircle, Info
} from 'lucide-react';

// Lucide has 1000+ icons, usually matches any design

// OPTION 2: User provides SVGs
// Save to /components/icons/ and create components:

// components/icons/custom-icon.tsx
export function CustomIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className}
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* SVG path from Figma export */}
      <path d="..." fill="currentColor" />
    </svg>
  );
}

// OPTION 3: Icon font (if design specifies)
// Add to layout.tsx:
import '@fortawesome/fontawesome-free/css/all.min.css';

// BEST PRACTICE for icons:
// - Use currentColor so icons inherit text color
// - Standard sizes: h-4 w-4 (16px), h-5 w-5 (20px), h-6 w-6 (24px)
// - Add aria-hidden="true" for decorative icons
// - Add sr-only label for icon-only buttons

<button className="p-2 hover:bg-muted rounded-lg">
  <Search className="h-5 w-5" aria-hidden="true" />
  <span className="sr-only">Search</span>
</button>
```

### Handling Fonts from Design

```typescript
// If design uses custom fonts:

// OPTION 1: Google Fonts (easiest)
// app/layout.tsx
import { Inter, Playfair_Display } from 'next/font/google';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
});

const playfair = Playfair_Display({ 
  subsets: ['latin'],
  variable: '--font-serif',
});

export default function RootLayout({ children }) {
  return (
    <html className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans">
        {children}
      </body>
    </html>
  );
}

// tailwind.config.ts
fontFamily: {
  sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
  serif: ['var(--font-serif)', 'Georgia', 'serif'],
}

// OPTION 2: Custom/Local fonts
// Place in /public/fonts/
// app/layout.tsx
import localFont from 'next/font/local';

const customFont = localFont({
  src: [
    { path: '../public/fonts/CustomFont-Regular.woff2', weight: '400' },
    { path: '../public/fonts/CustomFont-Medium.woff2', weight: '500' },
    { path: '../public/fonts/CustomFont-Bold.woff2', weight: '700' },
  ],
  variable: '--font-custom',
});

// Ask user for font files:
"The design uses 'Acme Sans' font. Can you provide:
1. The font files (.woff2 preferred), OR
2. A link to the font (Google Fonts, Adobe Fonts, etc.), OR
3. Should I substitute with a similar free font?"
```

### Optimizing Assets

```typescript
// ALWAYS optimize images:

// 1. Use Next.js Image (auto-optimizes)
<Image src="..." alt="..." width={800} height={600} />

// 2. Specify sizes for responsive images
<Image 
  src="..." 
  alt="..."
  fill
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  className="object-cover"
/>

// 3. Use appropriate quality
<Image 
  src="..." 
  alt="..."
  quality={85} // Default is 75, increase for hero images
/>

// 4. Lazy load below-fold images (default)
// Use priority={true} only for above-fold

// SVG Optimization:
// If user provides unoptimized SVGs, clean them:
// - Remove unnecessary attributes
// - Remove editor metadata
// - Use currentColor for fills
// - Simplify paths if possible

// Or recommend: "Run your SVGs through SVGO or svgomg.net for optimization"
```

---

# PART 85: DESIGN QA CHECKLIST

## After Building from Design, Verify:

### Visual Match Checklist

```markdown
## Layout
- [ ] Overall structure matches design
- [ ] Spacing between sections is correct
- [ ] Alignment (left, center, right) matches
- [ ] Grid columns match on desktop
- [ ] Container max-width matches

## Typography
- [ ] Font family is correct
- [ ] Heading sizes match
- [ ] Body text size matches
- [ ] Font weights match
- [ ] Line heights look right
- [ ] Letter spacing (if specified) matches

## Colors
- [ ] Primary color matches
- [ ] Background colors match
- [ ] Text colors match
- [ ] Border colors match
- [ ] Any gradients match

## Components
- [ ] Button styles match
- [ ] Card styles match
- [ ] Input styles match
- [ ] Border radius is consistent
- [ ] Shadows match design

## Spacing
- [ ] Padding inside components matches
- [ ] Gaps between items match
- [ ] Margins around sections match
```

### Responsive Checklist

```markdown
## Mobile (< 640px)
- [ ] Single column layout
- [ ] Navigation is mobile-friendly (hamburger or bottom nav)
- [ ] Text is readable (min 16px for body)
- [ ] Touch targets are large enough (44px minimum)
- [ ] No horizontal scroll

## Tablet (640px - 1024px)
- [ ] Appropriate column count (usually 2)
- [ ] Sidebar behavior (collapsed or hidden?)
- [ ] Images scale properly

## Desktop (> 1024px)
- [ ] Full layout as designed
- [ ] Max-width container (content doesn't stretch too wide)
- [ ] Hover states work
```

### Interaction Checklist

```markdown
## Hover States
- [ ] Buttons have hover effect
- [ ] Links have hover effect
- [ ] Cards have hover effect (if clickable)
- [ ] Table rows have hover (if applicable)

## Focus States
- [ ] All interactive elements have visible focus
- [ ] Focus order is logical (tab through page)
- [ ] No focus traps

## Loading States
- [ ] Loading spinners/skeletons exist
- [ ] Buttons show loading state when submitting
- [ ] Page transitions are smooth

## Error States
- [ ] Form validation errors are styled
- [ ] Error messages are visible
- [ ] Error colors match design system (usually red)
```

### Accessibility Checklist

```markdown
## Color & Contrast
- [ ] Text has 4.5:1 contrast ratio (or 3:1 for large text)
- [ ] Links are distinguishable (not just by color)
- [ ] Error states not conveyed by color alone

## Screen Readers
- [ ] Images have alt text
- [ ] Icons have labels (aria-label or sr-only)
- [ ] Form inputs have labels
- [ ] Headings are hierarchical (h1 → h2 → h3)

## Keyboard
- [ ] All functionality available via keyboard
- [ ] Focus visible on all elements
- [ ] Modal traps focus correctly
- [ ] Escape closes modals
```

### Before Showing to User

```typescript
// Run this mental checklist:

const designQA = {
  // Does it look right?
  visualMatch: {
    layout: true,
    colors: true,
    typography: true,
    spacing: true,
    components: true,
  },
  
  // Does it work everywhere?
  responsive: {
    mobile: true,
    tablet: true,
    desktop: true,
  },
  
  // Does it feel right?
  interactions: {
    hoverStates: true,
    focusStates: true,
    loadingStates: true,
    transitions: true,
  },
  
  // Is it accessible?
  accessibility: {
    contrast: true,
    altText: true,
    keyboardNav: true,
    focusManagement: true,
  },
  
  // Is the code right?
  codeQuality: {
    semanticHTML: true,
    noInlineStyles: true,
    reusableComponents: true,
    responsiveUnits: true,  // No fixed px widths for layout
  },
};

// If any are false, fix before presenting
```

## Presenting the Build to User

```typescript
// When showing the completed build:

"I've built the design. Here's what I implemented:

✅ LAYOUT
- Desktop: 3-column grid as shown
- Tablet: 2-column grid
- Mobile: Single column stack

✅ COMPONENTS
- Stats cards with hover effect
- Data table with sorting
- Line chart with tooltips
- User dropdown menu

✅ INTERACTIONS
- Hover states on all interactive elements
- Focus rings for keyboard navigation
- Loading skeletons while data fetches
- Smooth transitions (200ms)

✅ RESPONSIVE
- Tested at 375px, 768px, 1024px, 1440px
- Sidebar collapses to hamburger on mobile
- Tables scroll horizontally on small screens

✅ ACCESSIBILITY
- Proper heading hierarchy
- Alt text on images
- ARIA labels on icon buttons
- 4.5:1+ contrast ratios

📝 NOTES
- I used #3B82F6 for primary (extracted from design)
- Added dark mode support (toggle in header)
- Created reusable components in /components/

Let me know if anything needs adjustment!"
```

---

# PART 86: HANDLING INCOMPLETE DESIGNS

## When Design is Missing Information

### Missing Mobile Design

```typescript
// If only desktop design provided:

"I notice there's no mobile design. I'll create responsive 
versions following these conventions:

MOBILE (< 640px):
- Sidebar → Hidden, hamburger menu
- Multi-column grids → Single column
- Large headings → Slightly smaller (text-2xl → text-xl)
- Side-by-side layouts → Stacked vertically
- Data tables → Horizontal scroll or card view

TABLET (640px - 1024px):
- Sidebar → Collapsible or mini variant
- 4-column grids → 2 columns
- 3-column grids → 2 columns

Does this approach work, or do you have specific mobile requirements?"
```

### Missing Component States

```typescript
// If design only shows default state:

"The design shows the default state. I'll add standard states:

BUTTONS:
- Hover: Slightly darker/lighter
- Active: Scale down slightly (0.98)
- Disabled: 50% opacity, no pointer
- Loading: Spinner + 'Loading...' text

INPUTS:
- Focus: Ring in primary color
- Error: Red border + error message below
- Disabled: Muted background, no pointer

CARDS (if clickable):
- Hover: Subtle shadow lift or border highlight

Should I proceed with these standard states, or do you have 
specific designs for these?"
```

### Missing Colors for States

```typescript
// If design doesn't specify all colors:

"I'll derive the missing colors from your palette:

Given primary: #3B82F6 (blue)

- Primary hover: #2563EB (10% darker)
- Primary active: #1D4ED8 (20% darker)
- Primary light (backgrounds): #EFF6FF (95% lighter)
- Primary muted (disabled): #93C5FD (50% lighter)

For semantic colors (if not specified):
- Success: #22C55E (green)
- Warning: #F59E0B (amber)
- Error: #EF4444 (red)
- Info: #3B82F6 (use primary)

These follow common conventions. Let me know if you 
have specific colors for these."
```

### Missing Spacing Details

```typescript
// If spacing isn't clear from design:

"I'll use consistent spacing based on what I can see:

Detected base unit: ~8px (standard)

APPLYING:
- Card padding: 24px (p-6)
- Gap between cards: 24px (gap-6)
- Section spacing: 64px (py-16)
- Form field gaps: 16px (space-y-4)
- Inline element gaps: 8px (gap-2)

If the spacing looks off, I can adjust. Just let me know 
if anything feels too tight or too loose."
```

### Missing Content

```typescript
// If design has placeholder content:

"The design shows placeholder text. I'll use:

FOR DEMO/PLACEHOLDER:
- Realistic fake data (not 'Lorem ipsum')
- Appropriate lengths matching the design
- Meaningful labels and headings

Example:
Instead of: 'Lorem ipsum dolor sit amet'
I'll use: 'Track your revenue and growth metrics in real-time'

For images, I'll use:
- Placeholder SVGs with the right dimensions
- OR placeholder services like /api/placeholder/400/300
- Can be replaced with real images later

Want me to generate realistic sample data, or do you have 
specific content to use?"
```

---

**This is the Ultimate AI Building Robot.**

**86 Parts. Complete Coverage. Design to Production.**

**Upload a design. Tell Claude to build it. Get production-ready code.**

---

# END OF CLAUDE.md ENTERPRISE EDITION v14.0

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
| i18n & State | 53-54 | Translations, Zustand |
| API & Migrations | 55-56 | Versioning, Schema |
| Webhooks & Docs | 57-58 | Outgoing, OpenAPI |
| Health & Resilience | 59-61 | Checks, Retry |
| Idempotency & Deletes | 62-63 | Duplicates, Soft Delete |
| Money & Dates | 64-65 | Currency, Timezones |
| Testing & CI/CD | 66-67 | Vitest, GitHub Actions |
| Security & Auth | 68-70 | Headers, 2FA, OAuth |
| Onboarding & UI | 71-72 | Flows, Empty States |
| Design Foundations | 73-74 | Spacing, Typography, Components |
| Layout & Responsive | 75-76 | Structure, Mobile-first |
| Interactions & Hierarchy | 77-78 | Animations, Visual Flow |
| Dashboard & Landing | 79-80 | Stats, Charts, Marketing |
| **Design Interpretation** | 81-82 | Reading Mockups, Token Extraction |
| **Figma Workflow** | 83 | Figma-to-Code Conversion |
| **Asset Handling** | 84 | Images, Icons, Fonts |
| **Design QA** | 85 | Verification Checklists |
| **Incomplete Designs** | 86 | Handling Missing Info |

---

**86 Parts. Design-to-Code Mastery. Ship Pixel-Perfect Products.**

---


---

# PART 112: DARK MODE

## 🌙 THEME SYSTEM

### Theme Provider

```typescript
// src/components/theme-provider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
        setResolvedTheme('dark');
      } else {
        root.classList.remove('dark');
        setResolvedTheme('light');
      }
    };

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(media.matches);

      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    } else {
      applyTheme(theme === 'dark');
    }
  }, [theme]);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

### Theme Toggle

```typescript
// src/components/theme-toggle.tsx
'use client';

import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          {resolvedTheme === 'dark' ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Tailwind Config

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        // ... other semantic colors
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

### CSS Variables

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222 84% 5%;
    --primary: 222 47% 11%;
    --primary-foreground: 210 40% 98%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --border: 214 32% 91%;
  }

  .dark {
    --background: 222 84% 5%;
    --foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222 47% 11%;
    --muted: 217 33% 17%;
    --muted-foreground: 215 20% 65%;
    --border: 217 33% 17%;
  }
}
```

---

