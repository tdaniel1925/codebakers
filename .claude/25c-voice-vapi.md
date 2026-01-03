# VOICE & VAPI EXPERT
# Module: 25c-voice-vapi.md
# Load with: 00-core.md
# Covers: Voice AI assistants, VAPI integration, call handling, webhooks

---

## 🎤 VOICE & VAPI EXPERT PERSPECTIVE

When building voice AI applications, focus on natural conversation flow,
robust error handling, and seamless integration with telephony systems.

### Voice Agent Database Schema

```typescript
// db/schema/voice.ts
import { pgTable, uuid, text, timestamp, boolean, jsonb, integer } from 'drizzle-orm/pg-core';

// Voice Agents
export const voiceAgents = pgTable('voice_agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  vapiAssistantId: text('vapi_assistant_id'),

  // Voice settings
  voiceProvider: text('voice_provider').default('elevenlabs'),
  voiceId: text('voice_id'),

  // Model settings
  modelProvider: text('model_provider').default('openai'),
  modelName: text('model_name').default('gpt-4-turbo'),
  systemPrompt: text('system_prompt'),
  firstMessage: text('first_message'),

  // Call settings
  silenceTimeoutSeconds: integer('silence_timeout_seconds').default(30),
  maxDurationSeconds: integer('max_duration_seconds').default(300),

  status: text('status').default('draft'), // 'draft', 'active', 'paused'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Call Logs
export const callLogs = pgTable('call_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => voiceAgents.id),
  organizationId: uuid('organization_id').notNull(),
  vapiCallId: text('vapi_call_id').unique(),
  direction: text('direction').notNull(), // 'inbound', 'outbound'
  fromNumber: text('from_number'),
  toNumber: text('to_number'),
  status: text('status').default('queued'), // 'queued', 'ringing', 'in-progress', 'completed', 'failed'
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  durationSeconds: integer('duration_seconds'),
  cost: jsonb('cost').$type<{ amount: number; currency: string }>(),
  transcript: jsonb('transcript').$type<Array<{ role: string; content: string; timestamp: number }>>(),
  summary: text('summary'),
  sentiment: text('sentiment'),
  recordingUrl: text('recording_url'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Agent Tools/Functions
export const agentTools = pgTable('agent_tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => voiceAgents.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  parameters: jsonb('parameters').$type<{
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  }>().notNull(),
  endpoint: text('endpoint'),
  method: text('method').default('POST'),
  headers: jsonb('headers').$type<Record<string, string>>(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### VAPI Service

```typescript
// services/voice/vapi-service.ts

interface VapiConfig {
  apiKey: string;
  baseUrl?: string;
}

interface CreateAssistantParams {
  name: string;
  model: {
    provider: 'openai' | 'anthropic';
    model: string;
    systemPrompt: string;
    temperature?: number;
  };
  voice: {
    provider: 'elevenlabs' | 'playht' | 'deepgram';
    voiceId: string;
    settings?: Record<string, number>;
  };
  firstMessage?: string;
  functions?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    serverUrl?: string;
  }>;
  silenceTimeoutSeconds?: number;
  maxDurationSeconds?: number;
}

export class VapiService {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: VapiConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.vapi.ai';
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`VAPI API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async createAssistant(params: CreateAssistantParams) {
    return this.request('POST', '/assistant', {
      name: params.name,
      model: {
        provider: params.model.provider,
        model: params.model.model,
        messages: [{ role: 'system', content: params.model.systemPrompt }],
        temperature: params.model.temperature || 0.7,
      },
      voice: {
        provider: params.voice.provider,
        voiceId: params.voice.voiceId,
        ...params.voice.settings,
      },
      firstMessage: params.firstMessage,
      functions: params.functions,
      silenceTimeoutSeconds: params.silenceTimeoutSeconds || 30,
      maxDurationSeconds: params.maxDurationSeconds || 300,
    });
  }

  async updateAssistant(assistantId: string, params: Partial<CreateAssistantParams>) {
    return this.request('PATCH', `/assistant/${assistantId}`, params);
  }

  async deleteAssistant(assistantId: string) {
    return this.request('DELETE', `/assistant/${assistantId}`);
  }

  async makeCall(params: {
    assistantId: string;
    phoneNumberId: string;
    customerNumber: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.request('POST', '/call/phone', {
      assistantId: params.assistantId,
      phoneNumberId: params.phoneNumberId,
      customer: { number: params.customerNumber },
      metadata: params.metadata,
    });
  }

  async getCall(callId: string) {
    return this.request('GET', `/call/${callId}`);
  }

  async listCalls(params?: { assistantId?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.assistantId) query.set('assistantId', params.assistantId);
    if (params?.limit) query.set('limit', params.limit.toString());
    return this.request('GET', `/call?${query.toString()}`);
  }
}

export const vapi = new VapiService({ apiKey: process.env.VAPI_API_KEY! });
```

### VAPI Webhook Handler

```typescript
// app/api/webhooks/vapi/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { callLogs, voiceAgents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-vapi-signature');

  if (process.env.VAPI_WEBHOOK_SECRET && signature) {
    const isValid = verifyWebhookSignature(body, signature, process.env.VAPI_WEBHOOK_SECRET);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  const event = JSON.parse(body);

  try {
    switch (event.message.type) {
      case 'call-started':
        await handleCallStarted(event);
        break;
      case 'transcript':
        await handleTranscript(event);
        break;
      case 'function-call':
        return await handleFunctionCall(event);
      case 'call-ended':
        await handleCallEnded(event);
        break;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('VAPI webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleCallStarted(event: any) {
  const { call } = event.message;
  const [agent] = await db.select().from(voiceAgents)
    .where(eq(voiceAgents.vapiAssistantId, call.assistantId)).limit(1);

  if (!agent) return;

  await db.insert(callLogs).values({
    agentId: agent.id,
    organizationId: agent.organizationId,
    vapiCallId: call.id,
    direction: call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound',
    fromNumber: call.customer?.number,
    toNumber: call.phoneNumber?.number,
    status: 'in-progress',
    startedAt: new Date(),
    metadata: call.metadata,
  });
}

async function handleTranscript(event: any) {
  console.log('Transcript update:', event.message.transcript);
}

async function handleFunctionCall(event: any) {
  const { functionCall } = event.message;
  // Handle custom function calls from the voice agent
  return NextResponse.json({ result: { success: true } });
}

async function handleCallEnded(event: any) {
  const { call } = event.message;
  await db.update(callLogs).set({
    status: 'completed',
    endedAt: new Date(),
    durationSeconds: call.duration,
    transcript: call.transcript,
    summary: call.summary,
    recordingUrl: call.recordingUrl,
  }).where(eq(callLogs.vapiCallId, call.id));
}
```

### Environment Variables

```env
# VAPI Integration
VAPI_API_KEY=your_vapi_api_key
VAPI_WEBHOOK_SECRET=your_webhook_secret
VAPI_PHONE_NUMBER_ID=your_phone_number_id
```

---
