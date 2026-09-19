import { createRuntimeBridge, loadMicroFrontend, type MountedMicroFrontend } from '../../src';
import type { DemoContext, DemoEvents, DemoRequests } from './contracts';
import './styles.css';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Host root was not found.');

root.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div class="brand"><span>R</span><div><strong>Relay</strong><small>vanilla host</small></div></div>
      <div class="host-actions">
        <button id="locale-toggle">EN / FR</button>
        <button id="theme-toggle">Toggle theme</button>
      </div>
    </header>
    <main>
      <section class="hero">
        <span class="eyebrow">Framework-neutral runtime contract</span>
        <h1>One host. Any framework.</h1>
        <p>The host owns platform concerns. The remote owns its feature and communicates only through a versioned bridge.</p>
      </section>
      <section class="architecture" aria-label="Bridge architecture">
        <article><small>01 · Host</small><strong>Auth · route · theme</strong></article>
        <span>↔</span><article class="bridge-node"><small>02 · Bridge</small><strong>Typed contract</strong></article>
        <span>↔</span><article><small>03 · Remote</small><strong>React feature</strong></article>
      </section>
      <div id="notification" class="notification" role="status" aria-live="polite"></div>
      <div id="remote-root" class="remote-root"><div class="loader">Loading remote contract…</div></div>
      <section class="log-panel"><div><span class="eyebrow">Bridge activity</span><h2>Observable at the boundary</h2></div><ol id="event-log"></ol></section>
    </main>
  </div>
`;

const bridge = createRuntimeBridge<DemoContext, DemoEvents, DemoRequests>({
  theme: 'dark',
  locale: 'en',
  playback: { playing: false, bpm: 112, currentStep: -1, activeTracks: [] },
});

const eventLog = document.querySelector<HTMLOListElement>('#event-log')!;
const notification = document.querySelector<HTMLDivElement>('#notification')!;
const remoteRoot = document.querySelector<HTMLDivElement>('#remote-root')!;
let mounted: MountedMicroFrontend | null = null;

function log(message: string) {
  const item = document.createElement('li');
  item.textContent = `${new Date().toLocaleTimeString()} — ${message}`;
  eventLog.prepend(item);
}

const cleanups = [
  bridge.on('transport.command', ({ command }) => {
    const playback = bridge.getContext().playback;
    bridge.updateContext({ playback: { ...playback, playing: command === 'play' } });
    notification.textContent = `Transport: ${command}`;
    log(`remote transport: ${command}`);
  }),
  bridge.on('sequencer.pattern', () => log('remote pattern updated')),
  bridge.onNavigate(({ path, source, replace }) => {
    if (source !== 'remote') return;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path);
    mounted?.update({ path });
    log(`remote navigation: ${path}`);
  }),
  bridge.handle('groove.analyze', async ({ pattern }) => {
    await new Promise((resolve) => setTimeout(resolve, 450));
    const density = Math.round((Object.values(pattern).flat().filter(Boolean).length / 24) * 100);
    log(`host analyzed groove: ${density}%`);
    return { character: density > 50 ? 'kinetic' : 'minimal', density };
  }),
];

document.querySelector('#theme-toggle')?.addEventListener('click', () => {
  const next = bridge.getContext().theme === 'dark' ? 'light' : 'dark';
  bridge.updateContext({ theme: next });
  document.documentElement.dataset.theme = next;
  log(`host context update: theme=${next}`);
});

document.querySelector('#locale-toggle')?.addEventListener('click', () => {
  const next = bridge.getContext().locale === 'en' ? 'fr' : 'en';
  bridge.updateContext({ locale: next });
  log(`host context update: locale=${next}`);
});

window.addEventListener('popstate', () => {
  mounted?.update({ path: window.location.pathname });
  bridge.navigate({ path: window.location.pathname, source: 'host', replace: true });
});

async function start() {
  try {
    const remote = await loadMicroFrontend(
      async () => (await import('./remote')).remoteModule,
      { timeoutMs: 3_000, retries: 0 },
    );
    mounted = remote.mount({ container: remoteRoot, bridge, initialPath: window.location.pathname === '/' ? '/studio' : window.location.pathname, basePath: '/' });
    log('React remote mounted');
  } catch (error) {
    remoteRoot.innerHTML = '<div class="error-state">The remote could not be loaded. The host remains operational.</div>';
    console.error(error);
  }
}

void start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    mounted?.unmount();
    cleanups.forEach((cleanup) => cleanup());
    bridge.destroy();
  });
}
