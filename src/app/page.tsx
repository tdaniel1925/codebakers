'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from 'hugeicons-react';

// Just 3 testimonials - keep it light
const testimonials = [
  {
    quote: "I just describe what I want. The AI handles everything else - security, tests, the works.",
    author: "Alex Rivera",
    role: "Vibe Coder",
    avatar: "AR",
  },
  {
    quote: "It suggested a security review right after I added auth. Didn't even ask. That's the future.",
    author: "Jordan Lee",
    role: "Indie Hacker",
    avatar: "JL",
  },
];

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
      {/* Nav with section links */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">CodeBakers</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="#smart-prompts" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Smart Prompts</Link>
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link href="#compare" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Compare</Link>
            <Link href="#modules" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Modules</Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                Start Free
                <ArrowRight02Icon className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero - Original Style */}
      <section id="smart-prompts" className="pt-32 pb-16 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          {/* Cursive label */}
          <p className="text-red-500 text-2xl md:text-3xl mb-2 font-serif italic">
            Cursor / Claude Code
          </p>
          <p className="text-red-500 text-sm mb-4">↑</p>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black mb-2 leading-[1.1] tracking-tight">
            Your prompts <span className="text-red-600 dark:text-red-500">suck.</span>
          </h1>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black mb-8 leading-[1.1] tracking-tight text-muted-foreground">
            We fix them.
          </h2>

          <p className="text-xl md:text-2xl text-muted-foreground mb-12">
            Get production-ready code on the first try.
          </p>

          {/* Interactive Demo */}
          <div className="max-w-3xl mx-auto bg-slate-900 rounded-2xl p-6 mb-8 text-left border border-slate-700">
            {/* Window controls */}
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="ml-4 text-slate-400 text-sm">cursor / claude code</span>
            </div>

            {/* Two columns */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* What you type */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-slate-500 text-xs bg-slate-800 px-2 py-1 rounded">1</span>
                  <span className="text-slate-400 text-sm">What you type</span>
                </div>
                <div className="bg-slate-800 rounded-lg p-4">
                  <p className="text-slate-300 text-lg">add login form</p>
                </div>
              </div>

              {/* What AI receives */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <SparklesIcon className="w-4 h-4 text-green-500" />
                  <span className="text-green-500 text-sm">What AI receives</span>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 border border-green-500/30">
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Build login with <span className="text-white font-semibold">React Hook Form + Zod</span>, loading states, error handling, toast notifications, <span className="text-white font-semibold">accessibility</span>, keyboard nav, and <span className="text-white font-semibold">Playwright tests</span>...
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom badge */}
            <div className="flex justify-center mt-6">
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-4 py-2">
                <Tick02Icon className="w-4 h-4 text-green-500" />
                <span className="text-green-400 text-sm">Production-ready code. First prompt. No revisions.</span>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
            <Link href="/signup">
              <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white h-14 px-8 text-lg font-semibold w-full sm:w-auto shadow-xl shadow-red-500/25 rounded-xl">
                Start Building Free
                <ArrowRight02Icon className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <button
              data-cal-link="botmakers/30min"
              data-cal-namespace="30min"
              data-cal-config='{"layout":"month_view"}'
            >
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-semibold w-full sm:w-auto rounded-xl border-2">
                <Calendar03Icon className="mr-2 h-5 w-5" />
                Book a Demo
              </Button>
            </button>
          </div>
        </div>
      </section>

      {/* The Magic - Smart Triggers */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800">
              <AiMagicIcon className="w-3 h-3 mr-1" />
              The Magic
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              AI that thinks ahead
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              No commands to memorize. Your AI proactively suggests what you need, exactly when you need it.
            </p>
          </div>

          {/* 3 Smart Features */}
          <div className="grid md:grid-cols-3 gap-8">
            {/* Smart Triggers */}
            <div className="p-8 rounded-2xl bg-card border border-border hover:border-red-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
                <Target02Icon className="h-7 w-7 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Smart Triggers</h3>
              <p className="text-muted-foreground mb-4">
                Modified auth code? AI suggests a security review. Created a component? It offers an accessibility check.
              </p>
              <div className="p-4 rounded-xl bg-muted/50 text-sm font-mono">
                <span className="text-muted-foreground">[TRIGGER]</span>
                <br />
                <span className="text-foreground">Security-sensitive code detected.</span>
                <br />
                <span className="text-green-600 dark:text-green-400">Want a quick review?</span>
              </div>
            </div>

            {/* Auto-Learning */}
            <div className="p-8 rounded-2xl bg-card border border-border hover:border-amber-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-6">
                <Idea01Icon className="h-7 w-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">/learn Mode</h3>
              <p className="text-muted-foreground mb-4">
                When AI catches a mistake, it doesn't just fix it—it offers to teach you why. Level up while you build.
              </p>
              <div className="p-4 rounded-xl bg-muted/50 text-sm font-mono">
                <span className="text-amber-600 dark:text-amber-400">Caught: API key in client code</span>
                <br />
                <span className="text-foreground">Fixed. Want to learn why?</span>
                <br />
                <span className="text-muted-foreground">/learn</span>
              </div>
            </div>

            {/* Production First */}
            <div className="p-8 rounded-2xl bg-card border border-border hover:border-green-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
                <Rocket01Icon className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Production First</h3>
              <p className="text-muted-foreground mb-4">
                Tests, error handling, loading states, accessibility—all included automatically. No asking required.
              </p>
              <div className="p-4 rounded-xl bg-muted/50 text-sm font-mono">
                <span className="text-muted-foreground">You type:</span> add login
                <br />
                <span className="text-green-600 dark:text-green-400">AI adds:</span> + tests + a11y + errors
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Before/After - Quick Visual */}
      <section className="py-20 px-4">
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

      {/* Quick Stats */}
      <section className="py-12 px-4 bg-foreground text-background">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-red-400">39</div>
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

      {/* Testimonials - Just 2 */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Developers love it</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
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
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge className="mb-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800">
            Simple Pricing
          </Badge>
          <h2 className="text-4xl font-bold mb-4">Start free. Scale when ready.</h2>
          <p className="text-xl text-muted-foreground mb-12">
            1 free project forever. No credit card required.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h3 className="text-xl font-bold mb-2">Free</h3>
              <div className="text-3xl font-bold mb-4">$0</div>
              <p className="text-muted-foreground text-sm mb-6">1 project forever</p>
              <Link href="/signup">
                <Button variant="outline" className="w-full">Start Free</Button>
              </Link>
            </div>

            {/* Pro */}
            <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/30 border-2 border-red-400 dark:border-red-700 ring-2 ring-red-500/20">
              <Badge className="mb-2 bg-red-600 text-white">Most Popular</Badge>
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <div className="text-3xl font-bold mb-4">$149<span className="text-lg font-normal text-muted-foreground">/mo</span></div>
              <p className="text-muted-foreground text-sm mb-6">Unlimited projects</p>
              <Link href="/signup">
                <Button className="w-full bg-red-600 hover:bg-red-700 text-white">Get Pro</Button>
              </Link>
            </div>

            {/* Team */}
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h3 className="text-xl font-bold mb-2">Team</h3>
              <div className="text-3xl font-bold mb-4">$299<span className="text-lg font-normal text-muted-foreground">/mo</span></div>
              <p className="text-muted-foreground text-sm mb-6">5 developers</p>
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
            Ready to vibe?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Stop wrestling with prompts. Let your AI handle the details.
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
