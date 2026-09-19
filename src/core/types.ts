export const BRIDGE_PROTOCOL_VERSION = '1.0.0' as const;

export type Unsubscribe = () => void;
export type MaybePromise<T> = T | Promise<T>;
export type EventMap = object;
export type RequestMap = object;
export type RequestInput<T> = T extends { input: infer TInput } ? TInput : never;
export type RequestOutput<T> = T extends { output: infer TOutput } ? TOutput : never;

export interface NavigationMessage {
  path: string;
  source: 'host' | 'remote';
  replace?: boolean;
}

export interface RuntimeBridge<
  TContext extends object,
  TEvents extends EventMap = EventMap,
  TRequests extends RequestMap = RequestMap,
> {
  readonly protocolVersion: string;
  getContext(): Readonly<TContext>;
  updateContext(patch: Partial<TContext>): void;
  subscribeContext(listener: () => void): Unsubscribe;
  emit<TKey extends keyof TEvents>(event: TKey, payload: TEvents[TKey]): void;
  on<TKey extends keyof TEvents>(event: TKey, listener: (payload: TEvents[TKey]) => void): Unsubscribe;
  navigate(message: NavigationMessage): void;
  onNavigate(listener: (message: NavigationMessage) => void): Unsubscribe;
  handle<TKey extends keyof TRequests>(
    request: TKey,
    handler: (input: RequestInput<TRequests[TKey]>) => MaybePromise<RequestOutput<TRequests[TKey]>>,
  ): Unsubscribe;
  request<TKey extends keyof TRequests>(
    request: TKey,
    input: RequestInput<TRequests[TKey]>,
  ): Promise<RequestOutput<TRequests[TKey]>>;
  destroy(): void;
}

export interface MountOptions<
  TContext extends object,
  TEvents extends EventMap = EventMap,
  TRequests extends RequestMap = RequestMap,
> {
  container: HTMLElement;
  bridge: RuntimeBridge<TContext, TEvents, TRequests>;
  initialPath: string;
  basePath?: string;
}

export interface MountUpdate {
  path?: string;
}

export interface MountedMicroFrontend {
  update(update: MountUpdate): void;
  unmount(): void;
}

export interface MicroFrontendModule<
  TContext extends object,
  TEvents extends EventMap = EventMap,
  TRequests extends RequestMap = RequestMap,
> {
  readonly protocolVersion: string;
  mount(options: MountOptions<TContext, TEvents, TRequests>): MountedMicroFrontend;
}
