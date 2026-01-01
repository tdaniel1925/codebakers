import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teamProfiles, apiKeys } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teams/profile
 * Get team's profile settings (industry, strictness, rules)
 *
 * Headers:
 * - Authorization: Bearer <api_key>
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

    const keyRecord = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.keyPlain, apiKey),
      with: { team: true },
    });

    if (!keyRecord?.team) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Find team profile
    const profile = await db.query.teamProfiles.findFirst({
      where: eq(teamProfiles.teamId, keyRecord.team.id),
    });

    if (!profile) {
      // Return default profile
      return NextResponse.json({
        exists: false,
        profile: {
          industryProfile: 'general',
          strictnessLevel: 'standard',
          requiredPatterns: [],
          bannedPatterns: [],
          customRules: {},
          requireHipaa: false,
          requirePci: false,
          requireSoc2: false,
          requireGdpr: false,
        },
      });
    }

    return NextResponse.json({
      exists: true,
      profile: {
        id: profile.id,
        industryProfile: profile.industryProfile,
        strictnessLevel: profile.strictnessLevel,
        requiredPatterns: JSON.parse(profile.requiredPatterns || '[]'),
        bannedPatterns: JSON.parse(profile.bannedPatterns || '[]'),
        customRules: JSON.parse(profile.customRules || '{}'),
        requireHipaa: profile.requireHipaa,
        requirePci: profile.requirePci,
        requireSoc2: profile.requireSoc2,
        requireGdpr: profile.requireGdpr,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/teams/profile
 * Create or update team's profile settings
 *
 * Body:
 * - industryProfile?: 'general' | 'healthcare' | 'finance' | 'legal' | 'ecommerce' | 'education' | 'enterprise'
 * - strictnessLevel?: 'relaxed' | 'standard' | 'strict' | 'enterprise'
 * - requiredPatterns?: string[]
 * - bannedPatterns?: string[]
 * - customRules?: object
 * - requireHipaa?: boolean
 * - requirePci?: boolean
 * - requireSoc2?: boolean
 * - requireGdpr?: boolean
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

    const keyRecord = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.keyPlain, apiKey),
      with: { team: true },
    });

    if (!keyRecord?.team) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await req.json();
    const {
      industryProfile,
      strictnessLevel,
      requiredPatterns,
      bannedPatterns,
      customRules,
      requireHipaa,
      requirePci,
      requireSoc2,
      requireGdpr,
    } = body;

    // Validate enums
    const validIndustries = ['general', 'healthcare', 'finance', 'legal', 'ecommerce', 'education', 'enterprise'];
    const validStrictness = ['relaxed', 'standard', 'strict', 'enterprise'];

    if (industryProfile && !validIndustries.includes(industryProfile)) {
      return NextResponse.json(
        { error: `Invalid industryProfile. Must be one of: ${validIndustries.join(', ')}` },
        { status: 400 }
      );
    }

    if (strictnessLevel && !validStrictness.includes(strictnessLevel)) {
      return NextResponse.json(
        { error: `Invalid strictnessLevel. Must be one of: ${validStrictness.join(', ')}` },
        { status: 400 }
      );
    }

    // Check for existing profile
    const existing = await db.query.teamProfiles.findFirst({
      where: eq(teamProfiles.teamId, keyRecord.team.id),
    });

    if (existing) {
      // Update existing profile
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (industryProfile) updateData.industryProfile = industryProfile;
      if (strictnessLevel) updateData.strictnessLevel = strictnessLevel;
      if (requiredPatterns) updateData.requiredPatterns = JSON.stringify(requiredPatterns);
      if (bannedPatterns) updateData.bannedPatterns = JSON.stringify(bannedPatterns);
      if (customRules) updateData.customRules = JSON.stringify(customRules);
      if (requireHipaa !== undefined) updateData.requireHipaa = requireHipaa;
      if (requirePci !== undefined) updateData.requirePci = requirePci;
      if (requireSoc2 !== undefined) updateData.requireSoc2 = requireSoc2;
      if (requireGdpr !== undefined) updateData.requireGdpr = requireGdpr;

      await db.update(teamProfiles)
        .set(updateData)
        .where(eq(teamProfiles.id, existing.id));

      return NextResponse.json({ success: true, action: 'updated' });
    } else {
      // Create new profile
      await db.insert(teamProfiles).values({
        teamId: keyRecord.team.id,
        industryProfile: industryProfile || 'general',
        strictnessLevel: strictnessLevel || 'standard',
        requiredPatterns: JSON.stringify(requiredPatterns || []),
        bannedPatterns: JSON.stringify(bannedPatterns || []),
        customRules: JSON.stringify(customRules || {}),
        requireHipaa: requireHipaa || false,
        requirePci: requirePci || false,
        requireSoc2: requireSoc2 || false,
        requireGdpr: requireGdpr || false,
      });

      return NextResponse.json({ success: true, action: 'created' });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
