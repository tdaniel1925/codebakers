'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Book, ChevronRight, Menu, X, Terminal, Layers, Rocket, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navigation = [
  {
    title: 'Getting Started',
    icon: Rocket,
    items: [
      { title: 'Introduction', href: '/docs' },
      { title: 'Installation', href: '/docs/getting-started' },
    ],
  },
  {
    title: 'Commands',
    icon: Terminal,
    items: [
      { title: 'Overview', href: '/docs/commands' },
      { title: '/build', href: '/docs/commands/build' },
      { title: '/feature', href: '/docs/commands/feature' },
      { title: '/audit', href: '/docs/commands/audit' },
      { title: '/status', href: '/docs/commands/status' },
    ],
  },
  {
    title: 'Modules',
    icon: Layers,
    items: [
      { title: 'Module Reference', href: '/docs/modules' },
    ],
  },
];

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-red-500">CodeBakers</span>
            </Link>
            <span className="hidden text-neutral-400 sm:inline">/</span>
            <Link href="/docs" className="hidden text-neutral-400 hover:text-white sm:inline">
              Docs
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-red-600 hover:bg-red-700">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl lg:flex lg:gap-8 lg:px-8">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-neutral-800 bg-neutral-950 pt-16 transition-transform lg:static lg:translate-x-0 lg:pt-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <nav className="h-full overflow-y-auto px-4 py-6">
            {navigation.map((section) => (
              <div key={section.title} className="mb-6">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-300">
                  <section.icon className="h-4 w-4" />
                  {section.title}
                </div>
                <ul className="space-y-1">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                          pathname === item.href
                            ? 'bg-red-600/20 text-red-400'
                            : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                        }`}
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="min-h-screen flex-1 px-4 py-8 lg:py-12">
          <div className="prose prose-invert max-w-3xl prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-neutral-300 prose-a:text-red-400 prose-a:no-underline hover:prose-a:underline prose-code:text-red-300 prose-code:bg-neutral-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-neutral-900 prose-pre:border prose-pre:border-neutral-800">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
