import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/send-email';
import { escapeHtml } from '@/lib/email/template';

const FEEDBACK_RECIPIENT = 'glowbal@purelymail.com';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const pageUrl = formData.get('pageUrl') as string | null;
    const steps = formData.get('steps') as string | null;
    const expected = formData.get('expected') as string | null;
    const actual = formData.get('actual') as string | null;
    const screenshot = formData.get('screenshot') as File | null;

    if (!pageUrl || !steps || !expected || !actual) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    let screenshotInfo = 'None attached';
    let attachments: { filename: string; content: string; contentType?: string }[] = [];

    if (screenshot && screenshot.size > 0) {
      const bytes = await screenshot.arrayBuffer();
      attachments = [
        {
          filename: screenshot.name || 'screenshot.png',
          content: Buffer.from(bytes).toString('base64'),
          contentType: screenshot.type || 'application/octet-stream',
        },
      ];
      screenshotInfo = `Attached: ${screenshot.name} (${(screenshot.size / 1024).toFixed(0)} KB)`;
    }

    const safePageUrl = escapeHtml(pageUrl);
    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#334155;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#fdf2f8;border-radius:12px;padding:24px;margin-bottom:20px;border-left:4px solid #e11d48;">
            <h1 style="color:#1e293b;margin:0 0 4px;font-size:20px;">UAT Bug Report</h1>
            <p style="margin:0;font-size:13px;color:#64748b;">Submitted via glowbal-education.com/feedback</p>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr><td style="padding:12px 16px;background:#f8fafc;font-weight:600;width:140px;vertical-align:top;">Page URL</td><td style="padding:12px 16px;"><a href="${safePageUrl}" style="color:#e11d48;text-decoration:none;">${safePageUrl}</a></td></tr>
            <tr><td style="padding:12px 16px;background:#f8fafc;font-weight:600;vertical-align:top;">Steps to reproduce</td><td style="padding:12px 16px;white-space:pre-wrap;">${escapeHtml(steps)}</td></tr>
            <tr><td style="padding:12px 16px;background:#f8fafc;font-weight:600;vertical-align:top;">Expected result</td><td style="padding:12px 16px;white-space:pre-wrap;">${escapeHtml(expected)}</td></tr>
            <tr><td style="padding:12px 16px;background:#f8fafc;font-weight:600;vertical-align:top;">Actual result</td><td style="padding:12px 16px;white-space:pre-wrap;">${escapeHtml(actual)}</td></tr>
            <tr><td style="padding:12px 16px;background:#f8fafc;font-weight:600;vertical-align:top;">Screenshot</td><td style="padding:12px 16px;">${escapeHtml(screenshotInfo)}</td></tr>
          </table>
          <p style="font-size:12px;color:#94a3b8;text-align:center;margin-top:24px;">Sent from GlowBal UAT Feedback form · ${new Date().toISOString()}</p>
        </body>
      </html>`;

    const result = await sendEmail({
      to: FEEDBACK_RECIPIENT,
      subject: `Bug Report: ${pageUrl}`,
      html,
      attachments,
      category: 'product_transactional',
      template: 'legacy',
      tags: { kind: 'uat-feedback' },
    });

    if (!result.ok) {
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ message: result.skipped ? 'Feedback logged (email not configured)' : 'Bug report sent successfully' });
  } catch (error) {
    console.error('[feedback] Error:', error);
    return NextResponse.json({ error: 'Failed to submit feedback. Please try again.' }, { status: 500 });
  }
}
