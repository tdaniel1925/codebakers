import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { InteractiveDemo } from '@/components/interactive-demo';
// Premium Hugeicons - distinctive stroke-based icons with 9 unique styles
import {
  CheckmarkCircle02Icon,
  CancelCircleIcon,
  FlashIcon,
  SecurityCheckIcon,
  TestTube01Icon,
  CodeIcon,
  ArrowRight02Icon,
  AiMagicIcon,
  Clock01Icon,
  CodeFolderIcon,
  Layers01Icon,
  Database02Icon,
  CreditCardIcon,
  Mail01Icon,
  SmartPhone01Icon,
  Globe02Icon,
  LockIcon,
  DashboardSpeed01Icon,
  ArrowDown01Icon,
  Building03Icon,
  Rocket01Icon,
  Search01Icon,
  Target02Icon,
  Megaphone01Icon,
  PlayIcon,
  ClipboardIcon,
  Settings02Icon,
  UserGroupIcon,
  HealthIcon,
  Wallet02Icon,
  JusticeScale01Icon,
  Store02Icon,
  Briefcase01Icon,
  CommandLineIcon,
  ArrowReloadHorizontalIcon,
  AiBrain02Icon,
  StarIcon,
  CustomerService01Icon,
  PlayCircleIcon,
  Cancel01Icon,
  Tick02Icon,
} from 'hugeicons-react';

// Supported AI IDEs
const supportedIDEs = [
  { name: 'Cursor', logo: '/logos/cursor.svg', primary: true },
  { name: 'Claude Code', logo: '/logos/claude.svg', primary: true },
  { name: 'Windsurf', logo: '/logos/windsurf.svg', primary: false },
  { name: 'Aider', logo: '/logos/aider.svg', primary: false },
];

// Social proof testimonials
const testimonials = [
  {
    quote: "Went from 6 hours of prompting to 30 minutes. This is how AI coding should work.",
    author: "Sarah Chen",
    role: "Indie Hacker",
    avatar: "SC",
  },
  {
    quote: "My AI finally writes production code instead of demo garbage. Game changer for client work.",
    author: "Marcus Johnson",
    role: "Freelance Developer",
    avatar: "MJ",
  },
  {
    quote: "We shipped our MVP in 2 weeks instead of 2 months. The compliance patterns alone saved us $10K in legal.",
    author: "Alex Rivera",
    role: "Startup Founder",
    avatar: "AR",
  },
];

// Who this is for
const audiences = [
  {
    title: "Indie Hackers",
    description: "Ship your SaaS faster. Stop wasting weekends on auth and payments.",
    icon: Rocket01Icon,
    highlight: "Ship 10x faster",
  },
  {
    title: "Freelancers & Agencies",
    description: "Deliver production-quality code to clients. Include professional handoff docs.",
    icon: Briefcase01Icon,
    highlight: "Impress every client",
  },
  {
    title: "Startup Teams",
    description: "Move fast without breaking things. Built-in compliance from day one.",
    icon: Building03Icon,
    highlight: "Scale confidently",
  },
  {
    title: "Vibe Coders",
    description: "You have the vision. Let AI handle the implementation details perfectly.",
    icon: AiMagicIcon,
    highlight: "Pure creativity",
  },
];

// Time savings comparison data
const timeSavings = [
  { task: 'Authentication System (Login, Signup, Password Reset, 2FA)', without: '4-6 hours', with: '30 min', savings: '90%' },
  { task: 'CRUD API Endpoint with Validation', without: '45 min', with: '10 min', savings: '78%' },
  { task: 'Form with Validation & Error Handling', without: '45 min', with: '5 min', savings: '89%' },
  { task: 'Stripe Subscription Integration', without: '3-4 hours', with: '30 min', savings: '85%' },
  { task: 'Database Schema + Migrations', without: '1 hour', with: '15 min', savings: '75%' },
  { task: 'Real-time WebSocket Feature', without: '2-3 hours', with: '20 min', savings: '87%' },
  { task: 'Email Integration (Transactional)', without: '1-2 hours', with: '15 min', savings: '83%' },
  { task: 'File Upload with S3', without: '1-2 hours', with: '20 min', savings: '80%' },
  { task: 'Automated Tests (Playwright)', without: '1 hour/feature', with: '0 min (auto)', savings: '100%' },
  { task: 'Multi-tenant Team System', without: '4-6 hours', with: '45 min', savings: '88%' },
];

// Module breakdown data - v5.1 (34 modules, 45,474 lines)
const modules = [
  // Code Modules (00-14) - 22,356 lines
  { name: '00-core', lines: 2131, description: 'Standards, types, error handling, logging', icon: CodeFolderIcon, required: true, category: 'code' },
  { name: '01-database', lines: 651, description: 'Drizzle ORM, migrations, soft deletes', icon: Database02Icon, category: 'code' },
  { name: '02-auth', lines: 1239, description: 'Supabase Auth, OAuth, 2FA, RBAC', icon: LockIcon, category: 'code' },
  { name: '03-api', lines: 1641, description: 'Routes, webhooks, rate limiting', icon: Globe02Icon, category: 'code' },
  { name: '04-frontend', lines: 1772, description: 'React Hook Form, React Query, Zustand', icon: Layers01Icon, category: 'code' },
  { name: '05-payments', lines: 1571, description: 'Stripe, usage billing, invoices', icon: CreditCardIcon, category: 'code' },
  { name: '06-integrations', lines: 3439, description: 'Email, SMS, VAPI, S3, cron jobs', icon: Mail01Icon, category: 'code' },
  { name: '07-performance', lines: 709, description: 'Redis caching, optimization, CDN', icon: DashboardSpeed01Icon, category: 'code' },
  { name: '08-testing', lines: 818, description: 'Playwright, Vitest, CI/CD, coverage', icon: TestTube01Icon, category: 'code' },
  { name: '09-design', lines: 3205, description: 'Dark mode, 50+ shadcn, WCAG a11y', icon: AiMagicIcon, category: 'code' },
  { name: '10-generators', lines: 2920, description: 'CRUD scaffolding, admin generators', icon: Rocket01Icon, category: 'code' },
  { name: '11-realtime', lines: 1938, description: 'WebSockets, presence, live cursors', icon: FlashIcon, category: 'code' },
  { name: '12-saas', lines: 1265, description: 'Multi-tenant, feature flags, GDPR', icon: Building03Icon, category: 'code' },
  { name: '13-mobile', lines: 1057, description: 'React Native, PWA, offline-first', icon: SmartPhone01Icon, category: 'code' },
  { name: '14-ai', lines: 888, description: 'OpenAI, Anthropic, RAG, embeddings', icon: AiBrain02Icon, category: 'code' },
  // Business Modules (15-20) - 4,341 lines
  { name: '15-research', lines: 517, description: 'Market research, personas, interviews', icon: Search01Icon, category: 'business' },
  { name: '16-planning', lines: 565, description: 'MVP scope, roadmap, architecture', icon: Target02Icon, category: 'business' },
  { name: '17-marketing', lines: 791, description: 'Campaigns, AI prompts, launch strategy', icon: Megaphone01Icon, category: 'business' },
  { name: '18-launch', lines: 691, description: 'Pre-launch checklist, go-live playbook', icon: PlayCircleIcon, category: 'business' },
  { name: '19-audit', lines: 450, description: '100-point inspection, security audit', icon: ClipboardIcon, category: 'business' },
  { name: '20-operations', lines: 1327, description: 'Sentry, incident response, support', icon: Settings02Icon, category: 'business' },
  // Expert Modules (21-25) - 8,784 lines
  { name: '21-experts-core', lines: 879, description: 'Backend, Frontend, Security, QA, DevOps', icon: UserGroupIcon, category: 'expert' },
  { name: '22-experts-health', lines: 778, description: 'HIPAA, PHI logging, WCAG 2.1 AA', icon: HealthIcon, category: 'expert' },
  { name: '23-experts-finance', lines: 1090, description: 'PCI-DSS, KYC/AML, fraud detection', icon: Wallet02Icon, category: 'expert' },
  { name: '24-experts-legal', lines: 2508, description: 'ToS, Privacy Policy, GDPR, CCPA', icon: JusticeScale01Icon, category: 'expert' },
  { name: '25-experts-industry', lines: 3529, description: 'E-commerce, Education, B2B, COPPA', icon: Store02Icon, category: 'expert' },
  // Extended Modules (26-33) - 7,105 lines
  { name: '26-analytics', lines: 918, description: 'PostHog, Mixpanel, funnels, cohorts', icon: DashboardSpeed01Icon, category: 'extended' },
  { name: '27-search', lines: 1130, description: 'Full-text, Algolia, autocomplete', icon: Search01Icon, category: 'extended' },
  { name: '28-email-design', lines: 796, description: 'HTML emails, MJML, React Email', icon: Mail01Icon, category: 'extended' },
  { name: '29-data-viz', lines: 948, description: 'Charts, Recharts, D3, dashboards', icon: DashboardSpeed01Icon, category: 'extended' },
  { name: '30-motion', lines: 877, description: 'Framer Motion, GSAP, animations', icon: PlayCircleIcon, category: 'extended' },
  { name: '31-iconography', lines: 628, description: 'Lucide, Heroicons, SVG systems', icon: AiMagicIcon, category: 'extended' },
  { name: '32-print', lines: 988, description: 'PDF generation, print stylesheets', icon: ClipboardIcon, category: 'extended' },
  { name: '33-cicd', lines: 820, description: 'GitHub Actions, Vercel, Netlify, Docker', icon: Rocket01Icon, category: 'extended' },
];

// The Problem - why vanilla AI coding sucks
const problems = [
  {
    icon: ArrowReloadHorizontalIcon,
    title: 'Endless Revision Loops',
    description: '"Add validation" → "Now add loading states" → "Handle errors" → "Make it accessible" → Still broken after 10 prompts.',
  },
  {
    icon: AiBrain02Icon,
    title: 'AI Doesn\'t Know Best Practices',
    description: 'Vanilla Claude/GPT writes code that works in demos but fails in production. Missing error handling, security holes, no tests.',
  },
  {
    icon: Clock01Icon,
    title: 'Hours on Basic Features',
    description: 'Auth system? 4-6 hours of prompting. Stripe integration? 3-4 hours. Every project starts from zero.',
  },
];

// Features with more detail - v4.1
const features = [
  {
    icon: FlashIcon,
    title: 'Production-Ready First Prompt',
    description: 'Your AI writes senior-level code from the start. Auth, payments, forms, APIs—all with proper error handling, types, and tests included.',
    stats: 'Near-perfect first output',
  },
  {
    icon: DashboardSpeed01Icon,
    title: '90% Token Savings',
    description: 'Smart router loads only relevant modules (max 4). Ask for "login form" and it loads ~5K lines, not all 44K. Better responses, lower costs.',
    stats: '90% context savings',
  },
  {
    icon: Briefcase01Icon,
    title: 'Business-in-a-Box for SaaS',
    description: 'Not just code—full business modules: market research, launch playbooks, marketing prompts, compliance docs. Everything to ship a SaaS.',
    stats: '3 project types',
  },
  {
    icon: UserGroupIcon,
    title: '30+ Expert Perspectives',
    description: 'Your AI becomes a team: Backend, Frontend, Security, QA, DevOps, Legal, HIPAA, PCI-DSS specialists. Domain expertise built-in.',
    stats: '30+ virtual experts',
  },
  {
    icon: SecurityCheckIcon,
    title: 'Compliance From Day One',
    description: 'HIPAA, PCI-DSS, GDPR, CCPA, COPPA patterns baked in. Stop retrofitting security—start with it.',
    stats: '100+ compliance patterns',
  },
  {
    icon: CommandLineIcon,
    title: 'Works With Your IDE',
    description: 'Cursor, Claude Code, Aider, Windsurf—any AI that reads context files. One install, instant upgrade to your entire workflow.',
    stats: 'All major AI IDEs',
  },
];

// Why CodeBakers vs other "Cursor helpers"
// Based on research of: cursor.directory, awesome-cursorrules, dotcursorrules.com, awesome-claude-code
const vsCompetitors = [
  {
    feature: 'Total lines of patterns',
    codebakers: '45,474 lines',
    others: '~500 lines per rule',
  },
  {
    feature: 'Production patterns (auth, payments, APIs)',
    codebakers: true,
    others: 'Basic snippets only',
  },
  {
    feature: 'Smart routing (loads only what you need)',
    codebakers: '90% token savings',
    others: false,
  },
  {
    feature: 'Business modules (research, marketing, launch)',
    codebakers: '6 modules',
    others: false,
  },
  {
    feature: 'Expert perspectives (Security, Legal, HIPAA, etc.)',
    codebakers: '30+ experts',
    others: false,
  },
  {
    feature: 'Compliance patterns (HIPAA, PCI-DSS, GDPR, CCPA)',
    codebakers: '100+ patterns',
    others: false,
  },
  {
    feature: 'Auto-generated tests with every feature',
    codebakers: 'Playwright + Vitest',
    others: false,
  },
  {
    feature: 'Works across AI IDEs',
    codebakers: 'Cursor, Claude Code, Windsurf, Aider',
    others: 'Cursor only (mostly)',
  },
  {
    feature: 'Price',
    codebakers: '$19-49/mo',
    others: 'Free (DIY assembly)',
  },
];

// What's covered comprehensively - v5.0
const coverageAreas = [
  {
    category: 'Code Modules (15)',
    items: ['Auth & 2FA/OAuth', 'Database & Migrations', 'API & Webhooks', 'Forms & Validation', 'Stripe Billing', 'Email/SMS/VAPI', 'Caching & Performance', 'Testing & CI/CD', 'Design & Accessibility', 'AI/LLM Integration'],
  },
  {
    category: 'Business Modules (6)',
    items: ['Market Research', 'Competitive Analysis', 'User Personas', 'MVP Planning', 'Launch Checklists', 'Incident Response', 'Support Tickets', 'Feature Flags', 'Monitoring (Sentry)'],
  },
  {
    category: 'Expert Modules (5)',
    items: ['Core Team (7 experts)', 'Health/HIPAA', 'Finance/PCI-DSS', 'Legal/GDPR/CCPA', 'Industry-specific'],
  },
  {
    category: 'Compliance Coverage',
    items: ['HIPAA (18 identifiers)', 'PCI-DSS (SAQ-A)', 'GDPR Data Export', 'CCPA Rights', 'COPPA Age Gates', 'KYC/AML Screening', 'Fraud Detection', 'BAA Requirements', 'Privacy Policies'],
  },
  {
    category: 'Marketing Prompts',
    items: ['30-day Social Calendar', '7-10 Email Sequences', '10 Blog Articles', '5 Video Scripts', '3 Ad Campaigns', 'Press Releases', 'Launch Strategy', 'SEO Checklist', 'Conversion Copy'],
  },
  {
    category: 'Extended Modules (7)',
    items: ['Analytics & Tracking', 'Search & Autocomplete', 'Email Templates', 'Data Visualization', 'Motion & Animation', 'Iconography', 'PDF & Print'],
  },
  {
    category: 'Project Deliverables',
    items: ['Technical Specs', 'Architecture Docs', 'Handoff Guides', 'API Documentation', 'Roadmap Templates', 'Risk Assessments', 'Go-live Playbooks', 'Rollback Procedures', '100-point Audits'],
  },
  {
    category: 'Security & Infrastructure',
    items: ['Rate Limiting', 'CSRF Protection', 'Input Sanitization', 'Secure Headers', 'Session Management', 'API Key Rotation', 'Webhook Verification', 'Audit Logging', 'Error Boundaries'],
  },
];

// FAQ data - v5.0
const faqs = [
  {
    question: 'How easy is it to install?',
    answer: 'Two steps, under 2 minutes: 1) Run "npx @codebakers/cli setup" in your terminal and enter your API key. 2) Paste one command into Claude Code. That\'s it! No restart needed, works across all your projects instantly.',
  },
  {
    question: 'What AI tools does CodeBakers work with?',
    answer: 'Cursor IDE, Claude Code CLI, Aider, Windsurf, and any AI coding assistant. Our CLI automatically detects your IDE and configures everything. One install, instant upgrade to your entire AI coding workflow.',
  },
  {
    question: 'How is this different from other Cursor rules?',
    answer: 'Other tools give you basic snippets. CodeBakers provides 45,474 lines of production patterns across 34 modules with smart module loading (90% token savings), 30+ expert perspectives, business modules, compliance patterns, and auto-generated tests. It\'s a complete system, not just prompts.',
  },
  {
    question: 'What do you mean by "production-ready first prompt"?',
    answer: 'Vanilla AI writes demo code that needs 5-10 revisions. With CodeBakers patterns loaded, your AI outputs code with proper error handling, types, validation, loading states, tests, and security from the first prompt. Near-perfect output, minimal revision.',
  },
  {
    question: 'How does smart module loading save tokens?',
    answer: 'The router loads only relevant modules (max 4 at a time). Ask for "login form" and it loads core + auth + frontend (~5K lines) instead of all 45K. This saves 90% context usage and produces better, more focused responses.',
  },
  {
    question: 'What are the 3 project types?',
    answer: 'Personal: Just code + tests, jump straight to building. Client: Code + handoff docs for freelance/agency work (technical specs, API docs). Business: Full product team with market research, business docs, marketing prompts, and launch planning.',
  },
  {
    question: 'What compliance patterns are included?',
    answer: 'HIPAA (18 identifiers, PHI logging), PCI-DSS (SAQ-A with Stripe), GDPR/CCPA (data export, consent), COPPA (age gates, parental consent), KYC/AML (screening rules), plus ToS and Privacy Policy generators. Built-in from day one.',
  },
  {
    question: 'Are patterns stored on my computer?',
    answer: 'No. Patterns are fetched on-demand via our MCP server and delivered directly to your AI. Nothing is stored locally, which means instant updates and better security. Your AI gets the patterns it needs, when it needs them.',
  },
  {
    question: 'What if I already have custom Cursor rules?',
    answer: 'CodeBakers works alongside your existing rules. Our patterns load dynamically based on what you\'re building, so they complement rather than replace your custom setup. You get the best of both.',
  },
];

// Pricing tiers - v5.0
const pricingTiers = [
  {
    name: 'Pro',
    price: 49,
    description: 'For individual developers',
    features: ['1 developer seat', 'All 34 modules', '45,474 lines of patterns', '30+ expert perspectives', 'CLI access', 'Discord community'],
    cta: 'Start Building',
    popular: true,
  },
  {
    name: 'Team',
    price: 149,
    description: 'For small teams',
    features: ['5 developer seats', 'Everything in Pro', 'Team management', 'Shared API keys', 'Priority support', 'Slack channel'],
    cta: 'Start Free',
  },
  {
    name: 'Agency',
    price: 349,
    description: 'For agencies & consultancies',
    features: ['Unlimited seats', 'Everything in Team', 'White-label option', 'Custom patterns', 'Dedicated support', '1:1 onboarding'],
    cta: 'Contact Sales',
  },
];

export default function HomePage() {
  const totalLines = modules.reduce((sum, m) => sum + m.lines, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">CB</span>
            </div>
            <span className="text-xl font-bold text-foreground">CodeBakers</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Features
            </Link>
            <Link href="#compare" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Compare
            </Link>
            <Link href="#modules" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Modules
            </Link>
            <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Pricing
            </Link>
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground text-sm">
                Login
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20 text-sm">
                Start Free
                <ArrowRight02Icon className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
          {/* Mobile nav */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <Link href="/signup">
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white text-sm">
                Start Free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section - Bold & Impactful */}
      <section className="pt-28 pb-24 px-4 relative overflow-hidden" style={{ background: 'var(--section-hero)' }}>
        {/* Grid Background Pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
            style={{
              backgroundImage: `linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)`,
              backgroundSize: '80px 80px'
            }}
          />
        </div>

        <div className="container mx-auto text-center relative z-10">
          {/* Top badge - IDE focus */}
          <div className="inline-flex items-center gap-3 mb-8 px-5 py-2.5 rounded-full bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-foreground">Works with</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-red-600 dark:text-red-400">Cursor</span>
              <span className="text-muted-foreground">•</span>
              <span className="font-semibold text-white">Claude Code</span>
              <span className="text-muted-foreground">•</span>
              <span className="font-semibold text-red-600 dark:text-red-400">Windsurf</span>
              <span className="text-muted-foreground">•</span>
              <span className="font-semibold text-white">Aider</span>
            </div>
          </div>

          {/* MAIN HEADLINE - Big & Bold */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black mb-6 leading-[0.95] tracking-tight">
            <span className="text-foreground">Production-Ready Code</span>
            <br />
            <span className="text-red-600 dark:text-red-500">
              On The First&nbsp;Prompt
            </span>
          </h1>

          {/* Value prop - clear & direct */}
          <p className="text-xl md:text-2xl lg:text-3xl text-muted-foreground mb-8 max-w-4xl mx-auto font-medium">
            Make your AI write code like a <span className="text-foreground font-bold">senior developer</span>.
            <br className="hidden md:block" />
            <span className="text-foreground">No more revision loops. No more demo garbage.</span>
          </p>

          {/* Bold Stats Row */}
          <div className="flex flex-wrap justify-center gap-6 md:gap-10 mb-10">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-black text-foreground">34</div>
              <div className="text-sm text-muted-foreground font-medium">Modules</div>
            </div>
            <div className="hidden sm:block w-px h-16 bg-border" />
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-black text-foreground">{(totalLines / 1000).toFixed(0)}K+</div>
              <div className="text-sm text-muted-foreground font-medium">Lines of Code</div>
            </div>
            <div className="hidden sm:block w-px h-16 bg-border" />
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-black text-green-600 dark:text-green-500">90%</div>
              <div className="text-sm text-muted-foreground font-medium">Less Revision</div>
            </div>
            <div className="hidden sm:block w-px h-16 bg-border" />
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-black text-red-600 dark:text-red-500">1st</div>
              <div className="text-sm text-muted-foreground font-medium">Prompt Success</div>
            </div>
          </div>

          {/* CTA Buttons - Prominent */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
            <Link href="/signup">
              <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white h-16 px-10 text-xl font-semibold w-full sm:w-auto shadow-xl shadow-red-500/30 transition-all hover:shadow-2xl hover:shadow-red-500/40 hover:-translate-y-1 rounded-xl">
                Upgrade Your AI Now
                <ArrowRight02Icon className="ml-2 h-6 w-6" />
              </Button>
            </Link>
            <Link href="#demo-comparison">
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-border hover:bg-accent h-16 px-10 text-xl font-semibold w-full sm:w-auto group rounded-xl"
              >
                <PlayIcon className="mr-2 h-6 w-6 group-hover:text-red-500 transition-colors" />
                See The Difference
              </Button>
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center items-center gap-6 mb-12 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <SecurityCheckIcon className="h-5 w-5 text-green-500" />
              <span>1 free project forever</span>
            </div>
            <div className="flex items-center gap-2">
              <FlashIcon className="h-5 w-5 text-yellow-500" />
              <span>2-minute setup</span>
            </div>
            <div className="flex items-center gap-2">
              <Tick02Icon className="h-5 w-5 text-blue-500" />
              <span>No credit card required</span>
            </div>
          </div>

          {/* Before/After Visual - The Core Promise */}
          <div className="max-w-4xl mx-auto" id="demo">
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              {/* BEFORE - Without CodeBakers */}
              <div className="rounded-xl bg-red-950/20 dark:bg-red-950/40 border-2 border-red-500/30 p-6 text-left relative overflow-hidden">
                <div className="absolute top-3 right-3">
                  <Badge className="bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30 font-bold">WITHOUT</Badge>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Cancel01Icon className="h-6 w-6 text-red-500" />
                  <span className="font-bold text-red-600 dark:text-red-400">Vanilla AI Output</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Cancel01Icon className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <span>Missing error handling</span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Cancel01Icon className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <span>No loading states</span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Cancel01Icon className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <span>Security vulnerabilities</span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Cancel01Icon className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <span>No tests included</span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Cancel01Icon className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <span>5-10 revision prompts needed</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-red-500/20">
                  <span className="text-2xl font-bold text-red-500">4-6 hours</span>
                  <span className="text-muted-foreground text-sm ml-2">per feature</span>
                </div>
              </div>

              {/* AFTER - With CodeBakers */}
              <div className="rounded-xl bg-green-950/20 dark:bg-green-950/40 border-2 border-green-500/30 p-6 text-left relative overflow-hidden">
                <div className="absolute top-3 right-3">
                  <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30 font-bold">WITH CODEBAKERS</Badge>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Tick02Icon className="h-6 w-6 text-green-500" />
                  <span className="font-bold text-green-600 dark:text-green-400">Production-Ready Output</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2 text-foreground">
                    <Tick02Icon className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Complete error handling</span>
                  </div>
                  <div className="flex items-start gap-2 text-foreground">
                    <Tick02Icon className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Loading, empty, error states</span>
                  </div>
                  <div className="flex items-start gap-2 text-foreground">
                    <Tick02Icon className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Security best practices</span>
                  </div>
                  <div className="flex items-start gap-2 text-foreground">
                    <Tick02Icon className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Tests auto-generated</span>
                  </div>
                  <div className="flex items-start gap-2 text-foreground">
                    <Tick02Icon className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="font-semibold">Works on first prompt</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-green-500/20">
                  <span className="text-2xl font-bold text-green-500">30 minutes</span>
                  <span className="text-muted-foreground text-sm ml-2">per feature</span>
                </div>
              </div>
            </div>

            {/* Bottom quote */}
            <div className="mt-8 p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border">
              <div className="flex items-center justify-center gap-3">
                <div className="flex -space-x-2">
                  {['bg-red-600', 'bg-neutral-700', 'bg-red-500', 'bg-neutral-600'].map((bg, i) => (
                    <div key={i} className={`w-8 h-8 rounded-full ${bg} border-2 border-background flex items-center justify-center text-white text-xs font-bold`}>
                      {['S', 'M', 'A', 'J'][i]}
                    </div>
                  ))}
                </div>
                <span className="text-muted-foreground text-sm">
                  Join <span className="text-foreground font-bold">1,200+</span> developers who upgraded their AI
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Works With Section */}
      <section className="py-10 px-4 border-y border-border" style={{ background: 'var(--section-stats)' }}>
        <div className="container mx-auto">
          <p className="text-center text-muted-foreground mb-6 text-sm uppercase tracking-wider">
            Make your AI IDE the best it can be
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            {/* Cursor */}
            <div className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
              <Image
                src="/logos/cursor-light.svg"
                alt="Cursor IDE"
                width={120}
                height={40}
                className="h-8 w-auto hidden dark:block"
              />
              <Image
                src="/logos/cursor-dark.svg"
                alt="Cursor IDE"
                width={120}
                height={40}
                className="h-8 w-auto dark:hidden"
              />
            </div>
            {/* Claude Code */}
            <div className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
              <Image
                src="/logos/claude.svg"
                alt="Claude"
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg"
              />
              <span className="text-lg font-semibold text-foreground">Claude Code</span>
            </div>
            {/* Windsurf */}
            <div className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
              <Image
                src="/logos/windsurf.svg"
                alt="Windsurf"
                width={40}
                height={40}
                className="h-10 w-10 hidden dark:block"
              />
              <Image
                src="/logos/windsurf-black.svg"
                alt="Windsurf"
                width={40}
                height={40}
                className="h-10 w-10 dark:hidden"
              />
              <span className="text-lg font-semibold text-foreground">Windsurf</span>
            </div>
            {/* Aider */}
            <div className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
              <Image
                src="/logos/aider.svg"
                alt="Aider"
                width={80}
                height={40}
                className="h-8 w-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-8 px-4 border-b border-border bg-card">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-foreground">34</div>
              <div className="text-muted-foreground text-sm">Modules</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground">{totalLines.toLocaleString()}</div>
              <div className="text-muted-foreground text-sm">Lines of Patterns</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground">30+</div>
              <div className="text-muted-foreground text-sm">Expert Perspectives</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground">90%</div>
              <div className="text-muted-foreground text-sm">Token Savings</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">1st</div>
              <div className="text-muted-foreground text-sm">Prompt Success</div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-16 px-4" style={{ background: 'var(--section-features)' }} id="demo-comparison">
        <InteractiveDemo />
      </section>

      {/* Who This Is For Section */}
      <section className="py-16 px-4" style={{ background: 'var(--section-features)' }}>
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800">Built For You</Badge>
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Whether you&apos;re solo or&nbsp;scaling
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              CodeBakers adapts to how you build. Choose your project type and get exactly what you&nbsp;need.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {audiences.map((audience) => {
              const Icon = audience.icon;
              return (
                <div
                  key={audience.title}
                  className="p-6 rounded-xl bg-card border border-border hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/5 transition-all group"
                >
                  <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 w-fit mb-4 group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition-colors">
                    <Icon className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <Badge className="mb-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800 text-xs">
                    {audience.highlight}
                  </Badge>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {audience.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">{audience.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-20 px-4" style={{ background: 'var(--section-compare)' }}>
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800">The Problem</Badge>
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Sound&nbsp;familiar?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              You love AI coding tools. But you&apos;re stuck in an endless loop of &quot;almost&nbsp;right.&quot;
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {problems.map((problem) => {
              const Icon = problem.icon;
              return (
                <div
                  key={problem.title}
                  className="p-6 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50"
                >
                  <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 w-fit mb-4">
                    <Icon className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {problem.title}
                  </h3>
                  <p className="text-muted-foreground">{problem.description}</p>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-12">
            <p className="text-lg text-muted-foreground">
              <span className="text-foreground font-medium">The solution?</span> Give your AI the patterns it needs to write production code from the start.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4" style={{ background: 'var(--section-compare)' }}>
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800">The Solution</Badge>
            <h2 className="text-4xl font-bold text-foreground mb-4">
              CodeBakers makes your AI write like a senior&nbsp;dev
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {totalLines.toLocaleString()} lines of production patterns. Your AI finally knows best&nbsp;practices.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="p-6 rounded-xl bg-card border border-border hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/5 transition-all"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                      <Icon className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <Badge variant="outline" className="text-muted-foreground border-border">
                      {feature.stats}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Social Proof / Testimonials */}
      <section className="py-20 px-4" style={{ background: 'var(--section-examples)' }}>
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-800">
              <StarIcon className="h-3 w-3 mr-1 fill-current" />
              Loved by Developers
            </Badge>
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Real developers. Real&nbsp;results.
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              See what happens when your AI actually knows what it&apos;s&nbsp;doing.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="h-4 w-4 text-yellow-500 fill-current" />
                  ))}
                </div>
                <p className="text-foreground mb-4 italic">&quot;{testimonial.quote}&quot;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-sm">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="text-foreground font-medium text-sm">{testimonial.author}</p>
                    <p className="text-muted-foreground text-xs">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mid-page CTA */}
          <div className="mt-16 text-center p-8 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <h3 className="text-2xl font-bold text-foreground mb-2">Ready to ship&nbsp;faster?</h3>
            <p className="text-muted-foreground mb-6">Join 1,200+ developers who&apos;ve upgraded their AI.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/30">
                  Start Building Now
                  <ArrowRight02Icon className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Time Savings Comparison */}
      <section id="compare" className="py-20 px-4 relative" style={{ background: 'var(--section-compare)' }}>
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-secondary text-secondary-foreground border-border">Time Savings</Badge>
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Stop guessing. See the&nbsp;numbers.
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Real time savings measured across common development&nbsp;tasks.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Task</th>
                  <th className="text-center py-4 px-4 text-red-600 dark:text-red-400 font-medium">Without CodeBakers</th>
                  <th className="text-center py-4 px-4 text-green-600 dark:text-green-400 font-medium">With CodeBakers</th>
                  <th className="text-center py-4 px-4 text-blue-600 dark:text-blue-400 font-medium">Time Saved</th>
                </tr>
              </thead>
              <tbody>
                {timeSavings.map((row, index) => (
                  <tr key={index} className="border-b border-border/50">
                    <td className="py-4 px-4 text-foreground">{row.task}</td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/30 px-3 py-1 rounded-full text-sm">
                        {row.without}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-950/30 px-3 py-1 rounded-full text-sm">
                        {row.with}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">{row.savings}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-center text-muted-foreground/70 mt-8 text-sm">
            * Based on average development times across 50+ production projects
          </p>
        </div>
      </section>

      {/* Why Not Just Cursor Rules - Comparison Section */}
      <section className="py-20 px-4" style={{ background: 'var(--section-coverage)' }}>
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800">vs Alternatives</Badge>
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Why not free Cursor&nbsp;rules?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              cursor.directory, awesome-cursorrules, and awesome-claude-code are great starting points. But they&apos;re just snippets you have to assemble&nbsp;yourself.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card max-w-4xl mx-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 px-6 text-muted-foreground font-medium">Feature</th>
                  <th className="text-center py-4 px-6 text-foreground font-medium">
                    <span className="text-red-600 dark:text-red-400">CodeBakers</span>
                  </th>
                  <th className="text-center py-4 px-6 text-muted-foreground font-medium">Free Alternatives</th>
                </tr>
              </thead>
              <tbody>
                {vsCompetitors.map((row, index) => (
                  <tr key={index} className="border-b border-border/50">
                    <td className="py-4 px-6 text-foreground">{row.feature}</td>
                    <td className="py-4 px-6 text-center">
                      {row.codebakers === true ? (
                        <Tick02Icon className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">{row.codebakers}</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {row.others === false ? (
                        <Cancel01Icon className="h-5 w-5 text-red-500 dark:text-red-400 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground text-sm">{row.others}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center mt-12">
            <p className="text-lg text-muted-foreground mb-6">
              <span className="text-foreground font-medium">Bottom line:</span> CodeBakers makes Cursor and Claude Code the best they can be.
            </p>
            <Link href="/signup">
              <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/25">
                Upgrade Your AI Today
                <ArrowRight02Icon className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section id="modules" className="py-20 px-4 relative" style={{ background: 'var(--section-modules)' }}>

        <div className="container mx-auto relative z-10">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700">34 Modules</Badge>
            <h2 className="text-4xl font-bold text-foreground mb-4">
              {totalLines.toLocaleString()} lines of production&nbsp;patterns
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Smart module loading means AI only loads what&apos;s relevant. Ask for a login form and it loads auth + frontend patterns, not all {totalLines.toLocaleString()}&nbsp;lines.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <div
                  key={module.name}
                  className={`p-4 rounded-lg border transition-all hover:shadow-lg ${
                    module.required
                      ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 hover:border-red-400 dark:hover:border-red-700'
                      : 'bg-card border-border hover:border-red-500/50'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className={`h-5 w-5 ${module.required ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`} />
                    <span className="font-mono text-sm text-foreground">{module.name}</span>
                    {module.required && (
                      <Badge className="text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 ml-auto">
                        Always loaded
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{module.description}</p>
                  <p className="text-xs text-muted-foreground/70">{module.lines.toLocaleString()} lines</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Coverage Section */}
      <section className="py-20 px-4" style={{ background: 'var(--section-coverage)' }}>
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-secondary text-secondary-foreground border-border">Coverage</Badge>
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Complete product&nbsp;development
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Code, business, marketing, compliance — everything you need from discovery to&nbsp;launch.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {coverageAreas.map((area) => (
              <div key={area.category} className="p-6 rounded-xl bg-card border border-border hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-foreground mb-4">{area.category}</h3>
                <ul className="space-y-2">
                  {area.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-muted-foreground">
                      <Tick02Icon className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 relative" style={{ background: 'var(--section-pricing)' }}>
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto relative z-10">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700">Pricing</Badge>
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Less than a coffee a&nbsp;day
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Save 10+ hours per project. Pay less than your AI&nbsp;subscription.
            </p>
            <div className="flex flex-wrap justify-center items-center gap-4 mt-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <SecurityCheckIcon className="h-4 w-4 text-green-500" />
                <span>1 free project forever</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <div className="flex items-center gap-1">
                <Tick02Icon className="h-4 w-4 text-green-500" />
                <span>Cancel anytime</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <div className="flex items-center gap-1">
                <FlashIcon className="h-4 w-4 text-yellow-500" />
                <span>Instant access</span>
              </div>
            </div>
          </div>

          {/* Free Trial Banner */}
          <div className="max-w-2xl mx-auto mb-12 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
            <Badge className="bg-red-600 text-white border-red-500 mb-2">Try Free</Badge>
            <p className="text-foreground font-medium">
              Start with 1 free project — no credit card required
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              Upgrade anytime to unlock unlimited projects
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`p-6 rounded-xl border transition-all hover:shadow-xl ${
                  tier.popular
                    ? 'bg-red-50 dark:bg-red-950/30 border-red-400 dark:border-red-700 ring-2 ring-red-500 dark:ring-red-600 shadow-lg shadow-red-500/10'
                    : 'bg-card border-border'
                }`}
              >
                {tier.popular && (
                  <Badge className="mb-4 bg-red-600 text-white border-red-500">
                    Most Popular
                  </Badge>
                )}
                <h3 className="text-xl font-bold text-foreground mb-1">{tier.name}</h3>
                <p className="text-muted-foreground text-sm mb-4">{tier.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-foreground">${tier.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-foreground">
                      <Tick02Icon className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/signup">
                  <Button
                    className={`w-full ${
                      tier.popular
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/25'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {tier.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4" style={{ background: 'var(--section-faq)' }}>
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-secondary text-secondary-foreground border-border">FAQ</Badge>
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Frequently asked&nbsp;questions
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <details
                key={index}
                className="group p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
              >
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <span className="text-foreground font-medium pr-4">{faq.question}</span>
                  <ArrowDown01Icon className="h-5 w-5 text-muted-foreground group-open:rotate-180 transition-transform flex-shrink-0" />
                </summary>
                <p className="mt-4 text-muted-foreground leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 relative overflow-hidden" style={{ background: 'var(--section-cta)' }}>

        <div className="container mx-auto text-center relative z-10">
          {/* Featured quote */}
          <div className="mb-10 max-w-2xl mx-auto">
            <p className="text-2xl md:text-3xl font-medium text-foreground italic leading-relaxed">
              &quot;I used to spend weekends debugging AI output. Now I ship features while my competitors are still prompting.&quot;
            </p>
            <p className="text-muted-foreground mt-4">— Sarah Chen, Indie Hacker</p>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Your next project deserves better&nbsp;AI
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join 1,200+ developers who stopped fighting their tools and started&nbsp;shipping.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
            <Link href="/signup">
              <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white h-16 px-10 text-xl w-full sm:w-auto shadow-xl shadow-red-500/30 transition-all hover:shadow-2xl hover:shadow-red-500/40 hover:-translate-y-1">
                Start Building Now
                <ArrowRight02Icon className="ml-2 h-6 w-6" />
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <SecurityCheckIcon className="h-5 w-5 text-green-500" />
              <span>1 free project forever</span>
            </div>
            <div className="flex items-center gap-2">
              <FlashIcon className="h-5 w-5 text-yellow-500" />
              <span>Setup in 2 minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <CustomerService01Icon className="h-5 w-5 text-blue-500" />
              <span>Discord support included</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/50 mt-8">
            Works with Cursor, Claude Code, Windsurf, Aider & any AI IDE • {totalLines.toLocaleString()} lines of production patterns
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border" style={{ background: 'var(--section-footer)' }}>
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-muted-foreground text-sm">
              &copy; {new Date().getFullYear()} CodeBakers. All rights reserved.
            </div>
            <div className="flex gap-6">
              <Link href="/pricing" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                Pricing
              </Link>
              <Link href="/compare" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                Compare
              </Link>
              <Link href="/login" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                Login
              </Link>
              <Link href="/signup" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
