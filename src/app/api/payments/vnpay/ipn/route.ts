import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getVnpayConfig, verifyVnpayResponse } from '@/lib/payments/vnpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(RspCode: string, Message: string) {
  return NextResponse.json(
    { RspCode, Message },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  );
}

export async function GET(request: NextRequest) {
  let config;
  try {
    config = getVnpayConfig(new URL(request.url).origin);
  } catch {
    return response('99', 'Configuration error');
  }

  const params: Record<string, string> = {};
  new URL(request.url).searchParams.forEach((value, key) => {
    params[key] = value;
  });
  const verification = verifyVnpayResponse(params, config.hashSecret, config.tmnCode);
  if (!verification.valid) {
    return response('97', 'Checksum failed');
  }

  const reference = params.vnp_TxnRef;
  const amount = Number(params.vnp_Amount);
  if (!reference || !Number.isSafeInteger(amount) || amount <= 0) {
    return response('04', 'Invalid amount');
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('process_vnpay_ipn', {
    p_reference: reference,
    p_amount: amount,
    p_response_code: params.vnp_ResponseCode ?? '',
    p_transaction_status: params.vnp_TransactionStatus ?? '',
    p_transaction_no: params.vnp_TransactionNo ?? null,
    p_bank_code: params.vnp_BankCode ?? null,
    p_pay_date: params.vnp_PayDate ?? null,
    p_payload: Object.fromEntries(
      Object.entries(params).filter(([key]) => key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType'),
    ),
  });
  if (error || !data) {
    console.error('[vnpay/ipn] processing failed');
    return response('99', 'Unknown error');
  }
  const result = data as { rsp_code?: string; message?: string };
  return response(result.rsp_code ?? '99', result.message ?? 'Unknown error');
}
