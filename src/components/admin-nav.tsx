'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { Users, LayoutDashboard, LogOut, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/dashboard', label: 'Back to Dashboard', icon: LayoutDashboard },
];

export function AdminNav({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-red-800 bg-red-950/80 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <Shield className="h-6 w-6 text-red-400" />
            <span className="text-xl font-bold text-white">Admin Panel</span>
          </div>

          {/* Nav */}
          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-red-900 text-white'
                      : 'text-red-200 hover:text-white hover:bg-red-900/50'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {item.label}
                </Link>
              );
            })}
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="text-red-200 hover:text-white hover:bg-red-900/50"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
