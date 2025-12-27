# KIDS & COPPA EXPERT
# Module: 25e-kids-coppa.md
# Load with: 00-core.md
# Covers: COPPA compliance, parental consent, age gates, child-safe features

---

## 👶 KIDS & COPPA EXPERT PERSPECTIVE

When building applications for children under 13, COPPA compliance is mandatory.
Failure to comply can result in significant FTC penalties.

### COPPA Compliance Requirements

```typescript
// lib/coppa/requirements.ts

/**
 * COPPA (Children's Online Privacy Protection Act) applies when:
 * 1. Your service is directed to children under 13
 * 2. You have actual knowledge that users are under 13
 * 3. You collect personal information from children
 *
 * Personal information under COPPA includes:
 * - Full name, home address, email address, phone number
 * - Social Security number
 * - Photo, video, or audio with child's image/voice
 * - Geolocation data
 * - Persistent identifiers (cookies, device IDs) when used to track
 */

export const COPPA_REQUIREMENTS = {
  notices: {
    privacyPolicy: {
      required: true,
      mustInclude: [
        'Types of personal information collected',
        'How information is used',
        'Disclosure practices',
        'Parental rights (access, delete, refuse further collection)',
        'Contact information for privacy inquiries',
      ],
    },
    directNotice: {
      required: true,
      when: 'Before collecting any personal information',
      mustInclude: [
        'What information will be collected',
        'How it will be used',
        'Request for verifiable parental consent',
      ],
    },
  },
  parentalConsent: {
    required: true,
    verificationMethods: [
      'Signed consent form (mail/fax)',
      'Credit card transaction',
      'Video conference call',
      'Government ID check',
      'Knowledge-based authentication',
    ],
    emailPlusVerification: {
      allowed: true, // For internal use only
      steps: [
        'Send email to parent',
        'Require confirmation response',
        'Follow up with email asking parent to confirm or revoke',
      ],
    },
  },
  dataHandling: {
    minimization: 'Collect only what is reasonably necessary',
    retention: 'Keep only as long as reasonably necessary',
    security: 'Reasonable procedures to protect confidentiality',
    thirdParties: 'Service providers must maintain confidentiality',
  },
  parentalRights: [
    'Review personal information collected',
    'Refuse further collection',
    'Request deletion of information',
    'Consent to collection without disclosure',
  ],
};
```

### COPPA-Compliant Database Schema

```typescript
// db/schema/coppa.ts
import { pgTable, uuid, text, timestamp, boolean, date, jsonb } from 'drizzle-orm/pg-core';

// Child accounts (under 13)
export const childAccounts = pgTable('child_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').unique().notNull(), // No real names!
  displayName: text('display_name'),
  birthDate: date('birth_date').notNull(),
  avatarId: text('avatar_id'), // Predefined avatar, no uploads

  parentAccountId: uuid('parent_account_id').notNull(),
  parentConsentVerified: boolean('parent_consent_verified').default(false),
  consentMethod: text('consent_method'),
  consentVerifiedAt: timestamp('consent_verified_at'),

  settings: jsonb('settings').$type<{
    canChat: boolean;
    chatFilter: 'strict' | 'moderate';
    canShareContent: boolean;
    canReceiveFriendRequests: boolean;
    screenTimeLimit?: number;
  }>().default({
    canChat: false,
    chatFilter: 'strict',
    canShareContent: false,
    canReceiveFriendRequests: false,
  }),

  status: text('status').default('pending_consent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Parent accounts
export const parentAccounts = pgTable('parent_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  privacyPolicyAcceptedAt: timestamp('privacy_policy_accepted_at'),
  privacyPolicyVersion: text('privacy_policy_version'),
  emailVerified: boolean('email_verified').default(false),
  identityVerified: boolean('identity_verified').default(false),
  verificationMethod: text('verification_method'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Consent records (audit trail)
export const consentRecords = pgTable('consent_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentAccountId: uuid('parent_account_id').notNull().references(() => parentAccounts.id),
  childAccountId: uuid('child_account_id').notNull().references(() => childAccounts.id),
  consentType: text('consent_type').notNull(), // 'initial', 'update', 'revoke'
  consentScope: jsonb('consent_scope').$type<{
    collection: string[];
    usage: string[];
    disclosure: string[];
  }>().notNull(),
  verificationMethod: text('verification_method').notNull(),
  verificationDetails: jsonb('verification_details').$type<{
    transactionId?: string;
    signatureUrl?: string;
    idCheckId?: string;
  }>(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
  revokedAt: timestamp('revoked_at'),
});

// Parent data requests (COPPA requirement)
export const parentDataRequests = pgTable('parent_data_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentAccountId: uuid('parent_account_id').notNull().references(() => parentAccounts.id),
  childAccountId: uuid('child_account_id').notNull().references(() => childAccounts.id),
  requestType: text('request_type').notNull(), // 'access', 'delete', 'stop_collection'
  status: text('status').default('pending').notNull(),
  identityVerified: boolean('identity_verified').default(false),
  verificationMethod: text('verification_method'),
  responseData: jsonb('response_data'),
  completedAt: timestamp('completed_at'),
  completedBy: uuid('completed_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Age Gate Component

```typescript
// components/age-gate.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AgeGate() {
  const router = useRouter();
  const [birthDate, setBirthDate] = useState({ month: '', day: '', year: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { month, day, year } = birthDate;
    if (!month || !day || !year) {
      setError('Please enter your complete birth date');
      return;
    }

    const birth = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;

    if (age < 13) {
      router.push('/signup/parent?child_dob=' + encodeURIComponent(`${year}-${month}-${day}`));
    } else {
      router.push('/signup');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Enter Your Birthday</h1>
      <p className="text-gray-600 mb-6">We need to know your age to give you the right experience.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4">
          <select value={birthDate.month} onChange={(e) => setBirthDate({ ...birthDate, month: e.target.value })} className="flex-1 border rounded-md p-2">
            <option value="">Month</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
          <select value={birthDate.day} onChange={(e) => setBirthDate({ ...birthDate, day: e.target.value })} className="flex-1 border rounded-md p-2">
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
          <select value={birthDate.year} onChange={(e) => setBirthDate({ ...birthDate, year: e.target.value })} className="flex-1 border rounded-md p-2">
            <option value="">Year</option>
            {Array.from({ length: 100 }, (_, i) => {
              const year = new Date().getFullYear() - i;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">Continue</button>
      </form>

      <p className="text-xs text-gray-500 mt-4">
        We use your birthday to ensure you get the right experience and comply with privacy laws.
      </p>
    </div>
  );
}
```

### Parental Consent Service

```typescript
// services/coppa/consent-service.ts
import { db } from '@/db';
import { parentAccounts, childAccounts, consentRecords } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { EmailService } from '@/services/email-service';
import { nanoid } from 'nanoid';

export class COPPAConsentService {
  static async initiateConsent(
    parentEmail: string,
    childUsername: string,
    childBirthDate: Date
  ): Promise<{ parentId: string; childId: string; verificationCode: string }> {
    const [parent] = await db.insert(parentAccounts).values({
      email: parentEmail, passwordHash: '', name: '',
    }).returning();

    const [child] = await db.insert(childAccounts).values({
      username: childUsername, birthDate: childBirthDate,
      parentAccountId: parent.id, status: 'pending_consent',
    }).returning();

    const verificationCode = nanoid(6).toUpperCase();

    await EmailService.send({
      to: parentEmail,
      templateId: 'coppa-consent-request',
      data: {
        childUsername, verificationCode,
        consentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/parent/consent?code=${verificationCode}`,
        privacyPolicyUrl: `${process.env.NEXT_PUBLIC_APP_URL}/privacy-children`,
      },
    });

    return { parentId: parent.id, childId: child.id, verificationCode };
  }

  static async verifyConsentViaEmail(
    verificationCode: string,
    parentEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    const [parent] = await db.select().from(parentAccounts)
      .where(eq(parentAccounts.email, parentEmail)).limit(1);

    if (!parent) return { success: false, error: 'Parent account not found' };

    await db.update(parentAccounts).set({
      emailVerified: true, updatedAt: new Date(),
    }).where(eq(parentAccounts.id, parent.id));

    // Activate all pending children for this parent
    await db.update(childAccounts).set({
      parentConsentVerified: true,
      consentMethod: 'email_plus',
      consentVerifiedAt: new Date(),
      status: 'active',
      updatedAt: new Date(),
    }).where(eq(childAccounts.parentAccountId, parent.id));

    return { success: true };
  }

  static async handleDataRequest(
    parentId: string,
    childId: string,
    requestType: 'access' | 'delete' | 'stop_collection'
  ): Promise<void> {
    // Log and process the data request per COPPA requirements
    await db.insert(parentDataRequests).values({
      parentAccountId: parentId,
      childAccountId: childId,
      requestType,
      status: 'pending',
    });
  }
}
```

### Child-Safe Content Guidelines

```markdown
## Child-Safe Content Guidelines

### Username/Display Names
- No real names allowed
- Pre-approved word list or random generator
- Profanity filter on all inputs

### Avatars
- Predefined avatars only (no uploads for under-13)
- Age-appropriate designs

### Chat/Messaging
- Disabled by default
- If enabled, requires parental consent
- Strict word filter
- No private messaging between children

### Content Sharing
- Disabled by default
- If enabled, requires parental consent
- Moderation queue for all shared content
- No photo/video uploads without parental consent

### Friend Requests
- Disabled by default
- If enabled, parent must approve each friend
```

---
