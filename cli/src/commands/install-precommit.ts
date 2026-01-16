import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from 'fs';
import { join } from 'path';

const PRE_COMMIT_SCRIPT = `#!/bin/sh
# CodeBakers Pre-Commit Hook - Comprehensive Code Validation
# Actually scans code for pattern violations

# Run the validation script
node "$(dirname "$0")/validate-code.js"
exit $?
`;

const VALIDATE_CODE_SCRIPT = `#!/usr/bin/env node
/**
 * CodeBakers Pre-Commit Code Validator v2.0
 * Comprehensive code validation - 40+ checks
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RED = '\\x1b[31m';
const GREEN = '\\x1b[32m';
const YELLOW = '\\x1b[33m';
const CYAN = '\\x1b[36m';
const DIM = '\\x1b[2m';
const RESET = '\\x1b[0m';

function log(color, message) {
  console.log(color + message + RESET);
}

// Get staged files
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf-8' });
    return output.split('\\n').filter(f => f.trim());
  } catch {
    return [];
  }
}

// Get code files only
function getCodeFiles(files) {
  return files.filter(f =>
    f.endsWith('.ts') || f.endsWith('.tsx') ||
    f.endsWith('.js') || f.endsWith('.jsx')
  );
}

// ============================================
// ALL CHECKS - Organized by Category
// ============================================

const CHECKS = [
  // ==========================================
  // SECURITY CHECKS
  // ==========================================
  {
    name: 'Debugger Statement',
    category: 'security',
    test: (content, file) => {
      if (content.includes('debugger;') || content.includes('debugger ')) {
        return 'debugger statement left in code - remove before commit';
      }
      return null;
    }
  },
  {
    name: 'Hardcoded Secrets',
    category: 'security',
    test: (content, file) => {
      if (file.includes('.env') || file.includes('config')) return null;
      const patterns = [
        /api[_-]?key\\s*[:=]\\s*['"][a-zA-Z0-9]{20,}['"]/i,
        /secret\\s*[:=]\\s*['"][a-zA-Z0-9]{20,}['"]/i,
        /password\\s*[:=]\\s*['"][^'"]{8,}['"]/i,
        /sk_live_[a-zA-Z0-9]+/,
        /sk_test_[a-zA-Z0-9]+/,
        /ghp_[a-zA-Z0-9]+/,  // GitHub token
        /xox[baprs]-[a-zA-Z0-9]+/,  // Slack token
        /AKIA[0-9A-Z]{16}/,  // AWS access key
      ];
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return 'Possible hardcoded secret - use environment variables';
        }
      }
      return null;
    }
  },
  {
    name: 'XSS Vulnerability',
    category: 'security',
    test: (content, file) => {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) return null;
      if (content.includes('dangerouslySetInnerHTML') &&
          !content.includes('DOMPurify') &&
          !content.includes('sanitize')) {
        return 'dangerouslySetInnerHTML without sanitization - XSS risk';
      }
      return null;
    }
  },
  {
    name: 'Merge Conflict Markers',
    category: 'security',
    test: (content, file) => {
      if (content.includes('<<<<<<<') || content.includes('>>>>>>>') || content.includes('=======\\n')) {
        return 'Merge conflict markers found - resolve conflicts first';
      }
      return null;
    }
  },
  {
    name: 'Private Key in Code',
    category: 'security',
    test: (content, file) => {
      if (content.includes('-----BEGIN RSA PRIVATE KEY-----') ||
          content.includes('-----BEGIN PRIVATE KEY-----') ||
          content.includes('-----BEGIN EC PRIVATE KEY-----')) {
        return 'Private key detected in code - NEVER commit private keys';
      }
      return null;
    }
  },
  {
    name: 'Env File Commit',
    category: 'security',
    test: (content, file) => {
      if (file === '.env' || file === '.env.local' || file === '.env.production') {
        return '.env file should not be committed - add to .gitignore';
      }
      return null;
    }
  },
  {
    name: 'SQL Injection Risk',
    category: 'security',
    test: (content, file) => {
      const sqlPatterns = [
        /\\$\\{.*\\}.*(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)/i,
        /['"]\\s*\\+\\s*.*\\+\\s*['"].*(?:SELECT|INSERT|UPDATE|DELETE)/i,
        /sql\\s*\\(\\s*\`[^\\)]*\\$\\{/,
      ];
      for (const pattern of sqlPatterns) {
        if (pattern.test(content)) {
          return 'Possible SQL injection - use parameterized queries';
        }
      }
      return null;
    }
  },
  {
    name: 'Eval Usage',
    category: 'security',
    test: (content, file) => {
      if (/\\beval\\s*\\(/.test(content) || /new\\s+Function\\s*\\(/.test(content)) {
        return 'eval() or new Function() detected - security risk';
      }
      return null;
    }
  },
  {
    name: 'Sensitive Data in Logs',
    category: 'security',
    test: (content, file) => {
      const sensitivePatterns = [
        /console\\.log.*password/i,
        /console\\.log.*token/i,
        /console\\.log.*secret/i,
        /console\\.log.*apiKey/i,
        /console\\.log.*creditCard/i,
        /console\\.log.*ssn/i,
        /console\\.log.*authorization/i,
      ];
      for (const pattern of sensitivePatterns) {
        if (pattern.test(content)) {
          return 'Possible sensitive data being logged';
        }
      }
      return null;
    }
  },

  // ==========================================
  // ERROR HANDLING CHECKS
  // ==========================================
  {
    name: 'API Error Handling',
    category: 'errors',
    test: (content, file) => {
      if (!file.includes('/api/') && !file.includes('route.ts')) return null;
      if (!content.includes('try {') && !content.includes('try{')) {
        return 'API route missing try/catch error handling';
      }
      return null;
    }
  },
  {
    name: 'Empty Catch Block',
    category: 'errors',
    test: (content, file) => {
      if (/catch\\s*\\([^)]*\\)\\s*\\{\\s*\\}/.test(content)) {
        return 'Empty catch block - handle or rethrow errors';
      }
      return null;
    }
  },
  {
    name: 'Catch Without Logging',
    category: 'errors',
    test: (content, file) => {
      const catchBlocks = content.match(/catch\\s*\\([^)]*\\)\\s*\\{[^}]{1,50}\\}/g) || [];
      for (const block of catchBlocks) {
        if (!block.includes('console') && !block.includes('log') &&
            !block.includes('throw') && !block.includes('error') &&
            !block.includes('report') && !block.includes('track')) {
          return 'Catch block may be swallowing errors - log or rethrow';
        }
      }
      return null;
    }
  },
  {
    name: 'Unsafe JSON Parse',
    category: 'errors',
    test: (content, file) => {
      if (content.includes('JSON.parse(') &&
          !content.includes('try') && !content.includes('catch')) {
        return 'JSON.parse without try/catch - can throw on invalid JSON';
      }
      return null;
    }
  },
  {
    name: 'Unhandled Promise',
    category: 'errors',
    test: (content, file) => {
      const lines = content.split('\\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.match(/(?:fetch|axios|db\\.|prisma\\.).*\\(/) &&
            !line.includes('await') &&
            !line.includes('.then') &&
            !line.includes('.catch') &&
            !line.includes('return') &&
            !line.includes('=')) {
          return \`Unhandled promise at line \${i + 1}\`;
        }
      }
      return null;
    }
  },
  {
    name: 'Missing Async Error Handling',
    category: 'errors',
    test: (content, file) => {
      if (!file.includes('/api/') && !file.includes('route.ts')) return null;
      if (content.includes('async') && content.includes('await') &&
          !content.includes('try') && !content.includes('.catch')) {
        return 'Async function with await but no error handling';
      }
      return null;
    }
  },

  // ==========================================
  // VALIDATION CHECKS
  // ==========================================
  {
    name: 'Zod Validation',
    category: 'validation',
    test: (content, file) => {
      if (!file.includes('/api/') && !file.includes('route.ts')) return null;
      if ((content.includes('POST') || content.includes('PUT') || content.includes('PATCH')) &&
          content.includes('req.json()') &&
          !content.includes('z.object') &&
          !content.includes('schema.parse') &&
          !content.includes('Schema.parse') &&
          !content.includes('validate')) {
        return 'API route accepts body but missing Zod validation';
      }
      return null;
    }
  },
  {
    name: 'Missing Auth Check',
    category: 'validation',
    test: (content, file) => {
      if (!file.includes('/api/') && !file.includes('route.ts')) return null;
      if (file.includes('/public/') || file.includes('/auth/') || file.includes('/webhook')) return null;
      if ((content.includes('userId') || content.includes('user.id') || content.includes('session')) &&
          !content.includes('getServerSession') &&
          !content.includes('auth(') &&
          !content.includes('requireAuth') &&
          !content.includes('verifyToken') &&
          !content.includes('validateSession') &&
          !content.includes('getSession')) {
        return 'Route accesses user data but may be missing auth check';
      }
      return null;
    }
  },

  // ==========================================
  // CODE QUALITY CHECKS
  // ==========================================
  {
    name: 'Console Statements',
    category: 'quality',
    test: (content, file) => {
      if (file.includes('.test.') || file.includes('/tests/') || file.includes('/scripts/')) return null;
      const lines = content.split('\\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
        if (line.includes('console.log(')) {
          return \`console.log at line \${i + 1} - use proper logging\`;
        }
      }
      return null;
    }
  },
  {
    name: 'TODO/FIXME Comments',
    category: 'quality',
    test: (content, file) => {
      const match = content.match(/\\/\\/\\s*(TODO|FIXME|XXX|HACK):/i);
      if (match) {
        return \`Unresolved \${match[1]} comment - address before commit\`;
      }
      return null;
    }
  },
  {
    name: 'Hardcoded URLs',
    category: 'quality',
    test: (content, file) => {
      if (file.includes('.test.') || file.includes('/tests/')) return null;
      if (content.includes('localhost:') &&
          !content.includes('process.env') &&
          !content.includes("|| 'http://localhost") &&
          !content.includes('|| "http://localhost')) {
        return 'Hardcoded localhost URL - use environment variable with fallback';
      }
      return null;
    }
  },
  {
    name: 'Large File',
    category: 'quality',
    test: (content, file) => {
      const lines = content.split('\\n').length;
      if (lines > 500) {
        return \`File has \${lines} lines - consider splitting into smaller modules\`;
      }
      return null;
    }
  },
  {
    name: 'Magic Numbers',
    category: 'quality',
    test: (content, file) => {
      // Look for unexplained numbers in conditions
      const magicPattern = /(?:if|while|for)\\s*\\([^)]*[^0-9.](\\d{3,})[^0-9.]/;
      const match = content.match(magicPattern);
      if (match && !content.includes('const') && !content.includes('let')) {
        return 'Magic number detected - use named constants';
      }
      return null;
    }
  },
  {
    name: 'Commented Out Code',
    category: 'quality',
    test: (content, file) => {
      const lines = content.split('\\n');
      let commentedCodeCount = 0;
      for (const line of lines) {
        if (line.trim().match(/^\\/\\/\\s*(const|let|var|function|if|for|while|return|import|export)\\s/)) {
          commentedCodeCount++;
        }
      }
      if (commentedCodeCount > 5) {
        return \`\${commentedCodeCount} lines of commented code - remove dead code\`;
      }
      return null;
    }
  },

  // ==========================================
  // TYPESCRIPT CHECKS
  // ==========================================
  {
    name: 'Any Type Usage',
    category: 'typescript',
    test: (content, file) => {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return null;
      if (content.includes(': any)') || content.includes(': any,') ||
          content.includes(': any;') || content.includes(': any =') ||
          content.includes('<any>') || content.includes('as any')) {
        return 'Using "any" type - provide proper TypeScript types';
      }
      return null;
    }
  },
  {
    name: 'Type Assertion Override',
    category: 'typescript',
    test: (content, file) => {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return null;
      if (content.includes('as unknown as') || content.includes('!.') && content.match(/!\\.[a-zA-Z]/)) {
        return 'Unsafe type assertion - validate types properly';
      }
      return null;
    }
  },
  {
    name: 'Missing Return Type',
    category: 'typescript',
    test: (content, file) => {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return null;
      const exportedFunctions = content.match(/export\\s+(?:async\\s+)?function\\s+\\w+\\s*\\([^)]*\\)\\s*\\{/g) || [];
      for (const func of exportedFunctions) {
        if (!func.includes(':')) {
          return 'Exported function missing return type annotation';
        }
      }
      return null;
    }
  },
  {
    name: 'Non-null Assertion',
    category: 'typescript',
    test: (content, file) => {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return null;
      const assertions = (content.match(/\\w+!/g) || []).filter(m => !m.includes('!='));
      if (assertions.length > 3) {
        return \`\${assertions.length} non-null assertions (!) - handle null cases properly\`;
      }
      return null;
    }
  },

  // ==========================================
  // REACT CHECKS
  // ==========================================
  {
    name: 'Direct DOM Manipulation',
    category: 'react',
    test: (content, file) => {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) return null;
      if (content.includes('document.getElementById') ||
          content.includes('document.querySelector') ||
          content.includes('document.createElement') ||
          content.includes('document.body')) {
        return 'Direct DOM manipulation in React - use refs or state';
      }
      return null;
    }
  },
  {
    name: 'Missing useEffect Cleanup',
    category: 'react',
    test: (content, file) => {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) return null;
      // Check for useEffect with subscriptions but no cleanup
      if (content.includes('useEffect') &&
          (content.includes('addEventListener') ||
           content.includes('subscribe') ||
           content.includes('setInterval') ||
           content.includes('setTimeout')) &&
          !content.includes('removeEventListener') &&
          !content.includes('unsubscribe') &&
          !content.includes('clearInterval') &&
          !content.includes('clearTimeout') &&
          !content.includes('return () =>')) {
        return 'useEffect with subscription but no cleanup - memory leak risk';
      }
      return null;
    }
  },
  {
    name: 'Conditional Hook',
    category: 'react',
    test: (content, file) => {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) return null;
      const lines = content.split('\\n');
      let inCondition = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('if ') || line.startsWith('if(')) inCondition = true;
        if (line.includes('}')) inCondition = false;
        if (inCondition && (line.includes('useState') || line.includes('useEffect') ||
            line.includes('useCallback') || line.includes('useMemo'))) {
          return \`Hook called conditionally at line \${i + 1} - violates Rules of Hooks\`;
        }
      }
      return null;
    }
  },
  {
    name: 'Missing Key Prop',
    category: 'react',
    test: (content, file) => {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) return null;
      if ((content.includes('.map(') || content.includes('.map (')) &&
          content.includes('return') &&
          content.includes('<') &&
          !content.includes('key=') &&
          !content.includes('key:')) {
        return 'Array .map() rendering JSX without key prop';
      }
      return null;
    }
  },
  {
    name: 'Index as Key',
    category: 'react',
    test: (content, file) => {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) return null;
      if (content.includes('key={i}') || content.includes('key={index}') ||
          content.includes('key={idx}')) {
        return 'Using array index as key - use unique identifier instead';
      }
      return null;
    }
  },
  {
    name: 'Inline Function in JSX',
    category: 'react',
    test: (content, file) => {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) return null;
      // Check for arrow functions in onClick, onChange, etc.
      const inlinePatterns = [
        /onClick=\\{\\s*\\(\\)\\s*=>/,
        /onChange=\\{\\s*\\(e?\\)\\s*=>/,
        /onSubmit=\\{\\s*\\(e?\\)\\s*=>/,
      ];
      for (const pattern of inlinePatterns) {
        if (pattern.test(content)) {
          return 'Inline function in JSX - use useCallback for performance';
        }
      }
      return null;
    }
  },
  {
    name: 'Missing Error Boundary',
    category: 'react',
    test: (content, file) => {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) return null;
      // Check if it's a page component without error handling
      if ((file.includes('/app/') || file.includes('/pages/')) &&
          file.includes('page.') &&
          !content.includes('ErrorBoundary') &&
          !content.includes('error.') &&
          content.includes('async')) {
        return 'Page component may need error boundary for async operations';
      }
      return null;
    }
  },

  // ==========================================
  // ACCESSIBILITY CHECKS
  // ==========================================
  {
    name: 'Image Without Alt',
    category: 'a11y',
    test: (content, file) => {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) return null;
      if ((content.includes('<img') || content.includes('<Image')) &&
          !content.includes('alt=') && !content.includes('alt:')) {
        return 'Image without alt attribute - add alt text for accessibility';
      }
      return null;
    }
  },
  {
    name: 'Button Without Type',
    category: 'a11y',
    test: (content, file) => {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) return null;
      // Check for buttons without type attribute
      if (content.includes('<button') &&
          !content.includes('type="button"') &&
          !content.includes('type="submit"') &&
          !content.includes("type='button'") &&
          !content.includes("type='submit'") &&
          !content.includes('type={"button"}') &&
          !content.includes('type={"submit"}')) {
        return 'Button without type attribute - specify type="button" or type="submit"';
      }
      return null;
    }
  },
  {
    name: 'Missing Form Label',
    category: 'a11y',
    test: (content, file) => {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) return null;
      if ((content.includes('<input') || content.includes('<select') || content.includes('<textarea')) &&
          !content.includes('<label') &&
          !content.includes('aria-label') &&
          !content.includes('aria-labelledby') &&
          !content.includes('Label')) {
        return 'Form input without label - add label for accessibility';
      }
      return null;
    }
  },
  {
    name: 'Click Handler Without Keyboard',
    category: 'a11y',
    test: (content, file) => {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) return null;
      // Check for divs/spans with onClick but no keyboard handler
      if ((content.includes('<div') || content.includes('<span')) &&
          content.includes('onClick') &&
          !content.includes('onKeyDown') &&
          !content.includes('onKeyPress') &&
          !content.includes('onKeyUp') &&
          !content.includes('role=') &&
          !content.includes('tabIndex')) {
        return 'Clickable element without keyboard support - add onKeyDown and role';
      }
      return null;
    }
  },
  {
    name: 'Missing ARIA Role',
    category: 'a11y',
    test: (content, file) => {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) return null;
      // Custom interactive elements should have roles
      if (content.includes('onClick') &&
          (content.includes('<div') || content.includes('<span')) &&
          !content.includes('role=') &&
          !content.includes('<button') &&
          !content.includes('<a ')) {
        return 'Interactive element without ARIA role - add appropriate role';
      }
      return null;
    }
  },

  // ==========================================
  // PERFORMANCE CHECKS
  // ==========================================
  {
    name: 'Large Import',
    category: 'performance',
    test: (content, file) => {
      // Check for importing entire libraries
      const largeImports = [
        /import\\s+\\*\\s+as\\s+\\w+\\s+from\\s+['"]lodash['"]/,
        /import\\s+\\{[^}]{100,}\\}\\s+from/,  // Very large destructured import
        /import\\s+moment\\s+from/,  // moment.js is large
      ];
      for (const pattern of largeImports) {
        if (pattern.test(content)) {
          return 'Large library import - use specific imports for smaller bundle';
        }
      }
      return null;
    }
  },
  {
    name: 'Sync File Operation',
    category: 'performance',
    test: (content, file) => {
      if (file.includes('.test.') || file.includes('/scripts/')) return null;
      if (content.includes('readFileSync') || content.includes('writeFileSync') ||
          content.includes('existsSync') || content.includes('readdirSync')) {
        if (file.includes('/api/') || file.includes('route.ts')) {
          return 'Synchronous file operation in API route - use async version';
        }
      }
      return null;
    }
  },
  {
    name: 'Missing Memoization',
    category: 'performance',
    test: (content, file) => {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) return null;
      // Large computations in render without useMemo
      if ((content.includes('.filter(') || content.includes('.reduce(') || content.includes('.sort(')) &&
          content.includes('return') &&
          content.includes('<') &&
          !content.includes('useMemo') &&
          content.split('.filter(').length > 2) {
        return 'Multiple array operations in render - consider useMemo';
      }
      return null;
    }
  },

  // ==========================================
  // API/DATABASE CHECKS
  // ==========================================
  {
    name: 'Missing Rate Limit',
    category: 'api',
    test: (content, file) => {
      if (!file.includes('/api/') && !file.includes('route.ts')) return null;
      if (file.includes('/public/')) return null;
      if (!content.includes('rateLimit') &&
          !content.includes('rateLimiter') &&
          !content.includes('autoRateLimit') &&
          !content.includes('throttle')) {
        return 'API route without rate limiting - add protection against abuse';
      }
      return null;
    }
  },
  {
    name: 'N+1 Query Pattern',
    category: 'api',
    test: (content, file) => {
      // Check for await in loop with database calls
      if ((content.includes('for (') || content.includes('forEach') || content.includes('.map(')) &&
          content.includes('await') &&
          (content.includes('db.') || content.includes('prisma.') || content.includes('findOne') || content.includes('findById'))) {
        return 'Possible N+1 query - fetch data in batch instead of loop';
      }
      return null;
    }
  },
  {
    name: 'Missing CORS Config',
    category: 'api',
    test: (content, file) => {
      if (!file.includes('/api/') && !file.includes('route.ts')) return null;
      if (content.includes("'*'") &&
          (content.includes('Access-Control-Allow-Origin') || content.includes('cors'))) {
        return 'Overly permissive CORS (*) - restrict to specific origins';
      }
      return null;
    }
  },

  // ==========================================
  // IMPORT CHECKS
  // ==========================================
  {
    name: 'Circular Import Risk',
    category: 'imports',
    test: (content, file) => {
      // Check for importing from parent directory and exporting to child
      const parentImports = (content.match(/from\\s+['"]\\.\\.\\/[^'"]+['"]/g) || []).length;
      const hasExport = content.includes('export ');
      if (parentImports > 3 && hasExport) {
        return 'Multiple parent imports - potential circular dependency risk';
      }
      return null;
    }
  },
  {
    name: 'Unused Import',
    category: 'imports',
    test: (content, file) => {
      // Simple check for imported names not used
      const imports = content.match(/import\\s+\\{([^}]+)\\}/g) || [];
      for (const imp of imports) {
        const names = imp.replace(/import\\s+\\{/, '').replace(/\\}/, '').split(',');
        for (const name of names) {
          const cleanName = name.trim().split(' as ')[0].trim();
          if (cleanName && cleanName.length > 1) {
            // Count occurrences (should be > 1 to include the import itself)
            const regex = new RegExp('\\\\b' + cleanName + '\\\\b', 'g');
            const occurrences = (content.match(regex) || []).length;
            if (occurrences === 1) {
              return \`Possibly unused import: \${cleanName}\`;
            }
          }
        }
      }
      return null;
    }
  },
];

async function validateCode() {
  const cwd = process.cwd();
  const violations = [];
  const warnings = [];

  const allStagedFiles = getStagedFiles();
  const codeFiles = getCodeFiles(allStagedFiles);

  log(CYAN, '\\n🍪 CodeBakers Pre-Commit Checks');
  log(CYAN, '================================\\n');

  // Check for .env files being committed
  for (const file of allStagedFiles) {
    if (file.startsWith('.env')) {
      violations.push({
        check: 'Env File Commit',
        category: 'security',
        message: '.env file should not be committed',
        file: file
      });
    }
  }

  if (codeFiles.length === 0 && violations.length === 0) {
    log(DIM, 'No code files staged.\\n');
    log(GREEN, '================================');
    log(GREEN, '✅ All pre-commit checks passed!');
    log(GREEN, '================================\\n');
    return { valid: true };
  }

  log(DIM, '📋 Checking \${codeFiles.length} code file(s)...\\n');

  for (const file of codeFiles) {
    const filePath = path.join(cwd, file);
    if (!fs.existsSync(filePath)) continue;

    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    for (const check of CHECKS) {
      try {
        const result = check.test(content, file);
        if (result) {
          violations.push({
            check: check.name,
            category: check.category,
            message: result,
            file: file
          });
        }
      } catch (err) {
        // Skip check on error
      }
    }
  }

  // Report results
  if (violations.length > 0) {
    // Group by category
    const byCategory = {};
    for (const v of violations) {
      if (!byCategory[v.category]) byCategory[v.category] = [];
      byCategory[v.category].push(v);
    }

    const categoryNames = {
      security: '🔒 Security',
      errors: '⚠️ Error Handling',
      validation: '✅ Validation',
      quality: '📝 Code Quality',
      typescript: '📘 TypeScript',
      react: '⚛️ React',
      a11y: '♿ Accessibility',
      performance: '⚡ Performance',
      api: '🌐 API',
      imports: '📦 Imports',
    };

    log(RED, \`\\n❌ Found \${violations.length} issue(s):\\n\`);

    for (const [category, items] of Object.entries(byCategory)) {
      log(YELLOW, \`\\n\${categoryNames[category] || category}:\`);
      const byFile = {};
      for (const v of items) {
        if (!byFile[v.file]) byFile[v.file] = [];
        byFile[v.file].push(v);
      }
      for (const [file, fileViolations] of Object.entries(byFile)) {
        log(DIM, \`  \${file}:\`);
        for (const v of fileViolations) {
          log(RED, \`    ✗ \${v.message}\`);
        }
      }
    }

    console.log('');
    log(CYAN, 'Fix these issues and try again.');
    log(YELLOW, 'To bypass (not recommended): git commit --no-verify\\n');

    return { valid: false, violations };
  }

  log(GREEN, '✅ All \${CHECKS.length} checks passed!\\n');

  // Run tests if available
  log(DIM, '🧪 Running tests...\\n');

  try {
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts && pkg.scripts.test) {
        execSync('npm test', { stdio: 'inherit', cwd });
        log(GREEN, '✅ Tests passed!\\n');
      } else {
        log(DIM, 'No test script found, skipping...\\n');
      }
    }
  } catch (error) {
    log(RED, '❌ Tests failed!\\n');
    return { valid: false, reason: 'tests-failed' };
  }

  log(GREEN, '================================');
  log(GREEN, '✅ All pre-commit checks passed!');
  log(GREEN, '================================\\n');

  return { valid: true };
}

async function main() {
  const result = await validateCode();
  process.exit(result.valid ? 0 : 1);
}

main().catch(error => {
  log(RED, '  Error: ' + error.message);
  process.exit(1);
});
`;

export async function installPrecommit(): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Pre-Commit Hook Installation\n'));

  const cwd = process.cwd();

  // Check if this is a git repository
  const gitDir = join(cwd, '.git');
  if (!existsSync(gitDir)) {
    console.log(chalk.red('  ✗ Not a git repository'));
    console.log(chalk.gray('  Initialize git first: git init\n'));
    process.exit(1);
  }

  // Create hooks directory if it doesn't exist
  const hooksDir = join(gitDir, 'hooks');
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }

  // Write the pre-commit hook
  const preCommitPath = join(hooksDir, 'pre-commit');
  writeFileSync(preCommitPath, PRE_COMMIT_SCRIPT);

  // Make it executable
  try {
    chmodSync(preCommitPath, '755');
  } catch {
    // Windows doesn't support chmod
  }

  console.log(chalk.green('  ✓ Created pre-commit hook'));

  // Write the validation script
  const validatePath = join(hooksDir, 'validate-code.js');
  writeFileSync(validatePath, VALIDATE_CODE_SCRIPT);

  console.log(chalk.green('  ✓ Created code validation script (40+ checks)'));

  // Check if husky is being used
  const huskyDir = join(cwd, '.husky');
  if (existsSync(huskyDir)) {
    const huskyPreCommit = join(huskyDir, 'pre-commit');
    let huskyContent = '';

    if (existsSync(huskyPreCommit)) {
      huskyContent = readFileSync(huskyPreCommit, 'utf-8');
      if (!huskyContent.includes('validate-code')) {
        huskyContent += '\n# CodeBakers code validation\nnode .git/hooks/validate-code.js\n';
        writeFileSync(huskyPreCommit, huskyContent);
        console.log(chalk.green('  ✓ Added to existing husky pre-commit'));
      }
    } else {
      huskyContent = '#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\n# CodeBakers code validation\nnode .git/hooks/validate-code.js\n';
      writeFileSync(huskyPreCommit, huskyContent);
      try {
        chmodSync(huskyPreCommit, '755');
      } catch {}
      console.log(chalk.green('  ✓ Created husky pre-commit hook'));
    }
  }

  console.log(chalk.green('\n  ✅ Pre-commit hook installed with 40+ checks!\n'));

  console.log(chalk.cyan('  🔒 Security (9 checks):'));
  console.log(chalk.gray('     Debugger statements, hardcoded secrets, XSS, SQL injection,'));
  console.log(chalk.gray('     merge conflicts, private keys, .env files, eval(), sensitive logs\n'));

  console.log(chalk.cyan('  ⚠️  Error Handling (6 checks):'));
  console.log(chalk.gray('     API try/catch, empty catch, unhandled promises, JSON.parse safety\n'));

  console.log(chalk.cyan('  📘 TypeScript (4 checks):'));
  console.log(chalk.gray('     No "any" types, unsafe assertions, return types, non-null assertions\n'));

  console.log(chalk.cyan('  ⚛️  React (7 checks):'));
  console.log(chalk.gray('     DOM manipulation, useEffect cleanup, conditional hooks, keys,'));
  console.log(chalk.gray('     inline functions, error boundaries\n'));

  console.log(chalk.cyan('  ♿ Accessibility (5 checks):'));
  console.log(chalk.gray('     Image alt text, button types, form labels, keyboard support, ARIA roles\n'));

  console.log(chalk.cyan('  ⚡ Performance (3 checks):'));
  console.log(chalk.gray('     Large imports, sync file operations, missing memoization\n'));

  console.log(chalk.cyan('  🌐 API (3 checks):'));
  console.log(chalk.gray('     Rate limiting, N+1 queries, CORS config\n'));

  console.log(chalk.cyan('  📝 Code Quality (6 checks):'));
  console.log(chalk.gray('     Console.log, TODO/FIXME, hardcoded URLs, file size, magic numbers\n'));

  console.log(chalk.yellow('  To bypass (not recommended): git commit --no-verify\n'));
}
