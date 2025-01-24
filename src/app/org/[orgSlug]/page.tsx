'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChatBubbleLeftRightIcon, TicketIcon, BookOpenIcon } from '@heroicons/react/24/outline';

export default function OrganizationPage() {
  const params = useParams();
  const [orgSlug, setOrgSlug] = useState<string>('');

  useEffect(() => {
    const slug = params?.orgSlug;
    if (typeof slug === 'string') {
      setOrgSlug(slug);
    }
  }, [params?.orgSlug]);

  const quickAccess = [
    {
      name: 'Support Tickets',
      description: 'View and manage your support tickets',
      href: `/org/${orgSlug}/tickets`,
      icon: TicketIcon,
    },
    {
      name: 'Knowledge Base',
      description: 'Browse our help articles and documentation',
      href: `/org/${orgSlug}/kb`,
      icon: BookOpenIcon,
    },
    {
      name: 'Chat Support',
      description: 'Get real-time help from our support team',
      href: `/org/${orgSlug}/chat`,
      icon: ChatBubbleLeftRightIcon,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold">Support Portal</h1>
            <p className="mt-1 text-sm text-gray-500">
              Quick access to all support resources and tools.
            </p>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {quickAccess.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="relative group bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all"
              >
                <div>
                  <span className="inline-flex p-3 ring-4 ring-white bg-blue-50 rounded-lg">
                    <item.icon className="h-6 w-6 text-blue-600" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                    {item.name}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    {item.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 