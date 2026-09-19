import { describe, expect, it, vi } from 'vitest';
import { BRIDGE_PROTOCOL_VERSION, type MicroFrontendModule } from './types';
import { loadMicroFrontend } from './load-micro-frontend';

interface Context { value: string }

const validRemote: MicroFrontendModule<Context> = {
  protocolVersion: BRIDGE_PROTOCOL_VERSION,
  mount: () => ({ update: () => undefined, unmount: () => undefined }),
};

describe('loadMicroFrontend', () => {
  it('retries a failed import and validates the contract', async () => {
    const importer = vi.fn<() => Promise<MicroFrontendModule<Context>>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(validRemote);

    await expect(loadMicroFrontend(importer, { retries: 1 })).resolves.toBe(validRemote);
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('rejects incompatible protocol majors', async () => {
    const remote = { ...validRemote, protocolVersion: '2.0.0' };
    await expect(loadMicroFrontend(() => Promise.resolve(remote), { retries: 0 }))
      .rejects.toMatchObject({ code: 'REMOTE_LOAD_FAILED' });
  });
});
