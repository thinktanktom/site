# Decoy System

## Overview

The decoy system generates fake shards that are cryptographically indistinguishable from real shards and mixes them into the stored shard bundle. It is the mechanism behind LockBox's storage-layer privacy guarantee.

The implementation lives in `internal/crypto/decoy.go`.

---

## DecoyGenerator

```go
gen := NewDecoyGenerator()

// Generate decoys at a given ratio relative to real shards
decoys := gen.GenerateDecoyShards(realShards, decoyRatio)
```

Each generated decoy shard:
- Is the **same byte length** as a real shard.
- Contains **cryptographically random bytes** (indistinguishable from valid ciphertext by statistical tests).
- Is **not** encrypted with a derivable key — it will always fail AEAD authentication during trial decryption.

The `decoyRatio` is a `float64`:
- `0.5` → 1 decoy per 2 real shards
- `1.0` → 1 decoy per real shard
- `2.0` → 2 decoys per real shard

Decoy count is rounded to the nearest integer.

---

## ShardMixer

```go
mixer := NewShardMixer()

// Mix real and decoy shards → uniform output bundle
mixed, indexMap := mixer.Mix(realShards, decoys)

// Recover real shards (in-memory path using stored indexMap)
realOnly := mixer.ExtractReal(mixed, indexMap)
```

`Mix` assigns decoy shards random high-range position indices and interleaves them with real shards. The resulting `mixed` slice looks uniform — all entries are the same size and structure.

The `indexMap` (mapping shard position to real/decoy) is used **only in-memory** during a live session. It is **not persisted to storage** — doing so would defeat the indistinguishability guarantee. After a restart, real shards are recovered via trial decryption (see [Shard Indistinguishability](../concepts/shard-indistinguishability)).

---

## DecoyStats

`DecoyStats` tracks the ratio and count of real vs. decoy shards for observability:

```go
type DecoyStats struct {
    TotalShards  int
    RealShards   int
    DecoyShards  int
    DecoyRatio   float64
}
```

This is surfaced through the monitoring layer so operators can verify the decoy subsystem is functioning at the expected ratio.

---

## Metadata Decoys

On Premium and Elite tiers, decoys are also applied to the asset **metadata** (the `LockedAsset` record fields, serialised and encrypted). The `DecoyGenerator` provides `GenerateMetadataDecoys` for this purpose. Metadata decoy handling uses `DeriveKeyForDecoyMeta` to keep metadata and data-shard key domains separate.

| Tier | Metadata Decoy Ratio |
|---|---|
| Basic / Standard | None |
| Premium | 1.0 (1 decoy per real metadata shard) |
| Elite | 2.0 (2 decoys per real metadata shard) |

Metadata recovery still uses the stored `MetadataIndexMap` rather than trial decryption, because metadata content is structured (not uniform binary data) and AEAD-based discrimination is less reliable across schema versions.

---

## Timing Considerations

Decoy generation uses `crypto/rand` for all random data. The generation time scales linearly with the number of decoys and their size. The `decoy_timing_test.go` file enforces that generation time remains within acceptable bounds under the tier's configured ratio, preventing timing-based inference about how many real shards exist.
