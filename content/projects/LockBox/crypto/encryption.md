# Shard Encryption

## Overview

Asset data is encrypted at rest using **ChaCha20-Poly1305** (XChaCha20-Poly1305 variant with a 192-bit nonce). Each shard is encrypted under its own HKDF-derived key. The AEAD authentication tag doubles as the real-vs-decoy discriminator during trial decryption.

The implementation lives in `internal/crypto/encrypt.go`.

---

## CharacterShard

The fundamental storage unit is a `CharacterShard`:

| Field | Type | Description |
|---|---|---|
| `ID` | `uint32` | Unique shard identifier |
| `Index` | `uint32` | Position in the shard sequence |
| `Total` | `uint32` | Total shard count in the bundle |
| `Data` | `[]byte` | Encrypted ciphertext (nonce prepended) |
| `Nonce` | `[]byte` | 24-byte random nonce |
| `Checksum` | `[]byte` | Integrity check over plaintext |
| `Timestamp` | `int64` | Unix creation time |

---

## Encryption Process

For each shard at position `i`:

1. **Derive key:** `key = HKDF(masterKey, salt, "LockBox:shard:{bundleID}:{i}")`
2. **Generate nonce:** 24 random bytes from `crypto/rand`.
3. **Encrypt:** `ciphertext = XChaCha20-Poly1305.Seal(nonce, plaintext, additionalData=context)`
4. **Store:** `nonce || ciphertext` as the shard's `Data` field.

The context bytes are passed as AEAD additional data, binding the ciphertext to its derivation context. A shard moved to a different position would fail authentication even if the key were reused.

---

## Decryption Process

For each shard at position `i`:

1. **Derive key:** same context as encryption.
2. **Extract nonce:** first 24 bytes of `Data`.
3. **Decrypt:** `XChaCha20-Poly1305.Open(nonce, ciphertext, additionalData=context)`.
4. **Authentication:** if the Poly1305 tag does not match, `Open` returns an error → shard is a decoy or corrupted.

This is the trial-decryption recovery path: iterate all positions, collect those that decrypt successfully, stop when `RealCount` real shards have been found.

---

## AEAD Parameters

| Parameter | Value |
|---|---|
| Algorithm | XChaCha20-Poly1305 |
| Key size | 32 bytes |
| Nonce size | 24 bytes |
| Tag size | 16 bytes |
| Additional data | HKDF context bytes |

XChaCha20 (not the standard ChaCha20) is used for its 192-bit nonce, which eliminates nonce-collision risk for independently-generated random nonces across large shard counts.

---

## ShardEncryptor

```go
encryptor, err := NewShardEncryptor(masterKey, shardSize)

// Encrypt data → slice of CharacterShards
shards, err := encryptor.EncryptData(plaintext)

// Decrypt slice of shards → plaintext
decrypted, err := encryptor.DecryptShards(shards)
```

The `shardSize` parameter (default: 4096 bytes) controls how plaintext is segmented before encryption. Padding is applied to align the final shard to `shardSize`; `DataLength` on the `LockedAsset` record is used to trim the recovered plaintext back to the original length.
