import { getServerSession } from '@/lib/auth';
import { PricingCard } from '@/components/pricing-card';
import { Badge } from '@/components/ui/badge';

const plans = [
  {
    name: 'Pro',
    price: 49,
    plan: 'pro' as const,
    description: 'Perfect for solo developers',
    features: [
      '34 production modules',
      '45,474 lines of patterns',
      'Auto-testing included',
      'Full stack coverage',
      '1 seat',
      'Email support',
    ],
    popular: true,
  },
  {
    name: 'Team',
    price: 149,
    plan: 'team' as const,
    description: 'For growing teams',
    features: [
      'Everything in Pro',
      '5 team seats',
      'Team management dashboard',
      'Shared API keys',
      'Priority support',
      'Slack community',
    ],
    popular: false,
  },
  {
    name: 'Agency',
    price: 349,
    plan: 'agency' as const,
    description: 'For agencies & consultancies',
    features: [
      'Everything in Team',
      'Unlimited seats',
      'White-label support',
      'Custom patterns on request',
      'Dedicated support',
      'Training sessions',
    ],
    popular: false,
  },
];

export default async function PricingPage() {
  const session = await getServerSession();
  const isLoggedIn = !!session;

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

        {/* Free Project Banner */}
        <div className="max-w-2xl mx-auto mb-12 p-4 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-center">
          <Badge className="bg-green-600 mb-2">Try Free</Badge>
          <p className="text-white font-medium">
            Start with 1 free project - no credit card required
          </p>
          <p className="text-slate-400 text-sm mt-1">
            Upgrade anytime to unlock unlimited projects
          </p>
        </div>

        {/* Plans */}
        <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <PricingCard
              key={plan.name}
              name={plan.name}
              price={plan.price}
              plan={plan.plan}
              description={plan.description}
              features={plan.features}
              popular={plan.popular}
              isLoggedIn={isLoggedIn}
            />
          ))}
        </div>

        {/* Payment Methods */}
        <div className="text-center mt-8">
          <p className="text-slate-400 text-sm">
            Secure payments powered by PayPal. Pay with credit card, debit card, or PayPal balance.
          </p>
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
                Can I pay without a PayPal account?
              </h3>
              <p className="text-slate-400">
                Yes! PayPal supports guest checkout with credit or debit cards.
                You don't need to create a PayPal account to subscribe.
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
