# Angular host integration

The bridge package is framework-neutral. The runnable example lives in `example/angular-host`; start it with `npm run dev:angular` and open `http://localhost:4300`.

Angular creates and owns the bridge instance. It passes that same object to the React remote during mounting—there is no `window` registry or hidden singleton:

```ts
private readonly bridge = createRuntimeBridge(initialContext);

const remote = await loadMicroFrontend(() => import(remoteUrl));
this.mounted = remote.mount({
  container: this.slot.nativeElement,
  bridge: this.bridge,
  initialPath: this.router.url,
  basePath: '/orders',
});
```

The complete lifecycle looks like this:

```ts
export class OrdersSlotComponent implements AfterViewInit, OnDestroy {
  @ViewChild('slot', { static: true }) slot!: ElementRef<HTMLElement>;

  private readonly bridge = createRuntimeBridge(initialContext);
  private mounted?: MountedMicroFrontend;
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);

  async ngAfterViewInit() {
    const remote = await loadMicroFrontend(() => import('orders/bridge'));

    const stopNavigation = this.bridge.onNavigate(({ path, source }) => {
      if (source === 'remote') {
        this.zone.run(() => void this.router.navigateByUrl(path));
      }
    });

    this.mounted = this.zone.runOutsideAngular(() => remote.mount({
      container: this.slot.nativeElement,
      bridge: this.bridge,
      initialPath: this.router.url,
      basePath: '/orders',
    }));

    this.destroyRef.onDestroy(stopNavigation);
  }

  onHostRouteChanged(path: string) {
    this.mounted?.update({ path });
    this.bridge.navigate({ path, source: 'host' });
  }

  ngOnDestroy() {
    this.zone.runOutsideAngular(() => this.mounted?.unmount());
    this.bridge.destroy();
  }
}
```

Run React mounting and unmounting outside Angular's zone. Re-enter the zone only when a remote callback changes Angular-owned state or navigation.

Context is for replayable platform state such as auth, locale, and theme. Events are transient notifications. Requests let React call an Angular-owned capability and await a typed response. Route messages synchronize the two routers; feature/server data stays with the feature that owns it.
