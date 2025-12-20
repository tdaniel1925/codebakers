import { db, profiles, teams } from '@/db';
import { eq, desc, sql, isNotNull } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';

export class AdminService {
  static async setBetaTier(userId: string, enabled: boolean, reason?: string) {
    // Get user's team
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.ownerId, userId))
      .limit(1);

    if (!team) {
      throw new Error('User has no team');
    }

    if (enabled) {
      // Cancel Stripe subscription if exists - must succeed before granting beta
      if (team.stripeSubscriptionId) {
        try {
          const canceledSub = await stripe.subscriptions.cancel(team.stripeSubscriptionId);
          if (canceledSub.status !== 'canceled') {
            throw new Error(`Subscription status is ${canceledSub.status}, expected canceled`);
          }
        } catch (error) {
          console.error('Failed to cancel subscription:', error);
          throw new Error(
            `Cannot grant beta: failed to cancel existing Stripe subscription. ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Set beta access
      await db
        .update(teams)
        .set({
          subscriptionPlan: 'beta',
          subscriptionStatus: 'active',
          betaGrantedAt: new Date(),
          betaGrantedReason: reason || null,
          stripeSubscriptionId: null,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, team.id));
    } else {
      // Remove beta access
      await db
        .update(teams)
        .set({
          subscriptionPlan: null,
          subscriptionStatus: 'inactive',
          betaGrantedAt: null,
          betaGrantedReason: null,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, team.id));
    }

    return { success: true };
  }

  static async listUsers() {
    const users = await db.query.profiles.findMany({
      orderBy: desc(profiles.createdAt),
      with: {
        ownedTeams: true,
      },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      team: user.ownedTeams[0] || null,
    }));
  }

  static async getUserStats() {
    // Use aggregated queries instead of loading all records into memory
    const [{ count: totalUsers }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(profiles);

    const [{ count: activeSubscriptions }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(teams)
      .where(eq(teams.subscriptionStatus, 'active'));

    const [{ count: betaUsers }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(teams)
      .where(isNotNull(teams.betaGrantedAt));

    const [{ count: suspendedUsers }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(teams)
      .where(isNotNull(teams.suspendedAt));

    // Get plan counts with GROUP BY
    const planCountsResult = await db
      .select({
        plan: teams.subscriptionPlan,
        count: sql<number>`count(*)::int`,
      })
      .from(teams)
      .where(isNotNull(teams.subscriptionPlan))
      .groupBy(teams.subscriptionPlan);

    const planCounts = planCountsResult.reduce(
      (acc, { plan, count }) => {
        if (plan) {
          acc[plan] = count;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalUsers,
      activeSubscriptions,
      betaUsers,
      suspendedUsers,
      planCounts,
    };
  }

  static async setAdmin(userId: string, isAdmin: boolean) {
    const [profile] = await db
      .update(profiles)
      .set({
        isAdmin,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, userId))
      .returning();

    return profile;
  }

  static async suspendTeam(userId: string, reason: string) {
    // Get user's team
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.ownerId, userId))
      .limit(1);

    if (!team) {
      throw new Error('User has no team');
    }

    await db
      .update(teams)
      .set({
        suspendedAt: new Date(),
        suspendedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, team.id));

    return { success: true };
  }

  static async unsuspendTeam(userId: string) {
    // Get user's team
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.ownerId, userId))
      .limit(1);

    if (!team) {
      throw new Error('User has no team');
    }

    await db
      .update(teams)
      .set({
        suspendedAt: null,
        suspendedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, team.id));

    return { success: true };
  }

  static async getUser(userId: string) {
    const user = await db.query.profiles.findFirst({
      where: eq(profiles.id, userId),
      with: {
        ownedTeams: true,
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      team: user.ownedTeams[0] || null,
    };
  }

  static async updateTeamLimits(
    userId: string,
    data: { freeDownloadsLimit?: number; seatLimit?: number }
  ) {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.ownerId, userId))
      .limit(1);

    if (!team) {
      throw new Error('User has no team');
    }

    const [updated] = await db
      .update(teams)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, team.id))
      .returning();

    return updated;
  }

  static async resetTrialDownloads(userId: string) {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.ownerId, userId))
      .limit(1);

    if (!team) {
      throw new Error('User has no team');
    }

    await db
      .update(teams)
      .set({
        freeDownloadsUsed: 0,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, team.id));

    return { success: true };
  }
}
