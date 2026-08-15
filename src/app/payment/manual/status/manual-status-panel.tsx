'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';

type Status = {
  status: string;
  status_label: string;
  reference: string;
  amount_vnd: number;
  expires_at: string;
  can_claim: boolean;
  bank_label?: string;
  account_holder?: string;
  account_number?: string;
  account_number_masked?: string;
  bank_qr_url?: string;
};

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label ?? t('Copy')}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-fg-secondary transition-all hover:border-brand/40 hover:bg-brand/5 hover:text-fg active:scale-95"
    >
      {copied ? (
        <>
          <svg className="size-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className="font-semibold text-emerald-600">{t('Copied!')}</span>
        </>
      ) : (
        <>
          <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>{t('Copy')}</span>
        </>
      )}
    </button>
  );
}

export function ManualStatusPanel({ reference }: { reference: string }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/payments/manual/status?reference=${encodeURIComponent(reference)}`,
      { cache: 'no-store' },
    );
    const body = (await response.json().catch(() => ({}))) as Status & { error?: string };
    if (!response.ok) {
      setError(body.error ?? t('Could not load payment status'));
      return;
    }
    setStatus(body);
    setError(null);
  }, [reference, t]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const firstLoad = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 15_000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(timer);
    };
  }, [load]);

  async function claim() {
    setClaiming(true);
    const response = await fetch('/api/payments/manual/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(body.error ?? t('Could not record transfer claim'));
    } else {
      await load();
    }
    setClaiming(false);
  }

  if (error && !status) {
    return (
      <section className="mx-auto w-full max-w-lg rounded-3xl border border-red-200 bg-surface p-8 text-center shadow-lg">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-100 text-red-600">
          <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="mt-4 text-xl font-bold text-fg">{t('Error')}</h2>
        <p role="alert" className="mt-2 text-sm text-fg-error">{error}</p>
        <Link
          href="/plus"
          className="mt-6 inline-flex rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-on-brand shadow-sm hover:opacity-90"
        >
          {t('Return to GlowBal')}
        </Link>
      </section>
    );
  }

  if (!status) {
    return (
      <section className="mx-auto flex w-full max-w-lg flex-col items-center justify-center rounded-3xl border border-line bg-surface p-12 text-center shadow-lg">
        <div className="size-10 animate-spin rounded-full border-3 border-brand border-t-transparent" />
        <p className="mt-4 text-sm font-medium text-fg-secondary">{t('Loading payment status…')}</p>
      </section>
    );
  }

  const isFulfilled = status.status === 'fulfilled';
  const isClaimed = status.status === 'claimed';
  const isPending = status.status === 'pending';
  const isExpired = status.status === 'expired' || status.status === 'failed';
  const accountNumberToDisplay = status.account_number || status.account_number_masked || '';

  return (
    <section
      className="mx-auto flex w-full max-w-xl flex-col items-center rounded-3xl border border-line bg-surface p-6 shadow-xl sm:p-8"
      aria-live="polite"
    >
      {/* Status Badge */}
      <div className="flex flex-col items-center text-center">
        {isFulfilled ? (
          <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm">
            <svg className="size-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : isClaimed ? (
          <div className="flex size-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 shadow-sm">
            <svg className="size-8 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        ) : isExpired ? (
          <div className="flex size-16 items-center justify-center rounded-full bg-red-100 text-red-600 shadow-sm">
            <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-brand">
            <span className="size-2 animate-ping rounded-full bg-brand" />
            <span>{t('VietQR Payment')}</span>
          </div>
        )}

        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
          {isFulfilled
            ? t('Payment successful')
            : isClaimed
              ? t('Transfer reported — awaiting confirmation')
              : isExpired
                ? t('Payment expired')
                : t('Scan QR to Pay')}
        </h1>

        <p className="mt-1.5 text-sm text-fg-tertiary">
          {isFulfilled
            ? t('Your GlowBal purchase has been confirmed and activated.')
            : isClaimed
              ? t('We have received your transfer report. Founder will verify shortly.')
              : isExpired
                ? t('This transaction has expired. Please create a new checkout.')
                : t('Open any banking app or e-wallet to scan the VietQR code.')}
        </p>
      </div>

      {/* QR Code Container (Visible when Pending or Claimed) */}
      {!isFulfilled && !isExpired && status.bank_qr_url && (
        <div className="mt-6 flex w-full flex-col items-center rounded-2xl border border-line bg-gradient-to-b from-surface-muted/80 to-surface p-5 text-center shadow-inner">
          <div className="relative overflow-hidden rounded-2xl border-2 border-white bg-white p-3 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={status.bank_qr_url}
              alt={t('GlowBal bank transfer QR code')}
              width={260}
              height={260}
              className="size-[220px] rounded-xl object-contain sm:size-[260px]"
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-md bg-white px-2.5 py-1 text-[11px] font-bold text-blue-700 shadow-sm border border-line">
              VietQR
            </span>
            <span className="rounded-md bg-white px-2.5 py-1 text-[11px] font-bold text-red-600 shadow-sm border border-line">
              {status.bank_label ?? 'Napas 24/7'}
            </span>
            <span className="text-xs text-fg-muted font-medium">
              {t('Instant transfer 24/7')}
            </span>
          </div>
        </div>
      )}

      {/* Payment Details Section */}
      <div className="mt-6 w-full divide-y divide-line rounded-2xl border border-line bg-surface-muted/50 text-sm">
        {/* Số tiền */}
        <div className="flex items-center justify-between p-3.5 sm:px-4">
          <span className="text-fg-muted">{t('Amount')}</span>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-brand sm:text-lg">
              {new Intl.NumberFormat('vi-VN').format(status.amount_vnd)} ₫
            </span>
            <CopyButton text={status.amount_vnd.toString()} label={t('Copy amount')} />
          </div>
        </div>

        {/* Nội dung chuyển khoản */}
        <div className="flex flex-col gap-1.5 p-3.5 bg-brand/5 sm:px-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-fg-brand text-xs sm:text-sm">
              {t('Transfer reference (Mandatory)')}
            </span>
            <CopyButton text={status.reference} label={t('Copy reference')} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-brand/20 bg-surface px-3 py-2">
            <code className="font-mono text-sm font-bold text-brand select-all">
              {status.reference}
            </code>
          </div>
          <p className="text-[11px] text-fg-tertiary">
            *{t('Keep this exact reference code in transfer description to auto-verify')}
          </p>
        </div>

        {/* Ngân hàng */}
        <div className="flex items-center justify-between p-3.5 sm:px-4">
          <span className="text-fg-muted">{t('Bank')}</span>
          <span className="font-semibold text-fg">{status.bank_label}</span>
        </div>

        {/* Chủ tài khoản */}
        <div className="flex items-center justify-between p-3.5 sm:px-4">
          <span className="text-fg-muted">{t('Account holder')}</span>
          <span className="font-semibold uppercase text-fg">{status.account_holder}</span>
        </div>

        {/* Số tài khoản */}
        {accountNumberToDisplay ? (
          <div className="flex items-center justify-between p-3.5 sm:px-4">
            <span className="text-fg-muted">{t('Account number')}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-fg select-all">{accountNumberToDisplay}</span>
              {status.account_number ? (
                <CopyButton text={status.account_number} label={t('Copy account number')} />
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Hạn thanh toán */}
        <div className="flex items-center justify-between p-3.5 text-xs sm:px-4">
          <span className="text-fg-muted">{t('Expires at')}</span>
          <span className="text-fg-tertiary font-medium">
            {new Date(status.expires_at).toLocaleString('vi-VN')}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex w-full flex-col gap-3">
        {status.can_claim && (
          <button
            type="button"
            onClick={claim}
            disabled={claiming}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 px-6 text-sm font-semibold text-on-brand shadow-md transition-all hover:bg-brand/90 active:scale-[0.99] disabled:opacity-50"
          >
            {claiming ? (
              <>
                <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>{t('Processing…')}</span>
              </>
            ) : (
              <>
                <svg className="size-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{t('I have transferred money')}</span>
              </>
            )}
          </button>
        )}

        {isClaimed && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-center text-xs text-blue-800">
            {t('You reported transfer. The system will update your access once confirmed.')}
          </div>
        )}

        {isFulfilled && (
          <Link
            href="/apply"
            className="flex w-full items-center justify-center rounded-xl bg-brand py-3.5 px-6 text-sm font-semibold text-on-brand shadow-md hover:bg-brand/90"
          >
            {t('Return to GlowBal')}
          </Link>
        )}

        {!isFulfilled && (
          <Link
            href="/plus"
            className="flex w-full items-center justify-center rounded-xl border border-line bg-surface py-2.5 px-4 text-xs font-semibold text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg"
          >
            {t('Back to plans')}
          </Link>
        )}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-center text-xs text-fg-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
