import { getServerSession } from '@/lib/auth';
import { PricingCard } from '@/components/pricing-card';
import { Badge } from '@/components/ui/badge';
import { CODEBAKERS_STATS } from '@/lib/stats';

const plans: Array<{
  name: string;
  price: number | 'custom';
  plan: 'pro' | 'team' | 'agency' | 'enterprise';
  description: string;
  features: string[];
  popular: boolean;
}> = [
  {
    name: 'Pro',
    price: 49,
    plan: 'pro',
    description: 'Save 20+ hours per project',
    features: [
      'Unlimited Claude API — no token limits',
      'Guaranteed pattern enforcement',
      `${CODEBAKERS_STATS.moduleCount} production modules`,
      'Perfect context recall',
      'Auto-testing & Guardian',
      'VS Code + Cursor + Claude Code',
      '95%+ pattern compliance',
      'Email support',
    ],
    popular: true,
  },
  {
    name: 'Team',
    price: 149,
    plan: 'team',
    description: 'For growing teams',
    features: [
      'Everything in Pro',
      '5 team seats',
      'Team management dashboard',
      'Shared patterns & context',
      'Priority support',
      'Slack community',
    ],
    popular: false,
  },
  {
    name: 'Enterprise',
    price: 'custom',
    plan: 'enterprise',
    description: 'Unlimited teams & custom SLA',
    features: [
      'Everything in Team',
      'Unlimited seats',
      'Custom SLA (99.9% uptime)',
      'Dedicated account manager',
      'Custom pattern development',
      'SSO/SAML integration',
      'Invoice billing',
      'On-premise deployment option',
    ],
    popular: false,
  },
];

export default async function PricingPage() {
  const session = await getServerSession();
  const isLoggedIn = !!session;

  return (
    <div className="py-20 px-4 bg-black min-h-screen">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Stop Fixing AI Mistakes
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto mb-4">
            Cursor and Claude Code ignore your standards. CodeBakers enforces them.
          </p>
          <p className="text-lg text-neutral-500 max-w-xl mx-auto">
            Save 20+ hours per project. Get production-ready code the first time.
          </p>
        </div>

        {/* Free Trial Banner */}
        <div className="max-w-2xl mx-auto mb-12 p-4 rounded-lg bg-red-600/10 border border-red-500/30 text-center">
          <Badge className="bg-red-600 mb-2">14-Day Free Trial</Badge>
          <p className="text-white font-medium">
            Try CodeBakers free for 14 days — unlimited access
          </p>
          <p className="text-neutral-400 text-sm mt-1">
            No credit card required · Cancel anytime
          </p>
        </div>

        {/* Plans */}
        <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-3 max-w-5xl mx-auto">
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
          <p className="text-neutral-400 text-sm">
            Secure payments powered by PayPal. Pay with credit card, debit card, or PayPal balance.
          </p>
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div className="p-6 rounded-lg bg-neutral-900/80 border border-neutral-800">
              <h3 className="font-semibold text-white mb-2">
                Which AI tools does this work with?
              </h3>
              <p className="text-neutral-400">
                CodeBakers includes a VS Code extension with built-in Claude AI,
                plus CLI integration for Cursor IDE and Claude Code via MCP.
                Your subscription covers all platforms.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-neutral-900/80 border border-neutral-800">
              <h3 className="font-semibold text-white mb-2">
                Can I pay without a PayPal account?
              </h3>
              <p className="text-neutral-400">
                Yes! PayPal supports guest checkout with credit or debit cards.
                You don&apos;t need to create a PayPal account to subscribe.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-neutral-900/80 border border-neutral-800">
              <h3 className="font-semibold text-white mb-2">
                Can I cancel anytime?
              </h3>
              <p className="text-neutral-400">
                Yes, you can cancel your subscription at any time. You&apos;ll retain
                access until the end of your billing period. No questions asked.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-neutral-900/80 border border-neutral-800">
              <h3 className="font-semibold text-white mb-2">
                What tech stack do the patterns cover?
              </h3>
              <p className="text-neutral-400">
                Next.js 14+, React, TypeScript, Supabase, Drizzle ORM, Stripe,
                shadcn/ui, Tailwind CSS, Zod, React Hook Form, Playwright, and
                many integrations like Resend, VAPI, Inngest, and more.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-neutral-900/80 border border-neutral-800">
              <h3 className="font-semibold text-white mb-2">
                How do I get started?
              </h3>
              <p className="text-neutral-400">
                Install the CodeBakers extension from the VS Code marketplace,
                login with GitHub, and start coding. Patterns are loaded automatically
                when you chat with the AI. No manual setup required.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-neutral-900/80 border border-neutral-800">
              <h3 className="font-semibold text-white mb-2">
                What does &quot;unlimited&quot; include?
              </h3>
              <p className="text-neutral-400">
                Unlimited Claude API calls through our VS Code extension,
                unlimited pattern access, and unlimited projects.
                No token limits, no rate limits, no surprises.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
