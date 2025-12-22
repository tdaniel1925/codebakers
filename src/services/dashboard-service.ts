import { db, teams, apiKeys, profiles } from '@/db';
import { eq } from 'drizzle-orm';
import { TeamService } from './team-service';
import { ApiKeyService } from './api-key-service';
import { EmailService } from './email-service';

export class DashboardService {
  static async getStats(userId: string) {
    const team = await TeamService.getByOwnerId(userId);

    if (!team) {
      return {
        hasTeam: false,
        subscription: null,
        apiKeyCount: 0,
        lastApiCall: null,
      };
    }

    const keys = await ApiKeyService.listByTeam(team.id);
    const lastUsedKey = keys
      .filter((k) => k.lastUsedAt)
      .sort((a, b) =>
        b.lastUsedAt!.getTime() - a.lastUsedAt!.getTime()
      )[0];

    return {
      hasTeam: true,
      teamId: team.id,
      teamName: team.name,
      subscription: {
        plan: team.subscriptionPlan,
        status: team.subscriptionStatus,
        isBeta: !!team.betaGrantedAt,
      },
      apiKeyCount: keys.length,
      lastApiCall: lastUsedKey?.lastUsedAt || null,
      seatLimit: team.seatLimit,
      // Free trial project info
      freeTrialProject: team.freeTrialProjectId
        ? {
            id: team.freeTrialProjectId,
            name: team.freeTrialProjectName,
          }
        : null,
    };
  }

  static async getPrimaryKey(userId: string) {
    const team = await TeamService.getByOwnerId(userId);
    if (!team) return null;

    const keys = await ApiKeyService.listByTeam(team.id);
    return keys.find((k) => k.isActive) || null;
  }

  static async ensureTeamExists(userId: string, email: string) {
    let team = await TeamService.getByOwnerId(userId);

    if (!team) {
      // Create user profile if it doesn't exist
      const [existingProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);

      if (!existingProfile) {
        await db.insert(profiles).values({
          id: userId,
          email,
        });
      }

      // Create team for user
      const result = await TeamService.createForUser(
        userId,
        email.split('@')[0] + "'s Team"
      );
      team = result.team;

      // Send welcome email to new user (async, don't await)
      EmailService.sendWelcome(email, team.name).catch((err) => {
        console.error('[DashboardService] Failed to send welcome email:', err);
      });
    }

    return team;
  }
}
