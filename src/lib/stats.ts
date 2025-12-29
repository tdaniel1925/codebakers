/**
 * Central configuration for CodeBakers stats and metrics.
 *
 * UPDATE THESE VALUES when content changes (new modules, patterns, etc.)
 * All marketing pages, docs, CLI, and admin pages should import from here.
 */

export const CODEBAKERS_STATS = {
  // Module counts
  moduleCount: 59,           // Total .claude/ modules (update when adding modules)
  cursorModuleCount: 59,     // Total .cursorrules-modules/ (usually same as moduleCount)

  // Pattern/line counts
  patternCount: 150,         // Approximate number of distinct patterns
  totalLines: 50000,         // Approximate total lines across all modules
  totalLinesDisplay: '50K+', // Human-readable version

  // CLI versions (fallbacks - actual comes from database)
  cliLatestVersion: '1.1.6',
  cliMinVersion: '1.0.0',

  // Content version (informational - actual comes from database)
  contentVersion: '16.0',

  // Marketing copy
  tagline: '59 production-ready modules for your AI coding assistant',
  description: '50K+ lines of battle-tested patterns for Next.js, Supabase, Stripe, and more',
} as const;

// Helper for consistent display
export function getModuleCountDisplay(): string {
  return `${CODEBAKERS_STATS.moduleCount} modules`;
}

export function getPatternCountDisplay(): string {
  return `${CODEBAKERS_STATS.patternCount}+ patterns`;
}

export function getLinesDisplay(): string {
  return CODEBAKERS_STATS.totalLinesDisplay;
}
