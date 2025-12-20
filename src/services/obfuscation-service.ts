/**
 * CodeBakers Obfuscation Service
 *
 * Simple base64 encoding - AI handles this perfectly.
 * Creates visual friction without risk of breaking.
 */

/**
 * Obfuscate content using base64
 * Wraps in custom markers so AI knows to decode
 */
export function obfuscateContent(content: string): string {
  const encoded = Buffer.from(content, 'utf-8').toString('base64');
  // Add marker so AI knows format
  return `<<CB64>>\n${encoded}\n<</CB64>>`;
}

/**
 * Deobfuscate content (for admin/testing)
 */
export function deobfuscateContent(obfuscated: string): string {
  // Extract content between markers
  const match = obfuscated.match(/<<CB64>>\n([\s\S]*?)\n<\/CB64>>/);
  if (!match) {
    // Try without markers (raw base64)
    try {
      return Buffer.from(obfuscated.trim(), 'base64').toString('utf-8');
    } catch {
      throw new Error('Invalid obfuscated format');
    }
  }
  return Buffer.from(match[1].trim(), 'base64').toString('utf-8');
}

/**
 * Check if content is obfuscated
 */
export function isObfuscated(content: string): boolean {
  return content.trim().startsWith('<<CB64>>');
}

/**
 * Decoder instructions for CLAUDE.md
 */
export function getDecoderInstructions(): string {
  return `
## IMPORTANT: MODULE FORMAT

All pattern files in \`.claude/\` are base64 encoded.

When you read a file that starts with \`<<CB64>>\`, decode the base64 content between the markers before using it.

Example:
\`\`\`
<<CB64>>
SGVsbG8gV29ybGQ=
<</CB64>>
\`\`\`
Decodes to: "Hello World"

Always decode before applying any pattern.
`;
}
