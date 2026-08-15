import { EMAIL_BRAND, EMAIL_SOCIALS } from './config';

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function emailButton(label: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:30px auto 0;">
      <tr>
        <td align="center" bgcolor="${EMAIL_BRAND.colours.brand}" style="border-radius:999px;box-shadow:0 10px 28px rgba(225,29,72,.26);">
          <a href="${escapeHtml(href)}" style="display:inline-block;min-width:250px;padding:15px 28px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;text-align:center;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

export function trustRow(): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 0;">
      <tr>
        <td valign="top" style="padding-right:10px;color:${EMAIL_BRAND.colours.brandBright};font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:22px;">◇</td>
        <td style="font-family:Arial,Helvetica,sans-serif;text-align:left;">
          <div style="font-size:14px;line-height:20px;font-weight:700;color:${EMAIL_BRAND.colours.text};">Secure. Private. Always you.</div>
          <div style="font-size:12px;line-height:18px;color:${EMAIL_BRAND.colours.muted};">Your information is handled securely by GlowBal.</div>
        </td>
      </tr>
    </table>`;
}

export function metricRow(items: Array<{ label: string; value: string }>): string {
  if (!items.length) return '';
  const width = Math.floor(100 / items.length);
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-collapse:separate;border-spacing:8px 0;">
      <tr>
        ${items.map((item) => `
          <td width="${width}%" style="background:${EMAIL_BRAND.colours.cardSoft};border:1px solid ${EMAIL_BRAND.colours.line};border-radius:12px;padding:16px 10px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
            <div style="font-size:22px;line-height:28px;font-weight:800;color:${EMAIL_BRAND.colours.text};">${escapeHtml(item.value)}</div>
            <div style="margin-top:4px;font-size:11px;line-height:16px;color:${EMAIL_BRAND.colours.secondary};">${escapeHtml(item.label)}</div>
          </td>`).join('')}
      </tr>
    </table>`;
}

function socialRow(includeSocials: boolean): string {
  if (!includeSocials) return '';
  const available = EMAIL_SOCIALS.filter((social) => social.href);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 0;">
      <tr>
        ${available.map((social) => `
          <td style="padding:0 6px;">
            <a href="${escapeHtml(social.href)}" aria-label="${escapeHtml(social.label)}" style="display:block;width:38px;height:38px;border-radius:999px;border:1px solid #3a3a3f;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:38px;font-weight:700;text-align:center;">${escapeHtml(social.glyph)}</a>
          </td>`).join('')}
      </tr>
    </table>`;
}

export type GlowbalEmailLayoutOptions = {
  preheader?: string;
  eyebrow?: string;
  titleHtml: string;
  bodyHtml: string;
  actionHtml?: string;
  afterActionHtml?: string;
  hero?: boolean;
  includeSocials?: boolean;
  footerNote?: string;
  unsubscribeUrl?: string;
};

export function glowbalEmailLayout({
  preheader = '',
  eyebrow,
  titleHtml,
  bodyHtml,
  actionHtml = '',
  afterActionHtml = '',
  hero = false,
  includeSocials = true,
  footerNote,
  unsubscribeUrl,
}: GlowbalEmailLayoutOptions): string {
  const c = EMAIL_BRAND.colours;
  const year = new Date().getFullYear();
  const footerSecondary = footerNote
    ? `<div style="margin-top:7px;">${escapeHtml(footerNote)}</div>`
    : '';
  const unsubscribe = unsubscribeUrl
    ? `<div style="margin-top:8px;"><a href="${escapeHtml(unsubscribeUrl)}" style="color:${c.secondary};text-decoration:underline;">Unsubscribe</a></div>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>GlowBal</title>
</head>
<body style="margin:0;padding:0;background:${c.background};color:${c.text};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.background}" style="width:100%;background:${c.background};">
    <tr>
      <td align="center" style="padding:38px 16px 42px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
          <tr>
            <td align="center" style="padding:0 0 22px;">
              <a href="${escapeHtml(EMAIL_BRAND.siteUrl)}" style="text-decoration:none;">
                <img src="${escapeHtml(EMAIL_BRAND.logoUrl)}" width="172" alt="GlowBal" style="display:block;width:172px;max-width:72%;height:auto;border:0;outline:none;" />
              </a>
              <div style="margin-top:7px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;letter-spacing:.16em;color:#d4d4d4;text-transform:uppercase;">${escapeHtml(EMAIL_BRAND.tagline)}</div>
            </td>
          </tr>
          ${hero ? `
          <tr>
            <td align="center" style="padding:0;">
              <img src="${escapeHtml(EMAIL_BRAND.globeUrl)}" width="520" alt="" style="display:block;width:100%;max-width:520px;height:auto;border:0;outline:none;opacity:.92;" />
            </td>
          </tr>` : ''}
          <tr>
            <td style="background:${c.card};border:1px solid #3b121d;border-radius:22px;padding:42px 34px;text-align:center;box-shadow:0 18px 54px rgba(225,29,72,.10);">
              ${eyebrow ? `<div style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;font-weight:800;letter-spacing:.18em;color:${c.brandBright};text-transform:uppercase;">${escapeHtml(eyebrow)}</div>` : ''}
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:34px;line-height:40px;font-weight:800;letter-spacing:-.025em;color:${c.text};">${titleHtml}</div>
              <div style="width:46px;height:2px;margin:22px auto 0;background:${c.brand};font-size:0;line-height:0;">&nbsp;</div>
              <div style="max-width:430px;margin:24px auto 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:${c.secondary};">${bodyHtml}</div>
              ${actionHtml}
              ${afterActionHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 12px;">
              ${socialRow(includeSocials)}
              <div style="margin-top:24px;border-top:1px solid #242428;padding-top:22px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;color:${c.muted};text-align:center;">
                <div>© ${year} GlowBal · ${escapeHtml(EMAIL_BRAND.tagline)}</div>
                ${footerSecondary}
                ${unsubscribe}
                <div style="margin-top:7px;">Need help? <a href="mailto:${EMAIL_BRAND.supportEmail}" style="color:${c.secondary};text-decoration:none;">${EMAIL_BRAND.supportEmail}</a></div>
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
