'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  Zap,
  Shield,
  TestTube2,
  Code2,
  ArrowRight,
  Sparkles,
  Clock,
  AlertCircle,
  RotateCcw,
  Layers,
  Terminal,
  Download,
  Cpu,
  ChevronDown,
  Star,
  Database,
  CreditCard,
  Lock,
  Webhook,
  Smartphone,
  Globe,
  BarChart3,
  Search,
  Mail,
  LineChart,
  FileText,
  Palette,
  Briefcase,
  Heart,
  Building2,
  Scale,
  Users,
  MessageSquare,
  Bot,
} from 'lucide-react';

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.4 },
};

// Data
const painPoints = [
  {
    icon: Clock,
    title: 'Hours of prompting',
    description: '"Add loading state... now handle errors... add validation..."',
  },
  {
    icon: AlertCircle,
    title: 'Missing edge cases',
    description: 'AI forgets error handling, security, accessibility every time.',
  },
  {
    icon: RotateCcw,
    title: 'Endless revisions',
    description: 'Round after round of "fix this, now fix that" loops.',
  },
  {
    icon: Layers,
    title: 'No consistency',
    description: 'Different patterns, different styles, spaghetti code.',
  },
];

const demoTabs = [
  {
    id: 'auth',
    label: 'Authentication',
    icon: Lock,
    code: `// Your prompt: "Add login form"

// CodeBakers generates:
export function LoginForm() {
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: () => router.push('/dashboard'),
    onError: (err) => toast.error(err.message),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(login.mutate)}>
        <FormField name="email" ... />
        <FormField name="password" ... />
        <Button loading={login.isPending}>
          Sign In
        </Button>
      </form>
    </Form>
  );
}`,
  },
  {
    id: 'payments',
    label: 'Stripe Payments',
    icon: CreditCard,
    code: `// Your prompt: "Add subscription checkout"

// CodeBakers generates:
export async function POST(req: Request) {
  const { priceId } = await req.json();
  const user = await getCurrentUser();

  const session = await stripe.checkout.sessions.create({
    customer: user.stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: \`\${APP_URL}/dashboard?success=1\`,
    cancel_url: \`\${APP_URL}/pricing\`,
    metadata: { userId: user.id },
  });

  return Response.json({ url: session.url });
}`,
  },
  {
    id: 'api',
    label: 'API Routes',
    icon: Webhook,
    code: `// Your prompt: "Create users API endpoint"

// CodeBakers generates:
export const GET = withAuth(async (req, { user }) => {
  const { page, limit } = paginationSchema.parse(
    Object.fromEntries(req.nextUrl.searchParams)
  );

  const users = await db.query.users.findMany({
    limit,
    offset: (page - 1) * limit,
    where: eq(users.teamId, user.teamId),
    orderBy: desc(users.createdAt),
  });

  return Response.json({
    success: true,
    data: users,
    meta: { page, limit },
  });
});`,
  },
];

const moduleCategories = [
  {
    name: 'Core Development',
    color: 'blue',
    modules: [
      { id: '00', name: 'Core Standards', lines: 2131 },
      { id: '01', name: 'Database', lines: 651 },
      { id: '02', name: 'Authentication', lines: 1239 },
      { id: '03', name: 'API Routes', lines: 1641 },
      { id: '04', name: 'Frontend', lines: 1772 },
      { id: '05', name: 'Payments', lines: 1571 },
      { id: '06', name: 'Integrations', lines: 3439 },
      { id: '07', name: 'Performance', lines: 709 },
      { id: '08', name: 'Testing', lines: 818 },
      { id: '09', name: 'Design', lines: 3205 },
      { id: '10', name: 'Generators', lines: 2920 },
      { id: '11', name: 'Realtime', lines: 1938 },
      { id: '12', name: 'SaaS', lines: 1265 },
      { id: '13', name: 'Mobile', lines: 1057 },
      { id: '14', name: 'AI Integration', lines: 888 },
    ],
  },
  {
    name: 'Business & Planning',
    color: 'purple',
    modules: [
      { id: '15', name: 'Research', lines: 517 },
      { id: '16', name: 'Planning', lines: 565 },
      { id: '17', name: 'Marketing', lines: 791 },
      { id: '18', name: 'Launch', lines: 691 },
      { id: '19', name: 'Audit', lines: 450 },
      { id: '20', name: 'Operations', lines: 1327 },
    ],
  },
  {
    name: 'Industry Experts',
    color: 'emerald',
    modules: [
      { id: '21', name: 'Core Experts', lines: 879 },
      { id: '22', name: 'Healthcare', lines: 778 },
      { id: '23', name: 'Finance', lines: 1090 },
      { id: '24', name: 'Legal', lines: 2508 },
      { id: '25', name: 'Industry', lines: 3529 },
    ],
  },
  {
    name: 'Extended Features',
    color: 'amber',
    modules: [
      { id: '26', name: 'Analytics', lines: 918 },
      { id: '27', name: 'Search', lines: 1130 },
      { id: '28', name: 'Email Design', lines: 796 },
      { id: '29', name: 'Data Viz', lines: 948 },
      { id: '30', name: 'Motion', lines: 877 },
      { id: '31', name: 'Icons', lines: 628 },
      { id: '32', name: 'Print/PDF', lines: 988 },
    ],
  },
];

const steps = [
  {
    step: 1,
    title: 'Install CLI',
    description: 'One command to set up CodeBakers in your project',
    code: 'npm install -g @codebakers/cli',
  },
  {
    step: 2,
    title: 'Authenticate',
    description: 'Login with your API key from the dashboard',
    code: 'codebakers login',
  },
  {
    step: 3,
    title: 'Download Patterns',
    description: 'Get all 33 modules synced to your project',
    code: 'codebakers install',
  },
];

const aiCompatibility = [
  { name: 'Claude', icon: Bot, supported: true },
  { name: 'Cursor', icon: Code2, supported: true },
  { name: 'GitHub Copilot', icon: Terminal, supported: true },
  { name: 'ChatGPT', icon: MessageSquare, supported: true },
  { name: 'Windsurf', icon: Globe, supported: true },
  { name: 'Aider', icon: Cpu, supported: true },
];

const industryExperts = [
  {
    icon: Heart,
    title: 'Healthcare & HIPAA',
    description: 'PHI handling, HIPAA compliance, secure patient data, audit trails',
    module: '22-experts-health.md',
  },
  {
    icon: Building2,
    title: 'Finance & PCI',
    description: 'PCI-DSS compliance, financial transactions, banking integrations',
    module: '23-experts-finance.md',
  },
  {
    icon: Scale,
    title: 'Legal & Contracts',
    description: 'Legal tech patterns, contract management, e-signatures, privacy',
    module: '24-experts-legal.md',
  },
];

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Senior Developer at TechCorp',
    avatar: 'SC',
    content: 'CodeBakers cut our development time by 60%. What used to take a week now takes two days.',
    rating: 5,
  },
  {
    name: 'Marcus Johnson',
    role: 'Founder, ShipFast.io',
    avatar: 'MJ',
    content: 'Finally, AI that writes production code. No more fixing auth bugs or missing error handling.',
    rating: 5,
  },
  {
    name: 'Elena Rodriguez',
    role: 'Tech Lead at FinanceApp',
    avatar: 'ER',
    content: 'The HIPAA and PCI modules alone saved us months of compliance work. Absolutely worth it.',
    rating: 5,
  },
];

const pricingPlans = [
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For individual developers',
    features: [
      'All 33 modules (44,000+ lines)',
      '1 API key',
      'Unlimited projects',
      'Pattern updates',
      'Community support',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Team',
    price: '$149',
    period: '/month',
    description: 'For development teams',
    features: [
      'Everything in Pro',
      '5 team seats',
      'Team API keys',
      'Priority support',
      'Private Slack channel',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Agency',
    price: '$349',
    period: '/month',
    description: 'For agencies & consultancies',
    features: [
      'Everything in Team',
      'Unlimited seats',
      'Client sub-accounts',
      'White-label options',
      'Dedicated support',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

const faqs = [
  {
    question: 'How does CodeBakers work?',
    answer: 'CodeBakers provides pattern files that your AI assistant (Claude, Cursor, Copilot) reads before generating code. These patterns contain production-ready templates, best practices, and complete implementations that guide the AI to write better code on the first try.',
  },
  {
    question: 'What AI tools does it work with?',
    answer: 'CodeBakers works with any AI coding assistant that can read project files. This includes Claude, Cursor, GitHub Copilot, ChatGPT, Windsurf, Aider, and more. The patterns are stored as markdown files in your project.',
  },
  {
    question: 'What tech stack is covered?',
    answer: 'The core patterns focus on Next.js, React, TypeScript, Drizzle ORM, Supabase, Stripe, Tailwind CSS, and related modern stack. Industry modules cover compliance (HIPAA, PCI) and business domains.',
  },
  {
    question: 'Can I customize the patterns?',
    answer: 'Yes! All patterns are plain markdown files in your project. You can modify them, add your own patterns, or request custom modules for your specific needs.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes, all plans include a 14-day free trial. No credit card required. Cancel anytime.',
  },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('auth');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const totalLines = moduleCategories.reduce(
    (acc, cat) => acc + cat.modules.reduce((sum, m) => sum + m.lines, 0),
    0
  );

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-4">
        {/* Animated gradient background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-60 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <motion.div
          className="container mx-auto text-center relative z-10"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          <motion.div variants={fadeInUp}>
            <Badge className="mb-6 bg-blue-900/50 text-blue-300 border-blue-700">
              <Sparkles className="h-3 w-3 mr-1" />
              33 Modules • {totalLines.toLocaleString()}+ Lines of Production Code
            </Badge>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight"
            variants={fadeInUp}
          >
            Stop fighting
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              AI revision loops
            </span>
          </motion.h1>

          <motion.p
            className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto"
            variants={fadeInUp}
          >
            CodeBakers gives your AI assistant {totalLines.toLocaleString()}+ lines of battle-tested
            patterns. Get production-ready code on your first prompt.
          </motion.p>

          <motion.div className="flex justify-center gap-4 mb-12" variants={fadeInUp}>
            <Link href="/signup">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 h-12 px-8">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="#demo">
              <Button
                size="lg"
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800 h-12 px-8"
              >
                See Demo
              </Button>
            </Link>
          </motion.div>

          {/* Stats bar */}
          <motion.div
            className="flex justify-center gap-8 md:gap-16 text-center"
            variants={fadeInUp}
          >
            <div>
              <div className="text-3xl font-bold text-white">33</div>
              <div className="text-sm text-slate-500">Modules</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">{(totalLines / 1000).toFixed(0)}K+</div>
              <div className="text-sm text-slate-500">Lines of Code</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">5x</div>
              <div className="text-sm text-slate-500">Faster Development</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">100%</div>
              <div className="text-sm text-slate-500">Production Ready</div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4 bg-slate-900/50">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-red-900/50 text-red-300 border-red-700">
              The Problem
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              AI coding is broken
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              You spend more time fixing AI output than writing code yourself.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
            {painPoints.map((point, i) => (
              <motion.div
                key={point.title}
                className="p-6 rounded-lg bg-red-950/20 border border-red-900/30"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <point.icon className="h-8 w-8 text-red-400 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">{point.title}</h3>
                <p className="text-slate-400 text-sm">{point.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-green-900/50 text-green-300 border-green-700">
              The Solution
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Production patterns for every feature
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              CodeBakers gives your AI the context it needs to write real code the first time.
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
            {[
              {
                icon: Zap,
                title: '5x Faster',
                description: 'Stop writing boilerplate. Get complete features instantly.',
              },
              {
                icon: Shield,
                title: 'Security Built-In',
                description: 'Auth, validation, XSS, CSRF - all handled correctly.',
              },
              {
                icon: TestTube2,
                title: 'Tests Included',
                description: 'Every pattern comes with Playwright test templates.',
              },
              {
                icon: Code2,
                title: 'Full Stack',
                description: '33 modules covering every aspect of modern apps.',
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                className="p-6 rounded-lg bg-green-950/20 border border-green-900/30"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <feature.icon className="h-8 w-8 text-green-400 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section id="demo" className="py-20 px-4 bg-slate-900/50">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-blue-900/50 text-blue-300 border-blue-700">
              Live Demo
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              See what CodeBakers generates
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              One prompt. Complete, production-ready code.
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            {/* Tabs */}
            <div className="flex gap-2 mb-6 justify-center">
              {demoTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Code display */}
            <motion.div
              className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/50 border-b border-slate-700">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-4 text-sm text-slate-500">
                  {demoTabs.find((t) => t.id === activeTab)?.label}.tsx
                </span>
              </div>
              <pre className="p-4 text-sm text-slate-300 font-mono overflow-x-auto">
                {demoTabs.find((t) => t.id === activeTab)?.code}
              </pre>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Get started in 60 seconds
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Three commands. That&apos;s all it takes.
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <motion.div
                key={step.step}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
              >
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white text-xl font-bold flex items-center justify-center mx-auto mb-4">
                  {step.step}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm mb-4">{step.description}</p>
                <code className="px-3 py-2 rounded bg-slate-800 text-green-400 text-sm font-mono">
                  {step.code}
                </code>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Module Showcase */}
      <section className="py-20 px-4 bg-slate-900/50">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              33 Production Modules
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Everything you need to build modern SaaS applications.
            </p>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-2 max-w-6xl mx-auto">
            {moduleCategories.map((category, catIndex) => (
              <motion.div
                key={category.name}
                className="rounded-lg bg-slate-800/50 border border-slate-700 overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: catIndex * 0.1 }}
              >
                <div
                  className={`px-4 py-3 bg-${category.color}-900/30 border-b border-${category.color}-700/30`}
                >
                  <h3 className={`font-semibold text-${category.color}-300`}>
                    {category.name}
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-3 gap-2">
                  {category.modules.map((module) => (
                    <div
                      key={module.id}
                      className="px-3 py-2 rounded bg-slate-900/50 border border-slate-700"
                    >
                      <div className="text-xs text-slate-500 mb-1">{module.id}</div>
                      <div className="text-sm text-white truncate">{module.name}</div>
                      <div className="text-xs text-slate-500">{module.lines} lines</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Compatibility */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Works with any AI coding assistant
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              CodeBakers patterns work with all major AI tools.
            </p>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-4 max-w-3xl mx-auto">
            {aiCompatibility.map((ai, i) => (
              <motion.div
                key={ai.name}
                className="flex items-center gap-3 px-6 py-4 rounded-lg bg-slate-800/50 border border-slate-700"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <ai.icon className="h-6 w-6 text-blue-400" />
                <span className="text-white font-medium">{ai.name}</span>
                <Check className="h-4 w-4 text-green-400" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Industry Experts */}
      <section className="py-20 px-4 bg-slate-900/50">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-emerald-900/50 text-emerald-300 border-emerald-700">
              Industry Modules
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Domain expertise built-in
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Specialized patterns for regulated industries and compliance requirements.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {industryExperts.map((expert, i) => (
              <motion.div
                key={expert.title}
                className="p-6 rounded-lg bg-emerald-950/20 border border-emerald-900/30"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <expert.icon className="h-10 w-10 text-emerald-400 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">{expert.title}</h3>
                <p className="text-slate-400 text-sm mb-3">{expert.description}</p>
                <code className="text-xs text-emerald-400">{expert.module}</code>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Loved by developers
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Join thousands of developers shipping faster with CodeBakers.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {testimonials.map((testimonial, i) => (
              <motion.div
                key={testimonial.name}
                className="p-6 rounded-lg bg-slate-800/50 border border-slate-700"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-300 mb-4">&ldquo;{testimonial.content}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-sm">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="text-white font-medium">{testimonial.name}</div>
                    <div className="text-sm text-slate-500">{testimonial.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 bg-slate-900/50">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              14-day free trial. No credit card required. Cancel anytime.
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {pricingPlans.map((plan, i) => (
              <motion.div
                key={plan.name}
                className={`rounded-lg p-6 ${
                  plan.popular
                    ? 'bg-blue-600/20 border-2 border-blue-500 relative'
                    : 'bg-slate-800/50 border border-slate-700'
                }`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white border-0">
                    Most Popular
                  </Badge>
                )}
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-slate-400">{plan.period}</span>
                </div>
                <p className="text-slate-400 text-sm mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-slate-300 text-sm">
                      <Check className="h-4 w-4 text-green-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/signup">
                  <Button
                    className={`w-full ${
                      plan.popular ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Frequently asked questions
            </h2>
          </motion.div>

          <div className="max-w-2xl mx-auto space-y-4">
            {faqs.map((faq, i) => (
              <motion.div
                key={faq.question}
                className="rounded-lg bg-slate-800/50 border border-slate-700 overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="font-medium text-white">{faq.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-slate-400 transition-transform ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-slate-400 text-sm">{faq.answer}</div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            className="rounded-2xl bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 border border-blue-500/30 p-12 text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to ship 5x faster?
            </h2>
            <p className="text-slate-300 mb-8 max-w-xl mx-auto">
              Join developers building production apps in days, not weeks.
              Start your 14-day free trial today.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 h-12 px-8">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 h-12 px-8"
                >
                  View Pricing
                </Button>
              </Link>
            </div>
            <p className="text-sm text-slate-500 mt-6">
              No credit card required. Cancel anytime.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
