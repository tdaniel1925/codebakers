'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import {
  LayoutDashboard,
  CreditCard,
  Users,
  LogOut,
  Shield,
  Menu,
  Zap,
  Plug,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/onboarding', label: 'IDE Setup', icon: Plug },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/team', label: 'Team', icon: Users },
];

interface DashboardSidebarProps {
  user: User;
  isAdmin?: boolean;
}

export function DashboardSidebar({ user, isAdmin }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const initials = user.email?.slice(0, 2).toUpperCase() || 'CB';

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-red-400" />
          <span className="font-bold text-white">CodeBakers</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-neutral-300 hover:text-white hover:bg-neutral-800"
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
          'fixed top-0 left-0 z-50 h-screen w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col',
          // Mobile: hidden by default, shown when mobileOpen is true
          'max-lg:transition-transform max-lg:duration-300',
          mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
          // Desktop: always visible
          'lg:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="h-16 flex items-center px-4 border-b border-neutral-800">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-red-400 flex-shrink-0" />
            <span className="font-bold text-white">CodeBakers</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-red-600 text-white'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Admin Link (if admin) */}
        {isAdmin && (
          <>
            <div className="border-t border-neutral-800 mx-2" />
            <div className="p-2">
              <Link
                href="/admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-red-400 hover:text-red-300 hover:bg-red-900/20"
              >
                <Shield className="h-5 w-5 flex-shrink-0" />
                <span>Admin Panel</span>
              </Link>
            </div>
          </>
        )}

        {/* User Section */}
        <div className="p-2 border-t border-neutral-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="bg-red-600 text-white text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.user_metadata?.full_name || 'User'}
              </p>
              <p className="text-xs text-neutral-400 truncate">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full mt-2 text-neutral-400 hover:text-white hover:bg-neutral-800 justify-start"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span className="ml-3">Sign Out</span>
          </Button>
        </div>
      </aside>
    </>
  );
}
