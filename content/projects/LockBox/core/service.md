# Core Service

## Overview

`internal/service` is the central coordinator of the LockBox sidecar. It orchestrates the crypto layer, LockScript engine, storage layer, and verification layer to implement the five core operations.

---

## Operations

### LockAsset

```go
func (s *Service) LockAsset(ctx context.Context, req *LockAssetRequest) (*LockAssetResponse, error)
```

**Steps:**
1. Validate the `LockScript` by compiling it (fail-fast — rejects invalid scripts before writing any state).
2. Check tier capabilities to determine shard copy count, decoy ratio, and metadata decoy availability.
3. Generate a fresh HKDF salt for this asset bundle.
4. Encrypt asset data → real shards via `ShardEncryptor`.
5. Generate decoy shards via `DecoyGenerator` at the tier's configured ratio.
6. Mix real and decoy shards via `ShardMixer` to produce an indistinguishable bundle.
7. Apply metadata decoys if the tier supports them (Premium/Elite).
8. Generate a Groth16 ownership proof binding the asset commitment to the owner address.
9. Persist the `LockedAsset` record with `TotalShards`, `RealCount`, `Salt`, and `SaltVersion` — but **not** a shard type map.

**Returns:** `LockAssetResponse` with the generated `assetID`, `lockTime`, and `unlockTime`.

---

### UnlockAsset

```go
func (s *Service) UnlockAsset(ctx context.Context, req *UnlockAssetRequest) (*UnlockAssetResponse, error)
```

**Steps:**
1. Load the `LockedAsset` record from storage.
2. Verify the Groth16 ownership proof. Failure → `ErrUnauthorized`.
3. If the asset has `MultiSigAddresses`, verify that at least `MinSignatures` valid Ed25519 signatures are present in the request.
4. Compile the stored `LockScript` and execute it in the sandboxed VM with the unlock context.
5. If the script returns `false` → `ErrUnlockConditionsNotMet`.
6. Recover real shards via trial decryption (HKDF key at each position; AEAD authentication identifies real shards).
7. Reconstruct and return plaintext data; update asset status to `unlocked`.

---

### EmergencyUnlock

```go
func (s *Service) EmergencyUnlock(ctx context.Context, req *EmergencyUnlockRequest) (*EmergencyUnlockResponse, error)
```

Available on **Premium and Elite tiers only**. Bypasses LockScript evaluation. Still requires:
- Valid Groth16 ownership proof.
- Rate-limit check per tier.

Intended for recovery scenarios where normal unlock conditions cannot be satisfied (e.g., lost co-signer keys, expired time-lock with no signature available).

---

### GetAssetStatus

```go
func (s *Service) GetAssetStatus(ctx context.Context, assetID string) (string, error)
```

Returns the current `AssetStatus` string for the given asset ID. Errors with `ErrAssetNotFound` if no matching record exists.

---

### ListAssets

```go
func (s *Service) ListAssets(ctx context.Context, ownerAddress iotago.Address) ([]*LockedAsset, error)
```

Returns all `LockedAsset` records associated with the given owner address, across all statuses.

---

## Key Types

### LockAssetRequest

| Field | Type | Notes |
|---|---|---|
| `OwnerAddress` | `iotago.Address` | IOTA bech32 owner address |
| `OutputID` | `iotago.OutputID` | UTXO output being locked |
| `Amount` | `uint64` | Token amount |
| `LockDuration` | `time.Duration` | Duration of the lock |
| `LockScript` | `string` | LockScript program |
| `MultiSigAddresses` | `[]iotago.Address` | Optional co-signers |
| `MinSignatures` | `int` | m-of-n threshold |

### LockedAsset

| Field | Type | Notes |
|---|---|---|
| `ID` | `string` | 16-byte hex asset ID |
| `OwnerAddress` | `iotago.Address` | Owner (bech32-serialised for storage) |
| `Status` | `AssetStatus` | `locked`, `unlocking`, `unlocked`, `expired`, `emergency` |
| `TotalShards` | `int` | Real + decoy shard count |
| `RealCount` | `int` | Number of real shards |
| `Salt` | `[]byte` | HKDF salt for key derivation recovery |
| `SaltVersion` | `uint32` | Salt rotation tracking |
| `DataLength` | `int` | Original plaintext length (for post-decryption trim) |

---

## Error Types

| Error | Meaning |
|---|---|
| `ErrAssetNotFound` | No asset with the given ID in storage |
| `ErrUnauthorized` | Ownership proof or signature verification failed |
| `ErrUnlockConditionsNotMet` | LockScript returned false |
| `ErrTierNotSupported` | Requested operation not available at current tier |
