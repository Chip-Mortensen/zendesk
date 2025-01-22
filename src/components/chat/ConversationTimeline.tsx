'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatEventWithUser, Conversation } from '@/types/chat';
import ConversationEvent from './ConversationEvent';

interface ConversationTimelineProps {
  conversation: Conversation;
  events: ChatEventWithUser[];
  currentUserId: string | null;
  onSendMessage: (message: string) => Promise<void>;
}

export default function ConversationTimeline({
  events,
  currentUserId,
  onSendMessage
}: ConversationTimelineProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [events]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      await onSendMessage(message.trim());
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)]">
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="min-h-full">
          <div className="space-y-1 p-4">
            {events.map((event) => (
              <ConversationEvent 
                key={event.id} 
                event={event}
                currentUserId={currentUserId}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border-t border-gray-200 p-4">
        <form onSubmit={handleSendMessage}>
          <div className="flex items-start space-x-2">
            <div className="min-w-0 flex-1">
              <textarea
                id="message"
                name="message"
                rows={1}
                className="block w-full rounded-2xl border-0 py-3 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 resize-none"
                placeholder="What's on your mind..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (message.trim()) {
                      handleSendMessage(e);
                    }
                  }
                }}
              />
            </div>
            <div className="flex-shrink-0">
              <button
                type="submit"
                disabled={sending || !message.trim()}
                className="inline-flex items-center justify-center rounded-full w-10 h-10 text-white shadow-sm bg-blue-500 hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 