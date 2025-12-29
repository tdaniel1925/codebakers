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
  UserIcon,
  Briefcase01Icon,
  Book02Icon,
} from 'hugeicons-react';

// Testimonials representing different skill levels
const testimonials = [
  {
    quote: "I'm learning to code and had no idea auth needed security reviews. CodeBakers caught things I didn't even know to worry about.",
    author: "Maya Chen",
    role: "Career Changer, 6 months coding",
    avatar: "MC",
  },
  {
    quote: "I know what production code should look like—I just don't want to explain it every time. Now I don't have to.",
    author: "David Park",
    role: "Staff Engineer, 12 years exp",
    avatar: "DP",
  },
  {
    quote: "Shipped my SaaS in 3 weeks instead of 3 months. The AI writes code like a senior dev reviewed it.",
    author: "Jordan Lee",
    role: "Indie Hacker",
    avatar: "JL",
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
    <div className="min-h-screen bg-background text-foreground">
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
            <Link href="#smart-prompts" className="text-gray-400 hover:text-white transition-colors text-sm">
              Smart Prompts
            </Link>
            <Link href="#features" className="text-gray-400 hover:text-white transition-colors text-sm">
              Features
            </Link>
            <Link href="#compare" className="text-gray-400 hover:text-white transition-colors text-sm">
              Compare
            </Link>
            <Link href="#modules" className="text-gray-400 hover:text-white transition-colors text-sm">
              Modules
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

      {/* Hero Section - Clear Value Prop */}
      <section id="smart-prompts" className="pt-24 pb-12 px-4 min-h-[calc(100vh-4rem)] flex items-center relative overflow-hidden bg-gray-950">
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
          {/* MAIN HEADLINE - The Problem & Solution */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-6 leading-[1] tracking-tight mt-8 text-white">
            <span className="text-gray-400">Your </span>
            {/* Handwriting annotation floating above the space between Your and prompts */}
            <span className="relative inline-block">
              <span className="text-gray-400">prompts</span>
              {/* Proofreader-style insertion: handwriting above with caret pointing UP */}
              <span className="absolute -top-4 sm:-top-5 md:-top-6 lg:-top-8 -left-4 sm:-left-16 md:-left-24 lg:-left-28 flex flex-col items-center pointer-events-none select-none">
                <span
                  className="text-red-500 text-xl sm:text-2xl md:text-3xl lg:text-4xl whitespace-nowrap rotate-[-3deg]"
                  style={{ fontFamily: "'Caveat', cursive" }}
                >
                  Cursor / Claude Code
                </span>
                {/* Caret pointing UP (^) */}
                <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-red-500 -mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </span>
            </span>
            <span className="text-red-600"> suck.</span>
            <br />
            <span className="text-white">We fix&nbsp;them.</span>
          </h1>

          {/* Clear explanation - what we actually do */}
          <p className="text-lg md:text-xl lg:text-2xl text-gray-400 mb-8 max-w-3xl mx-auto font-medium">
            <span className="text-white font-bold">Get production-ready code on the first try.</span>
          </p>

          {/* Visual: Before → After in IDE context */}
          <div className="max-w-3xl mx-auto mb-8">
            <div className="rounded-2xl border-2 border-gray-700 bg-gray-900/80 backdrop-blur-sm overflow-hidden shadow-2xl">
              {/* IDE-style header */}
              <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-sm text-gray-400 font-mono">cursor / claude code</span>
              </div>

              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-6 items-start">
                  {/* What you type */}
                  <div className="text-left">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded bg-gray-700 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-400">1</span>
                      </div>
                      <span className="text-sm font-medium text-gray-400">What you type</span>
                    </div>
                    <div className="px-4 py-3 rounded-lg bg-gray-800 font-mono text-base text-gray-200">
                      add login form
                    </div>
                  </div>

                  {/* What AI receives */}
                  <div className="text-left">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded bg-green-500 flex items-center justify-center">
                        <MagicWand02Icon className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-sm font-medium text-green-400">What AI receives</span>
                    </div>
                    <div className="px-4 py-3 rounded-lg bg-green-950/30 border border-green-800 text-sm text-gray-200 leading-relaxed">
                      Build login with <strong className="text-white">React Hook Form + Zod</strong>, loading states, error handling, toast notifications, <strong className="text-white">accessibility</strong>, keyboard nav, and <strong className="text-white">Playwright tests</strong>...
                    </div>
                  </div>
                </div>

                {/* Result */}
                <div className="mt-6 pt-6 border-t border-gray-700 text-center">
                  <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-green-900/30 text-green-300 text-sm font-medium">
                    <Tick02Icon className="h-4 w-4" />
                    Production-ready code. First prompt. No revisions.
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

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 mb-6">
            <Link href="/signup">
              <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white h-14 px-8 text-lg font-semibold w-full sm:w-auto shadow-xl shadow-red-500/30 transition-all hover:shadow-2xl hover:shadow-red-500/40 hover:-translate-y-1 rounded-xl">
                Upgrade My Prompts
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
                variant="outline"
                className="border-2 border-gray-600 hover:bg-gray-800 text-white h-14 px-8 text-lg font-semibold w-full sm:w-auto group rounded-xl"
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

      {/* Install Section - Simple one-click install */}
      <InstallSection />

      {/* Who It's For - Speak to all skill levels */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800">
              For Every Developer
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              Your skill level doesn't matter.
              <br />
              <span className="text-muted-foreground">Your output does.</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Whether you're writing your first app or your hundredth, CodeBakers fills the gaps you don't even know you have.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Beginners */}
            <div className="p-8 rounded-2xl bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
              <div className="w-14 h-14 rounded-xl bg-red-600 flex items-center justify-center mb-6">
                <Book02Icon className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2">Just Starting?</h3>
              <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-4">You don't know what you don't know.</p>
              <p className="text-muted-foreground mb-4">
                You can build amazing things with AI—but how do you know if the code is secure? Accessible? Production-ready?
              </p>
              <p className="text-foreground font-medium">
                CodeBakers knows. It automatically adds the things experienced developers would add—so you ship like a pro from day one.
              </p>
            </div>

            {/* Mid-level / Indie */}
            <div className="p-8 rounded-2xl bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
              <div className="w-14 h-14 rounded-xl bg-black dark:bg-white flex items-center justify-center mb-6">
                <Rocket01Icon className="h-7 w-7 text-white dark:text-black" />
              </div>
              <h3 className="text-xl font-bold mb-2">Building Fast?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-4">You're tired of the back-and-forth.</p>
              <p className="text-muted-foreground mb-4">
                You've shipped before. You know the drill—prompt, fix, prompt again, add error handling, fix again. It's exhausting.
              </p>
              <p className="text-foreground font-medium">
                Skip the iteration loop. Your first prompt produces code that's already complete—tests, errors, loading states, all of it.
              </p>
            </div>

            {/* Experienced */}
            <div className="p-8 rounded-2xl bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
              <div className="w-14 h-14 rounded-xl bg-red-600 flex items-center justify-center mb-6">
                <Briefcase01Icon className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2">Senior Dev?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-4">You know what good looks like.</p>
              <p className="text-muted-foreground mb-4">
                You've been writing production code for years. You know about security, testing, edge cases—you just don't want to explain it every time.
              </p>
              <p className="text-foreground font-medium">
                Stop teaching AI your standards. CodeBakers already knows them. Get code written the way you'd write it—without the monologue.
              </p>
            </div>
          </div>

          {/* The key insight */}
          <div className="mt-12 p-6 rounded-2xl bg-muted/50 border border-border text-center">
            <p className="text-lg">
              <span className="font-bold">The difference?</span> Without CodeBakers, AI writes code like a tutorial.
              <br />
              <span className="text-muted-foreground">With CodeBakers, AI writes code like your best engineer on their best day.</span>
            </p>
          </div>
        </div>
      </section>

      {/* The Magic - Smart Triggers */}
      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800">
              <AiMagicIcon className="w-3 h-3 mr-1" />
              How It Works
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              It's not magic. It's patterns.
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {CODEBAKERS_STATS.moduleCount} modules of battle-tested code patterns. The AI reads them. Your code inherits them. Simple.
            </p>
          </div>

          {/* 3 Smart Features - Problem-focused */}
          <div className="grid md:grid-cols-3 gap-8">
            {/* Smart Triggers */}
            <div className="p-8 rounded-2xl bg-card border border-border hover:border-red-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
                <Target02Icon className="h-7 w-7 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Forget Something? AI Won't.</h3>
              <p className="text-muted-foreground mb-4">
                Touched auth code? AI reminds you to review security. Built a form? It suggests accessibility checks. Like having a senior dev watching over your shoulder.
              </p>
              <div className="p-4 rounded-xl bg-muted/50 text-sm font-mono">
                <span className="text-muted-foreground">[AUTO-TRIGGER]</span>
                <br />
                <span className="text-foreground">Auth code changed.</span>
                <br />
                <span className="text-green-600 dark:text-green-400">Security review suggested.</span>
              </div>
            </div>

            {/* Auto-Learning */}
            <div className="p-8 rounded-2xl bg-card border border-border hover:border-amber-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-6">
                <Idea01Icon className="h-7 w-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Level Up While You Build</h3>
              <p className="text-muted-foreground mb-4">
                When AI catches a mistake, it doesn't just fix it—it can teach you why. Every bug becomes a lesson. Every fix makes you better.
              </p>
              <div className="p-4 rounded-xl bg-muted/50 text-sm font-mono">
                <span className="text-amber-600 dark:text-amber-400">Fixed: API key in client code</span>
                <br />
                <span className="text-foreground">Want to learn why this matters?</span>
                <br />
                <span className="text-muted-foreground">/learn</span>
              </div>
            </div>

            {/* Production First */}
            <div className="p-8 rounded-2xl bg-card border border-border hover:border-green-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
                <SecurityCheckIcon className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Never Ship Broken Code</h3>
              <p className="text-muted-foreground mb-4">
                Tests, error handling, loading states, accessibility—automatically included. You don't ask for them. You don't need to know to ask. They're just there.
              </p>
              <div className="p-4 rounded-xl bg-muted/50 text-sm font-mono">
                <span className="text-muted-foreground">You type:</span> add login
                <br />
                <span className="text-green-600 dark:text-green-400">You get:</span> login + tests + a11y + errors
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Before/After - Quick Visual */}
      <section id="compare" className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="rounded-2xl border-2 border-border bg-card overflow-hidden shadow-2xl">
            {/* IDE Header */}
            <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-sm text-muted-foreground font-mono">your-project</span>
            </div>

            <div className="p-8">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                {/* What you type */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">What you type:</p>
                  <div className="p-4 rounded-xl bg-muted font-mono text-lg">
                    add stripe checkout
                  </div>
                </div>

                {/* What you get */}
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-3">What you get:</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Tick02Icon className="h-4 w-4 text-green-500" />
                      <span>Webhook handlers with signature verification</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Tick02Icon className="h-4 w-4 text-green-500" />
                      <span>Error recovery & idempotency</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Tick02Icon className="h-4 w-4 text-green-500" />
                      <span>Database sync & loading states</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Tick02Icon className="h-4 w-4 text-green-500" />
                      <span>Playwright tests included</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Result badge */}
              <div className="mt-8 pt-6 border-t border-border text-center">
                <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800 text-sm px-4 py-2">
                  <Tick02Icon className="h-4 w-4 mr-2" />
                  Production-ready. First prompt. No revisions.
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Gap - What you'd need to know */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">The knowledge gap is real</h2>
            <p className="text-muted-foreground">Here's what "production-ready" actually means. CodeBakers handles all of it.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Without */}
            <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">?</span>
                </div>
                <h3 className="font-bold text-red-700 dark:text-red-300">What you'd need to know</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>Zod validation schemas for type-safe forms</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>Error boundaries and loading states</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>ARIA labels, focus management, keyboard nav</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>Rate limiting and security headers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>Webhook signature verification</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>Idempotency keys for payment retries</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>Test patterns (unit, integration, e2e)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>... and 100+ other best practices</span>
                </li>
              </ul>
            </div>

            {/* With */}
            <div className="p-6 rounded-2xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <Tick02Icon className="h-4 w-4 text-white" />
                </div>
                <h3 className="font-bold text-green-700 dark:text-green-300">What you actually type</h3>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 font-mono text-lg mb-4 border border-green-300 dark:border-green-800">
                add login form
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                CodeBakers patterns inject all that knowledge into your AI. You get production-ready code without knowing the 100+ things that make it production-ready.
              </p>
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium text-sm">
                <Tick02Icon className="h-4 w-4" />
                <span>All best practices included automatically</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section id="modules" className="py-12 px-4 bg-foreground text-background">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-red-400">{CODEBAKERS_STATS.moduleCount}</div>
              <div className="text-background/70 text-sm">Pattern Modules</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-amber-400">9</div>
              <div className="text-background/70 text-sm">Smart Triggers</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-green-400">90%</div>
              <div className="text-background/70 text-sm">Less Prompting</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-cyan-400">1st</div>
              <div className="text-background/70 text-sm">Prompt Success</div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials - Diverse skill levels */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">From first-timers to veterans</h2>
            <p className="text-muted-foreground">Every skill level, same result: production-ready code.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="p-6 rounded-2xl bg-card border border-border">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="h-4 w-4 text-yellow-500 fill-current" />
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

      {/* Simple Pricing */}
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
              <p className="text-muted-foreground text-sm mb-4">7 days free, no signup</p>
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Mac/Linux:</span>
                </div>
                <code className="block text-xs bg-muted px-2 py-1.5 rounded text-red-500 overflow-x-auto whitespace-nowrap">curl -fsSL codebakers.ai/install.sh | bash</code>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                  <span>Windows:</span>
                </div>
                <code className="block text-xs bg-muted px-2 py-1.5 rounded text-red-500 overflow-x-auto whitespace-nowrap">irm codebakers.ai/install.ps1 | iex</code>
              </div>
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

      {/* Final CTA with Demo Booking */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ship like a senior dev.
            <br />
            <span className="text-muted-foreground">From day one.</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Whether you're learning or leading, CodeBakers makes your AI build production-ready code.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
            <Link href="/signup">
              <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white h-14 px-10 text-lg font-semibold w-full sm:w-auto shadow-xl shadow-red-500/25 rounded-xl">
                Start Building Free
                <ArrowRight02Icon className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <button
              data-cal-link="botmakers/30min"
              data-cal-namespace="30min"
              data-cal-config='{"layout":"month_view"}'
            >
              <Button size="lg" variant="outline" className="h-14 px-10 text-lg font-semibold w-full sm:w-auto rounded-xl border-2">
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
          <div className="text-muted-foreground text-sm">
            &copy; {new Date().getFullYear()} CodeBakers
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
