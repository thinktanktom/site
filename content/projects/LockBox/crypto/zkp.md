# Zero-Knowledge Proofs

## Overview

LockBox uses **Groth16 zero-knowledge proofs** (via the `gnark` library) to establish asset ownership without revealing the owner's secret material. An ownership proof is generated at lock time and stored with the asset; it is verified at every unlock or emergency-unlock attempt.

The implementation lives in `internal/crypto/zkp.go`.

---

## Why ZKP?

A straightforward ownership check — "provide a signature over the asset ID" — requires the caller to re-sign on every unlock. That is functional, but it means ownership verification is tied to a live key. A Groth16 proof:

1. Is generated once at lock time, binding the commitment to the owner's address and a random challenge.
2. Can be verified by anyone who knows the verification key — without the owner's secret.
3. Does not reveal the owner's private key or the original secret used to generate the proof.

---

## OwnershipProof

```go
type OwnershipProof struct {
    AssetCommitment []byte  // SHA-256 commitment over asset data
    OwnerAddress    []byte  // Serialised owner address
    Challenge       []byte  // Random 32-byte challenge
    Timestamp       int64   // Unix timestamp of proof generation
    ProofBytes      []byte  // Serialised groth16.Proof — must be persisted
}
```

`ProofBytes` is the serialised Groth16 proof object. It **must** be persisted to storage; the proof cannot be regenerated without the original witness (which is not kept after lock time).

---

## UnlockProof

```go
type UnlockProof struct {
    UnlockCommitment []byte  // Commitment over unlock conditions
    UnlockTime       int64   // Configured unlock timestamp
    CurrentTime      int64   // Time at proof generation
}
```

`UnlockProof` is used in the unlock path to prove that the time condition is satisfied without revealing the full asset record.

---

## ZKPProvider Interface

All ZKP operations are accessed through the `ZKPProvider` interface defined in `internal/interfaces/service.go`. This allows the ZKP layer to be mocked in unit tests without pulling in the `gnark` dependency.

```go
type ZKPProvider interface {
    GenerateOwnershipProof(assetID, ownerSecret []byte) (*OwnershipProof, error)
    VerifyOwnershipProof(proof *OwnershipProof) error
    GenerateUnlockProof(unlockSecret, assetID, additionalData []byte, unlockTime int64) (*UnlockProof, error)
    VerifyUnlockProof(proof *UnlockProof) error
}
```

---

## Commitment Scheme

Commitments use SHA-256 with domain separation:

```
AssetCommitment  = SHA-256("LockBox:commitment:" || assetID || ownerAddress)
OwnerAddress     = SHA-256("LockBox:address:"    || secret)
UnlockCommitment = SHA-256("LockBox:unlock:"     || unlockSecret || assetID || additionalData)
```

Domain separation ensures commitments from different contexts never collide, even if the pre-image data is structurally similar.

---

## Security Notes

- **Proof freshness.** The `Timestamp` field and `Challenge` bytes in `OwnershipProof` bind the proof to a specific moment and a random value, preventing replay of proofs across different asset instances.
- **Concurrency.** The ZKP prover and verifier are safe for concurrent use; the implementation uses `sync.Mutex` internally where gnark's circuit compilation is not re-entrant.
- **Test discipline.** The project's security testing guidelines explicitly require that ZKP tests use real cryptographic operations — not stub implementations — and that fake/invalid proofs must fail verification deterministically.
