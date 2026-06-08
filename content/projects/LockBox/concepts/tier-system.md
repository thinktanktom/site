# Tier System

## Overview

LockBox gates advanced features behind four service tiers. The active tier is set in the node configuration and applies globally to all assets managed by that service instance.

| Tier | Value |
|---|---|
| `basic` | 0 |
| `standard` | 1 |
| `premium` | 2 |
| `elite` | 3 |

---

## Capability Matrix

| Capability | Basic | Standard | Premium | Elite |
|---|---|---|---|---|
| Lock / Unlock | Yes | Yes | Yes | Yes |
| Emergency Unlock | No | No | Yes | Yes |
| Multi-Sig Support | No | No | Yes | Yes |
| Shard Copies | 1 | 2 | 3 | 4 |
| Decoy Ratio | 0 | 0.5 | 1.0 | 2.0 |
| Metadata Decoys | No | No | Yes | Yes |
| Metadata Decoy Ratio | — | — | 1.0 | 2.0 |

---

## Shard Copies

Higher tiers store multiple encrypted copies of each real shard, each encrypted under a different HKDF-derived key. This provides redundancy against storage corruption. In the current implementation, copies are stored locally with distinct key contexts; geographic distribution across separate storage backends is planned but not yet implemented.

---

## Decoy Shards

The decoy ratio determines how many fake shards are mixed in per real shard. A ratio of `1.0` means one decoy per real shard; `2.0` means two decoys per real shard. See [Shard Indistinguishability](./shard-indistinguishability) for the full model.

---

## Multi-Sig

Premium and Elite tiers allow a lock to be co-signed by multiple addresses. The `MultiSigAddresses` field on a `LockedAsset` lists the co-signer addresses; `MinSignatures` sets the threshold. At unlock time, the service verifies that at least `MinSignatures` valid Ed25519 signatures over the asset ID are present in the unlock request.

`CreateMultiSig` (the gRPC endpoint for establishing a multi-sig group independently of a lock) is not yet implemented and returns `codes.Unimplemented`.

---

## Emergency Unlock

Available on Premium and Elite. Emergency unlock bypasses LockScript evaluation and proceeds directly to shard recovery after verifying the Groth16 ownership proof. It is rate-limited per tier and intended for loss-of-key recovery scenarios.

---

## Checking Tier Capabilities in Code

```go
caps := service.GetCapabilities(config.Tier)

if caps.MultiSigSupported {
    // validate multi-sig
}

if caps.EmergencyUnlock {
    // allow emergency path
}

for copy := 0; copy < caps.ShardCopies; copy++ {
    storeShardCopy(shard, copy)
}
```
