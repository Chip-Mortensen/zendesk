import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Zendesk Clone",
  description: "A modern help desk solution",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-100">
          <nav className="bg-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex justify-between h-16">
                <div className="flex">
                  <Link href="/" className="flex items-center">
                    <span className="text-xl font-bold">Zendesk Clone</span>
                  </Link>
                  <div className="ml-10 flex items-center space-x-4">
                    <Link href="/tickets" className="text-gray-700 hover:text-gray-900">
                      Tickets
                    </Link>
                    <Link href="/kb" className="text-gray-700 hover:text-gray-900">
                      Knowledge Base
                    </Link>
                    <Link href="/chat" className="text-gray-700 hover:text-gray-900">
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
