import Link from 'next/link';

export const metadata = {
  title: 'Commands - CodeBakers Documentation',
  description: 'Learn about all the commands available in CodeBakers.',
};

export default function CommandsPage() {
  return (
    <article>
      <h1>Commands Reference</h1>

      <p className="text-lg text-neutral-300">
        CodeBakers provides four main commands that enhance your AI coding workflow.
        These commands trigger structured workflows that produce consistent, high-quality results.
      </p>

      <h2>Available Commands</h2>

      <div className="not-prose space-y-4">
        <Link
          href="/docs/commands/build"
          className="block rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 transition-colors hover:border-red-500/50"
        >
          <div className="flex items-center gap-3">
            <code className="text-xl text-red-400">/build [idea]</code>
          </div>
          <p className="mt-3 text-neutral-300">
            Start a completely new project from scratch. The AI will ask discovery questions,
            create a detailed PRD, and build your app phase by phase with tests.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Example: <code>/build a project management tool for remote teams</code>
          </p>
        </Link>

        <Link
          href="/docs/commands/feature"
          className="block rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 transition-colors hover:border-red-500/50"
        >
          <div className="flex items-center gap-3">
            <code className="text-xl text-red-400">/feature [idea]</code>
          </div>
          <p className="mt-3 text-neutral-300">
            Add new functionality to an existing project. The AI analyzes your codebase
            and integrates the new feature properly following your existing patterns.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Example: <code>/feature add dark mode toggle</code>
          </p>
        </Link>

        <Link
          href="/docs/commands/audit"
          className="block rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 transition-colors hover:border-red-500/50"
        >
          <div className="flex items-center gap-3">
            <code className="text-xl text-red-400">/audit</code>
          </div>
          <p className="mt-3 text-neutral-300">
            Review your codebase for quality, security, and best practices. Generates
            a detailed report with prioritized recommendations.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Great for existing projects to see how they compare to production standards.
          </p>
        </Link>

        <Link
          href="/docs/commands/status"
          className="block rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 transition-colors hover:border-red-500/50"
        >
          <div className="flex items-center gap-3">
            <code className="text-xl text-red-400">/status</code>
          </div>
          <p className="mt-3 text-neutral-300">
            View the current state of your project. Shows what's been built,
            what's in progress, and what's planned.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Reads from <code>.codebakers.json</code> in your project root.
          </p>
        </Link>
      </div>

      <h2>How Commands Work</h2>

      <p>
        When you run a command, the AI automatically:
      </p>

      <ol>
        <li>Detects the context (new vs existing project)</li>
        <li>Loads relevant pattern modules from your library</li>
        <li>Follows structured workflows defined in the patterns</li>
        <li>Applies production best practices</li>
        <li>Writes tests for everything it creates</li>
      </ol>

      <h2>Pattern Modules</h2>

      <p>
        Commands automatically load the pattern modules they need. For example,
        adding authentication loads:
      </p>

      <ul>
        <li><code>00-core</code> - Core standards (always loaded)</li>
        <li><code>01-database</code> - Database patterns</li>
        <li><code>02-auth</code> - Authentication patterns</li>
        <li><code>04-frontend</code> - Frontend components</li>
      </ul>

      <p>
        See the full <Link href="/docs/modules">Module Reference</Link> for all 34 available modules.
      </p>

      <h2>Project State</h2>

      <p>
        CodeBakers tracks project state in <code>.codebakers.json</code>. This file stores:
      </p>

      <ul>
        <li>Project type (new vs existing)</li>
        <li>Stack decisions (framework, database, UI)</li>
        <li>Audit history and scores</li>
        <li>Migration progress for existing projects</li>
      </ul>

      <p>
        This allows the AI to maintain context across sessions and provide
        relevant suggestions based on your project's history.
      </p>
    </article>
  );
}
