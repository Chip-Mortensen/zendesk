'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface FailedChat {
  id: string;
  title: string;
  created_at: string;
  last_handoff_reason: {
    needsHandoff: boolean;
    reason: string;
    confidence: number;
    analysisFailure: string;
    kbGaps: string[];
    analysis: {
      kbAccuracy: string;
      technicalAccuracy: string;
      conversationFlow: string;
      customerSentiment: string;
      responseQuality: string;
    };
  };
  description: string;
}

interface AnalysisCardProps {
  title: string;
  value: string;
  isFailureCategory: boolean;
}

function AnalysisCard({ title, value, isFailureCategory }: AnalysisCardProps) {
  const colors = isFailureCategory 
    ? 'bg-red-50 border-red-100 text-red-700'
    : 'bg-gray-50 border-gray-100 text-gray-700';

  return (
    <div className={`p-4 rounded-lg border ${colors}`}>
      <dt className="text-sm font-medium text-gray-900 mb-2">{title}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export default function FailedChatsPage() {
  const [failedChats, setFailedChats] = useState<FailedChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChats, setExpandedChats] = useState<Set<string>>(new Set());
  const supabase = createClientComponentClient();

  const toggleExpanded = (chatId: string) => {
    setExpandedChats(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chatId)) {
        newSet.delete(chatId);
      } else {
        newSet.add(chatId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    async function fetchFailedChats() {
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('ai_enabled', false)
        .not('last_handoff_reason', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching failed chats:', error);
        return;
      }

      setFailedChats(tickets);
      setLoading(false);
    }

    fetchFailedChats();
  }, [supabase]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="px-6">
        <Link
          href="/dashboard/tickets"
          className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1"
        >
          ← Back to Tickets
        </Link>
      </div>
      
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold">Failed AI Chats</h1>
            <p className="mt-1 text-sm text-gray-500">
              Review tickets where AI assistance was disabled due to complexity or other factors.
            </p>
          </div>
        </div>

        <div className="divide-y divide-gray-200 p-6">
          {failedChats.map((chat) => {
            const isExpanded = expandedChats.has(chat.id);
            
            return (
              <div key={chat.id} className="group border border-gray-200 rounded-lg mb-4 last:mb-0 hover:border-gray-300 transition-colors duration-150">
                <div 
                  className="p-6 cursor-pointer"
                  onClick={() => toggleExpanded(chat.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-medium text-gray-900">
                          {chat.title}
                        </h2>
                        <span className="px-3 py-1 text-sm font-medium text-red-700 bg-red-50 rounded-full border border-red-100">
                          AI Handoff
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        Created on {new Date(chat.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Link
                        href={`/dashboard/tickets/${chat.id}`}
                        className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 rounded-lg transition-colors duration-150"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Ticket
                      </Link>
                      <div className={`p-2 text-gray-400 rounded-full transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDownIcon className="h-5 w-5" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="grid grid-cols-5 gap-4">
                      <div className="col-span-4 bg-gray-50 border border-gray-100 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-gray-900 mb-2">Handoff Reason</h3>
                        <p className="text-sm text-gray-700">{chat.last_handoff_reason.reason}</p>
                      </div>
                      <div className="col-span-1 bg-gray-50 border border-gray-100 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-gray-900 mb-2">Confidence</h3>
                        <div className="text-2xl font-semibold text-gray-900">
                          {(chat.last_handoff_reason.confidence * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100">
                    <div className="px-6 py-4 space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-gray-900">Secondary Analysis</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <AnalysisCard
                            title="KB Accuracy"
                            value={chat.last_handoff_reason.analysis.kbAccuracy}
                            isFailureCategory={chat.last_handoff_reason.analysisFailure === 'kbAccuracy'}
                          />
                          <AnalysisCard
                            title="Response Quality"
                            value={chat.last_handoff_reason.analysis.responseQuality}
                            isFailureCategory={chat.last_handoff_reason.analysisFailure === 'responseQuality'}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <AnalysisCard
                            title="Technical Implementation"
                            value={chat.last_handoff_reason.analysis.technicalAccuracy}
                            isFailureCategory={chat.last_handoff_reason.analysisFailure === 'technicalAccuracy'}
                          />
                          <AnalysisCard
                            title="Conversation Flow"
                            value={chat.last_handoff_reason.analysis.conversationFlow}
                            isFailureCategory={chat.last_handoff_reason.analysisFailure === 'conversationFlow'}
                          />
                          <AnalysisCard
                            title="Customer Sentiment"
                            value={chat.last_handoff_reason.analysis.customerSentiment}
                            isFailureCategory={chat.last_handoff_reason.analysisFailure === 'customerSentiment'}
                          />
                        </div>
                      </div>

                      {chat.last_handoff_reason.kbGaps.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 mb-2">Knowledge Base Gaps</h3>
                          <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                            <p className="text-sm text-gray-700 mb-2">These topics from the customer&apos;s question are not covered in the current knowledge base:</p>
                            <ul className="space-y-1">
                              {chat.last_handoff_reason.kbGaps.map((gap, index) => (
                                <li key={index} className="text-sm text-red-700 flex items-start">
                                  <span className="mr-2">•</span>
                                  {gap}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 