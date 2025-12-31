import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { ContentManagementService } from './content-management-service';
import { deobfuscateContent } from './obfuscation-service';

const CONTENT_DIR = join(process.cwd(), 'src', 'content');

// Re-export for backwards compatibility (encoding removed - patterns now plain text)
export { deobfuscateContent as decodeContent };
export const encodeContent = (content: string) => content; // No-op, keep plain text

// Cache for encoded content (avoids re-obfuscating on every request)
interface CachedContent {
  data: {
    version: string;
    router: string;
    cursorRules: string;
    claudeMd: string;
    modules: Record<string, string>;
    cursorModules: Record<string, string>;
  };
  timestamp: number;
  versionId: string;
}

let contentCache: CachedContent | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class ContentService {
  /**
   * Invalidate the content cache (call when content is updated)
   */
  static invalidateCache() {
    contentCache = null;
  }

  /**
   * Get encoded content - prioritizes database version, falls back to filesystem
   * Uses in-memory caching to avoid re-obfuscating on every request
   * @param version Optional specific version string to fetch (e.g., "15.2")
   */
  static async getEncodedContent(version?: string) {
    // Try database first - get specific version if requested, otherwise active
    const dbVersion = version
      ? await ContentManagementService.getVersionByString(version)
      : await ContentManagementService.getActiveVersion();

    if (dbVersion) {
      // Check cache - only for active version (non-specific requests)
      if (!version && contentCache) {
        const cacheValid =
          contentCache.versionId === dbVersion.id &&
          Date.now() - contentCache.timestamp < CACHE_TTL;

        if (cacheValid) {
          return contentCache.data;
        }
      }

      // Modules are now served as plain text (no encoding)
      // This allows AI to read them directly without MCP decoding
      const modules: Record<string, string> = (dbVersion.modulesContent as Record<string, string>) || {};
      const cursorModules: Record<string, string> = (dbVersion.cursorModulesContent as Record<string, string>) || {};

      const result = {
        version: dbVersion.version,
        // IMPORTANT: Router and CLAUDE.md stay PLAIN TEXT so AI can read instructions
        // Use claudeMdContent for router (legacy routerContent is deprecated)
        router: dbVersion.claudeMdContent || dbVersion.routerContent || '',
        cursorRules: dbVersion.cursorRulesContent || '',
        claudeMd: dbVersion.claudeMdContent || '',
        // Only modules are obfuscated
        modules,
        cursorModules,
      };

      // Cache for future requests (only for active version)
      if (!version) {
        contentCache = {
          data: result,
          timestamp: Date.now(),
          versionId: dbVersion.id,
        };
      }

      return result;
    }

    // Fallback to filesystem
    return this.getEncodedContentFromFilesystem();
  }

  /**
   * Get raw content - prioritizes database version, falls back to filesystem
   */
  static async getRawContent() {
    // Try database first
    const dbVersion = await ContentManagementService.getActiveVersion();

    if (dbVersion) {
      return {
        version: dbVersion.version,
        router: dbVersion.routerContent || '',
        cursorRules: dbVersion.cursorRulesContent || '',
        claudeMd: dbVersion.claudeMdContent || '',
        modules: dbVersion.modulesContent || {},
        cursorModules: dbVersion.cursorModulesContent || {},
      };
    }

    // Fallback to filesystem
    return this.getRawContentFromFilesystem();
  }

  /**
   * Read content from filesystem (legacy fallback)
   * Modules are now served as plain text (no encoding)
   */
  private static getEncodedContentFromFilesystem() {
    const routerPath = join(CONTENT_DIR, 'router.md');
    const modulesDir = join(CONTENT_DIR, 'modules');

    // Read router
    let router = '';
    if (existsSync(routerPath)) {
      router = readFileSync(routerPath, 'utf-8');
    }

    // Read modules as plain text (no encoding)
    const modules: Record<string, string> = {};
    if (existsSync(modulesDir)) {
      const files = readdirSync(modulesDir).filter((f) => f.endsWith('.md'));
      for (const file of files) {
        modules[file] = readFileSync(join(modulesDir, file), 'utf-8');
      }
    }

    return {
      version: '15.2',
      router,
      cursorRules: '',
      claudeMd: '',
      modules,
      cursorModules: {},
    };
  }

  /**
   * Read raw content from filesystem (legacy)
   */
  private static getRawContentFromFilesystem() {
    const routerPath = join(CONTENT_DIR, 'router.md');
    const modulesDir = join(CONTENT_DIR, 'modules');

    // Read router
    let router = '';
    if (existsSync(routerPath)) {
      router = readFileSync(routerPath, 'utf-8');
    }

    // Read modules
    const modules: Record<string, string> = {};
    if (existsSync(modulesDir)) {
      const files = readdirSync(modulesDir).filter((f) => f.endsWith('.md'));
      for (const file of files) {
        modules[file] = readFileSync(join(modulesDir, file), 'utf-8');
      }
    }

    return {
      version: '15.2',
      router,
      cursorRules: '',
      claudeMd: '',
      modules,
      cursorModules: {},
    };
  }
}
