# VOICE AI INTEGRATION
# Module: 06a-voice.md
# Load with: 00-core.md
# Covers: VAPI Voice AI, webhooks, React hooks

---

## VAPI VOICE AI INTEGRATION

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
          voiceId: 'rachel',
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
  console.log('Transcript update:', transcript);
}

async function handleFunctionCall(message: any) {
  const { functionCall, call } = message;
  const { name, parameters } = functionCall;

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
  return { success: true, appointmentId: 'apt_123' };
}

async function lookupCustomer(params: any) {
  return { found: true, name: 'John Doe', accountId: 'acc_123' };
}

async function transferCall(params: any, callId: string) {
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

## Environment Variables

```env
# VAPI Integration
VAPI_API_KEY=
NEXT_PUBLIC_VAPI_PUBLIC_KEY=
VAPI_PHONE_NUMBER_ID=
VAPI_WEBHOOK_SECRET=
```

---
