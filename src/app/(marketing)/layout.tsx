import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="text-xl font-bold text-gray-900">
              CodeBakers
            </Link>
            <div className="flex items-center space-x-6">
              <Link
                href="/pricing"
                className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
              >
                Pricing
              </Link>
              <Link
                href="/compare"
                className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
              >
                Compare
              </Link>
              <Link href="/login">
                <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-red-600 hover:bg-red-700 text-white shadow-sm">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-16 mt-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <h3 className="font-bold text-gray-900 mb-4">CodeBakers</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Ship production-ready code from day one with 34 battle-tested
                pattern modules.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li>
                  <Link href="/pricing" className="hover:text-gray-900 transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/compare" className="hover:text-gray-900 transition-colors">
                    Compare
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Support</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li>
                  <Link href="/setup" className="hover:text-gray-900 transition-colors">
                    Documentation
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Legal</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li>
                  <Link href="#" className="hover:text-gray-900 transition-colors">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-gray-900 transition-colors">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-200 text-center text-sm text-gray-400">
            &copy; {new Date().getFullYear()} CodeBakers. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
