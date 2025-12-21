/**
 * Update PayPal Plan IDs in Database
 * Run with: npx tsx scripts/update-paypal-plan-ids.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { db, subscriptionPricing } from '../src/db';
import { eq } from 'drizzle-orm';

const PAYPAL_PLAN_IDS = {
  pro: process.env.PAYPAL_PRO_PLAN_ID,
  team: process.env.PAYPAL_TEAM_PLAN_ID,
  agency: process.env.PAYPAL_AGENCY_PLAN_ID,
};

async function main() {
  console.log('========================================');
  console.log('Updating PayPal Plan IDs in Database');
  console.log('========================================\n');

  try {
    for (const [plan, paypalPlanId] of Object.entries(PAYPAL_PLAN_IDS)) {
      if (!paypalPlanId) {
        console.log(`Skipping ${plan}: No PayPal plan ID configured`);
        continue;
      }

      // Check if plan exists
      const [existing] = await db
        .select()
        .from(subscriptionPricing)
        .where(eq(subscriptionPricing.plan, plan as 'pro' | 'team' | 'agency'))
        .limit(1);

      if (existing) {
        // Update existing plan
        await db
          .update(subscriptionPricing)
          .set({
            paypalPlanId,
            updatedAt: new Date(),
          })
          .where(eq(subscriptionPricing.plan, plan as 'pro' | 'team' | 'agency'));

        console.log(`Updated ${plan} plan with PayPal ID: ${paypalPlanId}`);
      } else {
        // Create new plan
        const planConfig = {
          pro: {
            name: 'Pro',
            description: 'Perfect for solo developers',
            seats: 1,
            priceMonthly: 4900, // $49 in cents
            features: JSON.stringify([
              '34 production modules',
              '45,474 lines of patterns',
              'Auto-testing included',
              'Full stack coverage',
              '1 seat',
              'Email support',
            ]),
            displayOrder: 1,
          },
          team: {
            name: 'Team',
            description: 'For growing teams',
            seats: 5,
            priceMonthly: 14900, // $149 in cents
            features: JSON.stringify([
              'Everything in Pro',
              '5 team seats',
              'Team management dashboard',
              'Shared API keys',
              'Priority support',
              'Slack community',
            ]),
            displayOrder: 2,
          },
          agency: {
            name: 'Agency',
            description: 'For agencies & consultancies',
            seats: -1, // unlimited
            priceMonthly: 34900, // $349 in cents
            features: JSON.stringify([
              'Everything in Team',
              'Unlimited seats',
              'White-label support',
              'Custom patterns on request',
              'Dedicated support',
              'Training sessions',
            ]),
            displayOrder: 3,
          },
        }[plan];

        await db.insert(subscriptionPricing).values({
          plan: plan as 'pro' | 'team' | 'agency',
          ...planConfig,
          paypalPlanId,
          isActive: true,
        });

        console.log(`Created ${plan} plan with PayPal ID: ${paypalPlanId}`);
      }
    }

    console.log('\n========================================');
    console.log('SUCCESS! PayPal plan IDs updated.');
    console.log('========================================\n');
  } catch (error) {
    console.error('Update failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
