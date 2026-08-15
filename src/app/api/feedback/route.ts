import { NextRequest, NextResponse } from 'next/server';

const FEEDBACK_RECIPIENT = 'glowbal@purelymail.com';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const pageUrl = formData.get('pageUrl') as string | null;
    const steps = formData.get('steps') as string | null;
    const expected = formData.get('expected') as string | null;
    const actual = formData.get('actual') as string | null;
    const screenshot = formData.get('screenshot') as File | null;

    // Validate required fields
    if (!pageUrl || !steps || !expected || !actual) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Build screenshot attachment info
    let screenshotInfo = 'None attached';
    let attachments: { filename: string; content: string }[] = [];

    if (screenshot && screenshot.size > 0) {
      const bytes = await screenshot.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      attachments = [
        {
          filename: screenshot.name || 'screenshot.png',
          content: base64,
        },
      ];
      screenshotInfo = `Attached: ${screenshot.name} (${(screenshot.size / 1024).toFixed(0)} KB)`;
    }

    // Build email HTML
    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #fdf2f8; border-radius: 12px; padding: 24px; margin-bottom: 20px; border-left: 4px solid #ec4899;">
            <h1 style="color: #1e293b; margin: 0 0 4px 0; font-size: 20px;">🐛 UAT Bug Report</h1>
            <p style="margin: 0; font-size: 13px; color: #64748b;">Submitted via glowbal-education.com/feedback</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; width: 140px; vertical-align: top;">Page URL</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">
                <a href="${pageUrl}" style="color: #ec4899; text-decoration: none;">${pageUrl}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; vertical-align: top;">Steps to reproduce</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #1e293b; white-space: pre-wrap;">${steps}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; vertical-align: top;">Expected result</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #1e293b; white-space: pre-wrap;">${expected}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; vertical-align: top;">Actual result</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #1e293b; white-space: pre-wrap;">${actual}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; background: #f8fafc; font-weight: 600; color: #475569; vertical-align: top;">Screenshot</td>
              <td style="padding: 12px 16px; color: #1e293b;">${screenshotInfo}</td>
            </tr>
          </table>

          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px;">
            Sent from Glowbal UAT Feedback form • ${new Date().toISOString()}
          </p>
        </body>
      </html>
    `;

    // Send via Resend with attachment support
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.WAITLIST_FROM_EMAIL ?? 'hello@glowbal.com';

    if (!apiKey || apiKey.startsWith('re_your_')) {
      console.warn('[feedback] RESEND_API_KEY not configured — logging report instead');
      console.log('[feedback] Report:', { pageUrl, steps, expected, actual, screenshotInfo });
      return NextResponse.json({ message: 'Feedback logged (email not configured)' });
    }

    const emailPayload: Record<string, unknown> = {
      from,
      to: FEEDBACK_RECIPIENT,
      subject: `🐛 Bug Report: ${pageUrl}`,
      html,
    };

    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[feedback] Resend error:', res.status, body);
      return NextResponse.json(
        { error: 'Failed to send email. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Bug report sent successfully' });
  } catch (error) {
    console.error('[feedback] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback. Please try again.' },
      { status: 500 }
    );
  }
}
