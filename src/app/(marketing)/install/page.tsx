'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Terminal,
  Puzzle,
  CheckCircle,
  Copy,
  Check,
  ArrowRight,
  Zap,
  Shield,
  Clock,
  Download,
  ExternalLink,
  Github,
  Monitor,
  Command,
  Sparkles,
} from 'lucide-react';

export default function InstallPage() {
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedInit, setCopiedInit] = useState(false);
  const [activeTab, setActiveTab] = useState<'cli' | 'extension'>('cli');

  const copyToClipboard = (text: string, type: 'cli' | 'init') => {
    navigator.clipboard.writeText(text);
    if (type === 'cli') {
      setCopiedCli(true);
      setTimeout(() => setCopiedCli(false), 2000);
    } else {
      setCopiedInit(true);
      setTimeout(() => setCopiedInit(false), 2000);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 px-4 bg-gradient-to-b from-slate-900 to-slate-800">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto max-w-4xl text-center relative z-10">
          <Badge className="mb-6 bg-red-500/20 text-red-400 border-red-500/30">
            <Sparkles className="h-3 w-3 mr-1" />
            Get Started in 60 Seconds
          </Badge>

          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Install{' '}
            <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              CodeBakers
            </span>
          </h1>

          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Works with <strong className="text-white">Claude Code</strong>,{' '}
            <strong className="text-white">Cursor</strong>, and any AI coding tool.
            Choose your preferred installation method.
          </p>

          {/* Quick Stats */}
          <div className="flex justify-center gap-8 mb-12">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">59</div>
              <div className="text-sm text-slate-400">Pattern Modules</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">40K+</div>
              <div className="text-sm text-slate-400">Lines of Code</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">14 Days</div>
              <div className="text-sm text-slate-400">Free Trial</div>
            </div>
          </div>
        </div>
      </section>

      {/* Installation Options */}
      <section className="py-16 px-4 -mt-8">
        <div className="container mx-auto max-w-5xl">
          {/* Tab Selector */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                onClick={() => setActiveTab('cli')}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                  activeTab === 'cli'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Terminal className="h-5 w-5" />
                CLI (Recommended)
              </button>
              <button
                onClick={() => setActiveTab('extension')}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                  activeTab === 'extension'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Puzzle className="h-5 w-5" />
                VS Code Extension
              </button>
            </div>
          </div>

          {/* CLI Installation */}
          {activeTab === 'cli' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid lg:grid-cols-2 gap-8"
            >
              {/* Left: Steps */}
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                      Install the CLI
                    </h3>
                    <p className="text-slate-600 mb-3">
                      Run this command in your terminal to install CodeBakers globally.
                    </p>
                    <div className="relative">
                      <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-green-400 pr-12">
                        npm install -g @codebakers/cli
                      </div>
                      <button
                        onClick={() => copyToClipboard('npm install -g @codebakers/cli', 'cli')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-800 rounded-md transition-colors"
                      >
                        {copiedCli ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                      Initialize in Your Project
                    </h3>
                    <p className="text-slate-600 mb-3">
                      Navigate to your project folder and run:
                    </p>
                    <div className="relative">
                      <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-green-400 pr-12">
                        codebakers go
                      </div>
                      <button
                        onClick={() => copyToClipboard('codebakers go', 'init')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-800 rounded-md transition-colors"
                      >
                        {copiedInit ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                      Start Building!
                    </h3>
                    <p className="text-slate-600">
                      That&apos;s it! CodeBakers creates <code className="bg-slate-100 px-2 py-0.5 rounded">CLAUDE.md</code> and{' '}
                      <code className="bg-slate-100 px-2 py-0.5 rounded">.cursorrules</code> in your project.
                      Your AI will now follow production patterns.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Info Card */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-8 border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center">
                    <Terminal className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">CLI Method</h3>
                    <p className="text-sm text-slate-500">Best for Claude Code & terminal users</p>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {[
                    'Works with Claude Code in VS Code',
                    'Works with Cursor AI',
                    'Works with any AI that reads project files',
                    'Creates both CLAUDE.md and .cursorrules',
                    'MCP server for advanced features',
                    '14-day free trial, no credit card',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-700">
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-500 mb-2">Other CLI commands:</p>
                  <div className="space-y-1 font-mono text-xs text-slate-600">
                    <div><span className="text-red-600">codebakers doctor</span> - Check installation</div>
                    <div><span className="text-red-600">codebakers upgrade</span> - Update patterns</div>
                    <div><span className="text-red-600">codebakers serve</span> - Start MCP server</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* VS Code Extension Installation */}
          {activeTab === 'extension' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid lg:grid-cols-2 gap-8"
            >
              {/* Left: Steps */}
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                      Install from VS Code Marketplace
                    </h3>
                    <p className="text-slate-600 mb-3">
                      Search for &quot;CodeBakers&quot; in VS Code Extensions, or click the button below:
                    </p>
                    <Link
                      href="https://marketplace.visualstudio.com/items?itemName=codebakers.codebakers"
                      target="_blank"
                    >
                      <Button className="bg-[#007ACC] hover:bg-[#006BB3] gap-2">
                        <Monitor className="h-4 w-4" />
                        Open in VS Code Marketplace
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                      Initialize Patterns
                    </h3>
                    <p className="text-slate-600 mb-3">
                      Open Command Palette (<code className="bg-slate-100 px-2 py-0.5 rounded">Ctrl+Shift+P</code>) and run:
                    </p>
                    <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-green-400">
                      CodeBakers: Initialize Patterns
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                      Start Building!
                    </h3>
                    <p className="text-slate-600">
                      The extension creates <code className="bg-slate-100 px-2 py-0.5 rounded">CLAUDE.md</code> and syncs to{' '}
                      <code className="bg-slate-100 px-2 py-0.5 rounded">.cursorrules</code>.
                      Check the status bar for pattern health.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Info Card */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-8 border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-[#007ACC] flex items-center justify-center">
                    <Puzzle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">VS Code Extension</h3>
                    <p className="text-sm text-slate-500">Best for visual pattern management</p>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {[
                    'One-click pattern initialization',
                    'Status bar shows pattern health',
                    'Auto-syncs CLAUDE.md and .cursorrules',
                    'Works with Claude Code extension',
                    'Works with Cursor AI',
                    'Pattern warnings and quick fixes',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-700">
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-500 mb-2">Extension commands:</p>
                  <div className="space-y-1 text-xs text-slate-600">
                    <div><span className="text-red-600">Initialize Patterns</span> - Set up project</div>
                    <div><span className="text-red-600">Sync Patterns</span> - Sync CLAUDE.md to .cursorrules</div>
                    <div><span className="text-red-600">Show Warnings</span> - View pattern health issues</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* How It Works with Your AI */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-amber-50 text-amber-600 border-amber-200">
              How It Works
            </Badge>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Works with Your Existing AI Tools
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              CodeBakers doesn&apos;t replace your AI - it makes it smarter by giving it
              production patterns to follow.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Terminal className="h-8 w-8" />,
                name: 'Claude Code',
                description: 'Reads CLAUDE.md automatically. Full MCP integration for advanced features.',
                how: 'Just open your project - Claude Code reads CLAUDE.md and follows the patterns.',
                color: 'bg-orange-500',
              },
              {
                icon: <Command className="h-8 w-8" />,
                name: 'Cursor',
                description: 'Reads .cursorrules for project context. AI follows your coding standards.',
                how: 'CodeBakers syncs patterns to .cursorrules so Cursor follows them.',
                color: 'bg-purple-500',
              },
              {
                icon: <Github className="h-8 w-8" />,
                name: 'GitHub Copilot',
                description: 'Include CLAUDE.md in context for better suggestions.',
                how: 'Reference @CLAUDE.md in your prompts for pattern-aware completions.',
                color: 'bg-slate-800',
              },
            ].map((tool, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`w-14 h-14 rounded-xl ${tool.color} flex items-center justify-center text-white mb-4`}>
                  {tool.icon}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{tool.name}</h3>
                <p className="text-slate-600 text-sm mb-4">{tool.description}</p>
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500">{tool.how}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              What You Get
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              59 production modules covering everything from auth to payments to testing.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: 'Authentication', desc: 'Login, OAuth, 2FA, sessions' },
              { icon: Zap, title: 'API Routes', desc: 'Validation, error handling, rate limits' },
              { icon: Clock, title: 'Database', desc: 'Drizzle, migrations, queries' },
              { icon: Download, title: 'Payments', desc: 'Stripe, subscriptions, webhooks' },
            ].map((item, i) => (
              <div key={i} className="text-center p-6 rounded-xl bg-slate-50 border border-slate-100">
                <item.icon className="h-8 w-8 text-red-600 mx-auto mb-3" />
                <h3 className="font-semibold text-slate-900 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/#modules">
              <Button variant="outline" className="gap-2">
                See All 59 Modules
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 left-1/4 w-64 h-64 bg-red-600/20 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Ship Production-Ready Code?
              </h2>
              <p className="text-slate-300 mb-8">
                14-day free trial. No credit card required.
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText('npm install -g @codebakers/cli && codebakers go');
                  }}
                  className="bg-red-600 hover:bg-red-700 gap-2"
                >
                  <Terminal className="h-4 w-4" />
                  Copy Install Command
                </Button>
                <Link
                  href="https://marketplace.visualstudio.com/items?itemName=codebakers.codebakers"
                  target="_blank"
                >
                  <Button variant="outline" className="border-slate-600 text-white hover:bg-slate-800 gap-2">
                    <Puzzle className="h-4 w-4" />
                    Get VS Code Extension
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
