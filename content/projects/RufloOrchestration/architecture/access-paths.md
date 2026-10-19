# Architecture — Alternative Access Paths

The public bearer-token route in [Exposing the MCP Bridge](/projects/RufloOrchestration/architecture/mcp-bridge) is the client-facing path, but it is not the only way to reach the bridge, and it is not the right way for every consumer. Two other shapes exist: an SSH tunnel for operator access, and a packaged stdio client for a user who should not have shell access to the VM.

Both are worth documenting for the same reason: each one makes entire classes of the failures in [Debugging a Remote MCP Connection](/projects/RufloOrchestration/setup/mcp-connection-failures) **structurally unreachable** rather than merely fixed.

---

## Operator Access: An SSH Local Forward

For my own terminal, the blunt route is the correct one — don't go through the public proxy at all. An SSH local forward maps a local port straight to the bridge's private port:

```text
# ~/.ssh/config
Host mcp-tunnel
  HostName <vm-ip>
  User <vm-user>
  LocalForward 13001 127.0.0.1:3001
```

With the tunnel up, the MCP server is registered against `127.0.0.1:13001` — the local forward, not the public domain.

One precondition, since it is the thing most likely to trip up a reproduction: the forward targets `127.0.0.1:3001` *on the VM*, so the bridge port has to be reachable on the VM's own loopback — published from its container, rather than only resolvable as `mcp-bridge:3001` on the Compose network the way Caddy reaches it.

What that buys is not cleverness, it's the removal of the layers that were answering wrong. There is no proxy in front to emit a stray `401`, and no path-rewriting layer to mangle the SSE callback, so **both of those failure classes stop existing** rather than being configured around. It also respects the boundary the bridge was designed with: the bridge is meant to be private to the internal network, and a tunnel honours that instead of punching a second public route through Caddy.

One thing the tunnel does *not* fix: the `tools/list` timeout is server-side and does not care how the client arrived. That one still needs the pre-warm.

Verify the bridge interface directly, independent of any transport:

```bash
echo '{"jsonrpc":"2.0","id":"1","method":"tools/list"}' | node <bridge-kernel>.mjs
```

A populated `tools/list` and a successful `tools/call` confirm the path end to end.

---

## Why the Tunnel Is Operator-Only

The tunnel works for me and would be wrong for anyone else. A persistent SSH forward running as a VM user means handing that user **shell access to the VM** — which is precisely the thing the bearer-token route exists to avoid. It is an operator convenience, not a handover mechanism, and it should never be the answer to "how do I give the client access."

---

## The Packaged Client: A Stdio Kernel With a Bundled Snapshot

Someone connecting from Claude Desktop on Windows needs the same principle in different packaging: a Desktop Extension (`.dxt`) wrapping a small **stdio kernel** plus a bundled snapshot of the tool list.

It avoids the whole 401-and-discovery problem structurally. **Stdio, not the HTTP transport** — so there is no HTTP request for a proxy to answer `401` to, and no discovery flow to mis-trigger. Claude Desktop speaks JSON-RPC to the local kernel, and the kernel makes the outbound call as a plain POST carrying the bearer token; if the route is right, it gets a clean `200`.

The bundled snapshot is the piece that earns its keep twice:

- Because `tools/list` is answered from the local snapshot rather than fetched live, **it never opens an SSE stream at all** — so there is no advertised callback URL to route, and the handshake-that-points-nowhere cannot happen.
- It returns instantly, so it **cannot lose the registration race** that the seven-second live aggregation lost.

Only actual tool *invocations* touch the network.

---

## The Working Shape

```text
NixOS workstation                          Cloud VM
─────────────────                          ────────
Claude Code (CLI)
  └─ MCP server → http://127.0.0.1:13001
        │
        │  SSH tunnel (LocalForward 13001 → 127.0.0.1:3001)
        ▼
                                           MCP bridge :3001  (private to internal net)
                                              └─ ~200 tools → Claude swarm
                                           Caddy :443 ──► chat UI :3000   (untouched)
```

---

## Validation Status and Open Edges

Stated plainly, because these two paths are not equally proven:

- **Validated end to end:** the tunnel path, on my own Claude Code setup, where tools both enumerate and call.
- **Reasoned but not yet verified on the target:** the Desktop `.dxt` variant. The logic holds and it smoke-tests locally, but it has not been run on the actual Windows Claude Desktop it is meant for — so "behaves identically on Windows" is an expectation, not a result.

Three open edges, carried here rather than quietly dropped:

1. **A single shared bearer token reaching the full toolset** is fine for a proof and wrong for production. It wants a per-client, least-privilege token — the same conclusion the route-scoping and two-token split in [Security Posture](/projects/RufloOrchestration/security/posture) arrive at from the other direction.
2. **The bundled snapshot goes stale** when the server's tool set changes. Trading live accuracy for instant registration is the deal the snapshot makes, and it needs a refresh story before it ships to anyone.
3. **A manifest `${__dirname}`-style reference only helps if the host actually expands it** — worth confirming on the target host rather than assuming.
