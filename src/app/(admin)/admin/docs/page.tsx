'use client';

import { useState } from 'react';
import {
  BookOpen,
  LayoutDashboard,
  TrendingUp,
  CreditCard,
  Receipt,
  Users,
  Building2,
  Cpu,
  FileText,
  Terminal,
  Sparkles,
  FileUp,
  FileWarning,
  Settings,
  ChevronDown,
  ChevronRight,
  Shield,
  Search,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface DocSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

const docSections: DocSection[] = [
  {
    id: 'overview',
    title: 'Admin Panel Overview',
    icon: LayoutDashboard,
    content: (
      <>
        <h3>Welcome to the Admin Panel</h3>
        <p>
          The Admin Panel provides comprehensive management tools for the CodeBakers platform.
          As an administrator, you have access to:
        </p>
        <ul>
          <li><strong>E-Commerce Management</strong> - Track revenue, manage subscriptions, and view payment history</li>
          <li><strong>User & Team Management</strong> - Manage users, view enterprise leads, and control access</li>
          <li><strong>Platform Management</strong> - Content versioning, CLI releases, pattern submissions</li>
          <li><strong>System Configuration</strong> - Feature flags, system settings, and audit logs</li>
        </ul>

        <h4>Getting Started</h4>
        <p>
          Navigate using the sidebar on the left. Each section is organized by function:
        </p>
        <ol>
          <li><strong>Dashboard</strong> - Overview of key metrics and quick actions</li>
          <li><strong>E-Commerce</strong> - Revenue, subscriptions, and payments</li>
          <li><strong>Users & Teams</strong> - User management and enterprise leads</li>
          <li><strong>Platform</strong> - Content, CLI versions, and pattern management</li>
          <li><strong>System</strong> - Settings and configuration</li>
        </ol>
      </>
    ),
  },
  {
    id: 'revenue',
    title: 'Revenue Dashboard',
    icon: TrendingUp,
    content: (
      <>
        <h3>Revenue Dashboard</h3>
        <p>
          The Revenue Dashboard provides real-time insights into your platform's financial performance.
        </p>

        <h4>Key Metrics</h4>
        <ul>
          <li><strong>MRR (Monthly Recurring Revenue)</strong> - Total monthly revenue from active subscriptions</li>
          <li><strong>ARR (Annual Recurring Revenue)</strong> - Projected yearly revenue (MRR × 12)</li>
          <li><strong>Active Subscribers</strong> - Number of currently paying customers</li>
          <li><strong>ARPU (Average Revenue Per User)</strong> - Average monthly revenue per subscriber</li>
        </ul>

        <h4>30-Day Performance</h4>
        <p>Track recent trends:</p>
        <ul>
          <li><strong>New Subscriptions</strong> - New customers acquired in the last 30 days</li>
          <li><strong>Cancellations</strong> - Customers who cancelled</li>
          <li><strong>Payments</strong> - Successful payment events</li>
          <li><strong>Churn Rate</strong> - Percentage of customers lost (cancellations / total)</li>
          <li><strong>Growth Rate</strong> - Net subscriber growth percentage</li>
        </ul>

        <h4>Plan Breakdown</h4>
        <p>
          Visual breakdown of revenue by subscription plan (Pro, Team, Agency, Enterprise).
          Use this to understand which plans drive the most revenue.
        </p>

        <h4>Provider Breakdown</h4>
        <p>
          Shows distribution of subscribers across payment providers (Stripe, PayPal, Square).
          Useful for understanding payment preferences.
        </p>
      </>
    ),
  },
  {
    id: 'subscriptions',
    title: 'Subscriptions Management',
    icon: CreditCard,
    content: (
      <>
        <h3>Subscriptions Management</h3>
        <p>
          View and manage all team subscriptions across the platform.
        </p>

        <h4>Filtering Options</h4>
        <ul>
          <li><strong>Status Filter</strong> - Filter by active, cancelled, past_due, or inactive</li>
          <li><strong>Plan Filter</strong> - Filter by subscription tier (Pro, Team, Agency, Enterprise)</li>
          <li><strong>Provider Filter</strong> - Filter by payment provider (Stripe, PayPal, Square)</li>
          <li><strong>Search</strong> - Search by team name or slug</li>
        </ul>

        <h4>Subscription Details</h4>
        <p>Each subscription row shows:</p>
        <ul>
          <li><strong>Team</strong> - Team name and slug</li>
          <li><strong>Owner</strong> - Team owner's name and email</li>
          <li><strong>Plan</strong> - Current subscription plan</li>
          <li><strong>Status</strong> - Current status (color-coded)</li>
          <li><strong>Provider</strong> - Payment provider used</li>
          <li><strong>Created</strong> - When the subscription was created</li>
        </ul>

        <h4>Actions</h4>
        <p>
          Click "View" to open the subscription directly in the payment provider's dashboard
          (Stripe Dashboard or PayPal) for detailed management.
        </p>
      </>
    ),
  },
  {
    id: 'payments',
    title: 'Payment History',
    icon: Receipt,
    content: (
      <>
        <h3>Payment History</h3>
        <p>
          Complete log of all payment and subscription events across the platform.
        </p>

        <h4>30-Day Summary</h4>
        <ul>
          <li><strong>Total Events</strong> - Number of payment events in last 30 days</li>
          <li><strong>Revenue</strong> - Total successful payments</li>
          <li><strong>Refunds</strong> - Total refunded amount</li>
          <li><strong>Net Revenue</strong> - Revenue minus refunds</li>
        </ul>

        <h4>Event Types</h4>
        <p>The system tracks 14 different event types:</p>
        <ul>
          <li><strong>Subscription Events</strong> - created, activated, updated, cancelled, expired, suspended</li>
          <li><strong>Payment Events</strong> - completed, failed, refunded</li>
          <li><strong>Invoice Events</strong> - created, paid</li>
          <li><strong>Trial Events</strong> - started, converted, expired</li>
        </ul>

        <h4>Filtering</h4>
        <ul>
          <li><strong>Event Type</strong> - Filter by specific event type</li>
          <li><strong>Provider</strong> - Filter by payment provider</li>
          <li><strong>Date Range</strong> - Filter by from/to dates</li>
          <li><strong>Search</strong> - Search by team name or email</li>
        </ul>
      </>
    ),
  },
  {
    id: 'users',
    title: 'User Management',
    icon: Users,
    content: (
      <>
        <h3>User Management</h3>
        <p>
          Manage all registered users on the platform.
        </p>

        <h4>User List</h4>
        <p>View all users with their:</p>
        <ul>
          <li>Email and name</li>
          <li>Registration date</li>
          <li>Subscription status</li>
          <li>Admin status</li>
          <li>Account status (active/suspended)</li>
        </ul>

        <h4>User Actions</h4>
        <ul>
          <li><strong>View Details</strong> - See complete user profile and history</li>
          <li><strong>Grant Admin</strong> - Elevate user to admin role</li>
          <li><strong>Revoke Admin</strong> - Remove admin privileges</li>
          <li><strong>Suspend</strong> - Temporarily disable account</li>
          <li><strong>Unsuspend</strong> - Re-enable suspended account</li>
          <li><strong>Grant Beta Access</strong> - Give user free access to all features</li>
        </ul>

        <h4>Filtering & Search</h4>
        <ul>
          <li>Search by email or name</li>
          <li>Filter by subscription status</li>
          <li>Filter by admin status</li>
          <li>Filter by account status</li>
        </ul>
      </>
    ),
  },
  {
    id: 'enterprise',
    title: 'Enterprise Leads',
    icon: Building2,
    content: (
      <>
        <h3>Enterprise Leads</h3>
        <p>
          Manage enterprise qualification requests from users interested in enterprise-tier features.
        </p>

        <h4>Lead Qualification Process</h4>
        <ol>
          <li>User submits enterprise interest form with team size, use case, etc.</li>
          <li>Lead appears in the pending queue</li>
          <li>Admin reviews and qualifies/disqualifies</li>
          <li>Qualified leads can be contacted for sales outreach</li>
        </ol>

        <h4>Lead Information</h4>
        <ul>
          <li><strong>Company</strong> - Company name and website</li>
          <li><strong>Contact</strong> - Contact person and email</li>
          <li><strong>Team Size</strong> - Expected number of users</li>
          <li><strong>Use Case</strong> - How they plan to use CodeBakers</li>
          <li><strong>Budget</strong> - Expected budget range</li>
          <li><strong>Timeline</strong> - Expected decision timeline</li>
        </ul>

        <h4>Lead Actions</h4>
        <ul>
          <li><strong>Qualify</strong> - Mark as qualified sales opportunity</li>
          <li><strong>Disqualify</strong> - Mark as not qualified (with reason)</li>
          <li><strong>Add Notes</strong> - Record sales notes and follow-ups</li>
          <li><strong>Convert</strong> - Convert to enterprise customer</li>
        </ul>
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
          Monitor AI-driven project development sessions orchestrated by the platform.
        </p>

        <h4>Session States</h4>
        <ul>
          <li><strong>Active</strong> - Currently running sessions</li>
          <li><strong>Paused</strong> - Sessions temporarily paused by user</li>
          <li><strong>Completed</strong> - Successfully finished sessions</li>
          <li><strong>Abandoned</strong> - Sessions that were stopped without completion</li>
        </ul>

        <h4>Session Details</h4>
        <ul>
          <li>Project name and type</li>
          <li>Current phase and progress</li>
          <li>Agent usage statistics</li>
          <li>Time spent in each phase</li>
          <li>Completion percentage</li>
        </ul>

        <h4>Metrics</h4>
        <ul>
          <li><strong>Sessions Today/Week</strong> - Recent activity</li>
          <li><strong>Average Completion Time</strong> - How long sessions take</li>
          <li><strong>Phase Distribution</strong> - Which phases take longest</li>
          <li><strong>Agent Usage</strong> - Which AI agents are used most</li>
        </ul>
      </>
    ),
  },
  {
    id: 'content',
    title: 'Content Versions',
    icon: FileText,
    content: (
      <>
        <h3>Content Version Management</h3>
        <p>
          Manage the pattern content distributed to users through the CLI.
        </p>

        <h4>Content Structure</h4>
        <ul>
          <li><strong>CLAUDE.md</strong> - Main router file with commands and instructions</li>
          <li><strong>.cursorrules</strong> - Cursor IDE rules file</li>
          <li><strong>.claude/ modules</strong> - 59 pattern module files</li>
          <li><strong>.cursorrules-modules/</strong> - Cursor-specific modules</li>
        </ul>

        <h4>Version Management</h4>
        <ol>
          <li><strong>Create Draft</strong> - Upload new content as a draft version</li>
          <li><strong>Preview</strong> - Review content before publishing</li>
          <li><strong>Publish</strong> - Make version active for all users</li>
          <li><strong>Rollback</strong> - Revert to a previous version if needed</li>
        </ol>

        <h4>Version Info</h4>
        <ul>
          <li>Version number (e.g., "5.9")</li>
          <li>Changelog description</li>
          <li>Published by (admin email)</li>
          <li>Published date</li>
          <li>Active/draft status</li>
          <li>Content statistics (lines, modules, etc.)</li>
        </ul>
      </>
    ),
  },
  {
    id: 'cli-versions',
    title: 'CLI Versions',
    icon: Terminal,
    content: (
      <>
        <h3>CLI Version Management</h3>
        <p>
          Track and manage releases of the @codebakers/cli npm package.
        </p>

        <h4>Version Information</h4>
        <ul>
          <li><strong>Version Number</strong> - Semantic version (e.g., 2.1.0)</li>
          <li><strong>Release Date</strong> - When the version was published</li>
          <li><strong>Changelog</strong> - What changed in this release</li>
          <li><strong>Min/Max Compatible</strong> - Content version compatibility range</li>
        </ul>

        <h4>Release Process</h4>
        <ol>
          <li>Develop and test CLI changes</li>
          <li>Update version in package.json</li>
          <li>Publish to npm</li>
          <li>Record release in admin panel with changelog</li>
        </ol>

        <h4>Compatibility</h4>
        <p>
          Each CLI version has a compatible content version range. The CLI will warn users
          if their content is outdated or incompatible.
        </p>
      </>
    ),
  },
  {
    id: 'module-builder',
    title: 'AI Module Builder',
    icon: Sparkles,
    content: (
      <>
        <h3>AI Module Builder</h3>
        <p>
          Use AI to help create and update pattern modules through a conversational interface.
        </p>

        <h4>How It Works</h4>
        <ol>
          <li>Describe what you want to add or change</li>
          <li>AI analyzes current patterns and suggests changes</li>
          <li>Review proposed changes in preview</li>
          <li>Apply changes to create a new content version</li>
        </ol>

        <h4>Capabilities</h4>
        <ul>
          <li><strong>Create New Modules</strong> - Generate new pattern modules from descriptions</li>
          <li><strong>Update Existing</strong> - Modify current modules with new patterns</li>
          <li><strong>Merge Patterns</strong> - Combine patterns from multiple sources</li>
          <li><strong>Format Check</strong> - Ensure modules follow correct format</li>
        </ul>

        <h4>Best Practices</h4>
        <ul>
          <li>Be specific about what patterns you want to add</li>
          <li>Reference existing module numbers when updating</li>
          <li>Always preview changes before applying</li>
          <li>Include code examples in your descriptions</li>
        </ul>
      </>
    ),
  },
  {
    id: 'submissions',
    title: 'Pattern Submissions',
    icon: FileUp,
    content: (
      <>
        <h3>Pattern Submissions</h3>
        <p>
          Review and approve community-submitted patterns from users.
        </p>

        <h4>Submission Process</h4>
        <ol>
          <li>User submits pattern through dashboard</li>
          <li>Submission enters pending queue</li>
          <li>Admin reviews for quality and relevance</li>
          <li>Approve, request changes, or reject</li>
          <li>Approved patterns can be merged into content</li>
        </ol>

        <h4>Review Criteria</h4>
        <ul>
          <li><strong>Code Quality</strong> - Is the pattern well-written and tested?</li>
          <li><strong>Usefulness</strong> - Does it solve a common problem?</li>
          <li><strong>Uniqueness</strong> - Does it overlap with existing patterns?</li>
          <li><strong>Documentation</strong> - Is it well-documented?</li>
          <li><strong>Security</strong> - Are there any security concerns?</li>
        </ul>

        <h4>Submission States</h4>
        <ul>
          <li><strong>Pending</strong> - Awaiting review</li>
          <li><strong>In Review</strong> - Being evaluated</li>
          <li><strong>Changes Requested</strong> - Needs modifications</li>
          <li><strong>Approved</strong> - Ready for merge</li>
          <li><strong>Rejected</strong> - Not accepted (with reason)</li>
        </ul>
      </>
    ),
  },
  {
    id: 'reports',
    title: 'Module Reports',
    icon: FileWarning,
    content: (
      <>
        <h3>Module Reports</h3>
        <p>
          Handle user reports about outdated or incorrect patterns.
        </p>

        <h4>Report Types</h4>
        <ul>
          <li><strong>Outdated</strong> - Pattern uses deprecated libraries or syntax</li>
          <li><strong>Incorrect</strong> - Pattern has bugs or doesn't work</li>
          <li><strong>Incomplete</strong> - Pattern is missing important cases</li>
          <li><strong>Security</strong> - Pattern has security vulnerabilities</li>
        </ul>

        <h4>Report Workflow</h4>
        <ol>
          <li>User submits report with module name and issue description</li>
          <li>Report appears in pending queue</li>
          <li>Admin investigates and either fixes or marks as invalid</li>
          <li>User is notified of resolution</li>
        </ol>

        <h4>Resolution Options</h4>
        <ul>
          <li><strong>Fix Applied</strong> - Issue was fixed in a new content version</li>
          <li><strong>Won't Fix</strong> - Issue is by design or not applicable</li>
          <li><strong>Duplicate</strong> - Already reported and being addressed</li>
          <li><strong>Invalid</strong> - Report was incorrect or misunderstanding</li>
        </ul>
      </>
    ),
  },
  {
    id: 'settings',
    title: 'System Settings',
    icon: Settings,
    content: (
      <>
        <h3>System Settings</h3>
        <p>
          Configure platform-wide settings and view audit logs.
        </p>

        <h4>Settings Categories</h4>

        <h5>General Settings</h5>
        <ul>
          <li><strong>Site Name</strong> - Platform name displayed to users</li>
          <li><strong>Maintenance Mode</strong> - Enable to show maintenance page</li>
          <li><strong>Registration Enabled</strong> - Allow new user signups</li>
        </ul>

        <h5>Limits Settings</h5>
        <ul>
          <li><strong>Trial Days</strong> - Free trial duration</li>
          <li><strong>Max Team Size</strong> - Per plan team member limits</li>
          <li><strong>API Rate Limit</strong> - Requests per minute allowed</li>
        </ul>

        <h5>Feature Flags</h5>
        <ul>
          <li><strong>AI Module Builder</strong> - Enable/disable AI builder</li>
          <li><strong>Pattern Submissions</strong> - Allow community submissions</li>
          <li><strong>Enterprise Leads</strong> - Enable enterprise form</li>
        </ul>

        <h5>Email Settings</h5>
        <ul>
          <li><strong>From Name/Address</strong> - Email sender details</li>
          <li><strong>Welcome Email</strong> - Send welcome to new users</li>
          <li><strong>Payment Notifications</strong> - Send payment emails</li>
        </ul>

        <h4>Audit Logs</h4>
        <p>
          The Audit Logs tab shows a complete history of all admin actions:
        </p>
        <ul>
          <li>Setting changes with before/after values</li>
          <li>User modifications</li>
          <li>Content publishes</li>
          <li>Who performed each action and when</li>
        </ul>
      </>
    ),
  },
];

export default function AdminDocsPage() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-blue-400" />
          Admin Documentation
        </h1>
        <p className="text-slate-400 mt-1">
          Complete guide to managing the CodeBakers admin panel
        </p>
      </div>

      {/* Search and Controls */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-900/50 border-slate-700 text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Collapse All
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table of Contents */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Quick Navigation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {docSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => {
                    setExpandedSections((prev) => new Set(prev).add(section.id));
                    document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors text-left"
                >
                  <Icon className="h-4 w-4 text-blue-400 flex-shrink-0" />
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
            <Card key={section.id} id={section.id} className="bg-slate-800/50 border-slate-700">
              <CardHeader
                className="cursor-pointer hover:bg-slate-700/30 transition-colors"
                onClick={() => toggleSection(section.id)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-3">
                    <Icon className="h-5 w-5 text-blue-400" />
                    {section.title}
                  </CardTitle>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  )}
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="prose prose-invert prose-sm max-w-none border-t border-slate-700/50 pt-4">
                  <div className="text-slate-300 space-y-4 [&>h3]:text-xl [&>h3]:font-bold [&>h3]:text-white [&>h3]:mt-0 [&>h4]:text-lg [&>h4]:font-semibold [&>h4]:text-white [&>h4]:mt-6 [&>h5]:font-semibold [&>h5]:text-slate-200 [&>h5]:mt-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:space-y-1 [&>p]:text-slate-300 [&_strong]:text-white">
                    {section.content}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {filteredSections.length === 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400">No documentation found matching "{searchQuery}"</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
