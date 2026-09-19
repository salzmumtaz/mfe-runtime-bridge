import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, ViewChild, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import {
  createRuntimeBridge,
  loadMicroFrontend,
  type MicroFrontendModule,
  type MountedMicroFrontend,
  type Unsubscribe,
} from '../../../../src';
import type { DemoContext, DemoEvents, DemoRequests, Pattern, TrackName } from '../../../src/contracts';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('remoteRoot', { static: true }) private remoteRoot!: ElementRef<HTMLElement>;

  protected readonly context = signal<DemoContext>({
    theme: 'dark',
    locale: 'en',
    playback: { playing: false, bpm: 112, currentStep: -1, activeTracks: [] },
  });
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly activity = signal<string[]>([]);

  private readonly bridge = createRuntimeBridge<DemoContext, DemoEvents, DemoRequests>(this.context());
  private readonly cleanups: Unsubscribe[] = [];
  private mounted: MountedMicroFrontend | null = null;
  private timer: number | null = null;
  private audioContext: AudioContext | null = null;
  private pattern: Pattern = {
    kick: [true, false, false, false, true, false, false, false],
    clap: [false, false, true, false, false, false, true, false],
    synth: [true, false, false, true, false, true, false, false],
  };

  constructor(private readonly router: Router, private readonly zone: NgZone) {
    this.cleanups.push(
      this.bridge.subscribeContext(() => this.zone.run(() => this.context.set(this.bridge.getContext()))),
      this.bridge.on('sequencer.pattern', ({ pattern }) => this.zone.run(() => {
        this.pattern = pattern;
        this.log('React → Angular: pattern updated');
      })),
      this.bridge.on('transport.command', ({ command, pattern }) => this.zone.run(() => {
        this.pattern = pattern;
        if (command === 'play') this.startClock();
        else this.stopClock();
        this.log(`React → Angular: transport ${command}`);
      })),
      this.bridge.onNavigate(({ path, source, replace }) => {
        if (source === 'remote') {
          this.zone.run(() => void this.router.navigateByUrl(
            path,
            replace === undefined ? {} : { replaceUrl: replace },
          ));
        }
      }),
      this.bridge.handle('groove.analyze', async ({ pattern }) => {
        await new Promise((resolve) => setTimeout(resolve, 320));
        const hits = Object.values(pattern).flat().filter(Boolean).length;
        const density = Math.round((hits / 24) * 100);
        const character = density > 62 ? 'hyperdrive' : density > 38 ? 'kinetic' : 'minimal';
        this.zone.run(() => this.log(`Angular analyzed groove: ${character}`));
        return { character, density };
      }),
    );

    const routeSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(({ urlAfterRedirects }) => {
        this.mounted?.update({ path: urlAfterRedirects });
        this.bridge.navigate({ path: urlAfterRedirects, source: 'host', replace: true });
        this.log(`Angular route: ${urlAfterRedirects}`);
      });
    this.cleanups.push(() => routeSubscription.unsubscribe());
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      const remote = await loadMicroFrontend<DemoContext, DemoEvents, DemoRequests>(
        async () => {
          const remoteUrl = new URL('/remote/react-remote.js', document.baseURI).href;
          const module = await import(/* @vite-ignore */ remoteUrl) as {
            remoteModule: MicroFrontendModule<DemoContext, DemoEvents, DemoRequests>;
          };
          return module.remoteModule;
        },
        { timeoutMs: 8_000, retries: 1 },
      );

      this.mounted = this.zone.runOutsideAngular(() => remote.mount({
        container: this.remoteRoot.nativeElement,
        bridge: this.bridge,
        initialPath: this.router.url === '/' ? '/studio' : this.router.url,
        basePath: '/studio',
      }));
      this.loading.set(false);
      this.log('Angular mounted the React remote');
    } catch (error) {
      this.loading.set(false);
      this.error.set(this.describeError(error));
      console.error('[Angular host] React remote failed to load', error);
    }
  }

  protected toggleTheme(): void {
    const theme = this.context().theme === 'dark' ? 'light' : 'dark';
    this.bridge.updateContext({ theme });
    this.log(`Angular context update: theme=${theme}`);
  }

  protected toggleLocale(): void {
    const locale = this.context().locale === 'en' ? 'fr' : 'en';
    this.bridge.updateContext({ locale });
    this.log(`Angular context update: locale=${locale}`);
  }

  protected remixFromAngular(): void {
    this.bridge.emit('studio.remix', { seed: Date.now() });
    this.log('Angular → React: rewrite sequencer pattern');
  }

  protected isTrackActive(track: TrackName): boolean {
    return this.context().playback.activeTracks.includes(track);
  }

  private startClock(): void {
    if (this.timer !== null) return;
    this.audioContext ??= new AudioContext();
    void this.audioContext.resume();
    this.bridge.updateContext({ playback: { ...this.context().playback, playing: true } });
    const interval = (60_000 / this.context().playback.bpm) / 2;
    this.tick();
    this.timer = window.setInterval(() => this.zone.run(() => this.tick()), interval);
  }

  private stopClock(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.bridge.updateContext({
      playback: { ...this.context().playback, playing: false, currentStep: -1, activeTracks: [] },
    });
  }

  private tick(): void {
    const current = this.context().playback;
    const step = (current.currentStep + 1) % 8;
    const tracks = (Object.keys(this.pattern) as TrackName[])
      .filter((track) => this.pattern[track][step]);
    const playback = { ...current, playing: true, currentStep: step, activeTracks: tracks };
    this.bridge.updateContext({ playback });
    this.bridge.emit('clock.tick', { step, activeTracks: tracks });
    tracks.forEach((track) => this.playVoice(track));
  }

  private playVoice(track: TrackName): void {
    if (!this.audioContext) return;
    const audio = this.audioContext;
    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain).connect(audio.destination);
    oscillator.type = track === 'kick' ? 'sine' : track === 'clap' ? 'square' : 'sawtooth';
    const frequency = track === 'kick' ? 120 : track === 'clap' ? 680 : 220;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (track === 'kick') oscillator.frequency.exponentialRampToValueAtTime(48, now + .14);
    gain.gain.setValueAtTime(track === 'clap' ? .035 : .075, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + (track === 'synth' ? .24 : .13));
    oscillator.start(now);
    oscillator.stop(now + .25);
  }

  private log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.activity.update((items) => [`${timestamp} — ${message}`, ...items].slice(0, 8));
  }

  private describeError(error: unknown): string {
    const messages: string[] = [];
    let current: unknown = error;

    while (current instanceof Error && !messages.includes(current.message)) {
      messages.push(current.message);
      current = current.cause;
    }

    return messages.join(' Cause: ') || 'Remote loading failed.';
  }

  ngOnDestroy(): void {
    this.stopClock();
    void this.audioContext?.close();
    this.audioContext = null;
    this.zone.runOutsideAngular(() => this.mounted?.unmount());
    this.mounted = null;
    this.cleanups.forEach((cleanup) => cleanup());
    this.bridge.destroy();
  }
}
