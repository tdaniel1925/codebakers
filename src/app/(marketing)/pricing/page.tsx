import { getServerSession } from '@/lib/auth';
import { PricingCard } from '@/components/pricing-card';
import { Badge } from '@/components/ui/badge';

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
    description: 'Perfect for solo developers',
    features: [
      '40 production modules',
      '50,000+ lines of patterns',
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
    plan: 'team',
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
    plan: 'agency',
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
  {
    name: 'Enterprise',
    price: 'custom',
    plan: 'enterprise',
    description: 'Unlimited teams & custom SLA',
    features: [
      'Everything in Agency',
      'Unlimited teams',
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
            Pays for itself in one project
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            Save 20+ hours per project. 10x ROI on your first build.
            One subscription, 34 modules.
          </p>
        </div>

        {/* Free Trial Banner */}
        <div className="max-w-2xl mx-auto mb-12 p-4 rounded-lg bg-red-600/10 border border-red-500/30 text-center">
          <Badge className="bg-red-600 mb-2">7-Day Free Trial</Badge>
          <p className="text-white font-medium">
            Try CodeBakers free for 7 days - no signup required
          </p>
          <p className="text-neutral-400 text-sm mt-1">
            Run <code className="bg-neutral-800 px-2 py-0.5 rounded text-red-400">npx @codebakers/cli go</code> to start instantly
          </p>
        </div>

        {/* Plans */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
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
          <p className="text-neutral-500 text-sm">
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
                CodeBakers works with Cursor IDE and Claude Code CLI via MCP
                (Model Context Protocol) for secure, on-demand pattern access.
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
                How are patterns delivered?
              </h3>
              <p className="text-neutral-400">
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
