'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface PricingCardProps {
  name: string;
  price: number;
  description: string;
  features: string[];
  plan: 'pro' | 'team' | 'agency';
  popular?: boolean;
  isLoggedIn?: boolean;
}

export function PricingCard({
  name,
  price,
  description,
  features,
  plan,
  popular = false,
  isLoggedIn = false,
}: PricingCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCheckout = async () => {
    if (!isLoggedIn) {
      // Redirect to signup with plan in query
      router.push(`/signup?plan=${plan}`);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/billing/paypal/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        // Redirect to PayPal for payment
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Checkout failed';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`rounded-xl bg-slate-800/50 border p-8 relative flex flex-col ${
        popular ? 'border-blue-500 ring-2 ring-blue-500' : 'border-slate-700'
      }`}
    >
      {popular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600">
          Most Popular
        </Badge>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">{name}</h2>
        <p className="text-slate-400 mt-1">{description}</p>
      </div>

      <div className="mb-6">
        <span className="text-4xl font-bold text-white">${price}</span>
        <span className="text-slate-400">/month</span>
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-3">
            <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
            <span className="text-slate-300">{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        onClick={handleCheckout}
        disabled={isLoading}
        className={`w-full ${
          popular
            ? 'bg-blue-600 hover:bg-blue-700'
            : 'bg-slate-700 hover:bg-slate-600'
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            {isLoggedIn ? 'Subscribe Now' : 'Get Started'}
          </>
        )}
      </Button>

      {/* Payment methods info */}
      <p className="text-xs text-slate-500 text-center mt-4">
        Pay with credit card or PayPal
      </p>
    </div>
  );
}
