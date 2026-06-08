# Asset Locking

## What Is an Asset Lock?

In LockBox, a **lock** is a binding between an IOTA token output and a set of conditions that must be satisfied before that output can be moved. Once locked, the asset is held in custody by the LockBox service. The original owner retains provable ownership (via a ZKP) but cannot release the asset until the conditions evaluate to `true`.

---

## Lock Parameters

Every lock is created with a `LockAssetRequest` containing:

| Field | Type | Description |
|---|---|---|
| `OwnerAddress` | `iotago.Address` | IOTA bech32 address of the owner |
| `OutputID` | `iotago.OutputID` | The UTXO output being locked |
| `Amount` | `uint64` | Token amount |
| `LockDuration` | `time.Duration` | How long the asset stays locked |
| `LockScript` | `string` | LockScript program expressing unlock conditions |
| `MultiSigAddresses` | `[]iotago.Address` | Optional co-signers (Premium/Elite tiers) |
| `MinSignatures` | `int` | Threshold for multi-sig (m-of-n) |

---

## What Happens at Lock Time

1. **Script validation.** The LockScript string is compiled immediately. If it contains syntax errors or unsupported operations, `LockAsset` returns an error before any state is written (`fail-fast`).
2. **Key derivation.** A fresh HKDF salt is generated. All encryption keys for this asset's shards are derived from the service's master key + this salt.
3. **Shard encryption.** Asset data is encrypted and split into real shards using ChaCha20-Poly1305.
4. **Decoy injection.** Decoy shards (cryptographically indistinguishable from real shards) are generated and mixed in at the tier's configured ratio.
5. **Ownership proof.** A Groth16 zero-knowledge proof binding the asset commitment to the owner's address is generated and stored alongside the asset record.
6. **Persistence.** The `LockedAsset` record — including `TotalShards`, `RealCount`, and `Salt` — is written to storage. The `ShardIndexMap` (which shard is real) is **not** stored; recovery uses trial decryption instead.

---

## What Happens at Unlock Time

1. **Ownership proof verification.** The stored Groth16 proof is re-verified. If verification fails, the request is rejected.
2. **Multi-sig check.** If the asset was locked with `MultiSigAddresses`, the supplied signatures are verified against the required threshold.
3. **LockScript execution.** The lock script is compiled and run in a sandboxed VM. The VM context is populated with `current_time`, `unlock_time`, `signatures`, `pubkeys`, and `asset_id`.
4. **Trial decryption.** Real shards are identified by attempting decryption with the HKDF-derived keys at each position. Shards that decrypt successfully (AEAD authentication passes) are real; the rest are decoys.
5. **Status update.** If all checks pass, the asset status transitions to `unlocked`.

---

## Emergency Unlock

Assets on Premium and Elite tiers can be released via `EmergencyUnlock` — a separate code path that bypasses the LockScript evaluation. Emergency unlock still requires ownership proof verification and is rate-limited by the tier configuration. It is intended for recovery scenarios where normal unlock conditions cannot be met (e.g., lost co-signer keys).
