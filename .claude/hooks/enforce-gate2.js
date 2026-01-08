#!/usr/bin/env node
/**
 * CodeBakers Gate 2 Enforcement Hook
 *
 * STRUCTURAL ENFORCEMENT: Runs on Stop event to check if validate_complete
 * was called when code was written during the session.
 *
 * This hook runs AFTER the AI finishes responding, checking for compliance.
 * If code was written but validate_complete wasn't called, it injects a warning.
 *
 * Note: This is a "Stop" event hook - it can't block, but it can inject
 * a visible warning that the user and AI will see.
 */

const fs = require('fs');

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

function analyzeTranscript(transcriptPath) {
  if (!fs.existsSync(transcriptPath)) {
    return { codeWritten: false, patternsDiscovered: false, validated: false };
  }

  try {
    const content = fs.readFileSync(transcriptPath, 'utf-8');

    // Check for code writing
    const codeWritten = content.includes('"tool_name":"Write"') ||
                        content.includes('"tool_name":"Edit"') ||
                        content.includes('tool":"Write') ||
                        content.includes('tool":"Edit');

    // Check for pattern discovery
    const patternsDiscovered = content.includes('discover_patterns');

    // Check for validation
    const validated = content.includes('validate_complete');

    // Check for footer
    const hasFooter = content.includes('CodeBakers') &&
                      (content.includes('Snippets:') || content.includes('TSC:'));

    return { codeWritten, patternsDiscovered, validated, hasFooter };
  } catch {
    return { codeWritten: false, patternsDiscovered: false, validated: false, hasFooter: false };
  }
}

async function main() {
  const input = await readInput();
  const transcriptPath = input.transcript_path || '';

  const analysis = analyzeTranscript(transcriptPath);

  // If code was written but validation wasn't done, show warning
  if (analysis.codeWritten && !analysis.validated) {
    // Output a warning that will be shown to the user
    const warning = {
      type: 'notification',
      level: 'warning',
      title: 'CodeBakers Gate 2: Validation Required',
      message: `Code was written but validate_complete was not called.

Before saying "done", you MUST call:
  validate_complete({
    sessionToken: "...",
    featureName: "...",
    filesModified: [...],
    testsRun: true,
    testsPassed: true
  })

This ensures:
- Tests exist and pass
- TypeScript compiles
- Patterns were followed
- Quality gates are met`
    };

    console.log(JSON.stringify(warning));
  }

  // Check for missing footer
  if (analysis.codeWritten && !analysis.hasFooter) {
    console.error(`
================================================================================
CODEBAKERS: Missing Footer
================================================================================

Code was written but the CodeBakers footer was not shown.

After every code response, you MUST show:
---
CodeBakers | Snippets: [count] | TSC: [status] | Tests: [status]
================================================================================
`);
  }

  process.exit(0);
}

main().catch(error => {
  console.error(`Hook error: ${error.message}`);
  process.exit(0);
});
