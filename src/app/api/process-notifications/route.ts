import { NextResponse } from 'next/server';
import { processNotifications } from '@/utils/notifications';

// Add runtime configuration for edge function
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Handle POST requests for manual triggers
export async function POST() {
  const result = await processNotifications();
  return NextResponse.json(result);
} 