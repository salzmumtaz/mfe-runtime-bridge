/* eslint-disable react-refresh/only-export-components -- library entry intentionally co-locates its provider and hooks */
import { createContext, type PropsWithChildren, useContext, useEffect, useSyncExternalStore } from 'react';
import type { EventMap, RequestMap, RuntimeBridge } from '../core/types';

const BridgeContext = createContext<RuntimeBridge<object, EventMap, RequestMap> | null>(null);

interface BridgeProviderProps<
  TContext extends object,
  TEvents extends EventMap,
  TRequests extends RequestMap,
> extends PropsWithChildren {
  bridge: RuntimeBridge<TContext, TEvents, TRequests>;
}

export function BridgeProvider<
  TContext extends object,
  TEvents extends EventMap,
  TRequests extends RequestMap,
>({ bridge, children }: BridgeProviderProps<TContext, TEvents, TRequests>) {
  return (
    <BridgeContext.Provider value={bridge as unknown as RuntimeBridge<object, EventMap, RequestMap>}>
      {children}
    </BridgeContext.Provider>
  );
}

export function useRuntimeBridge<
  TContext extends object,
  TEvents extends EventMap = EventMap,
  TRequests extends RequestMap = RequestMap,
>(): RuntimeBridge<TContext, TEvents, TRequests> {
  const bridge = useContext(BridgeContext);
  if (!bridge) throw new Error('useRuntimeBridge must be used inside BridgeProvider.');
  return bridge as unknown as RuntimeBridge<TContext, TEvents, TRequests>;
}

export function useBridgeContext<TContext extends object>(): Readonly<TContext> {
  const bridge = useRuntimeBridge<TContext>();
  return useSyncExternalStore(bridge.subscribeContext, bridge.getContext, bridge.getContext);
}

export function useBridgeEvent<
  TContext extends object,
  TEvents extends EventMap,
  TKey extends keyof TEvents,
>(event: TKey, listener: (payload: TEvents[TKey]) => void): void {
  const bridge = useRuntimeBridge<TContext, TEvents>();
  useEffect(() => bridge.on(event, listener), [bridge, event, listener]);
}
