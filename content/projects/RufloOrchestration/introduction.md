# AI Agent-Orchestration Infrastructure — Introduction

## Overview

This documents a self-hosted AI agent-orchestration environment I built, deployed, and continue to harden for an independent client, starting April 2026 and ongoing. The client uses the environment to develop their own product; the infrastructure itself — the VM, the container stack, the auth layer, the workflow tooling, and the run-control layer — is what I built and own.

The platform is [Ruflo](https://github.com/ruvnet/ruflo), an AI orchestration tool that bundles a chat UI fork (ruvocal), an MCP bridge exposing 200+ tools, and a Claude Code orchestration layer. Rather than accept Ruflo's documented setup path, I diagnosed and worked around several places where the actual repo diverges from its own docs, then built a production deployment and a client-facing workflow on top of it.

---

## What This Gave the Client

Two capabilities, running on a single DigitalOcean VM:

1. A live web-based chat UI, backed by Claude models through Ruflo's MCP bridge, secured with HTTPS and basic auth.
2. A remote MCP connection, so the client's own Claude Code desktop can reach the VM's MCP bridge directly — agentic access to their project codebase without SSH or a VPN.

On top of that base, I built a client-specific workflow layer: 12 specialist skill files, a headless orchestration script that drives Claude Code through sequential development passes, and two custom MCP tools that expose that workflow to any connected agent.

---

## Division of Ownership

This distinction matters and is worth stating plainly: **the infrastructure is mine, what the client builds with it is theirs.** I designed, deployed, debugged, and hardened the orchestration server. The client's product — its codebase, its features, its business logic — is entirely their own work, produced using the environment I built and operate.

---

## Scope of This Documentation

This documentation tree covers:

- The deployment architecture — the Docker Compose stack, Caddy routing, and the two exposed surfaces (chat UI, MCP bridge)
- The setup and debugging process — where Ruflo's documentation fell short of the actual repo, and the issues that surfaced getting the stack running cleanly
- The client workflow tooling — the skill files, the workflow runner script, and the custom MCP tools built on top of the bridge
- The run-control layer added after early agent runs fell into re-assessment loops
- The security posture — bearer token risk analysis, blast radius if a credential leaks, and the hardening checklist that followed from it

It does not cover the client's own product or codebase, which is out of scope for infrastructure documentation and, in any case, is the client's to describe.
