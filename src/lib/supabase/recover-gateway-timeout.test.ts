import { describe, expect, it, vi } from 'vitest';
import { recoverGatewayTimeout } from './recover-gateway-timeout';

describe('recoverGatewayTimeout', () => {
  it('recovers a claim after the gateway loses its response', async () => {
    const operation = vi.fn().mockResolvedValue({ data: null, error: { message: 'Gateway Timeout' } });
    const recover = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(['claimed-job']);

    await expect(recoverGatewayTimeout(operation, recover)).resolves.toEqual({
      data: ['claimed-job'],
      error: null,
    });
    expect(operation).toHaveBeenCalledOnce();
    expect(recover).toHaveBeenCalledTimes(2);
  });

  it('does not recover a non-transient database error', async () => {
    const result = { data: null, error: { message: 'permission denied' } };
    const operation = vi.fn().mockResolvedValue(result);
    const recover = vi.fn();

    await expect(recoverGatewayTimeout(operation, recover)).resolves.toEqual(result);
    expect(recover).not.toHaveBeenCalled();
  });
});
