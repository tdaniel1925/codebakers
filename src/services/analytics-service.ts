import { db, patternUsage } from '@/db';
import { eq, and, gte, sql, desc, count } from 'drizzle-orm';

export interface PatternUsageStats {
  totalFetches: number;
  uniquePatterns: number;
  topPatterns: { name: string; count: number }[];
  usageByDay: { date: string; count: number }[];
}

export interface UsageTrend {
  date: string;
  count: number;
}

export class AnalyticsService {
  /**
   * Log a pattern fetch event
   */
  static async logPatternFetch(
    teamId: string,
    patternName: string,
    apiKeyId?: string
  ): Promise<void> {
    await db.insert(patternUsage).values({
      teamId,
      patternName,
      apiKeyId: apiKeyId || null,
    });
  }

  /**
   * Log multiple pattern fetches at once
   */
  static async logPatternFetches(
    teamId: string,
    patternNames: string[],
    apiKeyId?: string
  ): Promise<void> {
    if (patternNames.length === 0) return;

    const values = patternNames.map((patternName) => ({
      teamId,
      patternName,
      apiKeyId: apiKeyId || null,
    }));

    await db.insert(patternUsage).values(values);
  }

  /**
   * Get usage statistics for a team over the past N days
   */
  static async getUsageStats(
    teamId: string,
    days: number = 30
  ): Promise<PatternUsageStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get total fetches
    const [totalResult] = await db
      .select({ count: count() })
      .from(patternUsage)
      .where(
        and(
          eq(patternUsage.teamId, teamId),
          gte(patternUsage.fetchedAt, startDate)
        )
      );

    // Get unique patterns count
    const uniqueResult = await db
      .selectDistinct({ patternName: patternUsage.patternName })
      .from(patternUsage)
      .where(
        and(
          eq(patternUsage.teamId, teamId),
          gte(patternUsage.fetchedAt, startDate)
        )
      );

    // Get top patterns
    const topPatterns = await this.getTopPatterns(teamId, days, 10);

    // Get usage by day
    const usageByDay = await this.getUsageByDay(teamId, days);

    return {
      totalFetches: totalResult?.count || 0,
      uniquePatterns: uniqueResult.length,
      topPatterns,
      usageByDay,
    };
  }

  /**
   * Get top N patterns by usage for a team
   */
  static async getTopPatterns(
    teamId: string,
    days: number = 30,
    limit: number = 10
  ): Promise<{ name: string; count: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await db
      .select({
        name: patternUsage.patternName,
        count: count(),
      })
      .from(patternUsage)
      .where(
        and(
          eq(patternUsage.teamId, teamId),
          gte(patternUsage.fetchedAt, startDate)
        )
      )
      .groupBy(patternUsage.patternName)
      .orderBy(desc(count()))
      .limit(limit);

    return results.map((r) => ({
      name: r.name,
      count: Number(r.count),
    }));
  }

  /**
   * Get pattern usage grouped by day
   */
  static async getUsageByDay(
    teamId: string,
    days: number = 30
  ): Promise<UsageTrend[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await db
      .select({
        date: sql<string>`DATE(${patternUsage.fetchedAt})`,
        count: count(),
      })
      .from(patternUsage)
      .where(
        and(
          eq(patternUsage.teamId, teamId),
          gte(patternUsage.fetchedAt, startDate)
        )
      )
      .groupBy(sql`DATE(${patternUsage.fetchedAt})`)
      .orderBy(sql`DATE(${patternUsage.fetchedAt})`);

    return results.map((r) => ({
      date: r.date,
      count: Number(r.count),
    }));
  }

  /**
   * Get total lifetime usage for a team
   */
  static async getTotalUsage(teamId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(patternUsage)
      .where(eq(patternUsage.teamId, teamId));

    return result?.count || 0;
  }

  /**
   * Get usage for a specific pattern
   */
  static async getPatternUsage(
    teamId: string,
    patternName: string,
    days: number = 30
  ): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [result] = await db
      .select({ count: count() })
      .from(patternUsage)
      .where(
        and(
          eq(patternUsage.teamId, teamId),
          eq(patternUsage.patternName, patternName),
          gte(patternUsage.fetchedAt, startDate)
        )
      );

    return result?.count || 0;
  }

  /**
   * Get estimated time saved based on pattern usage
   * Assumes each pattern fetch saves ~15 minutes on average
   */
  static async getEstimatedTimeSaved(
    teamId: string,
    days: number = 30
  ): Promise<{ hours: number; minutes: number }> {
    const totalFetches = await this.getTotalUsageForPeriod(teamId, days);
    const minutesSaved = totalFetches * 15; // 15 minutes per pattern

    return {
      hours: Math.floor(minutesSaved / 60),
      minutes: minutesSaved % 60,
    };
  }

  /**
   * Get total usage for a specific time period
   */
  private static async getTotalUsageForPeriod(
    teamId: string,
    days: number
  ): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [result] = await db
      .select({ count: count() })
      .from(patternUsage)
      .where(
        and(
          eq(patternUsage.teamId, teamId),
          gte(patternUsage.fetchedAt, startDate)
        )
      );

    return result?.count || 0;
  }
}
