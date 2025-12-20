import { db, contentVersions, profiles } from '@/db';
import { eq, desc } from 'drizzle-orm';

interface ContentUpload {
  version: string;
  routerContent?: string;
  cursorRulesContent?: string;
  claudeMdContent?: string;
  modulesContent?: Record<string, string>; // .claude/ folder
  cursorModulesContent?: Record<string, string>; // .cursorrules-modules/ folder
  changelog?: string;
}

export class ContentManagementService {
  /**
   * Create a new content version (draft)
   */
  static async createVersion(userId: string, data: ContentUpload) {
    const [version] = await db
      .insert(contentVersions)
      .values({
        version: data.version,
        routerContent: data.routerContent || null,
        cursorRulesContent: data.cursorRulesContent || null,
        claudeMdContent: data.claudeMdContent || null,
        modulesContent: data.modulesContent ? JSON.stringify(data.modulesContent) : null,
        cursorModulesContent: data.cursorModulesContent ? JSON.stringify(data.cursorModulesContent) : null,
        changelog: data.changelog || null,
        publishedBy: userId,
        isActive: false,
      })
      .returning();

    return version;
  }

  /**
   * Update an existing version
   */
  static async updateVersion(versionId: string, data: Partial<ContentUpload>) {
    const updates: Record<string, unknown> = {};

    if (data.version !== undefined) updates.version = data.version;
    if (data.routerContent !== undefined) updates.routerContent = data.routerContent;
    if (data.cursorRulesContent !== undefined) updates.cursorRulesContent = data.cursorRulesContent;
    if (data.claudeMdContent !== undefined) updates.claudeMdContent = data.claudeMdContent;
    if (data.modulesContent !== undefined) updates.modulesContent = JSON.stringify(data.modulesContent);
    if (data.cursorModulesContent !== undefined) updates.cursorModulesContent = JSON.stringify(data.cursorModulesContent);
    if (data.changelog !== undefined) updates.changelog = data.changelog;

    const [version] = await db
      .update(contentVersions)
      .set(updates)
      .where(eq(contentVersions.id, versionId))
      .returning();

    return version;
  }

  /**
   * Publish a version (make it active, deactivate others)
   */
  static async publishVersion(versionId: string) {
    // Deactivate all versions
    await db
      .update(contentVersions)
      .set({ isActive: false });

    // Activate the selected version
    const [version] = await db
      .update(contentVersions)
      .set({
        isActive: true,
        publishedAt: new Date(),
      })
      .where(eq(contentVersions.id, versionId))
      .returning();

    return version;
  }

  /**
   * Get the currently active version
   */
  static async getActiveVersion() {
    const [version] = await db
      .select()
      .from(contentVersions)
      .where(eq(contentVersions.isActive, true))
      .limit(1);

    if (!version) return null;

    return {
      ...version,
      modulesContent: version.modulesContent ? JSON.parse(version.modulesContent) : {},
      cursorModulesContent: version.cursorModulesContent ? JSON.parse(version.cursorModulesContent) : {},
    };
  }

  /**
   * List all versions with publisher info
   */
  static async listVersions() {
    const versions = await db
      .select({
        id: contentVersions.id,
        version: contentVersions.version,
        changelog: contentVersions.changelog,
        isActive: contentVersions.isActive,
        createdAt: contentVersions.createdAt,
        publishedAt: contentVersions.publishedAt,
        publishedBy: contentVersions.publishedBy,
        publisherEmail: profiles.email,
        publisherName: profiles.fullName,
      })
      .from(contentVersions)
      .leftJoin(profiles, eq(contentVersions.publishedBy, profiles.id))
      .orderBy(desc(contentVersions.createdAt));

    return versions;
  }

  /**
   * Get a specific version by ID
   */
  static async getVersion(versionId: string) {
    const [version] = await db
      .select()
      .from(contentVersions)
      .where(eq(contentVersions.id, versionId))
      .limit(1);

    if (!version) return null;

    return {
      ...version,
      modulesContent: version.modulesContent ? JSON.parse(version.modulesContent) : {},
      cursorModulesContent: version.cursorModulesContent ? JSON.parse(version.cursorModulesContent) : {},
    };
  }

  /**
   * Delete a version (only if not active)
   */
  static async deleteVersion(versionId: string) {
    const [version] = await db
      .select()
      .from(contentVersions)
      .where(eq(contentVersions.id, versionId))
      .limit(1);

    if (!version) {
      throw new Error('Version not found');
    }

    if (version.isActive) {
      throw new Error('Cannot delete active version');
    }

    await db
      .delete(contentVersions)
      .where(eq(contentVersions.id, versionId));

    return { success: true };
  }

  /**
   * Get content stats for a version
   */
  static getContentStats(version: {
    routerContent?: string | null;
    cursorRulesContent?: string | null;
    claudeMdContent?: string | null;
    modulesContent?: Record<string, string> | string | null;
    cursorModulesContent?: Record<string, string> | string | null;
  }) {
    const modules = typeof version.modulesContent === 'string'
      ? JSON.parse(version.modulesContent)
      : version.modulesContent || {};

    const cursorModules = typeof version.cursorModulesContent === 'string'
      ? JSON.parse(version.cursorModulesContent)
      : version.cursorModulesContent || {};

    return {
      hasRouter: !!version.routerContent,
      hasCursorRules: !!version.cursorRulesContent,
      hasClaudeMd: !!version.claudeMdContent,
      moduleCount: Object.keys(modules).length,
      cursorModuleCount: Object.keys(cursorModules).length,
      totalLines: [
        version.routerContent,
        version.cursorRulesContent,
        version.claudeMdContent,
        ...Object.values(modules),
        ...Object.values(cursorModules),
      ]
        .filter(Boolean)
        .reduce((acc: number, content) => acc + (content as string).split('\n').length, 0),
    };
  }
}
