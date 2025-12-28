import Link from 'next/link';

export const metadata = {
  title: 'Pattern Modules - CodeBakers Documentation',
  description: 'Reference for all 47 CodeBakers pattern modules.',
};

interface Module {
  id: string;
  name: string;
  lines: number;
  description: string;
  keywords: string[];
  required?: boolean;
  edgeCase?: boolean;
  splitFrom?: string;
}

const modules: Module[] = [
  {
    id: '00-core',
    name: 'Core Standards',
    lines: 2130,
    description: 'TypeScript standards, error handling, logging patterns. Always loaded.',
    keywords: ['typescript', 'errors', 'logging', 'standards'],
    required: true,
  },
  {
    id: '01-database',
    name: 'Database',
    lines: 650,
    description: 'Drizzle ORM patterns, migrations, queries, soft deletes, audit logs.',
    keywords: ['drizzle', 'sql', 'query', 'migration', 'schema'],
  },
  {
    id: '01a-database-edge-cases',
    name: 'Database Edge Cases',
    lines: 400,
    description: 'Transactions, deadlocks, soft-delete recovery, connection pooling, migrations.',
    keywords: ['transaction', 'deadlock', 'soft-delete', 'pool', 'migration'],
    edgeCase: true,
  },
  {
    id: '02-auth',
    name: 'Authentication',
    lines: 1240,
    description: 'Auth flows, OAuth, 2FA, sessions, permissions, security middleware.',
    keywords: ['login', 'signup', 'oauth', '2fa', 'session', 'permission'],
  },
  {
    id: '02a-auth-edge-cases',
    name: 'Auth Edge Cases',
    lines: 500,
    description: 'Account lockout, password reset flows, session management, device limits.',
    keywords: ['lockout', 'password-reset', 'session', 'device', 'security'],
    edgeCase: true,
  },
  {
    id: '03-api',
    name: 'API Development',
    lines: 1640,
    description: 'REST endpoints, validation, rate limiting, versioning, OpenAPI docs.',
    keywords: ['api', 'endpoint', 'route', 'rest', 'rate limit'],
  },
  {
    id: '03a-api-edge-cases',
    name: 'API Edge Cases',
    lines: 550,
    description: 'Rate limiting, timeouts, retries, file uploads, idempotency keys.',
    keywords: ['rate-limit', 'timeout', 'retry', 'upload', 'idempotency'],
    edgeCase: true,
  },
  {
    id: '04-frontend',
    name: 'Frontend',
    lines: 1770,
    description: 'React patterns, forms, loading states, error boundaries, i18n.',
    keywords: ['react', 'form', 'component', 'loading', 'state'],
  },
  {
    id: '05-payments',
    name: 'Payments',
    lines: 1570,
    description: 'Stripe integration, subscriptions, checkout, webhooks, billing portal.',
    keywords: ['stripe', 'payment', 'subscription', 'billing', 'checkout'],
  },
  {
    id: '05a-payments-edge-cases',
    name: 'Payments Edge Cases',
    lines: 600,
    description: 'Refunds, disputes, chargebacks, dunning, failed payment recovery.',
    keywords: ['refund', 'dispute', 'chargeback', 'dunning', 'failed-payment'],
    edgeCase: true,
  },
  {
    id: '06a-voice',
    name: 'Voice AI',
    lines: 450,
    description: 'VAPI integration, voice calls, phone handling, voice webhooks.',
    keywords: ['vapi', 'voice', 'call', 'phone', 'audio'],
    splitFrom: '06-integrations',
  },
  {
    id: '06b-email',
    name: 'Email',
    lines: 600,
    description: 'Nylas, Resend, SMTP, React Email templates, transactional email.',
    keywords: ['resend', 'nylas', 'smtp', 'template', 'email'],
    splitFrom: '06-integrations',
  },
  {
    id: '06c-communications',
    name: 'Communications',
    lines: 400,
    description: 'Twilio SMS, GoHighLevel CRM, messaging patterns.',
    keywords: ['twilio', 'sms', 'gohighlevel', 'crm', 'messaging'],
    splitFrom: '06-integrations',
  },
  {
    id: '06d-background-jobs',
    name: 'Background Jobs',
    lines: 500,
    description: 'Inngest, scheduled tasks, cron jobs, queue processing.',
    keywords: ['inngest', 'cron', 'queue', 'scheduled', 'background'],
    splitFrom: '06-integrations',
  },
  {
    id: '06e-documents',
    name: 'Documents',
    lines: 450,
    description: 'PDF, Excel, Word generation, document processing.',
    keywords: ['pdf', 'excel', 'word', 'docx', 'document'],
    splitFrom: '06-integrations',
  },
  {
    id: '06f-api-patterns',
    name: 'API Integration Patterns',
    lines: 400,
    description: 'Third-party API integration protocol, external API handling.',
    keywords: ['third-party', 'external-api', 'integration', 'sdk'],
    splitFrom: '06-integrations',
  },
  {
    id: '06-integrations',
    name: 'Integrations',
    lines: 3440,
    description: 'Email (Resend), file uploads, background jobs (Inngest), third-party APIs.',
    keywords: ['email', 'resend', 'upload', 'inngest', 'webhook'],
  },
  {
    id: '07-performance',
    name: 'Performance',
    lines: 710,
    description: 'Caching strategies, query optimization, bundle size, lazy loading.',
    keywords: ['cache', 'optimize', 'performance', 'bundle', 'lazy'],
  },
  {
    id: '08-testing',
    name: 'Testing & CI/CD',
    lines: 820,
    description: 'Unit tests, E2E tests, CI pipelines, deployment, monitoring setup.',
    keywords: ['test', 'vitest', 'playwright', 'ci', 'deploy'],
  },
  {
    id: '09a-layouts',
    name: 'Layouts',
    lines: 500,
    description: 'Navigation, sidebar, header, footer, page layouts, theme switching.',
    keywords: ['navigation', 'sidebar', 'header', 'theme', 'layout'],
    splitFrom: '09-design',
  },
  {
    id: '09b-accessibility',
    name: 'Accessibility',
    lines: 350,
    description: 'WCAG compliance, keyboard navigation, ARIA labels, focus management.',
    keywords: ['a11y', 'wcag', 'keyboard', 'aria', 'focus'],
    splitFrom: '09-design',
  },
  {
    id: '09c-seo',
    name: 'SEO',
    lines: 300,
    description: 'Metadata, sitemap, Open Graph, structured data, robots.txt.',
    keywords: ['metadata', 'sitemap', 'opengraph', 'schema', 'seo'],
    splitFrom: '09-design',
  },
  {
    id: '09-design',
    name: 'Design System',
    lines: 2500,
    description: 'UI patterns, components, dashboards, marketing pages, design cloning.',
    keywords: ['ui', 'design', 'tailwind', 'component', 'dashboard'],
  },
  {
    id: '10-generators',
    name: 'Code Generators',
    lines: 2920,
    description: 'Project scaffolding, CRUD generators, boilerplate templates.',
    keywords: ['generate', 'scaffold', 'template', 'crud', 'boilerplate'],
  },
  {
    id: '11-realtime',
    name: 'Realtime',
    lines: 1940,
    description: 'WebSockets, live updates, notifications, presence, pub/sub.',
    keywords: ['websocket', 'realtime', 'notification', 'live', 'subscribe'],
  },
  {
    id: '11a-realtime-edge-cases',
    name: 'Realtime Edge Cases',
    lines: 450,
    description: 'Connection drops, reconnection, presence, message ordering, offline sync.',
    keywords: ['reconnect', 'presence', 'ordering', 'offline', 'sync'],
    edgeCase: true,
  },
  {
    id: '12-saas',
    name: 'SaaS Patterns',
    lines: 1270,
    description: 'Multi-tenancy, teams, feature flags, usage tracking, GDPR.',
    keywords: ['tenant', 'team', 'organization', 'feature flag', 'saas'],
  },
  {
    id: '13-mobile',
    name: 'Mobile',
    lines: 1060,
    description: 'React Native, Expo, mobile auth, push notifications, deep links.',
    keywords: ['react native', 'expo', 'mobile', 'ios', 'android'],
  },
  {
    id: '14-ai',
    name: 'AI & LLM',
    lines: 890,
    description: 'OpenAI, Anthropic integration, RAG, embeddings, streaming, function calling.',
    keywords: ['openai', 'anthropic', 'llm', 'rag', 'embedding', 'ai'],
  },
  {
    id: '15-research',
    name: 'Market Research',
    lines: 520,
    description: 'Discovery frameworks, competitive analysis, user personas, market sizing.',
    keywords: ['research', 'competitive', 'persona', 'market', 'discovery'],
  },
  {
    id: '16-planning',
    name: 'Product Planning',
    lines: 570,
    description: 'PRD templates, roadmaps, feature prioritization, user stories.',
    keywords: ['prd', 'roadmap', 'planning', 'specification', 'user story'],
  },
  {
    id: '17-marketing',
    name: 'Marketing',
    lines: 790,
    description: 'Growth strategies, messaging frameworks, content calendars, SEO content.',
    keywords: ['marketing', 'growth', 'content', 'seo', 'messaging'],
  },
  {
    id: '18-launch',
    name: 'Launch Playbook',
    lines: 690,
    description: 'Pre-launch checklist, beta programs, launch day runbook, post-launch.',
    keywords: ['launch', 'beta', 'release', 'go-live', 'checklist'],
  },
  {
    id: '19-audit',
    name: 'Code Audit',
    lines: 720,
    description: '100-point audit checklist, code review patterns, upgrade guides.',
    keywords: ['audit', 'review', 'checklist', 'quality', 'upgrade'],
  },
  {
    id: '20-operations',
    name: 'Operations',
    lines: 1330,
    description: 'Monitoring, alerting, runbooks, incident response, SLAs.',
    keywords: ['ops', 'monitoring', 'sentry', 'incident', 'runbook'],
  },
  {
    id: '21-experts-core',
    name: 'Core Experts',
    lines: 880,
    description: 'Backend, frontend, security, and DevOps expert perspectives.',
    keywords: ['expert', 'architect', 'backend', 'frontend', 'security'],
  },
  {
    id: '22-experts-health',
    name: 'Healthcare Expert',
    lines: 780,
    description: 'HIPAA compliance, healthcare app patterns, patient data handling.',
    keywords: ['hipaa', 'healthcare', 'medical', 'patient', 'health'],
  },
  {
    id: '23-experts-finance',
    name: 'Finance Expert',
    lines: 1090,
    description: 'Fintech patterns, PCI compliance, banking integrations, trading.',
    keywords: ['fintech', 'pci', 'banking', 'financial', 'trading'],
  },
  {
    id: '24-experts-legal',
    name: 'Legal Expert',
    lines: 2510,
    description: 'Legal tech, contracts, privacy policies, GDPR, terms of service.',
    keywords: ['legal', 'gdpr', 'privacy', 'contract', 'compliance'],
  },
  {
    id: '25a-ecommerce',
    name: 'E-commerce',
    lines: 300,
    description: 'Products, carts, orders, inventory, checkout flows.',
    keywords: ['product', 'cart', 'order', 'inventory', 'shop'],
    splitFrom: '25-experts-industry',
  },
  {
    id: '25b-education',
    name: 'Education & LMS',
    lines: 400,
    description: 'Courses, lessons, progress tracking, certificates, quizzes.',
    keywords: ['course', 'lesson', 'lms', 'certificate', 'quiz'],
    splitFrom: '25-experts-industry',
  },
  {
    id: '25c-voice-vapi',
    name: 'Voice AI (VAPI)',
    lines: 350,
    description: 'Voice AI assistants, VAPI integration, call handling.',
    keywords: ['voice-ai', 'assistant', 'vapi', 'call', 'speech'],
    splitFrom: '25-experts-industry',
  },
  {
    id: '25d-b2b',
    name: 'B2B & Enterprise',
    lines: 400,
    description: 'Multi-tenancy, RBAC, SSO, API keys, enterprise features.',
    keywords: ['enterprise', 'rbac', 'sso', 'api-key', 'b2b'],
    splitFrom: '25-experts-industry',
  },
  {
    id: '25e-kids-coppa',
    name: 'Kids & COPPA',
    lines: 350,
    description: 'COPPA compliance, parental consent, age gates, child safety.',
    keywords: ['coppa', 'parental', 'child', 'age-gate', 'consent'],
    splitFrom: '25-experts-industry',
  },
  {
    id: '25-experts-industry',
    name: 'Industry Experts',
    lines: 700,
    description: 'Cross-industry patterns, vertical-specific guidance.',
    keywords: ['industry', 'vertical', 'domain', 'specialist'],
  },
  {
    id: '26-analytics',
    name: 'Analytics',
    lines: 920,
    description: 'Event tracking, funnels, A/B testing, PostHog, Mixpanel integration.',
    keywords: ['analytics', 'tracking', 'posthog', 'mixpanel', 'funnel'],
  },
  {
    id: '27-search',
    name: 'Search',
    lines: 1130,
    description: 'Full-text search, Algolia, Typesense, autocomplete, faceted filters.',
    keywords: ['search', 'algolia', 'typesense', 'autocomplete', 'filter'],
  },
  {
    id: '28-email-design',
    name: 'Email Design',
    lines: 800,
    description: 'HTML email templates, MJML, React Email, responsive email patterns.',
    keywords: ['email', 'template', 'mjml', 'react email', 'newsletter'],
  },
  {
    id: '29-data-viz',
    name: 'Data Visualization',
    lines: 950,
    description: 'Charts with Recharts, D3, dashboards, data tables, metrics display.',
    keywords: ['chart', 'recharts', 'd3', 'dashboard', 'visualization'],
  },
  {
    id: '30-motion',
    name: 'Motion & Animation',
    lines: 880,
    description: 'Framer Motion, GSAP, page transitions, scroll animations, micro-interactions.',
    keywords: ['animation', 'framer motion', 'gsap', 'transition', 'motion'],
  },
  {
    id: '31-iconography',
    name: 'Iconography',
    lines: 630,
    description: 'Icon systems, Lucide, Heroicons, SVG optimization, icon buttons.',
    keywords: ['icon', 'lucide', 'heroicons', 'svg', 'iconography'],
  },
  {
    id: '32-print',
    name: 'Print & PDF',
    lines: 990,
    description: 'PDF generation, print stylesheets, invoices, reports, certificates.',
    keywords: ['pdf', 'print', 'invoice', 'report', 'puppeteer'],
  },
  {
    id: '33-cicd',
    name: 'CI/CD',
    lines: 1100,
    description: 'GitHub Actions, deployment pipelines, automated testing, release workflows.',
    keywords: ['github-actions', 'deploy', 'pipeline', 'ci', 'cd'],
  },
  {
    id: '34-integration-contracts',
    name: 'Integration Contracts',
    lines: 650,
    description: 'Cross-system integration patterns, API contracts, interface definitions.',
    keywords: ['contract', 'cross-system', 'interface', 'integration'],
  },
  {
    id: '35-environment',
    name: 'Environment',
    lines: 1200,
    description: 'Environment variables, secrets management, dotenv, configuration.',
    keywords: ['env', 'secrets', 'dotenv', 'config', 'environment'],
  },
  {
    id: '36-pre-launch',
    name: 'Pre-Launch',
    lines: 1400,
    description: 'Comprehensive pre-launch checklist, production readiness, go-live.',
    keywords: ['checklist', 'launch', 'production', 'readiness', 'go-live'],
  },
  {
    id: '37-quality-gates',
    name: 'Quality Gates',
    lines: 1100,
    description: 'ESLint, Prettier, code quality enforcement, linting standards.',
    keywords: ['lint', 'eslint', 'prettier', 'quality', 'standards'],
  },
  {
    id: '38-troubleshooting',
    name: 'Troubleshooting',
    lines: 1500,
    description: 'Common issues, debugging guides, error diagnosis, fixes.',
    keywords: ['debug', 'error', 'fix', 'issue', 'troubleshoot'],
  },
  {
    id: '39-self-healing',
    name: 'Self-Healing',
    lines: 1800,
    description: 'Auto-detect errors, AI-powered fixes, recovery patterns.',
    keywords: ['auto-fix', 'ai-repair', 'recovery', 'healing', 'automated'],
  },
];

export default function ModulesPage() {
  const totalLines = modules.reduce((sum, m) => sum + m.lines, 0);

  return (
    <article>
      <h1>Pattern Modules</h1>

      <p className="text-lg text-neutral-300">
        CodeBakers includes {modules.length} pattern modules covering {totalLines.toLocaleString()}+ lines
        of production-ready patterns. Modules are automatically loaded based on your request.
      </p>

      <h2>How Modules Work</h2>

      <p>
        When you describe what you want to build, CodeBakers detects keywords in your
        request and loads the relevant pattern modules. You don&apos;t need to manually
        select modules - just describe your task naturally.
      </p>

      <p>
        For example, saying &quot;add Stripe billing&quot; automatically loads:
      </p>

      <ul>
        <li><code>00-core</code> - Always loaded for standards</li>
        <li><code>03-api</code> - For webhook endpoints</li>
        <li><code>05-payments</code> - For Stripe patterns</li>
      </ul>

      <h2>Module Reference</h2>

      <div className="not-prose space-y-4">
        {modules.map((module) => (
          <div
            key={module.id}
            className={`rounded-lg border p-4 ${
              module.required
                ? 'border-red-500/50 bg-red-500/5'
                : 'border-neutral-800 bg-neutral-900/50'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-red-400">{module.id}</code>
                  {module.required && (
                    <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                      Always Loaded
                    </span>
                  )}
                  {module.edgeCase && (
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                      Edge Cases
                    </span>
                  )}
                  {module.splitFrom && (
                    <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
                      Split Module
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-lg font-semibold text-white">{module.name}</h3>
                <p className="mt-1 text-neutral-400">{module.description}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {module.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right text-sm text-neutral-500">
                {module.lines.toLocaleString()} lines
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2>Common Combinations</h2>

      <p>
        Most features require 2-4 modules working together. Here are common combinations:
      </p>

      <div className="not-prose space-y-3">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="font-semibold text-white">Basic CRUD Feature</div>
          <code className="mt-1 block text-sm text-neutral-400">
            00-core + 01-database + 03-api + 04-frontend
          </code>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="font-semibold text-white">Authentication System</div>
          <code className="mt-1 block text-sm text-neutral-400">
            00-core + 01-database + 02-auth + 04-frontend
          </code>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="font-semibold text-white">Payment Integration</div>
          <code className="mt-1 block text-sm text-neutral-400">
            00-core + 02-auth + 03-api + 05-payments + 04-frontend
          </code>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="font-semibold text-white">Full SaaS Feature</div>
          <code className="mt-1 block text-sm text-neutral-400">
            00-core + 01-database + 02-auth + 03-api + 04-frontend + 12-saas
          </code>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="font-semibold text-white">AI Chatbot</div>
          <code className="mt-1 block text-sm text-neutral-400">
            00-core + 03-api + 04-frontend + 14-ai
          </code>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="font-semibold text-white">Analytics Dashboard</div>
          <code className="mt-1 block text-sm text-neutral-400">
            00-core + 01-database + 04-frontend + 26-analytics + 29-data-viz
          </code>
        </div>
      </div>

      <h2>Module Categories</h2>

      <h3>Foundation (00-03)</h3>
      <p>
        Core patterns that most projects need: TypeScript standards, database queries,
        authentication, and API development.
      </p>

      <h3>Features (04-14)</h3>
      <p>
        Common feature implementations: frontend components, payments, integrations,
        performance optimization, testing, and more.
      </p>

      <h3>Business (15-20)</h3>
      <p>
        Non-code patterns: market research, product planning, marketing, launch
        playbooks, auditing, and operations.
      </p>

      <h3>Expert Perspectives (21-25)</h3>
      <p>
        Domain-specific guidance from virtual experts: core engineering, healthcare,
        finance, legal, and industry verticals.
      </p>

      <h3>Specialized (26-32)</h3>
      <p>
        Focused patterns for specific needs: analytics, search, email design,
        data visualization, animations, icons, and PDF generation.
      </p>

      <h2>Version Pinning</h2>

      <p>
        Teams can pin to a specific pattern version in their{' '}
        <Link href="/docs/getting-started">team settings</Link>. This ensures
        consistent patterns across your team, even when new versions are released.
      </p>

      <h2>Requesting New Modules</h2>

      <p>
        Have a pattern you&apos;d like to see? We&apos;re always expanding our module library.
        Contact us at{' '}
        <a href="mailto:support@codebakers.dev" className="text-red-400 hover:underline">
          support@codebakers.dev
        </a>{' '}
        with your suggestions.
      </p>
    </article>
  );
}
