# HKDF Key Derivation

## Overview

All encryption keys in LockBox are derived on demand from a single 32-byte master key using **HKDF-SHA256** (RFC 5869). No derived key is stored; they are computed fresh from `(masterKey, salt, context)` and cleared from memory after use.

The implementation lives in `internal/crypto/hkdf.go`.

---

## HKDFManager

```go
type HKDFManager struct {
    masterKey   []byte  // 32 bytes, held in memory only
    salt        []byte  // 32 bytes, random per session / per bundle
    saltVersion uint32  // incremented on rotation
}
```

### Construction

```go
// New manager with a randomly generated salt
manager, err := NewHKDFManager(masterKey)

// Restore a manager with a persisted salt (e.g., for recovery)
manager, err := NewHKDFManagerWithSalt(masterKey, savedSalt)
```

Always call `manager.Clear()` when the manager is no longer needed to zero out the master key and salt in memory.

---

## Key Derivation Methods

### Generic derivation

```go
key, err := manager.DeriveKey(contextBytes)
```

Produces a 32-byte key using:

```
HKDF-SHA256(
    ikm  = masterKey,
    salt = salt,
    info = "lockbox-hkdf-v1" || contextBytes
)
```

### Shard-position key (primary path)

```go
key, err := manager.DeriveKeyForPosition(bundleID, position)
```

Context format: `LockBox:shard:{bundleID}:{position}`

This is the unified method for both real and decoy shards. Real and decoy positions share the same format — no type marker — so keys are indistinguishable by inspection.

### Purpose-specific helpers

| Method | Context Format |
|---|---|
| `DeriveKeyForShard(shardID)` | `uint32 big-endian (legacy)` |
| `DeriveKeyForShardPosition(shardID, index)` | Length-prefixed `LockBox:v1-shard + shardID + index` |
| `DeriveKeyForRealChar(index)` | `LockBox:real-char:{index}` |
| `DeriveKeyForDecoyChar(index)` | `LockBox:decoy-char:{index}` |
| `DeriveKeyForRealMeta(index)` | `LockBoxMeta:real-meta:{index}` |
| `DeriveKeyForDecoyMeta(index)` | `LockBoxMeta:decoy-meta:{index}` |

`DeriveKeyForShardPosition` uses length-prefixed framing to prevent context aliasing (where `shardID=1, index=23` and `shardID=12, index=3` would collide in a naive concatenation).

---

## Salt Management

The salt is **not global** — each asset bundle stores its own salt in the `LockedAsset.Salt` field. To recover shards after a node restart, the service clones the `HKDFManager` with the stored salt:

```go
bundleManager, err := manager.CloneWithSalt(asset.Salt)
defer bundleManager.Clear()
```

Salt rotation (generating a new random salt) is available via `RotateSalt()`. The `SaltVersion` field tracks which salt generation encrypted a given bundle to support migration.

---

## HKDFEncryptor

A convenience wrapper pairing an `HKDFManager` with a `cipher.AEAD` for encrypt/decrypt operations:

```go
encryptor, err := NewHKDFEncryptor(masterKey)
defer encryptor.Clear()

ciphertext, err := encryptor.EncryptWithContext(plaintext, contextBytes)
plaintext, err  := encryptor.DecryptWithContext(ciphertext, contextBytes)
```

The derived key is used only for the duration of the encrypt/decrypt call, then cleared.

---

## Memory Safety

All derived keys are cleared immediately after use via `clearBytes()`, which zeroes the slice in place. The key pool (`sync.Pool`) is used for intermediate buffers to reduce allocation pressure, with each buffer cleared before being returned to the pool.
