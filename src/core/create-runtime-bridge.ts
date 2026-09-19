import { BRIDGE_PROTOCOL_VERSION, type EventMap, type MaybePromise, type NavigationMessage, type RequestMap, type RequestOutput, type RuntimeBridge, type Unsubscribe } from './types';
import { BridgeError } from './errors';

type Listener<T> = (payload: T) => void;

export function createRuntimeBridge<
  TContext extends object,
  TEvents extends EventMap = EventMap,
  TRequests extends RequestMap = RequestMap,
>(initialContext: TContext): RuntimeBridge<TContext, TEvents, TRequests> {
  let context = Object.freeze({ ...initialContext }) as Readonly<TContext>;
  let destroyed = false;
  const contextListeners = new Set<() => void>();
  const eventListeners = new Map<keyof TEvents, Set<Listener<unknown>>>();
  const navigationListeners = new Set<Listener<NavigationMessage>>();
  const requestHandlers = new Map<keyof TRequests, (input: unknown) => MaybePromise<unknown>>();

  const ensureActive = () => {
    if (destroyed) throw new BridgeError('The runtime bridge has been destroyed.', 'BRIDGE_DESTROYED');
  };

  const unsubscribeFrom = <T>(set: Set<T>, value: T): Unsubscribe => {
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      set.delete(value);
    };
  };

  return {
    protocolVersion: BRIDGE_PROTOCOL_VERSION,

    getContext: () => context,

    updateContext: (patch) => {
      ensureActive();
      const next = Object.freeze({ ...context, ...patch }) as Readonly<TContext>;
      if (Object.keys(patch).every((key) => Object.is(context[key as keyof TContext], next[key as keyof TContext]))) return;
      context = next;
      [...contextListeners].forEach((listener) => listener());
    },

    subscribeContext: (listener) => {
      ensureActive();
      contextListeners.add(listener);
      return unsubscribeFrom(contextListeners, listener);
    },

    emit: (event, payload) => {
      ensureActive();
      [...(eventListeners.get(event) ?? [])].forEach((listener) => listener(payload));
    },

    on: (event, listener) => {
      ensureActive();
      const listeners = eventListeners.get(event) ?? new Set<Listener<unknown>>();
      const wrapped = listener as Listener<unknown>;
      listeners.add(wrapped);
      eventListeners.set(event, listeners);
      return unsubscribeFrom(listeners, wrapped);
    },

    navigate: (message) => {
      ensureActive();
      [...navigationListeners].forEach((listener) => listener(message));
    },

    onNavigate: (listener) => {
      ensureActive();
      navigationListeners.add(listener);
      return unsubscribeFrom(navigationListeners, listener);
    },

    handle: (request, handler) => {
      ensureActive();
      if (requestHandlers.has(request)) {
        throw new BridgeError(`A handler for "${String(request)}" is already registered.`, 'DUPLICATE_HANDLER');
      }
      const wrapped = handler as (input: unknown) => MaybePromise<unknown>;
      requestHandlers.set(request, wrapped);
      return () => {
        if (requestHandlers.get(request) === wrapped) requestHandlers.delete(request);
      };
    },

    request: async (request, input) => {
      ensureActive();
      const handler = requestHandlers.get(request);
      if (!handler) throw new BridgeError(`No handler registered for "${String(request)}".`, 'MISSING_HANDLER');
      return await handler(input) as RequestOutput<TRequests[typeof request]>;
    },

    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      contextListeners.clear();
      eventListeners.clear();
      navigationListeners.clear();
      requestHandlers.clear();
    },
  };
}
