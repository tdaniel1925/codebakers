'use client';

import Link from 'next/link';
import { Code2, CheckCircle2, Sparkles, Infinity, Clock, Gift } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Free Project CTA */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-black via-neutral-950 to-red-950/30 p-12 flex-col justify-center relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23dc2626' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Floating elements */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-red-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-32 left-10 w-40 h-40 bg-red-500/5 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-lg mx-auto text-center">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-3 mb-12 group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-600/25">
              <Code2 className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white group-hover:text-red-400 transition-colors">
              CodeBakers
            </span>
          </Link>

          {/* Free Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600/20 border border-red-500/30 mb-8">
            <Gift className="w-5 h-5 text-red-400" />
            <span className="text-red-300 font-semibold">100% Free to Start</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
            Build Your First Project
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600 mt-2">
              Completely Free
            </span>
          </h1>

          {/* Description */}
          <p className="text-xl text-neutral-300 mb-10 leading-relaxed">
            Use CodeBakers on one complete project with <strong className="text-white">unlimited access</strong> for <strong className="text-white">as long as you need</strong>. No time limits. No credit card required.
          </p>

          {/* Benefits */}
          <div className="space-y-4 text-left max-w-sm mx-auto mb-10">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <div className="w-12 h-12 rounded-lg bg-red-600/20 flex items-center justify-center flex-shrink-0">
                <Infinity className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Unlimited Downloads</h3>
                <p className="text-sm text-neutral-400">All 34 modules for your project</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <div className="w-12 h-12 rounded-lg bg-red-600/20 flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">No Time Pressure</h3>
                <p className="text-sm text-neutral-400">Use it as long as you need</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <div className="w-12 h-12 rounded-lg bg-red-600/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Production Ready</h3>
                <p className="text-sm text-neutral-400">45,474 lines of battle-tested patterns</p>
              </div>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-neutral-400">
              <CheckCircle2 className="w-4 h-4 text-red-500" />
              <span>No credit card</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-400">
              <CheckCircle2 className="w-4 h-4 text-red-500" />
              <span>Instant access</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-400">
              <CheckCircle2 className="w-4 h-4 text-red-500" />
              <span>Works with any AI</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gradient-to-br from-neutral-950 via-neutral-900 to-black p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo & CTA */}
          <div className="lg:hidden mb-8 text-center">
            <Link href="/" className="inline-flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center">
                <Code2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">
                CodeBakers
              </span>
            </Link>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/20 border border-red-500/30">
              <Gift className="w-4 h-4 text-red-400" />
              <span className="text-red-300 text-sm font-medium">1 Free Project - No Limits</span>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
