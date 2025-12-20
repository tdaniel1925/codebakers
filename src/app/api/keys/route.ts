import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ApiKeyService } from '@/services/api-key-service';
import { TeamService } from '@/services/team-service';
import { handleApiError, successResponse, applyRateLimit, rateLimitConfigs } from '@/lib/api-utils';
import { createApiKeySchema } from '@/lib/validations';
import { NotFoundError, ValidationError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:keys:read', session.user.id);

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      throw new NotFoundError('Team');
    }

    const keys = await ApiKeyService.listByTeam(team.id);
    return successResponse(keys);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:keys:write', session.user.id, rateLimitConfigs.apiWrite);

    const body = await req.json();
    const { name } = createApiKeySchema.parse(body);

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      throw new NotFoundError('Team');
    }

    const apiKey = await ApiKeyService.create(team.id, name);
    return successResponse(apiKey, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:keys:write', session.user.id, rateLimitConfigs.apiWrite);

    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      throw new ValidationError('Key ID is required');
    }

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      throw new NotFoundError('Team');
    }

    await ApiKeyService.delete(keyId, team.id);
    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
