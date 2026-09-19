# Security

- Treat remotely loaded JavaScript as trusted application code. The bridge is an architecture boundary, not a security sandbox.
- Allowlist remote origins and enforce Content Security Policy in the host.
- Do not place raw access tokens in shared context. Prefer opaque session state and host-owned authenticated requests.
- Validate server configuration before selecting remote URLs.
- Keep host capabilities narrow and explicit through typed request handlers.
