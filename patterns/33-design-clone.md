# 33 - DESIGN CLONE & PIXEL-PERFECT IMPLEMENTATION

> Clone any design from mockups, screenshots, websites, or references into pixel-perfect code.

---

## COMMAND: /design

**Purpose:** Analyze visual designs and generate matching code with exact colors, typography, spacing, and components.

**Usage:**
```
/design ./mockups              # Scan folder of images
/design ./mockups/dashboard.png # Single image
/design https://linear.app     # Clone website design
/design "like Notion"          # Reference known style
```

---

## DESIGN ANALYSIS WORKFLOW

### Step 1: Input Detection

Detect input type and gather source material:

```
/design [input]

Detecting input type...

📁 Folder: ./mockups (found 5 images)
📄 Single Image: dashboard.png
🌐 Website: https://example.com
📝 Reference: "like Linear"
```

### Step 2: Visual Analysis

For each image/screenshot, extract:

#### A. Color Palette

```typescript
// Extract exact colors from the design
const designColors = {
  // Primary brand colors
  primary: {
    50: '#f0f9ff',   // Lightest
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',  // Base
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',  // Darkest
  },

  // Neutral/gray scale
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },

  // Semantic colors
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // Background colors
  background: {
    primary: '#ffffff',
    secondary: '#fafafa',
    tertiary: '#f5f5f5',
  },

  // Text colors
  text: {
    primary: '#171717',
    secondary: '#525252',
    tertiary: '#a3a3a3',
    inverse: '#ffffff',
  },

  // Border colors
  border: {
    default: '#e5e5e5',
    subtle: '#f5f5f5',
    strong: '#d4d4d4',
  },
};
```

#### B. Typography

```typescript
const designTypography = {
  // Font families
  fonts: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Menlo', 'monospace'],
  },

  // Type scale
  sizes: {
    xs: '0.75rem',     // 12px
    sm: '0.875rem',    // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
  },

  // Font weights
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // Line heights
  lineHeights: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Letter spacing
  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
  },
};
```

#### C. Spacing System

```typescript
const designSpacing = {
  // Base unit: 4px
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  7: '1.75rem',     // 28px
  8: '2rem',        // 32px
  9: '2.25rem',     // 36px
  10: '2.5rem',     // 40px
  12: '3rem',       // 48px
  14: '3.5rem',     // 56px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
};
```

#### D. Border & Shadow

```typescript
const designBorders = {
  // Border radius
  radius: {
    none: '0',
    sm: '0.125rem',   // 2px
    default: '0.25rem', // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    '3xl': '1.5rem',  // 24px
    full: '9999px',
  },

  // Border widths
  width: {
    0: '0',
    1: '1px',
    2: '2px',
    4: '4px',
    8: '8px',
  },
};

const designShadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  default: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
};
```

---

## TAILWIND CONFIG GENERATION

After analysis, generate matching Tailwind config:

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Generated from design analysis
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // ... other colors
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Custom sizes if design differs from defaults
      },
      spacing: {
        // Custom spacing if needed
      },
      borderRadius: {
        // Custom radii if needed
      },
      boxShadow: {
        // Custom shadows matching design
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## COMPONENT EXTRACTION

### Identify UI Components

Scan images for common patterns:

```
Components Detected:

Navigation:
  ├── Sidebar (280px width, dark theme)
  ├── TopBar (64px height, search + user menu)
  └── Breadcrumbs

Cards:
  ├── Stats Card (icon + number + label)
  ├── Content Card (title + description + actions)
  └── User Card (avatar + name + role)

Forms:
  ├── Input (height: 40px, border-radius: 8px)
  ├── Select (custom dropdown style)
  ├── Checkbox (custom checkmark)
  └── Button variants (primary, secondary, ghost)

Tables:
  ├── Data Table (striped rows, hover states)
  └── Column headers (sortable indicators)

Other:
  ├── Avatar (32px, 40px, 48px sizes)
  ├── Badge (pill shape, color variants)
  ├── Tooltip
  └── Modal (centered, 480px max-width)
```

### Generate Component Code

```tsx
// components/ui/stats-card.tsx
// Extracted from design: Stats Card component

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatsCard({
  icon: Icon,
  value,
  label,
  trend,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        // Exact styling from design
        'rounded-xl border border-neutral-200 bg-white p-6',
        'shadow-sm transition-shadow hover:shadow-md',
        className
      )}
    >
      {/* Icon container - 48px, rounded-lg, light primary bg */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-50">
        <Icon className="h-6 w-6 text-primary-600" />
      </div>

      {/* Value - 36px, semibold */}
      <div className="text-4xl font-semibold text-neutral-900">
        {value}
      </div>

      {/* Label + Trend row */}
      <div className="mt-1 flex items-center gap-2">
        <span className="text-sm text-neutral-500">{label}</span>

        {trend && (
          <span
            className={cn(
              'text-sm font-medium',
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
    </div>
  );
}
```

---

## LAYOUT EXTRACTION

### Page Layout Analysis

```
Page Structure Detected:

┌─────────────────────────────────────────────┐
│ TopBar (h-16, border-b)                     │
├──────────┬──────────────────────────────────┤
│          │                                  │
│ Sidebar  │  Main Content                    │
│ (w-64)   │  (flex-1, p-6)                   │
│          │                                  │
│          │  ┌─────────────────────────────┐ │
│          │  │ Page Header                 │ │
│          │  │ (title + actions)           │ │
│          │  └─────────────────────────────┘ │
│          │                                  │
│          │  ┌─────────────────────────────┐ │
│          │  │ Content Area                │ │
│          │  │ (cards, tables, etc.)       │ │
│          │  └─────────────────────────────┘ │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

### Generate Layout

```tsx
// app/(dashboard)/layout.tsx
// Extracted from design: Dashboard layout with sidebar

import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Sidebar - 256px fixed */}
      <Sidebar className="hidden w-64 shrink-0 border-r border-neutral-200 bg-white lg:block" />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar - 64px */}
        <TopBar className="h-16 shrink-0 border-b border-neutral-200 bg-white" />

        {/* Scrollable content */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
```

---

## REFERENCE STYLES

When user says `/design "like [product]"`, apply known styles:

### Linear-style
```typescript
const linearStyle = {
  colors: {
    primary: '#5E6AD2', // Purple
    background: '#0D0D0D', // Near black
    surface: '#1A1A1A',
    border: '#2A2A2A',
    text: '#FFFFFF',
    textSecondary: '#8A8F98',
  },
  fonts: {
    sans: ['Inter', 'system-ui'],
  },
  radius: '8px',
  spacing: 'tight',
  style: 'minimal, dark, focused',
};
```

### Notion-style
```typescript
const notionStyle = {
  colors: {
    primary: '#000000',
    background: '#FFFFFF',
    surface: '#FBFBFA',
    border: '#E3E2E0',
    text: '#37352F',
    textSecondary: '#9B9A97',
  },
  fonts: {
    sans: ['Inter', 'system-ui'],
    serif: ['Georgia', 'serif'],
  },
  radius: '4px',
  spacing: 'comfortable',
  style: 'clean, content-focused, readable',
};
```

### Stripe-style
```typescript
const stripeStyle = {
  colors: {
    primary: '#635BFF', // Stripe purple
    background: '#FFFFFF',
    surface: '#F6F9FC',
    border: '#E6E6E6',
    text: '#1A1A1A',
    textSecondary: '#697386',
  },
  fonts: {
    sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI'],
  },
  radius: '8px',
  shadows: 'prominent',
  style: 'professional, trustworthy, polished',
};
```

### Vercel-style
```typescript
const vercelStyle = {
  colors: {
    primary: '#000000',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    border: '#EAEAEA',
    text: '#000000',
    textSecondary: '#666666',
  },
  fonts: {
    sans: ['Inter', 'system-ui'],
    mono: ['Menlo', 'monospace'],
  },
  radius: '8px',
  style: 'minimal, developer-focused, fast',
};
```

---

## ANALYSIS OUTPUT FORMAT

After analyzing design, show:

```
Design Analysis Complete

📊 Design System Extracted:

Colors:
  Primary: #0ea5e9 (Blue)
  Neutral: 10-shade gray scale
  Accent: #f59e0b (Amber)
  Semantic: Success, Warning, Error, Info

Typography:
  Font: Inter (Sans)
  Scale: 12px - 48px (8 sizes)
  Weights: 400, 500, 600, 700

Spacing:
  Base unit: 4px
  Scale: 0 - 96px (24 steps)

Borders:
  Radius: 4px default, 8px cards, 12px modals
  Width: 1px default

Shadows:
  3 levels: sm, md, lg

📦 Components Detected:
  • Navigation (Sidebar + TopBar)
  • Cards (3 variants)
  • Buttons (4 variants)
  • Forms (Input, Select, Checkbox)
  • Table (with sorting)
  • Modal, Tooltip, Badge

📄 Pages to Generate:
  1. Dashboard (stats + charts)
  2. Settings (form layout)
  3. Data Table (list view)

Ready to generate? I'll create:
  • tailwind.config.ts (design tokens)
  • components/ui/* (all components)
  • Page layouts matching your mockups

Proceed?
```

---

## PIXEL-PERFECT CHECKLIST

Before finalizing, verify:

- [ ] Colors match exactly (use color picker on mockup)
- [ ] Font sizes match (measure in pixels)
- [ ] Spacing is consistent (check padding/margins)
- [ ] Border radius matches
- [ ] Shadow intensity matches
- [ ] Hover/focus states included
- [ ] Responsive behavior defined
- [ ] Dark mode variant if present in design

---

## REMEMBER

1. **Extract exact values** - Don't approximate, measure precisely
2. **Generate Tailwind config first** - Tokens before components
3. **Match every detail** - Spacing, colors, shadows, radii
4. **Include all states** - Hover, focus, active, disabled
5. **Test visually** - Compare generated output to original
