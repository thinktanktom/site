# Setup & Debugging — Debugging a Remote MCP Connection

Registering the bridge as a remote MCP server in a Claude Code client failed four separate times, and every failure presented identically from the outside: `claude mcp list` reporting the server as **connected** and, in the same breath, **not authenticated**. TCP fine, TLS fine, server reachable, token valid — and not a single tool in the session.

"Connected" describes the transport. It says nothing about whether the auth step completed, and nothing about whether any tools ever registered. Three structurally distinct faults produce that one status line, so the status itself is not a diagnosis.

---

## Cause 1 — A Valid Token Judged at the Wrong Door

The thing that is easy to get backwards is how OAuth gets involved at all. A static bearer token is not inherently a problem for the HTTP transport, **as long as the authenticated request comes back `200`**. The OAuth machinery does not engage on the *absence* of a token. It engages when something answers `401`: the client reads that as an auth challenge and tries to begin a flow to satisfy it, following whatever `WWW-Authenticate` points at.

The token here was valid, but the request never reached the bearer route that would have honoured it. It landed on the **catch-all basic-auth route** instead — and basic auth, handed an `Authorization: Bearer …` header where it expected Basic credentials, does the only thing it can: rejects with `401` and `WWW-Authenticate: Basic`. The token was never evaluated.

That `401` set everything else in motion. The client treats it as "this server wants authentication" and goes looking for a flow; a Basic challenge points at nothing it can negotiate against, so it opens a conversation the server can never finish and goes quiet. That dead-ended exchange is precisely what `connected but not authenticated` means — transport up, auth step started, never completed.

The layering is the non-obvious part: a mundane routing mismatch surfaces as an inscrutable *auth-model* failure two layers up. The two-route Caddy configuration in [Exposing the MCP Bridge](/projects/RufloOrchestration/architecture/mcp-bridge) is what makes this reachable — a bearer path for API clients and a basic-auth catch-all for everything else means there is always a wrong door for a bearer request to knock on.

### A related trap: discovery metadata you didn't mean to expose

A deployment that returns a `WWW-Authenticate` pointing at an authorization server, or that exposes `/.well-known/oauth-*` metadata, will trip the client into full OAuth discovery pre-emptively and strand it the same way — **even on a clean `200` token path**. This bridge publishes none of that, so it was not the fault here. Rule it out by checking rather than by assumption: the misleading status line is identical and only the reason differs.

### The diagnostic

Exercise the path that actually matters — the authenticated one — and dump the headers:

```bash
curl -sD - -o /dev/null https://<your-bridge-domain>/mcp \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}'
```

`-D -` prints the response headers, including any `WWW-Authenticate`; `-o /dev/null` discards the body so the status line reads cleanly. A `200` means the token reached the route that honours it — auth is fine, look at the two causes below. A `401` or `403`, especially with `WWW-Authenticate: Basic`, means the request is being judged by something that never wanted a bearer in the first place.

---

## Cause 2 — A Handshake That Points Nowhere

Routing fixed, auth honoured, `200` on the initialize — and still nothing worked, this time for a reason specific to running MCP's HTTP transport behind a reverse proxy.

The transport opens with a Server-Sent Events stream, and **the first event the server sends tells the client where to POST its messages.** The bridge was reachable from outside at `/mcp-bridge/mcp`, but the SSE stream advertised a bare `/mcp` as the callback. So the client connected to `/mcp-bridge/mcp`, took the session, read the endpoint event, and then POSTed its actual JSON-RPC to `/mcp` — a path Caddy had no route to the bridge for. The handshake looked flawless and nothing happened.

The tell was in the logs: the follow-up connection died in **0.002 seconds** with `context canceled`, far too fast to be the proxy rejecting it. That was not a rejection. That was the client cancelling its own request after the POST went nowhere useful.

Two ways to close it — add a second proxy route so the advertised path (`/mcp`) also reaches the bridge, or, cleaner, make the bridge advertise its real external path so the callback matches the route the client arrived on. The general rule matters more than either fix: when an MCP server sits behind a reverse proxy, **the callback URL it advertises in the SSE stream has to be externally routable**, not merely equal to the URL you connected to. Mismatch them and you get a perfect handshake followed by silence.

---

## Cause 3 — A Tool List That Arrived Too Late

Connection genuinely working, transport genuinely streaming, and still zero tools — this time for a reason with nothing to do with auth or routing.

The bridge aggregated its full catalogue (north of 200 tools, across several backends) **synchronously on every `tools/list` call**, which took around seven seconds. Claude Code registers tools during session startup and does not wait indefinitely; the response landed after it had already given up and opened the session with an empty tool set.

A naive in-memory cache does not rescue this on its own — it only helps the *second* caller, while the first still eats the full latency at startup, which is exactly the call that races the timeout. Two things do work:

- **Pre-warm the catalogue at boot**, after the backends initialise, so the cost moves to startup rather than to the first request.
- **Serve `tools/list` from a pre-fetched local snapshot** on the client side, so registration is effectively instant and never enters the race at all. This is the approach the packaged client path in [Alternative Access Paths](/projects/RufloOrchestration/architecture/access-paths) takes.

---

## What Was Measured and What Was Inferred

Worth separating, because two of these numbers are observations and two are not:

| Claim | Status |
|---|---|
| SSE callback mismatch, `0.002s` / `context canceled` | **Logged.** Captured from the proxy log at the time. |
| `tools/list` responding in ~7 seconds | **Measured**, and the fix resolved the symptom. |
| The client's registration window, ~5 seconds | **Inferred** from the observed behaviour. No documented constant confirms it. |
| A routing mismatch producing *this* `401` | **Reconstructed**, not captured. The discovery mechanism is certain; that the catch-all route produced this particular 401 is the most plausible read of the topology. The `curl -D -` recipe above is what turns that inference into a fact, and is the first thing to run on a recurrence. |
