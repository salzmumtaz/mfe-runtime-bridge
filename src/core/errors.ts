export class BridgeError extends Error {
  constructor(message: string, readonly code: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'BridgeError';
  }
}

export class IncompatibleProtocolError extends BridgeError {
  constructor(hostVersion: string, remoteVersion: string) {
    super(
      `Incompatible bridge protocol: host ${hostVersion}, remote ${remoteVersion}.`,
      'INCOMPATIBLE_PROTOCOL',
    );
    this.name = 'IncompatibleProtocolError';
  }
}
