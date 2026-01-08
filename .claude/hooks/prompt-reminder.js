#!/usr/bin/env node
/**
 * CodeBakers Prompt Reminder Hook
 *
 * Runs on UserPromptSubmit to inject a reminder about the CodeBakers
 * methodology requirements before processing any user request.
 *
 * This hook helps reinforce the rules at the start of each interaction.
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

function checkForCodeRequest(prompt) {
  if (!prompt) return false;

  const codeKeywords = [
    'add', 'create', 'build', 'implement', 'fix', 'update', 'change',
    'modify', 'write', 'edit', 'refactor', 'delete', 'remove',
    'feature', 'component', 'page', 'api', 'route', 'function',
    'button', 'form', 'modal', 'table', 'chart'
  ];

  const promptLower = prompt.toLowerCase();
  return codeKeywords.some(keyword => promptLower.includes(keyword));
}

async function main() {
  const input = await readInput();
  const userPrompt = input.prompt || '';

  // Check if this looks like a code request
  if (checkForCodeRequest(userPrompt)) {
    // Output reminder that will be injected
    const reminder = {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: `
<user-prompt-submit-hook>
CODEBAKERS METHODOLOGY REMINDER:

Before writing ANY code, you MUST:
1. Call discover_patterns({ task: "...", keywords: [...] }) - GATE 1
2. Read the returned pattern files from .claude/
3. Follow the patterns exactly when writing code
4. Call validate_complete({ ... }) before saying "done" - GATE 2
5. Show the footer: CodeBakers | Snippets: X | TSC: Y | Tests: Z

These are STRUCTURAL requirements - hooks will BLOCK code writes without pattern discovery.
</user-prompt-submit-hook>
`
      }
    };

    console.log(JSON.stringify(reminder));
  }

  process.exit(0);
}

main().catch(error => {
  console.error(`Hook error: ${error.message}`);
  process.exit(0);
});
