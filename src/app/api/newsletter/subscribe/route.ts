import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/send-email';
import { SITE_URL } from '@/lib/site-url';
import { newsletterWelcomeEmail } from '@/lib/emails/newsletter-welcome';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, firstName, source = 'website' } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existing } = await supabase
      .from('newsletter_subscriptions')
      .select('id, status')
      .eq('email', normalizedEmail)
      .single();

    if (existing) {
      if (existing.status === 'active') {
        return NextResponse.json(
          { message: 'Already subscribed', alreadySubscribed: true },
          { status: 200 },
        );
      }

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

    const { error: insertError } = await supabase
      .from('newsletter_subscriptions')
      .insert({
        email: normalizedEmail,
        first_name: firstName || null,
        status: 'active',
        source,
      });

    if (insertError) throw insertError;

    const unsubscribeUrl = `${SITE_URL}/newsletter/unsubscribe?email=${encodeURIComponent(normalizedEmail)}`;
    const result = await sendEmail({
      to: normalizedEmail,
      subject: 'Welcome to the GlowBal newsletter',
      html: newsletterWelcomeEmail({
        firstName,
        newsUrl: `${SITE_URL}/news`,
        unsubscribeUrl,
      }),
      text: `Welcome to the GlowBal newsletter. Explore GlowBal News: ${SITE_URL}/news\n\nUnsubscribe: ${unsubscribeUrl}`,
      category: 'marketing',
      template: 'newsletter-welcome',
      idempotencyKey: `newsletter-welcome:${normalizedEmail}`,
      tags: { source: String(source), kind: 'newsletter-welcome' },
    });

    if (!result.ok) {
      console.error('Failed to send newsletter welcome email:', result.error);
      // The subscription itself remains successful if email delivery fails.
    }

    return NextResponse.json({
      message: 'Successfully subscribed to newsletter',
      success: true,
    });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe. Please try again.' },
      { status: 500 },
    );
  }
}
