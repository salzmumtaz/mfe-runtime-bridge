import { IncompatibleProtocolError } from './errors';

const major = (version: string): string => version.split('.')[0] ?? version;

export function assertCompatibleProtocol(hostVersion: string, remoteVersion: string): void {
  if (major(hostVersion) !== major(remoteVersion)) {
    throw new IncompatibleProtocolError(hostVersion, remoteVersion);
  }
}
