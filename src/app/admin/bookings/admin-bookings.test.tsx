import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminBookingsClient, type PaymentItem } from './admin-bookings-client';

vi.mock('@/shared/ui/loading-overlay', () => ({ useLoadingIndicator: vi.fn() }));

const mockItems: PaymentItem[] = [
  {
    id: 'tx-1',
    transactionId: 'tx-1',
    reference: 'GLOWMANUALPRO01',
    provider: 'manual_bank_transfer',
    productType: 'plus',
    productTitle: 'GlowBal Plus · Pro (12 Months / 1 Năm)',
    productSubtitle: '10 AI Strategy Credits · 12 Months',
    amountVnd: 2490000,
    feeAmountVnd: 2490000, // 100% of Plus plan is GlowBal platform revenue
    customerName: 'Nguyen Van A',
    customerEmail: 'a@example.com',
    status: 'confirmed',
    isClaimed: false,
    createdAt: '2026-08-15T10:00:00Z',
  },
  {
    id: 'tx-2',
    transactionId: 'tx-2',
    reference: 'GLOWMANUALSTARTER02',
    provider: 'manual_bank_transfer',
    productType: 'plus',
    productTitle: 'GlowBal Plus · Starter (1 Month)',
    productSubtitle: '3 AI Strategy Credits · 1 Month',
    amountVnd: 299000,
    feeAmountVnd: 299000,
    customerName: 'Tran Thi B',
    customerEmail: 'b@example.com',
    status: 'claimed',
    isClaimed: true,
    claimedAt: '2026-08-15T12:00:00Z',
    createdAt: '2026-08-15T11:00:00Z',
  },
];

describe('AdminBookingsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('calculates initial platform revenue from confirmed items', () => {
    render(<AdminBookingsClient initialItems={mockItems} />);

    // Total confirmed revenue should be 2.490.000 ₫
    expect(screen.getAllByText('2.490.000 ₫').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Doanh thu nền tảng GlowBal')).toBeInTheDocument();
    expect(screen.getByText('Chờ duyệt thanh toán')).toBeInTheDocument();
  });

  it('updates total revenue immediately after approving a pending transaction', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminBookingsClient initialItems={mockItems} />);

    // Initially 1 pending, 1 confirmed, total revenue = 2.490.000 ₫
    expect(screen.getAllByText('2.490.000 ₫').length).toBeGreaterThanOrEqual(1);

    // Click confirm on the pending item (tx-2 with feeAmountVnd = 299.000 ₫)
    const confirmButtons = screen.getAllByRole('button', { name: /Xác nhận & Duyệt thanh toán/i });
    expect(confirmButtons.length).toBeGreaterThan(0);

    fireEvent.click(confirmButtons[0]);

    await waitFor(() => {
      // Total revenue should now be 2.490.000 + 299.000 = 2.789.000 ₫
      expect(screen.getByText('2.789.000 ₫')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/payments/review-action',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});
