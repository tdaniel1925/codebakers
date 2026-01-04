'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Code2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CODEBAKERS_STATS } from '@/lib/stats';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  FlashIcon,
  ArrowRight02Icon,
  AiMagicIcon,
  LockIcon,
  Tick02Icon,
  SparklesIcon,
  StarIcon,
  Calendar03Icon,
  Rocket01Icon,
  Idea01Icon,
  Target02Icon,
  MagicWand02Icon,
  PlayIcon,
  SecurityCheckIcon,
  RefreshIcon,
  Alert02Icon,
  BrainIcon,
  RepeatIcon,
  TimeQuarterPassIcon,
  CheckmarkSquare02Icon,
  Cancel01Icon,
} from 'hugeicons-react';

// Testimonials focused on context/continuity benefits
const testimonials = [
  {
    quote: "Before CodeBakers, I'd restart Claude every few hours because it would forget our architecture decisions. Now it remembers everything.",
    author: "Alex Rivera",
    role: "Solo Founder, 3 AI projects",
    avatar: "AR",
  },
  {
    quote: "I used to spend 20 minutes at the start of every session re-explaining my codebase. Now I just type 'continue' and it picks up exactly where we left off.",
    author: "Sarah Kim",
    role: "Freelance Developer",
    avatar: "SK",
  },
  {
    quote: "The AI stopped randomly changing my auth patterns mid-project. It actually follows our established conventions now.",
    author: "Marcus Chen",
    role: "Tech Lead, 8 years exp",
    avatar: "MC",
  },
];

// Pain points - focused on context loss and AI inconsistency
const painPoints = [
  {
    icon: Alert02Icon,
    title: 'Context collapse',
    description: 'After ~30 messages, AI forgets your decisions and starts contradicting itself.',
  },
  {
    icon: RepeatIcon,
    title: 'Daily re-explanations',
    description: '"Remember, we use Drizzle, not Prisma..." Every. Single. Session.',
  },
  {
    icon: Cancel01Icon,
    title: 'Random pattern changes',
    description: 'AI suddenly switches your auth approach mid-feature for no reason.',
  },
  {
    icon: TimeQuarterPassIcon,
    title: 'Session restarts',
    description: 'Context limit hit. Start over. Lose everything. Repeat.',
  },
];

function InstallSection() {
  const [isWindows, setIsWindows] = useState(false);

  useEffect(() => {
    setIsWindows(navigator.platform.toLowerCase().includes('win'));
  }, []);

  const downloadUrl = isWindows
    ? '/install-codebakers.bat'
    : '/install-codebakers.command';

  return (
    <section id="install" className="py-16 px-4 bg-black">
      <div className="container mx-auto max-w-2xl text-center">
        <Badge className="mb-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800">
          <Rocket01Icon className="w-3 h-3 mr-1" />
          One Click Install
        </Badge>
        <h2 className="text-3xl font-bold mb-4 text-white">
          Install in 30 Seconds
        </h2>
        <p className="text-lg text-gray-400 mb-8">
          Download, double-click, done.
        </p>

        {/* Big Download Button */}
        <a href={downloadUrl} download>
          <Button
            size="lg"
            className="text-lg px-8 py-6 h-auto bg-red-600 hover:bg-red-700 transition-all duration-300"
          >
            <Download className="mr-2 h-5 w-5" />
            Download Installer
          </Button>
        </a>

        {/* Instructions */}
        <div className="mt-8 p-6 rounded-2xl bg-gray-900 border border-gray-800 text-left max-w-md mx-auto">
          <h3 className="font-bold mb-3 flex items-center gap-2 text-white">
            <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">1</span>
            Download and double-click the installer
          </h3>
          <h3 className="font-bold mb-3 flex items-center gap-2 text-white">
            <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">2</span>
            In your project: <code className="text-sm font-mono text-red-400">codebakers go</code>
          </h3>
          <h3 className="font-bold flex items-center gap-2 text-white">
            <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">3</span>
            Open Claude Code and start building!
          </h3>
          <p className="mt-4 text-sm text-gray-500 text-center">
            No account or API key required - free trial starts automatically
          </p>
        </div>

        {/* OS toggle */}
        <p className="mt-6 text-sm text-gray-500">
          Downloading for {isWindows ? 'Windows' : 'Mac/Linux'}.{' '}
          <button
            onClick={() => setIsWindows(!isWindows)}
            className="text-red-500 hover:text-red-400 underline"
          >
            Switch to {isWindows ? 'Mac/Linux' : 'Windows'}
          </button>
        </p>
      </div>
    </section>
  );
}

export default function HomePage() {
  // Load Cal.com embed script
  useEffect(() => {
    const script = document.createElement('script');
    script.innerHTML = `
      (function (C, A, L) {
        let p = function (a, ar) { a.q.push(ar); };
        let d = C.document;
        C.Cal = C.Cal || function () {
          let cal = C.Cal;
          let ar = arguments;
          if (!cal.loaded) {
            cal.ns = {};
            cal.q = cal.q || [];
            d.head.appendChild(d.createElement("script")).src = A;
            cal.loaded = true;
          }
          if (ar[0] === L) {
            const api = function () { p(api, arguments); };
            const namespace = ar[1];
            api.q = api.q || [];
            if(typeof namespace === "string"){
              cal.ns[namespace] = cal.ns[namespace] || api;
              p(cal.ns[namespace], ar);
              p(cal, ["initNamespace", namespace]);
            } else p(cal, ar);
            return;
          }
          p(cal, ar);
        };
      })(window, "https://app.cal.com/embed/embed.js", "init");
      Cal("init", "30min", {origin:"https://app.cal.com"});
      Cal.ns["30min"]("ui", {"hideEventTypeDetails":false,"layout":"month_view"});
    `;
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground" suppressHydrationWarning>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950 border-b border-gray-800">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-600 flex items-center justify-center">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">CodeBakers</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="#problem" className="text-gray-400 hover:text-white transition-colors text-sm">
              The Problem
            </Link>
            <Link href="#solution" className="text-gray-400 hover:text-white transition-colors text-sm">
              Solution
            </Link>
            <Link href="#how-it-works" className="text-gray-400 hover:text-white transition-colors text-sm">
              How It Works
            </Link>
            <Link href="#pricing" className="text-gray-400 hover:text-white transition-colors text-sm">
              Pricing
            </Link>
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" className="text-gray-400 hover:text-white text-sm">
                Login
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20 text-sm">
                Start Free
                <ArrowRight02Icon className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
          {/* Mobile nav */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <Link href="/signup">
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white text-sm">
                Start Free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section - New Value Prop: AI That Doesn't Forget */}
      <section className="pt-24 pb-12 px-4 min-h-[calc(100vh-4rem)] flex items-center relative overflow-hidden bg-gray-950">
        {/* Grid Background Pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: `repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 80px), repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 80px)`,
            }}
          />
        </div>

        <div className="container mx-auto text-center relative z-10">
          {/* MAIN HEADLINE - Session Continuity */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-6 leading-[1] tracking-tight mt-8 text-white">
            <span className="text-gray-400">AI coding that</span>
            <br />
            <span className="text-red-500">doesn't forget.</span>
          </h1>

          {/* Subheadline - The Problem We Solve */}
          <p className="text-lg md:text-xl lg:text-2xl text-gray-400 mb-8 max-w-3xl mx-auto font-medium">
            Long conversations crash. Context gets lost. Decisions get forgotten.
            <br />
            <span className="text-white font-bold">CodeBakers fixes that.</span>
          </p>

          {/* Visual: Session Recovery Demo */}
          <div className="max-w-3xl mx-auto mb-8">
            <div className="rounded-2xl border-2 border-gray-700 bg-gray-900/80 backdrop-blur-sm overflow-hidden shadow-2xl">
              {/* IDE-style header */}
              <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-sm text-gray-400 font-mono">claude code / cursor</span>
              </div>

              <div className="p-6">
                {/* Before: The Problem */}
                <div className="mb-6 p-4 rounded-xl bg-red-950/30 border border-red-800/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Alert02Icon className="w-5 h-5 text-red-400" />
                    <span className="text-sm font-medium text-red-400">Without CodeBakers</span>
                  </div>
                  <div className="text-left text-sm text-gray-300 space-y-2">
                    <p><span className="text-gray-500">Message 47:</span> "Wait, are we using Prisma or Drizzle again?"</p>
                    <p><span className="text-gray-500">Message 52:</span> "I think I've been doing auth wrong. Let me redo it..."</p>
                    <p><span className="text-gray-500">Message 58:</span> <span className="text-red-400">[Context limit reached. Session lost.]</span></p>
                  </div>
                </div>

                {/* After: The Solution */}
                <div className="p-4 rounded-xl bg-green-950/30 border border-green-800/50">
                  <div className="flex items-center gap-2 mb-3">
                    <RefreshIcon className="w-5 h-5 text-green-400" />
                    <span className="text-sm font-medium text-green-400">With CodeBakers</span>
                  </div>
                  <div className="text-left text-sm text-gray-300 space-y-2">
                    <p><span className="text-gray-500">New session:</span> "Continue working on the dashboard"</p>
                    <p><span className="text-green-400">✓</span> Resuming: Dashboard feature (Phase 2/4)</p>
                    <p><span className="text-green-400">✓</span> Stack: Next.js + Drizzle + Supabase Auth</p>
                    <p><span className="text-green-400">✓</span> Last completed: User settings API</p>
                    <p><span className="text-green-400">✓</span> Next: Team invite flow</p>
                  </div>
                </div>

                {/* Result */}
                <div className="mt-6 pt-6 border-t border-gray-700 text-center">
                  <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-green-900/30 text-green-300 text-sm font-medium">
                    <Tick02Icon className="h-4 w-4" />
                    Full context restored. Every time.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Works with */}
          <div className="flex flex-wrap justify-center items-center gap-4 mb-8">
            <span className="text-sm text-gray-400">Works inside:</span>
            <div className="flex items-center gap-4">
              <span className="font-semibold text-white">Cursor</span>
              <span className="text-gray-500">•</span>
              <span className="font-semibold text-white">Claude Code</span>
            </div>
          </div>

          {/* Demo Video */}
          <div className="max-w-3xl mx-auto mb-10">
            <div className="relative rounded-2xl overflow-hidden border-2 border-gray-700 shadow-2xl shadow-red-500/10 aspect-video bg-gray-900">
              <iframe
                src="https://www.youtube.com/embed/YOUR_VIDEO_ID?rel=0&modestbranding=1"
                title="CodeBakers Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
              {/* Fallback/placeholder until video is added */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95 hover:bg-gray-900/90 transition-colors cursor-pointer group">
                <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-xl shadow-red-500/30">
                  <PlayIcon className="h-8 w-8 text-white ml-1" />
                </div>
                <p className="text-white font-semibold text-lg">Watch 2-min Demo</p>
                <p className="text-gray-400 text-sm">See session continuity in action</p>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 mb-6">
            <Link href="/signup">
              <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white h-14 px-8 text-lg font-semibold w-full sm:w-auto shadow-xl shadow-red-500/30 transition-all hover:shadow-2xl hover:shadow-red-500/40 hover:-translate-y-1 rounded-xl">
                Stop Losing Context
                <ArrowRight02Icon className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <button
              data-cal-link="botmakers/30min"
              data-cal-namespace="30min"
              data-cal-config='{"layout":"month_view"}'
            >
              <Button
                size="lg"
                className="bg-gray-800 hover:bg-gray-700 text-white h-14 px-8 text-lg font-semibold w-full sm:w-auto rounded-xl transition-colors"
              >
                <Calendar03Icon className="mr-2 h-5 w-5" />
                Book a Demo
              </Button>
            </button>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <SecurityCheckIcon className="h-4 w-4 text-green-500" />
              <span>7-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <FlashIcon className="h-4 w-4 text-yellow-500" />
              <span>No signup required</span>
            </div>
            <div className="flex items-center gap-2">
              <Tick02Icon className="h-4 w-4 text-blue-500" />
              <span>No credit card</span>
            </div>
          </div>
        </div>
      </section>

      {/* Install Section */}
      <InstallSection />

      {/* The Problem Section - Context Loss */}
      <section id="problem" className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800">
              The Real Problem
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              AI coding assistants have amnesia.
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The longer your conversation, the more AI forgets. Context limits hit. Decisions vanish. You start over.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {painPoints.map((point, i) => (
              <div key={i} className="p-6 rounded-2xl bg-card border border-border hover:border-red-500/30 transition-all">
                <point.icon className="h-10 w-10 text-red-500 mb-4" />
                <h3 className="text-lg font-bold mb-2">{point.title}</h3>
                <p className="text-muted-foreground text-sm">{point.description}</p>
              </div>
            ))}
          </div>

          {/* The cost */}
          <div className="mt-12 p-6 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-center">
            <p className="text-lg">
              <span className="font-bold text-red-600 dark:text-red-400">The hidden cost:</span> You spend more time re-explaining context than actually coding.
            </p>
          </div>
        </div>
      </section>

      {/* Solution Section - Session Continuity */}
      <section id="solution" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800">
              <RefreshIcon className="w-3 h-3 mr-1" />
              The Solution
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              Session continuity that actually works.
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              CodeBakers gives your AI persistent memory. It knows your project, your decisions, and where you left off.
            </p>
          </div>

          {/* 3 Core Features */}
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1: Automatic Context Recovery */}
            <div className="p-8 rounded-2xl bg-card border border-border hover:border-green-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
                <RefreshIcon className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Automatic Recovery</h3>
              <p className="text-muted-foreground mb-4">
                Start a new session? CodeBakers automatically restores your full project context—stack, decisions, progress, and next steps.
              </p>
              <div className="p-4 rounded-xl bg-muted/50 text-sm font-mono">
                <span className="text-gray-500">New session started...</span>
                <br />
                <span className="text-green-400">✓ Context restored from last session</span>
                <br />
                <span className="text-green-400">✓ 47 decisions remembered</span>
              </div>
            </div>

            {/* Feature 2: Consistent Standards */}
            <div className="p-8 rounded-2xl bg-card border border-border hover:border-amber-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-6">
                <LockIcon className="h-7 w-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Locked-In Standards</h3>
              <p className="text-muted-foreground mb-4">
                AI can't randomly switch your patterns mid-project. Your auth approach, database patterns, and code style stay consistent.
              </p>
              <div className="p-4 rounded-xl bg-muted/50 text-sm font-mono">
                <span className="text-gray-500">Auth code detected...</span>
                <br />
                <span className="text-amber-400">Using established pattern: Supabase Auth</span>
                <br />
                <span className="text-gray-500">(Not switching to NextAuth)</span>
              </div>
            </div>

            {/* Feature 3: Smart Guardrails */}
            <div className="p-8 rounded-2xl bg-card border border-border hover:border-red-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
                <Target02Icon className="h-7 w-7 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Smart Guardrails</h3>
              <p className="text-muted-foreground mb-4">
                AI stays on track. It follows your established patterns, asks before making breaking changes, and doesn't go rogue.
              </p>
              <div className="p-4 rounded-xl bg-muted/50 text-sm font-mono">
                <span className="text-gray-500">AI wants to change DB schema...</span>
                <br />
                <span className="text-red-400">⚠️ Breaking change detected</span>
                <br />
                <span className="text-gray-500">Asking for confirmation first</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Simple 3 Steps */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800">
              How It Works
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              Set up once. Context forever.
            </h2>
            <p className="text-xl text-muted-foreground">
              Three steps to AI that remembers everything.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-5 shadow-lg shadow-red-600/20">
                1
              </div>
              <h3 className="text-xl font-bold mb-2">Install CLI</h3>
              <p className="text-muted-foreground text-sm mb-4">
                One command to set up CodeBakers in your project.
              </p>
              <code className="px-4 py-2.5 rounded-lg bg-gray-900 text-green-400 text-sm font-mono inline-block">
                npx @codebakers/cli go
              </code>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-5 shadow-lg shadow-red-600/20">
                2
              </div>
              <h3 className="text-xl font-bold mb-2">Describe Your Project</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Tell us about your stack. We'll lock in your decisions.
              </p>
              <code className="px-4 py-2.5 rounded-lg bg-gray-900 text-green-400 text-sm font-mono inline-block">
                Next.js + Drizzle + Supabase
              </code>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-5 shadow-lg shadow-red-600/20">
                3
              </div>
              <h3 className="text-xl font-bold mb-2">Code Forever</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Start any session. Context is always there.
              </p>
              <code className="px-4 py-2.5 rounded-lg bg-gray-900 text-green-400 text-sm font-mono inline-block">
                "Continue where we left off"
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800">
              Side-by-Side
            </Badge>
            <h2 className="text-4xl font-bold mb-4">Same AI. Different experience.</h2>
            <p className="text-xl text-muted-foreground">
              See what happens when your AI actually remembers.
            </p>
          </div>

          {/* Comparison Table */}
          <div className="rounded-2xl border-2 border-border bg-card overflow-hidden shadow-xl">
            {/* Header Row */}
            <div className="grid grid-cols-3 border-b border-border">
              <div className="p-4 bg-muted/30 font-medium text-sm text-muted-foreground">
                Scenario
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-950/30 border-l border-border text-center">
                <div className="font-bold text-red-600 dark:text-red-400">Without CodeBakers</div>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-950/30 border-l border-border text-center">
                <div className="font-bold text-green-600 dark:text-green-400">With CodeBakers</div>
              </div>
            </div>

            {/* Row: New Session */}
            <div className="grid grid-cols-3 border-b border-border">
              <div className="p-4 font-medium text-sm">Starting a new session</div>
              <div className="p-4 border-l border-border text-center text-sm text-red-600 dark:text-red-400">
                Re-explain everything
              </div>
              <div className="p-4 border-l border-border text-center text-sm text-green-600 dark:text-green-400">
                <Tick02Icon className="h-4 w-4 inline mr-1" /> Context auto-restored
              </div>
            </div>

            {/* Row: Context Limit */}
            <div className="grid grid-cols-3 border-b border-border">
              <div className="p-4 font-medium text-sm">Context limit hit</div>
              <div className="p-4 border-l border-border text-center text-sm text-red-600 dark:text-red-400">
                Lose everything, start over
              </div>
              <div className="p-4 border-l border-border text-center text-sm text-green-600 dark:text-green-400">
                <Tick02Icon className="h-4 w-4 inline mr-1" /> Seamless continuation
              </div>
            </div>

            {/* Row: Code Consistency */}
            <div className="grid grid-cols-3 border-b border-border">
              <div className="p-4 font-medium text-sm">Code consistency</div>
              <div className="p-4 border-l border-border text-center text-sm text-muted-foreground">
                AI changes patterns randomly
              </div>
              <div className="p-4 border-l border-border text-center text-sm text-green-600 dark:text-green-400">
                <Tick02Icon className="h-4 w-4 inline mr-1" /> Locked to your decisions
              </div>
            </div>

            {/* Row: Project State */}
            <div className="grid grid-cols-3 border-b border-border">
              <div className="p-4 font-medium text-sm">Project state tracking</div>
              <div className="p-4 border-l border-border text-center text-sm text-muted-foreground">
                Manual notes / memory
              </div>
              <div className="p-4 border-l border-border text-center text-sm text-green-600 dark:text-green-400">
                <Tick02Icon className="h-4 w-4 inline mr-1" /> Automatic + persistent
              </div>
            </div>

            {/* Row: Time Wasted */}
            <div className="grid grid-cols-3">
              <div className="p-4 font-medium text-sm">Time re-explaining per session</div>
              <div className="p-4 border-l border-border text-center">
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">15-30 min</span>
              </div>
              <div className="p-4 border-l border-border text-center">
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">0 min</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bonus: Better Code Quality */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800">
              <SparklesIcon className="w-3 h-3 mr-1" />
              Bonus
            </Badge>
            <h2 className="text-4xl font-bold mb-4">Better code too.</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Session continuity is just the start. Your AI also writes production-ready code on the first try.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Before */}
            <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
              <div className="flex items-center gap-2 mb-4">
                <Cancel01Icon className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-red-700 dark:text-red-300">Raw AI Output</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>Missing error handling</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>No loading states</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>Basic or no tests</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>Inconsistent patterns</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>Security oversights</span>
                </li>
              </ul>
            </div>

            {/* After */}
            <div className="p-6 rounded-2xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
              <div className="flex items-center gap-2 mb-4">
                <CheckmarkSquare02Icon className="w-5 h-5 text-green-500" />
                <h3 className="font-bold text-green-700 dark:text-green-300">With CodeBakers</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Comprehensive error handling</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Loading & empty states included</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Playwright tests auto-generated</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Follows your established patterns</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Security best practices enforced</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-muted-foreground">
              You type <code className="px-2 py-1 rounded bg-muted font-mono text-sm">add login form</code> →
              You get production-ready code with validation, errors, tests, and accessibility.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-12 px-4 bg-foreground text-background">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-red-400">0</div>
              <div className="text-background/70 text-sm">Minutes re-explaining</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-amber-400">100%</div>
              <div className="text-background/70 text-sm">Context preserved</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-green-400">∞</div>
              <div className="text-background/70 text-sm">Session continuity</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-cyan-400">1st</div>
              <div className="text-background/70 text-sm">Prompt success</div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Developers love it.</h2>
            <p className="text-muted-foreground">No more context loss. No more re-explanations.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="p-6 rounded-2xl bg-card border border-border">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <StarIcon key={j} className="h-4 w-4 text-yellow-500 fill-current" />
                  ))}
                </div>
                <p className="text-lg mb-4 italic">&quot;{t.quote}&quot;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-sm">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{t.author}</p>
                    <p className="text-muted-foreground text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge className="mb-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800">
            Simple Pricing
          </Badge>
          <h2 className="text-4xl font-bold mb-4">Start free. Scale when ready.</h2>
          <p className="text-xl text-muted-foreground mb-12">
            7-day free trial. No credit card required.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Trial */}
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h3 className="text-xl font-bold mb-2">Trial</h3>
              <div className="text-3xl font-bold mb-4">$0</div>
              <p className="text-muted-foreground text-sm mb-6">7 days free, no credit card</p>
              <Link href="/quickstart">
                <Button variant="outline" className="w-full">Start Free Trial</Button>
              </Link>
            </div>

            {/* Pro */}
            <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/30 border-2 border-red-400 dark:border-red-700 ring-2 ring-red-500/20">
              <Badge className="mb-2 bg-red-600 text-white">Most Popular</Badge>
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <div className="text-3xl font-bold mb-4">$49<span className="text-lg font-normal text-muted-foreground">/mo</span></div>
              <p className="text-muted-foreground text-sm mb-6">1 seat, unlimited projects</p>
              <Link href="/signup">
                <Button className="w-full bg-red-600 hover:bg-red-700 text-white">Get Pro</Button>
              </Link>
            </div>

            {/* Team */}
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h3 className="text-xl font-bold mb-2">Team</h3>
              <div className="text-3xl font-bold mb-4">$149<span className="text-lg font-normal text-muted-foreground">/mo</span></div>
              <p className="text-muted-foreground text-sm mb-6">5 seats, shared keys</p>
              <Link href="/signup">
                <Button variant="outline" className="w-full">Get Team</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Stop re-explaining.
            <br />
            <span className="text-muted-foreground">Start building.</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            AI coding that remembers your project, your decisions, and where you left off.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
            <Link href="/signup">
              <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white h-14 px-10 text-lg font-semibold w-full sm:w-auto shadow-xl shadow-red-500/25 rounded-xl">
                Get Started Free
                <ArrowRight02Icon className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <button
              data-cal-link="botmakers/30min"
              data-cal-namespace="30min"
              data-cal-config='{"layout":"month_view"}'
            >
              <Button size="lg" className="bg-gray-800 hover:bg-gray-700 text-white h-14 px-10 text-lg font-semibold w-full sm:w-auto rounded-xl transition-colors">
                <Calendar03Icon className="mr-2 h-5 w-5" />
                Book a Demo
              </Button>
            </button>
          </div>

          <p className="text-sm text-muted-foreground">
            Works inside Cursor & Claude Code • 2-minute setup • Cancel anytime
          </p>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-muted-foreground text-sm" suppressHydrationWarning>
            &copy; 2025 CodeBakers
          </div>
          <div className="flex gap-6 text-sm">
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">
              Login
            </Link>
            <button
              data-cal-link="botmakers/30min"
              data-cal-namespace="30min"
              data-cal-config='{"layout":"month_view"}'
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Book Demo
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
