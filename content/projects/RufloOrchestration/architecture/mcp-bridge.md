# Architecture — Exposing the MCP Bridge

## Goal

Give the client's Claude Code desktop direct, agentic access to the MCP bridge running on the VM — without SSH, without a VPN, and without exposing it unauthenticated to the internet.

---

## Caddy Route with Bearer Token Auth

A `/mcp-bridge/*` route was added to the Caddyfile, separate from the chat UI's basic-auth-protected route:

```caddy
your-domain.example.com {
    # MCP bridge — Bearer token auth
    @mcp path /mcp-bridge/*
    handle @mcp {
        @no_token {
            not header Authorization "Bearer {$MCP_BEARER_TOKEN}"
        }
        respond @no_token "Unauthorized" 401
        uri strip_prefix /mcp-bridge
        reverse_proxy mcp-bridge:3001 {
            transport http {
                keepalive 30s
                keepalive_idle_conns 10
            }
            flush_interval -1
        }
    }

    # Chat UI — basic auth
    basicauth {
        {$BASIC_AUTH_USER} {$BASIC_AUTH_HASH}
    }
    reverse_proxy nginx:3000
}
```

`flush_interval -1` is required for Server-Sent Events streaming to work correctly through the proxy — without it, responses buffer instead of streaming to the client as they're produced.

---

## Client-Side Configuration

The client adds a single entry to `~/.claude/settings.json` on their own machine:

```json
{
  "mcpServers": {
    "ruflo": {
      "type": "http",
      "url": "https://your-domain.example.com/mcp-bridge/mcp",
      "headers": {
        "Authorization": "Bearer <token>"
      }
    }
  }
}
```

Once configured, all 204 MCP tools — including the two custom workflow tools described in [Skills & Workflow Tooling](/projects/RufloOrchestration/workflow/skills-and-tooling) — show up natively in the client's own Claude Code session, as if the bridge were running locally.

---

## Why This Route Design, Not Something Simpler

An unauthenticated route, or a route reused from the chat UI's basic auth, would have been simpler to wire up. Neither was acceptable:

- The MCP bridge exposes tool categories — `terminal_execute`, `agents`, `devtools` — that amount to remote code execution if reachable without a credential.
- Reusing the chat UI's basic-auth credential would mean a single leaked password grants both human browser access and agentic tool access, with no way to revoke one without the other.

A dedicated route with its own bearer token keeps the two trust boundaries — "a human is looking at the chat UI" and "an agent has tool access to the bridge" — separable and independently revocable. The risk that a *bearer token specifically* still carries (no expiry, uniform access from anywhere it's presented) is treated in full in [Security Posture](/projects/RufloOrchestration/security/posture).
