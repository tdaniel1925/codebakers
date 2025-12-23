import Link from 'next/link';

export const metadata = {
  title: '/feature Command - CodeBakers Documentation',
  description: 'Learn how to use the /feature command to add functionality to existing projects.',
};

export default function FeatureCommandPage() {
  return (
    <article>
      <h1>/feature Command</h1>

      <p className="text-lg text-neutral-300">
        Add new functionality to an existing project. The AI analyzes your codebase
        and integrates the new feature properly, following your existing patterns.
      </p>

      <h2>Usage</h2>

      <pre className="rounded-lg bg-neutral-900 p-4">
        <code className="text-red-400">/feature [description]</code>
      </pre>

      <h2>Examples</h2>

      <div className="not-prose space-y-3">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <code className="text-sm text-neutral-300">/feature add dark mode toggle</code>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <code className="text-sm text-neutral-300">/feature user profile page with avatar upload</code>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <code className="text-sm text-neutral-300">/feature Stripe subscription billing with usage-based pricing</code>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <code className="text-sm text-neutral-300">/feature export data to CSV and PDF</code>
        </div>
      </div>

      <h2>What Happens</h2>

      <p>When you run <code>/feature</code>, the AI:</p>

      <h3>1. Analyzes Your Codebase</h3>
      <ul>
        <li>Scans existing file structure and patterns</li>
        <li>Identifies your tech stack (framework, database, UI library)</li>
        <li>Checks what&apos;s already built to avoid duplication</li>
        <li>Reads <code>.codebakers.json</code> for project context</li>
      </ul>

      <h3>2. Plans the Integration</h3>
      <ul>
        <li>Determines which files need to be created or modified</li>
        <li>Identifies database schema changes if needed</li>
        <li>Lists required dependencies</li>
        <li>Maps out API endpoints and UI components</li>
      </ul>

      <h3>3. Implements the Feature</h3>
      <ul>
        <li>Creates new files following your existing conventions</li>
        <li>Modifies existing files minimally and safely</li>
        <li>Adds proper TypeScript types</li>
        <li>Includes error handling and loading states</li>
        <li>Writes tests for the new functionality</li>
      </ul>

      <h2>Module Detection</h2>

      <p>
        The AI automatically loads relevant pattern modules based on your feature request:
      </p>

      <div className="not-prose overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800">
              <th className="py-2 text-left text-neutral-300">Feature Keywords</th>
              <th className="py-2 text-left text-neutral-300">Modules Loaded</th>
            </tr>
          </thead>
          <tbody className="text-neutral-400">
            <tr className="border-b border-neutral-800/50">
              <td className="py-2">auth, login, signup</td>
              <td className="py-2">02-auth, 04-frontend</td>
            </tr>
            <tr className="border-b border-neutral-800/50">
              <td className="py-2">payment, billing, stripe</td>
              <td className="py-2">05-payments, 03-api</td>
            </tr>
            <tr className="border-b border-neutral-800/50">
              <td className="py-2">team, invite, members</td>
              <td className="py-2">12-saas, 01-database</td>
            </tr>
            <tr className="border-b border-neutral-800/50">
              <td className="py-2">email, notification</td>
              <td className="py-2">06-integrations, 11-realtime</td>
            </tr>
            <tr className="border-b border-neutral-800/50">
              <td className="py-2">chart, dashboard, analytics</td>
              <td className="py-2">29-data-viz, 26-analytics</td>
            </tr>
            <tr className="border-b border-neutral-800/50">
              <td className="py-2">search, filter</td>
              <td className="py-2">27-search, 04-frontend</td>
            </tr>
            <tr className="border-b border-neutral-800/50">
              <td className="py-2">AI, chat, GPT</td>
              <td className="py-2">14-ai, 03-api</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Best Practices</h2>

      <ul>
        <li>
          <strong>Be descriptive</strong> - Include key details like &quot;with validation&quot; or &quot;using Stripe&quot;
        </li>
        <li>
          <strong>One feature at a time</strong> - Complex features work better when broken down
        </li>
        <li>
          <strong>Mention integrations</strong> - If the feature connects to external services, say so
        </li>
        <li>
          <strong>Specify UI preferences</strong> - &quot;modal form&quot; vs &quot;full page&quot; vs &quot;inline&quot;
        </li>
      </ul>

      <h2>Feature Complexity</h2>

      <p>Features are categorized by complexity:</p>

      <div className="not-prose space-y-3">
        <div className="rounded-lg border border-green-900/50 bg-green-900/20 p-4">
          <div className="font-semibold text-green-400">Simple (1-3 files)</div>
          <p className="mt-1 text-sm text-neutral-400">
            Dark mode toggle, loading spinners, form validation
          </p>
        </div>
        <div className="rounded-lg border border-yellow-900/50 bg-yellow-900/20 p-4">
          <div className="font-semibold text-yellow-400">Medium (4-10 files)</div>
          <p className="mt-1 text-sm text-neutral-400">
            User profile page, settings panel, data export
          </p>
        </div>
        <div className="rounded-lg border border-red-900/50 bg-red-900/20 p-4">
          <div className="font-semibold text-red-400">Complex (10+ files)</div>
          <p className="mt-1 text-sm text-neutral-400">
            Payment system, team management, real-time collaboration
          </p>
        </div>
      </div>

      <h2>Dependency Handling</h2>

      <p>
        Before implementing, the AI checks if required dependencies are installed.
        If not, it will show the install command:
      </p>

      <pre className="rounded-lg bg-neutral-900 p-4 text-sm">
        <code className="text-neutral-300">{`⚠️ Missing dependencies:
  npm install stripe @stripe/stripe-js

Install before proceeding? (y/n)`}</code>
      </pre>

      <h2>Related Commands</h2>

      <ul>
        <li>
          <Link href="/docs/commands/build">/build</Link> - Start a new project
        </li>
        <li>
          <Link href="/docs/commands/audit">/audit</Link> - Review existing code
        </li>
        <li>
          <Link href="/docs/commands/status">/status</Link> - Check project state
        </li>
      </ul>
    </article>
  );
}
