type GatewayResult<T> = {
  data: T;
  error: { message?: unknown } | null;
};

const RECOVERY_DELAYS_MS = [200, 500] as const;

function isGatewayTimeout(error: GatewayResult<unknown>['error']): boolean {
  return typeof error?.message === 'string' && /gateway timeout/i.test(error.message);
}

export async function recoverGatewayTimeout<T>(
  operation: () => Promise<GatewayResult<T>>,
  recover: () => Promise<T | null>,
): Promise<GatewayResult<T>> {
  const result = await operation();
  if (!isGatewayTimeout(result.error)) return result;

  for (const delayMs of RECOVERY_DELAYS_MS) {
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    const recovered = await recover();
    if (recovered !== null) return { data: recovered, error: null };
  }
  return result;
}
