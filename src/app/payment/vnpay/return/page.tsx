import type { Metadata } from 'next';
import Link from 'next/link';
import { getVnpayConfig, verifyVnpayResponse } from '@/lib/payments/vnpay';
import { getVnpayTransactionStatus } from '@/server/payments/vnpay';
import { T } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'VNPay payment result',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function VnpayReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params: Record<string, string> = Object.fromEntries(
    Object.entries(raw)
      .map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  let valid = false;
  try {
    const config = getVnpayConfig();
    valid = verifyVnpayResponse(params, config.hashSecret, config.tmnCode).valid;
  } catch {
    valid = false;
  }

  let status: string | null = null;
  let amountVnd: number | null = null;
  if (valid && params.vnp_TxnRef) {
    const result = await getVnpayTransactionStatus(params.vnp_TxnRef);
    status = result.status;
    amountVnd = result.amountVnd;
  }

  const success = valid && params.vnp_ResponseCode === '00' && params.vnp_TransactionStatus === '00';
  const fulfilled = status === 'fulfilled';
  const pending = success && status === 'pending';

  return (
    <main className="gb-page-full-bleed flex min-h-screen items-center justify-center bg-surface-muted px-gb-xl py-gb-9xl">
      <section className="w-full max-w-gb-width-sm rounded-gb-2xl border border-line bg-surface p-gb-5xl text-center shadow-gb-lg">
        <span className={`mx-auto flex size-gb-7xl items-center justify-center rounded-gb-full ${fulfilled ? 'bg-brand text-on-brand' : 'bg-surface-muted text-fg-tertiary'}`} aria-hidden>
          {fulfilled ? '✓' : '…'}
        </span>
        {!valid ? (
          <>
            <h1 className="mt-gb-3xl font-display text-gb-display-xs font-semibold text-fg"><T k="Payment result could not be verified" /></h1>
            <p className="mt-gb-lg text-gb-sm text-fg-tertiary"><T k="Please return to GlowBal and check your payment status." /></p>
          </>
        ) : !success ? (
          <>
            <h1 className="mt-gb-3xl font-display text-gb-display-xs font-semibold text-fg"><T k="Payment was not completed" /></h1>
            <p className="mt-gb-lg text-gb-sm text-fg-tertiary"><T k="No payment was recorded. You can try again when you are ready." /></p>
          </>
        ) : fulfilled ? (
          <>
            <h1 className="mt-gb-3xl font-display text-gb-display-xs font-semibold text-fg"><T k="Payment successful" /></h1>
            <p className="mt-gb-lg text-gb-sm text-fg-tertiary"><T k="Your GlowBal purchase has been confirmed." /></p>
          </>
        ) : (
          <>
            <h1 className="mt-gb-3xl font-display text-gb-display-xs font-semibold text-fg"><T k={pending ? 'Payment received — confirming your purchase' : 'Payment received — contact support'} /></h1>
            <p className="mt-gb-lg text-gb-sm text-fg-tertiary"><T k={pending ? 'VNPay has returned a successful payment. Confirmation may take a moment.' : 'Your payment was received but needs a support review.'} /></p>
          </>
        )}
        {amountVnd ? <p className="mt-gb-lg text-gb-xs text-fg-muted">{new Intl.NumberFormat('vi-VN').format(amountVnd)} ₫</p> : null}
        <Link href="/apply" className="mt-gb-4xl inline-flex rounded-gb-md bg-brand px-gb-xl py-gb-lg text-gb-sm font-semibold text-on-brand">
          <T k="Return to GlowBal" />
        </Link>
      </section>
    </main>
  );
}
