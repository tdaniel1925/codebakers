# LEGAL & COMPLIANCE EXPERTS
# Module: 24-experts-legal.md
# Load with: 00-core.md

---

## 👨‍⚖️ LEGAL ADVISOR PERSPECTIVE

When building any application that serves users, consider legal compliance from day one.
Retrofitting legal compliance is expensive and risky.

### Legal Document Requirements by App Type

```typescript
// lib/legal/requirements.ts

export const LEGAL_REQUIREMENTS = {
  // Every app needs these minimum documents
  minimum: [
    'Terms of Service',
    'Privacy Policy',
  ],
  
  // Additional based on features
  byFeature: {
    payments: ['Refund Policy', 'Billing Terms'],
    subscriptions: ['Subscription Terms', 'Cancellation Policy'],
    userContent: ['Content Policy', 'DMCA Policy'],
    marketplace: ['Marketplace Terms', 'Seller Agreement'],
    apiAccess: ['API Terms of Use', 'Developer Agreement'],
    dataProcessing: ['Data Processing Agreement (DPA)'],
    cookies: ['Cookie Policy'],
    children: ['COPPA Compliance Notice', 'Parental Consent'],
    health: ['HIPAA Notice', 'Health Disclaimer'],
    finance: ['Financial Disclaimer', 'Risk Disclosure'],
  },
  
  // Additional by jurisdiction
  byJurisdiction: {
    EU: ['GDPR Privacy Notice', 'Cookie Consent Banner'],
    California: ['CCPA Privacy Notice', 'Do Not Sell Notice'],
    international: ['Data Transfer Agreement'],
  },
};
```

### Legal Document Storage Schema

```typescript
// db/schema/legal.ts
import { pgTable, uuid, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export const legalDocuments = pgTable('legal_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(), // 'terms', 'privacy', 'cookie', etc.
  version: text('version').notNull(), // Semantic versioning
  title: text('title').notNull(),
  content: text('content').notNull(), // Markdown or HTML
  effectiveDate: timestamp('effective_date').notNull(),
  isActive: boolean('is_active').default(false),
  requiresAcceptance: boolean('requires_acceptance').default(true),
  metadata: jsonb('metadata').$type<{
    jurisdiction?: string[];
    lastReviewedBy?: string;
    lastReviewedAt?: string;
    changeLog?: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Track user acceptance of legal documents
export const legalAcceptances = pgTable('legal_acceptances', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  documentId: uuid('document_id').notNull().references(() => legalDocuments.id),
  documentType: text('document_type').notNull(),
  documentVersion: text('document_version').notNull(),
  acceptedAt: timestamp('accepted_at').defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  acceptanceMethod: text('acceptance_method').notNull(), // 'checkbox', 'click', 'implicit'
});

// Index for efficient lookups
// CREATE INDEX idx_legal_acceptances_user ON legal_acceptances(user_id, document_type);
```

---

## 📜 TERMS OF SERVICE

### Terms of Service Template Generator

```typescript
// services/legal/terms-generator.ts

interface TermsConfig {
  companyName: string;
  productName: string;
  websiteUrl: string;
  contactEmail: string;
  jurisdiction: string; // e.g., 'Delaware, USA'
  governingLaw: string; // e.g., 'State of Delaware'
  features: {
    userAccounts: boolean;
    payments: boolean;
    subscriptions: boolean;
    userContent: boolean;
    apiAccess: boolean;
    thirdPartyIntegrations: boolean;
  };
  customClauses?: string[];
}

export function generateTermsOfService(config: TermsConfig): string {
  const effectiveDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  let terms = `# Terms of Service

**Effective Date:** ${effectiveDate}

Welcome to ${config.productName}. These Terms of Service ("Terms") govern your access to and use of ${config.productName} ("Service"), provided by ${config.companyName} ("Company," "we," "us," or "our").

By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of these Terms, you may not access the Service.

## 1. Acceptance of Terms

By creating an account or using the Service, you confirm that:
- You are at least 18 years old (or the age of majority in your jurisdiction)
- You have the legal capacity to enter into a binding agreement
- You will comply with these Terms and all applicable laws

## 2. Description of Service

${config.productName} provides [DESCRIBE YOUR SERVICE]. The Service is provided "as is" and "as available" without warranties of any kind.

## 3. Changes to Terms

We reserve the right to modify these Terms at any time. We will notify you of material changes by:
- Posting the updated Terms on our website
- Sending an email to registered users
- Displaying a notice within the Service

Your continued use of the Service after changes constitutes acceptance of the new Terms.

`;

  // User Accounts section
  if (config.features.userAccounts) {
    terms += `## 4. User Accounts

### Account Creation
To access certain features, you must create an account. You agree to:
- Provide accurate, current, and complete information
- Maintain the security of your password
- Promptly update your account information
- Accept responsibility for all activities under your account

### Account Termination
We may suspend or terminate your account if you:
- Violate these Terms
- Engage in fraudulent or illegal activity
- Fail to pay applicable fees
- Remain inactive for an extended period

You may delete your account at any time through your account settings.

`;
  }

  // Payments section
  if (config.features.payments) {
    terms += `## 5. Payments and Billing

### Payment Terms
- All fees are quoted in US Dollars unless otherwise specified
- Payments are processed through our third-party payment processor
- You authorize us to charge your payment method for all fees incurred

### Taxes
You are responsible for all applicable taxes. We will collect and remit taxes where required by law.

### Refunds
Refund requests are handled according to our Refund Policy. [LINK TO REFUND POLICY]

`;
  }

  // Subscriptions section
  if (config.features.subscriptions) {
    terms += `## 6. Subscriptions

### Subscription Terms
- Subscriptions automatically renew at the end of each billing period
- You will be charged the current subscription rate at renewal
- Prices may change with 30 days' notice

### Cancellation
- You may cancel your subscription at any time
- Cancellation takes effect at the end of the current billing period
- No refunds are provided for partial billing periods

### Downgrades
If you downgrade your subscription, changes take effect at the next billing period. You retain access to higher-tier features until then.

`;
  }

  // User Content section
  if (config.features.userContent) {
    terms += `## 7. User Content

### Your Content
You retain ownership of content you submit to the Service ("User Content"). By submitting User Content, you grant us a worldwide, non-exclusive, royalty-free license to:
- Store, process, and display your content
- Create backups and archives
- Modify content for technical purposes (e.g., formatting)

### Content Standards
User Content must not:
- Violate any applicable law or regulation
- Infringe on intellectual property rights
- Contain malicious code or harmful content
- Be fraudulent, deceptive, or misleading
- Harass, abuse, or harm others

### Content Removal
We reserve the right to remove any User Content that violates these Terms. We are not obligated to monitor User Content but may do so at our discretion.

### DMCA Policy
We respond to valid DMCA takedown notices. To report copyright infringement, contact: ${config.contactEmail}

`;
  }

  // API Access section
  if (config.features.apiAccess) {
    terms += `## 8. API Access

### API Terms
API access is subject to our API Terms of Use [LINK]. Key restrictions include:
- Rate limits as specified in documentation
- Prohibition on unauthorized scraping or data extraction
- Required attribution where specified
- Compliance with all applicable laws

### API Keys
- Keep your API keys confidential
- You are responsible for all API usage under your keys
- Report compromised keys immediately

`;
  }

  // Third-party integrations
  if (config.features.thirdPartyIntegrations) {
    terms += `## 9. Third-Party Services

Our Service may integrate with third-party services. Your use of third-party services is governed by their respective terms and privacy policies. We are not responsible for:
- The availability or accuracy of third-party services
- Content or practices of third-party services
- Any damage arising from your use of third-party services

`;
  }

  // Standard sections
  terms += `## 10. Intellectual Property

### Our Property
The Service, including its original content, features, and functionality, is owned by ${config.companyName} and protected by copyright, trademark, and other intellectual property laws.

### Trademarks
${config.productName} and associated logos are trademarks of ${config.companyName}. You may not use our trademarks without prior written consent.

## 11. Prohibited Activities

You agree not to:
- Use the Service for any illegal purpose
- Violate any laws or regulations
- Infringe on intellectual property rights
- Transmit viruses or malicious code
- Attempt to gain unauthorized access
- Interfere with or disrupt the Service
- Collect user information without consent
- Impersonate others or provide false information
- Use automated systems without authorization

## 12. Disclaimer of Warranties

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
- MERCHANTABILITY
- FITNESS FOR A PARTICULAR PURPOSE
- NON-INFRINGEMENT
- ACCURACY OR COMPLETENESS

WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.

## 13. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, ${config.companyName.toUpperCase()} SHALL NOT BE LIABLE FOR:
- INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES
- LOSS OF PROFITS, DATA, USE, OR GOODWILL
- SERVICE INTERRUPTION OR COMPUTER DAMAGE

OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.

## 14. Indemnification

You agree to indemnify and hold harmless ${config.companyName}, its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from:
- Your use of the Service
- Your violation of these Terms
- Your violation of any third-party rights
- Your User Content

## 15. Governing Law

These Terms shall be governed by the laws of ${config.governingLaw}, without regard to conflict of law provisions.

## 16. Dispute Resolution

### Informal Resolution
Before filing a claim, you agree to contact us at ${config.contactEmail} and attempt to resolve the dispute informally for at least 30 days.

### Binding Arbitration
Any disputes not resolved informally shall be resolved through binding arbitration in ${config.jurisdiction} under the rules of the American Arbitration Association.

### Class Action Waiver
YOU WAIVE ANY RIGHT TO PARTICIPATE IN A CLASS ACTION LAWSUIT OR CLASS-WIDE ARBITRATION.

## 17. Severability

If any provision of these Terms is found unenforceable, the remaining provisions shall remain in effect.

## 18. Entire Agreement

These Terms constitute the entire agreement between you and ${config.companyName} regarding the Service.

## 19. Contact Information

For questions about these Terms, contact us at:
- Email: ${config.contactEmail}
- Website: ${config.websiteUrl}

`;

  // Add custom clauses
  if (config.customClauses && config.customClauses.length > 0) {
    terms += `## 20. Additional Terms\n\n`;
    config.customClauses.forEach((clause, index) => {
      terms += `### ${20}.${index + 1}\n${clause}\n\n`;
    });
  }

  return terms;
}
```

### Terms Acceptance Component

```typescript
// components/legal/terms-acceptance.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const acceptanceSchema = z.object({
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Terms of Service',
  }),
  privacyAccepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Privacy Policy',
  }),
});

type AcceptanceForm = z.infer<typeof acceptanceSchema>;

interface TermsAcceptanceProps {
  termsContent: string;
  privacyContent: string;
  onAccept: () => Promise<void>;
  isLoading?: boolean;
}

export function TermsAcceptance({
  termsContent,
  privacyContent,
  onAccept,
  isLoading,
}: TermsAcceptanceProps) {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>('terms');
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptanceForm>({
    resolver: zodResolver(acceptanceSchema),
  });
  
  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        <button
          type="button"
          className={`px-4 py-2 ${activeTab === 'terms' ? 'border-b-2 border-primary' : ''}`}
          onClick={() => setActiveTab('terms')}
        >
          Terms of Service
        </button>
        <button
          type="button"
          className={`px-4 py-2 ${activeTab === 'privacy' ? 'border-b-2 border-primary' : ''}`}
          onClick={() => setActiveTab('privacy')}
        >
          Privacy Policy
        </button>
      </div>
      
      {/* Document Content */}
      <ScrollArea className="h-[400px] rounded-md border p-4">
        <div className="prose prose-sm dark:prose-invert">
          {activeTab === 'terms' ? (
            <div dangerouslySetInnerHTML={{ __html: termsContent }} />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: privacyContent }} />
          )}
        </div>
      </ScrollArea>
      
      {/* Acceptance Form */}
      <form onSubmit={handleSubmit(() => onAccept())} className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox id="terms" {...register('termsAccepted')} />
            <label htmlFor="terms" className="text-sm">
              I have read and agree to the{' '}
              <button
                type="button"
                className="text-primary underline"
                onClick={() => setActiveTab('terms')}
              >
                Terms of Service
              </button>
            </label>
          </div>
          {errors.termsAccepted && (
            <p className="text-sm text-destructive">{errors.termsAccepted.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox id="privacy" {...register('privacyAccepted')} />
            <label htmlFor="privacy" className="text-sm">
              I have read and agree to the{' '}
              <button
                type="button"
                className="text-primary underline"
                onClick={() => setActiveTab('privacy')}
              >
                Privacy Policy
              </button>
            </label>
          </div>
          {errors.privacyAccepted && (
            <p className="text-sm text-destructive">{errors.privacyAccepted.message}</p>
          )}
        </div>
        
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Processing...' : 'Accept and Continue'}
        </Button>
      </form>
    </div>
  );
}
```

---

## 🔒 PRIVACY POLICY

### Privacy Policy Generator

```typescript
// services/legal/privacy-generator.ts

interface PrivacyConfig {
  companyName: string;
  productName: string;
  websiteUrl: string;
  contactEmail: string;
  dpoEmail?: string; // Data Protection Officer (required for GDPR)
  dataCollection: {
    personalInfo: boolean; // Name, email, etc.
    paymentInfo: boolean;
    usageData: boolean;
    deviceInfo: boolean;
    locationData: boolean;
    cookies: boolean;
    thirdPartyData: boolean;
  };
  dataUse: {
    serviceProvision: boolean;
    analytics: boolean;
    marketing: boolean;
    personalization: boolean;
    security: boolean;
  };
  dataSharing: {
    serviceProviders: boolean;
    businessPartners: boolean;
    advertising: boolean;
    legal: boolean;
    businessTransfers: boolean;
  };
  userRights: {
    access: boolean;
    correction: boolean;
    deletion: boolean;
    portability: boolean;
    optOut: boolean;
  };
  jurisdictions: ('US' | 'EU' | 'CA' | 'UK')[];
  retentionPeriod: string; // e.g., '2 years'
  childrenPolicy: 'no_children' | 'parental_consent' | 'coppa_compliant';
}

export function generatePrivacyPolicy(config: PrivacyConfig): string {
  const effectiveDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  let privacy = `# Privacy Policy

**Effective Date:** ${effectiveDate}

${config.companyName} ("Company," "we," "us," or "our") operates ${config.productName} (the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.

Please read this Privacy Policy carefully. By using the Service, you consent to the data practices described in this policy.

## 1. Information We Collect

### Personal Information
`;

  if (config.dataCollection.personalInfo) {
    privacy += `We collect personal information that you voluntarily provide, including:
- Name and contact information (email address, phone number)
- Account credentials (username, password)
- Profile information (profile picture, bio, preferences)
- Communications with us (support tickets, feedback)

`;
  }

  if (config.dataCollection.paymentInfo) {
    privacy += `### Payment Information
When you make purchases, we collect:
- Billing address
- Payment method details (processed by our payment processor)

Note: We do not store complete credit card numbers. Payment processing is handled by [Stripe/payment processor], which has its own privacy policy.

`;
  }

  if (config.dataCollection.usageData) {
    privacy += `### Usage Data
We automatically collect information about how you interact with our Service:
- Pages visited and features used
- Time spent on pages
- Click patterns and navigation paths
- Search queries within the Service
- Errors and performance data

`;
  }

  if (config.dataCollection.deviceInfo) {
    privacy += `### Device Information
We collect information about your device:
- Device type and operating system
- Browser type and version
- Screen resolution
- Time zone and language settings
- Unique device identifiers

`;
  }

  if (config.dataCollection.locationData) {
    privacy += `### Location Data
With your consent, we may collect:
- Approximate location from IP address
- Precise location (if you enable location services)

You can disable location collection through your device settings.

`;
  }

  if (config.dataCollection.cookies) {
    privacy += `### Cookies and Tracking Technologies
We use cookies and similar technologies to:
- Maintain your session and preferences
- Analyze Service usage
- Deliver targeted advertising (if applicable)

For more information, see our Cookie Policy [LINK].

`;
  }

  // How We Use Information section
  privacy += `## 2. How We Use Your Information

We use collected information for the following purposes:
`;

  if (config.dataUse.serviceProvision) {
    privacy += `
### Service Provision
- Create and manage your account
- Process transactions and send confirmations
- Provide customer support
- Deliver requested features and functionality
`;
  }

  if (config.dataUse.analytics) {
    privacy += `
### Analytics and Improvement
- Analyze usage patterns and trends
- Improve Service features and user experience
- Develop new products and features
- Conduct research and analysis
`;
  }

  if (config.dataUse.marketing) {
    privacy += `
### Marketing Communications
- Send promotional emails (with your consent)
- Display relevant advertisements
- Conduct surveys and collect feedback

You can opt out of marketing communications at any time.
`;
  }

  if (config.dataUse.personalization) {
    privacy += `
### Personalization
- Customize your experience
- Provide personalized recommendations
- Remember your preferences and settings
`;
  }

  if (config.dataUse.security) {
    privacy += `
### Security and Fraud Prevention
- Protect against unauthorized access
- Detect and prevent fraud
- Enforce our Terms of Service
- Comply with legal obligations
`;
  }

  // Data Sharing section
  privacy += `
## 3. How We Share Your Information

We may share your information in the following circumstances:
`;

  if (config.dataSharing.serviceProviders) {
    privacy += `
### Service Providers
We share information with third-party vendors who assist in operating our Service:
- Cloud hosting providers
- Payment processors
- Email service providers
- Analytics providers
- Customer support tools

These providers are contractually obligated to protect your information.
`;
  }

  if (config.dataSharing.advertising) {
    privacy += `
### Advertising Partners
We may share information with advertising partners to:
- Display targeted advertisements
- Measure advertising effectiveness
- Develop audience insights

You can opt out of personalized advertising through your account settings.
`;
  }

  if (config.dataSharing.legal) {
    privacy += `
### Legal Requirements
We may disclose information when required to:
- Comply with applicable laws or regulations
- Respond to valid legal process
- Protect our rights and property
- Ensure user safety
`;
  }

  if (config.dataSharing.businessTransfers) {
    privacy += `
### Business Transfers
In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of the transaction. We will notify you of any change in ownership or uses of your information.
`;
  }

  // Data Retention
  privacy += `
## 4. Data Retention

We retain your personal information for ${config.retentionPeriod} or as long as necessary to:
- Provide our Service
- Comply with legal obligations
- Resolve disputes
- Enforce our agreements

You may request deletion of your data at any time (see Your Rights section).

## 5. Data Security

We implement appropriate security measures to protect your information:
- Encryption of data in transit (TLS/SSL)
- Encryption of sensitive data at rest
- Regular security assessments
- Access controls and authentication
- Employee training on data protection

However, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security.
`;

  // User Rights section
  privacy += `
## 6. Your Rights

`;

  if (config.userRights.access) {
    privacy += `### Right to Access
You can request a copy of the personal information we hold about you.

`;
  }

  if (config.userRights.correction) {
    privacy += `### Right to Correction
You can request correction of inaccurate or incomplete personal information.

`;
  }

  if (config.userRights.deletion) {
    privacy += `### Right to Deletion
You can request deletion of your personal information, subject to certain exceptions.

`;
  }

  if (config.userRights.portability) {
    privacy += `### Right to Data Portability
You can request your data in a structured, machine-readable format.

`;
  }

  if (config.userRights.optOut) {
    privacy += `### Right to Opt Out
You can opt out of:
- Marketing communications
- Personalized advertising
- Sale of personal information (where applicable)

`;
  }

  privacy += `### How to Exercise Your Rights
To exercise any of these rights, contact us at: ${config.contactEmail}

We will respond to your request within 30 days (or as required by law).
`;

  // Jurisdiction-specific sections
  if (config.jurisdictions.includes('EU')) {
    privacy += `
## 7. European Union (GDPR)

If you are in the European Economic Area (EEA), you have additional rights under the General Data Protection Regulation (GDPR):

### Legal Basis for Processing
We process your data based on:
- **Consent:** Where you have given explicit consent
- **Contract:** Where processing is necessary for our contract with you
- **Legitimate Interests:** Where processing is in our legitimate business interests
- **Legal Obligation:** Where we must comply with law

### Additional Rights
- **Right to Object:** Object to processing based on legitimate interests
- **Right to Restriction:** Request restricted processing in certain circumstances
- **Right to Withdraw Consent:** Withdraw consent at any time
- **Right to Lodge a Complaint:** File a complaint with your local supervisory authority

### Data Transfers
When we transfer data outside the EEA, we use:
- Standard Contractual Clauses approved by the European Commission
- Adequacy decisions where applicable
- Other approved transfer mechanisms

### Data Protection Officer
${config.dpoEmail ? `Our Data Protection Officer can be contacted at: ${config.dpoEmail}` : 'Contact us at ' + config.contactEmail + ' for data protection inquiries.'}
`;
  }

  if (config.jurisdictions.includes('CA')) {
    privacy += `
## ${config.jurisdictions.includes('EU') ? '8' : '7'}. California Privacy Rights (CCPA/CPRA)

If you are a California resident, you have the following rights under the California Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA):

### Right to Know
You can request information about:
- Categories of personal information collected
- Specific pieces of personal information collected
- Sources of personal information
- Purposes for collection
- Categories of third parties with whom we share information

### Right to Delete
You can request deletion of personal information we have collected.

### Right to Correct
You can request correction of inaccurate personal information.

### Right to Opt Out of Sale/Sharing
You can opt out of the "sale" or "sharing" of your personal information.

### Right to Limit Use of Sensitive Information
You can limit how we use sensitive personal information.

### Non-Discrimination
We will not discriminate against you for exercising your privacy rights.

### Categories of Information Collected
In the past 12 months, we have collected the following categories:
- Identifiers (name, email, IP address)
- Commercial information (purchase history)
- Internet activity (browsing history, interactions)
- Geolocation data
- Professional information (if applicable)

### Do Not Sell My Personal Information
To opt out of the sale of your personal information, [LINK TO OPT-OUT PAGE] or contact us at ${config.contactEmail}.
`;
  }

  // Children's Privacy
  privacy += `
## ${config.jurisdictions.includes('EU') && config.jurisdictions.includes('CA') ? '9' : config.jurisdictions.includes('EU') || config.jurisdictions.includes('CA') ? '8' : '7'}. Children's Privacy

`;

  if (config.childrenPolicy === 'no_children') {
    privacy += `Our Service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately at ${config.contactEmail}.
`;
  } else if (config.childrenPolicy === 'coppa_compliant') {
    privacy += `We comply with the Children's Online Privacy Protection Act (COPPA). For users under 13:
- We require verifiable parental consent before collecting personal information
- Parents can review, delete, or refuse further collection of their child's information
- We collect only information reasonably necessary for participation
- We do not condition participation on disclosure of more information than necessary

For questions about children's privacy, contact us at ${config.contactEmail}.
`;
  }

  // Contact and Updates
  privacy += `
## Contact Us

If you have questions about this Privacy Policy, contact us at:
- Email: ${config.contactEmail}
- Website: ${config.websiteUrl}
${config.dpoEmail ? `- Data Protection Officer: ${config.dpoEmail}` : ''}

## Changes to This Privacy Policy

We may update this Privacy Policy periodically. We will notify you of material changes by:
- Posting the updated policy on our website
- Sending an email notification
- Displaying a notice in the Service

Your continued use of the Service after changes constitutes acceptance of the updated policy.
`;

  return privacy;
}
```

---

## 🍪 COOKIE CONSENT

### Cookie Consent Banner

```typescript
// components/legal/cookie-consent.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { X } from 'lucide-react';

interface CookiePreferences {
  necessary: boolean; // Always true, can't be disabled
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

const COOKIE_CONSENT_KEY = 'cookie-consent';
const COOKIE_PREFERENCES_KEY = 'cookie-preferences';

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    functional: true,
    analytics: false,
    marketing: false,
  });
  
  useEffect(() => {
    // Check if consent already given
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      setShowBanner(true);
    } else {
      // Load saved preferences
      const saved = localStorage.getItem(COOKIE_PREFERENCES_KEY);
      if (saved) {
        setPreferences(JSON.parse(saved));
      }
    }
  }, []);
  
  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(prefs));
    setPreferences(prefs);
    setShowBanner(false);
    
    // Apply preferences to tracking scripts
    applyTrackingPreferences(prefs);
  };
  
  const acceptAll = () => {
    savePreferences({
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
    });
  };
  
  const rejectNonEssential = () => {
    savePreferences({
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
    });
  };
  
  const saveCustom = () => {
    savePreferences(preferences);
  };
  
  if (!showBanner) return null;
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg">
      <div className="container mx-auto p-4">
        {!showDetails ? (
          // Simple banner
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm">
              <p>
                We use cookies to enhance your experience. By continuing to visit this site,
                you agree to our use of cookies.{' '}
                <button
                  onClick={() => setShowDetails(true)}
                  className="text-primary underline"
                >
                  Customize
                </button>
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={rejectNonEssential}>
                Reject Non-Essential
              </Button>
              <Button onClick={acceptAll}>
                Accept All
              </Button>
            </div>
          </div>
        ) : (
          // Detailed preferences
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Cookie Preferences</h3>
              <button onClick={() => setShowDetails(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <CookieCategory
                title="Necessary Cookies"
                description="Required for the website to function. Cannot be disabled."
                checked={true}
                disabled={true}
              />
              <CookieCategory
                title="Functional Cookies"
                description="Enable enhanced functionality and personalization."
                checked={preferences.functional}
                onChange={(checked) =>
                  setPreferences((p) => ({ ...p, functional: checked }))
                }
              />
              <CookieCategory
                title="Analytics Cookies"
                description="Help us understand how visitors interact with our website."
                checked={preferences.analytics}
                onChange={(checked) =>
                  setPreferences((p) => ({ ...p, analytics: checked }))
                }
              />
              <CookieCategory
                title="Marketing Cookies"
                description="Used to deliver personalized advertisements."
                checked={preferences.marketing}
                onChange={(checked) =>
                  setPreferences((p) => ({ ...p, marketing: checked }))
                }
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={rejectNonEssential}>
                Reject All
              </Button>
              <Button onClick={saveCustom}>
                Save Preferences
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface CookieCategoryProps {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

function CookieCategory({
  title,
  description,
  checked,
  disabled,
  onChange,
}: CookieCategoryProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}

// Apply preferences to tracking scripts
function applyTrackingPreferences(prefs: CookiePreferences) {
  // Google Analytics
  if (prefs.analytics) {
    // Enable GA
    window.gtag?.('consent', 'update', {
      analytics_storage: 'granted',
    });
  } else {
    // Disable GA
    window.gtag?.('consent', 'update', {
      analytics_storage: 'denied',
    });
  }
  
  // Marketing/Ads
  if (prefs.marketing) {
    window.gtag?.('consent', 'update', {
      ad_storage: 'granted',
      ad_personalization: 'granted',
    });
  } else {
    window.gtag?.('consent', 'update', {
      ad_storage: 'denied',
      ad_personalization: 'denied',
    });
  }
}
```

### Google Analytics with Consent Mode

```typescript
// components/analytics/google-analytics.tsx
'use client';

import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export function GoogleAnalytics() {
  if (!GA_ID) return null;
  
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          
          // Default to denied - update based on consent
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_personalization: 'denied',
            wait_for_update: 500
          });
          
          gtag('config', '${GA_ID}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}
```

---

## 🇪🇺 GDPR COMPLIANCE

### GDPR Data Subject Requests

```typescript
// services/legal/gdpr-service.ts
import { db } from '@/db';
import { users, userProfiles, userActivities, legalAcceptances } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import { randomUUID } from 'crypto';

export class GDPRService {
  /**
   * Handle Data Access Request (Article 15)
   * Returns all personal data for a user
   */
  static async handleAccessRequest(userId: string): Promise<{
    requestId: string;
    downloadUrl: string;
    expiresAt: Date;
  }> {
    // Collect all user data
    const userData = await this.collectUserData(userId);
    
    // Generate export file
    const requestId = randomUUID();
    const filename = `data-export-${requestId}.zip`;
    const filePath = `/tmp/${filename}`;
    
    await this.createDataExport(userData, filePath);
    
    // Upload to secure storage and get signed URL
    const downloadUrl = await this.uploadAndGetSignedUrl(filePath, filename);
    
    // Set expiration (30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    // Log the request
    await this.logGDPRRequest(userId, 'access', requestId);
    
    return { requestId, downloadUrl, expiresAt };
  }
  
  /**
   * Handle Data Portability Request (Article 20)
   * Returns data in machine-readable format
   */
  static async handlePortabilityRequest(userId: string): Promise<{
    requestId: string;
    downloadUrl: string;
    format: 'json';
  }> {
    const userData = await this.collectUserData(userId);
    
    const requestId = randomUUID();
    const filename = `data-portability-${requestId}.json`;
    
    // Create JSON export
    const jsonData = JSON.stringify(userData, null, 2);
    const downloadUrl = await this.uploadJsonAndGetSignedUrl(jsonData, filename);
    
    await this.logGDPRRequest(userId, 'portability', requestId);
    
    return { requestId, downloadUrl, format: 'json' };
  }
  
  /**
   * Handle Erasure Request (Article 17 - Right to be Forgotten)
   */
  static async handleErasureRequest(userId: string): Promise<{
    requestId: string;
    status: 'pending' | 'completed' | 'partial';
    exceptions?: string[];
  }> {
    const requestId = randomUUID();
    const exceptions: string[] = [];
    
    // Check for legal obligations that prevent deletion
    const hasActiveSubscription = await this.checkActiveSubscription(userId);
    if (hasActiveSubscription) {
      exceptions.push('Active subscription - billing records retained for legal compliance');
    }
    
    const hasLegalHold = await this.checkLegalHold(userId);
    if (hasLegalHold) {
      exceptions.push('Legal hold - data retained per legal requirement');
    }
    
    // Perform deletion
    await db.transaction(async (tx) => {
      // Delete non-essential data immediately
      await tx.delete(userActivities).where(eq(userActivities.userId, userId));
      
      // Anonymize rather than delete if exceptions exist
      if (exceptions.length > 0) {
        await tx
          .update(users)
          .set({
            email: `deleted-${userId}@anonymized.local`,
            name: 'Deleted User',
            // Keep ID for reference but remove PII
          })
          .where(eq(users.id, userId));
      } else {
        // Full deletion
        await tx.delete(legalAcceptances).where(eq(legalAcceptances.userId, userId));
        await tx.delete(userProfiles).where(eq(userProfiles.userId, userId));
        await tx.delete(users).where(eq(users.id, userId));
      }
    });
    
    await this.logGDPRRequest(userId, 'erasure', requestId);
    
    return {
      requestId,
      status: exceptions.length > 0 ? 'partial' : 'completed',
      exceptions: exceptions.length > 0 ? exceptions : undefined,
    };
  }
  
  /**
   * Handle Rectification Request (Article 16)
   */
  static async handleRectificationRequest(
    userId: string,
    corrections: Record<string, unknown>
  ): Promise<{ requestId: string; updatedFields: string[] }> {
    const requestId = randomUUID();
    const updatedFields: string[] = [];
    
    // Validate and apply corrections
    const allowedFields = ['name', 'email', 'phone', 'address'];
    
    for (const [field, value] of Object.entries(corrections)) {
      if (allowedFields.includes(field)) {
        await db
          .update(users)
          .set({ [field]: value })
          .where(eq(users.id, userId));
        updatedFields.push(field);
      }
    }
    
    await this.logGDPRRequest(userId, 'rectification', requestId);
    
    return { requestId, updatedFields };
  }
  
  /**
   * Handle Restriction Request (Article 18)
   */
  static async handleRestrictionRequest(
    userId: string,
    processingTypes: string[]
  ): Promise<{ requestId: string; restrictedProcessing: string[] }> {
    const requestId = randomUUID();
    
    // Store restriction preferences
    await db
      .update(users)
      .set({
        processingRestrictions: processingTypes,
        restrictionDate: new Date(),
      })
      .where(eq(users.id, userId));
    
    await this.logGDPRRequest(userId, 'restriction', requestId);
    
    return { requestId, restrictedProcessing: processingTypes };
  }
  
  /**
   * Check consent before processing
   */
  static async hasValidConsent(
    userId: string,
    processingPurpose: string
  ): Promise<boolean> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!user) return false;
    
    // Check for restrictions
    if (user.processingRestrictions?.includes(processingPurpose)) {
      return false;
    }
    
    // Check for valid consent
    const consentRecord = await db
      .select()
      .from(legalAcceptances)
      .where(eq(legalAcceptances.userId, userId))
      .limit(1);
    
    return consentRecord.length > 0;
  }
  
  // Helper methods
  private static async collectUserData(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    const activities = await db.select().from(userActivities).where(eq(userActivities.userId, userId));
    const acceptances = await db.select().from(legalAcceptances).where(eq(legalAcceptances.userId, userId));
    
    return {
      personalInformation: user,
      profile,
      activityLog: activities,
      legalAcceptances: acceptances,
      exportedAt: new Date().toISOString(),
    };
  }
  
  private static async createDataExport(data: unknown, filePath: string) {
    return new Promise<void>((resolve, reject) => {
      const output = createWriteStream(filePath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      output.on('close', resolve);
      archive.on('error', reject);
      
      archive.pipe(output);
      archive.append(JSON.stringify(data, null, 2), { name: 'user-data.json' });
      archive.finalize();
    });
  }
  
  private static async uploadAndGetSignedUrl(filePath: string, filename: string): Promise<string> {
    // Implementation depends on your storage provider
    // Return signed URL with expiration
    return `https://storage.example.com/gdpr-exports/${filename}?token=xxx`;
  }
  
  private static async uploadJsonAndGetSignedUrl(data: string, filename: string): Promise<string> {
    return `https://storage.example.com/gdpr-exports/${filename}?token=xxx`;
  }
  
  private static async checkActiveSubscription(userId: string): Promise<boolean> {
    // Check if user has active subscription requiring retention
    return false;
  }
  
  private static async checkLegalHold(userId: string): Promise<boolean> {
    // Check if user data is under legal hold
    return false;
  }
  
  private static async logGDPRRequest(
    userId: string,
    type: string,
    requestId: string
  ): Promise<void> {
    // Log for audit trail
    console.log(`GDPR ${type} request: ${requestId} for user: ${userId}`);
  }
}
```

### GDPR Request API Routes

```typescript
// app/api/privacy/data-request/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { GDPRService } from '@/services/legal/gdpr-service';

const requestSchema = z.object({
  type: z.enum(['access', 'portability', 'erasure', 'rectification', 'restriction']),
  corrections: z.record(z.unknown()).optional(),
  restrictedProcessing: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const body = await req.json();
  const { type, corrections, restrictedProcessing } = requestSchema.parse(body);
  
  try {
    switch (type) {
      case 'access':
        const accessResult = await GDPRService.handleAccessRequest(session.user.id);
        return NextResponse.json(accessResult);
        
      case 'portability':
        const portabilityResult = await GDPRService.handlePortabilityRequest(session.user.id);
        return NextResponse.json(portabilityResult);
        
      case 'erasure':
        const erasureResult = await GDPRService.handleErasureRequest(session.user.id);
        return NextResponse.json(erasureResult);
        
      case 'rectification':
        if (!corrections) {
          return NextResponse.json({ error: 'Corrections required' }, { status: 400 });
        }
        const rectificationResult = await GDPRService.handleRectificationRequest(
          session.user.id,
          corrections
        );
        return NextResponse.json(rectificationResult);
        
      case 'restriction':
        if (!restrictedProcessing) {
          return NextResponse.json({ error: 'Processing types required' }, { status: 400 });
        }
        const restrictionResult = await GDPRService.handleRestrictionRequest(
          session.user.id,
          restrictedProcessing
        );
        return NextResponse.json(restrictionResult);
    }
  } catch (error) {
    console.error('GDPR request error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
```

---

## 🇺🇸 CCPA/CPRA COMPLIANCE

### CCPA Service

```typescript
// services/legal/ccpa-service.ts
import { db } from '@/db';
import { users, dataSaleOptOuts } from '@/db/schema';
import { eq } from 'drizzle-orm';

export class CCPAService {
  /**
   * Handle "Do Not Sell My Personal Information" request
   */
  static async optOutOfSale(userId: string): Promise<{
    success: boolean;
    effectiveDate: Date;
  }> {
    const effectiveDate = new Date();
    
    await db.insert(dataSaleOptOuts).values({
      userId,
      optOutDate: effectiveDate,
      source: 'user_request',
    });
    
    // Update user preferences
    await db
      .update(users)
      .set({
        doNotSell: true,
        doNotSellDate: effectiveDate,
      })
      .where(eq(users.id, userId));
    
    // Notify data brokers/partners (implementation specific)
    await this.notifyPartnersOfOptOut(userId);
    
    return { success: true, effectiveDate };
  }
  
  /**
   * Handle "Right to Know" request
   * Returns categories and specific pieces of PI collected
   */
  static async handleKnowRequest(userId: string): Promise<{
    categories: string[];
    sources: string[];
    purposes: string[];
    thirdParties: string[];
    specificPieces: Record<string, unknown>;
  }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    return {
      categories: [
        'Identifiers (name, email, IP address)',
        'Commercial information (purchase history)',
        'Internet activity (browsing history, interactions)',
        'Geolocation data',
      ],
      sources: [
        'Directly from you',
        'Automatically collected',
        'Third-party analytics providers',
      ],
      purposes: [
        'Providing our services',
        'Improving our services',
        'Marketing communications',
        'Security and fraud prevention',
      ],
      thirdParties: [
        'Cloud service providers',
        'Payment processors',
        'Analytics providers',
        'Marketing partners',
      ],
      specificPieces: {
        name: user?.name,
        email: user?.email,
        accountCreated: user?.createdAt,
        // Add other fields as applicable
      },
    };
  }
  
  /**
   * Handle "Right to Delete" request
   */
  static async handleDeleteRequest(userId: string): Promise<{
    deleted: boolean;
    exceptions: string[];
    completionDate: Date;
  }> {
    const exceptions: string[] = [];
    
    // Check for exceptions under CCPA
    // - Complete transaction
    // - Security purposes
    // - Legal obligations
    // - Internal uses aligned with consumer expectations
    
    const hasLegalRetention = await this.checkLegalRetentionRequired(userId);
    if (hasLegalRetention) {
      exceptions.push('Certain records retained for legal compliance (7 years)');
    }
    
    // Process deletion with exceptions noted
    await this.deleteUserData(userId, exceptions);
    
    return {
      deleted: true,
      exceptions,
      completionDate: new Date(),
    };
  }
  
  /**
   * Generate Privacy Notice disclosures for CCPA
   */
  static getPrivacyNoticeDisclosures() {
    return {
      categoriesCollected: [
        {
          category: 'Identifiers',
          examples: 'Real name, email address, IP address',
          collected: true,
          sold: false,
          disclosed: true,
        },
        {
          category: 'Commercial Information',
          examples: 'Products purchased, purchasing history',
          collected: true,
          sold: false,
          disclosed: true,
        },
        {
          category: 'Internet Activity',
          examples: 'Browsing history, interactions with website',
          collected: true,
          sold: false,
          disclosed: true,
        },
        {
          category: 'Geolocation',
          examples: 'Approximate location from IP',
          collected: true,
          sold: false,
          disclosed: false,
        },
        // Add more categories as needed
      ],
      financialIncentives: [], // Describe any financial incentives for data collection
      retentionPeriods: {
        accountData: '2 years after account deletion',
        transactionData: '7 years (legal requirement)',
        analyticsData: '26 months',
      },
    };
  }
  
  private static async notifyPartnersOfOptOut(userId: string): Promise<void> {
    // Implement partner notification
  }
  
  private static async checkLegalRetentionRequired(userId: string): Promise<boolean> {
    // Check if legal retention applies
    return false;
  }
  
  private static async deleteUserData(userId: string, exceptions: string[]): Promise<void> {
    // Implement deletion logic
  }
}
```

### CCPA "Do Not Sell" Page

```typescript
// app/(marketing)/do-not-sell/page.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle } from 'lucide-react';

const optOutSchema = z.object({
  email: z.string().email('Valid email required'),
  firstName: z.string().min(1, 'First name required'),
  lastName: z.string().min(1, 'Last name required'),
  state: z.string().min(2, 'State required'),
});

type OptOutForm = z.infer<typeof optOutSchema>;

export default function DoNotSellPage() {
  const [submitted, setSubmitted] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OptOutForm>({
    resolver: zodResolver(optOutSchema),
  });
  
  const onSubmit = async (data: OptOutForm) => {
    await fetch('/api/privacy/do-not-sell', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setSubmitted(true);
  };
  
  if (submitted) {
    return (
      <div className="container max-w-2xl mx-auto py-16 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Request Received</h1>
        <p className="text-muted-foreground">
          We have received your request to opt out of the sale of your personal
          information. We will process your request within 15 business days.
        </p>
      </div>
    );
  }
  
  return (
    <div className="container max-w-2xl mx-auto py-16">
      <h1 className="text-3xl font-bold mb-4">
        Do Not Sell or Share My Personal Information
      </h1>
      
      <div className="prose prose-sm dark:prose-invert mb-8">
        <p>
          Under the California Consumer Privacy Act (CCPA) and California Privacy
          Rights Act (CPRA), California residents have the right to opt out of the
          "sale" or "sharing" of their personal information.
        </p>
        <p>
          While we do not sell personal information in the traditional sense, certain
          data sharing activities (such as sharing data with advertising partners) may
          constitute a "sale" or "sharing" under California law.
        </p>
        <p>
          Complete the form below to opt out of these activities. We will process your
          request within 15 business days.
        </p>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">First Name</label>
            <Input {...register('firstName')} />
            {errors.firstName && (
              <p className="text-sm text-destructive">{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Last Name</label>
            <Input {...register('lastName')} />
            {errors.lastName && (
              <p className="text-sm text-destructive">{errors.lastName.message}</p>
            )}
          </div>
        </div>
        
        <div>
          <label className="text-sm font-medium">Email Address</label>
          <Input type="email" {...register('email')} />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>
        
        <div>
          <label className="text-sm font-medium">State of Residence</label>
          <Input {...register('state')} placeholder="e.g., California" />
          {errors.state && (
            <p className="text-sm text-destructive">{errors.state.message}</p>
          )}
        </div>
        
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Opt-Out Request'}
        </Button>
      </form>
    </div>
  );
}
```

---

## 📋 DATA PROCESSING AGREEMENT (DPA)

### DPA Template for B2B

```typescript
// services/legal/dpa-generator.ts

interface DPAConfig {
  processorName: string; // Your company
  controllerName: string; // Customer company
  services: string; // Description of services
  dataCategories: string[]; // Types of data processed
  dataSubjects: string[]; // Whose data (employees, customers, etc.)
  processingPurposes: string[];
  subProcessors: Array<{ name: string; location: string; purpose: string }>;
  dataRetention: string;
  securityMeasures: string[];
}

export function generateDPA(config: DPAConfig): string {
  return `# DATA PROCESSING AGREEMENT

This Data Processing Agreement ("DPA") forms part of the Agreement between:

**Data Controller:** ${config.controllerName} ("Controller")
**Data Processor:** ${config.processorName} ("Processor")

## 1. DEFINITIONS

- "Personal Data" means any information relating to an identified or identifiable natural person.
- "Processing" means any operation performed on Personal Data.
- "Data Subject" means the individual to whom Personal Data relates.
- "Sub-processor" means any third party engaged by Processor to process Personal Data.

## 2. SCOPE AND PURPOSE

### 2.1 Services
Processor will process Personal Data on behalf of Controller in connection with: ${config.services}

### 2.2 Categories of Data
${config.dataCategories.map((cat) => `- ${cat}`).join('\n')}

### 2.3 Data Subjects
${config.dataSubjects.map((sub) => `- ${sub}`).join('\n')}

### 2.4 Processing Purposes
${config.processingPurposes.map((purpose) => `- ${purpose}`).join('\n')}

## 3. PROCESSOR OBLIGATIONS

### 3.1 Compliance
Processor shall:
- Process Personal Data only on documented instructions from Controller
- Ensure personnel are bound by confidentiality obligations
- Implement appropriate security measures
- Assist Controller in responding to Data Subject requests
- Delete or return all Personal Data upon termination

### 3.2 Security Measures
Processor implements the following security measures:
${config.securityMeasures.map((measure) => `- ${measure}`).join('\n')}

## 4. SUB-PROCESSORS

### 4.1 Approved Sub-processors
Controller authorizes the use of the following sub-processors:

| Name | Location | Purpose |
|------|----------|---------|
${config.subProcessors.map((sp) => `| ${sp.name} | ${sp.location} | ${sp.purpose} |`).join('\n')}

### 4.2 New Sub-processors
Processor shall notify Controller at least 30 days before engaging any new sub-processor. Controller may object within 14 days.

## 5. DATA SUBJECT RIGHTS

Processor shall assist Controller in responding to requests from Data Subjects to exercise their rights, including:
- Access to Personal Data
- Correction of inaccurate data
- Deletion of Personal Data
- Data portability
- Restriction of processing
- Objection to processing

## 6. DATA BREACH NOTIFICATION

Processor shall notify Controller without undue delay (within 72 hours) after becoming aware of a Personal Data breach. Notification shall include:
- Nature of the breach
- Categories and approximate number of Data Subjects affected
- Likely consequences
- Measures taken to address the breach

## 7. DATA RETENTION

Personal Data shall be retained for: ${config.dataRetention}

Upon termination or expiration of the Agreement, Processor shall delete or return all Personal Data within 30 days.

## 8. INTERNATIONAL TRANSFERS

Where Personal Data is transferred outside the EEA, Processor shall ensure appropriate safeguards through:
- Standard Contractual Clauses
- Binding Corporate Rules
- Adequacy decisions
- Other approved mechanisms

## 9. AUDIT RIGHTS

Controller may audit Processor's compliance with this DPA:
- Upon reasonable notice (minimum 30 days)
- During business hours
- No more than once per year (unless required by law or following a breach)

## 10. LIABILITY

Each party's liability under this DPA shall be subject to the limitations set forth in the Agreement.

## 11. TERM

This DPA shall remain in effect for the duration of the Agreement and until all Personal Data has been deleted or returned.

---

**SIGNATURES**

For Controller: _________________________ Date: _________

For Processor: _________________________ Date: _________
`;
}
```

---

## 👶 COPPA COMPLIANCE (Children's Privacy)

### Age Verification Gate

```typescript
// components/legal/age-gate.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { differenceInYears, parse, isValid } from 'date-fns';

interface AgeGateProps {
  minimumAge: number;
  onVerified: (isAdult: boolean) => void;
  requireParentalConsent?: boolean;
}

export function AgeGate({
  minimumAge = 13,
  onVerified,
  requireParentalConsent,
}: AgeGateProps) {
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState('');
  const [showParentalConsent, setShowParentalConsent] = useState(false);
  
  const handleVerify = () => {
    const parsed = parse(birthDate, 'MM/dd/yyyy', new Date());
    
    if (!isValid(parsed)) {
      setError('Please enter a valid date (MM/DD/YYYY)');
      return;
    }
    
    const age = differenceInYears(new Date(), parsed);
    
    if (age < minimumAge) {
      if (requireParentalConsent) {
        setShowParentalConsent(true);
      } else {
        setError(`You must be at least ${minimumAge} years old to use this service.`);
        onVerified(false);
      }
    } else {
      onVerified(true);
    }
  };
  
  if (showParentalConsent) {
    return <ParentalConsentForm onComplete={() => onVerified(true)} />;
  }
  
  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h2 className="text-xl font-bold">Age Verification</h2>
      <p className="text-muted-foreground">
        Please enter your date of birth to continue.
      </p>
      
      <div>
        <label className="text-sm font-medium">Date of Birth</label>
        <Input
          type="text"
          placeholder="MM/DD/YYYY"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
        {error && <p className="text-sm text-destructive mt-1">{error}</p>}
      </div>
      
      <Button onClick={handleVerify} className="w-full">
        Continue
      </Button>
    </div>
  );
}

// Parental Consent Form for COPPA
function ParentalConsentForm({ onComplete }: { onComplete: () => void }) {
  const [parentEmail, setParentEmail] = useState('');
  const [consentSent, setConsentSent] = useState(false);
  
  const sendConsentRequest = async () => {
    await fetch('/api/parental-consent/request', {
      method: 'POST',
      body: JSON.stringify({ parentEmail }),
    });
    setConsentSent(true);
  };
  
  if (consentSent) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <h2 className="text-xl font-bold mb-2">Check Your Parent's Email</h2>
        <p className="text-muted-foreground">
          We've sent a consent request to {parentEmail}. Ask your parent or
          guardian to check their email and approve your account.
        </p>
      </div>
    );
  }
  
  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h2 className="text-xl font-bold">Parental Consent Required</h2>
      <p className="text-muted-foreground">
        Since you're under 13, we need your parent or guardian's permission
        before you can create an account.
      </p>
      
      <div>
        <label className="text-sm font-medium">Parent/Guardian Email</label>
        <Input
          type="email"
          value={parentEmail}
          onChange={(e) => setParentEmail(e.target.value)}
          placeholder="parent@example.com"
        />
      </div>
      
      <Button onClick={sendConsentRequest} className="w-full">
        Send Consent Request
      </Button>
    </div>
  );
}
```

### COPPA Parental Consent Service

```typescript
// services/legal/coppa-service.ts
import { db } from '@/db';
import { parentalConsents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';
import { randomBytes } from 'crypto';

export class COPPAService {
  /**
   * Request parental consent for child user
   */
  static async requestParentalConsent(
    childUserId: string,
    parentEmail: string
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days to respond
    
    await db.insert(parentalConsents).values({
      childUserId,
      parentEmail,
      consentToken: token,
      tokenExpiresAt: expiresAt,
      status: 'pending',
    });
    
    // Send consent email
    await sendEmail({
      to: parentEmail,
      subject: 'Parental Consent Required',
      template: 'parental-consent',
      data: {
        consentUrl: `${process.env.APP_URL}/parental-consent?token=${token}`,
        childUsername: 'Your child', // Or actual username
        expiresAt: expiresAt.toLocaleDateString(),
      },
    });
    
    return { token, expiresAt };
  }
  
  /**
   * Verify and complete parental consent
   */
  static async completeConsent(
    token: string,
    parentInfo: {
      name: string;
      relationship: string;
      verificationMethod: 'credit_card' | 'phone' | 'id_upload';
    }
  ): Promise<{ success: boolean; childUserId?: string }> {
    const [consent] = await db
      .select()
      .from(parentalConsents)
      .where(eq(parentalConsents.consentToken, token))
      .limit(1);
    
    if (!consent || consent.status !== 'pending') {
      return { success: false };
    }
    
    if (new Date() > consent.tokenExpiresAt) {
      return { success: false };
    }
    
    // Update consent record
    await db
      .update(parentalConsents)
      .set({
        status: 'granted',
        parentName: parentInfo.name,
        parentRelationship: parentInfo.relationship,
        verificationMethod: parentInfo.verificationMethod,
        consentDate: new Date(),
      })
      .where(eq(parentalConsents.id, consent.id));
    
    return { success: true, childUserId: consent.childUserId };
  }
  
  /**
   * Revoke parental consent
   */
  static async revokeConsent(childUserId: string): Promise<void> {
    await db
      .update(parentalConsents)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
      })
      .where(eq(parentalConsents.childUserId, childUserId));
    
    // Disable child account and delete collected data
    await this.disableChildAccount(childUserId);
  }
  
  /**
   * Check if user has valid parental consent
   */
  static async hasValidConsent(userId: string): Promise<boolean> {
    const [consent] = await db
      .select()
      .from(parentalConsents)
      .where(eq(parentalConsents.childUserId, userId))
      .limit(1);
    
    return consent?.status === 'granted';
  }
  
  private static async disableChildAccount(userId: string): Promise<void> {
    // Implementation to disable account and delete PII
  }
}
```

---

## ⚖️ LEGAL COMPLIANCE CHECKLIST

### Pre-Launch Legal Checklist

```typescript
// lib/legal/compliance-checklist.ts

export const LEGAL_COMPLIANCE_CHECKLIST = {
  essential: [
    {
      item: 'Terms of Service published and accessible',
      priority: 'critical',
      notes: 'Link in footer, registration flow',
    },
    {
      item: 'Privacy Policy published and accessible',
      priority: 'critical',
      notes: 'Link in footer, registration flow',
    },
    {
      item: 'User consent captured at registration',
      priority: 'critical',
      notes: 'Checkbox with links to ToS and Privacy',
    },
    {
      item: 'Consent records stored with timestamps',
      priority: 'critical',
      notes: 'legal_acceptances table populated',
    },
  ],
  
  payments: [
    {
      item: 'Refund Policy published',
      priority: 'high',
      notes: 'Clear refund terms, linked from checkout',
    },
    {
      item: 'Subscription auto-renewal disclosed',
      priority: 'high',
      notes: 'Clear disclosure before checkout',
    },
    {
      item: 'PCI compliance (SAQ-A if using Stripe Elements)',
      priority: 'critical',
      notes: 'Never handle card data directly',
    },
    {
      item: 'Price changes notification process',
      priority: 'medium',
      notes: '30-day notice for existing subscribers',
    },
  ],
  
  gdpr: [
    {
      item: 'Cookie consent banner implemented',
      priority: 'critical',
      notes: 'Required before setting non-essential cookies',
    },
    {
      item: 'Data access request process',
      priority: 'high',
      notes: 'Respond within 30 days',
    },
    {
      item: 'Data deletion request process',
      priority: 'high',
      notes: 'Respond within 30 days',
    },
    {
      item: 'Data portability available',
      priority: 'high',
      notes: 'Export in machine-readable format',
    },
    {
      item: 'DPO designated (if required)',
      priority: 'medium',
      notes: 'Required for large-scale processing',
    },
    {
      item: 'Sub-processor list maintained',
      priority: 'medium',
      notes: 'List all third parties processing data',
    },
  ],
  
  ccpa: [
    {
      item: '"Do Not Sell" link in footer',
      priority: 'critical',
      notes: 'Required for California residents',
    },
    {
      item: 'Privacy notice includes CCPA disclosures',
      priority: 'high',
      notes: 'Categories collected, sold, disclosed',
    },
    {
      item: 'Opt-out process functional',
      priority: 'high',
      notes: 'Process requests within 15 business days',
    },
  ],
  
  children: [
    {
      item: 'Age verification implemented',
      priority: 'critical',
      notes: 'If service may attract children',
    },
    {
      item: 'Parental consent flow (if under 13 allowed)',
      priority: 'critical',
      notes: 'Verifiable parental consent required',
    },
    {
      item: 'COPPA-compliant privacy notice',
      priority: 'high',
      notes: 'Special disclosures for children',
    },
  ],
  
  accessibility: [
    {
      item: 'Accessibility statement published',
      priority: 'medium',
      notes: 'Describe conformance level and known issues',
    },
    {
      item: 'WCAG 2.1 AA compliance verified',
      priority: 'high',
      notes: 'Run automated and manual tests',
    },
  ],
};
```

---

## 📚 LEGAL DOCUMENT VERSION CONTROL

### Document Versioning Service

```typescript
// services/legal/document-versioning.ts
import { db } from '@/db';
import { legalDocuments, legalAcceptances } from '@/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';

export class LegalDocumentService {
  /**
   * Publish new version of a legal document
   */
  static async publishNewVersion(
    type: string,
    version: string,
    content: string,
    effectiveDate: Date,
    changeLog: string
  ): Promise<void> {
    // Deactivate previous version
    await db
      .update(legalDocuments)
      .set({ isActive: false })
      .where(and(
        eq(legalDocuments.type, type),
        eq(legalDocuments.isActive, true)
      ));
    
    // Insert new version
    await db.insert(legalDocuments).values({
      type,
      version,
      title: this.getTitleForType(type),
      content,
      effectiveDate,
      isActive: true,
      metadata: { changeLog },
    });
    
    // Notify users of material changes
    if (this.isMaterialChange(changeLog)) {
      await this.notifyUsersOfUpdate(type, version, effectiveDate, changeLog);
    }
  }
  
  /**
   * Check if user needs to accept updated documents
   */
  static async checkForPendingAcceptances(userId: string): Promise<Array<{
    type: string;
    version: string;
    title: string;
    content: string;
  }>> {
    const activeDocuments = await db
      .select()
      .from(legalDocuments)
      .where(eq(legalDocuments.isActive, true));
    
    const pendingAcceptances: Array<{
      type: string;
      version: string;
      title: string;
      content: string;
    }> = [];
    
    for (const doc of activeDocuments) {
      if (!doc.requiresAcceptance) continue;
      
      const [acceptance] = await db
        .select()
        .from(legalAcceptances)
        .where(and(
          eq(legalAcceptances.userId, userId),
          eq(legalAcceptances.documentType, doc.type),
          eq(legalAcceptances.documentVersion, doc.version)
        ))
        .limit(1);
      
      if (!acceptance) {
        pendingAcceptances.push({
          type: doc.type,
          version: doc.version,
          title: doc.title,
          content: doc.content,
        });
      }
    }
    
    return pendingAcceptances;
  }
  
  /**
   * Record user acceptance
   */
  static async recordAcceptance(
    userId: string,
    documentType: string,
    documentVersion: string,
    ipAddress: string,
    userAgent: string,
    method: 'checkbox' | 'click' | 'implicit'
  ): Promise<void> {
    await db.insert(legalAcceptances).values({
      userId,
      documentType,
      documentVersion,
      ipAddress,
      userAgent,
      acceptanceMethod: method,
    });
  }
  
  private static getTitleForType(type: string): string {
    const titles: Record<string, string> = {
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
      cookie: 'Cookie Policy',
      refund: 'Refund Policy',
    };
    return titles[type] || type;
  }
  
  private static isMaterialChange(changeLog: string): boolean {
    const materialKeywords = ['liability', 'arbitration', 'data', 'privacy', 'fees'];
    return materialKeywords.some((keyword) => 
      changeLog.toLowerCase().includes(keyword)
    );
  }
  
  private static async notifyUsersOfUpdate(
    type: string,
    version: string,
    effectiveDate: Date,
    changeLog: string
  ): Promise<void> {
    // Implementation to notify all users via email
  }
}
```

---

## END OF MODULE: 24-experts-legal.md
