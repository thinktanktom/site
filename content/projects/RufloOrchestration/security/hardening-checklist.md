# Security — Hardening Checklist

Ordered by impact, not by ease of implementation.

1. **Restrict `/mcp-bridge/*` to the client's static IP.** Eliminates the blast radius of a leaked token with no new infrastructure required — the single highest-leverage change available.
2. **Remove git push credentials from the VM.** Done — AI-generated changes require a pull request like any other change, the same as every other contributor to the codebase.
3. **Use two separate bearer tokens** — one for the chat UI's own agent access, one for the remote client connection — so either can be revoked independently without affecting the other.
4. **Scope the client-facing MCP route to safe tool groups.** No `terminal_execute`, no `agents` — the client's remote connection should only be able to do what the workflow actually requires.
5. **Enable Caddy access logging** so there's a durable audit trail of every request that reaches the bridge, not just of what the bridge itself chooses to log.
6. **Rotate the bearer token on a schedule** — monthly at minimum, and immediately if the client's own machine is ever suspected compromised.

---

## Why This Order

The list is deliberately ranked by how much risk each item actually removes, not by which is quickest to ship. IP restriction and credential removal come first because they close off entire categories of exposure — a leaked token from the wrong network, and a compromised process ever reaching the source repository — rather than reducing the odds of a given attack path. Token separation and tool-group scoping come next because they limit what a single leaked credential is worth, without eliminating the leak scenario itself. Logging and rotation come last: they don't prevent an incident, but they bound how long an incident can run undetected and how much it costs to recover from once it's discovered.

This checklist reflects the state of this deployment as of the operator's own account of the engagement — it is a live list, meant to be revisited as the client's usage of the environment changes.
