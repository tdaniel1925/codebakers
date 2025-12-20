import { SquareClient, SquareEnvironment } from 'square';
import crypto from 'crypto';
import { ExternalServiceError } from './errors';

// Validate environment variables at module load
if (!process.env.SQUARE_ACCESS_TOKEN) {
  console.warn('SQUARE_ACCESS_TOKEN is not set - Square payments will not work');
}

if (!process.env.SQUARE_LOCATION_ID) {
  console.warn('SQUARE_LOCATION_ID is not set - Square payments will not work');
}

// Initialize Square client
export const square = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN || '',
  environment: process.env.NODE_ENV === 'production'
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox,
});

export const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID || '';
export const SQUARE_WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '';

// Square subscription plan variation IDs (configured in Square Dashboard)
export const SQUARE_PLANS = {
  pro: process.env.SQUARE_PRO_PLAN_ID || '',
  team: process.env.SQUARE_TEAM_PLAN_ID || '',
  agency: process.env.SQUARE_AGENCY_PLAN_ID || '',
} as const;

export type SquarePlanType = keyof typeof SQUARE_PLANS;

/**
 * Create a Square customer
 */
export async function createSquareCustomer(
  email: string,
  teamId: string
): Promise<{ id: string } | null> {
  if (!process.env.SQUARE_ACCESS_TOKEN) {
    throw new ExternalServiceError('Square', 'Square is not configured');
  }

  try {
    const response = await square.customers.create({
      emailAddress: email,
      referenceId: teamId,
    });

    if (!response.customer?.id) {
      return null;
    }

    return { id: response.customer.id };
  } catch (error) {
    console.error('[Square] Failed to create customer:', error);
    throw new ExternalServiceError(
      'Square',
      error instanceof Error ? error.message : 'Failed to create customer'
    );
  }
}

/**
 * Create a Square subscription
 */
export async function createSquareSubscription(params: {
  customerId: string;
  planVariationId: string;
  teamId: string;
}): Promise<{ id: string; status?: string } | null> {
  if (!process.env.SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID) {
    throw new ExternalServiceError('Square', 'Square is not configured');
  }

  try {
    const response = await square.subscriptions.create({
      idempotencyKey: `sub-${params.teamId}-${Date.now()}`,
      locationId: SQUARE_LOCATION_ID,
      customerId: params.customerId,
      planVariationId: params.planVariationId,
      source: {
        name: 'CodeBakers Web',
      },
    });

    if (!response.subscription?.id) {
      return null;
    }

    return {
      id: response.subscription.id,
      status: response.subscription.status,
    };
  } catch (error) {
    console.error('[Square] Failed to create subscription:', error);
    throw new ExternalServiceError(
      'Square',
      error instanceof Error ? error.message : 'Failed to create subscription'
    );
  }
}

/**
 * Cancel a Square subscription
 */
export async function cancelSquareSubscription(
  subscriptionId: string
): Promise<{ id: string; status?: string } | null> {
  if (!process.env.SQUARE_ACCESS_TOKEN) {
    throw new ExternalServiceError('Square', 'Square is not configured');
  }

  try {
    const response = await square.subscriptions.cancel({
      subscriptionId,
    });

    if (!response.subscription?.id) {
      return null;
    }

    return {
      id: response.subscription.id,
      status: response.subscription.status,
    };
  } catch (error) {
    console.error('[Square] Failed to cancel subscription:', error);
    throw new ExternalServiceError(
      'Square',
      error instanceof Error ? error.message : 'Failed to cancel subscription'
    );
  }
}

/**
 * Get subscription details
 */
export async function getSquareSubscription(
  subscriptionId: string
): Promise<{ id: string; status?: string; customerId?: string } | null> {
  if (!process.env.SQUARE_ACCESS_TOKEN) {
    throw new ExternalServiceError('Square', 'Square is not configured');
  }

  try {
    const response = await square.subscriptions.get({
      subscriptionId,
    });

    if (!response.subscription?.id) {
      return null;
    }

    return {
      id: response.subscription.id,
      status: response.subscription.status,
      customerId: response.subscription.customerId,
    };
  } catch (error) {
    console.error('[Square] Failed to get subscription:', error);
    throw new ExternalServiceError(
      'Square',
      error instanceof Error ? error.message : 'Failed to get subscription'
    );
  }
}

/**
 * Verify Square webhook signature
 * @see https://developer.squareup.com/docs/webhooks/step3validate
 */
export function verifySquareWebhook(
  signature: string,
  body: string,
  webhookUrl: string
): boolean {
  if (!SQUARE_WEBHOOK_SIGNATURE_KEY) {
    console.error('[Square] Webhook signature key not configured');
    return false;
  }

  try {
    const combined = webhookUrl + body;
    const expectedSignature = crypto
      .createHmac('sha256', SQUARE_WEBHOOK_SIGNATURE_KEY)
      .update(combined)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('[Square] Webhook verification error:', error);
    return false;
  }
}
