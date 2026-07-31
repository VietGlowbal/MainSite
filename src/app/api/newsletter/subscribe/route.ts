import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/send-email';
import { SITE_URL } from '@/lib/site-url';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, firstName, source = 'website' } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if already subscribed
    const { data: existing } = await supabase
      .from('newsletter_subscriptions')
      .select('id, status')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      if (existing.status === 'active') {
        return NextResponse.json(
          { message: 'Already subscribed', alreadySubscribed: true },
          { status: 200 }
        );
      } else {
        // Reactivate subscription
        const { error: updateError } = await supabase
          .from('newsletter_subscriptions')
          .update({
            status: 'active',
            subscribed_at: new Date().toISOString(),
            unsubscribed_at: null,
            first_name: firstName || null,
            source,
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;

        return NextResponse.json({
          message: 'Subscription reactivated successfully',
          reactivated: true,
        });
      }
    }

    // Create new subscription
    const { error: insertError } = await supabase
      .from('newsletter_subscriptions')
      .insert({
        email: email.toLowerCase(),
        first_name: firstName || null,
        status: 'active',
        source,
      });

    if (insertError) throw insertError;

    // Send welcome email
    try {
      await sendEmail({
        to: email,
        subject: 'Welcome to Glowbal Newsletter! 🌍',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, rgba(255,77,140,0.1), rgba(0,180,216,0.08)); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
                <h1 style="color: #ec4899; margin: 0 0 16px 0; font-size: 28px;">Welcome to Glowbal! 🌍</h1>
                <p style="margin: 0; font-size: 16px; color: #64748b;">
                  ${firstName ? `Hi ${firstName}! ` : ''}Thanks for subscribing to our newsletter.
                </p>
              </div>
              
              <div style="margin-bottom: 24px;">
                <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 12px 0;">What to expect</h2>
                <p style="margin: 0 0 12px 0; color: #475569;">
                  You'll receive updates about:
                </p>
                <ul style="color: #475569; margin: 0 0 16px 0; padding-left: 24px;">
                  <li>New study abroad guides and resources</li>
                  <li>Scholarship opportunities</li>
                  <li>University application tips</li>
                  <li>Success stories from students worldwide</li>
                </ul>
              </div>

              <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; color: #64748b;">
                  <strong style="color: #1e293b;">Pro tip:</strong> Add hello@glowbal.com to your contacts to ensure our emails reach your inbox.
                </p>
              </div>

              <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #94a3b8;">
                  Not interested anymore? <a href="${SITE_URL}/newsletter/unsubscribe?email=${encodeURIComponent(email)}" style="color: #ec4899; text-decoration: none;">Unsubscribe</a>
                </p>
                <p style="margin: 0; font-size: 12px; color: #cbd5e1;">
                  © ${new Date().getFullYear()} Glowbal. All rights reserved.
                </p>
              </div>
            </body>
          </html>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the subscription if email fails
    }

    return NextResponse.json({
      message: 'Successfully subscribed to newsletter',
      success: true,
    });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe. Please try again.' },
      { status: 500 }
    );
  }
}
