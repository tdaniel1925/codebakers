import Link from 'next/link';

export const metadata = {
  title: 'Documentation - CodeBakers',
  description: 'Learn how to use CodeBakers to build production-ready code faster.',
};

export default function DocsPage() {
  return (
    <article>
      <h1>CodeBakers Documentation</h1>

      <p className="text-lg text-neutral-300">
        CodeBakers gives your AI coding assistant access to 34 production-ready pattern modules,
        helping you build faster with battle-tested code patterns.
      </p>

      <h2>What is CodeBakers?</h2>

      <p>
        CodeBakers is a pattern library that integrates with AI coding tools like Claude Code and Cursor.
        Instead of relying on generic AI responses, CodeBakers provides structured, production-ready patterns
        for common development tasks.
      </p>

      <h3>Key Features</h3>

      <ul>
        <li><strong>34 Pattern Modules</strong> - Covering database, auth, API, frontend, payments, and more</li>
        <li><strong>MCP Integration</strong> - Works seamlessly with Claude Code via Model Context Protocol</li>
        <li><strong>Smart Router</strong> - Automatically loads relevant patterns based on your request</li>
        <li><strong>Always Updated</strong> - Patterns are continuously improved with latest best practices</li>
      </ul>

      <h2>Quick Start</h2>

      <p>Get up and running in 2 minutes:</p>

      <pre><code className="language-bash">{`# 1. Install and configure
npx @codebakers/cli setup

# 2. Add to Claude Code
/mcp add codebakers npx -y @codebakers/cli serve`}</code></pre>

      <p>
        That's it! Now when you ask Claude Code to build features, it will automatically use
        CodeBakers patterns.
      </p>

      <h2>Available Commands</h2>

      <p>CodeBakers adds four powerful commands to your workflow:</p>

      <div className="not-prose grid gap-4 md:grid-cols-2">
        <Link
          href="/docs/commands/build"
          className="block rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 transition-colors hover:border-red-500/50"
        >
          <code className="text-red-400">/build</code>
          <p className="mt-2 text-sm text-neutral-400">
            Start a new project from scratch with full planning and execution.
          </p>
        </Link>

        <Link
          href="/docs/commands/feature"
          className="block rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 transition-colors hover:border-red-500/50"
        >
          <code className="text-red-400">/feature</code>
          <p className="mt-2 text-sm text-neutral-400">
            Add new functionality to an existing project.
          </p>
        </Link>

        <Link
          href="/docs/commands/audit"
          className="block rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 transition-colors hover:border-red-500/50"
        >
          <code className="text-red-400">/audit</code>
          <p className="mt-2 text-sm text-neutral-400">
            Audit existing code for quality, security, and best practices.
          </p>
        </Link>

        <Link
          href="/docs/commands/status"
          className="block rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 transition-colors hover:border-red-500/50"
        >
          <code className="text-red-400">/status</code>
          <p className="mt-2 text-sm text-neutral-400">
            View project progress and what's been built.
          </p>
        </Link>
      </div>

      <h2>Next Steps</h2>

      <ul>
        <li><Link href="/docs/getting-started">Installation Guide</Link> - Detailed setup instructions</li>
        <li><Link href="/docs/commands">Commands Reference</Link> - Learn all available commands</li>
        <li><Link href="/docs/modules">Module Reference</Link> - Explore all 34 pattern modules</li>
      </ul>
    </article>
  );
}
