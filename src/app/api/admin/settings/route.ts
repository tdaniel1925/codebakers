import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { db, adminSettings, auditLogs, profiles } from '@/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Default settings to seed if none exist
const DEFAULT_SETTINGS = [
  // General
  { key: 'site_name', value: 'CodeBakers', type: 'string', description: 'Platform name', category: 'general' },
  { key: 'maintenance_mode', value: 'false', type: 'boolean', description: 'Enable maintenance mode', category: 'general' },
  { key: 'registration_enabled', value: 'true', type: 'boolean', description: 'Allow new user registrations', category: 'general' },

  // Limits
  { key: 'trial_days', value: '14', type: 'number', description: 'Trial period duration in days', category: 'limits' },
  { key: 'max_team_size_free', value: '3', type: 'number', description: 'Max team members for free tier', category: 'limits' },
  { key: 'max_team_size_pro', value: '10', type: 'number', description: 'Max team members for pro tier', category: 'limits' },
  { key: 'max_team_size_team', value: '25', type: 'number', description: 'Max team members for team tier', category: 'limits' },
  { key: 'api_rate_limit', value: '100', type: 'number', description: 'API requests per minute', category: 'limits' },

  // Features
  { key: 'feature_ai_module_builder', value: 'true', type: 'boolean', description: 'Enable AI Module Builder', category: 'features' },
  { key: 'feature_pattern_submissions', value: 'true', type: 'boolean', description: 'Allow community pattern submissions', category: 'features' },
  { key: 'feature_enterprise_leads', value: 'true', type: 'boolean', description: 'Enable enterprise lead capture', category: 'features' },

  // Email
  { key: 'email_from_name', value: 'CodeBakers', type: 'string', description: 'Email sender name', category: 'email' },
  { key: 'email_from_address', value: 'noreply@codebakers.dev', type: 'string', description: 'Email sender address', category: 'email' },
  { key: 'email_welcome_enabled', value: 'true', type: 'boolean', description: 'Send welcome email to new users', category: 'email' },
  { key: 'email_payment_notifications', value: 'true', type: 'boolean', description: 'Send payment notification emails', category: 'email' },
];

/**
 * GET /api/admin/settings
 * Get all admin settings grouped by category
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    // Get all settings
    let settings = await db
      .select()
      .from(adminSettings)
      .orderBy(adminSettings.category, adminSettings.key);

    // If no settings exist, seed with defaults
    if (settings.length === 0) {
      await db.insert(adminSettings).values(DEFAULT_SETTINGS);
      settings = await db
        .select()
        .from(adminSettings)
        .orderBy(adminSettings.category, adminSettings.key);
    }

    // Group by category
    const grouped: Record<string, typeof settings> = {};
    settings.forEach((setting) => {
      const category = setting.category || 'general';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(setting);
    });

    return successResponse({
      settings: grouped,
      categories: Object.keys(grouped),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/admin/settings
 * Update a setting
 * Body: { key: string, value: string }
 */
export async function PUT(req: NextRequest) {
  try {
    autoRateLimit(req);
    const session = await requireAdmin();
    const user = session.user;

    const { key, value } = await req.json();

    if (!key || value === undefined) {
      return successResponse({ error: 'Key and value are required' }, 400);
    }

    // Get current setting
    const [currentSetting] = await db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.key, key))
      .limit(1);

    if (!currentSetting) {
      return successResponse({ error: 'Setting not found' }, 404);
    }

    const previousValue = currentSetting.value;

    // Update setting
    const [updated] = await db
      .update(adminSettings)
      .set({
        value: String(value),
        updatedBy: user?.id || null,
        updatedAt: new Date(),
      })
      .where(eq(adminSettings.key, key))
      .returning();

    // Log the change
    await db.insert(auditLogs).values({
      userId: user?.id || null,
      userEmail: user?.email || null,
      action: 'setting.update',
      resource: 'setting',
      resourceId: key,
      previousValue: JSON.stringify({ value: previousValue }),
      newValue: JSON.stringify({ value: String(value) }),
    });

    return successResponse({ setting: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/admin/settings
 * Create a new setting
 * Body: { key, value, type?, description?, category? }
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);
    const session = await requireAdmin();
    const user = session.user;

    const { key, value, type, description, category } = await req.json();

    if (!key || value === undefined) {
      return successResponse({ error: 'Key and value are required' }, 400);
    }

    // Check if setting already exists
    const [existing] = await db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.key, key))
      .limit(1);

    if (existing) {
      return successResponse({ error: 'Setting with this key already exists' }, 409);
    }

    // Create setting
    const [setting] = await db
      .insert(adminSettings)
      .values({
        key,
        value: String(value),
        type: type || 'string',
        description: description || null,
        category: category || 'general',
        updatedBy: user?.id || null,
      })
      .returning();

    // Log the creation
    await db.insert(auditLogs).values({
      userId: user?.id || null,
      userEmail: user?.email || null,
      action: 'setting.create',
      resource: 'setting',
      resourceId: key,
      previousValue: null,
      newValue: JSON.stringify({ key, value: String(value), type, category }),
    });

    return successResponse({ setting });
  } catch (error) {
    return handleApiError(error);
  }
}
