import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="text-xl font-bold text-white">
              CodeBakers
            </Link>
            <div className="flex items-center space-x-4">
              <Link
                href="/pricing"
                className="text-slate-400 hover:text-white transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="/compare"
                className="text-slate-400 hover:text-white transition-colors"
              >
                Compare
              </Link>
              <Link href="/login">
                <Button variant="ghost" className="text-slate-300">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12 mt-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <h3 className="font-bold text-white mb-4">CodeBakers</h3>
              <p className="text-sm text-slate-400">
                Ship production-ready code from day one with 114 battle-tested
                patterns.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="/pricing" className="hover:text-white">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/compare" className="hover:text-white">
                    Compare
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="/setup" className="hover:text-white">
                    Documentation
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="#" className="hover:text-white">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-800 text-center text-sm text-slate-400">
            &copy; {new Date().getFullYear()} CodeBakers. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
