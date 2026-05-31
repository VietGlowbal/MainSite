import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/send-email';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface NotifyRequest {
  contentType: 'guide' | 'news';
  contentSlug: string;
  contentTitle: string;
  contentExcerpt?: string;
  contentUrl: string;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authorization (you might want to add a secret token)
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.NEWSLETTER_NOTIFY_SECRET;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: NotifyRequest = await request.json();
    const { contentType, contentSlug, contentTitle, contentExcerpt, contentUrl } = body;

    if (!contentType || !contentSlug || !contentTitle || !contentUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if already sent
    const { data: alreadySent } = await supabase
      .from('newsletter_content_sent')
      .select('id')
      .eq('content_type', contentType)
      .eq('content_slug', contentSlug)
      .single();

    if (alreadySent) {
      return NextResponse.json({
        message: 'Content already sent to subscribers',
        skipped: true,
      });
    }

    // Get active subscribers
    const { data: subscribers, error: fetchError } = await supabase
      .from('newsletter_subscriptions')
      .select('email, first_name')
      .eq('status', 'active');

    if (fetchError) throw fetchError;

    if (!subscribers || subscribers.length === 0) {
      return NextResponse.json({
        message: 'No active subscribers',
        count: 0,
      });
    }

    // Send emails to all subscribers
    const emailPromises = subscribers.map(async (subscriber) => {
      try {
        await sendEmail({
          to: subscriber.email,
          subject: `New ${contentType === 'guide' ? 'Guide' : 'Article'}: ${contentTitle}`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, rgba(255,77,140,0.1), rgba(0,180,216,0.08)); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
                  <div style="font-size: 32px; margin-bottom: 12px;">
                    ${contentType === 'guide' ? '📚' : '📰'}
                  </div>
                  <h1 style="color: #1e293b; margin: 0 0 8px 0; font-size: 24px;">
                    ${contentTitle}
                  </h1>
                  <p style="margin: 0; font-size: 14px; color: #64748b;">
                    New ${contentType === 'guide' ? 'guide' : 'article'} on Glowbal
                  </p>
                </div>
                
                ${contentExcerpt ? `
                  <div style="margin-bottom: 24px;">
                    <p style="margin: 0; color: #475569; font-size: 16px; line-height: 1.6;">
                      ${contentExcerpt}
                    </p>
                  </div>
                ` : ''}

                <div style="text-align: center; margin: 32px 0;">
                  <a href="${contentUrl}" style="display: inline-block; background: linear-gradient(135deg, #ec4899, #f43f5e); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
                    Read ${contentType === 'guide' ? 'Guide' : 'Article'}
                  </a>
                </div>

                <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                  <p style="margin: 0; font-size: 14px; color: #64748b;">
                    ${subscriber.first_name ? `Hi ${subscriber.first_name}! ` : ''}This is a new ${contentType} we thought you'd find helpful for your study abroad journey.
                  </p>
                </div>

                <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0 0 8px 0; font-size: 14px; color: #94a3b8;">
                    <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://glowbal.com'}/newsletter/unsubscribe?email=${encodeURIComponent(subscriber.email)}" style="color: #ec4899; text-decoration: none;">Unsubscribe</a>
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #cbd5e1;">
                    © ${new Date().getFullYear()} Glowbal. All rights reserved.
                  </p>
                </div>
              </body>
            </html>
          `,
        });
        return { success: true, email: subscriber.email };
      } catch (error) {
        console.error(`Failed to send to ${subscriber.email}:`, error);
        return { success: false, email: subscriber.email };
      }
    });

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;

    // Record that we sent this content
    await supabase.from('newsletter_content_sent').insert({
      content_type: contentType,
      content_slug: contentSlug,
      content_title: contentTitle,
      recipient_count: successCount,
    });

    // Update last_email_sent for all subscribers
    await supabase
      .from('newsletter_subscriptions')
      .update({ last_email_sent: new Date().toISOString() })
      .eq('status', 'active');

    return NextResponse.json({
      message: 'Newsletter sent successfully',
      totalSubscribers: subscribers.length,
      successCount,
      failedCount: subscribers.length - successCount,
    });
  } catch (error) {
    console.error('Newsletter notify error:', error);
    return NextResponse.json(
      { error: 'Failed to send newsletter. Please try again.' },
      { status: 500 }
    );
  }
}
