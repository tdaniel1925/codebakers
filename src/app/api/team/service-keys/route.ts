import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { TeamService } from '@/services/team-service';
import { handleApiError, successResponse, applyRateLimit } from '@/lib/api-utils';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { db } from '@/db';
import { teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SERVICE_KEYS, SERVICE_KEY_CONFIGS, type ServiceKeyName } from '@/lib/contracts/service-keys';

export const dynamic = 'force-dynamic';

// Type for stored keys
type ServiceKeysRecord = Partial<Record<ServiceKeyName, string>>;

/**
 * Mask a key for display (show first 4 and last 4 chars)
 */
function maskKey(key: string | undefined): string | null {
  if (!key) return null;
  if (key.length <= 12) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/**
 * GET /api/team/service-keys
 * Get ALL service keys (masked for security)
 * Returns all 14 supported keys with their configuration status
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:team:service-keys:read', session.user.id);

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Parse stored keys
    let storedKeys: ServiceKeysRecord = {};
    if (team.serviceKeys) {
      try {
        storedKeys = JSON.parse(team.serviceKeys);
      } catch {
        storedKeys = {};
      }
    }

    // Build response with ALL service keys from the contract
    const response: Record<ServiceKeyName, {
      configured: boolean;
      masked: string | null;
      label: string;
      category: string;
      helpUrl: string;
      cliSync: boolean;
    }> = {} as any;

    for (const keyName of SERVICE_KEYS) {
      const config = SERVICE_KEY_CONFIGS[keyName];
      const value = storedKeys[keyName];

      response[keyName] = {
        configured: !!value,
        masked: maskKey(value),
        label: config.label,
        category: config.category,
        helpUrl: config.helpUrl,
        cliSync: config.cliSync,
      };
    }

    return successResponse(response);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/team/service-keys
 * Update service keys (supports all 14 keys)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:team:service-keys:write', session.user.id);

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      throw new NotFoundError('Team');
    }

    const body = await req.json();

    // Validate that at least one valid key is provided
    const providedKeys = SERVICE_KEYS.filter(keyName => keyName in body);
    if (providedKeys.length === 0) {
      throw new ValidationError('At least one service key must be provided');
    }

    // Parse existing keys to merge (so we don't overwrite unset keys)
    let existingKeys: ServiceKeysRecord = {};
    if (team.serviceKeys) {
      try {
        existingKeys = JSON.parse(team.serviceKeys);
      } catch {
        existingKeys = {};
      }
    }

    // Merge - only update keys that were explicitly provided
    const updatedKeys: ServiceKeysRecord = { ...existingKeys };

    for (const keyName of SERVICE_KEYS) {
      if (keyName in body) {
        const value = body[keyName];
        if (value === null || value === '') {
          delete updatedKeys[keyName];
        } else if (typeof value === 'string') {
          updatedKeys[keyName] = value;
        }
      }
    }

    // Save to database
    await db.update(teams)
      .set({
        serviceKeys: Object.keys(updatedKeys).length > 0 ? JSON.stringify(updatedKeys) : null,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, team.id));

    // Build response showing which keys are now configured
    const response: Record<string, { configured: boolean }> = {};
    for (const keyName of SERVICE_KEYS) {
      response[keyName] = { configured: !!updatedKeys[keyName] };
    }

    return successResponse({
      message: 'Service keys updated',
      keys: response,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/team/service-keys
 * Clear specific service keys or all keys
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:team:service-keys:write', session.user.id);

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      throw new NotFoundError('Team');
    }

    const { searchParams } = new URL(req.url);
    const service = searchParams.get('service'); // any key name, or 'all'

    if (!service) {
      throw new ValidationError('Service parameter required (key name or "all")');
    }

    if (service === 'all') {
      // Clear all keys
      await db.update(teams)
        .set({
          serviceKeys: null,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, team.id));
    } else {
      // Validate service name
      if (!SERVICE_KEYS.includes(service as ServiceKeyName)) {
        throw new ValidationError(`Invalid service name: ${service}. Valid names: ${SERVICE_KEYS.join(', ')}`);
      }

      // Clear specific key
      let existingKeys: ServiceKeysRecord = {};
      if (team.serviceKeys) {
        try {
          existingKeys = JSON.parse(team.serviceKeys);
        } catch {
          existingKeys = {};
        }
      }

      delete existingKeys[service as ServiceKeyName];

      await db.update(teams)
        .set({
          serviceKeys: Object.keys(existingKeys).length > 0 ? JSON.stringify(existingKeys) : null,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, team.id));
    }

    return successResponse({ message: `Service key(s) cleared` });
  } catch (error) {
    return handleApiError(error);
  }
}
