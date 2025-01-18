'use client';

import { Inter } from "next/font/google";
import { usePathname } from "next/navigation";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Don't show public header on authenticated routes
  const showPublicHeader = !pathname.startsWith('/dashboard') && !pathname.startsWith('/org/');

  return (
    <html lang="en">
      <body className={inter.className}>
        {showPublicHeader && (
          <header className="bg-white border-b border-gray-200">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 justify-between items-center">
                <div className="flex items-center space-x-8">
                  <Link href="/" className="flex items-center space-x-3">
                    <svg 
                      className="h-8 w-8 text-blue-600" 
                      viewBox="0 0 24 24" 
                      fill="currentColor"
                    >
                      <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
                    </svg>
                    <span className="text-xl font-bold text-gray-900">Zendesk Clone</span>
                  </Link>
                  
                  <nav className="hidden md:flex space-x-8">
                    <Link href="/features" className="text-sm font-medium text-gray-500 hover:text-gray-900">
                      Features
                    </Link>
                    <Link href="/pricing" className="text-sm font-medium text-gray-500 hover:text-gray-900">
                      Pricing
                    </Link>
                    <Link href="/about" className="text-sm font-medium text-gray-500 hover:text-gray-900">
                      About
                    </Link>
                  </nav>
                </div>

                <div className="flex items-center space-x-3">
                  <Link
                    href="/auth?type=customer"
                    className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Customer Portal
                  </Link>
                  <Link
                    href="/auth?type=admin"
                    className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Admin Portal
                  </Link>
                </div>
              </div>
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
