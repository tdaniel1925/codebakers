#!/usr/bin/env node
/**
 * CodeBakers Git Hooks Installer
 *
 * Installs pre-commit hooks for:
 * - Pattern compliance validation
 * - Automated test running
 *
 * Run: node scripts/install-hooks.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HOOKS_DIR = path.join(process.cwd(), '.git', 'hooks');
const PRE_COMMIT_PATH = path.join(HOOKS_DIR, 'pre-commit');

const PRE_COMMIT_SCRIPT = `#!/bin/sh
# CodeBakers Pre-Commit Hook
# Validates code and runs tests before allowing commit.

echo ""
echo "🍪 CodeBakers Pre-Commit Checks"
echo "================================"
echo ""

# Step 1: Pattern Compliance
echo "📋 Step 1/2: Checking pattern compliance..."
node scripts/validate-codebakers-compliance.js --staged

COMPLIANCE_RESULT=$?

if [ $COMPLIANCE_RESULT -ne 0 ]; then
  echo ""
  echo "❌ Pattern compliance check failed."
  echo ""
  echo "Fix the issues above before committing."
  echo "See .claude/ pattern files for correct implementations."
  echo ""
  echo "To bypass (NOT recommended): git commit --no-verify"
  exit 1
fi

echo "✅ Pattern compliance passed!"
echo ""

# Step 2: Run Tests (only if tests directory exists)
if [ -d "tests" ] || [ -d "test" ]; then
  echo "🧪 Step 2/2: Running tests..."
  npm test -- --reporter=dot 2>/dev/null

  TEST_RESULT=$?

  if [ $TEST_RESULT -ne 0 ]; then
    echo ""
    echo "❌ Tests failed. Commit blocked."
    echo ""
    echo "Run 'npm test' to see detailed failures."
    echo ""
    echo "To bypass (NOT recommended): git commit --no-verify"
    exit 1
  fi

  echo "✅ Tests passed!"
else
  echo "⏭️  Step 2/2: No tests directory found, skipping..."
fi

echo ""
echo "================================"
echo "✅ All pre-commit checks passed!"
echo "================================"
echo ""

exit 0
`;

function main() {
  console.log('🍪 CodeBakers Hook Installer\\n');

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
    console.log('   Backing up existing pre-commit hook to ' + backupPath);
    fs.copyFileSync(PRE_COMMIT_PATH, backupPath);
  }

  // Write the pre-commit hook
  fs.writeFileSync(PRE_COMMIT_PATH, PRE_COMMIT_SCRIPT, { mode: 0o755 });
  console.log('   ✓ Pre-commit hook installed');

  // Make it executable (Unix)
  try {
    if (process.platform !== 'win32') {
      execSync('chmod +x "' + PRE_COMMIT_PATH + '"');
    }
  } catch (e) {
    // Ignore errors on Windows
  }

  console.log('\\n✅ CodeBakers hooks installed successfully!\\n');
  console.log('What happens on every commit:');
  console.log('  1. Pattern compliance check (validates against .claude/ patterns)');
  console.log('  2. Test suite runs (blocks commit if tests fail)');
  console.log('');
  console.log('To bypass (not recommended): git commit --no-verify');
  console.log('To uninstall: rm .git/hooks/pre-commit\\n');
}

main();
