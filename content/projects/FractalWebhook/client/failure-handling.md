# Polling Client — Failure Handling

## Transient Errors

Network blips, 5xx responses, and 429 rate-limit responses are treated as transient. The polling client uses exponential backoff:

```
1s → 2s → 4s → 8s → 16s → 32s → (capped at 60s)
```

Backoff resets to 0 on the next successful poll.

---

## Persistent Auth Failure

A `401 Unauthorized` response is not retried. The polling client halts immediately and surfaces a clear operator-visible error:

```
POLLING HALTED: 401 Unauthorized from /signals/pending.
Check FRACTAL_POLLING_BEARER_TOKEN in your .env file.
This may indicate the bearer token was rotated server-side.
```

A persistent 401 most likely means the bearer token in the laptop `.env` does not match the token on the VPS — either a misconfiguration or a deliberate rotation.

---

## Internet Connectivity Loss

If the operator's laptop loses internet connectivity, queued signals remain safely on the VPS. On reconnection, the polling client resumes and drains the queue. No signals are lost as a result of laptop-side connectivity issues.

---

## Backoff and Health Monitoring Interaction

Exponential backoff applies to the polling loop (signal fetching). Health monitoring is a separate call path with its own 60-second interval. Three consecutive health failures (not polling failures) trigger the pause-and-notify sequence described in [Health Monitoring](/projects/FractalWebhook/client/health-monitoring).

---

## Server Restart

If the VPS is rebooted or the webhook service is restarted, the SQLite database is unaffected. On reconnect, the polling client resumes from where it left off — any signals that arrived during the downtime are returned by the next `GET /signals/pending` call.
