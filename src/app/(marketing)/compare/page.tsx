import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Clock, TrendingUp } from 'lucide-react';

const comparisons = [
  {
    task: 'Complete Auth System',
    without: '4-6 hours',
    with: '30 min',
    savings: '90%',
  },
  {
    task: 'CRUD API Endpoint',
    without: '45 min',
    with: '10 min',
    savings: '80%',
  },
  {
    task: 'Form with Validation',
    without: '45 min',
    with: '5 min',
    savings: '90%',
  },
  {
    task: 'Stripe Integration',
    without: '3-4 hours',
    with: '30 min',
    savings: '85%',
  },
  {
    task: 'Test Suite Setup',
    without: '1 hour',
    with: '0 min',
    savings: '100%',
  },
  {
    task: 'Error Handling',
    without: '30 min',
    with: '0 min',
    savings: '100%',
  },
  {
    task: 'Loading States',
    without: '20 min',
    with: '0 min',
    savings: '100%',
  },
  {
    task: 'Database Schema',
    without: '30 min',
    with: '5 min',
    savings: '85%',
  },
];

export default function ComparePage() {
  return (
    <div className="py-20 px-4">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Time Savings Calculator
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            See exactly how much time CodeBakers saves you on common development
            tasks
          </p>
        </div>

        {/* Comparison Table */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="rounded-xl bg-neutral-800/50 border border-neutral-700 overflow-hidden">
            <div className="grid grid-cols-4 gap-4 p-4 bg-neutral-900/50 border-b border-neutral-700">
              <div className="font-semibold text-neutral-300">Task</div>
              <div className="font-semibold text-neutral-300 text-center">
                Without CodeBakers
              </div>
              <div className="font-semibold text-neutral-300 text-center">
                With CodeBakers
              </div>
              <div className="font-semibold text-neutral-300 text-center">
                Time Saved
              </div>
            </div>
            {comparisons.map((item, index) => (
              <div
                key={item.task}
                className={`grid grid-cols-4 gap-4 p-4 items-center ${
                  index !== comparisons.length - 1
                    ? 'border-b border-neutral-700'
                    : ''
                }`}
              >
                <div className="text-white font-medium">{item.task}</div>
                <div className="text-center text-red-400">{item.without}</div>
                <div className="text-center text-green-400">{item.with}</div>
                <div className="text-center">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-900/30 text-green-400 text-sm font-medium">
                    <TrendingUp className="h-3 w-3" />
                    {item.savings}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto mb-16">
          <div className="p-6 rounded-xl bg-gradient-to-br from-red-900/50 to-red-800/30 border border-red-700">
            <Clock className="h-8 w-8 text-red-400 mb-4" />
            <div className="text-3xl font-bold text-white mb-2">10+ hours</div>
            <p className="text-neutral-400">
              Saved per feature implementation
            </p>
          </div>
          <div className="p-6 rounded-xl bg-gradient-to-br from-green-900/50 to-green-800/30 border border-green-700">
            <TrendingUp className="h-8 w-8 text-green-400 mb-4" />
            <div className="text-3xl font-bold text-white mb-2">85%</div>
            <p className="text-neutral-400">
              Average time reduction on tasks
            </p>
          </div>
          <div className="p-6 rounded-xl bg-gradient-to-br from-neutral-800/50 to-neutral-900/30 border border-neutral-700">
            <div className="h-8 w-8 text-white mb-4 font-bold text-2xl">
              0
            </div>
            <div className="text-3xl font-bold text-white mb-2">Bugs</div>
            <p className="text-neutral-400">
              From following battle-tested patterns
            </p>
          </div>
        </div>

        {/* Why It Works */}
        <div className="max-w-3xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Why is it so much faster?
          </h2>
          <div className="space-y-4">
            <div className="p-6 rounded-lg bg-neutral-800/50 border border-neutral-700">
              <h3 className="font-semibold text-white mb-2">
                No more prompt iteration
              </h3>
              <p className="text-neutral-400">
                Without patterns, you spend 20+ prompts fixing "add loading
                state", "handle errors", "make it accessible". With CodeBakers,
                your AI knows to include these from the first prompt.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-neutral-800/50 border border-neutral-700">
              <h3 className="font-semibold text-white mb-2">
                Tests come for free
              </h3>
              <p className="text-neutral-400">
                Every pattern includes Playwright tests. Your AI automatically
                generates tests for every feature it builds. No more "I'll add
                tests later" (you won't).
              </p>
            </div>
            <div className="p-6 rounded-lg bg-neutral-800/50 border border-neutral-700">
              <h3 className="font-semibold text-white mb-2">
                Consistent architecture
              </h3>
              <p className="text-neutral-400">
                All patterns follow the same conventions. Your AI builds new
                features that integrate perfectly with existing code, without
                you explaining the codebase structure.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Ready to save 10+ hours per feature?
          </h2>
          <p className="text-neutral-400 mb-8 max-w-xl mx-auto">
            At $49/month, CodeBakers pays for itself in your first hour.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-red-600 hover:bg-red-700 h-12 px-8">
              Start Saving Time
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
