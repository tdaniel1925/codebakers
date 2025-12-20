import {
  Client,
  Environment,
  LogLevel,
  OrdersController,
  PaymentsController,
} from '@paypal/paypal-server-sdk';
import { ExternalServiceError } from './errors';

// Validate environment variables at module load
if (!process.env.PAYPAL_CLIENT_ID) {
  console.warn('PAYPAL_CLIENT_ID is not set - PayPal payments will not work');
}

if (!process.env.PAYPAL_CLIENT_SECRET) {
  console.warn('PAYPAL_CLIENT_SECRET is not set - PayPal payments will not work');
}

// Initialize PayPal client
const paypalClient = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: process.env.PAYPAL_CLIENT_ID || '',
    oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
  },
  environment:
    process.env.NODE_ENV === 'production'
      ? Environment.Production
      : Environment.Sandbox,
  logging: {
    logLevel: LogLevel.Info,
    logRequest: { logBody: true },
    logResponse: { logHeaders: true },
  },
});

export const ordersController = new OrdersController(paypalClient);
export const paymentsController = new PaymentsController(paypalClient);

// PayPal subscription plan IDs (configured in PayPal Dashboard)
export const PAYPAL_PLANS = {
  pro: process.env.PAYPAL_PRO_PLAN_ID || '',
  team: process.env.PAYPAL_TEAM_PLAN_ID || '',
  agency: process.env.PAYPAL_AGENCY_PLAN_ID || '',
} as const;

export type PayPalPlanType = keyof typeof PAYPAL_PLANS;

/**
 * Get PayPal API base URL based on environment
 */
function getPayPalBaseUrl(): string {
  return process.env.NODE_ENV === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

/**
 * Get PayPal access token for API calls
 */
export async function getPayPalAccessToken(): Promise<string> {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    throw new ExternalServiceError('PayPal', 'PayPal is not configured');
  }

  try {
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

    const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('[PayPal] Failed to get access token:', error);
    throw new ExternalServiceError(
      'PayPal',
      error instanceof Error ? error.message : 'Failed to get access token'
    );
  }
}

/**
 * Create a PayPal subscription
 */
export async function createPayPalSubscription(params: {
  planId: string;
  teamId: string;
  returnUrl: string;
  cancelUrl: string;
  email?: string;
}): Promise<{ id: string; status: string; links: Array<{ rel: string; href: string }> }> {
  try {
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${getPayPalBaseUrl()}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        plan_id: params.planId,
        custom_id: params.teamId,
        application_context: {
          brand_name: 'CodeBakers',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
        },
        subscriber: params.email ? {
          email_address: params.email,
        } : undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || errorData.error_description || `HTTP ${response.status}`
      );
    }

    return response.json();
  } catch (error) {
    console.error('[PayPal] Failed to create subscription:', error);
    if (error instanceof ExternalServiceError) throw error;
    throw new ExternalServiceError(
      'PayPal',
      error instanceof Error ? error.message : 'Failed to create subscription'
    );
  }
}

/**
 * Get PayPal subscription details
 */
export async function getPayPalSubscription(
  subscriptionId: string
): Promise<{ id: string; status: string; custom_id?: string }> {
  try {
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${getPayPalBaseUrl()}/v1/billing/subscriptions/${subscriptionId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || errorData.error_description || `HTTP ${response.status}`
      );
    }

    return response.json();
  } catch (error) {
    console.error('[PayPal] Failed to get subscription:', error);
    if (error instanceof ExternalServiceError) throw error;
    throw new ExternalServiceError(
      'PayPal',
      error instanceof Error ? error.message : 'Failed to get subscription'
    );
  }
}

/**
 * Cancel a PayPal subscription
 */
export async function cancelPayPalSubscription(
  subscriptionId: string,
  reason?: string
): Promise<boolean> {
  try {
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${getPayPalBaseUrl()}/v1/billing/subscriptions/${subscriptionId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          reason: reason || 'Cancelled by user',
        }),
      }
    );

    if (!response.ok && response.status !== 204) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || errorData.error_description || `HTTP ${response.status}`
      );
    }

    return true;
  } catch (error) {
    console.error('[PayPal] Failed to cancel subscription:', error);
    if (error instanceof ExternalServiceError) throw error;
    throw new ExternalServiceError(
      'PayPal',
      error instanceof Error ? error.message : 'Failed to cancel subscription'
    );
  }
}

/**
 * Verify PayPal webhook signature
 * @see https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature
 */
export async function verifyPayPalWebhook(params: {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
  webhookId: string;
  webhookEvent: object;
}): Promise<boolean> {
  try {
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${getPayPalBaseUrl()}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          auth_algo: params.authAlgo,
          cert_url: params.certUrl,
          transmission_id: params.transmissionId,
          transmission_sig: params.transmissionSig,
          transmission_time: params.transmissionTime,
          webhook_id: params.webhookId,
          webhook_event: params.webhookEvent,
        }),
      }
    );

    if (!response.ok) {
      console.error('[PayPal] Webhook verification request failed:', response.status);
      return false;
    }

    const data = await response.json();
    return data.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('[PayPal] Webhook verification error:', error);
    return false;
  }
}
