# Security Model

## Threat Model

LockBox is designed to protect assets against two primary threat categories:

1. **Storage-layer adversary** — an attacker who obtains read access to the persisted `LockedAsset` records and the shard storage, but does not have the HKDF master key.
2. **API-layer adversary** — an attacker who can send arbitrary requests to the gRPC/REST interface, including replay attacks and crafted proofs.

---

## Defence in Depth

### 1. HKDF Key Separation

Every shard has its own derived key. Compromising one shard's key (e.g., via side-channel on a single decrypt call) does not expose keys for other shards. The master key never appears in storage or on the wire.

### 2. Shard Indistinguishability

The storage layer holds no information about which shards are real. An attacker with storage access and no master key cannot determine how many real shards exist, which positions they occupy, or what the data contains. See [Shard Indistinguishability](../concepts/shard-indistinguishability).

### 3. ZKP Ownership Proofs

Ownership is proven via Groth16, not via a live signature. This means:
- The owner's private key is not required at every unlock.
- The proof cannot be replayed for a different asset (bound to asset commitment + random challenge).
- Verification does not reveal anything about the owner's secret.

### 4. LockScript Sandboxing

Scripts execute in a sandboxed VM with hard limits:
- 65 536-byte memory bound.
- 5-second wall-clock execution timeout.
- No I/O, no network, no system calls.
- No dynamic code evaluation (`eval`).

Scripts are also validated at lock time, so execution-time failures are limited to logic errors rather than parse or compile panics.

### 5. Ed25519 Real Cryptography

All signature verification uses real Ed25519 operations. The codebase's security testing guidelines explicitly prohibit stub implementations: a fake signature must fail verification, and tests must assert this. The `require_sigs` multi-sig function was audited and corrected — prior to the fix it counted non-empty strings rather than verifying actual signatures.

### 6. Memory Safety

All sensitive key material is zeroed via `clearBytes()` after use. `defer hkdfManager.Clear()` is required idiom for any code that holds a key manager. The `HKDFManager` uses a `sync.Pool` for intermediate key buffers with explicit clearing before pool return. Platform-specific memory locking (`mlock`) is available via `memory_syscall.go` on supported systems.

### 7. Block-Delay (Node Layer)

Inherited from HORNET: all UTXO state transitions in the node layer require a prior `priceCheck()` recorded at least 2 blocks back, preventing same-transaction manipulation of token balances.

---

## Known Limitations

| Issue | Status |
|---|---|
| `CreateMultiSig` endpoint | Returns `codes.Unimplemented` |
| Geo-distribution of shard copies | Copies stored locally; cross-node geo-distribution not implemented |
| `service` test suite | Blocked by logger initialisation issue (`TestLockAsset` fails) |
| `verification` test suite | Blocked by import cycle in test file |

---

## Security Testing Principles

The project's `SECURITY_TESTING.md` establishes a mandatory testing standard for all cryptographic code:

- Valid input → must succeed.
- Fake / invalid input → **must fail** (not silently pass).
- Wrong key → must fail.
- Malformed input → must fail.
- Replay attack → must fail (for nonce-protected operations).

Tests that pass with a broken implementation (e.g., a `verify()` that always returns `true`) are rejected as insufficient. The security test suite enforces this with real key generation and real signature operations in every cryptographic test case.
