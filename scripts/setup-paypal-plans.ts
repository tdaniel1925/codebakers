/**
 * PayPal Subscription Plans Setup Script
 * Run with: npx tsx scripts/setup-paypal-plans.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

// Use sandbox for testing, production for live
const PAYPAL_BASE_URL = 'https://api-m.sandbox.paypal.com';
// const PAYPAL_BASE_URL = 'https://api-m.paypal.com'; // Uncomment for production

interface PlanConfig {
  name: string;
  description: string;
  price: string;
  seats: number;
}

const PLANS: Record<string, PlanConfig> = {
  pro: {
    name: 'CodeBakers Pro',
    description: 'Perfect for solo developers - 34 modules, 1 seat',
    price: '49.00',
    seats: 1,
  },
  team: {
    name: 'CodeBakers Team',
    description: 'For growing teams - 34 modules, 5 seats',
    price: '149.00',
    seats: 5,
  },
  agency: {
    name: 'CodeBakers Agency',
    description: 'For agencies - 34 modules, unlimited seats',
    price: '349.00',
    seats: -1,
  },
};

async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function createProduct(accessToken: string): Promise<string> {
  console.log('Creating CodeBakers product...');

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/catalogs/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'PayPal-Request-Id': `product-${Date.now()}`,
    },
    body: JSON.stringify({
      name: 'CodeBakers Patterns',
      description: 'Production-ready code patterns for AI-assisted development',
      type: 'SERVICE',
      category: 'SOFTWARE',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create product: ${error}`);
  }

  const data = await response.json();
  console.log(`Product created: ${data.id}`);
  return data.id;
}

async function createPlan(
  accessToken: string,
  productId: string,
  planKey: string,
  config: PlanConfig
): Promise<string> {
  console.log(`Creating ${config.name} plan...`);

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'PayPal-Request-Id': `plan-${planKey}-${Date.now()}`,
    },
    body: JSON.stringify({
      product_id: productId,
      name: config.name,
      description: config.description,
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: {
            interval_unit: 'MONTH',
            interval_count: 1,
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // Infinite
          pricing_scheme: {
            fixed_price: {
              value: config.price,
              currency_code: 'USD',
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: {
          value: '0',
          currency_code: 'USD',
        },
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create ${planKey} plan: ${error}`);
  }

  const data = await response.json();
  console.log(`${config.name} plan created: ${data.id}`);
  return data.id;
}

async function main() {
  console.log('========================================');
  console.log('PayPal Subscription Plans Setup');
  console.log('========================================\n');

  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    console.error('ERROR: Missing PayPal credentials in .env.local');
    process.exit(1);
  }

  try {
    // Get access token
    console.log('Authenticating with PayPal...');
    const accessToken = await getAccessToken();
    console.log('Authentication successful!\n');

    // Create product
    const productId = await createProduct(accessToken);
    console.log('');

    // Create plans
    const planIds: Record<string, string> = {};

    for (const [key, config] of Object.entries(PLANS)) {
      planIds[key] = await createPlan(accessToken, productId, key, config);
    }

    // Output results
    console.log('\n========================================');
    console.log('SUCCESS! Add these to your .env.local:');
    console.log('========================================\n');
    console.log(`PAYPAL_PRO_PLAN_ID=${planIds.pro}`);
    console.log(`PAYPAL_TEAM_PLAN_ID=${planIds.team}`);
    console.log(`PAYPAL_AGENCY_PLAN_ID=${planIds.agency}`);
    console.log('\n========================================');
    console.log('Next Steps:');
    console.log('========================================');
    console.log('1. Copy the plan IDs above to your .env.local');
    console.log('2. Set up a webhook at developer.paypal.com:');
    console.log('   - URL: https://yourdomain.com/api/webhooks/paypal');
    console.log('   - Events: BILLING.SUBSCRIPTION.* and PAYMENT.SALE.*');
    console.log('3. Add the Webhook ID to PAYPAL_WEBHOOK_ID in .env.local');
    console.log('========================================\n');

    return planIds;
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

main();
