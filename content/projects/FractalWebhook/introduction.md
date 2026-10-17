# Fractal Webhook Server — Introduction

## Overview

The Fractal Webhook Server is the signal-delivery infrastructure for the **Fractal Effects** trading bot. It solves a specific integration problem: TradingView can fire HTTP webhooks when a chart alert triggers, but the trading bot is a Claude Code process running on an operator's laptop — which is not always on, not always reachable, and behind a dynamic IP address.

The solution is a small, hardened intermediate service: a **webhook server on a VPS** that receives signals from TradingView 24/7, queues them in a local SQLite database, and makes them available for the bot to poll when it is active.

---

## System Boundaries

Three pieces of software, two physical locations, one external integration:

| Component | Location | Uptime |
|---|---|---|
| Webhook server (Java / Spring Boot) | DigitalOcean VPS | 24/7 |
| Polling client (Python) | Operator's laptop | During trading sessions |
| Telegram notifier (Python) | Operator's laptop | During trading sessions |

The webhook server and the laptop components share no infrastructure. The webhook delivers signals **into** the bot. Telegram delivers events **out** of the bot.

---

## Signal Types

The system handles two alert types from the Fractal Effects TradingView indicator:

- **M (Manipulation)** — a market manipulation pattern, available in bullish and bearish variants
- **DB (Double Break)** — a double break pattern, available in bullish and bearish variants

TradingView fires four separate alert conditions — M Bullish, M Bearish, DB Bullish, DB Bearish — one per configured alert. Direction is encoded by which condition fires, not inferred from the candle. The bot receives direction explicitly in the payload.

---

## Design Principles

**At-least-once delivery.** The polling client processes a signal before acknowledging it. A crash mid-cascade leaves the signal unacked; it is re-delivered on the next poll. The trading strategy's own deduplication logic handles the re-delivery cleanly.

**No silent failures.** Every authentication event, deduplication hit, and schema rejection is written to an audit log table. Pre-session health checks refuse to start a trading session if the server is unreachable, the clocks are out of sync, or stale unacked signals are present.

**Minimal attack surface.** The Java application listens only on `127.0.0.1:8080`. Caddy is the only process exposed to the internet. The service user has no login shell and no home directory. Filesystem access is scoped to two directories via systemd hardening.

**Fire-and-forget Telegram.** Telegram sends never block trade execution. A failed send is logged as a warning; the Claude Code chat in the IDE is the durable record. No retry queue is needed or built.

---

## Scope

This documentation covers the webhook server, the polling client, and the Telegram notifier. The trading strategy itself — the cascade logic, entry rules, and position management — is a separate Claude Code project and is out of scope here.
