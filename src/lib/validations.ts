import { z } from 'zod';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signupSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
});

// Team schemas
export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Name is too long'),
});

// API Key schemas
export const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long').optional(),
});

// Billing schemas
export const checkoutSchema = z.object({
  plan: z.enum(['pro', 'team', 'agency'], {
    errorMap: () => ({ message: 'Invalid plan selected' }),
  }),
});

// Admin schemas
export const setBetaSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().max(500, 'Reason is too long').optional(),
});

export const suspendSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().min(1, 'Reason is required when suspending').max(500, 'Reason is too long').optional(),
});

export const updateLimitsSchema = z.object({
  freeDownloadsLimit: z.number().int().min(0).max(1000).optional(),
  seatLimit: z.number().int().min(1).max(100).optional(),
});

// Types
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type SetBetaInput = z.infer<typeof setBetaSchema>;
export type SuspendInput = z.infer<typeof suspendSchema>;
export type UpdateLimitsInput = z.infer<typeof updateLimitsSchema>;
