# LockBox — Introduction

## Overview

LockBox is a private IOTA node coupled with an asset-custody sidecar service. It provides a programmable locking primitive on top of the IOTA UTXO model: any token output can be locked under a time condition, a cryptographic signature, or an arbitrary script — and released only when those conditions are verifiably met.

The project is built in Go, runs on an isolated IOTA devnet (network name: `lockbox-devnet`, native token: **LockCoin / LOCK**), and exposes its functionality through a gRPC and REST API.

---

## Goals

- **Programmable custody** — unlock conditions are not hardcoded; they are expressed in a custom scripting language (LockScript) evaluated at unlock time.
- **Privacy-preserving storage** — the encrypted shard model ensures that the storage layer holds no information about which shards are real and which are decoys.
- **Zero-knowledge ownership** — asset ownership is proven via a Groth16 ZKP without revealing the owner's secret material.
- **Tiered capabilities** — four service tiers (Basic → Elite) gate access to features like multi-sig, emergency unlock, metadata decoys, and redundant shard copies.

---

## Module Map

| Package | Role |
|---|---|
| `internal/interfaces` | Shared types (`LockedAsset`, `Tier`, `AssetStatus`) — no import cycles |
| `internal/service` | Core business logic: Lock / Unlock / Emergency / Status / List |
| `internal/crypto` | HKDF key derivation, ChaCha20 encryption, ZKP, decoy generation |
| `internal/lockscript` | Lexer, parser, AST, bytecode compiler, stack VM, Ed25519 builtins |
| `internal/b2b` | Partner API: gRPC + REST, revenue sharing, public/security sales |
| `internal/verification` | Token and rate-limit verification layer |
| `internal/consensus` | Consensus manager for multi-node agreement |
| `internal/monitoring` | Prometheus metrics, alerting rules |
| `internal/logging` | Structured logging with operation phases |
| `components/lockbox` | HORNET component wiring the sidecar into the node lifecycle |

---

## Asset Lifecycle

```
LockAsset(req)
    │
    ├── Validate LockScript (fail-fast compile check)
    ├── Generate HKDF master key bundle + salt
    ├── Encrypt data → real shards (ChaCha20-Poly1305)
    ├── Generate decoy shards (tier-gated ratio)
    ├── Mix real + decoy → indistinguishable bundle
    ├── Generate Groth16 ownership proof
    └── Persist LockedAsset to storage

UnlockAsset(req)
    │
    ├── Verify Groth16 ownership proof
    ├── Verify multi-sig (if configured)
    ├── Execute LockScript in sandboxed VM
    │       └── Inject: current_time, signatures, pubkeys, asset_id
    ├── If script returns true → proceed
    ├── Recover real shards via trial decryption
    └── Release asset → update status to "unlocked"
```

---

## Dependency Graph

```
interfaces (no deps)
     ↓
   crypto (interfaces)
     ↓
lockscript (crypto)
     ↓
verification (interfaces, crypto)
     ↓
  service (ALL above)
     ↓
    b2b (service, tiering)
```

The `interfaces` package is the dependency-cycle firewall: shared types live there so that `service` and `verification` can both import them without creating a cycle.

---

## Asset Status States

| Status | Meaning |
|---|---|
| `locked` | Asset is locked and awaiting unlock |
| `unlocking` | Unlock initiated; conditions evaluated |
| `unlocked` | Asset successfully released |
| `expired` | Lock duration elapsed without unlock |
| `emergency` | Emergency unlock procedure initiated |
