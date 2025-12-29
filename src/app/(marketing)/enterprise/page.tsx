'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, Building2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const enterpriseFeatures = [
  'Everything in Agency plan',
  'Custom SLA with guaranteed uptime',
  'Dedicated account manager',
  'Custom pattern development',
  'On-premise deployment option',
  'SSO/SAML integration',
  'Invoice billing (NET 30)',
  'Priority support with SLA',
  'Custom onboarding & training',
  'Security review & compliance docs',
];

export default function EnterprisePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    teamSize: '',
    useCase: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/enterprise/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit inquiry');
      }

      setSubmitted(true);
      toast.success('Thanks! We\'ll be in touch within 24 hours.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-black py-20 px-4">
        <div className="container mx-auto max-w-2xl">
          <Card className="bg-neutral-900/80 border-neutral-800">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="w-16 h-16 rounded-full bg-green-600/20 flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Thanks for your interest!
              </h2>
              <p className="text-neutral-400 mb-8">
                We've received your inquiry and will be in touch within 24 hours
                to discuss your enterprise needs.
              </p>
              <Link href="/pricing">
                <Button variant="outline" className="border-neutral-700">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Pricing
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-20 px-4">
      <div className="container mx-auto max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="bg-red-600 mb-4">Enterprise</Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Built for scale
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            Custom solutions for large teams and organizations.
            Get dedicated support, custom SLAs, and enterprise-grade features.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Features */}
          <Card className="bg-neutral-900/80 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-red-400" />
                Enterprise Features
              </CardTitle>
              <CardDescription className="text-neutral-400">
                Everything you need for enterprise-scale development
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {enterpriseFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <span className="text-neutral-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Form */}
          <Card className="bg-neutral-900/80 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-white">Get in touch</CardTitle>
              <CardDescription className="text-neutral-400">
                Tell us about your needs and we'll create a custom plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-neutral-300">
                      Your name
                    </Label>
                    <Input
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="John Doe"
                      className="bg-black border-neutral-800 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-neutral-300">
                      Work email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="john@company.com"
                      className="bg-black border-neutral-800 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company" className="text-neutral-300">
                      Company
                    </Label>
                    <Input
                      id="company"
                      required
                      value={formData.company}
                      onChange={(e) =>
                        setFormData({ ...formData, company: e.target.value })
                      }
                      placeholder="Acme Inc."
                      className="bg-black border-neutral-800 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teamSize" className="text-neutral-300">
                      Team size
                    </Label>
                    <Input
                      id="teamSize"
                      required
                      value={formData.teamSize}
                      onChange={(e) =>
                        setFormData({ ...formData, teamSize: e.target.value })
                      }
                      placeholder="10-50 developers"
                      className="bg-black border-neutral-800 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="useCase" className="text-neutral-300">
                    Tell us about your use case
                  </Label>
                  <Textarea
                    id="useCase"
                    required
                    value={formData.useCase}
                    onChange={(e) =>
                      setFormData({ ...formData, useCase: e.target.value })
                    }
                    placeholder="What are you building? Any specific requirements?"
                    rows={4}
                    className="bg-black border-neutral-800 text-white resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Request Enterprise Demo'
                  )}
                </Button>

                <p className="text-xs text-neutral-400 text-center">
                  We typically respond within 24 hours
                </p>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Back link */}
        <div className="text-center mt-8">
          <Link
            href="/pricing"
            className="text-neutral-400 hover:text-white transition-colors"
          >
            ← Back to pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
