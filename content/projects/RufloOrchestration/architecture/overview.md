# Architecture — System Overview

## The Stack

Everything runs on a single DigitalOcean VM (Ubuntu, 2 vCPU / 4 GB RAM), orchestrated with Docker Compose:

```
DigitalOcean VM
    │
    ├── Caddy               — reverse proxy, TLS termination, the only
    │                         process reachable from the internet
    │
    ├── Chat UI (ruvocal)    — a fork of a HuggingFace-style chat UI,
    │                         backed by Claude models via the MCP bridge
    │
    └── MCP bridge           — 200+ tools, HTTP/SSE, backs both the
                                chat UI and the remote Claude Code connection
```

Caddy is the only externally-reachable process. Both application containers sit behind it, reached through two distinct routes with two distinct auth mechanisms.

---

## Two Exposed Surfaces, Two Auth Mechanisms

| Surface | Route | Auth | Consumer |
|---|---|---|---|
| Chat UI | `/` | Caddy basic auth | Browser, human operator |
| MCP bridge | `/mcp-bridge/*` | Bearer token | Client's Claude Code desktop |

The chat UI uses basic auth rather than the Google OIDC path Ruflo's documentation recommends — for a single-client deployment, OIDC's OAuth app registration and callback configuration is more infrastructure than the threat model justifies. TLS is handled automatically: the deployment uses a DuckDNS subdomain, and Caddy provisions and renews a Let's Encrypt certificate against it with no additional configuration.

The MCP bridge route is bearer-token authenticated separately from the chat UI, so the two credentials can be rotated or revoked independently. See [Exposing the MCP Bridge](/projects/RufloOrchestration/architecture/mcp-bridge) for the routing detail, and [Security Posture](/projects/RufloOrchestration/security/posture) for the risk analysis behind that separation.

---

## Repo Layout vs. Documented Layout

Ruflo's actual repository does not match its own documentation in several places that matter operationally:

| What the docs suggest | What's actually there |
|---|---|
| `scripts/` | `src/scripts/` |
| `src/chat-ui/` | `src/ruvocal/` — a separate fork, not a standard chat UI install |
| A config directory that exists after `init` | Must be created manually |
| Docker Compose at the repo root | Nested at `ruflo/ruflo/docker-compose.yml` |
| `OPENAI_BASE_URL` baked in at build time | Injected at runtime via `entrypoint.sh` using `DOTENV_LOCAL` |

The chat UI being a fork (ruvocal) rather than a stock install is the detail that mattered most — the build and runtime behavior differ from what the documentation implies in ways that directly caused two of the three issues covered in [Issues Encountered](/projects/RufloOrchestration/setup/debugging-issues).

---

## Why Docker Compose, Not the Documented npm Install

The documented installation path is:

```bash
npm install -g ruflo@latest
ruflo init
```

Running this produces dependency deprecation warnings and — critically — does not generate the `claude-flow.config.json` file the documentation says it will create. That was the first signal that the published npm package had drifted from the actual repo. Rather than trying to reconcile the two, the deployment goes straight to cloning the repo and running it via Docker Compose, which is the intended production method and the one actually exercised by the project's own maintainers.
