import { createReactMicroFrontend } from '../../../src/react';
import type { DemoContext, DemoEvents, DemoRequests } from '../contracts';
import { RemoteApp } from './RemoteApp';

export const remoteModule = createReactMicroFrontend<DemoContext, DemoEvents, DemoRequests>(RemoteApp, {
  onError: (error) => console.error('[remote]', error),
});
