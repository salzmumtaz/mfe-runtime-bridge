import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { createRuntimeBridge } from '../core/create-runtime-bridge';
import { createReactMicroFrontend, type ReactMicroFrontendProps } from './create-react-micro-frontend';

interface Context { label: string }

function TestRemote({ path }: ReactMicroFrontendProps) {
  return <div data-testid="remote">Route: {path}</div>;
}

describe('createReactMicroFrontend', () => {
  it('mounts, updates, and unmounts without leaking DOM', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const bridge = createRuntimeBridge<Context>({ label: 'host' });
    const remote = createReactMicroFrontend<Context>(TestRemote, { strictMode: false });
    let mounted: ReturnType<typeof remote.mount>;

    await act(async () => {
      mounted = remote.mount({ container, bridge, initialPath: '/one' });
    });
    expect(container.textContent).toContain('/one');

    await act(async () => mounted.update({ path: '/two' }));
    expect(container.textContent).toContain('/two');

    await act(async () => mounted.unmount());
    expect(container.childElementCount).toBe(0);
    bridge.destroy();
    container.remove();
  });
});
