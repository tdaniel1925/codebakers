import { db, profiles, teams } from '@/db';
import { eq, desc } from 'drizzle-orm';
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
      // Cancel Stripe subscription if exists
      if (team.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(team.stripeSubscriptionId);
        } catch (error) {
          console.error('Failed to cancel subscription:', error);
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
    const users = await db.select().from(profiles);
    const allTeams = await db.select().from(teams);

    const activeSubscriptions = allTeams.filter(
      (t) => t.subscriptionStatus === 'active'
    ).length;

    const betaUsers = allTeams.filter((t) => t.betaGrantedAt !== null).length;

    const suspendedUsers = allTeams.filter((t) => t.suspendedAt !== null).length;

    const planCounts = allTeams.reduce(
      (acc, t) => {
        if (t.subscriptionPlan) {
          acc[t.subscriptionPlan] = (acc[t.subscriptionPlan] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalUsers: users.length,
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
