export type ManualEmailAttachment = {
  filename: string;
  contentId: string;
  content?: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

function money(amountVnd: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amountVnd)} ₫`;
}

function dateLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date);
}

export type ManualStudentEmailInput = {
  locale: 'en' | 'vi';
  recipientName: string;
  bankLabel: string;
  accountHolder: string;
  accountNumberMasked: string;
  amountVnd: number;
  reference: string;
  productLabel: string;
  expiresAt: Date;
  statusUrl: string;
  qrCid: string;
};

export function renderManualStudentEmail(input: ManualStudentEmailInput): {
  subject: string;
  html: string;
  text: string;
  attachments: ManualEmailAttachment[];
} {
  const name = escapeHtml(input.recipientName);
  const bank = escapeHtml(input.bankLabel);
  const holder = escapeHtml(input.accountHolder);
  const number = escapeHtml(input.accountNumberMasked);
  const reference = escapeHtml(input.reference);
  const product = escapeHtml(input.productLabel);
  const expires = dateLabel(input.expiresAt);
  const status = escapeHtml(input.statusUrl);
  const emailStatusUrl = `${status}${status.includes('?') ? '&amp;source=email' : '?source=email'}`;
  const vi = input.locale === 'vi';
  return {
    subject: vi ? `Hướng dẫn chuyển khoản GlowBal — ${input.reference}` : `GlowBal bank transfer instructions — ${input.reference}`,
    html: `<div style="font-family:Arial,sans-serif;color:#171717"><h1>${vi ? 'Hướng dẫn chuyển khoản' : 'Bank transfer instructions'}</h1>${vi ? '<p lang="en" style="display:none">Bank transfer instructions</p>' : ''}<p>${vi ? `Xin chào ${name},` : `Hello ${name},`}</p><p>${vi ? 'Vui lòng chuyển đúng số tiền bên dưới để chúng tôi xác nhận đơn hàng.' : 'Please transfer the exact amount below so we can confirm your order.'}</p><img src="cid:${escapeHtml(input.qrCid)}" alt="GlowBal bank transfer QR code" width="240"/><dl><dt>${vi ? 'Ngân hàng' : 'Bank'}</dt><dd>${bank}</dd><dt>${vi ? 'Chủ tài khoản' : 'Account holder'}</dt><dd>${holder}</dd><dt>${vi ? 'Số tài khoản' : 'Account number'}</dt><dd>${number}</dd><dt>${vi ? 'Số tiền' : 'Amount'}</dt><dd><strong>${money(input.amountVnd)}</strong></dd><dt>${vi ? 'Nội dung chuyển khoản' : 'Transfer reference'}</dt><dd><code>${reference}</code></dd><dt>${vi ? 'Sản phẩm' : 'Product'}</dt><dd>${product}</dd><dt>${vi ? 'Hết hạn' : 'Expires'}</dt><dd>${escapeHtml(expires)}</dd></dl><p><a href="${emailStatusUrl}">${vi ? 'Mở trang trạng thái' : 'Open payment status'}</a></p><p>${vi ? 'Quyền truy cập chỉ được cấp sau khi người sáng lập xác nhận.' : 'Access is granted only after the founder confirms receipt.'}</p></div>`,
    text: `${vi ? 'Hướng dẫn chuyển khoản' : 'Bank transfer instructions'}\n\n${vi ? 'Xin chào' : 'Hello'} ${input.recipientName}\n${vi ? 'Ngân hàng' : 'Bank'}: ${input.bankLabel}\n${vi ? 'Chủ tài khoản' : 'Account holder'}: ${input.accountHolder}\n${vi ? 'Số tài khoản' : 'Account number'}: ${input.accountNumberMasked}\n${vi ? 'Số tiền' : 'Amount'}: ${money(input.amountVnd)}\n${vi ? 'Nội dung' : 'Reference'}: ${input.reference}\n${vi ? 'Sản phẩm' : 'Product'}: ${input.productLabel}\n${vi ? 'Hết hạn' : 'Expires'}: ${expires}\n${input.statusUrl}`,
    attachments: [{ filename: 'glowbal-bank-qr.png', contentId: input.qrCid }],
  };
}

export function renderManualFounderEmail(input: {
  reference: string;
  transferDescription?: string;
  amountVnd: number;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  productLabel: string;
  summary: string;
  checkoutCreatedAt: Date;
  claimedAt: Date;
  reviewDeadlineAt: Date;
  reviewUrl: string;
}): { subject: string; html: string; text: string } {
  const phoneValue = input.studentPhone?.trim() || 'Không cung cấp';
  const transferDesc =
    input.transferDescription?.trim() ||
    [input.studentName, input.studentPhone, String(input.amountVnd)].filter(Boolean).join(' ') ||
    input.reference;
  const values = [
    input.reference, transferDesc, input.studentId, input.studentName, input.studentEmail,
    phoneValue, input.productLabel, input.summary, input.reviewUrl,
  ].map(escapeHtml);
  const [reference, transferDescription, studentId, name, email, phone, product, summary, review] = values;
  const checkoutCreated = escapeHtml(dateLabel(input.checkoutCreatedAt));
  const claimed = escapeHtml(dateLabel(input.claimedAt));
  const reviewDeadline = escapeHtml(dateLabel(input.reviewDeadlineAt));
  return {
    subject: `GlowBal — Người dùng đã báo chuyển khoản (${input.reference})`,
    html: `<div style="font-family:Arial,sans-serif;color:#171717;line-height:1.5"><h1>Người dùng đã báo chuyển khoản</h1><p>Vui lòng đối chiếu giao dịch ngân hàng trước khi xác nhận.</p><h2>Thông tin người dùng</h2><table style="border-collapse:collapse"><tr><td style="padding:4px 16px 4px 0"><strong>Họ tên</strong></td><td>${name}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Email</strong></td><td>${email}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Số điện thoại</strong></td><td>${phone}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Mã người dùng</strong></td><td><code>${studentId}</code></td></tr></table><h2>Thông tin thanh toán</h2><table style="border-collapse:collapse"><tr><td style="padding:4px 16px 4px 0"><strong>Nội dung chuyển khoản (VietQR)</strong></td><td><code>${transferDescription}</code></td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Mã giao dịch hệ thống</strong></td><td><code>${reference}</code></td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Sản phẩm</strong></td><td>${product}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Số tiền</strong></td><td><strong>${money(input.amountVnd)}</strong></td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Chi tiết</strong></td><td>${summary}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Tạo yêu cầu lúc</strong></td><td>${checkoutCreated}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Báo đã chuyển lúc</strong></td><td>${claimed}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Hạn duyệt</strong></td><td>${reviewDeadline}</td></tr></table><p style="margin-top:24px"><a href="${review}" style="background:#e51d48;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Xác nhận hoặc từ chối thanh toán</a></p><p>Mở liên kết chỉ để xem. Chỉ xác nhận sau khi tiền đã vào tài khoản.</p></div>`,
    text: `Người dùng đã báo chuyển khoản\n\nTHÔNG TIN NGƯỜI DÙNG\nHọ tên: ${input.studentName}\nEmail: ${input.studentEmail}\nSố điện thoại: ${phoneValue}\nMã người dùng: ${input.studentId}\n\nTHÔNG TIN THANH TOÁN\nNội dung chuyển khoản (VietQR): ${transferDesc}\nMã giao dịch hệ thống: ${input.reference}\nSản phẩm: ${input.productLabel}\nSố tiền: ${money(input.amountVnd)}\nChi tiết: ${input.summary}\nTạo yêu cầu lúc: ${dateLabel(input.checkoutCreatedAt)}\nThời điểm người dùng báo đã chuyển: ${dateLabel(input.claimedAt)}\nHạn duyệt: ${dateLabel(input.reviewDeadlineAt)}\n\nXác nhận hoặc từ chối thanh toán: ${input.reviewUrl}\nChỉ xác nhận sau khi tiền đã vào tài khoản.`,
  };
}

export function renderManualOutcomeEmail(input: {
  confirmed: boolean;
  recipientName: string;
  reference: string;
  productLabel: string;
  statusUrl: string;
}): { subject: string; html: string; text: string } {
  const name = escapeHtml(input.recipientName);
  const reference = escapeHtml(input.reference);
  const product = escapeHtml(input.productLabel);
  const statusUrl = escapeHtml(input.statusUrl);

  if (!input.confirmed) {
    const title = 'Payment needs support';
    const viTitle = 'Thanh toán cần hỗ trợ';
    return {
      subject: `GlowBal — ${viTitle} (${input.reference})`,
      html: `<div style="font-family:Arial,sans-serif;color:#171717;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff"><h1 style="font-size:20px;color:#e11d48;margin-bottom:16px">${viTitle} / ${title}</h1><p>Xin chào <strong>${name}</strong>,</p><p>Yêu cầu thanh toán cho gói <strong>${product}</strong> cần được hỗ trợ thêm.</p><p>Mã giao dịch: <code>${reference}</code></p><p><a href="${statusUrl}" style="color:#2563eb;text-decoration:underline">Xem chi tiết trạng thái thanh toán</a></p><p>Nếu cần hỗ trợ, vui lòng liên hệ: <a href="mailto:glowbal.edu@gmail.com" style="color:#2563eb">glowbal.edu@gmail.com</a></p><div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:20px;font-size:14px;color:#334155"><p style="margin:0 0 4px">Trân trọng,</p><p style="margin:0;font-weight:bold;color:#0f172a">GLOWBAL EDUCATION</p></div></div>`,
      text: `${viTitle}\n\nXin chào ${input.recipientName},\n\nYêu cầu thanh toán cho gói ${input.productLabel} cần được hỗ trợ thêm.\nMã giao dịch: ${input.reference}\nChi tiết: ${input.statusUrl}\nEmail hỗ trợ: glowbal.edu@gmail.com\n\nTrân trọng,\nGLOWBAL EDUCATION`,
    };
  }

  const communityUrl = 'https://zalo.me/g/ggrpc483k4joxoev6dat';
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https%3A%2F%2Fzalo.me%2Fg%2Fggrpc483k4joxoev6dat';

  return {
    subject: `GlowBal — Xác nhận thanh toán thành công (${input.reference})`,
    html: `<div style="font-family:Arial,sans-serif;color:#171717;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff">
  <div style="margin-bottom:20px">
    <strong style="color:#e11d48;font-size:18px;letter-spacing:0.5px">GLOWBAL EDUCATION</strong>
  </div>
  <p style="font-size:15px;margin-bottom:16px">Xin chào <strong>${name}</strong>,</p>
  <p style="font-size:15px;margin-bottom:16px">GlowBal xác nhận bạn đã thanh toán thành công gói <strong>${product}</strong>. Cảm ơn bạn đã tin tưởng và lựa chọn đồng hành cùng GlowBal trên hành trình chinh phục những cơ hội học tập toàn cầu.</p>
  <p style="font-size:15px;margin-bottom:16px">Từ hôm nay, bạn đã chính thức trở thành một phần của <strong>GlowBal Community</strong> nơi bạn có thể kết nối với những bạn trẻ cùng mục tiêu, cập nhật cơ hội học bổng, chia sẻ kinh nghiệm du học và học hỏi từ các Achiever/Mentor trong cộng đồng.</p>
  <p style="font-size:15px;margin-bottom:12px">Tham gia GlowBal Community: <a href="${communityUrl}" style="color:#2563eb;text-decoration:underline;font-weight:600" target="_blank" rel="noopener noreferrer">${communityUrl}</a></p>
  <p style="font-size:15px;margin-bottom:8px">QR tham gia cộng đồng:</p>
  <div style="margin:12px 0 20px">
    <img src="${qrUrl}" alt="QR tham gia cộng đồng" width="180" height="180" style="display:block;border-radius:8px;border:1px solid #cbd5e1" />
  </div>
  <p style="font-size:15px;margin-bottom:20px">Hy vọng GlowBal sẽ trở thành người bạn đồng hành hữu ích, giúp bạn tự tin hơn trong từng bước chuẩn bị hồ sơ và tiến gần hơn đến ngôi trường mơ ước.</p>
  <p style="font-size:16px;font-weight:bold;color:#e11d48;letter-spacing:1px;margin:24px 0 20px">GO GLOW – GO GLOBAL</p>
  <div style="border-top:1px solid #e2e8f0;padding-top:20px;font-size:14px;color:#334155;line-height:1.6">
    <p style="margin:0 0 4px">Trân trọng,</p>
    <p style="margin:0 0 8px;font-weight:bold;color:#0f172a">GLOWBAL EDUCATION</p>
    <p style="margin:0 0 4px">Email: <a href="mailto:glowbal.edu@gmail.com" style="color:#2563eb;text-decoration:none">glowbal.edu@gmail.com</a></p>
    <p style="margin:0">Website: <a href="https://glowbal-education.com" style="color:#2563eb;text-decoration:none" target="_blank" rel="noopener noreferrer">GlowBal Education</a></p>
  </div>
  <div style="margin-top:24px;padding-top:12px;border-top:1px dashed #cbd5e1;font-size:12px;color:#64748b">
    Mã giao dịch: <code>${reference}</code> · <a href="${statusUrl}" style="color:#64748b;text-decoration:underline">Xem chi tiết trạng thái</a>
  </div>
</div>`,
    text: `Xin chào ${input.recipientName},

GlowBal xác nhận bạn đã thanh toán thành công gói ${input.productLabel}. Cảm ơn bạn đã tin tưởng và lựa chọn đồng hành cùng GlowBal trên hành trình chinh phục những cơ hội học tập toàn cầu.

Từ hôm nay, bạn đã chính thức trở thành một phần của GlowBal Community nơi bạn có thể kết nối với những bạn trẻ cùng mục tiêu, cập nhật cơ hội học bổng, chia sẻ kinh nghiệm du học và học hỏi từ các Achiever/Mentor trong cộng đồng.

Tham gia GlowBal Community: ${communityUrl}
QR tham gia cộng đồng: ${communityUrl}

Hy vọng GlowBal sẽ trở thành người bạn đồng hành hữu ích, giúp bạn tự tin hơn trong từng bước chuẩn bị hồ sơ và tiến gần hơn đến ngôi trường mơ ước.

GO GLOW – GO GLOBAL

Trân trọng,
GLOWBAL EDUCATION
Email: glowbal.edu@gmail.com
Website: GlowBal Education

---
Mã giao dịch: ${input.reference}
Chi tiết: ${input.statusUrl}`,
  };
}
