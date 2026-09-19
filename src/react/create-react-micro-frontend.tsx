import { StrictMode, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { assertCompatibleProtocol } from '../core/version';
import { BRIDGE_PROTOCOL_VERSION, type EventMap, type MicroFrontendModule, type MountOptions, type RequestMap } from '../core/types';
import { BridgeProvider } from './BridgeProvider';

export interface ReactMicroFrontendProps {
  path: string;
  basePath?: string;
  navigate(path: string, options?: { replace?: boolean }): void;
}

export interface ReactAdapterOptions {
  strictMode?: boolean;
  onError?: (error: unknown) => void;
}

export function createReactMicroFrontend<
  TContext extends object,
  TEvents extends EventMap = EventMap,
  TRequests extends RequestMap = RequestMap,
>(
  App: ComponentType<ReactMicroFrontendProps>,
  adapterOptions: ReactAdapterOptions = {},
): MicroFrontendModule<TContext, TEvents, TRequests> {
  return {
    protocolVersion: BRIDGE_PROTOCOL_VERSION,

    mount(options: MountOptions<TContext, TEvents, TRequests>) {
      assertCompatibleProtocol(options.bridge.protocolVersion, BRIDGE_PROTOCOL_VERSION);
      if (!options.container.isConnected) throw new Error('Mount container must be attached to the document.');
      options.container.replaceChildren();

      const rootOptions = adapterOptions.onError
        ? { onUncaughtError: adapterOptions.onError, onRecoverableError: adapterOptions.onError }
        : undefined;
      let root: Root | null = createRoot(options.container, rootOptions);
      let currentPath = options.initialPath;

      const render = () => {
        if (!root) return;
        const content = (
          <BridgeProvider bridge={options.bridge}>
            <App
              path={currentPath}
              {...(options.basePath === undefined ? {} : { basePath: options.basePath })}
              navigate={(path, navigationOptions) => options.bridge.navigate({
                path,
                source: 'remote',
                ...(navigationOptions?.replace === undefined ? {} : { replace: navigationOptions.replace }),
              })}
            />
          </BridgeProvider>
        );
        root.render(adapterOptions.strictMode === false ? content : <StrictMode>{content}</StrictMode>);
      };

      render();
      let mounted = true;

      return {
        update(update) {
          if (!mounted || !root) return;
          if (update.path !== undefined) currentPath = update.path;
          render();
        },
        unmount() {
          if (!mounted) return;
          mounted = false;
          root?.unmount();
          root = null;
          options.container.replaceChildren();
        },
      };
    },
  };
}
