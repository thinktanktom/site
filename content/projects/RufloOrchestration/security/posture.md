# Security — Security Posture

This is the section most self-hosted AI writeups skip. It isn't skipped here.

---

## Is a Bearer Token a Secure Handover Mechanism?

Acceptable, but not great. A static shared secret has two structural weaknesses: it never expires unless someone manually rotates it, and it grants the same level of access every time it's presented, from anywhere, forever. There's no per-session audit trail, and no way to revoke it for one use without revoking it for every use simultaneously.

A meaningfully better option is short-lived tokens — exchanging a long-lived credential for a time-bounded JWT before each session, so a leaked token expires on its own. For a single trusted client on a fixed machine, standing up that infrastructure is non-trivial relative to the risk it removes, which is why the deployment uses a static bearer token today with the mitigations below layered on top rather than around it.

A simpler improvement that requires no new infrastructure at all: if the client has a static IP, restrict the route to it directly in the Caddyfile:

```caddy
handle /mcp-bridge/* {
    @wrong_ip not remote_ip 1.2.3.4
    respond @wrong_ip 403

    @unauthorized not header Authorization "Bearer {$MCP_BEARER_TOKEN}"
    respond @unauthorized 401

    uri strip_prefix /mcp-bridge
    reverse_proxy mcp-bridge:3001
}
```

A leaked token becomes useless from any other IP address.

---

## Blast Radius If the Token Leaks

The honest answer is that it's large. The MCP bridge exposes 204+ tools, including `devtools`, `agents`, `memory`, `intelligence`, and `terminal_execute`. Anyone holding a valid token can:

- Execute arbitrary shell commands on the VM as the Docker process user
- Read and write anything in the mounted project workspace
- Read the container's environment variables — including the Anthropic and OpenRouter API keys
- Drain those API keys by sending requests through the bridge
- Exfiltrate the entire codebase

The API key exposure is probably the most immediately damaging consequence, since it converts into direct financial cost the moment it's exploited. The right mitigation is to scope down what the remote, client-facing connection can actually do — the client doesn't need `terminal_execute` or agent-spawning tools, they need file access and the workflow trigger tools. Separating the client-facing route onto its own token makes that scoping possible:

```caddy
# Remote client — restricted to core tools only
handle /mcp-bridge/client/* {
    @unauthorized not header Authorization "Bearer {$CLIENT_TOKEN}"
    respond @unauthorized 401

    uri strip_prefix /mcp-bridge/client
    reverse_proxy mcp-bridge:3001
}
```

Two separate tokens — one for the internal chat UI's own agent access, one for the remote client connection — means either can be revoked without touching the other.

---

## Git Push Access From the VM

The workspace mount gives the mcp-bridge container write access to the project directory on the VM's filesystem. That access was audited specifically for whether it also extended to pushing to the remote git repository — checking for SSH keys and stored credential helpers on the VM — and the credentials that would have allowed that were removed.

The practical effect: the VM can read and modify files locally, which is what agent work requires, but it cannot push those changes to the remote repository. Any AI-generated change still has to go through a pull request like every other change to the codebase, human or otherwise.
