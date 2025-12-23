import Link from 'next/link';

export const metadata = {
  title: '/audit Command - CodeBakers Documentation',
  description: 'Learn how to use the /audit command to review code quality and security.',
};

export default function AuditCommandPage() {
  return (
    <article>
      <h1>/audit Command</h1>

      <p className="text-lg text-neutral-300">
        Review your codebase for quality, security, and best practices. Generates
        a detailed report with prioritized recommendations.
      </p>

      <h2>Usage</h2>

      <pre className="rounded-lg bg-neutral-900 p-4">
        <code className="text-red-400">/audit</code>
      </pre>

      <p>
        No arguments needed - the AI scans your entire project automatically.
      </p>

      <h2>What Gets Checked</h2>

      <p>The audit covers 100+ checkpoints across these categories:</p>

      <h3>🔒 Security</h3>
      <ul>
        <li>Input validation with Zod schemas</li>
        <li>SQL injection prevention</li>
        <li>XSS protection in React components</li>
        <li>Authentication and authorization patterns</li>
        <li>Secrets management (no hardcoded API keys)</li>
        <li>HTTPS and secure headers</li>
      </ul>

      <h3>📝 Code Quality</h3>
      <ul>
        <li>TypeScript strict mode enabled</li>
        <li>Proper error handling patterns</li>
        <li>Consistent naming conventions</li>
        <li>No unused imports or variables</li>
        <li>Appropriate code organization</li>
      </ul>

      <h3>⚡ Performance</h3>
      <ul>
        <li>Efficient database queries (N+1 detection)</li>
        <li>Proper use of React hooks (useMemo, useCallback)</li>
        <li>Image optimization</li>
        <li>Bundle size analysis</li>
        <li>Caching strategies</li>
      </ul>

      <h3>🎨 UI/UX</h3>
      <ul>
        <li>Loading states for async operations</li>
        <li>Error state handling in UI</li>
        <li>Accessibility (ARIA labels, keyboard nav)</li>
        <li>Responsive design patterns</li>
        <li>Form validation feedback</li>
      </ul>

      <h3>🧪 Testing</h3>
      <ul>
        <li>Test coverage for critical paths</li>
        <li>E2E tests for user flows</li>
        <li>API endpoint testing</li>
        <li>Mock data patterns</li>
      </ul>

      <h2>Audit Report Format</h2>

      <p>The audit produces a detailed report:</p>

      <pre className="rounded-lg bg-neutral-900 p-4 text-sm">
        <code className="text-neutral-300">{`# CodeBakers Audit Report

## Summary
- Files scanned: 47
- Issues found: 23
- Score: 75/100

## Issues by Priority
- 🔴 Critical: 2
- 🟠 High: 5
- 🟡 Medium: 12
- 🟢 Low: 4

## Critical Issues

### 1. SQL Injection Risk
File: src/app/api/users/route.ts:24

Current:
const user = await db.execute(
  \`SELECT * FROM users WHERE id = \${id}\`
);

Recommended (CodeBakers pattern):
const user = await db
  .select()
  .from(users)
  .where(eq(users.id, id));

Why: Raw SQL with string interpolation
allows injection attacks.`}</code>
      </pre>

      <h2>Issue Priorities</h2>

      <div className="not-prose space-y-3">
        <div className="rounded-lg border border-red-900/50 bg-red-900/20 p-4">
          <div className="font-semibold text-red-400">🔴 Critical</div>
          <p className="mt-1 text-sm text-neutral-400">
            Security vulnerabilities, data integrity risks. Fix immediately before deploying.
          </p>
        </div>
        <div className="rounded-lg border border-orange-900/50 bg-orange-900/20 p-4">
          <div className="font-semibold text-orange-400">🟠 High</div>
          <p className="mt-1 text-sm text-neutral-400">
            Missing error handling, no input validation. Should fix before production.
          </p>
        </div>
        <div className="rounded-lg border border-yellow-900/50 bg-yellow-900/20 p-4">
          <div className="font-semibold text-yellow-400">🟡 Medium</div>
          <p className="mt-1 text-sm text-neutral-400">
            Non-standard patterns, missing types. Fix when time permits.
          </p>
        </div>
        <div className="rounded-lg border border-green-900/50 bg-green-900/20 p-4">
          <div className="font-semibold text-green-400">🟢 Low</div>
          <p className="mt-1 text-sm text-neutral-400">
            Style inconsistencies, naming conventions. Nice to fix but not urgent.
          </p>
        </div>
      </div>

      <h2>Fixing Issues</h2>

      <p>After the audit, you can ask the AI to fix issues:</p>

      <div className="not-prose space-y-3">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <code className="text-sm text-neutral-300">&quot;Fix all critical issues&quot;</code>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <code className="text-sm text-neutral-300">&quot;Fix issue #3 in the audit report&quot;</code>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <code className="text-sm text-neutral-300">&quot;Fix all security issues&quot;</code>
        </div>
      </div>

      <p>
        The AI will apply CodeBakers patterns to fix each issue while preserving
        your existing business logic.
      </p>

      <h2>Audit Score</h2>

      <p>
        Your project receives a score out of 100 based on weighted categories:
      </p>

      <div className="not-prose overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800">
              <th className="py-2 text-left text-neutral-300">Category</th>
              <th className="py-2 text-left text-neutral-300">Weight</th>
            </tr>
          </thead>
          <tbody className="text-neutral-400">
            <tr className="border-b border-neutral-800/50">
              <td className="py-2">Security</td>
              <td className="py-2">30%</td>
            </tr>
            <tr className="border-b border-neutral-800/50">
              <td className="py-2">Code Quality</td>
              <td className="py-2">25%</td>
            </tr>
            <tr className="border-b border-neutral-800/50">
              <td className="py-2">Performance</td>
              <td className="py-2">20%</td>
            </tr>
            <tr className="border-b border-neutral-800/50">
              <td className="py-2">UI/UX</td>
              <td className="py-2">15%</td>
            </tr>
            <tr className="border-b border-neutral-800/50">
              <td className="py-2">Testing</td>
              <td className="py-2">10%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Score Interpretation</h2>

      <ul>
        <li><strong>90-100:</strong> Production ready, excellent patterns</li>
        <li><strong>80-89:</strong> Good quality, minor improvements needed</li>
        <li><strong>70-79:</strong> Acceptable, several issues to address</li>
        <li><strong>60-69:</strong> Needs work before production</li>
        <li><strong>Below 60:</strong> Significant improvements required</li>
      </ul>

      <h2>Tracking Progress</h2>

      <p>
        Audit results are saved to <code>.codebakers.json</code>:
      </p>

      <pre className="rounded-lg bg-neutral-900 p-4 text-sm">
        <code className="text-neutral-300">{`{
  "audit": {
    "status": "completed",
    "lastRun": "2024-01-15T10:30:00Z",
    "score": 75,
    "criticalIssues": 2,
    "highIssues": 5,
    "mediumIssues": 12,
    "lowIssues": 4
  }
}`}</code>
      </pre>

      <p>
        Run <code>/audit</code> again after fixes to see your improved score.
      </p>

      <h2>Related Commands</h2>

      <ul>
        <li>
          <Link href="/docs/commands/build">/build</Link> - Start a new project with best practices
        </li>
        <li>
          <Link href="/docs/commands/feature">/feature</Link> - Add features following patterns
        </li>
        <li>
          <Link href="/docs/commands/status">/status</Link> - View audit history
        </li>
      </ul>
    </article>
  );
}
