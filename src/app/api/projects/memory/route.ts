import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projectMemory, teams, apiKeys } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/memory
 * Fetch project memory for a specific project
 *
 * Headers:
 * - Authorization: Bearer <api_key>
 * - x-project-id: <project_hash>
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);

    // Authenticate
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const apiKey = authHeader.slice(7);

    // Get team from API key
    const keyRecord = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.keyPlain, apiKey),
      with: { team: true },
    });

    if (!keyRecord?.team) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const projectHash = req.headers.get('x-project-id');
    if (!projectHash) {
      return NextResponse.json({ error: 'Missing x-project-id header' }, { status: 400 });
    }

    // Find project memory
    const memory = await db.query.projectMemory.findFirst({
      where: and(
        eq(projectMemory.teamId, keyRecord.team.id),
        eq(projectMemory.projectHash, projectHash)
      ),
    });

    if (!memory) {
      // Return empty memory structure if not found
      return NextResponse.json({
        exists: false,
        memory: {
          stackDecisions: {},
          namingConventions: {},
          architecturePatterns: {},
          fileStructure: {},
          projectRules: {},
          lockedDependencies: [],
          detectedConflicts: [],
        },
      });
    }

    return NextResponse.json({
      exists: true,
      memory: {
        id: memory.id,
        projectHash: memory.projectHash,
        projectName: memory.projectName,
        stackDecisions: JSON.parse(memory.stackDecisions || '{}'),
        namingConventions: JSON.parse(memory.namingConventions || '{}'),
        architecturePatterns: JSON.parse(memory.architecturePatterns || '{}'),
        fileStructure: JSON.parse(memory.fileStructure || '{}'),
        projectRules: JSON.parse(memory.projectRules || '{}'),
        lockedDependencies: JSON.parse(memory.lockedDependencies || '[]'),
        detectedConflicts: JSON.parse(memory.detectedConflicts || '[]'),
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/projects/memory
 * Create or update project memory
 *
 * Body:
 * - projectHash: string
 * - projectName?: string
 * - stackDecisions?: object
 * - namingConventions?: object
 * - architecturePatterns?: object
 * - fileStructure?: object
 * - projectRules?: object
 * - lockedDependencies?: string[]
 * - detectedConflicts?: object[]
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);

    // Authenticate
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const apiKey = authHeader.slice(7);

    // Get team from API key
    const keyRecord = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.keyPlain, apiKey),
      with: { team: true },
    });

    if (!keyRecord?.team) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await req.json();
    const { projectHash, projectName, ...updates } = body;

    if (!projectHash) {
      return NextResponse.json({ error: 'Missing projectHash' }, { status: 400 });
    }

    // Check for existing memory
    const existing = await db.query.projectMemory.findFirst({
      where: and(
        eq(projectMemory.teamId, keyRecord.team.id),
        eq(projectMemory.projectHash, projectHash)
      ),
    });

    if (existing) {
      // Update existing memory
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (projectName) updateData.projectName = projectName;
      if (updates.stackDecisions) {
        // Merge with existing stack decisions
        const currentStack = JSON.parse(existing.stackDecisions || '{}');
        updateData.stackDecisions = JSON.stringify({ ...currentStack, ...updates.stackDecisions });
      }
      if (updates.namingConventions) {
        const current = JSON.parse(existing.namingConventions || '{}');
        updateData.namingConventions = JSON.stringify({ ...current, ...updates.namingConventions });
      }
      if (updates.architecturePatterns) {
        const current = JSON.parse(existing.architecturePatterns || '{}');
        updateData.architecturePatterns = JSON.stringify({ ...current, ...updates.architecturePatterns });
      }
      if (updates.fileStructure) {
        const current = JSON.parse(existing.fileStructure || '{}');
        updateData.fileStructure = JSON.stringify({ ...current, ...updates.fileStructure });
      }
      if (updates.projectRules) {
        const current = JSON.parse(existing.projectRules || '{}');
        updateData.projectRules = JSON.stringify({ ...current, ...updates.projectRules });
      }
      if (updates.lockedDependencies) {
        const current = JSON.parse(existing.lockedDependencies || '[]');
        const merged = [...new Set([...current, ...updates.lockedDependencies])];
        updateData.lockedDependencies = JSON.stringify(merged);
      }
      if (updates.detectedConflicts) {
        updateData.detectedConflicts = JSON.stringify(updates.detectedConflicts);
      }

      await db.update(projectMemory)
        .set(updateData)
        .where(eq(projectMemory.id, existing.id));

      return NextResponse.json({ success: true, action: 'updated' });
    } else {
      // Create new memory
      await db.insert(projectMemory).values({
        teamId: keyRecord.team.id,
        projectHash,
        projectName: projectName || 'Unknown Project',
        stackDecisions: JSON.stringify(updates.stackDecisions || {}),
        namingConventions: JSON.stringify(updates.namingConventions || {}),
        architecturePatterns: JSON.stringify(updates.architecturePatterns || {}),
        fileStructure: JSON.stringify(updates.fileStructure || {}),
        projectRules: JSON.stringify(updates.projectRules || {}),
        lockedDependencies: JSON.stringify(updates.lockedDependencies || []),
        detectedConflicts: JSON.stringify(updates.detectedConflicts || []),
      });

      return NextResponse.json({ success: true, action: 'created' });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
