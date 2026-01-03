# Motion & Animation Module
# Framer Motion, GSAP, Scroll Animations, Page Transitions, Lottie

---

## Library Recommendations

| Library | Best For | Bundle Size |
|---------|----------|-------------|
| **Framer Motion** | React apps, declarative | ~30KB |
| **GSAP** | Complex timelines, performance | ~60KB |
| **CSS Transitions** | Simple hover/state changes | 0KB |
| **Lottie** | After Effects animations | ~50KB |
| **AutoAnimate** | Drop-in list animations | ~2KB |

**Recommendation:** Use Framer Motion for React apps. Use CSS for simple transitions.

---

## Framer Motion Setup

```bash
npm install framer-motion
```

### Basic Animations

```tsx
// components/animated/fade-in.tsx
'use client';

import { motion } from 'framer-motion';

// Simple fade in
export function FadeIn({ children, delay = 0 }: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay }}
    >
      {children}
    </motion.div>
  );
}

// Slide up and fade
export function SlideUp({ children, delay = 0 }: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// Scale in
export function ScaleIn({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
```

### Staggered Children

```tsx
// components/animated/stagger.tsx
'use client';

import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
};

export function StaggerContainer({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children }: { children: React.ReactNode }) {
  return <motion.div variants={itemVariants}>{children}</motion.div>;
}

// Usage
function FeatureList() {
  return (
    <StaggerContainer>
      {features.map((feature) => (
        <StaggerItem key={feature.id}>
          <FeatureCard {...feature} />
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}
```

### Hover & Tap Animations

```tsx
// components/animated/interactive.tsx
'use client';

import { motion } from 'framer-motion';

export function AnimatedButton({ children, onClick }: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
    >
      {children}
    </motion.button>
  );
}

export function AnimatedCard({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      whileHover={{
        y: -4,
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.2)',
      }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="p-6 bg-card rounded-lg border"
    >
      {children}
    </motion.div>
  );
}

// Link with arrow animation
export function AnimatedLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <motion.a
      href={href}
      className="inline-flex items-center gap-1 text-primary"
      whileHover="hover"
    >
      {children}
      <motion.span
        variants={{
          hover: { x: 4 },
        }}
        transition={{ duration: 0.2 }}
      >
        →
      </motion.span>
    </motion.a>
  );
}
```

---

## Scroll Animations

### Animate on Scroll (Viewport)

```tsx
// components/animated/scroll-reveal.tsx
'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  once?: boolean;
}

export function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  once = true,
}: ScrollRevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, margin: '-100px' });

  const directions = {
    up: { y: 40 },
    down: { y: -40 },
    left: { x: 40 },
    right: { x: -40 },
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...directions[direction] }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// Usage
function LandingPage() {
  return (
    <>
      <ScrollReveal>
        <Hero />
      </ScrollReveal>

      <ScrollReveal delay={0.2}>
        <Features />
      </ScrollReveal>

      <ScrollReveal direction="left">
        <Testimonials />
      </ScrollReveal>
    </>
  );
}
```

### Parallax Scrolling

```tsx
// components/animated/parallax.tsx
'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

export function ParallaxSection({ children, speed = 0.5 }: {
  children: React.ReactNode;
  speed?: number;
}) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, speed * 100]);

  return (
    <motion.div ref={ref} style={{ y }}>
      {children}
    </motion.div>
  );
}

// Background parallax
export function ParallaxBackground({ imageUrl }: { imageUrl: string }) {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);

  return (
    <motion.div
      className="absolute inset-0 -z-10"
      style={{
        y,
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
  );
}
```

### Scroll Progress

```tsx
// components/animated/scroll-progress.tsx
'use client';

import { motion, useScroll, useSpring } from 'framer-motion';

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-primary origin-left z-50"
      style={{ scaleX }}
    />
  );
}

// Scroll-linked number counter
export function ScrollCounter({ target }: { target: number }) {
  const { scrollYProgress } = useScroll();
  const count = useTransform(scrollYProgress, [0, 1], [0, target]);

  return (
    <motion.span>
      {count.get().toFixed(0)}
    </motion.span>
  );
}
```

---

## Page Transitions

### App Router Layout

```tsx
// app/template.tsx
'use client';

import { motion } from 'framer-motion';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}
```

### AnimatePresence for Exit Animations

```tsx
// components/animated/page-wrapper.tsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

export function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

### Shared Layout Animations

```tsx
// components/tabs/animated-tabs.tsx
'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

export function AnimatedTabs({ tabs }: { tabs: { id: string; label: string }[] }) {
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className="relative px-4 py-2 text-sm font-medium"
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 bg-background rounded-md shadow-sm"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative z-10">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
```

---

## Component Animations

### Modal Animation

```tsx
// components/animated/modal.tsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function AnimatedModal({ isOpen, onClose, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-x-4 top-[20%] z-50 mx-auto max-w-lg bg-background rounded-lg shadow-xl p-6"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

### Accordion Animation

```tsx
// components/animated/accordion.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
}

export function AccordionItem({ title, children }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-4 text-left font-medium"
      >
        {title}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### List Reordering

```tsx
// components/animated/reorderable-list.tsx
'use client';

import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical } from 'lucide-react';

interface Item {
  id: string;
  label: string;
}

export function ReorderableList({ items, onReorder }: {
  items: Item[];
  onReorder: (items: Item[]) => void;
}) {
  return (
    <Reorder.Group values={items} onReorder={onReorder} className="space-y-2">
      {items.map((item) => (
        <ReorderableItem key={item.id} item={item} />
      ))}
    </Reorder.Group>
  );
}

function ReorderableItem({ item }: { item: Item }) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2 p-3 bg-card rounded-lg border"
      whileDrag={{ scale: 1.02, boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}
    >
      <button
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab active:cursor-grabbing p-1"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <span>{item.label}</span>
    </Reorder.Item>
  );
}
```

---

## Micro-interactions

### Button Loading State

```tsx
// components/animated/loading-button.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check } from 'lucide-react';

type ButtonState = 'idle' | 'loading' | 'success';

export function LoadingButton({
  state,
  onClick,
  children,
}: {
  state: ButtonState;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={state !== 'idle'}
      className="relative px-6 py-2 bg-primary text-primary-foreground rounded-lg overflow-hidden"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <AnimatePresence mode="wait">
        {state === 'idle' && (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {children}
          </motion.span>
        )}

        {state === 'loading' && (
          <motion.span
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </motion.span>
        )}

        {state === 'success' && (
          <motion.span
            key="success"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            Done!
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
```

### Toast Notification

```tsx
// components/animated/toast.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';

export function Toast({
  message,
  isVisible,
  onClose,
}: {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="fixed bottom-4 right-4 bg-foreground text-background px-4 py-3 rounded-lg shadow-lg"
        >
          <div className="flex items-center gap-3">
            <span>{message}</span>
            <button onClick={onClose} className="text-muted-foreground hover:text-background">
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

## Lottie Animations

```bash
npm install lottie-react
```

```tsx
// components/animated/lottie-animation.tsx
'use client';

import Lottie from 'lottie-react';
import successAnimation from '@/animations/success.json';
import loadingAnimation from '@/animations/loading.json';

export function SuccessAnimation() {
  return (
    <Lottie
      animationData={successAnimation}
      loop={false}
      style={{ width: 200, height: 200 }}
    />
  );
}

export function LoadingAnimation() {
  return (
    <Lottie
      animationData={loadingAnimation}
      loop={true}
      style={{ width: 100, height: 100 }}
    />
  );
}

// Interactive Lottie
export function InteractiveLottie({ animationData }: { animationData: any }) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsPlaying(true)}
      onMouseLeave={() => setIsPlaying(false)}
    >
      <Lottie
        animationData={animationData}
        loop={true}
        autoplay={false}
        isStopped={!isPlaying}
      />
    </div>
  );
}
```

---

## CSS Animations (No JS)

```css
/* globals.css */

/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-fade-in {
  animation: fadeIn 0.5s ease-out forwards;
}

/* Slide up */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slideUp 0.5s ease-out forwards;
}

/* Stagger children with CSS */
.stagger-children > * {
  animation: slideUp 0.5s ease-out forwards;
  opacity: 0;
}

.stagger-children > *:nth-child(1) { animation-delay: 0.1s; }
.stagger-children > *:nth-child(2) { animation-delay: 0.2s; }
.stagger-children > *:nth-child(3) { animation-delay: 0.3s; }
.stagger-children > *:nth-child(4) { animation-delay: 0.4s; }
.stagger-children > *:nth-child(5) { animation-delay: 0.5s; }

/* Pulse */
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.animate-pulse-scale {
  animation: pulse 2s ease-in-out infinite;
}

/* Skeleton loading */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    hsl(var(--muted)) 25%,
    hsl(var(--muted-foreground) / 0.1) 50%,
    hsl(var(--muted)) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

---

## Performance Best Practices

```tsx
// 1. Use transform and opacity only (GPU accelerated)
// GOOD
animate={{ opacity: 1, x: 0, scale: 1, rotate: 0 }}

// AVOID (triggers layout)
animate={{ width: 100, height: 100, top: 0 }}

// 2. Use will-change sparingly
<motion.div style={{ willChange: 'transform' }}>

// 3. Reduce motion for accessibility
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

<motion.div
  animate={{ opacity: 1, y: prefersReducedMotion ? 0 : 20 }}
  transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
>

// 4. Use layout animations wisely
// Only use layoutId when truly needed for shared element transitions
```

---

## Quality Checklist

Before shipping:
- [ ] Animations feel natural (not too fast/slow)
- [ ] Exit animations work (AnimatePresence)
- [ ] Reduced motion preference respected
- [ ] No janky animations (check with Performance tab)
- [ ] Touch interactions work on mobile
- [ ] Animations don't block user interaction
- [ ] Loading states are animated
- [ ] Skeleton loaders for async content
- [ ] Page transitions are smooth
- [ ] No layout shift during animations
