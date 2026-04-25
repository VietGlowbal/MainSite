export function waitlistConfirmationEmail(firstName?: string): string {
  const name = firstName?.trim() || 'there';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're on the Glowbal waitlist</title>
</head>
<body style="margin:0;padding:0;background:linear-gradient(160deg,#fff0f6 0%,#f0f9ff 100%);font-family:'Helvetica Neue',Arial,sans-serif;color:#2b2d42;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Wordmark pill -->
          <tr>
            <td align="center" style="padding-bottom:36px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#ff4d8c,#00b4d8);border-radius:999px;padding:10px 28px;">
                    <span style="font-size:1.3rem;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">Glowbal</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:28px;border:1px solid rgba(255,77,140,0.1);box-shadow:0 20px 60px rgba(255,77,140,0.1),0 4px 16px rgba(0,180,216,0.08);padding:52px 44px;text-align:center;">

              <!-- Icon -->
              <div style="margin:0 auto 28px;width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#ff4d8c,#00b4d8);padding:3px;">
                <div style="width:100%;height:100%;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;">
                  <img src="https://em-content.zobj.net/source/apple/391/sparkles_2728.png" width="36" height="36" alt="" style="display:block;margin:17px auto 0;" />
                </div>
              </div>

              <!-- Heading -->
              <h1 style="margin:0 0 6px;font-size:1.75rem;font-weight:800;letter-spacing:-0.03em;color:#0f172a;line-height:1.2;">
                You&rsquo;re on the list, ${name}
              </h1>
              <p style="margin:0 0 6px;font-size:1rem;color:#ff4d8c;font-weight:600;">
                Welcome to Glowbal
              </p>

              <!-- Divider -->
              <div style="margin:24px auto;width:48px;height:3px;border-radius:999px;background:linear-gradient(90deg,#ff4d8c,#00b4d8);"></div>

              <!-- Body -->
              <p style="margin:0 0 12px;font-size:0.95rem;line-height:1.75;color:#475569;max-width:380px;margin-left:auto;margin-right:auto;">
                We&rsquo;re building the student-first guide to universities and courses worldwide &mdash; and you&rsquo;re one of the first to know.
              </p>
              <p style="margin:0 0 36px;font-size:0.95rem;line-height:1.75;color:#475569;max-width:380px;margin-left:auto;margin-right:auto;">
                We&rsquo;ll reach out as soon as your spot is ready. In the meantime, keep an eye on your inbox.
              </p>

              <!-- What to expect strip -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
                <tr>
                  <td align="center" width="33%" style="padding:0 6px;text-align:center;">
                    <div style="background:linear-gradient(135deg,#fff0f6,#ffe4f0);border-radius:16px;padding:16px 8px;">
                      <p style="margin:0;font-size:1.3rem;">🌍</p>
                      <p style="margin:6px 0 0;font-size:0.75rem;font-weight:700;color:#0f172a;">Global reach</p>
                      <p style="margin:4px 0 0;font-size:0.7rem;color:#64748b;line-height:1.4;">Universities across every continent</p>
                    </div>
                  </td>
                  <td align="center" width="33%" style="padding:0 6px;text-align:center;">
                    <div style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-radius:16px;padding:16px 8px;">
                      <p style="margin:0;font-size:1.3rem;">🎯</p>
                      <p style="margin:6px 0 0;font-size:0.75rem;font-weight:700;color:#0f172a;">Smart matching</p>
                      <p style="margin:4px 0 0;font-size:0.7rem;color:#64748b;line-height:1.4;">Courses matched to your goals</p>
                    </div>
                  </td>
                  <td align="center" width="33%" style="padding:0 6px;text-align:center;">
                    <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:16px;padding:16px 8px;">
                      <p style="margin:0;font-size:1.3rem;">✨</p>
                      <p style="margin:6px 0 0;font-size:0.75rem;font-weight:700;color:#0f172a;">Student-first</p>
                      <p style="margin:4px 0 0;font-size:0.7rem;color:#64748b;line-height:1.4;">Built around you, not institutions</p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Expiry note -->
              <p style="margin:0;font-size:0.8rem;color:#94a3b8;line-height:1.6;">
                Questions? Just reply to this email &mdash; we read every one.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:32px;">
              <p style="margin:0;font-size:0.75rem;color:#cbd5e1;">© 2025 Glowbal · Student-first global guidance</p>
              <p style="margin:6px 0 0;font-size:0.75rem;color:#cbd5e1;">You&rsquo;re receiving this because you joined the Glowbal waitlist.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}
