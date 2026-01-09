export const metadata = {
  title: 'Getting Started - CodeBakers Documentation',
  description: 'Learn how to install and configure CodeBakers for your AI coding assistant.',
};

export default function GettingStartedPage() {
  return (
    <article>
      <h1>Getting Started</h1>

      <p className="text-lg text-neutral-300">
        Get CodeBakers running in under 2 minutes. Choose your preferred setup method below.
      </p>

      <div className="p-4 rounded-lg bg-green-900/20 border border-green-800/50 my-6">
        <p className="text-green-400 font-medium">
          🎉 14-day free trial — No credit card required
        </p>
      </div>

      <h2>Option A: VS Code Extension (Recommended)</h2>

      <p>
        The easiest way to get started. Our VS Code extension includes built-in Claude AI
        with unlimited usage during your trial.
      </p>

      <h3>Step 1: Install the Extension</h3>

      <ol>
        <li>Open VS Code</li>
        <li>Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)</li>
        <li>Search for <strong>"CodeBakers"</strong></li>
        <li>Click Install</li>
      </ol>

      <h3>Step 2: Sign In</h3>

      <ol>
        <li>Click the CodeBakers icon in the sidebar (or press Ctrl+Alt+C / Cmd+Alt+C)</li>
        <li>Click "Login with GitHub"</li>
        <li>Authorize the app — your 14-day trial starts immediately</li>
      </ol>

      <h3>Step 3: Start Building</h3>

      <p>
        Open the CodeBakers chat panel and ask it to build something:
      </p>

      <pre><code className="language-text">{`Build me a todo app with authentication`}</code></pre>

      <p>
        That's it! The AI will follow production patterns automatically.
      </p>

      <hr className="my-8 border-neutral-800" />

      <h2>Option B: CLI + Cursor/Claude Code</h2>

      <p>
        If you prefer to use Cursor IDE or Claude Code CLI, use our MCP integration.
      </p>

      <h3>Prerequisites</h3>

      <ul>
        <li>Node.js 18 or later</li>
        <li>Cursor or Claude Code CLI installed</li>
        <li>A CodeBakers account (<a href="/signup">sign up free</a>)</li>
      </ul>

      <h3>Step 1: Get Your API Key</h3>

      <ol>
        <li>Go to the <a href="/dashboard">CodeBakers Dashboard</a></li>
        <li>Your API key is displayed on the main dashboard page</li>
        <li>Copy the key (it starts with <code>cb_</code>)</li>
      </ol>

      <h3>Step 2: Install the CLI</h3>

      <p>Run the setup command in your project directory:</p>

      <pre><code className="language-bash">{`npx @codebakers/cli setup`}</code></pre>

      <p>This will:</p>
      <ul>
        <li>Prompt you for your API key</li>
        <li>Validate the key with our servers</li>
        <li>Configure your IDE (Cursor or Claude Code)</li>
        <li>Install the CLAUDE.md router file</li>
      </ul>

      <h3>Step 3: Configure Your AI Tool</h3>

      <h4>For Claude Code CLI</h4>

      <p>Add the MCP server to Claude Code:</p>

      <pre><code className="language-bash">{`/mcp add codebakers npx -y @codebakers/cli serve`}</code></pre>

      <h4>For Cursor</h4>

      <p>
        The setup command automatically configures <code>.cursor/mcp.json</code>.
        Restart Cursor to activate the MCP server.
      </p>

      <h3>Step 4: Verify Installation</h3>

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

      <hr className="my-8 border-neutral-800" />

      <h2>Adding to an Existing Project</h2>

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

      <h3>VS Code Extension Issues</h3>

      <p>
        If the extension isn't working:
      </p>
      <ol>
        <li>Make sure you're signed in (check the CodeBakers panel)</li>
        <li>Reload VS Code (Ctrl+Shift+P → "Reload Window")</li>
        <li>Check the Output panel (Ctrl+Shift+U) for errors</li>
      </ol>

      <h3>API Key Not Working (CLI)</h3>

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
