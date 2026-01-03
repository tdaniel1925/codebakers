# COMMUNICATIONS INTEGRATION
# Module: 06c-communications.md
# Load with: 00-core.md
# Covers: Twilio SMS, GoHighLevel CRM

---

## TWILIO INTEGRATION

### Twilio Setup

```typescript
// lib/twilio/client.ts
import twilio from 'twilio';

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  throw new Error('Twilio credentials not set');
}

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
```

### Twilio Service

```typescript
// services/twilio-service.ts
import { twilioClient } from '@/lib/twilio/client';

interface SendSMSParams {
  to: string;
  body: string;
  from?: string;
  mediaUrl?: string[];
}

interface MakeCallParams {
  to: string;
  from?: string;
  url: string; // TwiML URL
  statusCallback?: string;
}

export class TwilioService {
  /**
   * Send SMS
   */
  static async sendSMS(params: SendSMSParams) {
    return twilioClient.messages.create({
      to: params.to,
      from: params.from || process.env.TWILIO_PHONE_NUMBER!,
      body: params.body,
      mediaUrl: params.mediaUrl,
    });
  }

  /**
   * Send bulk SMS
   */
  static async sendBulkSMS(
    recipients: string[],
    body: string,
    from?: string
  ) {
    const results = await Promise.allSettled(
      recipients.map((to) =>
        this.sendSMS({ to, body, from })
      )
    );

    return results.map((result, index) => ({
      to: recipients[index],
      success: result.status === 'fulfilled',
      ...(result.status === 'fulfilled'
        ? { messageId: result.value.sid }
        : { error: result.reason.message }),
    }));
  }

  /**
   * Make outbound call
   */
  static async makeCall(params: MakeCallParams) {
    return twilioClient.calls.create({
      to: params.to,
      from: params.from || process.env.TWILIO_PHONE_NUMBER!,
      url: params.url,
      statusCallback: params.statusCallback,
    });
  }

  /**
   * Get message status
   */
  static async getMessageStatus(messageSid: string) {
    return twilioClient.messages(messageSid).fetch();
  }

  /**
   * Get call status
   */
  static async getCallStatus(callSid: string) {
    return twilioClient.calls(callSid).fetch();
  }

  /**
   * Validate webhook signature
   */
  static validateWebhookSignature(
    signature: string,
    url: string,
    params: Record<string, string>
  ): boolean {
    return twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN!,
      signature,
      url,
      params
    );
  }
}
```

### Twilio Webhook Handler

```typescript
// app/api/webhooks/twilio/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TwilioService } from '@/services/twilio-service';
import { db } from '@/db';
import { smsMessages } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params = Object.fromEntries(formData.entries()) as Record<string, string>;

  const signature = req.headers.get('x-twilio-signature') || '';
  const url = req.url;

  // Verify signature
  const isValid = TwilioService.validateWebhookSignature(signature, url, params);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const { MessageSid, MessageStatus, From, To, Body } = params;

  try {
    // Handle incoming SMS
    if (Body) {
      await db.insert(smsMessages).values({
        twilioSid: MessageSid,
        from: From,
        to: To,
        body: Body,
        direction: 'inbound',
        status: 'received',
      });
    }

    // Handle status updates
    if (MessageStatus) {
      await db
        .update(smsMessages)
        .set({ status: MessageStatus, updatedAt: new Date() })
        .where(eq(smsMessages.twilioSid, MessageSid));
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Twilio webhook error:', error);
    return NextResponse.json({ received: true });
  }
}
```

---

## GOHIGHLEVEL INTEGRATION

### GHL Setup

```typescript
// lib/ghl/client.ts
export const GHL_API_BASE = 'https://services.leadconnectorhq.com';

export async function ghlRequest(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
) {
  const response = await fetch(`${GHL_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `GHL API error: ${response.status}`);
  }

  return response.json();
}
```

### GHL Service

```typescript
// services/ghl-service.ts
import { ghlRequest } from '@/lib/ghl/client';

export class GHLService {
  /**
   * Get contacts
   */
  static async getContacts(
    accessToken: string,
    locationId: string,
    params?: {
      limit?: number;
      query?: string;
      startAfter?: string;
    }
  ) {
    const searchParams = new URLSearchParams({
      locationId,
      limit: (params?.limit || 20).toString(),
    });
    if (params?.query) searchParams.set('query', params.query);
    if (params?.startAfter) searchParams.set('startAfter', params.startAfter);

    return ghlRequest(
      `/contacts/?${searchParams.toString()}`,
      accessToken
    );
  }

  /**
   * Create contact
   */
  static async createContact(
    accessToken: string,
    locationId: string,
    contact: {
      email?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
      name?: string;
      tags?: string[];
      customFields?: Record<string, string>;
    }
  ) {
    return ghlRequest('/contacts/', accessToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId,
        ...contact,
      }),
    });
  }

  /**
   * Update contact
   */
  static async updateContact(
    accessToken: string,
    contactId: string,
    updates: Record<string, any>
  ) {
    return ghlRequest(`/contacts/${contactId}`, accessToken, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Add contact to workflow
   */
  static async addToWorkflow(
    accessToken: string,
    contactId: string,
    workflowId: string
  ) {
    return ghlRequest(
      `/contacts/${contactId}/workflow/${workflowId}`,
      accessToken,
      { method: 'POST' }
    );
  }

  /**
   * Create opportunity
   */
  static async createOpportunity(
    accessToken: string,
    opportunity: {
      locationId: string;
      contactId: string;
      pipelineId: string;
      pipelineStageId: string;
      name: string;
      monetaryValue?: number;
    }
  ) {
    return ghlRequest('/opportunities/', accessToken, {
      method: 'POST',
      body: JSON.stringify(opportunity),
    });
  }

  /**
   * Send SMS via GHL
   */
  static async sendSMS(
    accessToken: string,
    params: {
      contactId: string;
      message: string;
    }
  ) {
    return ghlRequest('/conversations/messages', accessToken, {
      method: 'POST',
      body: JSON.stringify({
        type: 'SMS',
        contactId: params.contactId,
        message: params.message,
      }),
    });
  }

  /**
   * Get pipelines
   */
  static async getPipelines(accessToken: string, locationId: string) {
    return ghlRequest(`/opportunities/pipelines?locationId=${locationId}`, accessToken);
  }

  /**
   * Get opportunities
   */
  static async getOpportunities(
    accessToken: string,
    locationId: string,
    params?: {
      pipelineId?: string;
      stageId?: string;
      limit?: number;
    }
  ) {
    const searchParams = new URLSearchParams({ locationId });
    if (params?.pipelineId) searchParams.set('pipelineId', params.pipelineId);
    if (params?.stageId) searchParams.set('stageId', params.stageId);
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    return ghlRequest(`/opportunities/search?${searchParams.toString()}`, accessToken);
  }
}
```

### GHL OAuth Flow

```typescript
// app/api/auth/ghl/route.ts
import { NextRequest, NextResponse } from 'next/server';

const GHL_AUTH_URL = 'https://marketplace.gohighlevel.com/oauth/chooselocation';

export async function GET(req: NextRequest) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.GHL_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/ghl/callback`,
    scope: 'contacts.readonly contacts.write opportunities.readonly opportunities.write',
  });

  return NextResponse.redirect(`${GHL_AUTH_URL}?${params.toString()}`);
}

// app/api/auth/ghl/callback/route.ts
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect('/settings?error=ghl_auth_failed');
  }

  const tokenResponse = await fetch('https://services.leadconnectorhq.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GHL_CLIENT_ID!,
      client_secret: process.env.GHL_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/ghl/callback`,
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect('/settings?error=ghl_token_failed');
  }

  const { access_token, refresh_token, locationId } = await tokenResponse.json();

  // Store tokens securely
  // await saveGHLTokens(userId, access_token, refresh_token, locationId);

  return NextResponse.redirect('/settings?ghl=connected');
}
```

---

## Environment Variables

```env
# Twilio Integration
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# GoHighLevel Integration
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=
```

---
