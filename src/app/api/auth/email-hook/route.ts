import { NextRequest, NextResponse } from 'next/server';
import { EmailService } from '@/services/email-service';
import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import { logger } from '@/lib/logger';

// Supabase Auth Hook secret in format: v1,whsec_<base64_secret>
const HOOK_SECRET = process.env.SUPABASE_AUTH_HOOK_SECRET;

interface EmailHookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type:
      | 'signup'
      | 'magiclink'
      | 'recovery'
      | 'invite'
      | 'email_change';
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

// Standard Webhooks verification
function verifyWebhook(
  payload: string,
  headers: {
    webhookId: string | null;
    webhookTimestamp: string | null;
    webhookSignature: string | null;
  }
): boolean {
  if (!HOOK_SECRET) {
    logger.warn('EmailHook: SUPABASE_AUTH_HOOK_SECRET not configured');
    return false;
  }

  const { webhookId, webhookTimestamp, webhookSignature } = headers;

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    logger.warn('EmailHook: Missing webhook headers');
    return false;
  }

  // Extract the base64 secret from v1,whsec_<base64>
  const secretMatch = HOOK_SECRET.match(/whsec_(.+)$/);
  if (!secretMatch) {
    logger.error('EmailHook: Invalid secret format, expected v1,whsec_<base64>');
    return false;
  }

  const secretBytes = Buffer.from(secretMatch[1], 'base64');

  // Verify timestamp is within tolerance (5 minutes)
  const timestamp = parseInt(webhookTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    logger.warn('EmailHook: Timestamp outside tolerance', { timestamp, now });
    return false;
  }

  // Build signed content
  const signedContent = `${webhookId}.${webhookTimestamp}.${payload}`;

  // Compute expected signature
  const expectedSig = createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64');

  // Parse signatures from header (format: v1,<sig1> v1,<sig2>)
  const signatures = webhookSignature.split(' ');

  for (const sig of signatures) {
    const [version, signature] = sig.split(',');
    if (version !== 'v1') continue;

    try {
      const expectedBuffer = Buffer.from(expectedSig);
      const actualBuffer = Buffer.from(signature);

      if (expectedBuffer.length === actualBuffer.length &&
          timingSafeEqual(expectedBuffer, actualBuffer)) {
        return true;
      }
    } catch {
      continue;
    }
  }

  logger.warn('EmailHook: No matching signature found');
  return false;
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const rawBody = await req.text();

    // Standard Webhooks headers
    const webhookHeaders = {
      webhookId: req.headers.get('webhook-id'),
      webhookTimestamp: req.headers.get('webhook-timestamp'),
      webhookSignature: req.headers.get('webhook-signature'),
    };

    // Verify the request is from Supabase
    if (HOOK_SECRET && !verifyWebhook(rawBody, webhookHeaders)) {
      logger.error('EmailHook: Invalid signature', { requestId });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload: EmailHookPayload = JSON.parse(rawBody);
    const { user, email_data } = payload;

    logger.authEvent('EmailHook: Received', user.id, requestId, { actionType: email_data.email_action_type, email: user.email });

    // Build the confirmation URL
    const baseUrl = email_data.site_url || process.env.NEXT_PUBLIC_APP_URL || 'https://codebakers.dev';
    const confirmUrl = `${baseUrl}/auth/confirm?token_hash=${email_data.token_hash}&type=${email_data.email_action_type}&redirect_to=${encodeURIComponent(email_data.redirect_to || '/dashboard')}`;

    let result;

    switch (email_data.email_action_type) {
      case 'signup':
        result = await EmailService.sendMagicLink(user.email, confirmUrl);
        break;

      case 'magiclink':
        result = await EmailService.sendMagicLink(user.email, confirmUrl);
        break;

      case 'recovery':
        result = await EmailService.sendPasswordReset(user.email, confirmUrl);
        break;

      case 'email_change':
        result = await EmailService.sendEmailChange(user.email, confirmUrl);
        break;

      case 'invite':
        result = await EmailService.sendInvite(user.email, confirmUrl);
        break;

      default:
        logger.warn('EmailHook: Unknown email action type', { requestId, actionType: email_data.email_action_type });
        return NextResponse.json({ error: 'Unknown email type' }, { status: 400 });
    }

    if (!result.success) {
      logger.error('EmailHook: Failed to send email', { requestId, error: result.error, email: user.email });
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    logger.authEvent('EmailHook: Email sent successfully', user.id, requestId, { emailId: result.id });
    return NextResponse.json({ success: true });

  } catch (error) {
    logger.error('EmailHook: Error', { requestId, error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
