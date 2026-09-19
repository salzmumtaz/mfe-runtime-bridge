# Relay — MFE Runtime Bridge

A typed, framework-neutral communication and lifecycle contract for micro-frontends. The primary example is a real Angular host loading a separately built React remote.

## What it solves

- Explicit `mount → update → unmount` lifecycle
- Shared, replayable platform context for auth, theme, and locale
- Transient typed domain events
- Typed remote-to-host request/response commands
- Bidirectional route synchronization
- Protocol compatibility checks
- Remote loading timeout, retry, and validation
- Deterministic subscription and DOM cleanup
- No global `window` service registry and no RxJS dependency

## Architecture

```text
┌──────────────────── host application ────────────────────┐
│ owns auth, URL, tenant, theme, telemetry and remote load │
└──────────────────────────┬────────────────────────────────┘
                           │ RuntimeBridge
                 context · events · requests · route
                           │
┌──────────────────────────▼────────────────────────────────┐
│ feature micro-frontend                                   │
│ owns feature state, rendering and internal interactions  │
└───────────────────────────────────────────────────────────┘
```

The host owns the bridge instance and passes it during mount. Nothing is implicitly stored on `window`, so multiple mounted instances remain isolated.

## Run the Angular + React example

```bash
npm install
npm run dev:angular
```

Open `http://localhost:4300`. Angular owns the browser router and bridge; it dynamically imports the React bundle and injects the bridge through `mount`. React owns an eight-step sequencer while Angular owns the master clock and animated pulse engine. Clock ticks return to React, Angular can rewrite React-owned pattern state, and groove analysis demonstrates typed request/response communication.

```text
Angular AppComponent
  └─ creates bridge
  └─ imports react-remote.js
  └─ remote.mount({ container, bridge })
                              │ exact object reference
                              ▼
                    React BridgeProvider
```

This is an instance-scoped event bus plus replayable context and request handlers—not a global store. A second mounted remote can receive the same bridge to join that scope, or another bridge to remain isolated.

The smaller vanilla host remains available with `npm run dev` at `http://localhost:5174`.

## Core usage

```ts
import { createRuntimeBridge, loadMicroFrontend } from '@mfe-kit/runtime-bridge';

interface AppContext {
  auth: { userId: string } | null;
  theme: 'light' | 'dark';
  locale: string;
}

interface AppEvents {
  notify: { message: string };
}

interface AppRequests {
  'auth.refresh': {
    input: undefined;
    output: { expiresAt: string };
  };
}

const bridge = createRuntimeBridge<AppContext, AppEvents, AppRequests>({
  auth: null,
  theme: 'dark',
  locale: 'en',
});

bridge.handle('auth.refresh', async () => refreshSession());

const remote = await loadMicroFrontend(
  () => import('orders/bridge'),
  { timeoutMs: 10_000, retries: 1 },
);

const mounted = remote.mount({
  container: document.querySelector('#orders')!,
  bridge,
  initialPath: location.pathname,
  basePath: '/orders',
});

// Host route changed
mounted.update({ path: '/orders/42' });

// Host component was destroyed
mounted.unmount();
bridge.destroy();
```

## React remote

```tsx
import { createReactMicroFrontend, useBridgeContext } from '@mfe-kit/runtime-bridge/react';

function Orders({ path, navigate }) {
  const context = useBridgeContext<AppContext>();
  return <button onClick={() => navigate('/orders/42')}>{context.theme}: {path}</button>;
}

export default createReactMicroFrontend<AppContext, AppEvents, AppRequests>(Orders);
```

## Communication rules

Use bridge context only for slow-changing platform state: authenticated identity, tenant, theme, locale, permissions. Use events for notifications and telemetry. Use requests when the remote needs a host capability such as refreshing authentication. Keep feature and server data inside the owning micro-frontend; do not recreate a cross-application global store.

## Angular integration

Angular needs no React-aware adapter. The runnable host is in `example/angular-host`: it calls `mount` in `ngAfterViewInit`, calls `update` after Angular route changes, enters `NgZone` for remote-originated updates, and calls `unmount` in `ngOnDestroy`. See [docs/angular-host.md](docs/angular-host.md).

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Publishing

The package exports a framework-neutral root and an optional React entry point. React is an optional peer dependency, so non-React hosts do not pay for it. Replace the package scope before publishing if `@mfe-kit` is unavailable.
