#!/usr/bin/env node
/**
 * CodeBakers Git Hooks Installer
 *
 * Installs pre-commit hooks for pattern compliance validation.
 * Run: node scripts/install-hooks.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HOOKS_DIR = path.join(process.cwd(), '.git', 'hooks');
const PRE_COMMIT_PATH = path.join(HOOKS_DIR, 'pre-commit');

const PRE_COMMIT_SCRIPT = `#!/bin/sh
# CodeBakers Pre-Commit Hook
# Validates that code follows CodeBakers patterns before allowing commit.

echo "🍪 Running CodeBakers compliance check..."

# Run the validation script on staged files only
node scripts/validate-codebakers-compliance.js --staged

# Capture exit code
RESULT=$?

if [ $RESULT -ne 0 ]; then
  echo ""
  echo "❌ Commit blocked by CodeBakers compliance check."
  echo ""
  echo "Fix the issues above before committing."
  echo "See .claude/ pattern files for correct implementations."
  echo ""
  echo "To bypass (NOT recommended): git commit --no-verify"
  exit 1
fi

echo "✅ CodeBakers compliance check passed!"
exit 0
`;

function main() {
  console.log('🍪 CodeBakers Hook Installer\n');

  // Check if we're in a git repo
  if (!fs.existsSync(path.join(process.cwd(), '.git'))) {
    console.error('❌ Not a git repository. Run this from the project root.');
    process.exit(1);
  }

  // Create hooks directory if it doesn't exist
  if (!fs.existsSync(HOOKS_DIR)) {
    fs.mkdirSync(HOOKS_DIR, { recursive: true });
  }

  // Backup existing pre-commit hook if it exists
  if (fs.existsSync(PRE_COMMIT_PATH)) {
    const backupPath = PRE_COMMIT_PATH + '.backup';
    console.log(`   Backing up existing pre-commit hook to ${backupPath}`);
    fs.copyFileSync(PRE_COMMIT_PATH, backupPath);
  }

  // Write the pre-commit hook
  fs.writeFileSync(PRE_COMMIT_PATH, PRE_COMMIT_SCRIPT, { mode: 0o755 });
  console.log('   ✓ Pre-commit hook installed');

  // Make it executable (Unix)
  try {
    if (process.platform !== 'win32') {
      execSync(`chmod +x "${PRE_COMMIT_PATH}"`);
    }
  } catch (e) {
    // Ignore errors on Windows
  }

  console.log('\n✅ CodeBakers hooks installed successfully!\n');
  console.log('What happens now:');
  console.log('  • Every commit will be validated against CodeBakers patterns');
  console.log('  • Non-compliant code will block the commit');
  console.log('  • Use --no-verify to bypass (not recommended)\n');
  console.log('To uninstall: rm .git/hooks/pre-commit\n');
}

main();
