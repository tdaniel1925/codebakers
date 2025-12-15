import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ContentManagementService } from './content-management-service';

const CONTENT_DIR = join(process.cwd(), 'src', 'content');
const ENCODER_KEY = process.env.ENCODER_KEY || '';

export function encodeContent(content: string): string {
  if (!ENCODER_KEY) {
    throw new Error('ENCODER_KEY not configured');
  }

  const key = Buffer.from(ENCODER_KEY, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(content, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

export function decodeContent(encoded: string): string {
  if (!ENCODER_KEY) {
    throw new Error('ENCODER_KEY not configured');
  }

  const [ivB64, authTagB64, encrypted] = encoded.split(':');
  const key = Buffer.from(ENCODER_KEY, 'hex');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export class ContentService {
  /**
   * Get encoded content - prioritizes database version, falls back to filesystem
   */
  static async getEncodedContent() {
    // Try database first
    const dbVersion = await ContentManagementService.getActiveVersion();

    if (dbVersion) {
      const modules: Record<string, string> = {};

      // Encode modules from database
      if (dbVersion.modulesContent) {
        for (const [filename, content] of Object.entries(dbVersion.modulesContent as Record<string, string>)) {
          if (content) {
            modules[filename] = encodeContent(content);
          }
        }
      }

      return {
        version: dbVersion.version,
        router: dbVersion.routerContent ? encodeContent(dbVersion.routerContent) : '',
        cursorRules: dbVersion.cursorRulesContent ? encodeContent(dbVersion.cursorRulesContent) : '',
        claudeMd: dbVersion.claudeMdContent ? encodeContent(dbVersion.claudeMdContent) : '',
        modules,
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
      };
    }

    // Fallback to filesystem
    return this.getRawContentFromFilesystem();
  }

  /**
   * Read encoded content from filesystem (legacy)
   */
  private static getEncodedContentFromFilesystem() {
    const routerPath = join(CONTENT_DIR, 'router.md');
    const modulesDir = join(CONTENT_DIR, 'modules');

    // Read router
    let router = '';
    if (existsSync(routerPath)) {
      router = encodeContent(readFileSync(routerPath, 'utf-8'));
    }

    // Read modules
    const modules: Record<string, string> = {};
    if (existsSync(modulesDir)) {
      const files = readdirSync(modulesDir).filter((f) => f.endsWith('.md'));
      for (const file of files) {
        const content = readFileSync(join(modulesDir, file), 'utf-8');
        modules[file] = encodeContent(content);
      }
    }

    return {
      version: '15.2',
      router,
      cursorRules: '',
      claudeMd: '',
      modules,
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
    };
  }
}
