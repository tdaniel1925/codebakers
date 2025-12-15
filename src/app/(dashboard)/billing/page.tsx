'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Check, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const plans = [
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    seats: 1,
    features: [
      '114 production patterns',
      'Auto-testing included',
      'Full stack coverage',
      'Auth, API, DB, payments',
      '1 seat',
    ],
    popular: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: 149,
    seats: 5,
    features: [
      'Everything in Pro',
      '5 team seats',
      'Team management',
      'Shared API keys',
      'Priority support',
    ],
    popular: false,
  },
  {
    id: 'agency',
    name: 'Agency',
    price: 349,
    seats: -1,
    features: [
      'Everything in Team',
      'Unlimited seats',
      'White-label support',
      'Custom patterns',
      'Dedicated support',
    ],
    popular: false,
  },
];

export default function BillingPage() {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [isBeta, setIsBeta] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for success/canceled query params
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription activated successfully!');
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout was canceled');
    }

    // Fetch current subscription status
    fetchSubscription();
  }, [searchParams]);

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/keys');
      if (response.ok) {
        // We'd need a dedicated endpoint for subscription info
        // For now, just check the keys response
      }
    } catch (error) {
      console.error('Failed to fetch subscription');
    }
  };

  const handleCheckout = async (planId: string) => {
    setIsLoading(planId);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start checkout';
      toast.error(message);
    } finally {
      setIsLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setIsLoading('portal');
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to open billing portal');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open billing portal';
      toast.error(message);
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Billing</h1>
        <p className="text-slate-400 mt-1">
          Manage your subscription and billing
        </p>
      </div>

      {/* Current Plan */}
      {(currentPlan || isBeta) && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Current Plan</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className="bg-green-600 text-lg px-4 py-1">
                {isBeta ? 'Beta' : currentPlan?.toUpperCase()}
              </Badge>
              {isBeta && (
                <span className="text-slate-400">Free access granted</span>
              )}
            </div>
            {!isBeta && (
              <Button
                variant="outline"
                onClick={handleManageBilling}
                disabled={isLoading === 'portal'}
                className="border-slate-600 text-slate-300"
              >
                {isLoading === 'portal' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Manage Billing
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`bg-slate-800/50 border-slate-700 relative ${
              plan.popular ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-blue-600">Most Popular</Badge>
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-white">{plan.name}</CardTitle>
              <CardDescription>
                <span className="text-3xl font-bold text-white">
                  ${plan.price}
                </span>
                <span className="text-slate-400">/month</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm text-slate-300"
                  >
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleCheckout(plan.id)}
                disabled={isLoading === plan.id || currentPlan === plan.id}
                className={`w-full ${
                  plan.popular
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                {isLoading === plan.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : currentPlan === plan.id ? (
                  'Current Plan'
                ) : (
                  'Get Started'
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FAQ */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-white">Can I cancel anytime?</h4>
            <p className="text-sm text-slate-400">
              Yes, you can cancel your subscription at any time. You'll retain
              access until the end of your billing period.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-white">
              What payment methods do you accept?
            </h4>
            <p className="text-sm text-slate-400">
              We accept all major credit cards through Stripe's secure payment
              processing.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-white">
              Can I upgrade or downgrade my plan?
            </h4>
            <p className="text-sm text-slate-400">
              Yes, you can change your plan at any time. Changes take effect
              immediately, and we'll prorate any charges.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
