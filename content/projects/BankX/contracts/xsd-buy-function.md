# XSDBuyBelowPeg

## Overview

XSDBuyBelowPeg is the function contract that executes XSD purchases on behalf of AI DeFi when XSD is trading below its silver peg. When called by the Rules Engine, it withdraws ETH from the TreasuryPool, computes a slippage-adjusted minimum XSD output, and calls the BankX Router's `swapETHForXSD` function. The XSD received is retained in the TreasuryPool.

This is the third contract deployed in the AI DeFi sequence. Its addresses for the Rules Engine and TreasuryPool are set via post-deployment setters rather than in the constructor.

---

## Key Concepts

- **Slippage tolerance** — A percentage applied to the expected XSD output to compute a minimum acceptable return. Protects against sandwich attacks on the swap.
- **Assembly return data decoding** — The Router's `swapETHForXSD` return value is extracted using inline Yul assembly rather than `abi.decode()`, reducing gas cost for a single `uint256` return value.
- **Approved caller** — Only the Rules Engine (set via setter) can call the execute function. Direct external calls are rejected.

---

## Architecture

```
RulesEngine → XSDBuyBelowPeg.execute()
                    │
                    ├── TreasuryPool.withdrawEthForFunction(amount)
                    │
                    └── Router.swapETHForXSD{value: amount}(minXsdOut)
                              │
                              ▼
                       XSD received → TreasuryPool
```

---

## Core Functions

| Function | Access | Description |
|---|---|---|
| `execute(uint256 ethAmount)` | Rules Engine only | Withdraws `ethAmount` ETH from TreasuryPool, computes slippage floor, and calls Router to swap ETH for XSD. |
| `setRulesEngine(address)` | Owner | Sets the Rules Engine address permitted to call `execute`. |
| `setTreasuryPool(address)` | Owner | Sets the TreasuryPool address used for ETH withdrawal and XSD receipt. |
| `setSlippageTolerance(uint256)` | Owner | Sets the maximum permitted slippage in basis points. |

---

## Return Data Decoding

After calling `Router.swapETHForXSD` as a low-level call, the contract extracts the XSD amount received using inline assembly:

```solidity
uint256 xsdAmount;
if (data.length >= 32) {
    assembly {
        // add(data, 32): skip the 32-byte ABI length prefix
        // mload: load one uint256 (32 bytes) from that position
        xsdAmount := mload(add(data, 32))
    }
}
require(xsdAmount > 0, "XSDBuyBelowPeg: No XSD received");
```

This is more gas-efficient than `abi.decode(data, (uint256))` for a single return value. The `data.length >= 32` guard ensures no out-of-bounds memory read if the call returns less data than expected.

---

## Slippage Calculation

Before calling the Router, the contract calculates a minimum acceptable XSD output from the current pool reserves and applies the slippage tolerance:

```solidity
// Conceptual slippage floor (basis points)
uint256 expectedXsd = getExpectedXsdOut(ethAmount); // from pool reserves
uint256 minXsdOut = (expectedXsd * (BASIS_POINTS - slippageTolerance)) / BASIS_POINTS;
```

The Router enforces this minimum — if the swap would return fewer XSD than `minXsdOut`, it reverts.

---

## Security Considerations

- **Single approved caller.** Only the address set via `setRulesEngine` can invoke `execute`. All other callers are rejected.
- **Minimum XSD output.** The slippage floor prevents the system from accepting manipulated pool states during execution.
- **No `gasCostBuffer`.** An earlier version reserved a portion of ETH to cover estimated gas costs. This was removed to simplify the contract — gas is paid by the automation caller.
- **Error logging during testing.** An earlier version included logic to extract and emit revert reasons from the Router call for debugging. This is removed in production after testing on Arbitrum.
