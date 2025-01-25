import { NextResponse } from 'next/server';
import { processNotifications } from '@/utils/notifications';

// Handle POST requests for manual triggers
export async function POST() {
  const result = await processNotifications();
  return NextResponse.json(result);
} 