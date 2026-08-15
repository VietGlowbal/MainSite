/**
 * VietQR Dynamic QR code generator
 * Generates official EMVCo-compliant VietQR images via VietQR API
 */

export type VietQrOptions = {
  bankId?: string | null | undefined;
  accountNumber?: string | null | undefined;
  accountHolder?: string | null | undefined;
  amountVnd?: number | null | undefined;
  description?: string | null | undefined;
  template?: 'compact2' | 'compact' | 'qr_only' | undefined;
};

export function normalizeBankId(bankLabel?: string | null): string {
  if (!bankLabel) return 'TCB';
  const normalized = bankLabel.trim().toLowerCase();
  if (normalized.includes('techcom') || normalized === 'tcb') return 'TCB';
  if (normalized.includes('vietcom') || normalized === 'vcb') return 'VCB';
  if (normalized.includes('mb') || normalized.includes('quân đội')) return 'MB';
  if (normalized.includes('vietin') || normalized === 'ctg') return 'ICB';
  if (normalized.includes('bidv')) return 'BIDV';
  if (normalized.includes('vpbank') || normalized === 'vpb') return 'VPB';
  if (normalized.includes('tpbank') || normalized === 'tpb') return 'TPB';
  if (normalized.includes('acb')) return 'ACB';
  if (normalized.includes('sacom') || normalized === 'stb') return 'STB';
  if (normalized.includes('vib')) return 'VIB';
  if (normalized.includes('shb')) return 'SHB';
  if (normalized.includes('hdbank') || normalized === 'hdb') return 'HDB';
  if (normalized.includes('msb') || normalized.includes('hàng hải')) return 'MSB';
  if (normalized.includes('seabank')) return 'SEAB';
  if (normalized.includes('ocb')) return 'OCB';
  return bankLabel.trim();
}

export function generateVietQrUrl(options: VietQrOptions): string {
  const bank = normalizeBankId(options.bankId);
  const template = options.template || 'compact2';
  const accountNo = (options.accountNumber || '').trim();
  const baseUrl = `https://img.vietqr.io/image/${encodeURIComponent(bank)}-${encodeURIComponent(accountNo)}-${template}.png`;
  const url = new URL(baseUrl);

  if (options.amountVnd && options.amountVnd > 0) {
    url.searchParams.set('amount', Math.round(options.amountVnd).toString());
  }

  if (options.description) {
    // VietQR addInfo max length ~ 50 chars for optimal compatibility
    const cleanDesc = options.description.trim().slice(0, 50);
    if (cleanDesc) {
      url.searchParams.set('addInfo', cleanDesc);
    }
  }

  if (options.accountHolder) {
    url.searchParams.set('accountName', options.accountHolder.trim());
  }

  return url.toString();
}
