import { db, trialFingerprints, TrialFingerprint } from '@/db';
import { eq, desc, and, gt, lt, sql, count } from 'drizzle-orm';

export type TrialStage = 'anonymous' | 'extended' | 'expired' | 'converted';

export interface TrialStatus {
  stage: TrialStage;
  daysRemaining: number;
  expiresAt: Date | null;
  canExtend: boolean;
  isExpired: boolean;
  githubUsername?: string | null;
  projectName?: string | null;
}

export interface TrialBannerData {
  stage: TrialStage;
  daysRemaining: number;
  canExtend: boolean;
  isExpiringSoon: boolean;
  isExpired: boolean;
  githubUsername?: string | null;
  projectName?: string | null;
}

export interface TrialStats {
  totalTrials: number;
  activeAnonymous: number;
  activeExtended: number;
  expiredTrials: number;
  convertedTrials: number;
  flaggedDevices: number;
  expiringToday: number;
  expiringThisWeek: number;
  conversionRate: number;
  extensionRate: number;
}

export class TrialService {
  /**
   * Get a trial by ID
   */
  static async getById(trialId: string): Promise<TrialFingerprint | null> {
    const trial = await db.query.trialFingerprints.findFirst({
      where: eq(trialFingerprints.id, trialId),
    });
    return trial || null;
  }

  /**
   * Get a trial by device hash
   */
  static async getByDeviceHash(deviceHash: string): Promise<TrialFingerprint | null> {
    const trial = await db.query.trialFingerprints.findFirst({
      where: eq(trialFingerprints.deviceHash, deviceHash),
    });
    return trial || null;
  }

  /**
   * Get a trial by GitHub ID
   */
  static async getByGithubId(githubId: string): Promise<TrialFingerprint | null> {
    const trial = await db.query.trialFingerprints.findFirst({
      where: eq(trialFingerprints.githubId, githubId),
    });
    return trial || null;
  }

  /**
   * Calculate days remaining for a trial
   */
  static calculateDaysRemaining(expiresAt: Date | null): number {
    if (!expiresAt) return 0;
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  /**
   * Check if a trial is expired
   */
  static isExpired(trial: TrialFingerprint): boolean {
    if (!trial.trialExpiresAt) return true;
    return new Date() > new Date(trial.trialExpiresAt);
  }

  /**
   * Get trial status
   */
  static getTrialStatus(trial: TrialFingerprint): TrialStatus {
    const isExpired = this.isExpired(trial);
    const daysRemaining = this.calculateDaysRemaining(trial.trialExpiresAt);
    const canExtend = trial.trialStage === 'anonymous' && !trial.githubId;

    return {
      stage: isExpired ? 'expired' : (trial.trialStage as TrialStage),
      daysRemaining,
      expiresAt: trial.trialExpiresAt,
      canExtend,
      isExpired,
      githubUsername: trial.githubUsername,
      projectName: trial.projectName,
    };
  }

  /**
   * Get trial banner data for UI
   */
  static getTrialBannerData(trial: TrialFingerprint): TrialBannerData {
    const status = this.getTrialStatus(trial);
    const isExpiringSoon = status.daysRemaining > 0 && status.daysRemaining <= 2;

    return {
      stage: status.stage,
      daysRemaining: status.daysRemaining,
      canExtend: status.canExtend,
      isExpiringSoon,
      isExpired: status.isExpired,
      githubUsername: status.githubUsername,
      projectName: status.projectName,
    };
  }

  /**
   * Get all trials with pagination
   */
  static async getAll(options: {
    page?: number;
    limit?: number;
    stage?: TrialStage;
    flagged?: boolean;
    expiringSoon?: boolean;
  }) {
    const { page = 1, limit = 50, stage, flagged, expiringSoon } = options;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (stage) {
      conditions.push(eq(trialFingerprints.trialStage, stage));
    }

    if (flagged !== undefined) {
      conditions.push(eq(trialFingerprints.flagged, flagged));
    }

    if (expiringSoon) {
      const now = new Date();
      const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      conditions.push(gt(trialFingerprints.trialExpiresAt, now));
      conditions.push(lt(trialFingerprints.trialExpiresAt, twoDaysFromNow));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const trials = await db.query.trialFingerprints.findMany({
      where: whereClause,
      orderBy: desc(trialFingerprints.createdAt),
      limit,
      offset,
    });

    // Get total count
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(trialFingerprints)
      .where(whereClause);

    return {
      trials,
      pagination: {
        page,
        limit,
        total: Number(total),
        pages: Math.ceil(Number(total) / limit),
      },
    };
  }

  /**
   * Flag a trial for abuse
   */
  static async flag(trialId: string, reason: string): Promise<TrialFingerprint | null> {
    const [trial] = await db
      .update(trialFingerprints)
      .set({
        flagged: true,
        flagReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(trialFingerprints.id, trialId))
      .returning();

    return trial || null;
  }

  /**
   * Unflag a trial
   */
  static async unflag(trialId: string): Promise<TrialFingerprint | null> {
    const [trial] = await db
      .update(trialFingerprints)
      .set({
        flagged: false,
        flagReason: null,
        updatedAt: new Date(),
      })
      .where(eq(trialFingerprints.id, trialId))
      .returning();

    return trial || null;
  }

  /**
   * Force expire a trial
   */
  static async forceExpire(trialId: string): Promise<TrialFingerprint | null> {
    const [trial] = await db
      .update(trialFingerprints)
      .set({
        trialStage: 'expired',
        trialExpiresAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(trialFingerprints.id, trialId))
      .returning();

    return trial || null;
  }

  /**
   * Mark a trial as converted when user subscribes
   * Links the trial fingerprint to the paid team
   */
  static async markAsConverted(
    teamId: string,
    identifier: { visitorId?: string; githubId?: string; email?: string }
  ): Promise<TrialFingerprint | null> {
    // Try to find trial by various identifiers
    let trial: TrialFingerprint | null = null;

    if (identifier.visitorId) {
      trial = await this.getByDeviceHash(identifier.visitorId);
    }

    if (!trial && identifier.githubId) {
      trial = await this.getByGithubId(identifier.githubId);
    }

    if (!trial && identifier.email) {
      const found = await db.query.trialFingerprints.findFirst({
        where: eq(trialFingerprints.email, identifier.email),
      });
      trial = found || null;
    }

    if (!trial) {
      return null; // No trial to convert (user might have gone straight to paid)
    }

    // Already converted
    if (trial.trialStage === 'converted') {
      return trial;
    }

    const [updated] = await db
      .update(trialFingerprints)
      .set({
        trialStage: 'converted',
        convertedToTeamId: teamId,
        convertedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(trialFingerprints.id, trial.id))
      .returning();

    return updated || null;
  }

  /**
   * Get trial by team ID (for users who converted)
   */
  static async getByTeamId(teamId: string): Promise<TrialFingerprint | null> {
    const trial = await db.query.trialFingerprints.findFirst({
      where: eq(trialFingerprints.convertedToTeamId, teamId),
    });
    return trial || null;
  }

  /**
   * Get trial statistics for admin dashboard
   */
  static async getStats(): Promise<TrialStats> {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get counts
    const [
      totalResult,
      anonymousResult,
      extendedResult,
      expiredResult,
      convertedResult,
      flaggedResult,
      expiringTodayResult,
      expiringWeekResult,
    ] = await Promise.all([
      // Total trials
      db.select({ value: count() }).from(trialFingerprints),
      // Active anonymous
      db
        .select({ value: count() })
        .from(trialFingerprints)
        .where(
          and(
            eq(trialFingerprints.trialStage, 'anonymous'),
            gt(trialFingerprints.trialExpiresAt, now)
          )
        ),
      // Active extended
      db
        .select({ value: count() })
        .from(trialFingerprints)
        .where(
          and(
            eq(trialFingerprints.trialStage, 'extended'),
            gt(trialFingerprints.trialExpiresAt, now)
          )
        ),
      // Expired
      db
        .select({ value: count() })
        .from(trialFingerprints)
        .where(eq(trialFingerprints.trialStage, 'expired')),
      // Converted
      db
        .select({ value: count() })
        .from(trialFingerprints)
        .where(eq(trialFingerprints.trialStage, 'converted')),
      // Flagged
      db
        .select({ value: count() })
        .from(trialFingerprints)
        .where(eq(trialFingerprints.flagged, true)),
      // Expiring today
      db
        .select({ value: count() })
        .from(trialFingerprints)
        .where(
          and(
            gt(trialFingerprints.trialExpiresAt, now),
            lt(trialFingerprints.trialExpiresAt, endOfDay)
          )
        ),
      // Expiring this week
      db
        .select({ value: count() })
        .from(trialFingerprints)
        .where(
          and(
            gt(trialFingerprints.trialExpiresAt, now),
            lt(trialFingerprints.trialExpiresAt, endOfWeek)
          )
        ),
    ]);

    const total = Number(totalResult[0]?.value || 0);
    const converted = Number(convertedResult[0]?.value || 0);
    const extended = Number(extendedResult[0]?.value || 0);
    const anonymous = Number(anonymousResult[0]?.value || 0);

    // Calculate rates (avoid division by zero)
    const conversionRate = total > 0 ? (converted / total) * 100 : 0;
    const extensionRate = total > 0 ? (extended / total) * 100 : 0;

    return {
      totalTrials: total,
      activeAnonymous: anonymous,
      activeExtended: extended,
      expiredTrials: Number(expiredResult[0]?.value || 0),
      convertedTrials: converted,
      flaggedDevices: Number(flaggedResult[0]?.value || 0),
      expiringToday: Number(expiringTodayResult[0]?.value || 0),
      expiringThisWeek: Number(expiringWeekResult[0]?.value || 0),
      conversionRate: Math.round(conversionRate * 10) / 10,
      extensionRate: Math.round(extensionRate * 10) / 10,
    };
  }
}
