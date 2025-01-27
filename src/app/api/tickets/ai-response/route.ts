import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log('AI Response Trigger Received:', {
      timestamp: new Date().toISOString(),
      data
    });

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Error in AI response route:', error);
    return NextResponse.json(
      { error: 'Failed to process AI response' },
      { status: 500 }
    );
  }
} 