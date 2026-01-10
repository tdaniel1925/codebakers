'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CODEBAKERS_STATS } from '@/lib/stats';
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
  LayoutGrid,
  MousePointer2,
  Workflow,
  Box,
  Keyboard,
  Mic,
  FileCode,
  GitBranch,
  Gauge,
  RefreshCw,
  Target,
  Puzzle,
  Lightbulb,
  Eye,
  Send,
  PanelLeft,
  LayoutTemplate,
  BookOpen,
  Blocks,
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

// Revolutionary features
const revolutionaryFeatures = [
  {
    icon: LayoutGrid,
    title: 'Visual Canvas Builder',
    description: 'See your entire app architecture as an interactive mind map. Drag, connect, and build visually.',
    highlight: true,
  },
  {
    icon: Wand2,
    title: 'AI That Follows Rules',
    description: '59 production modules force AI to use your patterns, not generic code. No more "fix this" loops.',
  },
  {
    icon: LayoutTemplate,
    title: 'One-Click Templates',
    description: 'Start with SaaS, dashboard, or landing page templates. Full architecture in seconds.',
  },
  {
    icon: Gauge,
    title: 'Real-Time Health',
    description: 'Architecture health indicators show issues before you build. Catch problems early.',
  },
];

const canvasModeFeatures = [
  {
    icon: Eye,
    title: 'See Everything',
    description: 'Pages, components, APIs, database - visualized as connected nodes you can click and explore.',
  },
  {
    icon: MousePointer2,
    title: 'Click to Build',
    description: 'Click any node to generate code. Click connections to understand data flow. Click "+" to add features.',
  },
  {
    icon: Workflow,
    title: 'Smart Connections',
    description: 'Bezier curves show relationships: pages to components, APIs to database, auth to everything.',
  },
  {
    icon: Keyboard,
    title: 'Developer Shortcuts',
    description: 'N for new node, E to edit, D to delete, T for templates. Vim users, rejoice.',
  },
];

const beforeAfterComparison = [
  {
    before: 'Type prompts in chat',
    after: 'Visual canvas with architecture',
    icon: LayoutGrid,
  },
  {
    before: 'Generic AI-generated code',
    after: '59 production pattern modules',
    icon: FileCode,
  },
  {
    before: 'Hope nothing breaks',
    after: 'Health indicators warn you first',
    icon: Gauge,
  },
  {
    before: 'Start from scratch every time',
    after: 'Templates gallery for instant start',
    icon: LayoutTemplate,
  },
  {
    before: 'Chat-only interface',
    after: '30/70 split: canvas + chat',
    icon: PanelLeft,
  },
  {
    before: 'Forget what you built',
    after: 'Visual map of entire architecture',
    icon: GitBranch,
  },
];

const workflowSteps = [
  {
    step: 1,
    title: 'Describe or Choose Template',
    description: 'Tell AI what you want or pick from SaaS, Dashboard, or Landing Page templates.',
    icon: Lightbulb,
    visual: '"Build a project management app with teams and tasks"',
  },
  {
    step: 2,
    title: 'See Architecture Instantly',
    description: 'Watch as nodes appear: pages, components, APIs, database tables - all connected.',
    icon: Eye,
    visual: '6 pages, 12 components, 8 API routes visualized',
  },
  {
    step: 3,
    title: 'Refine Visually',
    description: 'Click nodes to expand. Delete what you don\'t need. Add features with "+". Drag to reorganize.',
    icon: MousePointer2,
    visual: 'Click "Users Page" → Add "Invite Modal" component',
  },
  {
    step: 4,
    title: 'Generate Production Code',
    description: 'One click generates code using your patterns. Not generic AI slop - your standards.',
    icon: Code2,
    visual: 'Zod validation, error handling, tests - all included',
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

const testimonials = [
  {
    name: 'Jason Jennings',
    role: 'Senior Developer at TechCorp',
    avatar: 'JJ',
    content: 'Canvas Mode changed everything. I can finally SEE what I\'m building before the code exists. It\'s like having a technical architect and AI coder in one.',
    rating: 5,
  },
  {
    name: 'Melissa Starke',
    role: 'Founder, ShipFast.io',
    avatar: 'MS',
    content: 'I went from idea to deployed MVP in 3 hours. The templates gallery gave me a full SaaS architecture, I just customized the nodes and hit generate.',
    rating: 5,
  },
  {
    name: 'William Benoit',
    role: 'Tech Lead at FinanceApp',
    avatar: 'WB',
    content: 'The 59 modules mean AI finally writes code the way WE want. No more "add error handling" or "fix the auth". It\'s just... correct the first time.',
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
      'Visual Canvas Builder',
      'All 59 modules',
      'Templates gallery',
      'Unlimited projects',
      'Pattern updates',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Team',
    price: '$149',
    period: '/month',
    description: 'For development teams',
    features: [
      'Everything in Pro',
      '5 team seats',
      'Shared architectures',
      'Priority support',
      'Private Slack channel',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Enterprise',
    price: '$349',
    period: '/month',
    description: 'For agencies & enterprises',
    features: [
      'Everything in Team',
      'Unlimited seats',
      'Custom modules',
      'White-label options',
      'Dedicated support',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

const faqs = [
  {
    question: 'What is Canvas Mode and how is it different?',
    answer: 'Canvas Mode is a visual architecture builder where you see your entire app as an interactive mind map. Unlike chat-only AI tools, you can see pages, components, APIs, and database tables as connected nodes. Click any node to generate code, see relationships, or add new features. It\'s the difference between describing a house versus looking at blueprints.',
  },
  {
    question: 'How do the 59 modules improve AI code generation?',
    answer: 'Each module contains production-ready patterns for specific features (auth, payments, APIs, etc.). When you ask AI to generate code, it doesn\'t hallucinate - it follows YOUR patterns. The result: Zod validation, proper error handling, TypeScript types, and tests are included automatically because they\'re in your patterns.',
  },
  {
    question: 'What AI tools does CodeBakers work with?',
    answer: 'CodeBakers is a VS Code extension that works with your existing AI (Cursor, Claude Code, Copilot). We don\'t replace your AI - we make it dramatically better by giving it the context and patterns it needs to generate production-ready code.',
  },
  {
    question: 'What are the keyboard shortcuts?',
    answer: 'Canvas Mode is designed for developers: N = new node, E = edit selected, D = delete selected, T = open templates, Escape = close panels, Ctrl+Enter = send message. Full keyboard-driven workflow for power users.',
  },
  {
    question: 'How do templates work?',
    answer: 'Press T or click the Templates button to open the gallery. Choose from SaaS, Dashboard, or Landing Page templates. Each template creates a complete architecture with pre-connected nodes. Then customize: delete nodes you don\'t need, add ones you do.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes! Install the VS Code extension and sign in with GitHub for a 14-day free trial. No credit card required. You get full access to Canvas Mode, all 59 modules, and templates.',
  },
];

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const totalLines = moduleCategories.reduce(
    (acc, cat) => acc + cat.modules.reduce((sum, m) => sum + m.lines, 0),
    0
  );

  return (
    <div className="overflow-hidden">
      {/* Hero Section - Revolutionary Positioning */}
      <section className="relative pt-16 pb-20 px-4">
        {/* Animated gradient background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
          {/* Animated grid */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `linear-gradient(to right, #475569 1px, transparent 1px), linear-gradient(to bottom, #475569 1px, transparent 1px)`,
              backgroundSize: '60px 60px'
            }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
          {/* Animated orbs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <motion.div
          className="container mx-auto text-center relative z-10"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          <motion.div variants={fadeInUp}>
            <Badge className="mb-6 bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30">
              <Sparkles className="h-3 w-3 mr-1" />
              Introducing Canvas Mode - The Visual AI App Builder
            </Badge>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight tracking-tight"
            variants={fadeInUp}
          >
            The New Era of{' '}
            <span className="bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">
              AI App Building
            </span>
          </motion.h1>

          <motion.p
            className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed"
            variants={fadeInUp}
          >
            Stop typing prompts into a chat box. <strong className="text-white">See your entire app architecture</strong> as
            an interactive canvas. Click nodes to build. Watch AI follow <strong className="text-white">your patterns</strong>,
            not generic templates.
          </motion.p>

          <motion.div className="flex flex-col sm:flex-row justify-center gap-4 mb-12" variants={fadeInUp}>
            <Link href="/install">
              <Button size="lg" className="bg-red-600 hover:bg-red-700 h-14 px-10 text-lg shadow-lg shadow-red-600/30">
                Install CodeBakers
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button
                size="lg"
                variant="outline"
                className="border-slate-600 text-white hover:bg-slate-800 h-14 px-10 text-lg"
              >
                <Play className="mr-2 h-5 w-5" />
                See How It Works
              </Button>
            </Link>
          </motion.div>

          {/* Key stats */}
          <motion.div
            className="flex justify-center gap-8 md:gap-16 flex-wrap"
            variants={fadeInUp}
          >
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white">Visual</div>
              <div className="text-sm text-slate-400 mt-1">Canvas Builder</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white">59</div>
              <div className="text-sm text-slate-400 mt-1">Pattern Modules</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white">{(totalLines / 1000).toFixed(0)}K+</div>
              <div className="text-sm text-slate-400 mt-1">Lines of Code</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white">1-Click</div>
              <div className="text-sm text-slate-400 mt-1">Templates</div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Canvas Mode Hero Visual */}
      <section className="py-8 px-4 -mt-8 relative z-20">
        <div className="container mx-auto">
          <motion.div
            className="max-w-6xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Browser Frame */}
            <div className="relative group">
              {/* Glow Effect */}
              <div className="absolute -inset-2 bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 rounded-2xl blur-xl opacity-30 group-hover:opacity-40 transition-opacity duration-500" />

              {/* Browser Chrome */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 shadow-2xl shadow-black/50 border border-slate-700/50">
                {/* Browser Header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/80 border-b border-slate-700/50">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700/50 text-sm text-slate-400 flex items-center gap-2">
                      <Blocks className="w-4 h-4 text-red-500" />
                      CodeBakers - Canvas Mode
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700">v1.0.85</span>
                  </div>
                </div>

                {/* Canvas Mode Mockup */}
                <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
                  {/* Video or Static Visual */}
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
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
                    onEnded={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = 0;
                        setIsPlaying(false);
                      }
                    }}
                  >
                    <source src="/demo.mp4" type="video/mp4" />
                  </video>

                  {/* Overlay with play button */}
                  <div
                    className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                      isPlaying ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
                  >
                    <div className="absolute inset-0 bg-black/50" />

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
                      <div className="relative w-24 h-24 rounded-full bg-red-600 hover:bg-red-500 transition-colors flex items-center justify-center shadow-lg shadow-red-600/40">
                        <Play className="w-10 h-10 text-white ml-1" />
                      </div>
                    </button>

                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
                      <p className="text-white font-medium text-lg mb-2">
                        Watch Canvas Mode in Action
                      </p>
                      <p className="text-slate-400 text-sm">
                        See how visual architecture building changes everything
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating feature badges */}
              <motion.div
                className="absolute -right-4 top-1/4 hidden lg:block"
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
              >
                <div className="px-4 py-3 rounded-xl bg-white shadow-xl border border-gray-100 text-sm">
                  <div className="flex items-center gap-2 text-gray-900 font-medium">
                    <LayoutGrid className="w-4 h-4 text-red-500" />
                    Visual Architecture
                  </div>
                  <p className="text-xs text-gray-500 mt-1">See your entire app</p>
                </div>
              </motion.div>

              <motion.div
                className="absolute -left-4 top-1/3 hidden lg:block"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
              >
                <div className="px-4 py-3 rounded-xl bg-white shadow-xl border border-gray-100 text-sm">
                  <div className="flex items-center gap-2 text-gray-900 font-medium">
                    <Keyboard className="w-4 h-4 text-amber-500" />
                    Keyboard Shortcuts
                  </div>
                  <p className="text-xs text-gray-500 mt-1">N, E, D, T, Esc</p>
                </div>
              </motion.div>

              <motion.div
                className="absolute -right-2 bottom-1/3 hidden lg:block"
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 }}
              >
                <div className="px-4 py-3 rounded-xl bg-white shadow-xl border border-gray-100 text-sm">
                  <div className="flex items-center gap-2 text-gray-900 font-medium">
                    <Gauge className="w-4 h-4 text-green-500" />
                    Health Indicators
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Catch issues early</p>
                </div>
              </motion.div>

              <motion.div
                className="absolute -left-2 bottom-1/4 hidden lg:block"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.7 }}
              >
                <div className="px-4 py-3 rounded-xl bg-white shadow-xl border border-gray-100 text-sm">
                  <div className="flex items-center gap-2 text-gray-900 font-medium">
                    <LayoutTemplate className="w-4 h-4 text-purple-500" />
                    Templates Gallery
                  </div>
                  <p className="text-xs text-gray-500 mt-1">One-click scaffolds</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* The Problem with Current AI Tools */}
      <section className="py-20 px-4 bg-slate-50">
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
              Current AI tools are stuck in&nbsp;2023
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Chat boxes and generic prompts. You type, you hope, you fix. That&apos;s not how apps should be built.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
            {[
              {
                icon: MessageSquare,
                title: 'Chat-only interface',
                description: 'Typing prompts into a box and hoping for the best.',
              },
              {
                icon: RefreshCw,
                title: 'Endless revision loops',
                description: '"Add error handling... now validation... now loading states..."',
              },
              {
                icon: AlertCircle,
                title: 'Generic AI code',
                description: 'Every response is different. No consistency. No standards.',
              },
              {
                icon: Eye,
                title: 'Invisible architecture',
                description: 'No way to see what you\'re building until it\'s too late.',
              },
            ].map((point, i) => (
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

      {/* Revolutionary Solution */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-green-50 text-green-600 border-green-200">
              <Sparkles className="h-3 w-3 mr-1" />
              The Revolution
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              CodeBakers: Visual-first AI building
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              A complete paradigm shift. See your architecture. Click to build. AI follows YOUR patterns.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
            {revolutionaryFeatures.map((feature, i) => (
              <motion.div
                key={feature.title}
                className={`p-6 rounded-2xl border shadow-sm hover:shadow-md transition-all ${
                  feature.highlight
                    ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200 ring-2 ring-red-100'
                    : 'bg-white border-gray-100'
                }`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <feature.icon className={`h-10 w-10 mb-4 ${feature.highlight ? 'text-red-600' : 'text-green-500'}`} />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Before vs After Comparison */}
      <section className="py-20 px-4 bg-slate-900">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Before CodeBakers vs After
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              See the transformation in how AI-assisted development actually works.
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            <div className="grid gap-4">
              {beforeAfterComparison.map((item, i) => (
                <motion.div
                  key={i}
                  className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  {/* Before */}
                  <div className="px-5 py-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-right">
                    <span className="text-slate-400">{item.before}</span>
                  </div>

                  {/* Icon */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-red-600 to-orange-500 flex items-center justify-center shadow-lg shadow-red-600/20">
                    <item.icon className="w-5 h-5 text-white" />
                  </div>

                  {/* After */}
                  <div className="px-5 py-4 rounded-xl bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700/50">
                    <span className="text-green-400 font-medium">{item.after}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Visual Workflow */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-amber-50 text-amber-600 border-amber-200">
              <Workflow className="h-3 w-3 mr-1" />
              How It Works
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              From idea to production in 4 steps
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              The visual-first workflow that makes AI app building intuitive.
            </p>
          </motion.div>

          <div className="max-w-5xl mx-auto">
            {workflowSteps.map((step, i) => (
              <motion.div
                key={step.step}
                className={`flex items-start gap-8 mb-12 ${i % 2 === 1 ? 'flex-row-reverse' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                {/* Step number */}
                <div className="hidden md:flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 text-white text-2xl font-bold flex items-center justify-center shadow-lg shadow-red-600/20">
                    {step.step}
                  </div>
                  {i < workflowSteps.length - 1 && (
                    <div className="w-0.5 h-24 bg-gradient-to-b from-red-600/50 to-transparent mt-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <step.icon className="w-6 h-6 text-red-600" />
                    <h3 className="text-xl font-semibold text-gray-900">{step.title}</h3>
                  </div>
                  <p className="text-gray-500 mb-4">{step.description}</p>
                  <div className="px-4 py-3 rounded-lg bg-slate-900 text-sm font-mono text-green-400">
                    {step.visual}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Canvas Mode Features Deep Dive */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-red-50 text-red-600 border-red-200">
              <LayoutGrid className="h-3 w-3 mr-1" />
              Canvas Mode
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              The visual architecture builder
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Your entire app as an interactive canvas. Click, connect, and build.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
            {canvasModeFeatures.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Layout illustration */}
          <motion.div
            className="mt-16 max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="rounded-2xl bg-white border border-gray-200 shadow-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                <PanelLeft className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600 font-medium">30/70 Split Layout</span>
              </div>
              <div className="grid grid-cols-[30%,70%] h-64">
                {/* Chat Panel */}
                <div className="border-r border-gray-200 p-4 bg-gray-50">
                  <div className="text-xs text-gray-400 mb-3">CHAT PANEL</div>
                  <div className="space-y-2">
                    <div className="h-8 bg-gray-200 rounded-lg animate-pulse" />
                    <div className="h-8 bg-red-100 rounded-lg" />
                    <div className="h-20 bg-gray-200 rounded-lg animate-pulse" />
                  </div>
                </div>
                {/* Canvas */}
                <div className="p-4 relative">
                  <div className="text-xs text-gray-400 mb-3">VISUAL CANVAS</div>
                  <div className="absolute inset-4 top-10">
                    {/* Node mockups */}
                    <div className="absolute top-4 left-8 px-3 py-2 rounded-lg bg-blue-100 border border-blue-200 text-xs text-blue-700">
                      Pages
                    </div>
                    <div className="absolute top-4 right-8 px-3 py-2 rounded-lg bg-green-100 border border-green-200 text-xs text-green-700">
                      Components
                    </div>
                    <div className="absolute bottom-4 left-1/4 px-3 py-2 rounded-lg bg-purple-100 border border-purple-200 text-xs text-purple-700">
                      API Routes
                    </div>
                    <div className="absolute bottom-4 right-1/4 px-3 py-2 rounded-lg bg-amber-100 border border-amber-200 text-xs text-amber-700">
                      Database
                    </div>
                    {/* Connection lines (simplified) */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.3 }}>
                      <path d="M 80 40 Q 150 80 220 40" stroke="#6B7280" strokeWidth="2" fill="none" strokeDasharray="4" />
                      <path d="M 80 40 Q 80 100 100 140" stroke="#6B7280" strokeWidth="2" fill="none" strokeDasharray="4" />
                      <path d="M 220 40 Q 220 100 200 140" stroke="#6B7280" strokeWidth="2" fill="none" strokeDasharray="4" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 59 Modules Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-purple-50 text-purple-600 border-purple-200">
              <BookOpen className="h-3 w-3 mr-1" />
              {CODEBAKERS_STATS.moduleCount} Production Modules
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              AI that follows YOUR patterns
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              {totalLines.toLocaleString()}+ lines of battle-tested code. When AI generates, it uses these patterns - not generic templates.
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

      {/* Testimonials */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Developers love the revolution
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Join thousands who&apos;ve upgraded from chat-only AI to visual building.
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
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Simple pricing for every team
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              14-day free trial. No credit card required. Full access to Canvas Mode.
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
                <Link href="/install">
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
      <section className="py-20 px-4 bg-slate-50">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Frequently asked questions
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
            className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-12 md:p-16 text-center relative overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 left-1/4 w-64 h-64 bg-red-600/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10">
              <Badge className="mb-6 bg-red-500/20 text-red-400 border-red-500/30">
                <Sparkles className="h-3 w-3 mr-1" />
                Join the Revolution
              </Badge>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
                Ready to see your apps before you build them?
              </h2>
              <p className="text-slate-300 mb-8 max-w-xl mx-auto text-lg">
                Canvas Mode. 59 modules. Visual architecture building.
                Start your 14-day free trial and experience the future of AI app development.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link href="/install">
                  <Button size="lg" className="bg-red-600 hover:bg-red-700 h-14 px-10 text-lg shadow-lg shadow-red-600/30">
                    Install CodeBakers
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-slate-600 text-white hover:bg-slate-800 h-14 px-10 text-lg"
                  >
                    View Pricing
                  </Button>
                </Link>
              </div>
              <p className="text-sm text-slate-500 mt-6">
                14-day free trial. CLI or VS Code extension - your choice.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
