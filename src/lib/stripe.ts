import Stripe from 'stripe';
import { CODEBAKERS_STATS } from './stats';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
});

export const PRICES = {
  pro: process.env.STRIPE_PRO_PRICE_ID!,
  team: process.env.STRIPE_TEAM_PRICE_ID!,
  agency: process.env.STRIPE_AGENCY_PRICE_ID!,
} as const;

export const PLANS = {
  beta: {
    name: 'Beta',
    price: 0,
    seats: 1,
    features: ['Full access', 'Admin-assigned only'],
  },
  pro: {
    name: 'Pro',
    price: 49,
    seats: 1,
    features: [`${CODEBAKERS_STATS.moduleCount} production modules`, 'Auto-testing', 'Full stack coverage'],
  },
  team: {
    name: 'Team',
    price: 149,
    seats: 5,
    features: ['Everything in Pro', '5 team seats', 'Team management'],
  },
  agency: {
    name: 'Agency',
    price: 349,
    seats: 999, // Effectively unlimited
    features: ['Everything in Team', 'Unlimited seats', 'White-label support'],
  },
  enterprise: {
    name: 'Enterprise',
    price: 0, // Custom pricing
    seats: 9999,
    features: ['Everything in Agency', 'Custom SLA', 'SSO/SAML', 'Invoice billing'],
  },
} as const;

export type PlanType = keyof typeof PLANS;
