import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { ContentManagementService } from './content-management-service';
import { obfuscateContent, deobfuscateContent } from './obfuscation-service';

const CONTENT_DIR = join(process.cwd(), 'src', 'content');

// Re-export obfuscation functions for backwards compatibility
export { obfuscateContent as encodeContent, deobfuscateContent as decodeContent };

export class ContentService {
  /**
   * Get encoded content - prioritizes database version, falls back to filesystem
   */
  static async getEncodedContent() {
    // Try database first
    const dbVersion = await ContentManagementService.getActiveVersion();

    if (dbVersion) {
      const modules: Record<string, string> = {};
      const cursorModules: Record<string, string> = {};

      // Obfuscate modules from database (.claude/ folder)
      if (dbVersion.modulesContent) {
        for (const [filename, content] of Object.entries(dbVersion.modulesContent as Record<string, string>)) {
          if (content) {
            modules[filename] = obfuscateContent(content);
          }
        }
      }

      // Obfuscate cursor modules from database (.cursorrules-modules/ folder)
      if (dbVersion.cursorModulesContent) {
        for (const [filename, content] of Object.entries(dbVersion.cursorModulesContent as Record<string, string>)) {
          if (content) {
            cursorModules[filename] = obfuscateContent(content);
          }
        }
      }

      return {
        version: dbVersion.version,
        // IMPORTANT: Router and CLAUDE.md stay PLAIN TEXT so AI can read instructions
        router: dbVersion.routerContent || '',
        cursorRules: dbVersion.cursorRulesContent || '',
        claudeMd: dbVersion.claudeMdContent || '',
        // Only modules are obfuscated
        modules,
        cursorModules,
      };
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
   * Read obfuscated content from filesystem (legacy)
   */
  private static getEncodedContentFromFilesystem() {
    const routerPath = join(CONTENT_DIR, 'router.md');
    const modulesDir = join(CONTENT_DIR, 'modules');

    // Read router (stays plain text)
    let router = '';
    if (existsSync(routerPath)) {
      router = readFileSync(routerPath, 'utf-8');
    }

    // Read and obfuscate modules
    const modules: Record<string, string> = {};
    if (existsSync(modulesDir)) {
      const files = readdirSync(modulesDir).filter((f) => f.endsWith('.md'));
      for (const file of files) {
        const content = readFileSync(join(modulesDir, file), 'utf-8');
        modules[file] = obfuscateContent(content);
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
