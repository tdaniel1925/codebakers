# Iconography Module
# Icon Libraries, Custom SVGs, Icon Systems, Sprites, Accessibility

---

## Recommended Icon Libraries

| Library | Icons | Style | Best For |
|---------|-------|-------|----------|
| **Lucide** | 1,400+ | Outline | Modern apps (shadcn default) |
| **Heroicons** | 300+ | Outline/Solid | Tailwind projects |
| **Phosphor** | 7,000+ | 6 weights | Variety needed |
| **Radix Icons** | 300+ | Minimal | Radix UI projects |
| **Tabler** | 4,500+ | Outline | Feature-rich apps |

**Recommendation:** Use Lucide for most React projects. It's the default for shadcn/ui.

---

## Lucide Icons Setup

```bash
npm install lucide-react
```

### Basic Usage

```tsx
// Direct import (tree-shaking friendly)
import { Home, Settings, User, ChevronRight } from 'lucide-react';

function Navigation() {
  return (
    <nav className="flex items-center gap-4">
      <Home className="h-5 w-5" />
      <Settings className="h-5 w-5" />
      <User className="h-5 w-5" />
    </nav>
  );
}
```

### Icon with Consistent Sizing

```tsx
// components/ui/icon.tsx
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface IconProps {
  icon: LucideIcon;
  size?: IconSize;
  className?: string;
}

const sizeMap: Record<IconSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
};

export function Icon({ icon: IconComponent, size = 'md', className }: IconProps) {
  return <IconComponent className={cn(sizeMap[size], className)} />;
}

// Usage
import { Icon } from '@/components/ui/icon';
import { Settings } from 'lucide-react';

<Icon icon={Settings} size="lg" />
```

### Dynamic Icon Loading

```tsx
// lib/icons.ts
import dynamic from 'next/dynamic';
import { LucideIcon, LucideProps } from 'lucide-react';

// Map icon names to components
const iconComponents: Record<string, React.ComponentType<LucideProps>> = {};

export async function loadIcon(name: string): Promise<LucideIcon | null> {
  try {
    const icons = await import('lucide-react');
    return (icons as any)[name] as LucideIcon;
  } catch {
    console.warn(`Icon "${name}" not found`);
    return null;
  }
}

// Dynamic icon component
export function DynamicIcon({ name, ...props }: { name: string } & LucideProps) {
  const [IconComponent, setIconComponent] = useState<LucideIcon | null>(null);

  useEffect(() => {
    loadIcon(name).then(setIconComponent);
  }, [name]);

  if (!IconComponent) return <div className={props.className} />;

  return <IconComponent {...props} />;
}

// Usage for user-configurable icons
<DynamicIcon name={feature.iconName} className="h-5 w-5" />
```

---

## Heroicons Setup

```bash
npm install @heroicons/react
```

```tsx
// Outline icons (24x24)
import { HomeIcon, UserIcon } from '@heroicons/react/24/outline';

// Solid icons (24x24)
import { HomeIcon, UserIcon } from '@heroicons/react/24/solid';

// Mini icons (20x20)
import { HomeIcon, UserIcon } from '@heroicons/react/20/solid';

// Micro icons (16x16)
import { HomeIcon, UserIcon } from '@heroicons/react/16/solid';

function NavItem({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <a className="flex items-center gap-2 p-2 hover:bg-muted rounded-lg">
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </a>
  );
}

// Usage
<NavItem icon={HomeIcon} label="Home" />
```

---

## Custom SVG Icons

### Inline SVG Component

```tsx
// components/icons/logo.tsx
interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path
        d="M8 16L14 22L24 10"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Usage
<Logo className="text-primary" size={40} />
```

### SVG as React Component (SVGR)

```bash
npm install -D @svgr/webpack
```

```js
// next.config.js
module.exports = {
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    return config;
  },
};
```

```tsx
// Import SVG as component
import Logo from '@/assets/logo.svg';

<Logo className="h-8 w-8 text-primary" />
```

### Type-safe SVG Components

```tsx
// components/icons/types.ts
import { SVGProps } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  title?: string;
}

// components/icons/check.tsx
export function CheckIcon({ size = 24, title, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={!title}
      role={title ? 'img' : undefined}
      {...props}
    >
      {title && <title>{title}</title>}
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
```

---

## Icon Button Component

```tsx
// components/ui/icon-button.tsx
import { LucideIcon } from 'lucide-react';
import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string; // Required for accessibility
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'outline';
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

const iconSizes = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

const variantClasses = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  ghost: 'hover:bg-muted',
  outline: 'border hover:bg-muted',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, size = 'md', variant = 'ghost', className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        aria-label={label}
        className={cn(
          'inline-flex items-center justify-center rounded-lg transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:opacity-50 disabled:pointer-events-none',
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        {...props}
      >
        <Icon className={iconSizes[size]} />
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

// Usage
import { Trash2, Edit, Copy } from 'lucide-react';

<IconButton icon={Trash2} label="Delete item" variant="ghost" />
<IconButton icon={Edit} label="Edit item" size="sm" />
<IconButton icon={Copy} label="Copy to clipboard" variant="outline" />
```

---

## Icon with Text

```tsx
// components/ui/icon-text.tsx
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IconTextProps {
  icon: LucideIcon;
  children: React.ReactNode;
  iconPosition?: 'left' | 'right';
  className?: string;
}

export function IconText({
  icon: Icon,
  children,
  iconPosition = 'left',
  className,
}: IconTextProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {iconPosition === 'left' && <Icon className="h-4 w-4 flex-shrink-0" />}
      <span>{children}</span>
      {iconPosition === 'right' && <Icon className="h-4 w-4 flex-shrink-0" />}
    </span>
  );
}

// Usage
import { Mail, ExternalLink } from 'lucide-react';

<IconText icon={Mail}>contact@example.com</IconText>
<IconText icon={ExternalLink} iconPosition="right">View docs</IconText>
```

---

## Icon Sprites (Performance Optimization)

For many icons, use SVG sprites to reduce HTTP requests:

```tsx
// components/icons/sprite.tsx
// Generate sprite from SVG files using svg-sprite or similar tool

export function IconSprite() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" style={{ display: 'none' }}>
      <symbol id="icon-home" viewBox="0 0 24 24">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </symbol>
      <symbol id="icon-user" viewBox="0 0 24 24">
        <circle cx="12" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      </symbol>
      {/* Add more symbols */}
    </svg>
  );
}

// Use sprite icon
export function SpriteIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={className}>
      <use href={`#icon-${name}`} />
    </svg>
  );
}

// In layout
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <IconSprite />
        {children}
      </body>
    </html>
  );
}

// Usage
<SpriteIcon name="home" className="h-5 w-5" />
<SpriteIcon name="user" className="h-5 w-5" />
```

---

## Animated Icons

```tsx
// components/icons/animated.tsx
'use client';

import { motion } from 'framer-motion';
import { Check, Loader2, AlertCircle } from 'lucide-react';

// Spinning loader
export function SpinningLoader({ className }: { className?: string }) {
  return (
    <Loader2 className={cn('animate-spin', className)} />
  );
}

// Success checkmark with animation
export function AnimatedCheck({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <Check className={className} />
    </motion.div>
  );
}

// Pulsing notification indicator
export function PulsingDot() {
  return (
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
    </span>
  );
}

// Shake on error
export function ShakeOnError({ hasError, children }: {
  hasError: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      animate={hasError ? { x: [0, -10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.div>
  );
}
```

---

## Icon Accessibility

```tsx
// Decorative icons (hidden from screen readers)
<Search className="h-5 w-5" aria-hidden="true" />

// Informative icons (announced by screen readers)
<AlertCircle className="h-5 w-5" aria-label="Warning" role="img" />

// Icon buttons MUST have labels
<button aria-label="Close dialog">
  <X className="h-5 w-5" aria-hidden="true" />
</button>

// Icon with visible text (icon is decorative)
<button>
  <Plus className="h-4 w-4" aria-hidden="true" />
  <span>Add item</span>
</button>

// Status icons should convey meaning
function StatusIcon({ status }: { status: 'success' | 'error' | 'warning' }) {
  const icons = {
    success: { icon: Check, label: 'Success', className: 'text-green-500' },
    error: { icon: X, label: 'Error', className: 'text-red-500' },
    warning: { icon: AlertTriangle, label: 'Warning', className: 'text-yellow-500' },
  };

  const { icon: Icon, label, className } = icons[status];

  return (
    <Icon className={cn('h-5 w-5', className)} aria-label={label} role="img" />
  );
}
```

---

## Icon Color Variants

```tsx
// components/ui/colored-icon.tsx
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type IconColor = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'muted';

interface ColoredIconProps {
  icon: LucideIcon;
  color?: IconColor;
  className?: string;
}

const colorClasses: Record<IconColor, string> = {
  default: 'text-foreground',
  primary: 'text-primary',
  success: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
  muted: 'text-muted-foreground',
};

export function ColoredIcon({
  icon: Icon,
  color = 'default',
  className,
}: ColoredIconProps) {
  return <Icon className={cn('h-5 w-5', colorClasses[color], className)} />;
}

// Icon with background
export function IconBadge({
  icon: Icon,
  color = 'primary',
}: {
  icon: LucideIcon;
  color?: IconColor;
}) {
  const bgClasses: Record<IconColor, string> = {
    default: 'bg-muted',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-green-100 text-green-600 dark:bg-green-900/30',
    warning: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30',
    error: 'bg-red-100 text-red-600 dark:bg-red-900/30',
    muted: 'bg-muted text-muted-foreground',
  };

  return (
    <div className={cn('p-2 rounded-lg inline-flex', bgClasses[color])}>
      <Icon className="h-5 w-5" />
    </div>
  );
}
```

---

## Icon Picker Component

```tsx
// components/ui/icon-picker.tsx
'use client';

import { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Search } from 'lucide-react';

// Get all icon names
const iconNames = Object.keys(LucideIcons).filter(
  (key) => key !== 'createLucideIcon' && key !== 'default'
);

export function IconPicker({ onSelect }: { onSelect: (name: string) => void }) {
  const [search, setSearch] = useState('');

  const filteredIcons = iconNames.filter((name) =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search icons..."
          className="w-full pl-10 pr-4 py-2 border rounded-lg"
        />
      </div>

      <div className="grid grid-cols-8 gap-2 max-h-64 overflow-y-auto p-2">
        {filteredIcons.slice(0, 100).map((name) => {
          const Icon = (LucideIcons as any)[name];
          return (
            <button
              key={name}
              onClick={() => onSelect(name)}
              className="p-2 hover:bg-muted rounded-lg flex items-center justify-center"
              title={name}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

---

## Quality Checklist

Before shipping:
- [ ] All icon-only buttons have aria-label
- [ ] Icons are consistent size throughout app
- [ ] Icons use currentColor for flexibility
- [ ] Custom SVGs are optimized (SVGO)
- [ ] Icon library is tree-shaken (check bundle)
- [ ] Icons scale with text size where appropriate
- [ ] Touch targets are at least 44x44px
- [ ] Icons have sufficient contrast
- [ ] Animated icons respect reduced motion
- [ ] Icon names are semantic (not icon-1, icon-2)
