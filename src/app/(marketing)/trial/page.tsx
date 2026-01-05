import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Github, CreditCard, ArrowRight, Clock, Zap, Plug } from 'lucide-react';
import { PRICING, TRIAL, MODULES, PRODUCT } from '@/lib/constants';

export const metadata = {
  title: 'Free Trial - CodeBakers',
  description: `Try CodeBakers free for ${TRIAL.ANONYMOUS_DAYS} days. One-click GitHub login, no credit card. Start building production-ready apps instantly.`,
};

export default function TrialPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge className="bg-red-600 mb-4">Zero Friction</Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Try CodeBakers Free for {TRIAL.ANONYMOUS_DAYS} Days
          </h1>
          <p className="text-xl text-neutral-400 mb-8 max-w-2xl mx-auto">
            One-click GitHub login. No credit card. Start building
            production-ready apps with {MODULES.COUNT} battle-tested patterns.
          </p>

          {/* Install Extension CTA */}
          <div className="max-w-md mx-auto mb-8">
            <Link href={PRODUCT.EXTENSION_URL} target="_blank">
              <Button className="w-full bg-red-600 hover:bg-red-700 text-lg py-6 gap-2">
                <Plug className="h-5 w-5" />
                Install VS Code Extension
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-3 text-sm text-neutral-400">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              {TRIAL.ANONYMOUS_DAYS} days free
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              GitHub login only (no password)
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Full access to all {MODULES.COUNT} modules
            </span>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-neutral-950">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            How the Trial Works
          </h2>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Step 1 */}
            <div className="relative">
              <div className="bg-neutral-900 border border-green-800/50 rounded-xl p-6 h-full ring-2 ring-green-500/20">
                <div className="bg-green-600 rounded-full w-10 h-10 flex items-center justify-center mb-4">
                  <Github className="h-5 w-5 text-white" />
                </div>
                <Badge className="bg-green-600/20 text-green-400 mb-3">Day 1-{TRIAL.ANONYMOUS_DAYS}</Badge>
                <h3 className="text-xl font-bold text-white mb-2">
                  Free Trial with GitHub
                </h3>
                <p className="text-neutral-400 mb-4">
                  Install the VS Code extension and sign in with GitHub. One click,
                  no passwords, instant access to all patterns.
                </p>
                <ul className="space-y-2 text-sm text-neutral-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Full access to all {MODULES.COUNT} modules
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    AI-powered code generation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Pattern enforcement built-in
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    No credit card required
                  </li>
                </ul>
              </div>
              {/* Arrow */}
              <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                <ArrowRight className="h-8 w-8 text-neutral-400" />
              </div>
            </div>

            {/* Step 2 */}
            <div>
              <div className="bg-neutral-900 border border-red-800/50 rounded-xl p-6 h-full ring-2 ring-red-500/20">
                <div className="bg-red-600 rounded-full w-10 h-10 flex items-center justify-center mb-4">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <Badge className="bg-red-600 mb-3">Day {TRIAL.ANONYMOUS_DAYS + 1}+</Badge>
                <h3 className="text-xl font-bold text-white mb-2">
                  Pro Subscription
                </h3>
                <p className="text-neutral-400 mb-4">
                  Love it? Upgrade to Pro for unlimited projects and continued
                  access. Just ${PRICING.PRO.MONTHLY}/month.
                </p>
                <ul className="space-y-2 text-sm text-neutral-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Unlimited projects
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    All {MODULES.COUNT} modules forever
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Priority support
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Pattern updates included
                  </li>
                </ul>
                <Link href="/dashboard/billing" className="block mt-4">
                  <Button className="w-full bg-red-600 hover:bg-red-700">
                    View Pricing
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            What&apos;s Included in the Trial
          </h2>
          <p className="text-neutral-400 text-center mb-12 max-w-2xl mx-auto">
            Full access to everything. No feature limitations. No watermarks.
            Build real production apps from day one.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Zap className="h-6 w-6" />,
                title: `${MODULES.COUNT} Modules`,
                description: 'Auth, payments, APIs, testing, and more',
              },
              {
                icon: <Clock className="h-6 w-6" />,
                title: 'Instant Access',
                description: 'No waiting for approval or verification',
              },
              {
                icon: <Plug className="h-6 w-6" />,
                title: 'VS Code Extension',
                description: 'Integrated directly in your editor',
              },
              {
                icon: <CheckCircle className="h-6 w-6" />,
                title: 'Production Ready',
                description: 'Battle-tested patterns, not toy examples',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 text-center"
              >
                <div className="bg-red-600/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-red-500">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-neutral-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 bg-neutral-950">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Trial FAQ
          </h2>

          <div className="space-y-6">
            {[
              {
                q: 'Why do I need to sign in with GitHub?',
                a: 'GitHub OAuth verifies you\'re a real developer without requiring passwords or payment info. It\'s quick (one click), secure, and we don\'t access your repos.',
              },
              {
                q: `What happens after ${TRIAL.ANONYMOUS_DAYS} days?`,
                a: `Your trial ends and you can upgrade to Pro ($${PRICING.PRO.MONTHLY}/month) for continued access with unlimited projects. No pressure - you can always come back later.`,
              },
              {
                q: 'Can I use it for commercial projects?',
                a: 'Yes! There are no restrictions on what you can build during the trial. If you ship something, just upgrade before your trial ends.',
              },
              {
                q: 'Is the trial limited in any way?',
                a: `The trial is limited to ${TRIAL.ANONYMOUS_DAYS} days. You get full access to all ${MODULES.COUNT} modules. Upgrade to Pro for unlimited continued access.`,
              },
              {
                q: 'How do I install the extension?',
                a: 'Search for "CodeBakers" in the VS Code Extensions marketplace, or click the install button above. Login with GitHub and you\'re ready to go.',
              },
            ].map((faq, i) => (
              <div
                key={i}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-6"
              >
                <h3 className="text-lg font-semibold text-white mb-2">{faq.q}</h3>
                <p className="text-neutral-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            Ready to Build 5x Faster?
          </h2>
          <p className="text-neutral-400 mb-8">
            Install the extension. {TRIAL.ANONYMOUS_DAYS} days free. Just sign in with GitHub.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href={PRODUCT.EXTENSION_URL} target="_blank">
              <Button className="bg-red-600 hover:bg-red-700 gap-2">
                <Plug className="h-4 w-4" />
                Install Extension
              </Button>
            </Link>
            <Link href="/dashboard/billing">
              <Button variant="outline" className="border-neutral-700">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
