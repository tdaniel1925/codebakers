# FINANCIAL SERVICES EXPERTS
# Module: 23-experts-finance.md
# Load with: 00-core.md

---

## 💳 EXPERT: PCI-DSS COMPLIANCE

### Role
Ensures compliance with Payment Card Industry Data Security Standard for applications handling credit card data.

### Perspective Questions
When reviewing payment systems, ask:
1. Do we ever see/store full card numbers?
2. Is card data properly tokenized?
3. What PCI scope are we in?
4. Are logs scrubbed of card data?
5. Who has access to cardholder data?

### PCI-DSS Scope Reduction

```markdown
## PCI Scope Strategy

### Goal: SAQ-A (Minimal Scope)
To achieve the simplest compliance level:
- NEVER handle raw card numbers
- Use Stripe Elements / Payment Element
- Let Stripe handle all card data
- Your servers never see card details

### What Puts You in Higher PCI Scope:
❌ Accepting card numbers in your forms
❌ Storing any card data
❌ Card numbers in logs
❌ Card numbers in URLs
❌ Card numbers in error messages
❌ Card numbers in customer service chats

### What Keeps You SAQ-A Eligible:
✅ Stripe Elements (embedded iframe)
✅ Stripe Checkout (redirect)
✅ Apple Pay / Google Pay
✅ Tokenized payment methods only
✅ Card data goes directly to Stripe
```

### PCI-Compliant Payment Implementation

```typescript
// CORRECT: Using Stripe Elements (SAQ-A)
// Card data NEVER touches your servers

// components/payment/checkout-form.tsx
'use client';

import { useState } from 'react';
import {
  useStripe,
  useElements,
  PaymentElement,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';

export function CheckoutForm({
  clientSecret,
  onSuccess,
}: {
  clientSecret: string;
  onSuccess: (paymentIntent: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    // Stripe handles ALL card data - we never see it
    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success`,
      },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message ?? 'Payment failed');
      setIsProcessing(false);
    } else if (paymentIntent?.status === 'succeeded') {
      onSuccess(paymentIntent.id);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* PaymentElement is an iframe - card data never hits our servers */}
      <PaymentElement />
      
      {error && (
        <div className="text-red-500 text-sm mt-2" role="alert">
          {error}
        </div>
      )}
      
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full mt-4"
      >
        {isProcessing ? 'Processing...' : 'Pay Now'}
      </Button>
    </form>
  );
}

// WRONG: Accepting card numbers directly (DO NOT DO THIS)
// This puts you in SAQ-D scope (full PCI audit required)
/*
function BadCheckoutForm() {
  const [cardNumber, setCardNumber] = useState('');
  
  const handleSubmit = async () => {
    // ❌ NEVER DO THIS
    await fetch('/api/charge', {
      body: JSON.stringify({ cardNumber })
    });
  };
  
  return <input value={cardNumber} onChange={e => setCardNumber(e.target.value)} />;
}
*/
```

### PCI Logging Compliance

```typescript
// lib/logging/pci-safe-logger.ts

// Card number patterns to redact
const CARD_PATTERNS = [
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Full card number
  /\b\d{4}[\s-]?\d{6}[\s-]?\d{5}\b/g, // Amex format
  /\b\d{16}\b/g, // Continuous digits
];

// CVV patterns
const CVV_PATTERN = /\b\d{3,4}\b/g;

/**
 * Scrub potentially sensitive data from logs
 * Required for PCI compliance
 */
export function scrubCardData(data: unknown): unknown {
  if (typeof data === 'string') {
    let scrubbed = data;
    
    // Redact card numbers
    CARD_PATTERNS.forEach(pattern => {
      scrubbed = scrubbed.replace(pattern, '[CARD_REDACTED]');
    });
    
    return scrubbed;
  }
  
  if (Array.isArray(data)) {
    return data.map(scrubCardData);
  }
  
  if (data && typeof data === 'object') {
    const scrubbed: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Redact sensitive field names entirely
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('card') ||
        lowerKey.includes('cvv') ||
        lowerKey.includes('cvc') ||
        lowerKey.includes('pan') ||
        lowerKey.includes('expir')
      ) {
        scrubbed[key] = '[REDACTED]';
      } else {
        scrubbed[key] = scrubCardData(value);
      }
    }
    
    return scrubbed;
  }
  
  return data;
}

/**
 * PCI-safe logger wrapper
 */
export const pciLogger = {
  info(message: string, context?: Record<string, unknown>) {
    console.info(message, scrubCardData(context));
  },
  
  error(message: string, error?: Error, context?: Record<string, unknown>) {
    // Never log full error stack if it might contain card data
    const safeError = error ? {
      name: error.name,
      message: scrubCardData(error.message),
      // Stack traces could contain card data - be careful
    } : undefined;
    
    console.error(message, safeError, scrubCardData(context));
  },
};
```

---

## 🔍 EXPERT: KYC/AML COMPLIANCE

### Role
Ensures compliance with Know Your Customer (KYC) and Anti-Money Laundering (AML) regulations for financial applications.

### Perspective Questions
When reviewing for KYC/AML, ask:
1. What user verification is required?
2. How do we detect suspicious activity?
3. What reporting is required?
4. Are transaction limits enforced?
5. Do we have suspicious activity reports?

### KYC Implementation

```typescript
// services/kyc-service.ts

import { db } from '@/db';
import { users, kycVerifications, documents } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type KYCStatus = 
  | 'not_started'
  | 'pending_documents'
  | 'under_review'
  | 'verified'
  | 'rejected'
  | 'expired';

export type KYCTier = 
  | 'tier_0'  // Unverified - very limited
  | 'tier_1'  // Basic - email verified
  | 'tier_2'  // Standard - ID verified
  | 'tier_3'; // Enhanced - full due diligence

export interface KYCLimits {
  dailyTransactionLimit: number;
  monthlyTransactionLimit: number;
  singleTransactionLimit: number;
  withdrawalEnabled: boolean;
  internationalEnabled: boolean;
}

const KYC_TIER_LIMITS: Record<KYCTier, KYCLimits> = {
  tier_0: {
    dailyTransactionLimit: 0,
    monthlyTransactionLimit: 0,
    singleTransactionLimit: 0,
    withdrawalEnabled: false,
    internationalEnabled: false,
  },
  tier_1: {
    dailyTransactionLimit: 50000, // $500
    monthlyTransactionLimit: 200000, // $2,000
    singleTransactionLimit: 25000, // $250
    withdrawalEnabled: false,
    internationalEnabled: false,
  },
  tier_2: {
    dailyTransactionLimit: 1000000, // $10,000
    monthlyTransactionLimit: 5000000, // $50,000
    singleTransactionLimit: 500000, // $5,000
    withdrawalEnabled: true,
    internationalEnabled: false,
  },
  tier_3: {
    dailyTransactionLimit: 10000000, // $100,000
    monthlyTransactionLimit: 50000000, // $500,000
    singleTransactionLimit: 2500000, // $25,000
    withdrawalEnabled: true,
    internationalEnabled: true,
  },
};

export class KYCService {
  /**
   * Get user's current KYC status and tier
   */
  static async getUserKYCStatus(userId: string) {
    const [verification] = await db
      .select()
      .from(kycVerifications)
      .where(eq(kycVerifications.userId, userId))
      .orderBy(kycVerifications.createdAt)
      .limit(1);

    if (!verification) {
      return { status: 'not_started' as KYCStatus, tier: 'tier_0' as KYCTier };
    }

    // Check if expired (re-verification required annually for high tiers)
    if (verification.expiresAt && verification.expiresAt < new Date()) {
      return { status: 'expired' as KYCStatus, tier: 'tier_1' as KYCTier };
    }

    return {
      status: verification.status as KYCStatus,
      tier: verification.tier as KYCTier,
    };
  }

  /**
   * Get transaction limits for user
   */
  static async getUserLimits(userId: string): Promise<KYCLimits> {
    const { tier } = await this.getUserKYCStatus(userId);
    return KYC_TIER_LIMITS[tier];
  }

  /**
   * Check if transaction is allowed
   */
  static async canProcessTransaction(
    userId: string,
    amountCents: number,
    type: 'domestic' | 'international' = 'domestic'
  ): Promise<{ allowed: boolean; reason?: string }> {
    const limits = await this.getUserLimits(userId);
    
    // Check single transaction limit
    if (amountCents > limits.singleTransactionLimit) {
      return {
        allowed: false,
        reason: `Transaction exceeds single transaction limit. Please complete KYC verification for higher limits.`,
      };
    }

    // Check daily limit
    const dailyTotal = await this.getDailyTransactionTotal(userId);
    if (dailyTotal + amountCents > limits.dailyTransactionLimit) {
      return {
        allowed: false,
        reason: `Daily transaction limit reached. Upgrade KYC tier for higher limits.`,
      };
    }

    // Check monthly limit
    const monthlyTotal = await this.getMonthlyTransactionTotal(userId);
    if (monthlyTotal + amountCents > limits.monthlyTransactionLimit) {
      return {
        allowed: false,
        reason: `Monthly transaction limit reached.`,
      };
    }

    // Check international
    if (type === 'international' && !limits.internationalEnabled) {
      return {
        allowed: false,
        reason: `International transactions require enhanced verification.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Start KYC verification process
   */
  static async initiateVerification(
    userId: string,
    tier: 'tier_1' | 'tier_2' | 'tier_3'
  ) {
    // Create verification record
    const [verification] = await db
      .insert(kycVerifications)
      .values({
        userId,
        tier,
        status: 'pending_documents',
      })
      .returning();

    // For tier 2+, use identity verification provider (Stripe Identity, Onfido, etc.)
    if (tier !== 'tier_1') {
      const verificationSession = await this.createIdentitySession(userId);
      return { verification, sessionUrl: verificationSession.url };
    }

    return { verification };
  }

  /**
   * Create Stripe Identity verification session
   */
  private static async createIdentitySession(userId: string) {
    const stripe = await import('@/lib/stripe/server').then(m => m.stripe);
    
    return stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { userId },
      options: {
        document: {
          allowed_types: ['driving_license', 'passport', 'id_card'],
          require_id_number: true,
          require_matching_selfie: true,
        },
      },
    });
  }

  // ... helper methods for totals
  private static async getDailyTransactionTotal(userId: string): Promise<number> {
    // Implementation
    return 0;
  }

  private static async getMonthlyTransactionTotal(userId: string): Promise<number> {
    // Implementation
    return 0;
  }
}
```

### AML Monitoring

```typescript
// services/aml-service.ts

import { db } from '@/db';
import { transactions, amlAlerts, suspiciousActivityReports } from '@/db/schema';

interface TransactionPattern {
  userId: string;
  amountCents: number;
  type: string;
  metadata: Record<string, unknown>;
}

export class AMLService {
  /**
   * Check transaction against AML rules
   * Call this BEFORE processing any transaction
   */
  static async screenTransaction(
    tx: TransactionPattern
  ): Promise<{ approved: boolean; alerts: string[] }> {
    const alerts: string[] = [];

    // Rule 1: Structuring detection (smurfing)
    // Multiple transactions just under reporting threshold
    const recentTx = await this.getRecentTransactions(tx.userId, 24);
    const structuringDetected = this.detectStructuring(recentTx, tx);
    if (structuringDetected) {
      alerts.push('STRUCTURING_SUSPECTED');
    }

    // Rule 2: Rapid movement
    // Funds in and out quickly
    const rapidMovement = await this.detectRapidMovement(tx.userId);
    if (rapidMovement) {
      alerts.push('RAPID_MOVEMENT');
    }

    // Rule 3: Unusual patterns
    // Transactions inconsistent with profile
    const unusualPattern = await this.detectUnusualPattern(tx);
    if (unusualPattern) {
      alerts.push('UNUSUAL_PATTERN');
    }

    // Rule 4: High-risk geography
    const highRiskGeo = this.checkHighRiskGeography(tx.metadata);
    if (highRiskGeo) {
      alerts.push('HIGH_RISK_GEOGRAPHY');
    }

    // Rule 5: Sanctions screening
    const sanctionsHit = await this.screenSanctions(tx.userId);
    if (sanctionsHit) {
      alerts.push('SANCTIONS_HIT');
    }

    // Log alerts
    if (alerts.length > 0) {
      await this.createAlert(tx.userId, alerts, tx);
    }

    // Auto-block on critical alerts
    const criticalAlerts = ['SANCTIONS_HIT', 'STRUCTURING_SUSPECTED'];
    const hasCritical = alerts.some(a => criticalAlerts.includes(a));

    return {
      approved: !hasCritical,
      alerts,
    };
  }

  /**
   * Detect structuring (breaking up transactions to avoid reporting)
   */
  private static detectStructuring(
    recentTx: Array<{ amountCents: number }>,
    newTx: TransactionPattern
  ): boolean {
    const REPORTING_THRESHOLD = 1000000; // $10,000
    const STRUCTURING_THRESHOLD = 900000; // $9,000
    const MIN_SUSPICIOUS_COUNT = 3;

    // Count transactions just under threshold
    const allTx = [...recentTx, newTx];
    const suspiciousTx = allTx.filter(
      t => t.amountCents >= STRUCTURING_THRESHOLD && 
           t.amountCents < REPORTING_THRESHOLD
    );

    // Multiple transactions in the suspicious range
    if (suspiciousTx.length >= MIN_SUSPICIOUS_COUNT) {
      return true;
    }

    // Total would exceed threshold but split
    const total = allTx.reduce((sum, t) => sum + t.amountCents, 0);
    if (total > REPORTING_THRESHOLD && allTx.length > 1) {
      const avgTx = total / allTx.length;
      if (avgTx > STRUCTURING_THRESHOLD * 0.8) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create alert for compliance review
   */
  private static async createAlert(
    userId: string,
    alertTypes: string[],
    context: TransactionPattern
  ) {
    await db.insert(amlAlerts).values({
      userId,
      alertTypes,
      severity: this.calculateSeverity(alertTypes),
      status: 'pending_review',
      context,
    });

    // Notify compliance team
    await this.notifyComplianceTeam(userId, alertTypes);
  }

  /**
   * File Suspicious Activity Report (SAR)
   * Required by law for certain activities
   */
  static async fileSAR(params: {
    userId: string;
    alertId: string;
    description: string;
    amountCents: number;
    filedBy: string;
  }) {
    const [sar] = await db
      .insert(suspiciousActivityReports)
      .values({
        userId: params.userId,
        alertId: params.alertId,
        description: params.description,
        amountCents: params.amountCents,
        filedBy: params.filedBy,
        filedAt: new Date(),
        // SARs must be kept confidential - don't notify the user
      })
      .returning();

    // Submit to FinCEN (in US) or relevant authority
    // This would integrate with BSA E-Filing or similar
    
    return sar;
  }

  // ... other helper methods
  private static async getRecentTransactions(userId: string, hours: number) {
    return [];
  }

  private static async detectRapidMovement(userId: string) {
    return false;
  }

  private static async detectUnusualPattern(tx: TransactionPattern) {
    return false;
  }

  private static checkHighRiskGeography(metadata: Record<string, unknown>) {
    const HIGH_RISK_COUNTRIES = [
      'KP', 'IR', 'SY', 'CU', // Sanctioned
      // Add others based on FATF guidance
    ];
    const country = metadata.country as string;
    return HIGH_RISK_COUNTRIES.includes(country);
  }

  private static async screenSanctions(userId: string) {
    // Integrate with OFAC SDN list, UN sanctions, etc.
    return false;
  }

  private static calculateSeverity(alerts: string[]) {
    if (alerts.includes('SANCTIONS_HIT')) return 'critical';
    if (alerts.includes('STRUCTURING_SUSPECTED')) return 'high';
    return 'medium';
  }

  private static async notifyComplianceTeam(userId: string, alerts: string[]) {
    // Send to compliance queue
  }
}
```

---

## 🛡️ EXPERT: FRAUD PREVENTION

### Role
Designs and implements fraud detection and prevention systems. Focuses on balancing security with user experience.

### Perspective Questions
When reviewing for fraud, ask:
1. What fraud vectors exist?
2. How do we detect anomalies?
3. What's the false positive rate?
4. Can fraudsters learn our rules?
5. What's the appeal process?

### Fraud Detection System

```typescript
// services/fraud-service.ts

import { db } from '@/db';
import { fraudSignals, userRiskScores, blockedEntities } from '@/db/schema';

interface FraudSignal {
  signal: string;
  weight: number;
  details?: string;
}

interface RiskAssessment {
  score: number; // 0-100
  signals: FraudSignal[];
  action: 'allow' | 'challenge' | 'block';
  requiresMFA?: boolean;
  requiresReview?: boolean;
}

export class FraudService {
  /**
   * Assess risk of an action
   */
  static async assessRisk(params: {
    userId: string;
    action: 'signup' | 'login' | 'payment' | 'withdrawal' | 'password_change';
    context: {
      ip: string;
      userAgent: string;
      deviceId?: string;
      email?: string;
      amount?: number;
    };
  }): Promise<RiskAssessment> {
    const signals: FraudSignal[] = [];

    // 1. Check blocklists
    const blocked = await this.checkBlocklists(params.context);
    if (blocked) {
      signals.push({ signal: 'BLOCKLIST_HIT', weight: 100, details: blocked.type });
    }

    // 2. Device fingerprint analysis
    const deviceRisk = await this.analyzeDevice(params.context);
    signals.push(...deviceRisk);

    // 3. Velocity checks
    const velocityRisk = await this.checkVelocity(params);
    signals.push(...velocityRisk);

    // 4. Behavioral analysis
    const behaviorRisk = await this.analyzeBehavior(params);
    signals.push(...behaviorRisk);

    // 5. Email/identity signals
    if (params.context.email) {
      const emailRisk = await this.analyzeEmail(params.context.email);
      signals.push(...emailRisk);
    }

    // 6. Payment-specific checks
    if (params.action === 'payment' && params.context.amount) {
      const paymentRisk = await this.analyzePayment(params.userId, params.context.amount);
      signals.push(...paymentRisk);
    }

    // Calculate total score
    const score = Math.min(100, signals.reduce((sum, s) => sum + s.weight, 0));

    // Determine action
    let action: RiskAssessment['action'];
    let requiresMFA = false;
    let requiresReview = false;

    if (score >= 80) {
      action = 'block';
      requiresReview = true;
    } else if (score >= 50) {
      action = 'challenge';
      requiresMFA = true;
    } else {
      action = 'allow';
    }

    // Log for analysis
    await this.logAssessment(params.userId, params.action, {
      score,
      signals,
      action,
    });

    return { score, signals, action, requiresMFA, requiresReview };
  }

  /**
   * Check blocklists (IPs, emails, devices)
   */
  private static async checkBlocklists(context: {
    ip: string;
    email?: string;
    deviceId?: string;
  }) {
    const checks = [
      { type: 'ip', value: context.ip },
      { type: 'email', value: context.email },
      { type: 'device', value: context.deviceId },
    ].filter(c => c.value);

    for (const check of checks) {
      const [blocked] = await db
        .select()
        .from(blockedEntities)
        .where(
          and(
            eq(blockedEntities.type, check.type),
            eq(blockedEntities.value, check.value!)
          )
        )
        .limit(1);

      if (blocked) {
        return blocked;
      }
    }

    return null;
  }

  /**
   * Analyze device for fraud signals
   */
  private static async analyzeDevice(context: {
    ip: string;
    userAgent: string;
    deviceId?: string;
  }): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    // Check for VPN/proxy/tor
    const ipInfo = await this.getIPInfo(context.ip);
    if (ipInfo.isProxy) {
      signals.push({ signal: 'PROXY_DETECTED', weight: 20 });
    }
    if (ipInfo.isTor) {
      signals.push({ signal: 'TOR_DETECTED', weight: 30 });
    }
    if (ipInfo.isDatacenter) {
      signals.push({ signal: 'DATACENTER_IP', weight: 15 });
    }

    // Check user agent
    if (this.isSuspiciousUserAgent(context.userAgent)) {
      signals.push({ signal: 'SUSPICIOUS_UA', weight: 25 });
    }

    // Check for headless browser indicators
    // (Would be checked client-side and sent in deviceId)

    return signals;
  }

  /**
   * Check velocity (rate of actions)
   */
  private static async checkVelocity(params: {
    userId: string;
    action: string;
    context: { ip: string };
  }): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    // Actions from same IP in last hour
    const ipCount = await this.countRecentActions(params.context.ip, 'ip', 1);
    if (ipCount > 10) {
      signals.push({
        signal: 'HIGH_IP_VELOCITY',
        weight: 20,
        details: `${ipCount} actions in 1 hour`,
      });
    }

    // Failed attempts
    const failedCount = await this.countFailedAttempts(params.userId, 1);
    if (failedCount > 5) {
      signals.push({
        signal: 'MULTIPLE_FAILURES',
        weight: 25,
        details: `${failedCount} failures in 1 hour`,
      });
    }

    return signals;
  }

  /**
   * Analyze email for fraud signals
   */
  private static async analyzeEmail(email: string): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];
    const [localPart, domain] = email.split('@');

    // Disposable email domains
    const disposableDomains = ['mailinator.com', 'tempmail.com', '10minutemail.com'];
    if (disposableDomains.includes(domain.toLowerCase())) {
      signals.push({ signal: 'DISPOSABLE_EMAIL', weight: 40 });
    }

    // Recently created email pattern (contains year)
    if (/202[3-9]/.test(localPart)) {
      signals.push({ signal: 'NEW_EMAIL_PATTERN', weight: 10 });
    }

    // Random string pattern
    if (/^[a-z0-9]{10,}$/i.test(localPart)) {
      signals.push({ signal: 'RANDOM_EMAIL', weight: 15 });
    }

    return signals;
  }

  // ... helper methods
  private static async getIPInfo(ip: string) {
    // Use service like MaxMind, IPQualityScore, etc.
    return { isProxy: false, isTor: false, isDatacenter: false };
  }

  private static isSuspiciousUserAgent(ua: string) {
    const suspicious = [
      'curl', 'wget', 'python', 'bot', 'crawler',
      'headless', 'phantom', 'selenium'
    ];
    return suspicious.some(s => ua.toLowerCase().includes(s));
  }

  private static async countRecentActions(id: string, type: string, hours: number) {
    return 0;
  }

  private static async countFailedAttempts(userId: string, hours: number) {
    return 0;
  }

  private static async analyzeBehavior(params: unknown) {
    return [];
  }

  private static async analyzePayment(userId: string, amount: number) {
    return [];
  }

  private static async logAssessment(
    userId: string,
    action: string,
    result: { score: number; signals: FraudSignal[]; action: string }
  ) {
    // Log for ML training and analysis
  }
}
```

### Fraud Middleware

```typescript
// middleware/fraud-check.ts
import { NextRequest, NextResponse } from 'next/server';
import { FraudService } from '@/services/fraud-service';

export async function withFraudCheck(
  req: NextRequest,
  action: Parameters<typeof FraudService.assessRisk>[0]['action'],
  handler: () => Promise<Response>
) {
  const user = await getAuthUser();
  
  const assessment = await FraudService.assessRisk({
    userId: user?.id || 'anonymous',
    action,
    context: {
      ip: req.headers.get('x-forwarded-for') || req.ip || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      deviceId: req.headers.get('x-device-id') || undefined,
    },
  });

  if (assessment.action === 'block') {
    return NextResponse.json(
      { error: 'Request blocked for security reasons' },
      { status: 403 }
    );
  }

  if (assessment.action === 'challenge') {
    return NextResponse.json(
      {
        error: 'Additional verification required',
        challenge: assessment.requiresMFA ? 'mfa' : 'captcha',
      },
      { status: 403 }
    );
  }

  return handler();
}
```

---

## 📊 EXPERT: FINANCIAL DATA COMPLIANCE

### Role
Ensures proper handling of financial data, reporting requirements, and data retention policies.

### Financial Reporting Requirements

```markdown
## Financial Data Requirements

### Transaction Records (Keep 7+ years)
- Date and time
- Amount
- Parties involved
- Transaction type
- Status
- Fees

### Tax Reporting
- 1099-K for payment processors (>$600)
- 1099-MISC for payouts
- Annual summaries for users

### Data Retention
| Data Type | Retention Period | Reason |
|-----------|-----------------|--------|
| Transactions | 7 years | IRS requirement |
| Tax documents | 7 years | IRS requirement |
| KYC documents | 5 years after relationship ends | BSA requirement |
| SAR records | 5 years | BSA requirement |
| Account records | 5 years after closure | Regulatory |
| Audit logs | 7 years | Best practice |
```

### Financial Reporting Service

```typescript
// services/financial-reporting-service.ts

export class FinancialReportingService {
  /**
   * Generate 1099-K data for payment processor reporting
   */
  static async generate1099KData(year: number) {
    const threshold = 60000; // $600 threshold (as of 2024)
    
    const eligibleUsers = await db
      .select({
        userId: users.id,
        name: users.name,
        taxId: users.taxId,
        address: users.address,
        totalGross: sql<number>`SUM(transactions.amount_cents)`,
        transactionCount: sql<number>`COUNT(transactions.id)`,
      })
      .from(users)
      .innerJoin(transactions, eq(transactions.userId, users.id))
      .where(
        and(
          eq(transactions.type, 'payment_received'),
          eq(transactions.status, 'completed'),
          sql`EXTRACT(YEAR FROM transactions.created_at) = ${year}`
        )
      )
      .groupBy(users.id)
      .having(sql`SUM(transactions.amount_cents) >= ${threshold}`);

    return eligibleUsers.map(user => ({
      payeeId: user.userId,
      payeeName: user.name,
      payeeTIN: user.taxId,
      payeeAddress: user.address,
      grossAmount: user.totalGross,
      numberOfTransactions: user.transactionCount,
      year,
    }));
  }

  /**
   * Generate user's annual transaction summary
   */
  static async generateAnnualSummary(userId: string, year: number) {
    const transactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          sql`EXTRACT(YEAR FROM transactions.created_at) = ${year}`
        )
      )
      .orderBy(transactions.createdAt);

    // Group by month
    const byMonth = transactions.reduce((acc, tx) => {
      const month = tx.createdAt.getMonth();
      acc[month] = acc[month] || { income: 0, expenses: 0, fees: 0 };
      
      if (tx.type === 'payment_received') {
        acc[month].income += tx.amountCents;
      } else if (tx.type === 'payout') {
        acc[month].expenses += tx.amountCents;
      }
      acc[month].fees += tx.feeCents || 0;
      
      return acc;
    }, {} as Record<number, { income: number; expenses: number; fees: number }>);

    return {
      year,
      userId,
      summary: {
        totalIncome: Object.values(byMonth).reduce((s, m) => s + m.income, 0),
        totalExpenses: Object.values(byMonth).reduce((s, m) => s + m.expenses, 0),
        totalFees: Object.values(byMonth).reduce((s, m) => s + m.fees, 0),
      },
      byMonth,
      transactions,
    };
  }
}
```

---

**Module complete.** This module provides expert guidance for PCI-DSS compliance, KYC/AML requirements, fraud prevention, and financial data handling.
