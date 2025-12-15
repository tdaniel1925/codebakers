import { db, teams, teamMembers, profiles } from '@/db';
import { eq, sql } from 'drizzle-orm';
import { ApiKeyService } from './api-key-service';

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

    // Create team
    const [team] = await db
      .insert(teams)
      .values({
        name,
        slug,
        ownerId: userId,
        seatLimit: 1,
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
      subscriptionPlan?: 'beta' | 'pro' | 'team' | 'agency' | null;
      seatLimit?: number;
    }
  ) {
    const [team] = await db
      .update(teams)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId))
      .returning();

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
   * Check if team can download (not suspended AND (has unlimited access OR has free downloads remaining))
   */
  static canDownload(team: {
    subscriptionStatus: string | null;
    betaGrantedAt: Date | null;
    freeDownloadsUsed: number | null;
    freeDownloadsLimit: number | null;
    suspendedAt: Date | null;
    suspendedReason: string | null;
  }): { allowed: boolean; reason?: string; remaining?: number; code?: string } {
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

    const used = team.freeDownloadsUsed ?? 0;
    const limit = team.freeDownloadsLimit ?? 3;
    const remaining = limit - used;

    if (remaining > 0) {
      return { allowed: true, remaining };
    }

    return {
      allowed: false,
      reason: `Free trial limit reached (${limit} downloads). Please upgrade to continue.`,
      remaining: 0,
      code: 'TRIAL_LIMIT_REACHED',
    };
  }

  /**
   * Increment free downloads counter (only for non-unlimited users)
   */
  static async incrementFreeDownloads(teamId: string): Promise<void> {
    await db
      .update(teams)
      .set({
        freeDownloadsUsed: sql`COALESCE(${teams.freeDownloadsUsed}, 0) + 1`,
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
    freeDownloadsUsed: number | null;
    freeDownloadsLimit: number | null;
  }): {
    type: 'unlimited' | 'trial' | 'expired';
    reason?: string;
    used?: number;
    limit?: number;
    remaining?: number;
  } {
    if (this.hasUnlimitedAccess(team)) {
      return {
        type: 'unlimited',
        reason: team.betaGrantedAt ? 'beta' : 'subscription',
      };
    }

    const used = team.freeDownloadsUsed ?? 0;
    const limit = team.freeDownloadsLimit ?? 3;
    const remaining = limit - used;

    if (remaining > 0) {
      return { type: 'trial', used, limit, remaining };
    }

    return { type: 'expired', used, limit, remaining: 0 };
  }
}
