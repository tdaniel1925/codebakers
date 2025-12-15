import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  Zap,
  Shield,
  TestTube2,
  Code2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: '5x Faster Development',
    description:
      'Stop writing boilerplate. Get production-ready code on your first prompt.',
  },
  {
    icon: Shield,
    title: 'Security Built-In',
    description:
      'Auth, sanitization, XSS prevention, CSRF protection - all handled.',
  },
  {
    icon: TestTube2,
    title: 'Auto-Testing',
    description:
      'Every feature includes Playwright tests. No more manual test writing.',
  },
  {
    icon: Code2,
    title: 'Full Stack Coverage',
    description:
      'Auth, API, Database, Frontend, Payments, Mobile - 114 patterns total.',
  },
];

const beforeAfter = [
  {
    before: `// Without CodeBakers
// 45 minutes of prompting...
// "Add loading state"
// "Handle errors"
// "Add validation"
// "Make it accessible"
// "Add tests"
// Still broken...`,
    after: `// With CodeBakers
// One prompt:
"Build a contact form"

// Get complete code with:
// - Zod validation
// - Loading states
// - Error handling
// - Accessibility
// - Tests included`,
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="pt-20 pb-32 px-4">
        <div className="container mx-auto text-center">
          <Badge className="mb-6 bg-blue-900/50 text-blue-300 border-blue-700">
            <Sparkles className="h-3 w-3 mr-1" />
            114 Production Patterns
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Ship production-ready
            <br />
            <span className="text-blue-400">code from day one</span>
          </h1>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Stop fighting AI revision loops. CodeBakers gives your AI assistant
            27,000+ lines of production patterns for Next.js, Supabase, Stripe,
            and more.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 h-12 px-8">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/compare">
              <Button
                size="lg"
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800 h-12 px-8"
              >
                See Time Savings
              </Button>
            </Link>
          </div>

          {/* CLI Preview */}
          <div className="mt-16 max-w-2xl mx-auto">
            <div className="rounded-lg bg-slate-900 border border-slate-800 p-4 font-mono text-sm text-left">
              <div className="flex items-center gap-2 mb-4 text-slate-500">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <p className="text-slate-400">
                <span className="text-green-400">$</span> npm install -g
                @codebakers/cli
              </p>
              <p className="text-slate-400 mt-2">
                <span className="text-green-400">$</span> codebakers login
              </p>
              <p className="text-slate-500 mt-1">Enter your API key: ••••••••</p>
              <p className="text-slate-400 mt-2">
                <span className="text-green-400">$</span> codebakers install
              </p>
              <p className="text-green-400 mt-1">
                ✓ Downloaded 114 patterns (27,274 lines)
              </p>
              <p className="text-green-400">
                ✓ Ready to build production apps!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-slate-900/50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Why developers love CodeBakers
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="p-6 rounded-lg bg-slate-800/50 border border-slate-700"
                >
                  <Icon className="h-10 w-10 text-blue-400 mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Before/After */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Before vs After
          </h2>
          <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
            <div className="rounded-lg bg-red-950/20 border border-red-900/50 p-6">
              <Badge className="mb-4 bg-red-900/50 text-red-300 border-red-700">
                Without CodeBakers
              </Badge>
              <pre className="text-sm text-slate-400 font-mono whitespace-pre-wrap">
                {beforeAfter[0].before}
              </pre>
            </div>
            <div className="rounded-lg bg-green-950/20 border border-green-900/50 p-6">
              <Badge className="mb-4 bg-green-900/50 text-green-300 border-green-700">
                With CodeBakers
              </Badge>
              <pre className="text-sm text-slate-400 font-mono whitespace-pre-wrap">
                {beforeAfter[0].after}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-20 px-4 bg-slate-900/50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            114 Production Patterns Included
          </h2>
          <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            Every pattern battle-tested in real production apps
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
            {[
              'Authentication & 2FA',
              'API Routes & Validation',
              'Database & Drizzle ORM',
              'Forms & React Hook Form',
              'Stripe Payments',
              'Email with Resend',
              'File Uploads',
              'Real-time WebSockets',
              'Background Jobs',
              'Multi-tenant SaaS',
              'Testing with Playwright',
              'Performance & Caching',
            ].map((pattern) => (
              <div
                key={pattern}
                className="flex items-center gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700"
              >
                <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
                <span className="text-slate-300">{pattern}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to ship faster?
          </h2>
          <p className="text-slate-400 mb-8 max-w-xl mx-auto">
            Join developers building production apps in days, not weeks.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 h-12 px-8">
              Start for $49/month
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <p className="text-sm text-slate-500 mt-4">
            Cancel anytime. No questions asked.
          </p>
        </div>
      </section>
    </div>
  );
}
