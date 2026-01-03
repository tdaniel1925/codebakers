# INTEGRATIONS
# Module: 06-integrations.md
# Load with: 00-core.md
# Covers: VAPI, Email, SMS, GoHighLevel, File Generation, Background Jobs

---

## 🎤 VAPI VOICE AI INTEGRATION

### VAPI Setup

```typescript
// lib/vapi/client.ts
import Vapi from '@vapi-ai/web';

let vapiInstance: Vapi | null = null;

export function getVapiClient(): Vapi {
  if (!vapiInstance) {
    vapiInstance = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!);
  }
  return vapiInstance;
}

// Server-side API calls
export const VAPI_API_BASE = 'https://api.vapi.ai';

export async function vapiServerRequest(
  endpoint: string,
  options: RequestInit = {}
) {
  const response = await fetch(`${VAPI_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `VAPI API error: ${response.status}`);
  }

  return response.json();
}
```

### VAPI Service

```typescript
// services/vapi-service.ts
import { vapiServerRequest } from '@/lib/vapi/client';

interface CreateAssistantParams {
  name: string;
  firstMessage: string;
  systemPrompt: string;
  voice?: {
    provider: 'elevenlabs' | '11labs' | 'playht' | 'deepgram';
    voiceId: string;
  };
  model?: {
    provider: 'openai' | 'anthropic';
    model: string;
  };
}

interface CreateCallParams {
  assistantId: string;
  phoneNumber: string;
  customerName?: string;
  metadata?: Record<string, string>;
}

export class VapiService {
  /**
   * Create a new assistant
   */
  static async createAssistant(params: CreateAssistantParams) {
    return vapiServerRequest('/assistant', {
      method: 'POST',
      body: JSON.stringify({
        name: params.name,
        firstMessage: params.firstMessage,
        model: params.model || {
          provider: 'openai',
          model: 'gpt-4-turbo-preview',
          systemPrompt: params.systemPrompt,
        },
        voice: params.voice || {
          provider: '11labs',
          voiceId: 'rachel', // Default voice
        },
        silenceTimeoutSeconds: 30,
        maxDurationSeconds: 600,
        backgroundSound: 'office',
        recordingEnabled: true,
        endCallFunctionEnabled: true,
      }),
    });
  }

  /**
   * Get assistant by ID
   */
  static async getAssistant(assistantId: string) {
    return vapiServerRequest(`/assistant/${assistantId}`);
  }

  /**
   * Update assistant
   */
  static async updateAssistant(
    assistantId: string, 
    updates: Partial<CreateAssistantParams>
  ) {
    return vapiServerRequest(`/assistant/${assistantId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete assistant
   */
  static async deleteAssistant(assistantId: string) {
    return vapiServerRequest(`/assistant/${assistantId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Initiate outbound call
   */
  static async createCall(params: CreateCallParams) {
    return vapiServerRequest('/call/phone', {
      method: 'POST',
      body: JSON.stringify({
        assistantId: params.assistantId,
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        customer: {
          number: params.phoneNumber,
          name: params.customerName,
        },
        metadata: params.metadata,
      }),
    });
  }

  /**
   * Get call details
   */
  static async getCall(callId: string) {
    return vapiServerRequest(`/call/${callId}`);
  }

  /**
   * List calls with filters
   */
  static async listCalls(filters?: {
    assistantId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (filters?.assistantId) params.set('assistantId', filters.assistantId);
    if (filters?.startDate) params.set('startedAt[gte]', filters.startDate);
    if (filters?.endDate) params.set('startedAt[lte]', filters.endDate);
    if (filters?.limit) params.set('limit', filters.limit.toString());

    return vapiServerRequest(`/call?${params.toString()}`);
  }

  /**
   * Get call transcript
   */
  static async getTranscript(callId: string) {
    const call = await this.getCall(callId);
    return call.transcript || [];
  }

  /**
   * Get call recording URL
   */
  static async getRecordingUrl(callId: string) {
    const call = await this.getCall(callId);
    return call.recordingUrl;
  }
}
```

### VAPI Webhook Handler

```typescript
// app/api/webhooks/vapi/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { db } from '@/db';
import { calls } from '@/db/schema';
import { eq } from 'drizzle-orm';

function verifyVapiSignature(payload: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.VAPI_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = headers();
  const signature = headersList.get('x-vapi-signature');

  // Verify signature if secret is configured
  if (process.env.VAPI_WEBHOOK_SECRET && signature) {
    const isValid = verifyVapiSignature(body, signature);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  const payload = JSON.parse(body);
  const { message } = payload;

  try {
    switch (message.type) {
      case 'call-started':
        await handleCallStarted(message.call);
        break;

      case 'call-ended':
        await handleCallEnded(message.call);
        break;

      case 'transcript':
        await handleTranscript(message.call, message.transcript);
        break;

      case 'function-call':
        return await handleFunctionCall(message);

      case 'hang':
        await handleHang(message.call);
        break;

      default:
        console.log(`Unhandled VAPI event: ${message.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('VAPI webhook error:', error);
    return NextResponse.json({ received: true, error: 'Processing failed' });
  }
}

async function handleCallStarted(call: any) {
  await db.insert(calls).values({
    vapiCallId: call.id,
    assistantId: call.assistantId,
    phoneNumber: call.customer?.number,
    status: 'in_progress',
    startedAt: new Date(call.startedAt),
    metadata: call.metadata,
  });
}

async function handleCallEnded(call: any) {
  await db
    .update(calls)
    .set({
      status: 'completed',
      endedAt: new Date(call.endedAt),
      duration: call.duration,
      cost: call.cost,
      transcript: call.transcript,
      recordingUrl: call.recordingUrl,
      summary: call.summary,
      updatedAt: new Date(),
    })
    .where(eq(calls.vapiCallId, call.id));
}

async function handleTranscript(call: any, transcript: any) {
  // Real-time transcript updates
  // Could emit via WebSocket or store incrementally
  console.log('Transcript update:', transcript);
}

async function handleFunctionCall(message: any) {
  const { functionCall, call } = message;
  const { name, parameters } = functionCall;

  // Handle custom function calls from the assistant
  let result: any;

  switch (name) {
    case 'bookAppointment':
      result = await bookAppointment(parameters);
      break;

    case 'lookupCustomer':
      result = await lookupCustomer(parameters);
      break;

    case 'transferCall':
      result = await transferCall(parameters, call.id);
      break;

    default:
      result = { error: `Unknown function: ${name}` };
  }

  return NextResponse.json({ result });
}

async function handleHang(call: any) {
  // Handle unexpected hangups
  await db
    .update(calls)
    .set({
      status: 'failed',
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(calls.vapiCallId, call.id));
}

// Function implementations
async function bookAppointment(params: any) {
  // Integration with calendar system
  return { success: true, appointmentId: 'apt_123' };
}

async function lookupCustomer(params: any) {
  // Look up customer in database
  return { found: true, name: 'John Doe', accountId: 'acc_123' };
}

async function transferCall(params: any, callId: string) {
  // Transfer call to human agent
  return { transferred: true, agentId: 'agent_123' };
}
```

### VAPI React Hook

```typescript
// hooks/use-vapi-call.ts
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { getVapiClient } from '@/lib/vapi/client';

type CallStatus = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

interface UseVapiCallOptions {
  assistantId: string;
  onTranscript?: (transcript: string, role: 'user' | 'assistant') => void;
  onCallStart?: () => void;
  onCallEnd?: () => void;
  onError?: (error: Error) => void;
}

export function useVapiCall({
  assistantId,
  onTranscript,
  onCallStart,
  onCallEnd,
  onError,
}: UseVapiCallOptions) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const vapiRef = useRef(getVapiClient());

  useEffect(() => {
    const vapi = vapiRef.current;

    vapi.on('call-start', () => {
      setStatus('connected');
      onCallStart?.();
    });

    vapi.on('call-end', () => {
      setStatus('ended');
      onCallEnd?.();
    });

    vapi.on('message', (message: any) => {
      if (message.type === 'transcript' && message.transcriptType === 'final') {
        onTranscript?.(message.transcript, message.role);
      }
    });

    vapi.on('error', (error: Error) => {
      setStatus('error');
      onError?.(error);
    });

    return () => {
      vapi.removeAllListeners();
    };
  }, [onTranscript, onCallStart, onCallEnd, onError]);

  const startCall = useCallback(async () => {
    try {
      setStatus('connecting');
      await vapiRef.current.start(assistantId);
    } catch (error) {
      setStatus('error');
      onError?.(error instanceof Error ? error : new Error('Failed to start call'));
    }
  }, [assistantId, onError]);

  const endCall = useCallback(() => {
    vapiRef.current.stop();
    setStatus('ended');
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    vapiRef.current.setMuted(newMuted);
    setIsMuted(newMuted);
  }, [isMuted]);

  return {
    status,
    isMuted,
    startCall,
    endCall,
    toggleMute,
  };
}
```

---

## 📧 NYLAS EMAIL INTEGRATION

### Nylas Setup

```typescript
// lib/nylas/client.ts
import Nylas from 'nylas';

if (!process.env.NYLAS_API_KEY) {
  throw new Error('NYLAS_API_KEY is not set');
}

export const nylas = new Nylas({
  apiKey: process.env.NYLAS_API_KEY,
  apiUri: process.env.NYLAS_API_URI || 'https://api.us.nylas.com',
});
```

### Nylas Service

```typescript
// services/nylas-service.ts
import { nylas } from '@/lib/nylas/client';

interface SendEmailParams {
  grantId: string;
  to: { email: string; name?: string }[];
  subject: string;
  body: string;
  cc?: { email: string; name?: string }[];
  bcc?: { email: string; name?: string }[];
  replyTo?: { email: string; name?: string }[];
  attachments?: {
    filename: string;
    contentType: string;
    content: string; // base64
  }[];
}

interface ListMessagesParams {
  grantId: string;
  limit?: number;
  pageToken?: string;
  folderId?: string;
  unread?: boolean;
  from?: string;
  to?: string;
  subject?: string;
}

export class NylasService {
  /**
   * Get OAuth authorization URL
   */
  static getAuthUrl(redirectUri: string, state: string) {
    return nylas.auth.urlForOAuth2({
      clientId: process.env.NYLAS_CLIENT_ID!,
      redirectUri,
      state,
      loginHint: '',
      provider: 'google', // or 'microsoft', 'imap'
    });
  }

  /**
   * Exchange code for grant
   */
  static async exchangeCodeForGrant(code: string, redirectUri: string) {
    return nylas.auth.exchangeCodeForToken({
      clientId: process.env.NYLAS_CLIENT_ID!,
      clientSecret: process.env.NYLAS_CLIENT_SECRET!,
      code,
      redirectUri,
    });
  }

  /**
   * Send email
   */
  static async sendEmail(params: SendEmailParams) {
    return nylas.messages.send({
      identifier: params.grantId,
      requestBody: {
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        replyTo: params.replyTo,
        subject: params.subject,
        body: params.body,
        attachments: params.attachments?.map((att) => ({
          filename: att.filename,
          contentType: att.contentType,
          content: att.content,
        })),
      },
    });
  }

  /**
   * List messages
   */
  static async listMessages(params: ListMessagesParams) {
    const queryParams: any = {
      limit: params.limit || 50,
    };

    if (params.pageToken) queryParams.pageToken = params.pageToken;
    if (params.folderId) queryParams.in = params.folderId;
    if (params.unread !== undefined) queryParams.unread = params.unread;
    if (params.from) queryParams.from = params.from;
    if (params.to) queryParams.to = params.to;
    if (params.subject) queryParams.subject = params.subject;

    return nylas.messages.list({
      identifier: params.grantId,
      queryParams,
    });
  }

  /**
   * Get single message
   */
  static async getMessage(grantId: string, messageId: string) {
    return nylas.messages.find({
      identifier: grantId,
      messageId,
    });
  }

  /**
   * List folders
   */
  static async listFolders(grantId: string) {
    return nylas.folders.list({
      identifier: grantId,
    });
  }

  /**
   * Create draft
   */
  static async createDraft(
    grantId: string,
    draft: {
      to: { email: string; name?: string }[];
      subject: string;
      body: string;
    }
  ) {
    return nylas.drafts.create({
      identifier: grantId,
      requestBody: draft,
    });
  }

  /**
   * List calendar events
   */
  static async listEvents(
    grantId: string,
    calendarId: string,
    startTime: number,
    endTime: number
  ) {
    return nylas.events.list({
      identifier: grantId,
      queryParams: {
        calendarId,
        start: startTime.toString(),
        end: endTime.toString(),
      },
    });
  }

  /**
   * Create calendar event
   */
  static async createEvent(
    grantId: string,
    calendarId: string,
    event: {
      title: string;
      description?: string;
      when: {
        startTime: number;
        endTime: number;
      };
      participants?: { email: string; name?: string }[];
      location?: string;
    }
  ) {
    return nylas.events.create({
      identifier: grantId,
      queryParams: { calendarId },
      requestBody: {
        title: event.title,
        description: event.description,
        when: {
          startTime: event.when.startTime,
          endTime: event.when.endTime,
        },
        participants: event.participants,
        location: event.location,
      },
    });
  }
}
```

---

## 📞 TWILIO INTEGRATION

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

---

## 📊 GOHIGHLEVEL INTEGRATION

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
}
```

---


---

# PART 10: BACKGROUND JOBS & QUEUES

## ⚡ INNGEST INTEGRATION

### Inngest Setup

```typescript
// lib/inngest/client.ts
import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'botmakers-app',
  schemas: new EventSchemas().fromRecord<Events>(),
});

// Define your event types
type Events = {
  'user/created': {
    data: {
      userId: string;
      email: string;
      name: string;
    };
  };
  'email/send': {
    data: {
      to: string;
      subject: string;
      template: string;
      variables: Record<string, string>;
    };
  };
  'subscription/created': {
    data: {
      organizationId: string;
      plan: string;
    };
  };
  'report/generate': {
    data: {
      organizationId: string;
      reportType: string;
      dateRange: {
        start: string;
        end: string;
      };
    };
  };
};
```

### Inngest Functions

```typescript
// lib/inngest/functions.ts
import { inngest } from './client';
import { EmailService } from '@/services/email-service';
import { ReportService } from '@/services/report-service';

// Welcome email after signup
export const sendWelcomeEmail = inngest.createFunction(
  { id: 'send-welcome-email' },
  { event: 'user/created' },
  async ({ event, step }) => {
    const { userId, email, name } = event.data;

    // Step 1: Send welcome email
    await step.run('send-email', async () => {
      await EmailService.send({
        to: email,
        template: 'welcome',
        variables: { name },
      });
    });

    // Step 2: Wait 1 day
    await step.sleep('wait-1-day', '1d');

    // Step 3: Send tips email
    await step.run('send-tips-email', async () => {
      await EmailService.send({
        to: email,
        template: 'getting-started-tips',
        variables: { name },
      });
    });

    // Step 4: Wait 3 days
    await step.sleep('wait-3-days', '3d');

    // Step 5: Check if user is active
    const isActive = await step.run('check-activity', async () => {
      const user = await UserService.getById(userId);
      return user?.lastActiveAt && 
        new Date(user.lastActiveAt) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    });

    // Step 6: Send re-engagement if inactive
    if (!isActive) {
      await step.run('send-reengagement', async () => {
        await EmailService.send({
          to: email,
          template: 're-engagement',
          variables: { name },
        });
      });
    }

    return { success: true };
  }
);

// Generate report in background
export const generateReport = inngest.createFunction(
  { 
    id: 'generate-report',
    retries: 3,
    concurrency: {
      limit: 5,
    },
  },
  { event: 'report/generate' },
  async ({ event, step }) => {
    const { organizationId, reportType, dateRange } = event.data;

    // Step 1: Fetch data
    const data = await step.run('fetch-data', async () => {
      return ReportService.fetchReportData(
        organizationId,
        reportType,
        dateRange
      );
    });

    // Step 2: Generate PDF
    const pdfUrl = await step.run('generate-pdf', async () => {
      return ReportService.generatePDF(data);
    });

    // Step 3: Notify user
    await step.run('notify-user', async () => {
      const org = await OrganizationService.getById(organizationId);
      await EmailService.send({
        to: org.adminEmail,
        template: 'report-ready',
        variables: {
          reportType,
          downloadUrl: pdfUrl,
        },
      });
    });

    return { pdfUrl };
  }
);

// Scheduled job: Daily cleanup
export const dailyCleanup = inngest.createFunction(
  { id: 'daily-cleanup' },
  { cron: '0 0 * * *' }, // Every day at midnight
  async ({ step }) => {
    // Clean up expired sessions
    await step.run('cleanup-sessions', async () => {
      await db
        .delete(sessions)
        .where(lt(sessions.expiresAt, new Date()));
    });

    // Clean up old audit logs
    await step.run('cleanup-audit-logs', async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await db
        .delete(auditLogs)
        .where(lt(auditLogs.createdAt, thirtyDaysAgo));
    });

    // Clean up abandoned uploads
    await step.run('cleanup-uploads', async () => {
      await StorageService.cleanupOrphanedFiles();
    });

    return { success: true };
  }
);
```

### Inngest API Route

```typescript
// app/api/inngest/route.ts
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { 
  sendWelcomeEmail, 
  generateReport, 
  dailyCleanup 
} from '@/lib/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendWelcomeEmail,
    generateReport,
    dailyCleanup,
  ],
});
```

### Triggering Events

```typescript
// Example: Trigger event after user signup
import { inngest } from '@/lib/inngest/client';

// In your signup handler:
await inngest.send({
  name: 'user/created',
  data: {
    userId: user.id,
    email: user.email,
    name: user.name,
  },
});

// In your report request handler:
await inngest.send({
  name: 'report/generate',
  data: {
    organizationId: org.id,
    reportType: 'monthly-summary',
    dateRange: {
      start: '2024-01-01',
      end: '2024-01-31',
    },
  },
});
```
---


---

# PART 15: AI/LLM IN-APP PATTERNS

## 🤖 OPENAI INTEGRATION

### OpenAI Setup

```typescript
// lib/openai/client.ts
import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
});
```

### AI Service

```typescript
// services/ai-service.ts
import { openai } from '@/lib/openai/client';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export class AIService {
  /**
   * Generate chat completion
   */
  static async chat(
    messages: ChatMessage[],
    options: CompletionOptions = {}
  ) {
    const response = await openai.chat.completions.create({
      model: options.model || 'gpt-4-turbo-preview',
      messages,
      max_tokens: options.maxTokens || 1000,
      temperature: options.temperature ?? 0.7,
    });

    return response.choices[0].message.content;
  }

  /**
   * Generate streaming chat completion
   */
  static async *chatStream(
    messages: ChatMessage[],
    options: CompletionOptions = {}
  ): AsyncGenerator<string> {
    const stream = await openai.chat.completions.create({
      model: options.model || 'gpt-4-turbo-preview',
      messages,
      max_tokens: options.maxTokens || 1000,
      temperature: options.temperature ?? 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  /**
   * Generate embeddings
   */
  static async embed(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  }

  /**
   * Analyze image
   */
  static async analyzeImage(
    imageUrl: string,
    prompt: string
  ): Promise<string> {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 1000,
    });

    return response.choices[0].message.content || '';
  }

  /**
   * Generate structured output with function calling
   */
  static async structured<T>(
    prompt: string,
    schema: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    }
  ): Promise<T> {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      tools: [
        {
          type: 'function',
          function: schema,
        },
      ],
      tool_choice: { type: 'function', function: { name: schema.name } },
    });

    const toolCall = response.choices[0].message.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No structured output generated');
    }

    return JSON.parse(toolCall.function.arguments) as T;
  }
}
```

### Streaming API Route

```typescript
// app/api/ai/chat/route.ts
import { NextRequest } from 'next/server';
import { AIService } from '@/services/ai-service';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { messages } = await req.json();

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = AIService.chatStream([
            {
              role: 'system',
              content: 'You are a helpful assistant.',
            },
            ...messages,
          ]);

          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
```

### React Hook for Streaming

```typescript
// hooks/use-ai-chat.ts
'use client';

import { useState, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function useAIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    setIsLoading(true);
    setError(null);

    // Add user message
    const userMessage: Message = { role: 'user', content };
    setMessages((prev) => [...prev, userMessage]);

    // Add empty assistant message for streaming
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  lastMessage.content += parsed.content;
                  return newMessages;
                });
              }
            } catch {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      // Remove the empty assistant message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    reset,
  };
}
```

---


---

# PART 16: FILE GENERATION (PDF, DOCX, XLSX)

## 📄 PDF GENERATION

### Using @react-pdf/renderer

```typescript
// lib/pdf/templates/invoice.tsx
import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// Register fonts if needed
Font.register({
  family: 'Inter',
  src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff2',
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
    marginTop: 20,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingVertical: 8,
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
  },
  tableCell: {
    flex: 1,
  },
  total: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  totalLabel: {
    fontWeight: 'bold',
    marginRight: 20,
  },
  totalValue: {
    fontWeight: 'bold',
  },
});

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  clientName: string;
  clientAddress: string;
  items: InvoiceItem[];
  notes?: string;
}

export function InvoicePDF({ data }: { data: InvoiceData }) {
  const total = data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>INVOICE</Text>
            <Text>Invoice #{data.invoiceNumber}</Text>
          </View>
          <View>
            <Text>Date: {data.date}</Text>
            <Text>Due: {data.dueDate}</Text>
          </View>
        </View>

        {/* Client Info */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>Bill To:</Text>
          <Text>{data.clientName}</Text>
          <Text>{data.clientAddress}</Text>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, { flex: 3 }]}>Description</Text>
            <Text style={styles.tableCell}>Qty</Text>
            <Text style={styles.tableCell}>Price</Text>
            <Text style={styles.tableCell}>Total</Text>
          </View>

          {data.items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 3 }]}>
                {item.description}
              </Text>
              <Text style={styles.tableCell}>{item.quantity}</Text>
              <Text style={styles.tableCell}>${item.unitPrice.toFixed(2)}</Text>
              <Text style={styles.tableCell}>
                ${(item.quantity * item.unitPrice).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.total}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={{ marginTop: 40 }}>
            <Text style={{ fontWeight: 'bold' }}>Notes:</Text>
            <Text>{data.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
```

### PDF Generation API

```typescript
// app/api/pdf/invoice/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF } from '@/lib/pdf/templates/invoice';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const invoiceSchema = z.object({
  invoiceNumber: z.string(),
  date: z.string(),
  dueDate: z.string(),
  clientName: z.string(),
  clientAddress: z.string(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
    })
  ),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const result = invoiceSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid invoice data', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const pdfBuffer = await renderToBuffer(
      <InvoicePDF data={result.data} />
    );

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${result.data.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
```

## 📊 EXCEL GENERATION

### Using ExcelJS

```typescript
// lib/excel/generators.ts
import ExcelJS from 'exceljs';

interface ReportRow {
  date: string;
  description: string;
  amount: number;
  category: string;
}

export async function generateExpenseReport(
  data: ReportRow[],
  title: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BotMakers App';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Expense Report');

  // Title
  sheet.mergeCells('A1:D1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center' };

  // Headers
  sheet.addRow([]);
  const headerRow = sheet.addRow(['Date', 'Description', 'Amount', 'Category']);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    cell.border = {
      bottom: { style: 'thin' },
    };
  });

  // Data rows
  data.forEach((row) => {
    const dataRow = sheet.addRow([
      row.date,
      row.description,
      row.amount,
      row.category,
    ]);

    // Format amount as currency
    dataRow.getCell(3).numFmt = '$#,##0.00';
  });

  // Total row
  const totalRow = sheet.addRow([
    '',
    'Total',
    { formula: `SUM(C4:C${3 + data.length})` },
    '',
  ]);
  totalRow.getCell(2).font = { bold: true };
  totalRow.getCell(3).font = { bold: true };
  totalRow.getCell(3).numFmt = '$#,##0.00';

  // Column widths
  sheet.columns = [
    { width: 12 },
    { width: 40 },
    { width: 15 },
    { width: 20 },
  ];

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
```

## 📝 WORD DOCUMENT GENERATION

### Using docx

```typescript
// lib/docx/generators.ts
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Packer,
} from 'docx';

interface ProposalData {
  clientName: string;
  projectName: string;
  date: string;
  sections: {
    title: string;
    content: string;
  }[];
  pricing: {
    item: string;
    price: number;
  }[];
}

export async function generateProposal(data: ProposalData): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Title
          new Paragraph({
            text: 'PROJECT PROPOSAL',
            heading: HeadingLevel.TITLE,
            spacing: { after: 400 },
          }),

          // Client info
          new Paragraph({
            children: [
              new TextRun({ text: 'Prepared for: ', bold: true }),
              new TextRun(data.clientName),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Project: ', bold: true }),
              new TextRun(data.projectName),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Date: ', bold: true }),
              new TextRun(data.date),
            ],
            spacing: { after: 400 },
          }),

          // Sections
          ...data.sections.flatMap((section) => [
            new Paragraph({
              text: section.title,
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              text: section.content,
              spacing: { after: 200 },
            }),
          ]),

          // Pricing table
          new Paragraph({
            text: 'Pricing',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: 'Item', bold: true })],
                    shading: { fill: 'E0E0E0' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'Price', bold: true })],
                    shading: { fill: 'E0E0E0' },
                  }),
                ],
              }),
              ...data.pricing.map(
                (item) =>
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [new Paragraph(item.item)],
                      }),
                      new TableCell({
                        children: [
                          new Paragraph(`$${item.price.toLocaleString()}`),
                        ],
                      }),
                    ],
                  })
              ),
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'Total', bold: true })],
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `$${data.pricing
                              .reduce((sum, item) => sum + item.price, 0)
                              .toLocaleString()}`,
                            bold: true,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
```


---


---

# PART 17: EMAIL TEMPLATES

## 📧 RESEND EMAIL INTEGRATION

### Resend Setup

```typescript
// lib/email/client.ts
import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

export const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@yourdomain.com';
```

### Email Service

```typescript
// services/email-service.ts
import { resend, EMAIL_FROM } from '@/lib/email/client';
import { 
  WelcomeEmail, 
  PasswordResetEmail, 
  InviteEmail,
  InvoiceEmail,
  NotificationEmail,
} from '@/lib/email/templates';

type EmailTemplate = 
  | 'welcome'
  | 'password-reset'
  | 'invite'
  | 'invoice'
  | 'notification';

interface SendEmailParams {
  to: string | string[];
  template: EmailTemplate;
  variables: Record<string, any>;
  subject?: string;
}

export class EmailService {
  /**
   * Send email using template
   */
  static async send(params: SendEmailParams): Promise<{ id: string }> {
    const { to, template, variables, subject } = params;

    let emailComponent: React.ReactElement;
    let emailSubject: string;

    switch (template) {
      case 'welcome':
        emailSubject = subject || `Welcome to ${variables.appName}!`;
        emailComponent = WelcomeEmail(variables);
        break;

      case 'password-reset':
        emailSubject = subject || 'Reset your password';
        emailComponent = PasswordResetEmail(variables);
        break;

      case 'invite':
        emailSubject = subject || `You've been invited to join ${variables.organizationName}`;
        emailComponent = InviteEmail(variables);
        break;

      case 'invoice':
        emailSubject = subject || `Invoice #${variables.invoiceNumber}`;
        emailComponent = InvoiceEmail(variables);
        break;

      case 'notification':
        emailSubject = subject || variables.title;
        emailComponent = NotificationEmail(variables);
        break;

      default:
        throw new Error(`Unknown email template: ${template}`);
    }

    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      subject: emailSubject,
      react: emailComponent,
    });

    if (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return { id: data!.id };
  }

  /**
   * Send bulk emails
   */
  static async sendBulk(
    recipients: { email: string; variables: Record<string, any> }[],
    template: EmailTemplate,
    baseSubject?: string
  ): Promise<{ sent: number; failed: number }> {
    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        this.send({
          to: recipient.email,
          template,
          variables: recipient.variables,
          subject: baseSubject,
        })
      )
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return { sent, failed };
  }
}
```

### React Email Templates

```typescript
// lib/email/templates/welcome.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface WelcomeEmailProps {
  name: string;
  appName: string;
  loginUrl: string;
}

export function WelcomeEmail({ name, appName, loginUrl }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to {appName}!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to {appName}!</Heading>
          
          <Text style={text}>Hi {name},</Text>
          
          <Text style={text}>
            Thanks for signing up! We're excited to have you on board.
          </Text>
          
          <Text style={text}>
            Get started by logging into your account:
          </Text>
          
          <Section style={buttonContainer}>
            <Button style={button} href={loginUrl}>
              Go to Dashboard
            </Button>
          </Section>
          
          <Hr style={hr} />
          
          <Text style={footer}>
            If you didn't create an account, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '560px',
};

const h1 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.25',
  marginBottom: '24px',
};

const text = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '1.5',
  marginBottom: '16px',
};

const buttonContainer = {
  textAlign: 'center' as const,
  marginTop: '32px',
  marginBottom: '32px',
};

const button = {
  backgroundColor: '#000000',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '12px 24px',
};

const hr = {
  borderColor: '#e6e6e6',
  margin: '32px 0',
};

const footer = {
  color: '#8c8c8c',
  fontSize: '14px',
  lineHeight: '1.5',
};
```

```typescript
// lib/email/templates/password-reset.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface PasswordResetEmailProps {
  name: string;
  resetUrl: string;
  expiresIn: string;
}

export function PasswordResetEmail({ 
  name, 
  resetUrl, 
  expiresIn 
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Reset your password</Heading>
          
          <Text style={text}>Hi {name},</Text>
          
          <Text style={text}>
            We received a request to reset your password. Click the button 
            below to choose a new password:
          </Text>
          
          <Section style={buttonContainer}>
            <Button style={button} href={resetUrl}>
              Reset Password
            </Button>
          </Section>
          
          <Text style={text}>
            This link will expire in {expiresIn}.
          </Text>
          
          <Text style={footer}>
            If you didn't request a password reset, you can safely ignore 
            this email. Your password will remain unchanged.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '560px',
};

const h1 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600',
  marginBottom: '24px',
};

const text = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '1.5',
  marginBottom: '16px',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#000000',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  padding: '12px 24px',
};

const footer = {
  color: '#8c8c8c',
  fontSize: '14px',
  marginTop: '32px',
};
```

```typescript
// lib/email/templates/invite.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface InviteEmailProps {
  inviterName: string;
  organizationName: string;
  inviteUrl: string;
  role: string;
}

export function InviteEmail({ 
  inviterName, 
  organizationName, 
  inviteUrl,
  role,
}: InviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You've been invited to join {organizationName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>You're invited!</Heading>
          
          <Text style={text}>
            {inviterName} has invited you to join <strong>{organizationName}</strong> as 
            a {role}.
          </Text>
          
          <Section style={buttonContainer}>
            <Button style={button} href={inviteUrl}>
              Accept Invitation
            </Button>
          </Section>
          
          <Text style={footer}>
            This invitation will expire in 7 days.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '560px',
};

const h1 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600',
  marginBottom: '24px',
};

const text = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '1.5',
  marginBottom: '16px',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#000000',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  padding: '12px 24px',
};

const footer = {
  color: '#8c8c8c',
  fontSize: '14px',
  marginTop: '32px',
};
```

---


---

# PART 32: UNKNOWN API INTEGRATION PROTOCOL

## 🔌 LEARN ANY API ON THE FLY

When Claude encounters an API not covered in this file, follow this protocol to learn and integrate it.

### Trigger Conditions
- User mentions an unfamiliar service/API
- User asks to integrate a tool not in this file
- User provides API documentation

### Step 1: Request Documentation

```markdown
## When Encountering Unknown API

If user asks to integrate a service not covered in this file, respond:

"I don't have built-in patterns for [Service]. To create a proper integration, please provide ONE of the following:

1. **API Documentation URL** - Link to their API docs
2. **OpenAPI/Swagger Spec** - JSON or YAML specification
3. **Example Code** - Sample requests/responses from their docs
4. **Postman Collection** - If available

I'll analyze the API and generate:
- Client setup with proper authentication
- Service class following our patterns
- Webhook handlers (if applicable)
- TypeScript types
- Tests

Which can you provide?"
```

### Step 2: Analyze Documentation

When documentation is provided, extract:

```typescript
// API Analysis Template
interface APIAnalysis {
  // Basic Info
  name: string;
  baseUrl: string;
  version: string;
  
  // Authentication
  auth: {
    type: 'apiKey' | 'bearer' | 'oauth2' | 'basic' | 'custom';
    location: 'header' | 'query' | 'body';
    keyName?: string;
    oauthFlow?: 'authorizationCode' | 'clientCredentials' | 'implicit';
    scopes?: string[];
  };
  
  // Endpoints
  endpoints: {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    description: string;
    parameters: {
      name: string;
      type: string;
      required: boolean;
      location: 'path' | 'query' | 'body' | 'header';
    }[];
    responseShape: object;
  }[];
  
  // Webhooks
  webhooks?: {
    events: string[];
    signatureVerification: boolean;
    signatureHeader?: string;
    signatureAlgorithm?: string;
  };
  
  // Rate Limits
  rateLimits?: {
    requests: number;
    window: string;
    headers?: {
      limit: string;
      remaining: string;
      reset: string;
    };
  };
  
  // Pagination
  pagination?: {
    type: 'cursor' | 'offset' | 'page';
    parameters: string[];
  };
}
```

### Step 3: Generate Client

```typescript
// Template: lib/[service]/client.ts

// =============================================================================
// [SERVICE NAME] API CLIENT
// Generated from documentation analysis
// =============================================================================

const API_BASE_URL = process.env.[SERVICE]_API_URL || '[default-url]';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

class [Service]APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = '[Service]APIError';
  }
}

export async function [service]Request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;
  
  // Build URL with query params
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }
  
  // Add authentication
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // AUTH PATTERN DEPENDS ON API TYPE:
    
    // API Key in header:
    'X-API-Key': process.env.[SERVICE]_API_KEY!,
    
    // Bearer token:
    // 'Authorization': `Bearer ${process.env.[SERVICE]_API_KEY}`,
    
    // Basic auth:
    // 'Authorization': `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`,
    
    ...(options.headers as Record<string, string>),
  };
  
  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });
  
  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    throw new [Service]APIError(
      'Rate limit exceeded',
      429,
      'RATE_LIMITED',
      { retryAfter }
    );
  }
  
  // Handle errors
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new [Service]APIError(
      error.message || `API error: ${response.status}`,
      response.status,
      error.code,
      error
    );
  }
  
  // Handle empty responses
  if (response.status === 204) {
    return {} as T;
  }
  
  return response.json();
}

// Export error class for handling
export { [Service]APIError };
```

### Step 4: Generate Service Class

```typescript
// Template: services/[service]-service.ts

// =============================================================================
// [SERVICE NAME] SERVICE
// Generated from documentation analysis
// =============================================================================

import { [service]Request, [Service]APIError } from '@/lib/[service]/client';

// Types generated from API response shapes
interface [Resource] {
  id: string;
  // ... fields from API
}

interface Create[Resource]Params {
  // ... fields for creation
}

interface List[Resources]Params {
  limit?: number;
  cursor?: string;
  // ... other filter params
}

interface List[Resources]Response {
  data: [Resource][];
  hasMore: boolean;
  nextCursor?: string;
}

export class [Service]Service {
  /**
   * List [resources]
   */
  static async list(params?: List[Resources]Params): Promise<List[Resources]Response> {
    return [service]Request<List[Resources]Response>('/[resources]', {
      params: params as Record<string, string>,
    });
  }
  
  /**
   * Get [resource] by ID
   */
  static async getById(id: string): Promise<[Resource]> {
    return [service]Request<[Resource]>(`/[resources]/${id}`);
  }
  
  /**
   * Create [resource]
   */
  static async create(data: Create[Resource]Params): Promise<[Resource]> {
    return [service]Request<[Resource]>('/[resources]', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  
  /**
   * Update [resource]
   */
  static async update(id: string, data: Partial<Create[Resource]Params>): Promise<[Resource]> {
    return [service]Request<[Resource]>(`/[resources]/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
  
  /**
   * Delete [resource]
   */
  static async delete(id: string): Promise<void> {
    await [service]Request<void>(`/[resources]/${id}`, {
      method: 'DELETE',
    });
  }
  
  // Add additional methods based on API capabilities...
}
```

### Step 5: Generate Webhook Handler (If Applicable)

```typescript
// Template: app/api/webhooks/[service]/route.ts

// =============================================================================
// [SERVICE NAME] WEBHOOK HANDLER
// Generated from documentation analysis
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';

// Signature verification (adjust based on API's method)
function verifySignature(payload: string, signature: string): boolean {
  // HMAC-SHA256 (most common)
  const expectedSignature = crypto
    .createHmac('sha256', process.env.[SERVICE]_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
  
  // SHA-256 with prefix (Stripe-style)
  // const elements = signature.split(',');
  // const timestamp = elements.find(e => e.startsWith('t='))?.split('=')[1];
  // const sig = elements.find(e => e.startsWith('v1='))?.split('=')[1];
  // const signedPayload = `${timestamp}.${payload}`;
  // ... verify
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = headers();
  
  // Get signature header (name varies by service)
  const signature = headersList.get('x-[service]-signature') 
    || headersList.get('x-webhook-signature')
    || headersList.get('[service]-signature');
  
  // Verify signature
  if (process.env.[SERVICE]_WEBHOOK_SECRET && signature) {
    const isValid = verifySignature(body, signature);
    if (!isValid) {
      console.error('[Service] webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }
  
  const payload = JSON.parse(body);
  
  // Extract event type (structure varies by API)
  const eventType = payload.type || payload.event || payload.eventType;
  const eventData = payload.data || payload.payload || payload;
  
  try {
    switch (eventType) {
      case '[event.type.1]':
        await handle[Event1](eventData);
        break;
        
      case '[event.type.2]':
        await handle[Event2](eventData);
        break;
        
      // Add more event handlers...
        
      default:
        console.log(`Unhandled [Service] event: ${eventType}`);
    }
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Service] webhook error:', error);
    // Return 200 to prevent retries for processing errors
    return NextResponse.json({ received: true, error: 'Processing failed' });
  }
}

// Event handlers
async function handle[Event1](data: any) {
  // Process event
}

async function handle[Event2](data: any) {
  // Process event
}
```

### Step 6: Generate Environment Variables

```env
# [SERVICE NAME] Integration
# Generated from documentation analysis

[SERVICE]_API_KEY=
[SERVICE]_API_URL=https://api.[service].com/v1
[SERVICE]_WEBHOOK_SECRET=

# OAuth (if applicable)
[SERVICE]_CLIENT_ID=
[SERVICE]_CLIENT_SECRET=
[SERVICE]_REDIRECT_URI=http://localhost:3000/api/auth/[service]/callback
```

### Step 7: Report Generation

```markdown
## 🔌 Integration Generated: [Service Name]

**From:** [Documentation source]

**Generated Files:**
- ✅ `lib/[service]/client.ts` - API client with auth
- ✅ `services/[service]-service.ts` - Service class with CRUD
- ✅ `app/api/webhooks/[service]/route.ts` - Webhook handler
- ✅ `types/[service].ts` - TypeScript types
- ✅ `.env.example` updated with required variables

**Authentication:** [Type detected]
**Endpoints Covered:** [X] endpoints
**Webhook Events:** [X] events

**Environment Variables Needed:**
```
[SERVICE]_API_KEY=your-api-key
[SERVICE]_WEBHOOK_SECRET=your-webhook-secret
```

**Usage Example:**
```typescript
import { [Service]Service } from '@/services/[service]-service';

// List resources
const items = await [Service]Service.list({ limit: 20 });

// Create resource
const newItem = await [Service]Service.create({ name: 'Test' });
```

**Ready to test? Say "test the [service] integration"**
```

---

# 📊 FINAL DOCUMENT STATISTICS

## Document Metrics

| Metric | Value |
|--------|-------|
| **Total Parts** | 32 |
| **Total Lines** | ~12,500+ |
| **File Size** | ~300KB |
| **Code Examples** | 150+ |
| **Integrations** | 30+ |
| **Patterns Documented** | 75+ |

## Core Capabilities

| Capability | Status |
|------------|--------|
| Auto-Testing Protocol | ✅ |
| Self-Healing Code | ✅ |
| Project Generator | ✅ |
| Schema Generator | ✅ |
| Auto-CRUD Generator | ✅ |
| Unknown API Learning | ✅ |
| Landing Page Generator | ✅ |
| Admin Dashboard Generator | ✅ |
| Notification System | ✅ |
| Real-time Features | ✅ |
| Search Implementation | ✅ |
| 70+ Item Audit Checklist | ✅ |

## Integrations Covered

| Category | Services |
|----------|----------|
| **Payments** | Stripe |
| **Voice AI** | VAPI, Retell |
| **Email** | Nylas, Resend |
| **SMS** | Twilio |
| **CRM** | GoHighLevel |
| **Scheduling** | Cal.com |
| **AI/LLM** | OpenAI, Anthropic |
| **Database** | Supabase, Drizzle |
| **Auth** | Supabase Auth |
| **Background Jobs** | Inngest |
| **Caching** | Upstash Redis |
| **Analytics** | PostHog |
| **Monitoring** | Sentry |
| **File Generation** | PDF, DOCX, XLSX |

---


---

# PART 40: EMAIL SYSTEM

## Resend Setup

```typescript
// lib/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'noreply@yourdomain.com';
const FROM_NAME = 'Your App';

export const email = {
  /**
   * Send welcome email
   */
  async sendWelcome(to: string, name: string) {
    return resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject: `Welcome to ${FROM_NAME}!`,
      react: WelcomeEmail({ name }),
    });
  },
  
  /**
   * Send password reset email
   */
  async sendPasswordReset(to: string, resetUrl: string) {
    return resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject: 'Reset your password',
      react: PasswordResetEmail({ resetUrl }),
    });
  },
  
  /**
   * Send invoice email
   */
  async sendInvoice(to: string, invoiceData: InvoiceData) {
    return resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject: `Invoice #${invoiceData.number}`,
      react: InvoiceEmail(invoiceData),
    });
  },
  
  /**
   * Send team invite
   */
  async sendTeamInvite(to: string, inviterName: string, teamName: string, inviteUrl: string) {
    return resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject: `${inviterName} invited you to join ${teamName}`,
      react: TeamInviteEmail({ inviterName, teamName, inviteUrl }),
    });
  },
};
```

## Email Templates (React Email)

```typescript
// emails/welcome.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface WelcomeEmailProps {
  name: string;
}

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Your App!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Welcome, {name}!</Heading>
          <Text style={text}>
            Thanks for signing up. We're excited to have you on board.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href="https://yourdomain.com/dashboard">
              Go to Dashboard
            </Button>
          </Section>
          <Text style={footer}>
            If you have any questions, just reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px',
  borderRadius: '8px',
};

const heading = {
  fontSize: '24px',
  fontWeight: '600',
  color: '#1a1a1a',
  marginBottom: '24px',
};

const text = {
  fontSize: '16px',
  color: '#4a4a4a',
  lineHeight: '24px',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#000',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  padding: '12px 24px',
  textDecoration: 'none',
};

const footer = {
  fontSize: '14px',
  color: '#6a6a6a',
  marginTop: '32px',
};
```

---


---

# PART 41: BACKGROUND JOBS (INNGEST)

## Setup

```typescript
// lib/inngest.ts
import { Inngest } from 'inngest';

export const inngest = new Inngest({ 
  id: 'your-app',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
```

## Define Functions

```typescript
// inngest/functions.ts
import { inngest } from '@/lib/inngest';
import { email } from '@/lib/email';
import { db } from '@/db';

// Send welcome email after signup
export const sendWelcomeEmail = inngest.createFunction(
  { id: 'send-welcome-email' },
  { event: 'user/signed.up' },
  async ({ event }) => {
    const { userId, email: userEmail, name } = event.data;
    
    await email.sendWelcome(userEmail, name);
    
    return { sent: true };
  }
);

// Process subscription changes
export const handleSubscriptionChange = inngest.createFunction(
  { id: 'handle-subscription-change' },
  { event: 'stripe/subscription.updated' },
  async ({ event, step }) => {
    const { customerId, status, plan } = event.data;
    
    // Step 1: Update database
    await step.run('update-database', async () => {
      await db
        .update(teams)
        .set({ subscriptionStatus: status, subscriptionPlan: plan })
        .where(eq(teams.stripeCustomerId, customerId));
    });
    
    // Step 2: Send notification email
    if (status === 'active') {
      await step.run('send-confirmation', async () => {
        const team = await db.query.teams.findFirst({
          where: eq(teams.stripeCustomerId, customerId),
          with: { owner: true },
        });
        await email.sendSubscriptionConfirmation(team.owner.email, plan);
      });
    }
    
    return { processed: true };
  }
);

// Daily cleanup job
export const dailyCleanup = inngest.createFunction(
  { id: 'daily-cleanup' },
  { cron: '0 0 * * *' }, // Midnight UTC
  async ({ step }) => {
    // Delete old logs
    await step.run('delete-old-logs', async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      await db
        .delete(apiLogs)
        .where(lt(apiLogs.createdAt, thirtyDaysAgo));
    });
    
    // Clean up expired sessions
    await step.run('cleanup-sessions', async () => {
      await db
        .delete(sessions)
        .where(lt(sessions.expiresAt, new Date()));
    });
    
    return { cleaned: true };
  }
);
```

## API Route

```typescript
// app/api/inngest/route.ts
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { 
  sendWelcomeEmail, 
  handleSubscriptionChange,
  dailyCleanup,
} from '@/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendWelcomeEmail,
    handleSubscriptionChange,
    dailyCleanup,
  ],
});
```

## Trigger Events

```typescript
// After user signup
await inngest.send({
  name: 'user/signed.up',
  data: {
    userId: user.id,
    email: user.email,
    name: user.name,
  },
});

// After Stripe webhook
await inngest.send({
  name: 'stripe/subscription.updated',
  data: {
    customerId: subscription.customer,
    status: subscription.status,
    plan: subscription.metadata.plan,
  },
});
```

---


---

# PART 114: CRON JOBS / SCHEDULED TASKS

## ⏰ SCHEDULED TASK PATTERNS

### Cron Job with Inngest

```typescript
// src/jobs/scheduled-tasks.ts
import { inngest } from '@/lib/inngest';
import { db } from '@/db';
import { subscriptions, users, usageReports } from '@/db/schema';
import { eq, lt, and } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';

// Daily: Send usage reports
export const sendDailyReports = inngest.createFunction(
  { id: 'send-daily-reports' },
  { cron: '0 9 * * *' }, // 9 AM daily
  async ({ step }) => {
    const activeUsers = await step.run('get-users', () =>
      db.query.users.findMany({
        where: eq(users.emailReportsEnabled, true),
      })
    );

    for (const user of activeUsers) {
      await step.run(`send-report-${user.id}`, async () => {
        const report = await generateUsageReport(user.id);
        await sendEmail({
          to: user.email,
          subject: 'Your Daily Usage Report',
          template: 'daily-report',
          data: report,
        });
      });
    }

    return { sent: activeUsers.length };
  }
);

// Weekly: Clean up expired data
export const weeklyCleanup = inngest.createFunction(
  { id: 'weekly-cleanup' },
  { cron: '0 3 * * 0' }, // 3 AM every Sunday
  async ({ step }) => {
    // Delete old logs
    const deletedLogs = await step.run('delete-old-logs', () =>
      db.delete(logs).where(
        lt(logs.createdAt, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) // 90 days
      )
    );

    // Delete expired sessions
    const deletedSessions = await step.run('delete-expired-sessions', () =>
      db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
    );

    return {
      deletedLogs: deletedLogs.rowCount,
      deletedSessions: deletedSessions.rowCount,
    };
  }
);

// Monthly: Generate invoices
export const monthlyInvoices = inngest.createFunction(
  { id: 'monthly-invoices' },
  { cron: '0 0 1 * *' }, // Midnight on 1st of month
  async ({ step }) => {
    const subscriptionsToInvoice = await step.run('get-subscriptions', () =>
      db.query.subscriptions.findMany({
        where: eq(subscriptions.status, 'active'),
      })
    );

    for (const sub of subscriptionsToInvoice) {
      await step.run(`invoice-${sub.id}`, async () => {
        await generateAndSendInvoice(sub);
      });
    }

    return { invoiced: subscriptionsToInvoice.length };
  }
);

// Every 5 minutes: Health check
export const healthCheck = inngest.createFunction(
  { id: 'health-check' },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    const checks = await step.run('run-checks', async () => {
      const results = {
        database: await checkDatabase(),
        redis: await checkRedis(),
        stripe: await checkStripe(),
      };
      return results;
    });

    const failed = Object.entries(checks).filter(([_, ok]) => !ok);

    if (failed.length > 0) {
      await step.run('alert', () =>
        sendAlert({
          type: 'health-check-failed',
          services: failed.map(([name]) => name),
        })
      );
    }

    return checks;
  }
);

// Hourly: Sync external data
export const hourlySync = inngest.createFunction(
  { id: 'hourly-sync' },
  { cron: '0 * * * *' },
  async ({ step }) => {
    await step.run('sync-stripe-subscriptions', syncStripeSubscriptions);
    await step.run('sync-analytics', syncAnalytics);
    await step.run('update-search-index', updateSearchIndex);
  }
);
```

### Cron Dashboard

```typescript
// src/app/(admin)/admin/jobs/page.tsx
import { inngest } from '@/lib/inngest';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

const JOBS = [
  { id: 'send-daily-reports', name: 'Daily Reports', cron: '0 9 * * *' },
  { id: 'weekly-cleanup', name: 'Weekly Cleanup', cron: '0 3 * * 0' },
  { id: 'monthly-invoices', name: 'Monthly Invoices', cron: '0 0 1 * *' },
  { id: 'health-check', name: 'Health Check', cron: '*/5 * * * *' },
  { id: 'hourly-sync', name: 'Hourly Sync', cron: '0 * * * *' },
];

export default async function JobsPage() {
  // Fetch recent runs from Inngest API
  const runs = await getRecentRuns();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Scheduled Jobs</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {JOBS.map((job) => {
          const lastRun = runs.find((r) => r.functionId === job.id);

          return (
            <Card key={job.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{job.name}</CardTitle>
                  <Badge
                    variant={lastRun?.status === 'completed' ? 'default' : 'destructive'}
                  >
                    {lastRun?.status || 'unknown'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground font-mono mb-2">
                  {job.cron}
                </p>
                {lastRun && (
                  <p className="text-sm text-muted-foreground">
                    Last run: {formatDistanceToNow(new Date(lastRun.startedAt), { addSuffix: true })}
                  </p>
                )}
                <form action={`/api/admin/jobs/${job.id}/trigger`} method="POST">
                  <Button type="submit" variant="outline" size="sm" className="mt-4">
                    Run Now
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

### Manual Trigger API

```typescript
// src/app/api/admin/jobs/[id]/trigger/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest';
import { isAdmin } from '@/lib/auth';
import { getServerSession } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session || !(await isAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    await inngest.send({
      name: `app/${params.id}`,
      data: { triggeredBy: session.user.id, manual: true },
    });

    return NextResponse.json({ success: true, jobId: params.id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to trigger job' }, { status: 500 });
  }
}
```

---

