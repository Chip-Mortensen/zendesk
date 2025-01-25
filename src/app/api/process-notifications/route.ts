import { NextResponse } from 'next/server';
import { processNotifications } from '@/utils/notifications';

// Edge function configuration
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Handle POST requests for manual triggers
export async function POST() {
  const result = await processNotifications();
  return NextResponse.json(result);
} 