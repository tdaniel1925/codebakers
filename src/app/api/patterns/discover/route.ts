import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/services/api-key-service';
import { TeamService } from '@/services/team-service';
import { EnforcementService } from '@/services/enforcement-service';
import { TrialService } from '@/services/trial-service';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';
import { db } from '@/db';
import { projectMemory, teamProfiles, architectureConflicts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * POST /api/patterns/discover
 * START GATE: Must be called BEFORE writing any code
 * Returns relevant patterns, project memory, team profile, and creates an enforcement session
 *
 * Body: {
 *   task: string,         // What the AI is about to do
 *   files?: string[],     // Files AI plans to create/modify
 *   keywords?: string[],  // Keywords to search for patterns
 *   projectHash?: string, // Hash of project for context
 *   projectName?: string, // Project name for display
 *   detectedStack?: object // Client-detected stack from package.json
 * }
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);
    const validation = await validateRequest(req);
    if (validation.error) return validation.error;

    const body = await req.json();

    // Validate required fields
    if (!body.task || typeof body.task !== 'string') {
      return NextResponse.json({ error: 'task is required and must be a string' }, { status: 400 });
    }

    // Call enforcement service for pattern discovery and session creation
    const result = await EnforcementService.discoverPatterns(
      {
        task: body.task,
        files: body.files,
        keywords: body.keywords,
        projectHash: body.projectHash,
        projectName: body.projectName,
        // Safety system integration
        sessionId: body.safetySessionId,
        contextLoaded: body.contextLoaded,
        scopeConfirmed: body.scopeConfirmed,
      },
      {
        teamId: validation.teamId,
        apiKeyId: validation.apiKeyId,
        deviceHash: validation.deviceHash,
      }
    );

    // Fetch project memory if team + project hash available
    let memory = null;
    let detectedConflicts: Array<{
      type: string;
      items: string[];
      recommendation: string;
      reason: string;
    }> = [];

    if (validation.teamId && body.projectHash) {
      const memoryRecord = await db.query.projectMemory.findFirst({
        where: and(
          eq(projectMemory.teamId, validation.teamId),
          eq(projectMemory.projectHash, body.projectHash)
        ),
      });

      if (memoryRecord) {
        memory = {
          stackDecisions: JSON.parse(memoryRecord.stackDecisions || '{}'),
          namingConventions: JSON.parse(memoryRecord.namingConventions || '{}'),
          architecturePatterns: JSON.parse(memoryRecord.architecturePatterns || '{}'),
          fileStructure: JSON.parse(memoryRecord.fileStructure || '{}'),
          projectRules: JSON.parse(memoryRecord.projectRules || '{}'),
          lockedDependencies: JSON.parse(memoryRecord.lockedDependencies || '[]'),
        };

        // Check for stored conflicts
        const storedConflicts = JSON.parse(memoryRecord.detectedConflicts || '[]');
        if (storedConflicts.length > 0) {
          detectedConflicts = storedConflicts;
        }
      }

      // Detect new conflicts from client-provided stack
      if (body.detectedStack) {
        const newConflicts = detectArchitectureConflicts(body.detectedStack, memory);
        if (newConflicts.length > 0) {
          detectedConflicts = [...detectedConflicts, ...newConflicts];

          // Store conflicts in database
          for (const conflict of newConflicts) {
            await db.insert(architectureConflicts).values({
              sessionId: result.sessionId,
              projectHash: body.projectHash,
              conflictType: conflict.type,
              conflictingItems: JSON.stringify(conflict.items),
              recommendedItem: conflict.recommendation,
              recommendationReason: conflict.reason,
            }).catch(() => {}); // Ignore insert errors
          }

          // Update project memory with conflicts
          if (memoryRecord) {
            await db.update(projectMemory)
              .set({
                detectedConflicts: JSON.stringify(detectedConflicts),
                updatedAt: new Date(),
              })
              .where(eq(projectMemory.id, memoryRecord.id))
              .catch(() => {});
          }
        }
      }
    }

    // Fetch team profile for industry-specific patterns
    let teamProfile = null;
    if (validation.teamId) {
      const profileRecord = await db.query.teamProfiles.findFirst({
        where: eq(teamProfiles.teamId, validation.teamId),
      });

      if (profileRecord) {
        teamProfile = {
          industryProfile: profileRecord.industryProfile,
          strictnessLevel: profileRecord.strictnessLevel,
          requiredPatterns: JSON.parse(profileRecord.requiredPatterns || '[]'),
          bannedPatterns: JSON.parse(profileRecord.bannedPatterns || '[]'),
          customRules: JSON.parse(profileRecord.customRules || '{}'),
          requireHipaa: profileRecord.requireHipaa,
          requirePci: profileRecord.requirePci,
          requireSoc2: profileRecord.requireSoc2,
          requireGdpr: profileRecord.requireGdpr,
        };
      }
    }

    return NextResponse.json({
      success: true,
      sessionToken: result.sessionToken,
      expiresAt: result.expiresAt,
      patterns: result.patterns.map((p) => ({
        name: p.name,
        relevance: p.relevance,
        content: p.content,
      })),
      coreRules: result.coreRules,
      message: result.message,

      // v6.1 enhancements
      projectMemory: memory,
      teamProfile,
      detectedConflicts: detectedConflicts.length > 0 ? detectedConflicts : undefined,

      // v6.2 safety system integration
      safety: {
        warnings: result.safetyWarnings,
        contextSummary: result.contextSummary,
        relevantDecisions: result.relevantDecisions,
        failedApproaches: result.failedApproaches,
      },

      instruction:
        'You MUST follow these patterns when implementing this task. When done, call validate_complete with the files you modified.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Detect architecture conflicts from detected stack
 */
function detectArchitectureConflicts(
  detectedStack: Record<string, string | string[]>,
  existingMemory: {
    stackDecisions?: Record<string, unknown>;
    namingConventions?: Record<string, unknown>;
    architecturePatterns?: Record<string, unknown>;
    fileStructure?: Record<string, unknown>;
    projectRules?: Record<string, unknown>;
    lockedDependencies?: string[];
  } | null
): Array<{ type: string; items: string[]; recommendation: string; reason: string }> {
  const conflicts: Array<{ type: string; items: string[]; recommendation: string; reason: string }> = [];

  // Define conflicting libraries by category
  const conflictGroups: Record<string, { category: string; recommendation: string }[]> = {
    'state-management': [
      { category: 'redux', recommendation: 'Consider using one state management library' },
      { category: 'zustand', recommendation: 'Consider using one state management library' },
      { category: 'recoil', recommendation: 'Consider using one state management library' },
      { category: 'jotai', recommendation: 'Consider using one state management library' },
      { category: 'mobx', recommendation: 'Consider using one state management library' },
    ],
    'styling': [
      { category: 'styled-components', recommendation: 'Consider using one styling approach' },
      { category: '@emotion', recommendation: 'Consider using one styling approach' },
      { category: 'sass', recommendation: 'Consider using one styling approach' },
      { category: 'tailwindcss', recommendation: 'Tailwind is recommended for new projects' },
    ],
    'orm': [
      { category: 'prisma', recommendation: 'Consider using one ORM' },
      { category: 'drizzle-orm', recommendation: 'Drizzle is recommended for new projects' },
      { category: 'typeorm', recommendation: 'Consider using one ORM' },
      { category: 'sequelize', recommendation: 'Consider using one ORM' },
    ],
    'form': [
      { category: 'react-hook-form', recommendation: 'react-hook-form is recommended' },
      { category: 'formik', recommendation: 'Consider using one form library' },
      { category: 'react-final-form', recommendation: 'Consider using one form library' },
    ],
  };

  // Check for conflicts in dependencies
  const deps = Array.isArray(detectedStack.dependencies)
    ? detectedStack.dependencies
    : Object.keys(detectedStack.dependencies || {});

  for (const [conflictType, libraries] of Object.entries(conflictGroups)) {
    const found = libraries.filter((lib) =>
      deps.some((dep: string) => dep.includes(lib.category))
    );

    if (found.length > 1) {
      // Check if locked by memory
      const locked = existingMemory?.lockedDependencies || [];
      const lockedLib = found.find((f) => locked.includes(f.category));

      conflicts.push({
        type: conflictType,
        items: found.map((f) => f.category),
        recommendation: lockedLib?.category || found[0].category,
        reason: lockedLib
          ? `${lockedLib.category} is locked in project memory`
          : found[0].recommendation,
      });
    }
  }

  return conflicts;
}

async function validateRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');

  // Check for API key auth
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7);
    const validation = await ApiKeyService.validate(apiKey);

    if (!validation.valid || !validation.team) {
      return {
        error: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
      };
    }

    const { team, apiKeyId } = validation;

    // Check access
    const accessCheck = TeamService.canAccessProject(team, null);

    if (!accessCheck.allowed) {
      const isSuspended = accessCheck.code === 'ACCOUNT_SUSPENDED';
      return {
        error: NextResponse.json(
          {
            error: accessCheck.reason,
            code: accessCheck.code,
            ...(isSuspended
              ? { supportUrl: 'https://codebakers.ai/support' }
              : { upgradeUrl: 'https://codebakers.ai/billing' }),
          },
          { status: isSuspended ? 403 : 402 }
        ),
      };
    }

    return { teamId: team.id, apiKeyId };
  }

  // Check for device-based trial auth
  const deviceHash = req.headers.get('x-device-hash');
  if (deviceHash) {
    const trial = await TrialService.getByDeviceHash(deviceHash);

    if (!trial) {
      return {
        error: NextResponse.json(
          {
            error: 'No trial found for this device. Run "codebakers go" to start a trial.',
            code: 'NO_TRIAL',
          },
          { status: 401 }
        ),
      };
    }

    // Check if trial expired
    if (trial.trialExpiresAt && new Date(trial.trialExpiresAt) < new Date()) {
      return {
        error: NextResponse.json(
          {
            error: 'Trial has expired. Upgrade to continue using CodeBakers.',
            code: 'TRIAL_EXPIRED',
            upgradeUrl: 'https://codebakers.ai/billing',
          },
          { status: 402 }
        ),
      };
    }

    return { deviceHash };
  }

  return {
    error: NextResponse.json(
      { error: 'Missing authorization. Provide Bearer token or x-device-hash header.' },
      { status: 401 }
    ),
  };
}
