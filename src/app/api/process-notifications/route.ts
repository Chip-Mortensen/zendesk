import { NextResponse } from 'next/server';
import { processNotifications } from '@/utils/notifications';

// Handle GET requests for manual triggers
export async function GET() {
  const result = await processNotifications();
  return NextResponse.json(result);
} 