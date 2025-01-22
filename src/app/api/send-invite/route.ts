import { NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export async function POST(request: Request) {
  try {
    const { to, organizationName, inviteUrl } = await request.json();

    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL || '',
      subject: `Join ${organizationName} on Gauntlet`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8fafc; padding: 24px;">
            <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 16px;">
              You're invited to join ${organizationName}
            </h1>
            
            <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
              You've been invited to join the team at ${organizationName}. Click the button below to accept your invitation and create your account.
            </p>

            <div style="margin: 32px 0;">
              <a href="${inviteUrl}" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; font-weight: 500;">
                Accept Invitation
              </a>
            </div>

            <p style="color: #64748b; font-size: 14px; margin-top: 24px;">
              This invitation will expire in 48 hours. If you have any issues, please contact support.
            </p>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 16px;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </div>
      `
    };

    await sgMail.send(msg);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send invite email'
      },
      { status: 500 }
    );
  }
} 