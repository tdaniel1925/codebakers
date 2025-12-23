import Link from 'next/link';

export const metadata = {
  title: '/status Command - CodeBakers Documentation',
  description: 'Learn how to use the /status command to view project state and progress.',
};

export default function StatusCommandPage() {
  return (
    <article>
      <h1>/status Command</h1>

      <p className="text-lg text-neutral-300">
        View the current state of your project. Shows what&apos;s been built,
        what&apos;s in progress, and what&apos;s planned.
      </p>

      <h2>Usage</h2>

      <pre className="rounded-lg bg-neutral-900 p-4">
        <code className="text-red-400">/status</code>
      </pre>

      <h2>What It Shows</h2>

      <p>
        The status command reads <code>.codebakers.json</code> from your project root
        and displays:
      </p>

      <h3>Project Info</h3>
      <ul>
        <li>Project type (new vs existing)</li>
        <li>When CodeBakers was initialized</li>
        <li>Last activity timestamp</li>
      </ul>

      <h3>Stack Configuration</h3>
      <ul>
        <li>Framework (Next.js, etc.)</li>
        <li>Database (Drizzle + PostgreSQL, etc.)</li>
        <li>Auth provider (Supabase, NextAuth, etc.)</li>
        <li>UI library (shadcn/ui, etc.)</li>
        <li>Payment integrations</li>
      </ul>

      <h3>Design Decisions</h3>
      <ul>
        <li>Auth page layout choice</li>
        <li>Navigation style</li>
        <li>Theme preference</li>
        <li>Form style patterns</li>
      </ul>

      <h3>Audit History</h3>
      <ul>
        <li>Last audit date and score</li>
        <li>Issue counts by priority</li>
        <li>Trend (improving/declining)</li>
      </ul>

      <h2>Example Output</h2>

      <pre className="rounded-lg bg-neutral-900 p-4 text-sm">
        <code className="text-neutral-300">{`📊 CodeBakers Project Status

Project Type: New Project
Created: Jan 15, 2024
Last Updated: Jan 20, 2024

🔧 Stack:
  • Framework: Next.js 14 (App Router)
  • Database: Drizzle + PostgreSQL
  • Auth: Supabase
  • UI: shadcn/ui + Tailwind

🎨 Design Decisions:
  • Auth Layout: 2-panel split screen
  • Navigation: Sidebar
  • Theme: System (dark/light toggle)
  • Forms: Modal dialogs

📋 Audit:
  • Last Run: Jan 18, 2024
  • Score: 82/100 (+7 from previous)
  • Issues: 0 critical, 2 high, 8 medium

✅ Completed Features:
  • User authentication
  • Team management
  • Dashboard layout

🚧 In Progress:
  • Stripe billing integration

📝 Planned:
  • Admin panel
  • Email notifications`}</code>
      </pre>

      <h2>State File Structure</h2>

      <p>
        The <code>.codebakers.json</code> file tracks all project state:
      </p>

      <pre className="rounded-lg bg-neutral-900 p-4 text-sm">
        <code className="text-neutral-300">{`{
  "version": "1.0",
  "projectType": "new",
  "createdAt": "2024-01-15T10:30:00Z",
  "lastUpdated": "2024-01-20T14:22:00Z",

  "decisions": {
    "authLayout": "split",
    "navigation": "sidebar",
    "theme": "system",
    "formStyle": "modal"
  },

  "stack": {
    "framework": "nextjs",
    "database": "drizzle",
    "auth": "supabase",
    "ui": "shadcn",
    "payments": ["stripe"]
  },

  "audit": {
    "status": "completed",
    "lastRun": "2024-01-18T09:00:00Z",
    "score": 82,
    "previousScore": 75,
    "criticalIssues": 0,
    "highIssues": 2,
    "mediumIssues": 8,
    "lowIssues": 3
  },

  "features": {
    "completed": [
      "user-auth",
      "team-management",
      "dashboard"
    ],
    "inProgress": [
      "stripe-billing"
    ],
    "planned": [
      "admin-panel",
      "email-notifications"
    ]
  }
}`}</code>
      </pre>

      <h2>When to Use</h2>

      <ul>
        <li>
          <strong>Starting a new session</strong> - Quickly remember where you left off
        </li>
        <li>
          <strong>Before adding features</strong> - Check what&apos;s already built
        </li>
        <li>
          <strong>After audits</strong> - Track score improvements over time
        </li>
        <li>
          <strong>Team handoffs</strong> - Show project state to collaborators
        </li>
      </ul>

      <h2>Resuming Work</h2>

      <p>
        If you&apos;ve been away from the project, <code>/status</code> helps the AI
        understand context:
      </p>

      <div className="not-prose space-y-3">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <p className="text-sm text-neutral-400">You:</p>
          <code className="text-sm text-neutral-300">/status</code>
          <p className="mt-3 text-sm text-neutral-400">AI:</p>
          <p className="text-sm text-neutral-300">
            Welcome back! I see you&apos;re working on a SaaS project. Last session you were
            adding Stripe billing - the checkout flow is done but webhooks still need
            to be implemented. Want me to continue with webhooks?
          </p>
        </div>
      </div>

      <h2>Maintaining State</h2>

      <p>
        The state file is automatically updated when you:
      </p>

      <ul>
        <li>Make design decisions (layout, theme, etc.)</li>
        <li>Complete features</li>
        <li>Run audits</li>
        <li>Add new integrations</li>
      </ul>

      <p>
        You can also manually edit <code>.codebakers.json</code> if needed,
        but the AI will maintain it automatically during normal usage.
      </p>

      <h2>Related Commands</h2>

      <ul>
        <li>
          <Link href="/docs/commands/audit">/audit</Link> - Run a code audit
        </li>
        <li>
          <Link href="/docs/commands/build">/build</Link> - Start a new project
        </li>
        <li>
          <Link href="/docs/commands/feature">/feature</Link> - Add new features
        </li>
      </ul>
    </article>
  );
}
