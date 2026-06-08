# Node Setup

## Overview

The LockBox node is a fork of **IOTA HORNET v2.0.2**, modified to:
- Run on an isolated devnet (`lockbox-devnet`) with no connection to IOTA mainnet or testnet.
- Use a custom native token: **LockCoin (LOCK)**.
- Expose API on localhost only (no public-facing ports by default).
- Bind the LockBox sidecar service to the node's lifecycle via a HORNET component.

---

## Requirements

| Dependency | Version |
|---|---|
| Go | 1.22 or later |
| Git | For cloning |
| RAM | 4 GB minimum, 8 GB recommended |
| Disk | 10 GB minimum |

Optional: `curl` and `jq` for API testing.

---

## Building

```bash
git clone https://github.com/dueldanov/lockbox.git
cd lockbox

go build -o lockbox-node .
```

Build time: approximately 30–60 seconds. Output binary size: ~44 MB.

---

## Running

### Automatic (recommended)

```bash
./start.sh
```

The start script handles:
1. Checking for an existing genesis snapshot (creates one if absent).
2. Verifying no existing lockbox-node process is running.
3. Removing stale database lock files from unclean shutdowns.
4. Launching the node with `config_lockbox_devnet.json`.

### Manual

```bash
# First run only: create genesis snapshot
./lockbox-node tool snap-gen \
  --protocolParametersPath=protocol_parameters_devnet.json \
  --mintAddress=tst1qpszqzadsym6wpppd6z037dvlejmjuke7s24hm95s9fg9vpua7vlupxvxq2 \
  --treasuryAllocation=0 \
  --outputPath=lockbox_devnet_snapshots/full_snapshot.bin

# Start
./lockbox-node --config config_lockbox_devnet.json
```

---

## Verifying the Node

```bash
# Health check (empty response = healthy)
curl http://127.0.0.1:14265/health

# Node info
curl http://127.0.0.1:14265/api/core/v2/info | jq .
```

Expected info response:

```json
{
  "name": "LockBox",
  "version": "2.0.2",
  "protocol": {
    "networkName": "lockbox-devnet",
    "bech32Hrp": "lck"
  },
  "baseToken": {
    "name": "LockCoin",
    "tickerSymbol": "LOCK"
  }
}
```

---

## Node Management Scripts

| Script | Purpose |
|---|---|
| `./start.sh` | Start the node (with preflight checks) |
| `./stop.sh` | Gracefully stop the node and clean lock files |
| `./status.sh` | Check whether the node process is running |
| `./clean.sh` | Delete all database and snapshot data (destructive) |

---

## Network Configuration

The devnet is intentionally isolated:

| Setting | Value |
|---|---|
| Network name | `lockbox-devnet` |
| REST API | `127.0.0.1:14265` (localhost only) |
| P2P gossip | `127.0.0.1:15600` (localhost only) |
| Autopeering | Disabled |
| Entry nodes | None (no external peers) |
| Snapshot downloads | Disabled |
| Database engine | Pebble (no RocksDB dependency) |

---

## Differences from Upstream HORNET

| Aspect | HORNET v2.0.2 | LockBox |
|---|---|---|
| Module path | `github.com/iotaledger/hornet/v2` | `github.com/dueldanov/lockbox/v2` |
| Binary name | `hornet` | `lockbox-node` |
| Default alias | `"HORNET node"` | `"LockBox Node"` |
| Network | IOTA mainnet / Shimmer | `lockbox-devnet` (isolated) |
| Native token | IOTA / SMR | LockCoin (LOCK) |
| Custom packages | None | `internal/` sidecar + `components/lockbox` |
| Protocol logic | Unchanged | Unchanged |

All IOTA protocol logic, consensus mechanisms, and tangle internals are **unchanged** from the upstream fork. The node is fully protocol-compatible with the IOTA network if reconfigured to connect to it.
