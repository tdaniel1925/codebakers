'use client';

import Link from 'next/link';
import { Code2, Check, Zap } from 'lucide-react';
import { CODEBAKERS_STATS } from '@/lib/stats';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left Panel - Sleek Marketing */}
      <div className="hidden lg:flex lg:w-1/2 bg-black flex-col justify-center relative">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        {/* Red glow accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]" />

        <div className="relative z-10 px-16">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-3 mb-12 group">
            <div className="w-11 h-11 rounded-xl bg-red-600 flex items-center justify-center">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">CodeBakers</span>
          </Link>

          {/* Main Headline - Bold & Clean */}
          <h1 className="text-5xl font-bold text-white leading-[1.1] mb-4 tracking-tight">
            Ship production code
            <br />
            <span className="text-red-500">on your first prompt.</span>
          </h1>

          {/* Simple value prop */}
          <p className="text-lg text-neutral-400 mb-8 max-w-md">
            {CODEBAKERS_STATS.totalLinesDisplay} lines of battle-tested patterns for your AI assistant.
            <span className="text-white"> Start free, no credit card.</span>
          </p>

          {/* Inline benefits - compact */}
          <div className="flex flex-wrap gap-x-6 gap-y-3 mb-10">
            <div className="flex items-center gap-2 text-neutral-300">
              <Check className="w-4 h-4 text-red-500" />
              <span className="text-sm">{CODEBAKERS_STATS.moduleCount} modules</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-300">
              <Check className="w-4 h-4 text-red-500" />
              <span className="text-sm">Works with Cursor & Claude</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-300">
              <Check className="w-4 h-4 text-red-500" />
              <span className="text-sm">Auto-generated tests</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-300">
              <Check className="w-4 h-4 text-red-500" />
              <span className="text-sm">Unlimited downloads</span>
            </div>
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {['bg-red-600', 'bg-neutral-600', 'bg-red-500', 'bg-neutral-700'].map((bg, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full ${bg} border-2 border-black flex items-center justify-center text-white text-xs font-medium`}
                >
                  {['S', 'M', 'A', 'J'][i]}
                </div>
              ))}
            </div>
            <span className="text-sm text-neutral-400">
              1,200+ developers shipping faster
            </span>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-neutral-900 p-6">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-6 text-center">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center">
                <Code2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">CodeBakers</span>
            </Link>
            <p className="text-sm text-neutral-400">
              <Zap className="w-3.5 h-3.5 inline mr-1 text-red-500" />
              Ship production code on your first prompt
            </p>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
