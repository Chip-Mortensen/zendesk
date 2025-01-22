'use client';

import ResponseTimeMetrics from '@/components/dashboard/ResponseTimeMetrics';
import { useOrganization } from '@/hooks/useOrganization';

export default function DashboardPage() {
  const { organization, loading, error } = useOrganization();

  return (
    <div className="max-w-7xl mx-auto">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-gray-900 sm:truncate">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor your support team&apos;s performance and key metrics.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {loading ? (
          <div className="bg-white shadow-sm rounded-lg p-6">
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading dashboard</h3>
                <p className="mt-2 text-sm text-red-700">{error.message}</p>
              </div>
            </div>
          </div>
        ) : organization ? (
          <div className="bg-white shadow-sm rounded-lg p-6">
            <ResponseTimeMetrics organizationId={organization.id} />
          </div>
        ) : null}
      </div>
    </div>
  );
} 