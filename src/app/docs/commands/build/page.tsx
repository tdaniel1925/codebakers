import Link from 'next/link';

export const metadata = {
  title: '/build Command - CodeBakers Documentation',
  description: 'Learn how to use the /build command to start new projects from scratch.',
};

export default function BuildCommandPage() {
  return (
    <article>
      <h1>/build Command</h1>

      <p className="text-lg text-neutral-300">
        Start a completely new project from scratch. The AI will guide you through discovery,
        create a detailed PRD, and build your app phase by phase with tests.
      </p>

      <h2>Usage</h2>

      <pre className="rounded-lg bg-neutral-900 p-4">
        <code className="text-red-400">/build [idea]</code>
      </pre>

      <h2>Examples</h2>

      <div className="not-prose space-y-3">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <code className="text-sm text-neutral-300">/build a project management tool for remote teams</code>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <code className="text-sm text-neutral-300">/build SaaS for scheduling social media posts</code>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <code className="text-sm text-neutral-300">/build marketplace connecting freelance designers with clients</code>
        </div>
      </div>

      <h2>What Happens</h2>

      <p>When you run <code>/build</code>, the AI follows a structured workflow:</p>

      <h3>1. Discovery Phase</h3>
      <p>
        The AI asks clarifying questions to understand your vision:
      </p>
      <ul>
        <li>Who are your target users?</li>
        <li>What problem does this solve?</li>
        <li>What are the must-have features for MVP?</li>
        <li>Any specific tech preferences?</li>
      </ul>

      <h3>2. Planning Phase</h3>
      <p>
        Based on your answers, the AI creates:
      </p>
      <ul>
        <li>Product Requirements Document (PRD)</li>
        <li>Database schema design</li>
        <li>API endpoint specifications</li>
        <li>UI/UX wireframe descriptions</li>
        <li>Test plan outline</li>
      </ul>

      <h3>3. Build Phase</h3>
      <p>
        The AI builds your app in logical phases:
      </p>
      <ol>
        <li><strong>Foundation</strong> - Project setup, database, auth</li>
        <li><strong>Core Features</strong> - Main functionality</li>
        <li><strong>UI Polish</strong> - Components, styling, UX</li>
        <li><strong>Testing</strong> - Unit and E2E tests</li>
        <li><strong>Production Ready</strong> - Error handling, logging, monitoring</li>
      </ol>

      <h2>Modules Loaded</h2>

      <p>
        The <code>/build</code> command automatically loads these pattern modules based on your project needs:
      </p>

      <ul>
        <li><code>00-core</code> - Always loaded for standards and quality</li>
        <li><code>10-generators</code> - Project scaffolding templates</li>
        <li><code>01-database</code> - Drizzle ORM patterns</li>
        <li><code>02-auth</code> - Authentication if needed</li>
        <li><code>04-frontend</code> - React/Next.js patterns</li>
        <li><code>09-design</code> - UI/UX guidelines</li>
      </ul>

      <p>
        Additional modules are loaded dynamically based on features you request
        (payments, teams, AI, etc.).
      </p>

      <h2>Project Templates</h2>

      <p>
        If you&apos;re unsure what to build, <code>/build</code> can suggest templates:
      </p>

      <div className="not-prose space-y-3">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="font-semibold text-white">SaaS Starter</div>
          <p className="mt-1 text-sm text-neutral-400">
            Auth, billing, teams, dashboard - everything you need for a subscription business
          </p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="font-semibold text-white">Marketplace</div>
          <p className="mt-1 text-sm text-neutral-400">
            Two-sided platform with listings, search, payments, and messaging
          </p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="font-semibold text-white">Admin Dashboard</div>
          <p className="mt-1 text-sm text-neutral-400">
            Internal tools with data tables, charts, and role-based access
          </p>
        </div>
      </div>

      <h2>Best Practices</h2>

      <ul>
        <li>
          <strong>Be specific</strong> - &quot;task management for developers&quot; is better than &quot;task app&quot;
        </li>
        <li>
          <strong>Mention key features</strong> - &quot;with Stripe billing and team workspaces&quot;
        </li>
        <li>
          <strong>State constraints</strong> - &quot;mobile-first&quot; or &quot;must integrate with Slack&quot;
        </li>
      </ul>

      <h2>State Tracking</h2>

      <p>
        Progress is saved to <code>.codebakers.json</code> in your project root.
        If your session ends, you can resume by running <Link href="/docs/commands/status">/status</Link> to
        see where you left off.
      </p>

      <h2>Related Commands</h2>

      <ul>
        <li>
          <Link href="/docs/commands/feature">/feature</Link> - Add features to existing projects
        </li>
        <li>
          <Link href="/docs/commands/audit">/audit</Link> - Review code quality
        </li>
        <li>
          <Link href="/docs/commands/status">/status</Link> - Check project progress
        </li>
      </ul>
    </article>
  );
}
