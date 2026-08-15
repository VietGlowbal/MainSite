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
  const values = [
    input.reference, input.studentId, input.studentName, input.studentEmail,
    phoneValue, input.productLabel, input.summary, input.reviewUrl,
  ].map(escapeHtml);
  const [reference, studentId, name, email, phone, product, summary, review] = values;
  const checkoutCreated = escapeHtml(dateLabel(input.checkoutCreatedAt));
  const claimed = escapeHtml(dateLabel(input.claimedAt));
  const reviewDeadline = escapeHtml(dateLabel(input.reviewDeadlineAt));
  return {
    subject: `GlowBal — Người dùng đã báo chuyển khoản (${input.reference})`,
    html: `<div style="font-family:Arial,sans-serif;color:#171717;line-height:1.5"><h1>Người dùng đã báo chuyển khoản</h1><p>Vui lòng đối chiếu giao dịch ngân hàng trước khi xác nhận.</p><h2>Thông tin người dùng</h2><table style="border-collapse:collapse"><tr><td style="padding:4px 16px 4px 0"><strong>Họ tên</strong></td><td>${name}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Email</strong></td><td>${email}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Số điện thoại</strong></td><td>${phone}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Mã người dùng</strong></td><td><code>${studentId}</code></td></tr></table><h2>Thông tin thanh toán</h2><table style="border-collapse:collapse"><tr><td style="padding:4px 16px 4px 0"><strong>Mã chuyển khoản</strong></td><td><code>${reference}</code></td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Sản phẩm</strong></td><td>${product}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Số tiền</strong></td><td><strong>${money(input.amountVnd)}</strong></td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Chi tiết</strong></td><td>${summary}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Tạo yêu cầu lúc</strong></td><td>${checkoutCreated}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Báo đã chuyển lúc</strong></td><td>${claimed}</td></tr><tr><td style="padding:4px 16px 4px 0"><strong>Hạn duyệt</strong></td><td>${reviewDeadline}</td></tr></table><p style="margin-top:24px"><a href="${review}" style="background:#e51d48;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Xác nhận hoặc từ chối thanh toán</a></p><p>Mở liên kết chỉ để xem. Chỉ xác nhận sau khi tiền đã vào tài khoản.</p></div>`,
    text: `Người dùng đã báo chuyển khoản\n\nTHÔNG TIN NGƯỜI DÙNG\nHọ tên: ${input.studentName}\nEmail: ${input.studentEmail}\nSố điện thoại: ${phoneValue}\nMã người dùng: ${input.studentId}\n\nTHÔNG TIN THANH TOÁN\nMã chuyển khoản: ${input.reference}\nSản phẩm: ${input.productLabel}\nSố tiền: ${money(input.amountVnd)}\nChi tiết: ${input.summary}\nTạo yêu cầu lúc: ${dateLabel(input.checkoutCreatedAt)}\nThời điểm người dùng báo đã chuyển: ${dateLabel(input.claimedAt)}\nHạn duyệt: ${dateLabel(input.reviewDeadlineAt)}\n\nXác nhận hoặc từ chối thanh toán: ${input.reviewUrl}\nChỉ xác nhận sau khi tiền đã vào tài khoản.`,
  };
}

export function renderManualOutcomeEmail(input: { confirmed: boolean; recipientName: string; reference: string; productLabel: string; statusUrl: string }): { subject: string; html: string; text: string } {
  const name = escapeHtml(input.recipientName);
  const reference = escapeHtml(input.reference);
  const product = escapeHtml(input.productLabel);
  const statusUrl = escapeHtml(input.statusUrl);
  const title = input.confirmed ? 'Payment confirmed' : 'Payment needs support';
  const viTitle = input.confirmed ? 'Đã xác nhận thanh toán' : 'Thanh toán cần hỗ trợ';
  return {
    subject: `GlowBal — ${title} (${input.reference})`,
    html: `<div style="font-family:Arial,sans-serif"><h1>${viTitle} / ${title}</h1><p>Hello ${name},</p><p>${input.confirmed ? `Your payment for ${product} was confirmed.` : `Your payment for ${product} needs support review.`}</p><p>Reference: <code>${reference}</code></p><p><a href="${statusUrl}">Open payment status</a></p></div>`,
    text: `${title}\nHello ${input.recipientName}\nProduct: ${input.productLabel}\nReference: ${input.reference}\n${input.statusUrl}`,
  };
}
