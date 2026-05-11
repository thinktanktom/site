# Access Control

## Overview

BankX uses a three-tier, role-based access control model implemented through Solidity modifiers. There are no role registries or mapping-based permission stores — access is determined by comparing `msg.sender` to specific stored addresses. Each contract manages its own ownership independently.

---

## The Three Tiers

### Tier 1: `onlyByOwner`

The deployer or a designated `smartcontract_owner` address. Equivalent to a protocol admin.

```solidity
modifier onlyByOwner() {
    require(msg.sender == smartcontract_owner, "...:FORBIDDEN");
    _;
}
```

**What it controls:**
- Adding/removing pool addresses (XSDStablecoin)
- Setting oracle addresses, router address, treasury (XSDStablecoin, BankXToken)
- Adjusting PID Controller parameters (CR step, price band, cooldowns, etc.)
- Pausing/unpausing minting, redeeming, buyback, swaps, liquidity
- Pool parameter changes (block delay, pause states)
- Ownership transfer and renouncement

**Present in:** `XSDStablecoin`, `BankXToken`, `CollateralPool`, `PIDController`, `RewardManager`, `Router`, `XSDWETHpool`, `BankXWETHpool`

---

### Tier 2: `onlyPools`

Any address whitelisted in `XSDStablecoin.xsd_pools`. This is the mint/burn gate for both XSD and BankX.

```solidity
// In XSDStablecoin:
modifier onlyPools() {
    require(xsd_pools[msg.sender] == true, "Only xsd pools can call this function");
    _;
}

// In BankXToken (delegates to XSD registry):
modifier onlyPools() {
    require(XSD.xsd_pools(msg.sender) == true, "BANKX:FORBIDDEN");
    _;
}
```

**What it controls:**
- `XSDStablecoin.pool_mint()` — mint XSD to any address
- `XSDStablecoin.pool_burn_from()` — burn XSD from any address
- `BankXToken.pool_mint()` — mint BankX to any address
- `BankXToken.pool_burn_from()` — burn BankX from any address
- `BankXToken.mint()` — alias for `pool_mint`

**Currently whitelisted:** `CollateralPool` and `RewardManager` (both require pool minting for interest and reward payments).

:::danger
Adding an address to the pool whitelist grants unrestricted XSD and BankX minting power. A compromised or malicious pool address can inflate both token supplies without limit. Pool additions must be treated with the highest security scrutiny.
:::

---

### Tier 3: `onlyByOwnerOrPool`

Used in `XSDStablecoin` only. Allows either the owner or any whitelisted pool to call certain functions.

```solidity
modifier onlyByOwnerOrPool() {
    require(
        msg.sender == smartcontract_owner || xsd_pools[msg.sender] == true,
        "You are not the owner or a pool"
    );
    _;
}
```

This modifier does not currently gate any functions in the deployed contract (it is defined but not applied to any public function in `XSDStablecoin.sol`). It exists for future use.

---

## Special-Purpose Roles

| Role | Mechanism | Contracts |
|---|---|---|
| **Router only** | `require(msg.sender == router, ...)` | `XSDStablecoin.burnpoolXSD()`, `BankXToken.burnpoolBankX()` |
| **Treasury or owner** | `require(msg.sender == treasury \|\| msg.sender == smartcontract_owner)` | `Router.creatorAddLiquidityTokens()`, `Router.creatorAddLiquidityETH()` |
| **RewardManager only** | `onlyByRewardManager` modifier | `PIDController.amountPaidXSDWETH/BankXWETH/CollateralPool()` |
| **Initializer** | OpenZeppelin `initializer` modifier (one-time) | `CollateralPool`, `PIDController`, `RewardManager`, `Router`, pool `initialize()` |

---

## Ownership Model

Each contract stores its owner independently in `smartcontract_owner`. There is no global "ProxyAdmin" or upgradeable ownership hierarchy.

| Contract | `setSmartContractOwner` | `renounceOwnership` |
|---|---|---|
| `XSDStablecoin` | Yes (only current owner) | Yes — sets `address(0)`, irreversible |
| `BankXToken` | Yes | Yes — irreversible |
| `CollateralPool` | Yes (onlyByOwner) | Yes — irreversible |
| `PIDController` | Yes (onlyByOwner) | Yes — irreversible |
| `RewardManager` | Yes (onlyByOwner) | Yes — irreversible |
| `Router` | Yes (onlyByOwner) | Yes — irreversible |
| `XSDWETHpool` | Yes (direct owner check) | Yes — irreversible |
| `BankXWETHpool` | Yes (direct owner check) | Yes — irreversible |

:::warning
`renounceOwnership()` permanently locks all admin functions. If called on `XSDStablecoin`, it becomes impossible to add or remove pools, update oracles, or change any protocol parameter. Use a multisig or timelock as `smartcontract_owner` before considering renouncement.
:::

---

## Pool Registry Mechanics

The `XSDStablecoin` pool registry (`xsd_pools`) is the central permission gate:

```solidity
// Add a pool (onlyByOwner):
XSD.addPool(COLLATERAL_POOL_ADDRESS);

// Remove a pool (onlyByOwner):
XSD.removePool(OLD_POOL_ADDRESS);

// Check if address is a pool:
bool isPool = XSD.xsd_pools(MY_ADDRESS);

// Enumerate all pools (includes address(0) for removed entries):
uint len = XSD.xsd_pools_array.length;
for (uint i = 0; i < len; i++) {
    address pool = XSD.xsd_pools_array[i];
    if (pool != address(0)) { /* active pool */ }
}
```

Note: `removePool()` sets the array entry to `address(0)` but does not remove it. The array grows monotonically. Integrators iterating `xsd_pools_array` must handle zero address entries.

---

## Security Recommendations

1. **Use a multisig as `smartcontract_owner`.** A single EOA as owner is a single point of failure. Use a Gnosis Safe or equivalent.
2. **Implement a timelock on pool additions.** Any new pool addition should go through a 24–48 hour timelock to allow community review.
3. **Audit all contracts before whitelisting.** Never whitelist an unaudited contract as a pool.
4. **Track the pool array.** Monitor `PoolAdded` and `PoolRemoved` events on `XSDStablecoin` to detect unexpected pool changes.
5. **Verify `renounceOwnership` is not called prematurely.** Once ownership is renounced, no further admin actions are possible.
