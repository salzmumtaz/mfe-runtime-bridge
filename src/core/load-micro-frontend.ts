import { BridgeError } from './errors';
import { BRIDGE_PROTOCOL_VERSION, type EventMap, type MicroFrontendModule, type RequestMap } from './types';
import { assertCompatibleProtocol } from './version';

export interface LoadOptions {
  timeoutMs?: number;
  retries?: number;
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new BridgeError(`Remote load timed out after ${timeoutMs}ms.`, 'LOAD_TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export async function loadMicroFrontend<
  TContext extends object,
  TEvents extends EventMap = EventMap,
  TRequests extends RequestMap = RequestMap,
>(
  importer: () => Promise<MicroFrontendModule<TContext, TEvents, TRequests>>,
  options: LoadOptions = {},
): Promise<MicroFrontendModule<TContext, TEvents, TRequests>> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retries = options.retries ?? 1;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const module = await withTimeout(importer(), timeoutMs);
      if (!module || typeof module.mount !== 'function' || typeof module.protocolVersion !== 'string') {
        throw new BridgeError('Remote does not implement the micro-frontend contract.', 'INVALID_REMOTE');
      }
      assertCompatibleProtocol(BRIDGE_PROTOCOL_VERSION, module.protocolVersion);
      return module;
    } catch (error) {
      lastError = error;
    }
  }

  throw new BridgeError('Unable to load the micro-frontend.', 'REMOTE_LOAD_FAILED', { cause: lastError });
}
