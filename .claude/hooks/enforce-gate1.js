#!/usr/bin/env node
/**
 * CodeBakers Gate 1 Enforcement Hook
 *
 * STRUCTURAL ENFORCEMENT: Blocks ALL Write/Edit tool calls unless
 * discover_patterns was called first in this conversation.
 *
 * This hook runs BEFORE the AI can write any code, making pattern
 * discovery MANDATORY - not optional.
 *
 * Exit codes:
 * - 0: Allow the tool call
 * - 2: Block the tool call (with error message on stderr)
 */

const fs = require('fs');
const readline = require('readline');

async function readInput() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
  });
}

async function checkTranscriptForPatternDiscovery(transcriptPath) {
  if (!fs.existsSync(transcriptPath)) {
    return false;
  }

  try {
    const content = fs.readFileSync(transcriptPath, 'utf-8');

    // Check for MCP tool call to discover_patterns
    // The transcript contains tool calls with their names
    const patterns = [
      'discover_patterns',
      '"name":"discover_patterns"',
      '"tool_name":"discover_patterns"',
      'tool":"discover_patterns',
    ];

    for (const pattern of patterns) {
      if (content.includes(pattern)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(`Error reading transcript: ${error.message}`);
    return false;
  }
}

async function main() {
  const input = await readInput();

  const toolName = input.tool_name || '';
  const transcriptPath = input.transcript_path || '';

  // Only enforce for Write and Edit tools
  if (toolName !== 'Write' && toolName !== 'Edit') {
    process.exit(0); // Allow other tools
  }

  // Check if this is a test file or hook file (allow those without pattern discovery)
  const filePath = input.tool_input?.file_path || '';
  if (filePath.includes('.spec.') ||
      filePath.includes('.test.') ||
      filePath.includes('/hooks/') ||
      filePath.includes('\\hooks\\') ||
      filePath.includes('.claude/')) {
    process.exit(0); // Allow test and hook files
  }

  // Check if discover_patterns was called
  const patternsDiscovered = await checkTranscriptForPatternDiscovery(transcriptPath);

  if (patternsDiscovered) {
    process.exit(0); // Allow - patterns were discovered
  }

  // BLOCK the tool call
  console.error(`
================================================================================
CODEBAKERS GATE 1: BLOCKED - Pattern Discovery Required
================================================================================

You attempted to write code WITHOUT calling discover_patterns first.

This is a HARD REQUIREMENT. Every code change must be informed by existing
patterns in the codebase.

TO FIX:
1. Call discover_patterns({ task: "your task description", keywords: [...] })
2. Read the returned patterns from .claude/ folder
3. THEN write code following those patterns

The discover_patterns tool:
- Searches the codebase for similar implementations
- Identifies relevant pattern files to load
- Shows existing code patterns you MUST follow
- Logs discovery for compliance tracking

This enforcement cannot be bypassed. Pattern-driven development is mandatory.
================================================================================
`);

  process.exit(2); // Block the tool call
}

main().catch(error => {
  console.error(`Hook error: ${error.message}`);
  process.exit(0); // On error, allow (fail open)
});
