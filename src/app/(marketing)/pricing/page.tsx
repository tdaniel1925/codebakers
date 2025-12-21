import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Pro',
    price: 49,
    description: 'Perfect for solo developers',
    features: [
      '34 production modules',
      '45,474 lines of patterns',
      'Auto-testing included',
      'Full stack coverage',
      '1 seat',
      'Email support',
    ],
    cta: 'Get Started',
    popular: true,
  },
  {
    name: 'Team',
    price: 149,
    description: 'For growing teams',
    features: [
      'Everything in Pro',
      '5 team seats',
      'Team management dashboard',
      'Shared API keys',
      'Priority support',
      'Slack community',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Agency',
    price: 349,
    description: 'For agencies & consultancies',
    features: [
      'Everything in Team',
      'Unlimited seats',
      'White-label support',
      'Custom patterns on request',
      'Dedicated support',
      'Training sessions',
    ],
    cta: 'Contact Us',
    popular: false,
  },
];

export default function PricingPage() {
  return (
    <div className="py-20 px-4">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            One subscription, 34 modules. No hidden fees, no per-project
            charges.
          </p>
        </div>

        {/* Plans */}
        <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl bg-slate-800/50 border p-8 relative ${
                plan.popular ? 'border-blue-500 ring-2 ring-blue-500' : 'border-slate-700'
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600">
                  Most Popular
                </Badge>
              )}
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">{plan.name}</h2>
                <p className="text-slate-400 mt-1">{plan.description}</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">
                  ${plan.price}
                </span>
                <span className="text-slate-400">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <span className="text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block">
                <Button
                  className={`w-full ${
                    plan.popular
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div className="p-6 rounded-lg bg-slate-800/50 border border-slate-700">
              <h3 className="font-semibold text-white mb-2">
                Which AI tools does this work with?
              </h3>
              <p className="text-slate-400">
                CodeBakers works with Cursor IDE, Claude Code CLI, Aider, and
                any AI tool that reads context files. The patterns are delivered
                as standard markdown files.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-slate-800/50 border border-slate-700">
              <h3 className="font-semibold text-white mb-2">
                Can I cancel anytime?
              </h3>
              <p className="text-slate-400">
                Yes, you can cancel your subscription at any time. You'll retain
                access until the end of your billing period. No questions asked.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-slate-800/50 border border-slate-700">
              <h3 className="font-semibold text-white mb-2">
                What tech stack do the patterns cover?
              </h3>
              <p className="text-slate-400">
                Next.js 14+, React, TypeScript, Supabase, Drizzle ORM, Stripe,
                shadcn/ui, Tailwind CSS, Zod, React Hook Form, Playwright, and
                many integrations like Resend, VAPI, Inngest, and more.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-slate-800/50 border border-slate-700">
              <h3 className="font-semibold text-white mb-2">
                How are patterns delivered?
              </h3>
              <p className="text-slate-400">
                Install our CLI, login with your API key, and run `codebakers
                install` in your project. Patterns are downloaded and configured
                automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
