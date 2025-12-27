# LAYOUT PATTERNS
# Module: 09a-layouts.md
# Load with: 00-core.md
# Covers: Navigation, page layouts, theme/color mode, mobile strategy

---

## DECISION GUIDES

Before implementing any design, ask the user about their preferences:

### Navigation Layout Decision

| Layout | Best For | Complexity |
|--------|----------|------------|
| **Top Navigation** | Marketing sites, simple apps, public-facing | Low |
| **Sidebar Navigation** | Dashboards, admin panels, many nav items | Medium |
| **Both (Top + Sidebar)** | Complex SaaS, multi-section apps | High |
| **Bottom Navigation** | Mobile apps, 3-5 primary actions | Low |

### Questions to Ask:
1. "How many primary navigation items do you have?"
2. "Is this a dashboard/admin panel or a public-facing site?"
3. "Do you need nested navigation (sub-menus)?"
4. "Should navigation be collapsible on desktop?"

---

## TOP NAVIGATION

```typescript
// components/layouts/TopNavLayout.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface TopNavLayoutProps {
  children: React.ReactNode;
}

export function TopNavLayout({ children }: TopNavLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation */}
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="font-bold text-xl">
              Logo
            </Link>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/features" className="text-muted-foreground hover:text-foreground transition-colors">
                Features
              </Link>
              <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </Link>
              <Link href="/docs" className="text-muted-foreground hover:text-foreground transition-colors">
                Docs
              </Link>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          © 2024 Company. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
```

---

## SIDEBAR NAVIGATION

```typescript
// components/layouts/SidebarLayout.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Home, Settings, Users, FileText, BarChart,
  Menu, X, ChevronDown
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { label: string; href: string }[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: Home },
  { label: 'Analytics', href: '/analytics', icon: BarChart },
  {
    label: 'Users',
    href: '/users',
    icon: Users,
    children: [
      { label: 'All Users', href: '/users' },
      { label: 'Teams', href: '/users/teams' },
      { label: 'Roles', href: '/users/roles' },
    ]
  },
  { label: 'Documents', href: '/documents', icon: FileText },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-background border-r transition-all duration-300",
        collapsed ? "w-16" : "w-64",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b">
          {!collapsed && <span className="font-bold text-xl">Logo</span>}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              isActive={pathname.startsWith(item.href)}
            />
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className={cn(
        "flex-1 transition-all duration-300",
        collapsed ? "md:ml-16" : "md:ml-64"
      )}>
        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b flex items-center px-4">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X /> : <Menu />}
          </Button>
        </header>

        <main className="p-6">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </div>
  );
}
```

---

## PAGE LAYOUT DECISION

| Layout | Best For | Example |
|--------|----------|---------|
| **Full Width** | Dashboards, data-heavy pages, tables | Analytics, admin |
| **Contained** | Content pages, forms, marketing | Blog, settings |
| **Sidebar + Content** | Documentation, settings with tabs | Docs, account |
| **Grid/Cards** | Listings, galleries, product pages | Products, files |

### Layout Examples

```typescript
// Full Width (dashboards, tables)
<main className="p-6">
  {children}
</main>

// Contained (forms, articles)
<main className="container mx-auto max-w-4xl py-8 px-4">
  {children}
</main>

// Narrow (auth forms, simple content)
<main className="container mx-auto max-w-md py-12 px-4">
  {children}
</main>

// Sidebar + Content (docs, settings)
<main className="flex gap-8 p-6">
  <aside className="w-64 shrink-0">
    <SettingsNav />
  </aside>
  <div className="flex-1 max-w-3xl">
    {children}
  </div>
</main>
```

---

## THEME/COLOR MODE

| Option | Best For | Complexity |
|--------|----------|------------|
| **Light Only** | Corporate, traditional, print-focused | Low |
| **Dark Only** | Developer tools, media apps, gaming | Low |
| **System Preference** | User respects OS setting | Medium |
| **Toggle (Light/Dark/System)** | Full user control | Medium |

### Theme Implementation

```typescript
// providers/theme-provider.tsx
'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

// components/theme-toggle.tsx
'use client';

import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Monitor } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## MOBILE STRATEGY

| Strategy | Best For | Approach |
|----------|----------|----------|
| **Mobile-First** | Consumer apps, content sites | Start small, add breakpoints up |
| **Desktop-First** | Enterprise/admin, complex UIs | Start large, adjust down |
| **Responsive** | Balanced, general purpose | Design key breakpoints together |

### Breakpoints Reference

```typescript
// Tailwind default breakpoints
// sm: 640px  - Large phones
// md: 768px  - Tablets
// lg: 1024px - Laptops
// xl: 1280px - Desktops
// 2xl: 1536px - Large screens

// Mobile-first approach (recommended)
<div className="
  px-4           /* Mobile: 16px padding */
  sm:px-6        /* 640px+: 24px padding */
  lg:px-8        /* 1024px+: 32px padding */
">

// Responsive grid
<div className="
  grid
  grid-cols-1    /* Mobile: 1 column */
  sm:grid-cols-2 /* 640px+: 2 columns */
  lg:grid-cols-3 /* 1024px+: 3 columns */
  xl:grid-cols-4 /* 1280px+: 4 columns */
  gap-4
">
```

---
