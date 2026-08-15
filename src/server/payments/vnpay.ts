import { createAdminClient } from '@/lib/supabase/admin';

export async function getVnpayTransactionStatus(reference: string): Promise<{
  status: string | null;
  amountVnd: number | null;
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('payment_transactions')
    .select('status, amount_vnd')
    .eq('reference', reference)
    .maybeSingle();
  return {
    status: data?.status ?? null,
    amountVnd: data?.amount_vnd ? Number(data.amount_vnd) : null,
  };
}
