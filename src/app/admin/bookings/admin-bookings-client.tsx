'use client';

import { useState } from 'react';
import { Badge, Button, Panel, StatTile, type BadgeVariant } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { EmptyRow, TableShell, TD, TH } from '../_ui';

export type PaymentItem = {
  id: string;
  transactionId?: string;
  bookingId?: number;
  reference: string;
  provider: string;
  productType: 'plus' | 'mentorship';
  productTitle: string;
  productSubtitle: string;
  amountVnd: number;
  feeAmountVnd: number;
  customerName: string;
  customerEmail: string;
  status: string;
  isClaimed: boolean;
  claimedAt?: string | null;
  createdAt: string;
  expiresAt?: string | null;
  achieverName?: string;
};

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function StatusBadge({ status, isClaimed }: { status: string; isClaimed?: boolean }) {
  if (status === 'claimed' || (status === 'pending' && isClaimed)) {
    return (
      <Badge variant="brand-chip" className="bg-blue-100 text-blue-800 border-blue-200 animate-pulse">
        ✓ Đã báo chuyển tiền (Claimed)
      </Badge>
    );
  }

  switch (status) {
    case 'pending':
    case 'pending_payment':
      return <Badge variant="brand-chip">Chờ thanh toán (Pending)</Badge>;
    case 'confirmed':
    case 'fulfilled':
      return <Badge variant="safe-chip">Đã duyệt (Confirmed)</Badge>;
    case 'completed':
    case 'reviewed':
      return <Badge variant="safe-chip">Hoàn thành (Completed)</Badge>;
    case 'failed':
    case 'rejected':
      return <Badge variant="neutral-chip" className="text-red-700 bg-red-50 border-red-200">Đã từ chối (Rejected)</Badge>;
    case 'expired':
      return <Badge variant="neutral-chip">Hết hạn (Expired)</Badge>;
    default:
      return <Badge variant="neutral-chip">{status}</Badge>;
  }
}

export function AdminBookingsClient({ initialItems }: { initialItems: PaymentItem[] }) {
  const [items, setItems] = useState<PaymentItem[]>(initialItems);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'plus' | 'mentorship'>('all');
  const [feedback, setFeedback] = useState<{ id: string; message: string; tone: 'safe' | 'error' } | null>(null);

  useLoadingIndicator(updatingId !== null, 'Đang cập nhật giao dịch…');

  const pendingItems = items.filter(
    (item) => item.status === 'pending' || item.status === 'pending_payment' || item.status === 'claimed',
  );
  const confirmedItems = items.filter(
    (item) => item.status === 'confirmed' || item.status === 'fulfilled' || item.status === 'completed' || item.status === 'reviewed',
  );

  const totalRevenue = confirmedItems.reduce((sum, item) => sum + item.feeAmountVnd, 0);

  async function handleReviewAction(item: PaymentItem, action: 'confirm' | 'reject') {
    if (action === 'reject' && !window.confirm(`Bạn có chắc chắn muốn từ chối giao dịch ${item.reference}?`)) {
      return;
    }

    setUpdatingId(item.id);
    setFeedback(null);

    try {
      const response = await fetch('/api/admin/payments/review-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          transactionId: item.transactionId,
          bookingId: item.bookingId,
          note: action === 'confirm' ? 'Confirmed by Founder via Admin Console' : 'Rejected by Founder',
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFeedback({
          id: item.id,
          message: data.error || 'Có lỗi xảy ra khi cập nhật giao dịch',
          tone: 'error',
        });
        setUpdatingId(null);
        return;
      }

      const newStatus = action === 'confirm' ? (item.productType === 'plus' ? 'fulfilled' : 'confirmed') : (action === 'reject' ? 'rejected' : 'failed');

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: newStatus, isClaimed: false }
            : i,
        ),
      );

      setFeedback({
        id: item.id,
        message: action === 'confirm' ? `Đã duyệt thành công giao dịch ${item.reference}!` : `Đã từ chối giao dịch ${item.reference}`,
        tone: 'safe',
      });
    } catch {
      setFeedback({
        id: item.id,
        message: 'Không thể kết nối đến máy chủ',
        tone: 'error',
      });
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredItems = items.filter((item) => {
    if (filter === 'pending') {
      return item.status === 'pending' || item.status === 'pending_payment' || item.status === 'claimed';
    }
    if (filter === 'confirmed') {
      return item.status === 'confirmed' || item.status === 'fulfilled' || item.status === 'completed' || item.status === 'reviewed';
    }
    if (filter === 'plus') {
      return item.productType === 'plus';
    }
    if (filter === 'mentorship') {
      return item.productType === 'mentorship';
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-gb-4xl">
      {/* Metric Tiles */}
      <div className="grid gap-gb-xl sm:grid-cols-3">
        <StatTile
          label="Chờ duyệt thanh toán"
          value={pendingItems.length}
          hint={pendingItems.some((i) => i.isClaimed) ? `${pendingItems.filter((i) => i.isClaimed).length} người dùng đã báo chuyển` : 'Đang chờ giao dịch'}
          tone={pendingItems.length > 0 ? 'brand' : 'default'}
        />
        <StatTile
          label="Giao dịch thành công"
          value={confirmedItems.length}
          hint="Gói Plus & buổi tư vấn đã kích hoạt"
          tone="info"
        />
        <StatTile
          label="Doanh thu nền tảng GlowBal"
          value={formatVND(totalRevenue)}
          hint="Phí từ các phiên & gói dịch vụ đã duyệt"
          tone={totalRevenue > 0 ? 'safe' : 'default'}
        />
      </div>

      {/* Awaiting Payment Confirmation Section */}
      <section className="flex flex-col gap-gb-xl">
        <div className="flex flex-wrap items-center justify-between gap-gb-md">
          <h3 className="text-gb-lg font-semibold text-fg">
            Chờ founder duyệt thanh toán ({pendingItems.length})
          </h3>
          {pendingItems.some((i) => i.isClaimed) && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
              <span className="size-2 animate-ping rounded-full bg-blue-600" />
              Có {pendingItems.filter((i) => i.isClaimed).length} giao dịch khách đã xác nhận chuyển tiền
            </span>
          )}
        </div>

        {pendingItems.length === 0 ? (
          <Panel className="text-center text-gb-sm text-fg-muted py-gb-4xl">
            Không có giao dịch nào đang chờ duyệt.
          </Panel>
        ) : (
          pendingItems.map((item) => (
            <Panel key={item.id} className="flex flex-col gap-gb-xl border-l-4 border-l-brand">
              <div className="flex flex-wrap items-start justify-between gap-gb-xl">
                <div className="flex min-w-0 flex-col gap-gb-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-block rounded-md bg-surface-muted px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-fg-secondary border border-line">
                      {item.productType === 'plus' ? 'Gói Plus' : 'Mentorship'}
                    </span>
                    <p className="text-gb-md font-bold text-fg">
                      {item.productTitle}
                    </p>
                  </div>

                  <p className="text-gb-sm text-fg-secondary">
                    Khách hàng: <span className="font-semibold text-fg">{item.customerName}</span> ({item.customerEmail})
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-gb-sm text-fg-tertiary">
                    <span>
                      Số tiền: <strong className="text-base text-brand">{formatVND(item.amountVnd)}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Mã chuyển khoản:{' '}
                      <code className="rounded bg-brand/10 px-2 py-0.5 font-mono text-xs font-bold text-brand select-all border border-brand/20">
                        {item.reference}
                      </code>
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-3 text-gb-xs text-fg-muted">
                    <span>Tạo lúc: {formatDate(item.createdAt)}</span>
                    {item.claimedAt && (
                      <>
                        <span>·</span>
                        <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          Khách báo đã chuyển tiền lúc: {formatDate(item.claimedAt)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <StatusBadge status={item.status} isClaimed={item.isClaimed} />
              </div>

              <dl className="grid gap-gb-xl rounded-gb-xl border border-line bg-surface-muted p-gb-2xl sm:grid-cols-3">
                <div className="flex flex-col gap-gb-xxs">
                  <dt className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                    Phương thức
                  </dt>
                  <dd className="text-gb-sm font-medium text-fg-secondary">
                    {item.provider === 'manual_bank_transfer' ? 'Chuyển khoản VietQR (Techcombank)' : 'VNPay'}
                  </dd>
                </div>
                <div className="flex flex-col gap-gb-xxs">
                  <dt className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                    Chi tiết sản phẩm
                  </dt>
                  <dd className="text-gb-sm text-fg-secondary">
                    {item.productSubtitle}
                  </dd>
                </div>
                <div className="flex flex-col gap-gb-xxs">
                  <dt className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                    Phí nền tảng GlowBal
                  </dt>
                  <dd className="text-gb-sm font-semibold text-emerald-700">
                    {formatVND(item.feeAmountVnd)}
                  </dd>
                </div>
              </dl>

              {feedback?.id === item.id && (
                <div
                  className={`rounded-lg p-3 text-sm ${
                    feedback.tone === 'safe'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {feedback.message}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-gb-lg border-t border-line pt-gb-xl">
                <Button
                  onClick={() => void handleReviewAction(item, 'confirm')}
                  disabled={updatingId === item.id}
                  size="lg"
                  className="shadow-sm"
                >
                  {updatingId === item.id ? 'Đang xử lý…' : '✓ Xác nhận & Duyệt thanh toán'}
                </Button>
                <Button
                  onClick={() => void handleReviewAction(item, 'reject')}
                  disabled={updatingId === item.id}
                  variant="secondary"
                  size="lg"
                >
                  Từ chối giao dịch
                </Button>
              </div>
            </Panel>
          ))
        )}
      </section>

      {/* All Bookings & Transactions Table */}
      <section className="flex flex-col gap-gb-xl">
        <div className="flex flex-wrap items-center justify-between gap-gb-md">
          <h3 className="text-gb-lg font-semibold text-fg">Tất cả giao dịch & lượt đặt</h3>
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-line bg-surface p-1 text-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filter === 'all' ? 'bg-brand text-on-brand' : 'text-fg-secondary hover:text-fg'
              }`}
            >
              Tất cả ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filter === 'pending' ? 'bg-brand text-on-brand' : 'text-fg-secondary hover:text-fg'
              }`}
            >
              Chờ duyệt ({pendingItems.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('confirmed')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filter === 'confirmed' ? 'bg-brand text-on-brand' : 'text-fg-secondary hover:text-fg'
              }`}
            >
              Đã duyệt ({confirmedItems.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('plus')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filter === 'plus' ? 'bg-brand text-on-brand' : 'text-fg-secondary hover:text-fg'
              }`}
            >
              Gói Plus ({items.filter((i) => i.productType === 'plus').length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('mentorship')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filter === 'mentorship' ? 'bg-brand text-on-brand' : 'text-fg-secondary hover:text-fg'
              }`}
            >
              Mentorship ({items.filter((i) => i.productType === 'mentorship').length})
            </button>
          </div>
        </div>

        <TableShell>
          <thead className="border-b border-line bg-surface-muted">
            <tr>
              <th scope="col" className={TH}>Mã giao dịch</th>
              <th scope="col" className={TH}>Sản phẩm / Dịch vụ</th>
              <th scope="col" className={TH}>Khách hàng</th>
              <th scope="col" className={`${TH} text-right`}>Số tiền</th>
              <th scope="col" className={TH}>Trạng thái</th>
              <th scope="col" className={TH}>Ngày tạo</th>
              <th scope="col" className={`${TH} text-right`}>Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredItems.length === 0 ? (
              <EmptyRow colSpan={7}>Không có giao dịch nào phù hợp.</EmptyRow>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-surface-hover/40 transition-colors">
                  <td className={`${TD} font-mono text-gb-xs font-semibold text-brand select-all`}>
                    {item.reference}
                  </td>
                  <td className={TD}>
                    <div className="flex flex-col">
                      <span className="font-medium text-fg">{item.productTitle}</span>
                      <span className="text-gb-xs text-fg-muted">{item.productSubtitle}</span>
                    </div>
                  </td>
                  <td className={TD}>
                    <div className="flex flex-col">
                      <span className="font-medium text-fg">{item.customerName}</span>
                      <span className="text-gb-xs text-fg-tertiary">{item.customerEmail}</span>
                    </div>
                  </td>
                  <td className={`${TD} text-right font-bold text-fg`}>
                    {formatVND(item.amountVnd)}
                  </td>
                  <td className={TD}>
                    <StatusBadge status={item.status} isClaimed={item.isClaimed} />
                  </td>
                  <td className={`${TD} text-fg-muted text-gb-xs`}>
                    {formatDate(item.createdAt)}
                  </td>
                  <td className={`${TD} text-right`}>
                    {(item.status === 'pending' || item.status === 'pending_payment' || item.status === 'claimed') ? (
                      <button
                        type="button"
                        onClick={() => void handleReviewAction(item, 'confirm')}
                        disabled={updatingId === item.id}
                        className="inline-flex items-center rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand shadow-sm hover:opacity-90 disabled:opacity-50"
                      >
                        {updatingId === item.id ? '…' : 'Duyệt'}
                      </button>
                    ) : (
                      <span className="text-xs text-fg-muted">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      </section>
    </div>
  );
}
