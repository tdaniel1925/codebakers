'use client';

import { useState, useRef } from 'react';
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
  Cpu,
  ChevronDown,
  Star,
  CreditCard,
  Lock,
  Webhook,
  Globe,
  Heart,
  Building2,
  Scale,
  MessageSquare,
  Bot,
  Wand2,
  Play,
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

const promptOptimizerSteps = [
  {
    step: 1,
    label: 'You type',
    example: '"Add login form"',
    color: 'text-gray-500',
  },
  {
    step: 2,
    label: 'AI optimizes',
    example: 'Adds 15+ production requirements automatically',
    color: 'text-amber-500',
  },
  {
    step: 3,
    label: 'You get',
    example: 'Complete auth with validation, errors, tests, a11y',
    color: 'text-green-500',
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
    modules: [
      { id: '26', name: 'Analytics', lines: 918 },
      { id: '27', name: 'Search', lines: 1130 },
      { id: '28', name: 'Email Design', lines: 796 },
      { id: '29', name: 'Data Viz', lines: 948 },
      { id: '30', name: 'Motion', lines: 877 },
      { id: '31', name: 'Icons', lines: 628 },
      { id: '32', name: 'Print/PDF', lines: 988 },
      { id: '33', name: 'CI/CD', lines: 820 },
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
    description: 'Get all 34 modules synced to your project',
    code: 'codebakers install',
  },
];

const aiCompatibility = [
  { name: 'Cursor', icon: Code2, supported: true },
  { name: 'Claude Code', icon: Bot, supported: true },
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
    name: 'Jason Jennings',
    role: 'Senior Developer at TechCorp',
    avatar: 'JJ',
    content: 'CodeBakers cut our development time by 60%. What used to take a week now takes two days.',
    rating: 5,
  },
  {
    name: 'Melissa Starke',
    role: 'Founder, ShipFast.io',
    avatar: 'MS',
    content: 'Finally, AI that writes production code. No more fixing auth bugs or missing error handling.',
    rating: 5,
  },
  {
    name: 'William Benoit',
    role: 'Tech Lead at FinanceApp',
    avatar: 'WB',
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
      'All 34 modules',
      '1 API key',
      'Unlimited projects',
      'Pattern updates',
      'Community support',
    ],
    cta: 'Get Started',
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
    cta: 'Get Started',
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
    question: 'What is the Smart Prompt Optimizer?',
    answer: 'The Prompt Optimizer automatically expands your simple requests into comprehensive, production-ready prompts. When you type "add login form", it becomes a detailed prompt including validation, error handling, loading states, accessibility, and tests—all tailored to your specific project\'s components and patterns.',
  },
  {
    question: 'What AI tools does it work with?',
    answer: 'CodeBakers works with Cursor IDE and Claude Code CLI via MCP (Model Context Protocol) for secure, on-demand pattern access. No files stored locally—patterns are fetched when needed.',
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
    question: 'Is there a free tier?',
    answer: 'Yes! You get one free project with unlimited time. No credit card required. Upgrade anytime for more projects and features.',
  },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('auth');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const totalLines = moduleCategories.reduce(
    (acc, cat) => acc + cat.modules.reduce((sum, m) => sum + m.lines, 0),
    0
  );

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-20 pb-24 px-4">
        {/* Grid Background Pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)`,
              backgroundSize: '80px 80px'
            }}
          />
          {/* Fade overlay for edges */}
          <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white" />
        </div>
        <motion.div
          className="container mx-auto text-center relative z-10"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          <motion.div variants={fadeInUp}>
            <Badge className="mb-6 bg-red-50 text-red-600 border-red-200 hover:bg-red-100">
              <Sparkles className="h-3 w-3 mr-1" />
              34 Modules • {totalLines.toLocaleString()}+ Lines of Production Code
            </Badge>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight tracking-tight"
            variants={fadeInUp}
          >
            Stop fighting{' '}
            <span className="text-red-600 whitespace-nowrap">
              AI revision loops
            </span>
          </motion.h1>

          <motion.p
            className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed"
            variants={fadeInUp}
          >
            CodeBakers gives your AI assistant {totalLines.toLocaleString()}+ lines of battle-tested
            patterns. Get production-ready code on your first prompt.
          </motion.p>

          <motion.div className="flex justify-center gap-4 mb-16" variants={fadeInUp}>
            <Link href="/signup">
              <Button size="lg" className="bg-red-600 hover:bg-red-700 h-14 px-10 text-lg shadow-lg shadow-red-600/20">
                Start Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#demo">
              <Button
                size="lg"
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50 h-14 px-10 text-lg"
              >
                See Demo
              </Button>
            </Link>
          </motion.div>

          {/* Stats bar */}
          <motion.div
            className="flex justify-center gap-12 md:gap-20"
            variants={fadeInUp}
          >
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900">34</div>
              <div className="text-sm text-gray-500 mt-1">Modules</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900">{(totalLines / 1000).toFixed(0)}K+</div>
              <div className="text-sm text-gray-500 mt-1">Lines of Code</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900">5x</div>
              <div className="text-sm text-gray-500 mt-1">Faster Development</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900">100%</div>
              <div className="text-sm text-gray-500 mt-1">Production Ready</div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Video Demo Section */}
      <section className="py-16 px-4 -mt-8 relative z-20">
        <div className="container mx-auto">
          <motion.div
            className="max-w-5xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Browser Frame */}
            <div className="relative group">
              {/* Glow Effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-red-600 via-red-500 to-orange-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500" />

              {/* Browser Chrome */}
              <div className="relative rounded-2xl overflow-hidden bg-gray-900 shadow-2xl shadow-black/40 border border-gray-800">
                {/* Browser Header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/80 border-b border-gray-700/50">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1.5 rounded-lg bg-gray-900/60 border border-gray-700/50 text-sm text-gray-400 flex items-center gap-2">
                      <Lock className="w-3 h-3" />
                      codebakers.dev
                    </div>
                  </div>
                  <div className="w-16" />
                </div>

                {/* Video Container */}
                <div className="relative aspect-video bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
                  {/* Video element */}
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    loop
                    onClick={() => {
                      if (videoRef.current) {
                        if (isPlaying) {
                          videoRef.current.pause();
                        } else {
                          videoRef.current.play();
                        }
                        setIsPlaying(!isPlaying);
                      }
                    }}
                  >
                    <source src="/demo.mp4" type="video/mp4" />
                  </video>

                  {/* Overlay with play button (shows when paused) */}
                  <div
                    className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                      isPlaying ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
                  >
                    {/* Dark overlay */}
                    <div className="absolute inset-0 bg-black/40" />

                    {/* Play Button */}
                    <button
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.play();
                          setIsPlaying(true);
                        }
                      }}
                      className="relative z-10 group/play"
                    >
                      <div className="absolute inset-0 bg-red-600 rounded-full blur-xl opacity-40 group-hover/play:opacity-60 transition-opacity" />
                      <div className="relative w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 transition-colors flex items-center justify-center shadow-lg shadow-red-600/30">
                        <Play className="w-8 h-8 text-white ml-1" />
                      </div>
                    </button>

                    {/* Caption */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
                      <p className="text-white/80 text-sm font-medium">
                        Watch how CodeBakers transforms your AI workflow
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <motion.div
                className="absolute -right-4 top-1/4 hidden lg:block"
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
              >
                <div className="px-4 py-2 rounded-lg bg-white shadow-lg border border-gray-100 text-sm font-medium text-gray-700">
                  <span className="text-green-500 mr-1">✓</span> No revisions needed
                </div>
              </motion.div>

              <motion.div
                className="absolute -left-4 top-1/2 hidden lg:block"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
              >
                <div className="px-4 py-2 rounded-lg bg-white shadow-lg border border-gray-100 text-sm font-medium text-gray-700">
                  <span className="text-red-500 mr-1">⚡</span> Production-ready
                </div>
              </motion.div>

              <motion.div
                className="absolute -right-2 bottom-1/4 hidden lg:block"
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 }}
              >
                <div className="px-4 py-2 rounded-lg bg-white shadow-lg border border-gray-100 text-sm font-medium text-gray-700">
                  <span className="text-amber-500 mr-1">🔥</span> Ships in minutes
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-red-50 text-red-600 border-red-200">
              The Problem
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              AI coding is&nbsp;broken
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              You spend more time fixing AI output than writing code&nbsp;yourself.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
            {painPoints.map((point, i) => (
              <motion.div
                key={point.title}
                className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <point.icon className="h-10 w-10 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{point.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{point.description}</p>
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
            <Badge className="mb-4 bg-green-50 text-green-600 border-green-200">
              The Solution
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Production patterns for every&nbsp;feature
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              CodeBakers gives your AI the context it needs to write real code the first&nbsp;time.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
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
                description: '34 modules covering every aspect of modern apps.',
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <feature.icon className="h-10 w-10 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Prompt Optimizer Section */}
      <section id="smart-prompts" className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-amber-50 text-amber-600 border-amber-200">
              <Wand2 className="h-3 w-3 mr-1" />
              Smart Prompts
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              AI-powered prompt&nbsp;optimization
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Type a simple request. CodeBakers automatically expands it into a production-ready prompt with all requirements&nbsp;included.
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            {/* Before/After comparison */}
            <motion.div
              className="grid md:grid-cols-2 gap-6 mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              {/* Before */}
              <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  <span className="text-sm font-medium text-gray-500">What you type</span>
                </div>
                <p className="text-lg text-gray-700 font-mono">&ldquo;Add login form&rdquo;</p>
              </div>

              {/* After */}
              <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Wand2 className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-600">What AI receives</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Build a complete login form with <strong>React Hook Form + Zod validation</strong>, loading state on submit, inline error messages, toast notifications for failures, forgot password link, <strong>accessibility with ARIA labels</strong>, keyboard navigation, and <strong>Playwright tests</strong> for happy path and error states...
                </p>
              </div>
            </motion.div>

            {/* How it works steps */}
            <motion.div
              className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              {promptOptimizerSteps.map((item, i) => (
                <div key={item.step} className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      i === 0 ? 'bg-gray-400' : i === 1 ? 'bg-amber-500' : 'bg-green-500'
                    }`}>
                      {item.step}
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wide">{item.label}</div>
                      <div className={`text-sm font-medium ${item.color}`}>{item.example}</div>
                    </div>
                  </div>
                  {i < promptOptimizerSteps.length - 1 && (
                    <ArrowRight className="hidden md:block h-5 w-5 text-gray-300" />
                  )}
                </div>
              ))}
            </motion.div>

            {/* Context-aware callout */}
            <motion.div
              className="mt-10 rounded-xl bg-gray-900 p-6 text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <span className="text-white font-semibold">Context-Aware</span>
              </div>
              <p className="text-gray-400 text-sm max-w-xl mx-auto">
                The optimizer knows your project structure—existing components, services, API routes, and database schema. Prompts are tailored to <em>your</em> codebase.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section id="demo" className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-red-50 text-red-600 border-red-200">
              Live Demo
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              See what CodeBakers&nbsp;generates
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              One prompt. Complete, production-ready&nbsp;code.
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            {/* Tabs */}
            <div className="flex gap-2 mb-6 justify-center">
              {demoTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all font-medium text-sm ${
                    activeTab === tab.id
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Code display */}
            <motion.div
              className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden shadow-2xl"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-4 text-sm text-gray-400">
                  {demoTabs.find((t) => t.id === activeTab)?.label}.tsx
                </span>
              </div>
              <pre className="p-6 text-sm text-gray-300 font-mono overflow-x-auto leading-relaxed">
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
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Get started in 60&nbsp;seconds
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Three commands. That&apos;s all it&nbsp;takes.
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
                <div className="w-14 h-14 rounded-full bg-red-600 text-white text-xl font-bold flex items-center justify-center mx-auto mb-5 shadow-lg shadow-red-600/20">
                  {step.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm mb-4">{step.description}</p>
                <code className="px-4 py-2.5 rounded-lg bg-gray-900 text-green-400 text-sm font-mono inline-block">
                  {step.code}
                </code>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Module Showcase */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              34 Production&nbsp;Modules
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Everything you need to build modern SaaS&nbsp;applications.
            </p>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-2 max-w-6xl mx-auto">
            {moduleCategories.map((category, catIndex) => (
              <motion.div
                key={category.name}
                className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: catIndex * 0.1 }}
              >
                <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">
                    {category.name}
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-3 gap-2">
                  {category.modules.map((module) => (
                    <div
                      key={module.id}
                      className="px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="text-xs text-gray-400 mb-0.5">{module.id}</div>
                      <div className="text-sm text-gray-900 font-medium truncate">{module.name}</div>
                      <div className="text-xs text-gray-400">{module.lines} lines</div>
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
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Works with any AI coding&nbsp;assistant
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              CodeBakers patterns work with all major AI&nbsp;tools.
            </p>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-4 max-w-3xl mx-auto">
            {aiCompatibility.map((ai, i) => (
              <motion.div
                key={ai.name}
                className="flex items-center gap-3 px-6 py-4 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <ai.icon className="h-6 w-6 text-red-500" />
                <span className="text-gray-900 font-medium">{ai.name}</span>
                <Check className="h-5 w-5 text-green-500" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Industry Experts */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-emerald-50 text-emerald-600 border-emerald-200">
              Industry Modules
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Domain expertise&nbsp;built-in
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Specialized patterns for regulated industries and compliance&nbsp;requirements.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {industryExperts.map((expert, i) => (
              <motion.div
                key={expert.title}
                className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <expert.icon className="h-12 w-12 text-emerald-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{expert.title}</h3>
                <p className="text-gray-500 text-sm mb-3 leading-relaxed">{expert.description}</p>
                <code className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{expert.module}</code>
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
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Loved by&nbsp;developers
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Join thousands of developers shipping faster with&nbsp;CodeBakers.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {testimonials.map((testimonial, i) => (
              <motion.div
                key={testimonial.name}
                className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <Star key={j} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-5 leading-relaxed">&ldquo;{testimonial.content}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-red-600 flex items-center justify-center text-white font-semibold text-sm">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="text-gray-900 font-medium">{testimonial.name}</div>
                    <div className="text-sm text-gray-500">{testimonial.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Simple, transparent&nbsp;pricing
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              One free project, forever. No credit card&nbsp;required.
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {pricingPlans.map((plan, i) => (
              <motion.div
                key={plan.name}
                className={`rounded-2xl p-8 ${
                  plan.popular
                    ? 'bg-white ring-2 ring-red-600 shadow-xl relative'
                    : 'bg-white border border-gray-200 shadow-sm'
                }`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white border-0 px-4">
                    Most Popular
                  </Badge>
                )}
                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
                <p className="text-gray-500 text-sm mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-gray-700 text-sm">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/signup">
                  <Button
                    className={`w-full h-12 ${
                      plan.popular
                        ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20'
                        : 'bg-gray-900 hover:bg-gray-800'
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
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Frequently asked&nbsp;questions
            </h2>
          </motion.div>

          <div className="max-w-2xl mx-auto space-y-3">
            {faqs.map((faq, i) => (
              <motion.div
                key={faq.question}
                className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-medium text-gray-900">{faq.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-400 transition-transform ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-gray-500 text-sm leading-relaxed">{faq.answer}</div>
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
            className="rounded-3xl bg-gray-900 p-12 md:p-16 text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to ship 5x&nbsp;faster?
            </h2>
            <p className="text-gray-300 mb-8 max-w-xl mx-auto text-lg">
              Join developers building production apps in days, not&nbsp;weeks.
              Start with one free project,&nbsp;forever.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="bg-red-600 hover:bg-red-700 h-14 px-10 text-lg shadow-lg">
                  Start Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-gray-600 text-white hover:bg-gray-800 h-14 px-10 text-lg"
                >
                  View Pricing
                </Button>
              </Link>
            </div>
            <p className="text-sm text-gray-500 mt-6">
              No credit card required. One free project, forever.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
