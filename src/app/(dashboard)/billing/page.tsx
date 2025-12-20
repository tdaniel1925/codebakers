'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Check, CreditCard, Square, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PlanData {
  plan: string;
  name: string;
  description: string | null;
  features: string[];
  seats: number;
  priceMonthly: number;
  priceYearly: number | null;
  providers: {
    stripe: boolean;
    square: boolean;
    paypal: boolean;
  };
}

type PaymentProvider = 'stripe' | 'square' | 'paypal';

// Fallback plans if API doesn't return data
const fallbackPlans: PlanData[] = [
  {
    plan: 'pro',
    name: 'Pro',
    description: null,
    priceMonthly: 4900,
    priceYearly: null,
    seats: 1,
    features: [
      '114 production patterns',
      'Auto-testing included',
      'Full stack coverage',
      'Auth, API, DB, payments',
      '1 seat',
    ],
    providers: { stripe: true, square: true, paypal: true },
  },
  {
    plan: 'team',
    name: 'Team',
    description: null,
    priceMonthly: 14900,
    priceYearly: null,
    seats: 5,
    features: [
      'Everything in Pro',
      '5 team seats',
      'Team management',
      'Shared API keys',
      'Priority support',
    ],
    providers: { stripe: true, square: true, paypal: true },
  },
  {
    plan: 'agency',
    name: 'Agency',
    description: null,
    priceMonthly: 34900,
    priceYearly: null,
    seats: 999,
    features: [
      'Everything in Team',
      'Unlimited seats',
      'White-label support',
      'Custom patterns',
      'Dedicated support',
    ],
    providers: { stripe: true, square: true, paypal: true },
  },
];

function BillingContent() {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [isBeta, setIsBeta] = useState(false);
  const [plans, setPlans] = useState<PlanData[]>(fallbackPlans);
  const [showProviderDialog, setShowProviderDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for success/canceled query params
    const provider = searchParams.get('provider');
    if (searchParams.get('success') === 'true') {
      toast.success(`Subscription activated successfully${provider ? ` via ${provider}` : ''}!`);
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout was canceled');
    } else if (searchParams.get('error')) {
      toast.error(`Payment error: ${searchParams.get('error')}`);
    }

    // Fetch pricing from API
    fetchPricing();
    fetchSubscription();
  }, [searchParams]);

  const fetchPricing = async () => {
    try {
      const response = await fetch('/api/pricing');
      if (response.ok) {
        const data = await response.json();
        if (data.plans?.length > 0) {
          setPlans(data.plans);
        }
      }
    } catch (error) {
      console.error('Failed to fetch pricing');
    }
  };

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

  const handleSelectPlan = (planId: string) => {
    const plan = plans.find(p => p.plan === planId);
    if (!plan) return;

    // Check which providers are available
    const availableProviders = Object.entries(plan.providers)
      .filter(([, available]) => available)
      .map(([provider]) => provider);

    if (availableProviders.length === 0) {
      toast.error('No payment providers configured for this plan');
      return;
    }

    if (availableProviders.length === 1) {
      // Only one provider, go directly to checkout
      handleCheckout(planId, availableProviders[0] as PaymentProvider);
    } else {
      // Multiple providers, show selection dialog
      setSelectedPlan(planId);
      setShowProviderDialog(true);
    }
  };

  const handleCheckout = async (planId: string, provider: PaymentProvider) => {
    setIsLoading(planId);
    setShowProviderDialog(false);

    try {
      let endpoint = '/api/billing/checkout'; // Default Stripe

      if (provider === 'square') {
        endpoint = '/api/billing/square/checkout';
      } else if (provider === 'paypal') {
        endpoint = '/api/billing/paypal/checkout';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout');
      }

      const data = await response.json();

      // Square might return success directly (subscription created)
      if (data.success && data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else if (data.url) {
        // Stripe/PayPal redirect to hosted checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
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

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  const getPopularPlan = () => {
    const proPlan = plans.find(p => p.plan === 'pro');
    return proPlan?.plan || 'pro';
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
        {plans.map((plan) => {
          const isPopular = plan.plan === getPopularPlan();
          return (
            <Card
              key={plan.plan}
              className={`bg-slate-800/50 border-slate-700 relative ${
                isPopular ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-blue-600">Most Popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-white">{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-white">
                    {formatPrice(plan.priceMonthly)}
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

                {/* Payment providers indicator */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
                  <span className="text-xs text-slate-500">Pay with:</span>
                  {plan.providers.stripe && (
                    <span title="Credit Card (Stripe)">
                      <CreditCard className="h-4 w-4 text-slate-400" />
                    </span>
                  )}
                  {plan.providers.square && (
                    <span title="Square">
                      <Square className="h-4 w-4 text-slate-400" />
                    </span>
                  )}
                  {plan.providers.paypal && (
                    <span title="PayPal">
                      <Wallet className="h-4 w-4 text-slate-400" />
                    </span>
                  )}
                </div>

                <Button
                  onClick={() => handleSelectPlan(plan.plan)}
                  disabled={isLoading === plan.plan || currentPlan === plan.plan}
                  className={`w-full ${
                    isPopular
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {isLoading === plan.plan ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : currentPlan === plan.plan ? (
                    'Current Plan'
                  ) : (
                    'Get Started'
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Payment Provider Selection Dialog */}
      <Dialog open={showProviderDialog} onOpenChange={setShowProviderDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Choose Payment Method</DialogTitle>
            <DialogDescription className="text-slate-400">
              Select how you'd like to pay for your subscription
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {selectedPlan && plans.find(p => p.plan === selectedPlan)?.providers.stripe && (
              <Button
                onClick={() => handleCheckout(selectedPlan, 'stripe')}
                className="w-full bg-slate-700 hover:bg-slate-600 justify-start"
                disabled={isLoading !== null}
              >
                <CreditCard className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Credit / Debit Card</div>
                  <div className="text-xs text-slate-400">Pay with Stripe</div>
                </div>
              </Button>
            )}
            {selectedPlan && plans.find(p => p.plan === selectedPlan)?.providers.square && (
              <Button
                onClick={() => handleCheckout(selectedPlan, 'square')}
                className="w-full bg-slate-700 hover:bg-slate-600 justify-start"
                disabled={isLoading !== null}
              >
                <Square className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Square</div>
                  <div className="text-xs text-slate-400">Pay with Square</div>
                </div>
              </Button>
            )}
            {selectedPlan && plans.find(p => p.plan === selectedPlan)?.providers.paypal && (
              <Button
                onClick={() => handleCheckout(selectedPlan, 'paypal')}
                className="w-full bg-[#0070ba] hover:bg-[#005ea6] justify-start"
                disabled={isLoading !== null}
              >
                <Wallet className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">PayPal</div>
                  <div className="text-xs text-blue-200">Pay with PayPal</div>
                </div>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
              We accept credit/debit cards (via Stripe), Square, and PayPal for
              secure payment processing.
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

function BillingFallback() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Billing</h1>
        <p className="text-slate-400 mt-1">
          Manage your subscription and billing
        </p>
      </div>
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <BillingContent />
    </Suspense>
  );
}
