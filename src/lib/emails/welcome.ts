import { escapeHtml } from '@/lib/email/template';
import { EMAIL_BRAND } from '@/lib/email/config';

/**
 * Welcome email sent right after a successful registration.
 *
 * Styled after glowbal-resend-v2/emails/GlowBalLaunch.tsx (dark hero with the
 * GO/GLOWBAL brand block, image strip, big pill CTA, gradient wordmark and
 * contact footer). Images are served from `assetsBaseUrl` (default: site URL)
 * so the same template works in production and in Resend test sends.
 */
export function welcomeEmail(input: {
  firstName?: string;
  nextUrl: string;
  onboardingComplete?: boolean;
  assetsBaseUrl?: string;
}): string {
  const name = input.firstName?.trim();
  const base = (input.assetsBaseUrl ?? EMAIL_BRAND.siteUrl).replace(/\/$/, '');
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
  const action = input.onboardingComplete ? 'Continue my strategy →' : 'Build my GlowBal profile →';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>GlowBal</title>
<style>
  @media only screen and (max-width: 620px) {
    .shell { width: 100% !important; }
    .pad { padding-left: 20px !important; padding-right: 20px !important; }
    .hero-copy { font-size: 17px !important; line-height: 1.45 !important; }
    .hero-title { font-size: 25px !important; }
    .brand-go { font-size: 62px !important; line-height: 0.85 !important; }
    .brand-side { font-size: 21px !important; line-height: 1.05 !important; }
    .body-copy { font-size: 15px !important; line-height: 1.55 !important; }
    .cta-wrap { padding-left: 20px !important; padding-right: 20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:28px 10px;background-color:#f0f1f5;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Your GlowBal account is ready — welcome in.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" class="shell" style="width:600px;max-width:600px;margin:0 auto;background-color:#000000;">
    <tr>
      <td style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#080000;background-image:radial-gradient(circle at 88% 35%, #68101d 0%, #230307 31%, #080000 66%);">
          <tr>
            <td class="pad" style="padding:34px 48px 38px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td style="width:48%;vertical-align:middle;">
                    <div class="brand-go" style="color:#ffffff;font-size:82px;line-height:0.82;font-weight:900;letter-spacing:-6px;margin:0;">GO</div>
                  </td>
                  <td style="width:52%;vertical-align:middle;text-align:right;">
                    <div class="brand-side" style="color:#ffffff;font-size:27px;line-height:1;font-weight:900;letter-spacing:-1px;margin:0;">GLOW ✦</div>
                    <div class="brand-side" style="color:#ffffff;font-size:27px;line-height:1;font-weight:900;letter-spacing:-1px;margin:2px 0 0;">GLOWBAL</div>
                  </td>
                </tr>
              </table>

              <div class="hero-title" style="color:#ffffff;font-size:28px;line-height:1.25;font-weight:700;margin:0 0 20px;">${greeting}</div>

              <div class="hero-copy" style="color:#ffffff;font-size:18px;line-height:1.45;margin:0 0 24px;">
                Before anything else, <span style="color:#e11d48;font-weight:700;">thank you</span> for trusting GlowBal. Your account is ready — and so is your path to university.
              </div>

              <div class="hero-copy" style="color:#ffffff;font-size:18px;line-height:1.45;margin:0;">
                You&apos;ve just joined a community of students who plan their applications smarter, and we&apos;re excited to build your journey with you.
              </div>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td class="pad" style="background-color:#000000;padding:24px 24px 0;">
              <img src="${base}/glowbal/progress.jpg" width="552" alt="GlowBal progress: startup competition, incubation, meetings and system testing" style="display:block;width:100%;max-width:100%;height:auto;border:0;margin:0 0 18px;" />
              <div class="body-copy" style="color:#ffffff;font-size:16px;line-height:1.48;margin:0 0 18px;">
                And because you&apos;re now part of GlowBal, there&apos;s a lot waiting for you:
              </div>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;">
          <tr>
            <td style="padding:0;">
              <img src="${base}/glowbal/benefits.png" width="600" alt="GlowBal member benefits" style="display:block;width:100%;height:auto;border:0;margin:0;" />
              <img src="${base}/glowbal/mentor.png" width="600" alt="Real mentor support" style="display:block;width:100%;height:auto;border:0;margin:0;" />
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td class="cta-wrap" style="background-color:#000000;padding:8px 24px 22px;text-align:center;">
              <a href="${escapeHtml(input.nextUrl)}" style="display:inline-block;min-width:320px;background-color:#d91e46;color:#ffffff;border-radius:28px;font-size:20px;line-height:1.2;font-weight:700;text-decoration:none;text-align:center;padding:14px 28px;">${escapeHtml(action)}</a>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td class="pad" style="background-color:#000000;padding:0 24px 2px;">
              <div class="body-copy" style="color:#ffffff;font-size:16px;line-height:1.48;margin:0 0 18px;">
                This is our first public release, and we&apos;re still improving GlowBal every day. If something feels confusing, you spot a bug, or you simply have an idea for us, <strong>reply directly to this email</strong> — we genuinely want to hear it!
              </div>

              <div class="body-copy" style="color:#ffffff;font-size:16px;line-height:1.48;margin:0 0 18px;">
                Thank you once again for your trust, patience, and continued support. Your feedback means a great deal to our team, and we&apos;re excited to keep building a better experience together.
              </div>

              <div class="body-copy" style="color:#ffffff;font-size:16px;line-height:1.48;margin:0;">
                Best regards,<br />
                <strong style="color:#e11d48;">The GlowBal Team</strong>
              </div>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background-color:#ef3340;background-image:linear-gradient(90deg,#ff4e78,#ff2f25 43%,#27c7dd 72%,#116b78);padding:24px 18px;text-align:center;">
              <div style="color:#ffffff;font-size:58px;line-height:1;font-weight:900;letter-spacing:-4px;margin:0;">GLOWBAL</div>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td class="pad" style="background-color:#090909;padding:22px 24px 28px;text-align:center;">
              <div style="margin:0 0 14px;font-size:14px;line-height:1.5;">
                <a href="https://www.facebook.com/glowbal.education" style="color:#ffffff;text-decoration:underline;">Facebook</a>
                <span style="color:#6f6f6f;"> | </span>
                <a href="https://www.instagram.com/glowbal_education/" style="color:#ffffff;text-decoration:underline;">Instagram</a>
                <span style="color:#6f6f6f;"> | </span>
                <a href="https://www.linkedin.com/company/glowbal-education" style="color:#ffffff;text-decoration:underline;">LinkedIn</a>
              </div>
              <hr style="border-color:#282828;margin:0 0 14px;" />
              <div style="color:#bcbcbc;font-size:12px;line-height:1.7;margin:0;">
                <strong>GlowBal Education</strong><br />
                Tel: <a href="tel:+84911552005" style="color:#ffffff;text-decoration:underline;">(+84) 911 552 005</a><br />
                Email: <a href="mailto:glowbal.edu@gmail.com" style="color:#ffffff;text-decoration:underline;">glowbal.edu@gmail.com</a><br />
                Hanoi, Vietnam
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
