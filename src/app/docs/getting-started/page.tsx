export const metadata = {
  title: 'Getting Started - CodeBakers Documentation',
  description: 'Learn how to install and configure CodeBakers for your AI coding assistant.',
};

export default function GettingStartedPage() {
  return (
    <article>
      <h1>Getting Started</h1>

      <p className="text-lg text-neutral-300">
        This guide will help you set up CodeBakers with your AI coding tool in just a few minutes.
      </p>

      <h2>Prerequisites</h2>

      <ul>
        <li>Node.js 18 or later</li>
        <li>Claude Code (VS Code extension or CLI) or Cursor</li>
        <li>A CodeBakers account (<a href="/signup">sign up free</a>)</li>
      </ul>

      <h2>Step 1: Get Your API Key</h2>

      <ol>
        <li>Go to the <a href="/dashboard">CodeBakers Dashboard</a></li>
        <li>Your API key is displayed on the main dashboard page</li>
        <li>Copy the key (it starts with <code>cb_</code>)</li>
      </ol>

      <h2>Step 2: Install the CLI</h2>

      <p>Run the setup command in your project directory:</p>

      <pre><code className="language-bash">{`npx @codebakers/cli setup`}</code></pre>

      <p>This will:</p>
      <ul>
        <li>Prompt you for your API key</li>
        <li>Validate the key with our servers</li>
        <li>Configure your IDE (Cursor or Claude Code)</li>
        <li>Install the CLAUDE.md router file</li>
      </ul>

      <h2>Step 3: Configure Your AI Tool</h2>

      <h3>For Claude Code</h3>

      <p>Add the MCP server to Claude Code:</p>

      <pre><code className="language-bash">{`/mcp add codebakers npx -y @codebakers/cli serve`}</code></pre>

      <h3>For Cursor</h3>

      <p>
        The setup command automatically configures <code>.cursor/mcp.json</code>.
        Restart Cursor to activate the MCP server.
      </p>

      <h2>Step 4: Verify Installation</h2>

      <p>
        In your AI tool, try asking:
      </p>

      <pre><code className="language-text">{`/build a simple todo app`}</code></pre>

      <p>
        If CodeBakers is working, the AI will:
      </p>
      <ol>
        <li>Ask discovery questions about your requirements</li>
        <li>Create a detailed product plan</li>
        <li>Build the app using production patterns</li>
        <li>Include tests for all features</li>
      </ol>

      <h2>Existing Project?</h2>

      <p>
        If you're adding CodeBakers to an existing project, we recommend starting with an audit:
      </p>

      <pre><code className="language-text">{`/audit`}</code></pre>

      <p>
        This will scan your codebase and show you:
      </p>
      <ul>
        <li>Security issues (SQL injection, XSS, etc.)</li>
        <li>Missing validation and error handling</li>
        <li>Performance opportunities</li>
        <li>Test coverage gaps</li>
        <li>An overall quality score out of 100</li>
      </ul>

      <h2>Troubleshooting</h2>

      <h3>API Key Not Working</h3>

      <p>
        If you see "Invalid API key", try regenerating your key in the dashboard and running
        setup again:
      </p>

      <pre><code className="language-bash">{`npx @codebakers/cli setup`}</code></pre>

      <h3>MCP Server Not Connecting</h3>

      <p>
        For Claude Code, verify the MCP server is listed:
      </p>

      <pre><code className="language-bash">{`/mcp list`}</code></pre>

      <p>
        If "codebakers" isn't listed, add it manually:
      </p>

      <pre><code className="language-bash">{`/mcp add codebakers npx -y @codebakers/cli serve`}</code></pre>

      <h3>Patterns Not Loading</h3>

      <p>
        Ensure your <code>CLAUDE.md</code> file exists in the project root. If not, run:
      </p>

      <pre><code className="language-bash">{`npx @codebakers/cli setup`}</code></pre>

      <h2>Next Steps</h2>

      <p>
        Now that you're set up, explore the available commands:
      </p>

      <ul>
        <li><a href="/docs/commands/build">/build</a> - Start a new project</li>
        <li><a href="/docs/commands/feature">/feature</a> - Add features to existing projects</li>
        <li><a href="/docs/commands/audit">/audit</a> - Audit code quality</li>
        <li><a href="/docs/commands/status">/status</a> - View project progress</li>
      </ul>
    </article>
  );
}
