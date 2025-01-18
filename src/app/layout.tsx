'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <nav className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex justify-between h-16">
                <div className="flex">
                  <Link href="/" className="flex items-center">
                    <span className="text-xl font-bold text-gray-900">Zendesk Clone</span>
                  </Link>
                  <div className="ml-10 flex items-center space-x-4">
                    <Link href="/tickets" className="text-gray-900 hover:text-gray-600 px-3 py-2 rounded-md text-sm font-medium">
                      Tickets
                    </Link>
                    <Link href="/kb" className="text-gray-900 hover:text-gray-600 px-3 py-2 rounded-md text-sm font-medium">
                      Knowledge Base
                    </Link>
                    <Link href="/chat" className="text-gray-900 hover:text-gray-600 px-3 py-2 rounded-md text-sm font-medium">
                      Chat
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
