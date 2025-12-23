import { db, apiKeys, teams, profiles } from '@/db';
import { eq, and } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function generateApiKey(): { key: string; prefix: string } {
  const prefix = 'cb_' + randomBytes(4).toString('hex');
  const secret = randomBytes(24).toString('hex');
  const key = `${prefix}_${secret}`;
  return { key, prefix };
}

export class ApiKeyService {
  static async create(teamId: string, name: string = 'Default') {
    const { key, prefix } = generateApiKey();
    const keyHash = hashApiKey(key);

    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        teamId,
        keyHash,
        keyPrefix: prefix,
        name,
        isActive: true,
      })
      .returning();

    // Return the full key only once (it can't be retrieved again)
    return {
      id: apiKey.id,
      key,
      prefix,
      name: apiKey.name,
      createdAt: apiKey.createdAt,
    };
  }

  static async validate(apiKey: string) {
    const keyHash = hashApiKey(apiKey);

    const [key] = await db
      .select({
        id: apiKeys.id,
        teamId: apiKeys.teamId,
        isActive: apiKeys.isActive,
        team: {
          id: teams.id,
          ownerId: teams.ownerId,
          subscriptionPlan: teams.subscriptionPlan,
          subscriptionStatus: teams.subscriptionStatus,
          betaGrantedAt: teams.betaGrantedAt,
          freeTrialProjectId: teams.freeTrialProjectId,
          freeTrialProjectName: teams.freeTrialProjectName,
          suspendedAt: teams.suspendedAt,
          suspendedReason: teams.suspendedReason,
          pinnedPatternVersion: teams.pinnedPatternVersion,
        },
        ownerName: profiles.fullName,
      })
      .from(apiKeys)
      .innerJoin(teams, eq(apiKeys.teamId, teams.id))
      .leftJoin(profiles, eq(teams.ownerId, profiles.id))
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);

    if (!key || !key.isActive) {
      return { valid: false, team: null, ownerName: null, apiKeyId: null };
    }

    // Update last used timestamp
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, key.id));

    return { valid: true, team: key.team, ownerName: key.ownerName, apiKeyId: key.id };
  }

  static async listByTeam(teamId: string) {
    return db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        name: apiKeys.name,
        isActive: apiKeys.isActive,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.teamId, teamId));
  }

  static async revoke(keyId: string, teamId: string) {
    const [key] = await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.teamId, teamId)))
      .returning();

    return key;
  }

  static async delete(keyId: string, teamId: string) {
    const [key] = await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.teamId, teamId)))
      .returning();

    return key;
  }
}
