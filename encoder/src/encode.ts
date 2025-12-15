import { createCipheriv, randomBytes } from 'crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

const CONTENT_DIR = join(process.cwd(), '..', 'src', 'content');
const OUTPUT_DIR = join(process.cwd(), '..', 'src', 'content', 'encoded');

function encodeFile(content: string, key: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);

  let encrypted = cipher.update(content, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

function main() {
  const key = process.env.ENCODER_KEY;
  if (!key) {
    console.error('ENCODER_KEY environment variable required');
    console.log('Generate one with: openssl rand -hex 32');
    process.exit(1);
  }

  if (key.length !== 64) {
    console.error('ENCODER_KEY must be 32 bytes (64 hex characters)');
    process.exit(1);
  }

  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Encode router
  const routerPath = join(CONTENT_DIR, 'router.md');
  if (existsSync(routerPath)) {
    const content = readFileSync(routerPath, 'utf-8');
    const encoded = encodeFile(content, key);
    writeFileSync(join(OUTPUT_DIR, 'router.enc'), encoded);
    console.log('Encoded: router.md');
  }

  // Encode modules
  const modulesDir = join(CONTENT_DIR, 'modules');
  if (existsSync(modulesDir)) {
    const files = readdirSync(modulesDir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const content = readFileSync(join(modulesDir, file), 'utf-8');
      const encoded = encodeFile(content, key);
      const outputName = basename(file, '.md') + '.enc';
      writeFileSync(join(OUTPUT_DIR, outputName), encoded);
      console.log(`Encoded: ${file}`);
    }
  }

  console.log('\nEncoding complete!');
}

main();
