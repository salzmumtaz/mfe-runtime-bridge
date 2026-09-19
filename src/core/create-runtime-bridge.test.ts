import { describe, expect, it, vi } from 'vitest';
import { createRuntimeBridge } from './create-runtime-bridge';

interface Context { theme: 'light' | 'dark'; user: string | null }
interface Events { notify: { message: string } }
interface Requests { refresh: { input: { force: boolean }; output: { token: string } } }

describe('createRuntimeBridge', () => {
  it('publishes immutable context snapshots and skips unchanged patches', () => {
    const bridge = createRuntimeBridge<Context, Events, Requests>({ theme: 'dark', user: null });
    const listener = vi.fn();
    const unsubscribe = bridge.subscribeContext(listener);

    bridge.updateContext({ theme: 'dark' });
    expect(listener).not.toHaveBeenCalled();

    bridge.updateContext({ theme: 'light' });
    expect(listener).toHaveBeenCalledOnce();
    expect(bridge.getContext()).toEqual({ theme: 'light', user: null });
    expect(Object.isFrozen(bridge.getContext())).toBe(true);

    unsubscribe();
    bridge.updateContext({ user: 'Alex' });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('keeps transient events separate from replayable context', () => {
    const bridge = createRuntimeBridge<Context, Events, Requests>({ theme: 'dark', user: null });
    const first = vi.fn();
    bridge.emit('notify', { message: 'before subscription' });
    const unsubscribe = bridge.on('notify', first);
    bridge.emit('notify', { message: 'hello' });

    expect(first).toHaveBeenCalledWith({ message: 'hello' });
    expect(first).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('supports typed request handlers and deterministic cleanup', async () => {
    const bridge = createRuntimeBridge<Context, Events, Requests>({ theme: 'dark', user: null });
    const removeHandler = bridge.handle('refresh', async ({ force }) => ({ token: force ? 'fresh' : 'cached' }));

    await expect(bridge.request('refresh', { force: true })).resolves.toEqual({ token: 'fresh' });
    removeHandler();
    await expect(bridge.request('refresh', { force: false })).rejects.toMatchObject({ code: 'MISSING_HANDLER' });

    bridge.destroy();
    expect(() => bridge.updateContext({ theme: 'light' })).toThrow(/destroyed/);
    expect(() => bridge.destroy()).not.toThrow();
  });
});
