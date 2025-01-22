'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import StatsCard from './StatsCard';
import type { ResponseTimeMetrics as ResponseTimeMetricsType, PriorityResponseMetrics } from '@/types/metrics';
import { ClockIcon } from '@heroicons/react/24/outline';

interface ResponseTimeMetricsProps {
  organizationId: string;
}

export default function ResponseTimeMetrics({ organizationId }: ResponseTimeMetricsProps) {
  const [firstResponse, setFirstResponse] = useState<ResponseTimeMetricsType | null>(null);
  const [resolutionTime, setResolutionTime] = useState<ResponseTimeMetricsType | null>(null);
  const [priorityMetrics, setPriorityMetrics] = useState<PriorityResponseMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      try {
        setLoading(true);
        setError(null);

        // Fetch first response metrics
        const { data: firstResponseData, error: firstResponseError } = await supabase
          .rpc('get_first_response_time', { p_organization_id: organizationId });

        if (firstResponseError) {
          throw new Error(`Error fetching first response time: ${firstResponseError.message}`);
        }
        setFirstResponse(firstResponseData[0]);

        // Fetch resolution time metrics
        const { data: resolutionData, error: resolutionError } = await supabase
          .rpc('get_resolution_time', { p_organization_id: organizationId });

        if (resolutionError) {
          throw new Error(`Error fetching resolution time: ${resolutionError.message}`);
        }
        setResolutionTime(resolutionData[0]);

        // Fetch priority-based metrics
        const { data: priorityData, error: priorityError } = await supabase
          .rpc('get_response_time_by_priority', { p_organization_id: organizationId });

        if (priorityError) {
          throw new Error(`Error fetching priority metrics: ${priorityError.message}`);
        }
        setPriorityMetrics(priorityData || []);

      } catch (err) {
        console.error('Error loading metrics:', err);
        setError(err instanceof Error ? err.message : 'An error occurred while loading metrics');
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
  }, [organizationId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-pulse text-gray-600">Loading response time metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p>Error: {error}</p>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-gradient-to-br from-white to-red-50';
      case 'medium':
        return 'bg-gradient-to-br from-white to-amber-50';
      case 'low':
        return 'bg-gradient-to-br from-white to-emerald-50';
      default:
        return 'bg-white';
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium text-gray-900">Response Time Overview</h2>
        <p className="mt-1 text-sm text-gray-500">
          Track your team&apos;s response and resolution times across all support channels.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatsCard
          title="First Response Time"
          value={`${firstResponse?.avg_time_hours.toFixed(1) || '0'} hrs`}
          description={`90th percentile: ${firstResponse?.p90_time_hours.toFixed(1) || '0'} hrs`}
          icon={<ClockIcon className="w-5 h-5" />}
          backgroundColor="bg-gradient-to-br from-blue-50 via-white to-indigo-50 border-blue-100"
        />
        <StatsCard
          title="Resolution Time"
          value={`${resolutionTime?.avg_time_hours.toFixed(1) || '0'} hrs`}
          description={`90th percentile: ${resolutionTime?.p90_time_hours.toFixed(1) || '0'} hrs`}
          icon={<ClockIcon className="w-5 h-5" />}
          backgroundColor="bg-gradient-to-br from-purple-50 via-white to-pink-50 border-purple-100"
        />
      </div>

      {priorityMetrics.length > 0 && (
        <div className="pt-4">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900">Response Time by Priority</h3>
            <p className="mt-1 text-sm text-gray-500">
              Average response times segmented by ticket priority level.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {priorityMetrics.map((metric) => (
              <StatsCard
                key={metric.priority_level}
                title={`${metric.priority_level.charAt(0).toUpperCase() + metric.priority_level.slice(1)} Priority`}
                value={`${metric.avg_time_hours.toFixed(1)} hrs`}
                description={`${metric.ticket_count} ticket${metric.ticket_count === 1 ? '' : 's'}`}
                icon={<ClockIcon className="w-5 h-5" />}
                backgroundColor={getPriorityColor(metric.priority_level)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 