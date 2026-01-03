'use client';

import { useState } from 'react';
import {
  BookOpen,
  LayoutDashboard,
  Rocket,
  Settings,
  Users,
  CreditCard,
  Key,
  Terminal,
  FolderKanban,
  BarChart3,
  Cpu,
  ChevronDown,
  ChevronRight,
  Search,
  ExternalLink,
  Zap,
  Shield,
  FileCode,
  MessageSquare,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

interface DocSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

const docSections: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Rocket,
    content: (
      <>
        <h3>Welcome to CodeBakers</h3>
        <p>
          CodeBakers supercharges your AI coding assistant with 59 production-ready pattern modules.
          Whether you use Claude Code, Cursor, or other AI tools, CodeBakers helps you write
          better code faster.
        </p>

        <h4>Quick Start (3 Steps)</h4>
        <ol>
          <li>
            <strong>Copy your API key</strong> from the dashboard (starts with <code>cb_</code>)
          </li>
          <li>
            <strong>Install the CLI</strong> in your project:
            <pre><code>npx @codebakers/cli setup</code></pre>
          </li>
          <li>
            <strong>Add the MCP server</strong> to your AI tool:
            <pre><code>/mcp add codebakers npx -y @codebakers/cli serve</code></pre>
          </li>
        </ol>

        <h4>First Commands to Try</h4>
        <ul>
          <li><code>/build a simple todo app</code> - Create a new project from scratch</li>
          <li><code>/audit</code> - Analyze an existing project's code quality</li>
          <li><code>/feature add user authentication</code> - Add a feature to your project</li>
        </ul>

        <h4>What You Get</h4>
        <ul>
          <li><strong>59 Pattern Modules</strong> - Database, auth, payments, testing, and more</li>
          <li><strong>MCP Integration</strong> - AI tools that understand your codebase</li>
          <li><strong>Two-Gate Enforcement</strong> - Patterns discovered and validated automatically</li>
          <li><strong>Project Continuity</strong> - AI remembers context across sessions</li>
        </ul>
      </>
    ),
  },
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    icon: LayoutDashboard,
    content: (
      <>
        <h3>Your Dashboard</h3>
        <p>
          The dashboard is your central hub for managing CodeBakers. Here's what each section does:
        </p>

        <h4>API Key</h4>
        <p>
          Your API key is displayed on the main dashboard. Use this key when running
          <code>npx @codebakers/cli setup</code> to authenticate your projects.
        </p>
        <ul>
          <li>Click the key to copy it to your clipboard</li>
          <li>Use the "Regenerate" button if you need a new key (invalidates the old one)</li>
          <li>Keys start with <code>cb_</code> prefix</li>
        </ul>

        <h4>Usage Statistics</h4>
        <p>See how you're using CodeBakers:</p>
        <ul>
          <li><strong>Pattern Downloads</strong> - How many times patterns were fetched</li>
          <li><strong>MCP Calls</strong> - Tool invocations from your AI assistant</li>
          <li><strong>Projects</strong> - Number of projects using CodeBakers</li>
        </ul>

        <h4>Quick Actions</h4>
        <ul>
          <li><strong>Setup New Project</strong> - Generate CLI setup command</li>
          <li><strong>View Patterns</strong> - Browse available pattern modules</li>
          <li><strong>Report Issue</strong> - Submit feedback on patterns</li>
        </ul>
      </>
    ),
  },
  {
    id: 'quickstart',
    title: 'Quickstart Guide',
    icon: Zap,
    content: (
      <>
        <h3>Quickstart Guide</h3>
        <p>
          The Quickstart page provides an interactive setup wizard for new projects.
        </p>

        <h4>Setup Steps</h4>
        <ol>
          <li>
            <strong>Choose Your IDE</strong>
            <ul>
              <li>Claude Code (VS Code extension or CLI)</li>
              <li>Cursor</li>
            </ul>
          </li>
          <li>
            <strong>Install CLI</strong>
            <pre><code>npx @codebakers/cli setup</code></pre>
          </li>
          <li>
            <strong>Configure MCP</strong>
            <p>Follow the IDE-specific instructions shown</p>
          </li>
          <li>
            <strong>Verify Installation</strong>
            <p>Run a test command to ensure everything works</p>
          </li>
        </ol>

        <h4>Troubleshooting</h4>
        <ul>
          <li><strong>API Key Issues</strong> - Regenerate key and run setup again</li>
          <li><strong>MCP Not Connecting</strong> - Check <code>/mcp list</code> output</li>
          <li><strong>Patterns Not Loading</strong> - Ensure CLAUDE.md exists in project root</li>
        </ul>
      </>
    ),
  },
  {
    id: 'projects',
    title: 'Projects',
    icon: FolderKanban,
    content: (
      <>
        <h3>Project Management</h3>
        <p>
          Track all your projects that use CodeBakers patterns.
        </p>

        <h4>Project List</h4>
        <p>View all projects with:</p>
        <ul>
          <li>Project name and path</li>
          <li>Last activity date</li>
          <li>Pattern modules used</li>
          <li>Enforcement session status</li>
        </ul>

        <h4>Project Details</h4>
        <p>Click a project to see:</p>
        <ul>
          <li><strong>Usage History</strong> - Pattern downloads and MCP calls</li>
          <li><strong>Module Breakdown</strong> - Which patterns are used most</li>
          <li><strong>Session Log</strong> - Recent AI coding sessions</li>
          <li><strong>Health Check</strong> - Pattern compliance status</li>
        </ul>

        <h4>Free Trial</h4>
        <p>
          Free trials are locked to a single project. To use CodeBakers in multiple projects,
          upgrade to a paid plan.
        </p>
      </>
    ),
  },
  {
    id: 'engineering',
    title: 'Engineering Sessions',
    icon: Cpu,
    content: (
      <>
        <h3>AI Engineering Sessions</h3>
        <p>
          Track your AI-driven development sessions with detailed progress and phase information.
        </p>

        <h4>What are Engineering Sessions?</h4>
        <p>
          When you use commands like <code>/build</code> or complex <code>/feature</code> requests,
          CodeBakers orchestrates an engineering session that guides the AI through structured phases.
        </p>

        <h4>Session Phases</h4>
        <ol>
          <li><strong>Discovery</strong> - Understanding requirements</li>
          <li><strong>Planning</strong> - Creating implementation plan</li>
          <li><strong>Setup</strong> - Project scaffolding</li>
          <li><strong>Implementation</strong> - Writing code with patterns</li>
          <li><strong>Testing</strong> - Adding and running tests</li>
          <li><strong>Review</strong> - Final quality checks</li>
        </ol>

        <h4>Session Controls</h4>
        <ul>
          <li><strong>Pause</strong> - Temporarily stop the session</li>
          <li><strong>Resume</strong> - Continue from where you left off</li>
          <li><strong>View Details</strong> - See step-by-step progress</li>
        </ul>
      </>
    ),
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: BarChart3,
    content: (
      <>
        <h3>Usage Analytics</h3>
        <p>
          Track your CodeBakers usage patterns and productivity metrics.
        </p>

        <h4>Key Metrics</h4>
        <ul>
          <li><strong>Total Sessions</strong> - AI coding sessions initiated</li>
          <li><strong>Patterns Used</strong> - Unique modules accessed</li>
          <li><strong>Lines Generated</strong> - Approximate code output</li>
          <li><strong>Time Saved</strong> - Estimated productivity gain</li>
        </ul>

        <h4>Usage Trends</h4>
        <p>Charts showing:</p>
        <ul>
          <li>Daily/weekly/monthly usage</li>
          <li>Most used pattern modules</li>
          <li>Command distribution (/build, /feature, /audit)</li>
          <li>Project activity over time</li>
        </ul>

        <h4>Module Breakdown</h4>
        <p>
          See which of the 59 pattern modules you use most frequently, helping you
          understand your development patterns.
        </p>
      </>
    ),
  },
  {
    id: 'team',
    title: 'Team Management',
    icon: Users,
    content: (
      <>
        <h3>Team Management</h3>
        <p>
          Manage your team members and their access to CodeBakers.
        </p>

        <h4>Team Members</h4>
        <ul>
          <li><strong>Owner</strong> - Full access, manages billing</li>
          <li><strong>Admin</strong> - Can manage members and settings</li>
          <li><strong>Member</strong> - Can use CodeBakers in projects</li>
        </ul>

        <h4>Inviting Members</h4>
        <ol>
          <li>Click "Invite Member"</li>
          <li>Enter their email address</li>
          <li>Choose their role</li>
          <li>They'll receive an email invitation</li>
        </ol>

        <h4>Seat Limits</h4>
        <p>Each plan has a maximum number of team seats:</p>
        <ul>
          <li><strong>Pro</strong> - 1 seat (individual)</li>
          <li><strong>Team</strong> - Up to 10 seats</li>
          <li><strong>Agency</strong> - Up to 25 seats</li>
          <li><strong>Enterprise</strong> - Unlimited seats</li>
        </ul>

        <h4>Removing Members</h4>
        <p>
          Click the remove button next to a member. Their access is revoked immediately,
          but their usage history is preserved for audit purposes.
        </p>
      </>
    ),
  },
  {
    id: 'billing',
    title: 'Billing & Subscriptions',
    icon: CreditCard,
    content: (
      <>
        <h3>Billing & Subscriptions</h3>
        <p>
          Manage your subscription, update payment methods, and view invoices.
        </p>

        <h4>Subscription Plans</h4>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="py-2">Plan</th>
              <th className="py-2">Price</th>
              <th className="py-2">Seats</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Pro</td><td>$29/mo</td><td>1</td></tr>
            <tr><td>Team</td><td>$99/mo</td><td>Up to 10</td></tr>
            <tr><td>Agency</td><td>$249/mo</td><td>Up to 25</td></tr>
            <tr><td>Enterprise</td><td>Custom</td><td>Unlimited</td></tr>
          </tbody>
        </table>

        <h4>Managing Your Subscription</h4>
        <ul>
          <li><strong>Upgrade</strong> - Switch to a higher plan instantly</li>
          <li><strong>Downgrade</strong> - Takes effect at billing cycle end</li>
          <li><strong>Cancel</strong> - Access continues until period ends</li>
        </ul>

        <h4>Payment Methods</h4>
        <p>We accept:</p>
        <ul>
          <li>Credit/debit cards (via Stripe)</li>
          <li>PayPal</li>
          <li>Square (for enterprise)</li>
        </ul>

        <h4>Invoices</h4>
        <p>
          View and download all past invoices from the billing page.
          Invoices are automatically emailed after each payment.
        </p>
      </>
    ),
  },
  {
    id: 'api-keys',
    title: 'API Keys & Service Keys',
    icon: Key,
    content: (
      <>
        <h3>API Keys & Service Keys</h3>
        <p>
          Manage authentication keys for CodeBakers integration.
        </p>

        <h4>API Key (Primary)</h4>
        <p>
          Your main API key is shown on the dashboard. This key is used by the CLI
          to authenticate pattern downloads.
        </p>
        <ul>
          <li>One active key per team</li>
          <li>Can be regenerated (invalidates old key)</li>
          <li>Required for <code>npx @codebakers/cli setup</code></li>
        </ul>

        <h4>Service Keys (Optional)</h4>
        <p>
          Service keys are for programmatic access to the CodeBakers API.
          Use these for CI/CD integrations or custom tooling.
        </p>

        <h4>Creating Service Keys</h4>
        <ol>
          <li>Go to Settings → Service Keys</li>
          <li>Click "Create New Key"</li>
          <li>Name the key (e.g., "GitHub Actions")</li>
          <li>Set permissions (read-only or full access)</li>
          <li>Copy the key immediately (shown only once)</li>
        </ol>

        <h4>Best Practices</h4>
        <ul>
          <li>Never commit keys to version control</li>
          <li>Use environment variables for keys</li>
          <li>Rotate keys periodically</li>
          <li>Delete unused keys promptly</li>
        </ul>
      </>
    ),
  },
  {
    id: 'settings',
    title: 'Account Settings',
    icon: Settings,
    content: (
      <>
        <h3>Account Settings</h3>
        <p>
          Configure your account and personal preferences.
        </p>

        <h4>Profile Settings</h4>
        <ul>
          <li><strong>Name</strong> - Your display name</li>
          <li><strong>Email</strong> - Account email (requires verification to change)</li>
          <li><strong>Avatar</strong> - Profile picture</li>
        </ul>

        <h4>Security</h4>
        <ul>
          <li><strong>Password</strong> - Change your password</li>
          <li><strong>Two-Factor Auth</strong> - Enable 2FA for extra security</li>
          <li><strong>Sessions</strong> - View and revoke active sessions</li>
        </ul>

        <h4>Notifications</h4>
        <p>Control email notifications for:</p>
        <ul>
          <li>Usage alerts</li>
          <li>Product updates</li>
          <li>Billing reminders</li>
          <li>Team activity</li>
        </ul>

        <h4>Danger Zone</h4>
        <ul>
          <li><strong>Export Data</strong> - Download all your data</li>
          <li><strong>Delete Account</strong> - Permanently delete your account</li>
        </ul>
      </>
    ),
  },
  {
    id: 'commands',
    title: 'CLI Commands Reference',
    icon: Terminal,
    content: (
      <>
        <h3>CLI Commands Reference</h3>
        <p>
          Complete reference for all CodeBakers commands.
        </p>

        <h4>Project Commands (AI Tool)</h4>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="py-2">Command</th>
              <th className="py-2">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>/build</code></td><td>Create a new project from scratch</td></tr>
            <tr><td><code>/feature</code></td><td>Add feature to existing project</td></tr>
            <tr><td><code>/audit</code></td><td>Analyze code quality</td></tr>
            <tr><td><code>/design</code></td><td>Clone UI from mockups/URLs</td></tr>
            <tr><td><code>/status</code></td><td>View project progress</td></tr>
          </tbody>
        </table>

        <h4>CLI Commands (Terminal)</h4>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="py-2">Command</th>
              <th className="py-2">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>codebakers setup</code></td><td>Configure project with API key</td></tr>
            <tr><td><code>codebakers upgrade</code></td><td>Update patterns to latest version</td></tr>
            <tr><td><code>codebakers doctor</code></td><td>Diagnose installation issues</td></tr>
            <tr><td><code>codebakers serve</code></td><td>Start MCP server</td></tr>
          </tbody>
        </table>

        <h4>MCP Tools</h4>
        <p>Tools available when MCP server is running:</p>
        <ul>
          <li><code>discover_patterns</code> - Find patterns before coding</li>
          <li><code>validate_complete</code> - Verify patterns used and tests pass</li>
          <li><code>run_audit</code> - Run code quality audit</li>
          <li><code>heal</code> - AI-powered error fixing</li>
          <li><code>project_status</code> - Show current project state</li>
        </ul>
      </>
    ),
  },
  {
    id: 'patterns',
    title: 'Pattern Modules',
    icon: FileCode,
    content: (
      <>
        <h3>Pattern Modules</h3>
        <p>
          CodeBakers includes 59 production-ready pattern modules organized by category.
        </p>

        <h4>Core Modules (00-14)</h4>
        <ul>
          <li><strong>00-core</strong> - Standards, types, error handling</li>
          <li><strong>01-database</strong> - Drizzle ORM, queries, migrations</li>
          <li><strong>02-auth</strong> - Authentication, OAuth, 2FA</li>
          <li><strong>03-api</strong> - API routes, validation, rate limiting</li>
          <li><strong>04-frontend</strong> - React, forms, state management</li>
          <li><strong>05-payments</strong> - Stripe, subscriptions, billing</li>
        </ul>

        <h4>Integration Modules (06)</h4>
        <ul>
          <li><strong>06a-voice</strong> - VAPI voice AI</li>
          <li><strong>06b-email</strong> - Resend, Nylas email</li>
          <li><strong>06c-communications</strong> - Twilio, SMS</li>
          <li><strong>06d-background-jobs</strong> - Inngest, cron</li>
          <li><strong>06e-documents</strong> - PDF, Excel generation</li>
        </ul>

        <h4>Advanced Modules (07-14)</h4>
        <ul>
          <li><strong>07-performance</strong> - Caching, optimization</li>
          <li><strong>08-testing</strong> - Playwright, Vitest</li>
          <li><strong>09-design</strong> - UI components, dashboards</li>
          <li><strong>10-generators</strong> - Scaffolding, templates</li>
          <li><strong>11-realtime</strong> - WebSockets, live updates</li>
          <li><strong>12-saas</strong> - Multi-tenant, feature flags</li>
          <li><strong>13-mobile</strong> - React Native, Expo</li>
          <li><strong>14-ai</strong> - OpenAI, Anthropic, RAG</li>
        </ul>

        <h4>Expert Modules (21-25)</h4>
        <ul>
          <li><strong>21-experts-core</strong> - Backend/frontend experts</li>
          <li><strong>22-experts-health</strong> - HIPAA compliance</li>
          <li><strong>23-experts-finance</strong> - PCI, banking</li>
          <li><strong>24-experts-legal</strong> - GDPR, contracts</li>
          <li><strong>25-experts-industry</strong> - E-commerce, education</li>
        </ul>
      </>
    ),
  },
  {
    id: 'support',
    title: 'Support & Feedback',
    icon: MessageSquare,
    content: (
      <>
        <h3>Support & Feedback</h3>
        <p>
          Get help and share feedback about CodeBakers.
        </p>

        <h4>Getting Help</h4>
        <ul>
          <li>
            <strong>Documentation</strong> - You're reading it!
          </li>
          <li>
            <strong>Discord</strong> - Join our community for real-time help
          </li>
          <li>
            <strong>Email</strong> - support@codebakers.dev
          </li>
          <li>
            <strong>GitHub Issues</strong> - For bug reports and feature requests
          </li>
        </ul>

        <h4>Reporting Issues</h4>
        <p>If you find a bug or outdated pattern:</p>
        <ol>
          <li>Go to Dashboard → Submit Report</li>
          <li>Select the affected module</li>
          <li>Describe the issue with examples</li>
          <li>Submit - our team will investigate</li>
        </ol>

        <h4>Feature Requests</h4>
        <p>
          Have an idea for a new pattern or feature? Submit it through:
        </p>
        <ul>
          <li>Dashboard → Pattern Submission</li>
          <li>GitHub Discussions</li>
          <li>Discord #feature-requests channel</li>
        </ul>

        <h4>Enterprise Support</h4>
        <p>
          Enterprise customers get priority support including:
        </p>
        <ul>
          <li>Dedicated Slack channel</li>
          <li>SLA-backed response times</li>
          <li>Custom pattern development</li>
          <li>Onboarding assistance</li>
        </ul>
      </>
    ),
  },
];

export default function UserDocsPage() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['getting-started']));
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSections(new Set(docSections.map((s) => s.id)));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  const filteredSections = docSections.filter((section) =>
    searchQuery === '' ||
    section.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-amber-400" />
          Help Center
        </h1>
        <p className="text-neutral-400 mt-1">
          Everything you need to know about using CodeBakers
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/docs/getting-started" className="block">
          <Card className="bg-neutral-800/50 border-neutral-700 hover:bg-neutral-700/50 transition-colors">
            <CardContent className="pt-4 pb-4 text-center">
              <Rocket className="h-6 w-6 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-white font-medium">Setup Guide</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/docs/commands/build" className="block">
          <Card className="bg-neutral-800/50 border-neutral-700 hover:bg-neutral-700/50 transition-colors">
            <CardContent className="pt-4 pb-4 text-center">
              <Terminal className="h-6 w-6 text-blue-400 mx-auto mb-2" />
              <p className="text-sm text-white font-medium">Commands</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/quickstart" className="block">
          <Card className="bg-neutral-800/50 border-neutral-700 hover:bg-neutral-700/50 transition-colors">
            <CardContent className="pt-4 pb-4 text-center">
              <Zap className="h-6 w-6 text-amber-400 mx-auto mb-2" />
              <p className="text-sm text-white font-medium">Quickstart</p>
            </CardContent>
          </Card>
        </Link>
        <a
          href="https://github.com/codebakers/codebakers-cli"
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Card className="bg-neutral-800/50 border-neutral-700 hover:bg-neutral-700/50 transition-colors">
            <CardContent className="pt-4 pb-4 text-center">
              <ExternalLink className="h-6 w-6 text-purple-400 mx-auto mb-2" />
              <p className="text-sm text-white font-medium">GitHub</p>
            </CardContent>
          </Card>
        </a>
      </div>

      {/* Search and Controls */}
      <Card className="bg-neutral-800/50 border-neutral-700">
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-neutral-900/50 border-neutral-700 text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Collapse All
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table of Contents */}
      <Card className="bg-neutral-800/50 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Quick Navigation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {docSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => {
                    setExpandedSections((prev) => new Set(prev).add(section.id));
                    document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-300 hover:text-white hover:bg-neutral-700/50 transition-colors text-left"
                >
                  <Icon className="h-4 w-4 text-amber-400 flex-shrink-0" />
                  <span className="truncate">{section.title}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Documentation Sections */}
      <div className="space-y-4">
        {filteredSections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSections.has(section.id);

          return (
            <Card key={section.id} id={section.id} className="bg-neutral-800/50 border-neutral-700">
              <CardHeader
                className="cursor-pointer hover:bg-neutral-700/30 transition-colors"
                onClick={() => toggleSection(section.id)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-3">
                    <Icon className="h-5 w-5 text-amber-400" />
                    {section.title}
                  </CardTitle>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-neutral-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-neutral-400" />
                  )}
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="prose prose-invert prose-sm max-w-none border-t border-neutral-700/50 pt-4">
                  <div className="text-neutral-300 space-y-4 [&>h3]:text-xl [&>h3]:font-bold [&>h3]:text-white [&>h3]:mt-0 [&>h4]:text-lg [&>h4]:font-semibold [&>h4]:text-white [&>h4]:mt-6 [&>h5]:font-semibold [&>h5]:text-neutral-200 [&>h5]:mt-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:space-y-1 [&>p]:text-neutral-300 [&_strong]:text-white [&_code]:bg-neutral-900 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-amber-400 [&_pre]:bg-neutral-900 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_th]:py-2 [&_th]:text-left [&_th]:text-neutral-400 [&_td]:py-1.5 [&_td]:text-neutral-300">
                    {section.content}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {filteredSections.length === 0 && (
        <Card className="bg-neutral-800/50 border-neutral-700">
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 text-neutral-500 mx-auto mb-4" />
            <p className="text-neutral-400">No documentation found matching "{searchQuery}"</p>
          </CardContent>
        </Card>
      )}

      {/* Help Box */}
      <Card className="bg-amber-900/20 border-amber-700/50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-4">
            <Shield className="h-8 w-8 text-amber-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-white">Need More Help?</h3>
              <p className="text-neutral-300 text-sm mt-1">
                Can't find what you're looking for? Join our{' '}
                <a href="#" className="text-amber-400 hover:underline">Discord community</a>{' '}
                or email us at{' '}
                <a href="mailto:support@codebakers.dev" className="text-amber-400 hover:underline">
                  support@codebakers.dev
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
