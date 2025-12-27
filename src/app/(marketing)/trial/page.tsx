import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Github, CreditCard, ArrowRight, Terminal, Clock, Zap } from 'lucide-react';

export const metadata = {
  title: 'Free Trial - CodeBakers',
  description: 'Try CodeBakers free for 7 days. No signup required, no credit card. Start building production-ready apps instantly.',
};

export default function TrialPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge className="bg-red-600 mb-4">Zero Friction</Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Try CodeBakers Free for 14 Days
          </h1>
          <p className="text-xl text-neutral-400 mb-8 max-w-2xl mx-auto">
            No signup. No credit card. Just run one command and start building
            production-ready apps with 40 battle-tested patterns.
          </p>

          {/* CLI Command */}
          <div className="max-w-md mx-auto mb-8">
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
              <p className="text-neutral-500 text-sm mb-2 flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Run this command:
              </p>
              <code className="block text-lg text-red-400 font-mono">
                npx @codebakers/cli go
              </code>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 text-sm text-neutral-500">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              7 days free
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              No signup required
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Full access to all 40 modules
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

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 h-full">
                <div className="bg-blue-600 rounded-full w-10 h-10 flex items-center justify-center mb-4">
                  <Terminal className="h-5 w-5 text-white" />
                </div>
                <Badge className="bg-blue-600/20 text-blue-400 mb-3">Day 1-7</Badge>
                <h3 className="text-xl font-bold text-white mb-2">
                  Anonymous Trial
                </h3>
                <p className="text-neutral-400 mb-4">
                  Run the CLI command and get instant access. No email, no signup,
                  no friction. Just start building.
                </p>
                <ul className="space-y-2 text-sm text-neutral-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Full access to all 40 modules
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Works with Cursor & Claude Code
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    1 project limit
                  </li>
                </ul>
              </div>
              {/* Arrow */}
              <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                <ArrowRight className="h-8 w-8 text-neutral-700" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 h-full">
                <div className="bg-green-600 rounded-full w-10 h-10 flex items-center justify-center mb-4">
                  <Github className="h-5 w-5 text-white" />
                </div>
                <Badge className="bg-green-600/20 text-green-400 mb-3">Day 8-14</Badge>
                <h3 className="text-xl font-bold text-white mb-2">
                  Extended Trial
                </h3>
                <p className="text-neutral-400 mb-4">
                  Connect your GitHub account for 7 more days free. One click,
                  no passwords to remember.
                </p>
                <ul className="space-y-2 text-sm text-neutral-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    +7 days additional access
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Still no credit card
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Keep the same project
                  </li>
                </ul>
                <div className="mt-4 p-3 bg-neutral-800/50 rounded-lg">
                  <code className="text-sm text-green-400 font-mono">
                    codebakers extend
                  </code>
                </div>
              </div>
              {/* Arrow */}
              <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                <ArrowRight className="h-8 w-8 text-neutral-700" />
              </div>
            </div>

            {/* Step 3 */}
            <div>
              <div className="bg-neutral-900 border border-red-800/50 rounded-xl p-6 h-full ring-2 ring-red-500/20">
                <div className="bg-red-600 rounded-full w-10 h-10 flex items-center justify-center mb-4">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <Badge className="bg-red-600 mb-3">Day 15+</Badge>
                <h3 className="text-xl font-bold text-white mb-2">
                  Pro Subscription
                </h3>
                <p className="text-neutral-400 mb-4">
                  Love it? Upgrade to Pro for unlimited projects and continued
                  access. Just $49/month.
                </p>
                <ul className="space-y-2 text-sm text-neutral-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Unlimited projects
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    All 40 modules forever
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
                <Link href="/pricing" className="block mt-4">
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
                title: '40 Modules',
                description: 'Auth, payments, APIs, testing, and more',
              },
              {
                icon: <Clock className="h-6 w-6" />,
                title: 'Instant Access',
                description: 'No waiting for approval or verification',
              },
              {
                icon: <Terminal className="h-6 w-6" />,
                title: 'CLI + MCP',
                description: 'Works with Cursor and Claude Code',
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
                q: 'Do I need to create an account?',
                a: 'No. The trial is completely anonymous. We track your device to prevent abuse, but we don\'t require any personal information.',
              },
              {
                q: 'What happens after 7 days?',
                a: 'You can connect your GitHub account for 7 more days free (14 days total). After that, you can upgrade to Pro ($49/month) or your access will end.',
              },
              {
                q: 'Can I use it for commercial projects?',
                a: 'Yes! There are no restrictions on what you can build during the trial. If you ship something, just upgrade before your trial ends.',
              },
              {
                q: 'What does "1 project limit" mean?',
                a: 'During the trial, you can use CodeBakers in one project directory. Upgrading to Pro unlocks unlimited projects.',
              },
              {
                q: 'Why do you need my GitHub account for extension?',
                a: 'GitHub OAuth is a simple way to verify you\'re a real developer without requiring passwords or payment info. It\'s just for verification - we don\'t access your repos.',
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
            One command. 7 days free. No strings attached.
          </p>

          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 mb-8">
            <code className="text-xl text-red-400 font-mono">
              npx @codebakers/cli go
            </code>
          </div>

          <div className="flex justify-center gap-4">
            <Link href="/pricing">
              <Button variant="outline" className="border-neutral-700">
                View Pricing
              </Button>
            </Link>
            <Link href="/">
              <Button className="bg-red-600 hover:bg-red-700">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
