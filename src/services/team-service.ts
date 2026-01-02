import { db, teams, teamMembers, profiles, PaymentProvider } from '@/db';
import { eq, sql } from 'drizzle-orm';
import { ApiKeyService } from './api-key-service';
import { TRIAL } from '@/lib/constants';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') +
    '-' +
    Math.random().toString(36).substring(2, 8);
}

export class TeamService {
  static async createForUser(userId: string, name: string) {
    const slug = generateSlug(name);

    // Calculate trial expiration (7 days from now)
    const trialExpiresAt = new Date();
    trialExpiresAt.setDate(trialExpiresAt.getDate() + TRIAL.ANONYMOUS_DAYS);

    // Create team
    const [team] = await db
      .insert(teams)
      .values({
        name,
        slug,
        ownerId: userId,
        seatLimit: 1,
        freeTrialExpiresAt: trialExpiresAt,
      })
      .returning();

    // Add owner as member
    await db.insert(teamMembers).values({
      teamId: team.id,
      userId,
      role: 'owner',
      joinedAt: new Date(),
    });

    // Create default API key
    const apiKey = await ApiKeyService.create(team.id);

    return { team, apiKey };
  }

  static async getByOwnerId(ownerId: string) {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.ownerId, ownerId))
      .limit(1);

    return team;
  }

  static async getById(teamId: string) {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    return team;
  }

  static async getWithMembers(teamId: string) {
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
      with: {
        members: {
          with: {
            user: true,
          },
        },
      },
    });

    return team;
  }

  static async hasActiveSubscription(teamId: string): Promise<boolean> {
    const team = await this.getById(teamId);
    if (!team) return false;

    // Beta users have access
    if (team.betaGrantedAt) return true;

    // Active subscription
    return team.subscriptionStatus === 'active';
  }

  static async updateStripeInfo(
    teamId: string,
    data: {
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      subscriptionStatus?: string;
      subscriptionPlan?: 'beta' | 'pro' | 'team' | 'agency' | 'enterprise' | null;
      seatLimit?: number;
    }
  ) {
    const [team] = await db
      .update(teams)
      .set({
        ...data,
        paymentProvider: 'stripe',
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId))
      .returning();

    return team;
  }

  /**
   * Update Square subscription info
   */
  static async updateSquareInfo(
    teamId: string,
    data: {
      squareCustomerId?: string;
      squareSubscriptionId?: string;
      subscriptionStatus?: string;
      subscriptionPlan?: 'beta' | 'pro' | 'team' | 'agency' | 'enterprise' | null;
      seatLimit?: number;
    }
  ) {
    const [team] = await db
      .update(teams)
      .set({
        ...data,
        paymentProvider: 'square',
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId))
      .returning();

    return team;
  }

  /**
   * Update PayPal subscription info
   */
  static async updatePayPalInfo(
    teamId: string,
    data: {
      paypalSubscriptionId?: string;
      subscriptionStatus?: string;
      subscriptionPlan?: 'beta' | 'pro' | 'team' | 'agency' | 'enterprise' | null;
      seatLimit?: number;
    }
  ) {
    const [team] = await db
      .update(teams)
      .set({
        ...data,
        paymentProvider: 'paypal',
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId))
      .returning();

    return team;
  }

  /**
   * Generic subscription update (provider-agnostic)
   */
  static async updateSubscription(
    teamId: string,
    provider: PaymentProvider,
    data: {
      subscriptionId: string;
      customerId?: string;
      subscriptionStatus: string;
      subscriptionPlan: 'pro' | 'team' | 'agency';
      seatLimit: number;
    }
  ) {
    const updateData: Record<string, unknown> = {
      paymentProvider: provider,
      subscriptionStatus: data.subscriptionStatus,
      subscriptionPlan: data.subscriptionPlan,
      seatLimit: data.seatLimit,
      updatedAt: new Date(),
    };

    switch (provider) {
      case 'stripe':
        updateData.stripeSubscriptionId = data.subscriptionId;
        if (data.customerId) updateData.stripeCustomerId = data.customerId;
        break;
      case 'square':
        updateData.squareSubscriptionId = data.subscriptionId;
        if (data.customerId) updateData.squareCustomerId = data.customerId;
        break;
      case 'paypal':
        updateData.paypalSubscriptionId = data.subscriptionId;
        break;
    }

    const [team] = await db
      .update(teams)
      .set(updateData)
      .where(eq(teams.id, teamId))
      .returning();

    return team;
  }

  /**
   * Cancel subscription (clear provider-specific fields)
   */
  static async cancelSubscription(teamId: string) {
    const [team] = await db
      .update(teams)
      .set({
        subscriptionStatus: 'canceled',
        subscriptionPlan: null,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId))
      .returning();

    return team;
  }

  /**
   * Get team by Square customer ID
   */
  static async getBySquareCustomerId(customerId: string) {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.squareCustomerId, customerId))
      .limit(1);

    return team;
  }

  /**
   * Get team by PayPal subscription ID
   */
  static async getByPayPalSubscriptionId(subscriptionId: string) {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.paypalSubscriptionId, subscriptionId))
      .limit(1);

    return team;
  }

  /**
   * Check if team has unlimited access (paid subscription or admin-granted beta)
   */
  static hasUnlimitedAccess(team: {
    subscriptionStatus: string | null;
    betaGrantedAt: Date | null;
  }): boolean {
    return team.subscriptionStatus === 'active' || team.betaGrantedAt !== null;
  }

  /**
   * Check if team is suspended
   */
  static isSuspended(team: { suspendedAt: Date | null }): boolean {
    return team.suspendedAt !== null;
  }

  /**
   * Check if team can access content for a given project
   * Free trial: 7 days, locked to ONE project
   */
  static canAccessProject(
    team: {
      subscriptionStatus: string | null;
      betaGrantedAt: Date | null;
      freeTrialProjectId: string | null;
      freeTrialExpiresAt?: Date | null; // Optional for backwards compatibility
      suspendedAt: Date | null;
      suspendedReason: string | null;
    },
    projectId: string | null
  ): {
    allowed: boolean;
    reason?: string;
    code?: string;
    isNewProject?: boolean;
    lockedProjectId?: string | null;
    trialExpired?: boolean;
    daysRemaining?: number;
  } {
    // Check suspension first
    if (this.isSuspended(team)) {
      return {
        allowed: false,
        reason: team.suspendedReason || 'Your account has been suspended. Please contact support.',
        code: 'ACCOUNT_SUSPENDED',
      };
    }

    // Unlimited access: paid subscription or admin-granted beta
    if (this.hasUnlimitedAccess(team)) {
      return { allowed: true };
    }

    // Check if free trial has expired
    if (team.freeTrialExpiresAt && new Date() > new Date(team.freeTrialExpiresAt)) {
      return {
        allowed: false,
        reason: 'Your free trial has expired. Upgrade to Pro to continue using CodeBakers.',
        code: 'TRIAL_EXPIRED',
        trialExpired: true,
      };
    }

    // Calculate days remaining for trial users
    const daysRemaining = team.freeTrialExpiresAt
      ? Math.max(0, Math.ceil((new Date(team.freeTrialExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : undefined;

    // Free trial: check project lock
    // If no project ID provided, allow (for backwards compatibility)
    if (!projectId) {
      return { allowed: true, daysRemaining };
    }

    // First project usage - will be locked to this project
    if (!team.freeTrialProjectId) {
      return { allowed: true, isNewProject: true, daysRemaining };
    }

    // Check if same project
    if (team.freeTrialProjectId === projectId) {
      return { allowed: true, daysRemaining };
    }

    // Different project - not allowed on free trial
    return {
      allowed: false,
      reason: 'Free trial is limited to one project. Upgrade to Pro for unlimited projects.',
      code: 'TRIAL_PROJECT_LIMIT',
      lockedProjectId: team.freeTrialProjectId,
      daysRemaining,
    };
  }

  /**
   * Lock free trial to a specific project
   */
  static async setFreeTrialProject(
    teamId: string,
    projectId: string,
    projectName: string
  ): Promise<void> {
    await db
      .update(teams)
      .set({
        freeTrialProjectId: projectId,
        freeTrialProjectName: projectName,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId));
  }

  /**
   * Get trial status for a team
   */
  static getTrialStatus(team: {
    subscriptionStatus: string | null;
    betaGrantedAt: Date | null;
    freeTrialProjectId: string | null;
    freeTrialProjectName: string | null;
  }): {
    type: 'unlimited' | 'trial' | 'trial_locked';
    reason?: string;
    projectName?: string | null;
  } {
    if (this.hasUnlimitedAccess(team)) {
      return {
        type: 'unlimited',
        reason: team.betaGrantedAt ? 'beta' : 'subscription',
      };
    }

    if (team.freeTrialProjectId) {
      return {
        type: 'trial_locked',
        projectName: team.freeTrialProjectName,
      };
    }

    return { type: 'trial' };
  }
}
