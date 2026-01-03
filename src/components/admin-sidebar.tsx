'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import {
  LayoutDashboard,
  Users,
  FileWarning,
  FileText,
  Settings,
  LogOut,
  Shield,
  Menu,
  Sparkles,
  Building2,
  FileUp,
  Terminal,
  Cpu,
  DollarSign,
  CreditCard,
  TrendingUp,
  Receipt,
  BookOpen,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'E-Commerce',
    items: [
      { href: '/admin/revenue', label: 'Revenue', icon: TrendingUp },
      { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
      { href: '/admin/payments', label: 'Payments', icon: Receipt },
    ],
  },
  {
    title: 'Users & Teams',
    items: [
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/enterprise', label: 'Enterprise Leads', icon: Building2 },
    ],
  },
  {
    title: 'Platform',
    items: [
      { href: '/admin/engineering', label: 'Engineering', icon: Cpu },
      { href: '/admin/content', label: 'Content', icon: FileText },
      { href: '/admin/cli-versions', label: 'CLI Versions', icon: Terminal },
      { href: '/admin/module-builder', label: 'AI Module Builder', icon: Sparkles },
      { href: '/admin/submissions', label: 'Pattern Submissions', icon: FileUp },
      { href: '/admin/reports', label: 'Reports', icon: FileWarning },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/admin/docs', label: 'Documentation', icon: BookOpen },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function AdminSidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const initials = user.email?.slice(0, 2).toUpperCase() || 'AD';

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-red-950 border-b border-red-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-red-400" />
          <span className="font-bold text-white">Admin</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-red-200 hover:text-white hover:bg-red-900/50"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen w-64 bg-red-950 border-r border-red-800 flex flex-col',
          // Mobile: hidden by default, shown when mobileOpen is true
          'max-lg:transition-transform max-lg:duration-300',
          mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
          // Desktop: always visible
          'lg:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="h-16 flex items-center px-4 border-b border-red-800">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-red-400 flex-shrink-0" />
            <span className="font-bold text-white">Admin Panel</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-4 overflow-y-auto">
          {navSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="space-y-1">
              {section.title && (
                <div className="px-3 py-1.5 text-xs font-semibold text-red-400 uppercase tracking-wider">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href ||
                  (item.href !== '/admin' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-red-900 text-white'
                        : 'text-red-200 hover:text-white hover:bg-red-900/50'
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Divider */}
        <div className="border-t border-red-800 mx-2" />

        {/* Back to Dashboard */}
        <div className="p-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-red-200 hover:text-white hover:bg-red-900/50"
          >
            <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {/* User Section */}
        <div className="p-2 border-t border-red-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="bg-red-600 text-white text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.user_metadata?.full_name || 'Admin'}
              </p>
              <p className="text-xs text-red-300 truncate">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full mt-2 text-red-200 hover:text-white hover:bg-red-900/50 justify-start"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span className="ml-3">Sign Out</span>
          </Button>
        </div>
      </aside>
    </>
  );
}
